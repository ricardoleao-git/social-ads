import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { leadPredictions } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getGoogleAdsClient, getCustomerId, getLoginCustomerId } from "../googleAdsClient";
import { GOOGLE_ADS_REFRESH_TOKEN } from "../credentials";

// Busca termos de busca com conversões nos últimos 90 dias (termos que converteram)
async function getConvertingTerms(): Promise<Array<{ term: string; conversions: number; clicks: number; ctr: number }>> {
  try {
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const loginCustomerId = getLoginCustomerId();
    const customer = client.Customer({ customer_id: customerId, login_customer_id: loginCustomerId, refresh_token: GOOGLE_ADS_REFRESH_TOKEN });

    const query = `
      SELECT
        search_term_view.search_term,
        metrics.conversions,
        metrics.clicks,
        metrics.ctr
      FROM search_term_view
      WHERE segments.date DURING LAST_90_DAYS
        AND metrics.conversions > 0
        AND metrics.clicks >= 3
      ORDER BY metrics.conversions DESC
      LIMIT 50
    `;

    const results = await customer.query(query);
    return results.map((r: any) => ({
      term: r.search_term_view?.search_term ?? "",
      conversions: Number(r.metrics?.conversions ?? 0),
      clicks: Number(r.metrics?.clicks ?? 0),
      ctr: Number(r.metrics?.ctr ?? 0),
    })).filter((r: any) => r.term);
  } catch {
    return [];
  }
}

// Busca termos com cliques mas sem conversões nos últimos 30 dias
async function getTermsWithoutConversions(): Promise<Array<{ term: string; clicks: number; impressions: number; ctr: number }>> {
  try {
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const loginCustomerId = getLoginCustomerId();
    const customer = client.Customer({ customer_id: customerId, login_customer_id: loginCustomerId, refresh_token: GOOGLE_ADS_REFRESH_TOKEN });

    const query = `
      SELECT
        search_term_view.search_term,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr
      FROM search_term_view
      WHERE segments.date DURING LAST_30_DAYS
        AND metrics.conversions = 0
        AND metrics.clicks >= 5
      ORDER BY metrics.clicks DESC
      LIMIT 80
    `;

    const results = await customer.query(query);
    return results.map((r: any) => ({
      term: r.search_term_view?.search_term ?? "",
      clicks: Number(r.metrics?.clicks ?? 0),
      impressions: Number(r.metrics?.impressions ?? 0),
      ctr: Number(r.metrics?.ctr ?? 0),
    })).filter((r: any) => r.term);
  } catch {
    return [];
  }
}

// Classifica termos via LLM
async function classifyTermsWithLLM(
  convertingTerms: Array<{ term: string; conversions: number }>,
  candidateTerms: Array<{ term: string; clicks: number; ctr: number }>
): Promise<Array<{ term: string; probability: "alta" | "media" | "baixa"; reason: string; suggestedAction: string }>> {
  if (candidateTerms.length === 0) return [];

  const convertingList = convertingTerms.slice(0, 20).map(t => `- "${t.term}" (${t.conversions} conversões)`).join("\n");
  const candidateList = candidateTerms.slice(0, 30).map(t => `- "${t.term}" (${t.clicks} cliques, CTR ${(t.ctr * 100).toFixed(1)}%)`).join("\n");

  const prompt = `Você é um especialista em Google Ads B2B para tecnologia de segurança eletrônica, controle de acesso, carregamento de veículos elétricos e comunicação empresarial via WhatsApp.

Termos que CONVERTERAM nos últimos 90 dias:
${convertingList}

Classifique estes termos por probabilidade de conversão B2B. Considere: intenção de compra, especificidade do produto, perfil B2B (empresa, condomínio, escola), urgência e alinhamento com os produtos Zênite Tech (GuardIA, Wallbox, ZIPY, Zface, Zblock, Catraca, PABX, Relógio de Ponto).

Termos para classificar:
${candidateList}

Responda APENAS com JSON válido, sem markdown, no formato:
{"predictions": [{"term": "...", "probability": "alta|media|baixa", "reason": "...", "suggestedAction": "..."}]}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Você é um especialista em Google Ads B2B. Responda apenas com JSON válido." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lead_predictions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              predictions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    term: { type: "string" },
                    probability: { type: "string", enum: ["alta", "media", "baixa"] },
                    reason: { type: "string" },
                    suggestedAction: { type: "string" },
                  },
                  required: ["term", "probability", "reason", "suggestedAction"],
                  additionalProperties: false,
                },
              },
            },
            required: ["predictions"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) return [];
    const contentStr = typeof rawContent === "string" ? rawContent : (rawContent as any[]).map((c: any) => c.text ?? "").join("");
    const parsed = JSON.parse(contentStr);
    return parsed.predictions ?? parsed ?? [];
  } catch {
    return [];
  }
}

export const leadPredictionRouter = router({
  /**
   * Busca previsões da semana atual.
   */
  getPredictions: protectedProcedure
    .input(z.object({ weekOf: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const weekOf = input?.weekOf ?? new Date().toISOString().slice(0, 10);
      return db
        .select()
        .from(leadPredictions)
        .orderBy(desc(leadPredictions.createdAt))
        .limit(100);
    }),

  /**
   * Gera novas previsões usando dados reais + LLM.
   */
  generatePredictions: protectedProcedure.mutation(async () => {
    const db = await getDb();
      if (!db) throw new Error("DB unavailable");
    const weekOf = new Date().toISOString().slice(0, 10);

    // Buscar dados
    const [convertingTerms, candidateTerms] = await Promise.all([
      getConvertingTerms(),
      getTermsWithoutConversions(),
    ]);

    if (candidateTerms.length === 0) {
      return {
        success: false,
        message: "Nenhum termo candidato encontrado nos últimos 30 dias (mínimo 5 cliques sem conversão).",
        count: 0,
      };
    }

    // Classificar com LLM
    const classified = await classifyTermsWithLLM(convertingTerms, candidateTerms);

    if (classified.length === 0) {
      return { success: false, message: "LLM não retornou classificações.", count: 0 };
    }

    // Salvar no banco
    const candidateMap = new Map(candidateTerms.map(t => [t.term, t]));
    const toInsert = classified.map(c => {
      const meta = candidateMap.get(c.term);
      return {
        term: c.term,
        probability: c.probability as "alta" | "media" | "baixa",
        reason: c.reason,
        suggestedAction: c.suggestedAction,
        weekOf,
        status: "pending" as const,
        clicks: meta?.clicks ?? 0,
        impressions: meta?.impressions ?? 0,
        ctr: meta ? (meta.ctr * 100).toFixed(2) : null,
      };
    });

    await db.insert(leadPredictions).values(toInsert);

    return { success: true, count: toInsert.length, weekOf };
  }),

  /**
   * Atualiza o status de uma previsão (added / rejected).
   */
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "added", "rejected"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(leadPredictions)
        .set({ status: input.status })
        .where(eq(leadPredictions.id, input.id));
      return { success: true };
    }),

  /**
   * Estatísticas de acurácia das previsões.
   */
  getAccuracyStats: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("DB unavailable");
    const all = await db.select().from(leadPredictions).limit(500);
    const total = all.length;
    const added = all.filter(p => p.status === "added").length;
    const rejected = all.filter(p => p.status === "rejected").length;
    const pending = all.filter(p => p.status === "pending").length;
    const alta = all.filter(p => p.probability === "alta").length;
    const media = all.filter(p => p.probability === "media").length;
    const baixa = all.filter(p => p.probability === "baixa").length;
    return { total, added, rejected, pending, alta, media, baixa };
  }),
});
