/**
 * Job Diário: Inteligência Competitiva via Auction Insights
 * ===========================================================
 * Executa todo dia às 7h. Coleta dados de Auction Insights
 * para identificar quais concorrentes aparecem nos mesmos leilões,
 * rastreia mudanças de posicionamento e salva histórico no banco.
 */
import cron from "node-cron";
import { GoogleAdsApi } from "google-ads-api";
import { getDb } from "../db";
import { competitiveInsights, optimizationActions } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { notifyAndSave } from "../notifyAndSave";
import { GOOGLE_ADS_REFRESH_TOKEN } from "../credentials";

function getClient() {
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");
  return client.Customer({
    customer_id: customerId,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    login_customer_id: loginCustomerId || undefined,
  });
}

export async function runDailyCompetitiveIntelligence() {
  const cycle = `competitive_${new Date().toISOString().slice(0, 10)}`;
  console.log(`[CompetitiveIntel] Iniciando ciclo: ${cycle}`);

  try {
    const customer = getClient();
    const db = await getDb();

    // Buscar Auction Insights dos últimos 30 dias
    const rows = await customer.query(`
      SELECT
        auction_insight_summary.domain,
        metrics.auction_insight_search_impression_share,
        metrics.auction_insight_search_overlap_rate,
        metrics.auction_insight_search_position_above_rate,
        campaign.name
      FROM campaign
      WHERE campaign.status = 'ENABLED'
        AND segments.date DURING LAST_30_DAYS
      ORDER BY metrics.auction_insight_search_overlap_rate DESC
      LIMIT 100
    `);

    if (!rows || rows.length === 0) {
      console.log("[CompetitiveIntel] Nenhum dado de Auction Insights disponível.");
      return;
    }

    // Buscar nossa impression share atual
    const ourRows = await customer.query(`
      SELECT
        metrics.search_impression_share,
        campaign.name
      FROM campaign
      WHERE campaign.status = 'ENABLED'
        AND segments.date DURING LAST_7_DAYS
      LIMIT 10
    `);

    const ourImpressionShare = ourRows.length > 0
      ? Number((ourRows[0] as any).metrics?.search_impression_share ?? 0) * 100
      : 0;

    const competitors: Array<{
      competitor: string;
      overlapRate: number;
      positionAboveRate: number;
      impressionShare: number;
      campaignName: string;
    }> = [];

    for (const row of rows) {
      const domain = String((row as any).auction_insight_summary?.domain ?? "");
      if (!domain) continue;

      const overlapRate = Number((row as any).metrics?.auction_insight_search_overlap_rate ?? 0) * 100;
      const positionAboveRate = Number((row as any).metrics?.auction_insight_search_position_above_rate ?? 0) * 100;
      const impressionShare = Number((row as any).metrics?.auction_insight_search_impression_share ?? 0) * 100;
      const campaignName = String((row as any).campaign?.name ?? "");

      competitors.push({ competitor: domain, overlapRate, positionAboveRate, impressionShare, campaignName });

      if (db) {
        await db.insert(competitiveInsights).values({
          competitor: domain,
          overlapRate: overlapRate.toFixed(2) as any,
          positionAboveRate: positionAboveRate.toFixed(2) as any,
          impressionShare: impressionShare.toFixed(2) as any,
          ourImpressionShare: ourImpressionShare.toFixed(2) as any,
          campaignName,
        });
      }
    }

    // Registrar ação de coleta
    if (db) {
      await db.insert(optimizationActions).values({
        actionType: "competitive_alert",
        status: "applied",
        reason: `Auction Insights coletado: ${competitors.length} concorrentes identificados. Nossa impression share: ${ourImpressionShare.toFixed(1)}%`,
        performanceData: JSON.stringify({ competitors: competitors.slice(0, 10), ourImpressionShare }),
        executionCycle: cycle,
      });
    }

    // Identificar concorrentes com alta sobreposição (>50%)
    const highOverlap = competitors.filter(c => c.overlapRate > 50).sort((a, b) => b.overlapRate - a.overlapRate);

    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const topCompetitors = highOverlap.slice(0, 5).map(c =>
      `• ${c.competitor}: sobreposição ${c.overlapRate.toFixed(1)}% | acima de nós ${c.positionAboveRate.toFixed(1)}%`
    ).join("\n");

    if (highOverlap.length > 0) {
      await notifyAndSave({
        title: `🔍 Concorrência: ${highOverlap.length} concorrentes com alta sobreposição`,
        content: `Análise de ${now}:\n\nNossa impression share: ${ourImpressionShare.toFixed(1)}%\n\nTop concorrentes:\n${topCompetitors}\n\nVeja detalhes: https://social-ads.zenitetech.com/optimization-panel`,
      });
    }

    console.log(`[CompetitiveIntel] ${competitors.length} concorrentes coletados. ${highOverlap.length} com alta sobreposição.`);
  } catch (err: any) {
    console.error("[CompetitiveIntel] Erro:", err?.message ?? err);
    // Auction Insights pode não estar disponível em todas as contas
    if (err?.message?.includes("RESOURCE_NOT_FOUND") || err?.message?.includes("auction_insight")) {
      console.log("[CompetitiveIntel] Auction Insights não disponível nesta conta — recurso requer volume mínimo de impressões.");
    }
  }
}

// Executar todo dia às 7h (horário de Brasília)
cron.schedule(
  "0 7 * * *",
  () => { runDailyCompetitiveIntelligence(); },
  { timezone: "America/Sao_Paulo" }
);
console.log("[CompetitiveIntel] Job diário agendado: todo dia às 7h (America/Sao_Paulo)");

// Execução especial toda terça-feira às 9h: relatório completo de inteligência competitiva (auctionInsights)
cron.schedule(
  "0 9 * * 2",
  async () => {
    console.log("[CompetitiveIntel] Execução semanal de terça às 9h — Auction Insights completo");
    await runDailyCompetitiveIntelligence();
  },
  { timezone: "America/Sao_Paulo" }
);
console.log("[CompetitiveIntel] Job semanal agendado: toda terça às 9h (auctionInsights) (America/Sao_Paulo)");
