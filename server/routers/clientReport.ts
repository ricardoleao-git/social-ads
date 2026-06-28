import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { clients, clientReports } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { getGoogleAdsClient, getCustomerId, getLoginCustomerId } from "../googleAdsClient";
import { GOOGLE_ADS_REFRESH_TOKEN } from "../credentials";

// Busca métricas de um mês para grupos filtrados por nome
async function getMonthMetrics(adGroupFilter: string, month: string): Promise<{
  totalLeads: number;
  totalSpend: number;
  avgCtr: number;
  avgCpc: number;
  clicks: number;
  impressions: number;
  weeklyLeads: number[];
}> {
  try {
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const loginCustomerId = getLoginCustomerId();
    const customer = client.Customer({ customer_id: customerId, login_customer_id: loginCustomerId, refresh_token: GOOGLE_ADS_REFRESH_TOKEN });

    const [year, mon] = month.split("-");
    const startDate = `${year}-${mon}-01`;
    const lastDay = new Date(Number(year), Number(mon), 0).getDate();
    const endDate = `${year}-${mon}-${String(lastDay).padStart(2, "0")}`;

    const query = `
      SELECT
        ad_group.name,
        metrics.conversions,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        segments.week
      FROM ad_group
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND ad_group.name LIKE '%${adGroupFilter}%'
      ORDER BY segments.week
    `;

    const results = await customer.query(query);

    let totalLeads = 0;
    let totalSpend = 0;
    let totalCtr = 0;
    let totalCpc = 0;
    let clicks = 0;
    let impressions = 0;
    const weekMap = new Map<string, number>();

    for (const r of results) {
      totalLeads += Number(r.metrics?.conversions ?? 0);
      totalSpend += Number(r.metrics?.cost_micros ?? 0) / 1_000_000;
      totalCtr += Number(r.metrics?.ctr ?? 0);
      totalCpc += Number(r.metrics?.average_cpc ?? 0) / 1_000_000;
      clicks += Number(r.metrics?.clicks ?? 0);
      impressions += Number(r.metrics?.impressions ?? 0);
      const week = String(r.segments?.week ?? "");
      if (week) {
        weekMap.set(week, (weekMap.get(week) ?? 0) + Number(r.metrics?.conversions ?? 0));
      }
    }

    const count = results.length || 1;
    const weeklyLeads = Array.from(weekMap.values()).slice(0, 5);

    return {
      totalLeads: Math.round(totalLeads),
      totalSpend,
      avgCtr: totalCtr / count,
      avgCpc: totalCpc / count,
      clicks,
      impressions,
      weeklyLeads,
    };
  } catch {
    return { totalLeads: 0, totalSpend: 0, avgCtr: 0, avgCpc: 0, clicks: 0, impressions: 0, weeklyLeads: [] };
  }
}

// Gera resumo e próximos passos via LLM
async function generateAiContent(metrics: {
  clientName: string;
  product: string;
  month: string;
  totalLeads: number;
  totalSpend: number;
  avgCtr: number;
  cpl: number;
  customMessage?: string;
}): Promise<{ summary: string; nextSteps: string[] }> {
  try {
    const customContext = metrics.customMessage ? `\n\nMensagem personalizada do gestor: ${metrics.customMessage}` : '';
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Você é um especialista em marketing digital B2B da Zênite Tech. Responda em JSON." },
        {
          role: "user",
          content: `Gere um resumo executivo e 3 próximos passos para o relatório mensal do cliente.${customContext}

Cliente: ${metrics.clientName}
Produto: ${metrics.product}
Mês: ${metrics.month}
Leads gerados: ${metrics.totalLeads}
Gasto total: R$${metrics.totalSpend.toFixed(2)}
CTR médio: ${(metrics.avgCtr * 100).toFixed(2)}%
CPL: R$${metrics.cpl.toFixed(2)}

Responda em JSON: {"summary": "...", "nextSteps": ["...", "...", "..."]}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "report_content",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              nextSteps: { type: "array", items: { type: "string" } },
            },
            required: ["summary", "nextSteps"],
            additionalProperties: false,
          },
        },
      },
    });
    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) return { summary: "Relatório gerado automaticamente.", nextSteps: [] };
    const contentStr = typeof rawContent === 'string' ? rawContent : (rawContent as any[]).map((c: any) => c.text ?? '').join('');
    return JSON.parse(contentStr);
  } catch {
    return { summary: "Relatório gerado automaticamente.", nextSteps: ["Revisar performance das campanhas", "Otimizar palavras-chave negativas", "Testar novos anúncios RSA"] };
  }
}

export const clientReportRouter = router({
  /**
   * Lista todos os clientes cadastrados.
   */
  listClients: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(clients).orderBy(desc(clients.createdAt));
  }),

  /**
   * Cria um novo cliente.
   */
  createClient: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      product: z.string().min(1),
      email: z.string().email(),
      adGroupFilter: z.string().min(1),
      active: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(clients).values(input);
      return { success: true, id: (result as any).insertId };
    }),

  /**
   * Atualiza um cliente.
   */
  updateClient: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      product: z.string().optional(),
      email: z.string().email().optional(),
      adGroupFilter: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      await db.update(clients).set(data).where(eq(clients.id, id));
      return { success: true };
    }),

  /**
   * Remove um cliente.
   */
  deleteClient: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(clients).where(eq(clients.id, input.id));
      return { success: true };
    }),

  /**
   * Lista histórico de relatórios gerados.
   */
  getHistory: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const query = db.select().from(clientReports).orderBy(desc(clientReports.createdAt)).limit(100);
      return query;
    }),

  /**
   * Gera um relatório para um cliente e mês específico.
   * Coleta métricas reais, gera conteúdo via LLM e salva o resultado.
   */
  generate: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      customTitle: z.string().optional(),
      customMessage: z.string().optional(),
      includeSections: z.object({
        kpis: z.boolean(),
        weeklyLeads: z.boolean(),
        comparison: z.boolean(),
        nextSteps: z.boolean(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar cliente
      const clientRows = await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
      const client = clientRows[0];
      if (!client) throw new Error("Cliente não encontrado");

      // Criar registro pendente
      const [ins] = await db.insert(clientReports).values({
        clientId: input.clientId,
        month: input.month,
        status: "pending",
      });
      const reportId = (ins as any).insertId;

      try {
        // Buscar métricas
        const metrics = await getMonthMetrics(client.adGroupFilter, input.month);
        const cpl = metrics.totalLeads > 0 ? metrics.totalSpend / metrics.totalLeads : 0;

        // Gerar conteúdo IA
        const aiContent = await generateAiContent({
          clientName: client.name,
          product: client.product,
          month: input.month,
          totalLeads: metrics.totalLeads,
          totalSpend: metrics.totalSpend,
          avgCtr: metrics.avgCtr,
          cpl,
          customMessage: input.customMessage,
        });

        // Atualizar registro com dados
        await db.update(clientReports).set({
          status: "generated",
          totalLeads: metrics.totalLeads,
          totalSpend: metrics.totalSpend.toFixed(2),
          avgCpl: cpl.toFixed(2),
          avgCtr: (metrics.avgCtr * 100).toFixed(2),
          aiSummary: JSON.stringify({ summary: aiContent.summary, nextSteps: aiContent.nextSteps }),
        }).where(eq(clientReports.id, reportId));

        return {
          success: true,
          reportId,
          metrics,
          cpl,
          aiSummary: aiContent.summary,
          nextSteps: aiContent.nextSteps,
        };
      } catch (err: any) {
        await db.update(clientReports).set({
          status: "failed",
          errorMessage: err?.message ?? "Erro desconhecido",
        }).where(eq(clientReports.id, reportId));
        throw err;
      }
    }),
});
