/**
 * Job: Score Diário de Qualidade por Grupo de Anúncios
 * Roda todo dia às 8h30 (America/Sao_Paulo)
 *
 * Calcula um score 0–100 para cada grupo de anúncios ativo, ponderando:
 *   - CTR (40 pts): >= 10% = 40, >= 5% = 25, >= 2% = 10, < 2% = 0
 *   - Taxa de conversão (30 pts): >= 5% = 30, >= 2% = 20, >= 0.5% = 10, 0% = 0
 *   - CPC eficiência (20 pts): <= R$2 = 20, <= R$3 = 15, <= R$4 = 10, > R$4 = 5
 *   - Volume (10 pts): >= 100 impressões = 10, >= 50 = 5, < 50 = 0
 */
import cron from "node-cron";
import {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
} from "../credentials";
import { getDb } from "../db";
import { adGroupScores } from "../../drizzle/schema";

const LOOKBACK_DAYS = 7;

function calcScore(ctrPct: number, convRatePct: number, cpcBrl: number, impressions: number): number {
  let score = 0;
  // CTR (40 pts)
  if (ctrPct >= 10) score += 40;
  else if (ctrPct >= 5) score += 25;
  else if (ctrPct >= 2) score += 10;
  // Conversão (30 pts)
  if (convRatePct >= 5) score += 30;
  else if (convRatePct >= 2) score += 20;
  else if (convRatePct >= 0.5) score += 10;
  // CPC (20 pts)
  if (cpcBrl <= 2) score += 20;
  else if (cpcBrl <= 3) score += 15;
  else if (cpcBrl <= 4) score += 10;
  else score += 5;
  // Volume (10 pts)
  if (impressions >= 100) score += 10;
  else if (impressions >= 50) score += 5;
  return score;
}

export async function runDailyAdGroupScore() {
  console.log("[AdGroupScore] Iniciando cálculo de scores...");
  try {
    const env = process.env;
    const customerId = (env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
    const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
    const clientId = GOOGLE_ADS_CLIENT_ID;
    const clientSecret = GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = GOOGLE_ADS_REFRESH_TOKEN;
    const loginCustomerId = (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");

    if (!customerId || !developerToken || !refreshToken) {
      console.log("[AdGroupScore] Credenciais não configuradas.");
      return;
    }

    // Obter access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) {
      console.log("[AdGroupScore] Falha ao obter access token.");
      return;
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - LOOKBACK_DAYS + 1);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const query = `
      SELECT
        ad_group.id,
        ad_group.name,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.ctr,
        metrics.conversions
      FROM ad_group
      WHERE segments.date BETWEEN '${fmt(startDate)}' AND '${fmt(endDate)}'
        AND ad_group.status = 'ENABLED'
        AND campaign.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 50
    `;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokenData.access_token}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    };
    if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

    const adsRes = await fetch(
      `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`,
      { method: "POST", headers, body: JSON.stringify({ query }) }
    );
    const adsData = await adsRes.json() as any;

    if (!adsData.results || adsData.results.length === 0) {
      console.log("[AdGroupScore] Nenhum dado retornado.");
      return;
    }

    const db = await getDb();
    if (!db) return;

    let count = 0;
    for (const row of adsData.results) {
      const adGroupId = row.adGroup?.id?.toString() || "";
      const adGroupName = row.adGroup?.name || "Grupo desconhecido";
      const ctr = (row.metrics?.ctr || 0) * 100; // converter para %
      const costMicros = row.metrics?.costMicros || 0;
      const cpc = row.metrics?.clicks > 0 ? (costMicros / 1_000_000) / row.metrics.clicks : 0;
      const impressions = row.metrics?.impressions || 0;
      const clicks = row.metrics?.clicks || 0;
      const conversions = Math.round(row.metrics?.conversions || 0);
      const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
      const spend = costMicros / 1_000_000;
      const score = calcScore(ctr, convRate, cpc, impressions);

      await db.insert(adGroupScores).values({
        adGroupId,
        adGroupName,
        score,
        ctrPct: ctr.toFixed(2),
        cpcBrl: cpc.toFixed(2),
        convRatePct: convRate.toFixed(2),
        impressions,
        clicks,
        conversions,
        spendBrl: spend.toFixed(2),
        period: `${LOOKBACK_DAYS}d`,
      });
      count++;
    }

    console.log(`[AdGroupScore] ${count} scores calculados e salvos.`);
  } catch (err: any) {
    console.error("[AdGroupScore] Erro:", err?.message || err);
  }
}

// Agendar: todo dia às 8h30 (horário de Brasília)
cron.schedule(
  "0 30 8 * * *",
  () => { runDailyAdGroupScore(); },
  { timezone: "America/Sao_Paulo" }
);
console.log("[AdGroupScore] Job agendado: todo dia às 8h30 (America/Sao_Paulo)");
