/**
 * Job: Rotação Semanal de Headlines RSA (C1)
 * Roda toda quarta-feira às 10h (America/Sao_Paulo)
 *
 * Identifica headlines de RSAs com CTR abaixo da média da campanha
 * e gera sugestões de rotação via LLM.
 * Registra experimento na tabela optimization_actions para rastreamento.
 */
import cron from "node-cron";
import { getDb } from "../db";
import { optimizationActions, rsaSuggestions } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { invokeLLM } from "../_core/llm";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { buildCustomerClient } from "../routers/googleAds";

export async function runWeeklyRSARotation() {
  console.log("[RSARotation] Iniciando análise de headlines RSA...");
  try {
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const customer = buildCustomerClient(client, customerId, getRefreshToken(), getLoginCustomerId());

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 13); // 14 dias
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    // Buscar RSAs com performance via google-ads-api
    const rows = await customer.query(`
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group.name,
        campaign.name,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr
      FROM ad_group_ad
      WHERE segments.date BETWEEN '${fmt(startDate)}' AND '${fmt(endDate)}'
        AND ad_group_ad.status = 'ENABLED'
        AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
      LIMIT 20
    `);

    if (!rows || rows.length === 0) {
      console.log("[RSARotation] Nenhum RSA encontrado.");
      return;
    }

    const db = await getDb();
    if (!db) return;

    // Calcular CTR médio
    const avgCtr = rows.reduce((sum: number, r: any) => sum + (r.metrics?.ctr || 0), 0) / rows.length;
    console.log(`[RSARotation] ${rows.length} RSAs encontrados. CTR médio: ${(avgCtr * 100).toFixed(2)}%`);

    // Identificar RSAs com CTR abaixo de 70% da média
    const lowPerformers = rows.filter((r: any) => (r.metrics?.ctr || 0) < avgCtr * 0.7);

    if (lowPerformers.length === 0) {
      console.log("[RSARotation] Todos os RSAs estão acima de 70% da CTR média. Nenhuma rotação necessária.");
      // Salvar registro de auditoria
      await db.insert(rsaSuggestions).values({
        adGroupName: "Conta Geral",
        adId: "audit",
        currentHeadlines: [`${rows.length} RSAs analisados`],
        suggestedHeadlines: [],
        reasoning: `Todos os ${rows.length} RSAs estão acima de 70% da CTR média de ${(avgCtr * 100).toFixed(2)}%. Nenhuma rotação necessária.`,
        status: "pending",
      });
      return;
    }

    // Gerar sugestões via LLM para os RSAs de baixo desempenho
    const suggestions: string[] = [];
    let savedCount = 0;
    for (const rsa of lowPerformers.slice(0, 5)) {
      const headlines = (rsa.adGroupAd?.ad?.responsiveSearchAd?.headlines || [])
        .map((h: any) => h.text || "").filter(Boolean).join(", ") || "N/A";
      const groupName = rsa.adGroup?.name || "Grupo";
      const campaignName = rsa.campaign?.name || "Campanha";
      const adId = String(rsa.adGroupAd?.ad?.id || "unknown");
      const ctr = ((rsa.metrics?.ctr || 0) * 100).toFixed(2);

      try {
        const llmRes = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "Você é um especialista em Google Ads para a Zênite Tech, empresa B2B de tecnologia (segurança eletrônica, controle de acesso, mobilidade elétrica, IA). Gere 3 headlines alternativos (máx 30 caracteres cada) para melhorar o CTR do anúncio. Responda em JSON: {headlines: [string, string, string], rationale: string}",
            },
            {
              role: "user",
              content: `Grupo: ${groupName}\nHeadlines atuais: ${headlines}\nCTR atual: ${ctr}% (abaixo da média ${(avgCtr * 100).toFixed(2)}%)\n\nGere 3 headlines alternativos mais atrativos para o público B2B.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "rsa_suggestions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  headlines: { type: "array", items: { type: "string" } },
                  rationale: { type: "string" },
                },
                required: ["headlines", "rationale"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = llmRes?.choices?.[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : null;
        if (content) {
          const parsed = JSON.parse(content);
          const suggestion = `Grupo "${groupName}" (CTR ${ctr}%):\n  Sugestões: ${parsed.headlines.join(" | ")}\n  Motivo: ${parsed.rationale}`;
          suggestions.push(suggestion);

          // Salvar na tabela rsa_suggestions se existir
          try {
            await db.insert(rsaSuggestions).values({
              adGroupName: groupName,
              adId,
              currentHeadlines: headlines.split(", "),
              suggestedHeadlines: parsed.headlines || [],
              reasoning: `CTR ${ctr}% abaixo da média ${(avgCtr * 100).toFixed(2)}%. ${parsed.rationale || ""}`,
              status: "pending",
            });
            savedCount++;
          } catch (_) {
            // Fallback: registrar em optimization_actions
            await db.insert(optimizationActions).values({
              actionType: "rsa_rotation_suggestion",
              status: "pending_approval",
              adGroupName: groupName,
              reason: `CTR ${ctr}% abaixo da média ${(avgCtr * 100).toFixed(2)}%. Sugestão: ${parsed.headlines.join(" | ")}`,
              performanceData: JSON.stringify({ currentCtr: ctr, avgCtr: (avgCtr * 100).toFixed(2), headlines, suggestions: parsed.headlines }),
              executionCycle: `weekly_rsa_${fmt(new Date())}`,
            });
            savedCount++;
          }
          console.log(`[RSARotation] Sugestão salva para: ${groupName} (CTR: ${ctr}%)`);
        }
      } catch (llmErr: any) {
        console.error("[RSARotation] Erro LLM:", llmErr?.message);
      }
    }

    if (suggestions.length > 0) {
      await notifyOwner({
        title: `🔄 ${suggestions.length} RSA(s) com sugestão de rotação de headline`,
        content: `${lowPerformers.length} RSA(s) com CTR abaixo de 70% da média.\n\n${suggestions.join("\n\n")}`,
      });
      console.log(`[RSARotation] ${suggestions.length} sugestão(ões) gerada(s) e salvas.`);
    }
  } catch (err: any) {
    console.error("[RSARotation] Erro:", err?.message || err);
  }
}

// Toda quarta-feira às 10h (America/Sao_Paulo)
cron.schedule(
  "0 0 10 * * 3",
  () => { runWeeklyRSARotation(); },
  { timezone: "America/Sao_Paulo" }
);
console.log("[RSARotation] Job agendado: toda quarta às 10h (America/Sao_Paulo)");
