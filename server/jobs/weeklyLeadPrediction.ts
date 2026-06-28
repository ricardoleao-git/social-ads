/**
 * Job Semanal — Previsão de Leads com IA
 * Toda sexta-feira às 16h (America/Sao_Paulo)
 * Analisa termos de busca dos últimos 90 dias e classifica novos termos por probabilidade de conversão
 */
import cron from "node-cron";
import { getDb } from "../db";
import { leadPredictions } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { getGoogleAdsClient, getCustomerId, getLoginCustomerId } from "../googleAdsClient";
import { GOOGLE_ADS_REFRESH_TOKEN } from "../credentials";

const JOB_NAME = "WeeklyLeadPrediction";

async function fetchConvertingTerms(): Promise<Array<{ term: string; conversions: number; clicks: number; ctr: number }>> {
  try {
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const loginCustomerId = getLoginCustomerId();
    const customer = client.Customer({
      customer_id: customerId,
      login_customer_id: loginCustomerId,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const query = `
      SELECT
        search_term_view.search_term,
        metrics.conversions,
        metrics.clicks,
        metrics.ctr
      FROM search_term_view
      WHERE segments.date BETWEEN '${fmt(startDate)}' AND '${fmt(endDate)}'
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
    })).filter(t => t.term);
  } catch (err) {
    console.error(`[${JOB_NAME}] Erro ao buscar termos convertidos:`, err);
    return [];
  }
}

async function fetchNonConvertingTerms(): Promise<Array<{ term: string; clicks: number; ctr: number }>> {
  try {
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const loginCustomerId = getLoginCustomerId();
    const customer = client.Customer({
      customer_id: customerId,
      login_customer_id: loginCustomerId,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const query = `
      SELECT
        search_term_view.search_term,
        metrics.clicks,
        metrics.ctr
      FROM search_term_view
      WHERE segments.date BETWEEN '${fmt(startDate)}' AND '${fmt(endDate)}'
        AND metrics.conversions = 0
        AND metrics.clicks >= 5
      ORDER BY metrics.clicks DESC
      LIMIT 30
    `;

    const results = await customer.query(query);
    return results.map((r: any) => ({
      term: r.search_term_view?.search_term ?? "",
      clicks: Number(r.metrics?.clicks ?? 0),
      ctr: Number(r.metrics?.ctr ?? 0),
    })).filter(t => t.term);
  } catch (err) {
    console.error(`[${JOB_NAME}] Erro ao buscar termos sem conversão:`, err);
    return [];
  }
}

async function classifyWithLLM(
  convertingTerms: Array<{ term: string; conversions: number }>,
  nonConvertingTerms: Array<{ term: string; clicks: number }>
): Promise<Array<{ term: string; probability: "alta" | "media" | "baixa"; reason: string; suggestedAction: string }>> {
  if (nonConvertingTerms.length === 0) return [];

  const convertingList = convertingTerms.slice(0, 20).map(t => `- "${t.term}" (${t.conversions} conversões)`).join("\n");
  const nonConvertingList = nonConvertingTerms.map(t => `- "${t.term}" (${t.clicks} cliques, 0 conversões)`).join("\n");

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Você é um especialista em Google Ads B2B para tecnologia de segurança eletrônica, controle de acesso, recarga de veículos elétricos e comunicação via WhatsApp. Responda APENAS em JSON válido.",
        },
        {
          role: "user",
          content: `Analise os termos de busca que CONVERTERAM nos últimos 90 dias para a Zênite Tech:

${convertingList}

Agora classifique estes novos termos (com cliques mas SEM conversão nos últimos 30 dias) por probabilidade de conversão futura:

${nonConvertingList}

Para cada termo, responda em JSON array:
[{"term": "...", "probability": "alta|media|baixa", "reason": "explicação em 1 frase", "suggestedAction": "adicionar como keyword|negativar|monitorar|criar grupo específico"}]

Considere: intenção B2B, urgência, localização, especificidade técnica, alinhamento com produtos Zênite (GuardIA, Wallbox, ZIPY, Zface, Zblock, ConciergIA, Catraca).`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lead_predictions",
          strict: true,
          schema: {
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
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) return [];
    const contentStr = typeof rawContent === "string" ? rawContent : (rawContent as any[]).map((c: any) => c.text ?? "").join("");
    return JSON.parse(contentStr);
  } catch (err) {
    console.error(`[${JOB_NAME}] Erro ao classificar com LLM:`, err);
    return [];
  }
}

export async function runWeeklyLeadPrediction(): Promise<void> {
  console.log(`[${JOB_NAME}] Iniciando análise preditiva de leads...`);

  const db = await getDb();
  if (!db) {
    console.warn(`[${JOB_NAME}] Banco de dados não disponível`);
    return;
  }

  try {
    const [convertingTerms, nonConvertingTerms] = await Promise.all([
      fetchConvertingTerms(),
      fetchNonConvertingTerms(),
    ]);

    console.log(`[${JOB_NAME}] Termos convertidos: ${convertingTerms.length}, Termos sem conversão: ${nonConvertingTerms.length}`);

    if (nonConvertingTerms.length === 0) {
      console.log(`[${JOB_NAME}] Nenhum termo sem conversão encontrado. Encerrando.`);
      return;
    }

    const predictions = await classifyWithLLM(convertingTerms, nonConvertingTerms);

    if (predictions.length === 0) {
      console.warn(`[${JOB_NAME}] LLM não retornou previsões`);
      return;
    }

    const weekOf = new Date().toISOString().split("T")[0];

    // Salvar previsões no banco
    for (const pred of predictions) {
      await db.insert(leadPredictions).values({
        term: pred.term,
        probability: pred.probability,
        reason: pred.reason,
        suggestedAction: pred.suggestedAction,
        weekOf,
        status: "pending",
      });
    }

    console.log(`[${JOB_NAME}] ${predictions.length} previsões salvas para a semana de ${weekOf}`);

    // Contar por probabilidade
    const alta = predictions.filter(p => p.probability === "alta").length;
    const media = predictions.filter(p => p.probability === "media").length;
    const baixa = predictions.filter(p => p.probability === "baixa").length;

    console.log(`[${JOB_NAME}] Distribuição: Alta=${alta}, Média=${media}, Baixa=${baixa}`);
  } catch (err) {
    console.error(`[${JOB_NAME}] Erro durante execução:`, err);
  }
}

// Agendamento: toda sexta-feira às 16h (America/Sao_Paulo)
export function scheduleWeeklyLeadPrediction(): void {
  const CRON_EXPRESSION = "0 16 * * 5"; // Sexta às 16h
  const timezone = "America/Sao_Paulo";

  
  cron.schedule(
    CRON_EXPRESSION,
    async () => {
      console.log(`[${JOB_NAME}] Disparando job semanal...`);
      await runWeeklyLeadPrediction();
    },
    { timezone }
  );

  console.log(`[${JOB_NAME}] Job semanal agendado: toda sexta às 16h (${timezone})`);
}

// Auto-inicializar ao importar
scheduleWeeklyLeadPrediction();
