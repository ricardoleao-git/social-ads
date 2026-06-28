import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { abExperiments, abVariants } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ─── Router de Experimentos A/B ───────────────────────────────────────────────

export const abExperimentsRouter = router({
  // Listar todos os experimentos
  list: publicProcedure
    .input(z.object({
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const experiments = await db.select().from(abExperiments).orderBy(desc(abExperiments.createdAt));

      // Para cada experimento, buscar as variantes
      const result = await Promise.all(
        experiments.map(async (exp) => {
          const variants = await db
            .select()
            .from(abVariants)
            .where(eq(abVariants.experimentId, exp.id));
          return { ...exp, variants };
        })
      );

      // Filtrar por status se fornecido
      if (input?.status && input.status !== "all") {
        return result.filter(e => e.status === input.status);
      }

      return result;
    }),

  // Buscar um experimento específico
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");
      const [experiment] = await db
        .select()
        .from(abExperiments)
        .where(eq(abExperiments.id, input.id));

      if (!experiment) throw new Error("Experimento não encontrado");

      const variants = await db
        .select()
        .from(abVariants)
        .where(eq(abVariants.experimentId, input.id));

      return { ...experiment, variants };
    }),

  // Criar novo experimento
  create: publicProcedure
    .input(z.object({
      name: z.string().min(3),
      description: z.string().optional(),
      campaignId: z.string().optional(),
      campaignName: z.string().optional(),
      adGroupId: z.string().optional(),
      adGroupName: z.string().optional(),
      experimentType: z.enum(["rsa_variant", "bid_strategy", "keyword_match", "landing_page"]).default("rsa_variant"),
      hypothesis: z.string().optional(),
      primaryMetric: z.enum(["ctr", "cpc", "conversions", "cost_per_conversion"]).default("ctr"),
      metricGoal: z.string().optional(),
      variants: z.array(z.object({
        variantType: z.string().default("control"),
        name: z.string(),
        description: z.string().optional(),
        content: z.string().optional(), // JSON serializado
      })).min(2, "Mínimo de 2 variantes (controle + teste)").max(3, "Máximo de 3 variantes por experimento"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");
      const { variants, ...experimentData } = input;

      const [result] = await db.insert(abExperiments).values({
        ...experimentData,
        status: "draft",
        createdBy: "dashboard",
      });

      const experimentId = (result as any).insertId;

      // Inserir variantes
      for (const variant of variants) {
        await db.insert(abVariants).values({
          experimentId,
          ...variant,
        });
      }

      return { success: true, experimentId };
    }),

  // Atualizar status do experimento
  updateStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "running", "paused", "completed", "archived"]),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");
      const updateData: Record<string, unknown> = { status: input.status };
      if (input.startDate) updateData.startDate = input.startDate;
      if (input.endDate) updateData.endDate = input.endDate;

      await db
        .update(abExperiments)
        .set(updateData)
        .where(eq(abExperiments.id, input.id));

      return { success: true };
    }),

  // Atualizar métricas de uma variante
  updateVariantMetrics: publicProcedure
    .input(z.object({
      variantId: z.number(),
      impressions: z.number(),
      clicks: z.number(),
      costMicros: z.number(),
      conversions: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");
      const { variantId, impressions, clicks, costMicros, conversions } = input;

      const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
      const cpc = clicks > 0 ? (costMicros / clicks / 1_000_000).toFixed(2) : "0.00";

      await db
        .update(abVariants)
        .set({ impressions, clicks, costMicros, conversions, ctr, cpc })
        .where(eq(abVariants.id, variantId));

      return { success: true };
    }),

  // Gerar análise por IA e determinar vencedor
  analyzeWithAI: publicProcedure
    .input(z.object({ experimentId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const [experiment] = await db
        .select()
        .from(abExperiments)
        .where(eq(abExperiments.id, input.experimentId));

      if (!experiment) throw new Error("Experimento não encontrado");

      const variants = await db
        .select()
        .from(abVariants)
        .where(eq(abVariants.experimentId, input.experimentId));

      // Montar prompt para análise
      const variantsSummary = variants.map(v => `
Variante: ${v.name} (${v.variantType})
- Impressões: ${v.impressions}
- Cliques: ${v.clicks}
- CTR: ${v.ctr}%
- CPC: R$ ${v.cpc}
- Conversões: ${v.conversions}
- Descrição: ${v.description || "N/A"}
      `).join("\n");

      const prompt = `Você é um especialista em Google Ads B2B para a empresa Zênite Tech (soluções de tecnologia, segurança eletrônica, IA e automação para empresas na Paraíba e Brasil).

Analise o seguinte experimento A/B:

Nome: ${experiment.name}
Hipótese: ${experiment.hypothesis || "Não definida"}
Métrica principal: ${experiment.primaryMetric}
Meta: ${experiment.metricGoal || "Não definida"}
Tipo: ${experiment.experimentType}
Campanha: ${experiment.campaignName || "N/A"}
Grupo: ${experiment.adGroupName || "N/A"}

Variantes:
${variantsSummary}

Forneça:
1. Qual variante está vencendo e por quê
2. Nível de confiança estatística (estimado)
3. Recomendação: continuar, pausar ou declarar vencedor
4. Próximos passos específicos para a Zênite Tech
5. Insights adicionais sobre o comportamento do público B2B

Seja direto, objetivo e orientado a resultado. Responda em português.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um gestor especialista em Google Ads B2B. Analise experimentos A/B e forneça recomendações estratégicas claras e acionáveis." },
          { role: "user", content: prompt },
        ],
      });

      const aiAnalysis = typeof response.choices[0].message.content === "string"
        ? response.choices[0].message.content
        : JSON.stringify(response.choices[0].message.content);

      // Determinar resultado automaticamente (suporta até 3 variantes)
      let result: string = "inconclusive";
      if (variants.length >= 2) {
        const control = variants.find(v => v.variantType === "control");
        const testVariants = variants.filter(v => v.variantType !== "control");
        if (control && testVariants.length > 0) {
          const controlCtr = parseFloat(control.ctr || "0");
          // Encontrar a melhor variante de teste
          const bestVariant = testVariants.reduce((best, v) => {
            return parseFloat(v.ctr || "0") > parseFloat(best.ctr || "0") ? v : best;
          }, testVariants[0]);
          const bestCtr = parseFloat(bestVariant.ctr || "0");
          if (bestCtr > controlCtr * 1.1) result = "variant_wins";
          else if (controlCtr > bestCtr * 1.1) result = "control_wins";
        } else if (!control && testVariants.length >= 2) {
          // Sem controle definido: comparar todas as variantes
          const sorted = [...variants].sort((a, b) => parseFloat(b.ctr || "0") - parseFloat(a.ctr || "0"));
          const topCtr = parseFloat(sorted[0].ctr || "0");
          const secondCtr = parseFloat(sorted[1].ctr || "0");
          if (topCtr > secondCtr * 1.1) result = "variant_wins";
        }
      }

      // Salvar análise
      await db
        .update(abExperiments)
        .set({ aiAnalysis, result })
        .where(eq(abExperiments.id, input.experimentId));

      return { success: true, aiAnalysis, result };
    }),

  // Deletar experimento
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");
      await db.delete(abVariants).where(eq(abVariants.experimentId, input.id));
      await db.delete(abExperiments).where(eq(abExperiments.id, input.id));
      return { success: true };
    }),

  // Gerar sugestão de experimento por IA baseado na campanha
  suggestExperiment: publicProcedure
    .input(z.object({
      campaignName: z.string(),
      adGroupName: z.string().optional(),
      currentCtr: z.number().optional(),
      currentCpc: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Você é um especialista em Google Ads B2B. Sugira experimentos A/B estratégicos para melhorar performance de campanhas.",
          },
          {
            role: "user",
            content: `Para a campanha "${input.campaignName}"${input.adGroupName ? ` / grupo "${input.adGroupName}"` : ""} da Zênite Tech (empresa B2B de tecnologia, segurança eletrônica e IA):
${input.currentCtr ? `CTR atual: ${input.currentCtr}%` : ""}
${input.currentCpc ? `CPC atual: R$ ${input.currentCpc}` : ""}

Sugira 3 experimentos A/B prioritários para melhorar performance. Para cada um, forneça:
- Nome do experimento
- Hipótese
- Variante controle vs variante teste (conteúdo específico)
- Métrica principal a monitorar
- Duração recomendada

Foque em melhorar CTR e reduzir CPC para público B2B (gestores, diretores, empresas).`,
          },
        ],
      });

      const suggestions = typeof response.choices[0].message.content === "string"
        ? response.choices[0].message.content
        : JSON.stringify(response.choices[0].message.content);

      return { suggestions };
    }),
});
