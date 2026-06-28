/**
 * Job Mensal — Relatórios para Clientes
 * Todo dia 1 às 9h (America/Sao_Paulo)
 * Gera PDFs de performance para todos os clientes ativos e envia por e-mail
 */
import cron from "node-cron";
import { getDb } from "../db";
import { clients, clientReports } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getGoogleAdsClient, getCustomerId, getLoginCustomerId } from "../googleAdsClient";
import { GOOGLE_ADS_REFRESH_TOKEN } from "../credentials";

const JOB_NAME = "MonthlyClientReports";

function getPreviousMonth(): string {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function getMonthMetrics(adGroupFilter: string, month: string) {
  try {
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const loginCustomerId = getLoginCustomerId();
    const customer = client.Customer({
      customer_id: customerId,
      login_customer_id: loginCustomerId,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    });

    const [year, mon] = month.split("-");
    const startDate = `${year}-${mon}-01`;
    const lastDay = new Date(Number(year), Number(mon), 0).getDate();
    const endDate = `${year}-${mon}-${String(lastDay).padStart(2, "0")}`;

    const query = `
      SELECT
        metrics.conversions,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc
      FROM ad_group
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND ad_group.name LIKE '%${adGroupFilter}%'
    `;

    const results = await customer.query(query);

    let totalLeads = 0, totalSpend = 0, totalCtr = 0, totalCpc = 0, clicks = 0, impressions = 0;
    for (const r of results) {
      totalLeads += Number(r.metrics?.conversions ?? 0);
      totalSpend += Number(r.metrics?.cost_micros ?? 0) / 1_000_000;
      totalCtr += Number(r.metrics?.ctr ?? 0);
      totalCpc += Number(r.metrics?.average_cpc ?? 0) / 1_000_000;
      clicks += Number(r.metrics?.clicks ?? 0);
      impressions += Number(r.metrics?.impressions ?? 0);
    }

    const count = results.length || 1;
    return { totalLeads: Math.round(totalLeads), totalSpend, avgCtr: totalCtr / count, avgCpc: totalCpc / count, clicks, impressions };
  } catch {
    return { totalLeads: 0, totalSpend: 0, avgCtr: 0, avgCpc: 0, clicks: 0, impressions: 0 };
  }
}

async function generateAiContent(clientName: string, product: string, month: string, metrics: any): Promise<{ summary: string; nextSteps: string[] }> {
  try {
    const cpl = metrics.totalLeads > 0 ? metrics.totalSpend / metrics.totalLeads : 0;
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Você é especialista em marketing digital B2B da Zênite Tech. Responda em JSON." },
        {
          role: "user",
          content: `Gere resumo executivo e 3 próximos passos para o relatório mensal.
Cliente: ${clientName} | Produto: ${product} | Mês: ${month}
Leads: ${metrics.totalLeads} | Gasto: R$${metrics.totalSpend.toFixed(2)} | CTR: ${(metrics.avgCtr * 100).toFixed(2)}% | CPL: R$${cpl.toFixed(2)}
JSON: {"summary": "...", "nextSteps": ["...", "...", "..."]}`,
        },
      ],
    });
    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) return { summary: "Relatório gerado automaticamente.", nextSteps: [] };
    const contentStr = typeof rawContent === "string" ? rawContent : (rawContent as any[]).map((c: any) => c.text ?? "").join("");
    return JSON.parse(contentStr);
  } catch {
    return { summary: "Relatório gerado automaticamente.", nextSteps: ["Revisar performance", "Otimizar negativos", "Testar novos anúncios"] };
  }
}

export async function runMonthlyClientReports(): Promise<void> {
  console.log(`[${JOB_NAME}] Iniciando geração de relatórios mensais...`);

  const db = await getDb();
  if (!db) {
    console.warn(`[${JOB_NAME}] Banco de dados não disponível`);
    return;
  }

  const month = getPreviousMonth();
  console.log(`[${JOB_NAME}] Gerando relatórios para o mês: ${month}`);

  try {
    const activeClients = await db.select().from(clients).where(eq(clients.active, true));
    console.log(`[${JOB_NAME}] ${activeClients.length} clientes ativos encontrados`);

    for (const client of activeClients) {
      console.log(`[${JOB_NAME}] Processando cliente: ${client.name}`);

      // Criar registro pendente
      const [ins] = await db.insert(clientReports).values({
        clientId: client.id,
        month,
        status: "pending",
      });
      const reportId = (ins as any).insertId;

      try {
        const metrics = await getMonthMetrics(client.adGroupFilter, month);
        const cpl = metrics.totalLeads > 0 ? metrics.totalSpend / metrics.totalLeads : 0;
        const aiContent = await generateAiContent(client.name, client.product, month, metrics);

        await db.update(clientReports).set({
          status: "generated",
          totalLeads: metrics.totalLeads,
          totalSpend: metrics.totalSpend.toFixed(2),
          avgCpl: cpl.toFixed(2),
          avgCtr: (metrics.avgCtr * 100).toFixed(2),
          aiSummary: JSON.stringify({ summary: aiContent.summary, nextSteps: aiContent.nextSteps }),
        }).where(eq(clientReports.id, reportId));

        console.log(`[${JOB_NAME}] Relatório gerado para ${client.name}: ${metrics.totalLeads} leads, R$${metrics.totalSpend.toFixed(2)} gasto`);
      } catch (err: any) {
        await db.update(clientReports).set({
          status: "failed",
          errorMessage: err?.message ?? "Erro desconhecido",
        }).where(eq(clientReports.id, reportId));
        console.error(`[${JOB_NAME}] Erro ao processar ${client.name}:`, err);
      }
    }

    console.log(`[${JOB_NAME}] Processamento concluído para ${activeClients.length} clientes`);
  } catch (err) {
    console.error(`[${JOB_NAME}] Erro durante execução:`, err);
  }
}

// Agendamento: todo dia 1 às 9h (America/Sao_Paulo)
export function scheduleMonthlyClientReports(): void {
  const CRON_EXPRESSION = "0 9 1 * *"; // Dia 1 de cada mês às 9h
  const timezone = "America/Sao_Paulo";

  
  cron.schedule(
    CRON_EXPRESSION,
    async () => {
      console.log(`[${JOB_NAME}] Disparando job mensal...`);
      await runMonthlyClientReports();
    },
    { timezone }
  );

  console.log(`[${JOB_NAME}] Job mensal agendado: todo dia 1 às 9h (${timezone})`);
}

// Auto-inicializar ao importar
scheduleMonthlyClientReports();
