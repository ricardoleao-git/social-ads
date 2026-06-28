/**
 * dailySyncData.ts
 * ================
 * Job diário: todo dia às 8h (America/Sao_Paulo = 11h UTC)
 *
 * Responsabilidades:
 * 1. Sincronizar dados de campanhas Google Ads → tabela google_ads_summary
 * 2. Sincronizar snapshot do Instagram @zenite.tech → tabela instagram_snapshots
 * 3. Verificar anomalias (CPC spike, CTR drop, zero conversões) → tabela anomaly_alerts
 * 4. Registrar execução em automation_execution_logs
 * 5. Notificar owner se houver anomalias críticas
 *
 * Acionado por:
 * - node-cron às 11h UTC (8h Brasília)
 * - POST /api/scheduled/sync-data (disparo manual ou via Manus Schedule)
 */
import cron from "node-cron";
import { getDb } from "../db";
import {
  googleAdsSummary,
  instagramSnapshots,
  anomalyAlerts,
  automationExecutionLogs,
  adsDataCache,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { buildCustomerClient } from "../routers/googleAds";
import { META_ACCESS_TOKEN, INSTAGRAM_ACCOUNT_ID } from "../credentials";
import { notifyOwner } from "../_core/notification";

// ─── Thresholds de anomalia ───────────────────────────────────────────────────
const ANOMALY_CTR_DROP_THRESHOLD = 3.0;   // CTR abaixo de 3% = alerta
const ANOMALY_CPC_SPIKE_THRESHOLD = 8.0;  // CPC acima de R$8 = alerta
const ANOMALY_ZERO_CONV_CLICKS = 50;      // 50+ cliques sem conversão = alerta

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

// ─── 1. Sincronizar Google Ads ────────────────────────────────────────────────

async function syncGoogleAds(): Promise<{
  success: boolean;
  campaigns: number;
  error?: string;
}> {
  console.log("[DailySyncData] Sincronizando Google Ads...");
  try {
    const client = getGoogleAdsClient();
    const customer = buildCustomerClient(
      client,
      getCustomerId(),
      getRefreshToken(),
      getLoginCustomerId()
    );

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.cost_per_conversion
      FROM campaign
      WHERE campaign.status != 'REMOVED'
        AND segments.date DURING LAST_7_DAYS
      ORDER BY metrics.cost_micros DESC
    `;

    const rows = await customer.query(query);
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const today = todayStr();
    let savedCount = 0;

    for (const row of rows as any[]) {
      const campaignId = String(row.campaign?.id ?? "");
      const campaignName = String(row.campaign?.name ?? "");
      if (!campaignId) continue;

      const impressions = Number(row.metrics?.impressions ?? 0);
      const clicks = Number(row.metrics?.clicks ?? 0);
      const costMicros = Number(row.metrics?.cost_micros ?? 0);
      const cost = costMicros / 1_000_000;
      const ctr = clicks > 0 && impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? cost / clicks : 0;
      const conversions = Number(row.metrics?.conversions ?? 0);
      const costPerConversion = conversions > 0 ? cost / conversions : 0;

      const statusMap: Record<number, string> = {
        0: "UNSPECIFIED", 1: "UNKNOWN", 2: "ENABLED", 3: "PAUSED", 4: "REMOVED",
      };
      const rawStatus = row.campaign?.status;
      const campaignStatus = typeof rawStatus === "number"
        ? (statusMap[rawStatus] ?? "UNKNOWN")
        : String(rawStatus ?? "ENABLED");

      // Upsert: remove registro do dia se existir e insere novo
      await db
        .delete(googleAdsSummary)
        .where(
          and(
            eq(googleAdsSummary.summaryDate, today),
            eq(googleAdsSummary.campaignId, campaignId)
          )
        );

      await db.insert(googleAdsSummary).values({
        summaryDate: today,
        campaignId,
        campaignName,
        campaignStatus,
        impressions,
        clicks,
        cost: cost.toFixed(2),
        ctr: ctr.toFixed(2),
        cpc: cpc.toFixed(2),
        conversions: conversions.toFixed(2),
        costPerConversion: costPerConversion.toFixed(2),
      });

      savedCount++;
    }

    // Atualizar cache summary_7d
    const cacheData = JSON.stringify({
      fetchedAt: new Date().toISOString(),
      campaigns: rows.length,
      source: "dailySyncData",
    });
    await db
      .insert(adsDataCache)
      .values({ cacheKey: "sync_summary_7d", data: cacheData, ttlSeconds: 86400 })
      .onDuplicateKeyUpdate({ set: { data: cacheData, fetchedAt: new Date() } });

    console.log(`[DailySyncData] Google Ads: ${savedCount} campanhas sincronizadas.`);
    return { success: true, campaigns: savedCount };
  } catch (err: any) {
    console.error("[DailySyncData] Erro Google Ads:", err?.message ?? err);
    return { success: false, campaigns: 0, error: String(err?.message ?? err) };
  }
}

// ─── 2. Sincronizar Instagram ─────────────────────────────────────────────────

async function syncInstagram(): Promise<{
  success: boolean;
  followers: number;
  engagementRate: number;
  postsCount: number;
  error?: string;
}> {
  console.log("[DailySyncData] Sincronizando Instagram @zenite.tech...");
  const token = META_ACCESS_TOKEN;
  if (!token) {
    return { success: false, followers: 0, engagementRate: 0, postsCount: 0, error: "META_ADS_ACCESS_TOKEN não configurado" };
  }

  try {
    const BASE = "https://graph.facebook.com/v19.0";
    const igId = INSTAGRAM_ACCOUNT_ID;

    // 1. Dados da conta
    const accountRes = await fetch(
      `${BASE}/${igId}?fields=id,username,name,followers_count,follows_count,media_count&access_token=${token}`
    );
    const account = await accountRes.json() as Record<string, unknown>;
    if ((account as any).error) {
      throw new Error(String((account as any).error?.message ?? "Erro na conta Instagram"));
    }

    const followers = Number(account.followers_count ?? 0);
    const following = Number(account.follows_count ?? 0);
    const totalPosts = Number(account.media_count ?? 0);
    const username = String(account.username ?? "zenite.tech");

    // 2. Posts recentes para calcular engajamento
    const mediaRes = await fetch(
      `${BASE}/${igId}/media?fields=id,like_count,comments_count&limit=20&access_token=${token}`
    );
    const mediaJson = await mediaRes.json() as { data?: Array<Record<string, unknown>>; error?: { message: string } };
    if (mediaJson.error) throw new Error(mediaJson.error.message);

    const posts = (mediaJson.data ?? []);
    const totalLikes = posts.reduce((s, p) => s + Number(p.like_count ?? 0), 0);
    const totalComments = posts.reduce((s, p) => s + Number(p.comments_count ?? 0), 0);
    const avgLikes = posts.length > 0 ? (totalLikes / posts.length).toFixed(1) : "0";
    const avgComments = posts.length > 0 ? (totalComments / posts.length).toFixed(1) : "0";
    const engagementRate = followers > 0 && posts.length > 0
      ? parseFloat(((totalLikes + totalComments) / posts.length / followers * 100).toFixed(2))
      : 0;

    // 3. Salvar snapshot no banco
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const today = todayStr();

    // Evitar duplicata do dia
    await db
      .delete(instagramSnapshots)
      .where(
        and(
          eq(instagramSnapshots.snapshotDate, today),
          eq(instagramSnapshots.username, username)
        )
      );

    await db.insert(instagramSnapshots).values({
      accountId: String(account.id ?? igId),
      username,
      followers,
      following,
      totalPosts,
      avgLikes,
      avgComments,
      engagementRate: engagementRate.toFixed(2),
      recentPostsData: posts.slice(0, 10) as any,
      snapshotDate: today,
    });

    console.log(`[DailySyncData] Instagram: ${followers} seguidores, engajamento ${engagementRate}%.`);
    return { success: true, followers, engagementRate, postsCount: posts.length };
  } catch (err: any) {
    console.error("[DailySyncData] Erro Instagram:", err?.message ?? err);
    return { success: false, followers: 0, engagementRate: 0, postsCount: 0, error: String(err?.message ?? err) };
  }
}

// ─── 3. Verificar anomalias ───────────────────────────────────────────────────

async function checkAnomalies(): Promise<{ detected: number; critical: number }> {
  console.log("[DailySyncData] Verificando anomalias...");
  const db = await getDb();
  if (!db) return { detected: 0, critical: 0 };

  const today = todayStr();
  let detected = 0;
  let critical = 0;

  try {
    // Buscar dados de hoje
    const todayData = await db
      .select()
      .from(googleAdsSummary)
      .where(eq(googleAdsSummary.summaryDate, today));

    for (const row of todayData) {
      const ctr = Number(row.ctr ?? 0);
      const cpc = Number(row.cpc ?? 0);
      const clicks = Number(row.clicks ?? 0);
      const conversions = Number(row.conversions ?? 0);

      // CTR muito baixo (campanha ativa com cliques)
      if (clicks >= 10 && ctr < ANOMALY_CTR_DROP_THRESHOLD && row.campaignStatus === "ENABLED") {
        await db.insert(anomalyAlerts).values({
          type: "ctr_drop",
          metric: "CTR",
          adGroupId: undefined,
          adGroupName: row.campaignName,
          currentValue: `${ctr.toFixed(2)}%`,
          thresholdValue: `${ANOMALY_CTR_DROP_THRESHOLD}%`,
          severity: ctr < 1.5 ? "high" : "medium",
          message: `Campanha "${row.campaignName}" com CTR baixo: ${ctr.toFixed(2)}% (limiar: ${ANOMALY_CTR_DROP_THRESHOLD}%)`,
          emailSent: false,
        });
        detected++;
        if (ctr < 1.5) critical++;
      }

      // CPC muito alto
      if (clicks >= 5 && cpc > ANOMALY_CPC_SPIKE_THRESHOLD) {
        await db.insert(anomalyAlerts).values({
          type: "cpc_spike",
          metric: "CPC",
          adGroupId: undefined,
          adGroupName: row.campaignName,
          currentValue: `R$${cpc.toFixed(2)}`,
          thresholdValue: `R$${ANOMALY_CPC_SPIKE_THRESHOLD.toFixed(2)}`,
          severity: cpc > 15 ? "critical" : "high",
          message: `Campanha "${row.campaignName}" com CPC elevado: R$${cpc.toFixed(2)} (limiar: R$${ANOMALY_CPC_SPIKE_THRESHOLD})`,
          emailSent: false,
        });
        detected++;
        if (cpc > 15) critical++;
      }

      // Muitos cliques sem conversão
      if (clicks >= ANOMALY_ZERO_CONV_CLICKS && conversions === 0) {
        await db.insert(anomalyAlerts).values({
          type: "zero_conversions",
          metric: "Conversões",
          adGroupId: undefined,
          adGroupName: row.campaignName,
          currentValue: "0",
          thresholdValue: `${ANOMALY_ZERO_CONV_CLICKS} cliques`,
          severity: "medium",
          message: `Campanha "${row.campaignName}": ${clicks} cliques sem nenhuma conversão`,
          emailSent: false,
        });
        detected++;
      }
    }

    console.log(`[DailySyncData] Anomalias: ${detected} detectadas, ${critical} críticas.`);
    return { detected, critical };
  } catch (err: any) {
    console.error("[DailySyncData] Erro ao verificar anomalias:", err?.message ?? err);
    return { detected: 0, critical: 0 };
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function runDailySyncData(): Promise<{
  success: boolean;
  googleAds: { success: boolean; campaigns: number; error?: string };
  instagram: { success: boolean; followers: number; engagementRate: number; postsCount: number; error?: string };
  anomalies: { detected: number; critical: number };
  durationMs: number;
  error?: string;
}> {
  const startedAt = Date.now();
  console.log("[DailySyncData] ===== Iniciando sincronização diária =====");

  const db = await getDb();
  let logId: number | undefined;

  // Registrar início
  if (db) {
    try {
      const [log] = await db.insert(automationExecutionLogs).values({
        automationName: "daily_sync_data",
        automationLabel: "Sincronização Diária de Dados",
        status: "running",
        triggeredBy: "schedule",
      });
      logId = (log as any)?.insertId;
    } catch { /* log opcional */ }
  }

  const googleAds = await syncGoogleAds();
  const instagram = await syncInstagram();
  const anomalies = await checkAnomalies();

  const durationMs = Date.now() - startedAt;
  const overallSuccess = googleAds.success || instagram.success;
  const status = overallSuccess ? (anomalies.critical > 0 ? "warning" : "success") : "error";

  const summary = [
    `Google Ads: ${googleAds.success ? `${googleAds.campaigns} campanhas` : `ERRO: ${googleAds.error}`}`,
    `Instagram: ${instagram.success ? `${instagram.followers} seguidores, ${instagram.engagementRate}% engajamento` : `ERRO: ${instagram.error}`}`,
    `Anomalias: ${anomalies.detected} detectadas (${anomalies.critical} críticas)`,
  ].join(" | ");

  // Atualizar log
  if (db && logId) {
    try {
      await db
        .update(automationExecutionLogs)
        .set({
          status,
          summary,
          details: { googleAds, instagram, anomalies } as any,
          durationMs,
          errorMessage: !overallSuccess ? (googleAds.error ?? instagram.error ?? null) : null,
        })
        .where(eq(automationExecutionLogs.id, logId));
    } catch { /* log opcional */ }
  }

  // Notificar owner se houver anomalias críticas
  if (anomalies.critical > 0) {
    try {
      await notifyOwner({
        title: `🚨 ${anomalies.critical} anomalia(s) crítica(s) detectada(s) — Zênite Tech Google Ads`,
        content: `Sincronização diária concluída com alertas:\n\n${summary}\n\nAcesse o dashboard em /automacoes para detalhes.`,
      });
    } catch { /* notificação opcional */ }
  }

  console.log(`[DailySyncData] ===== Concluído em ${durationMs}ms — ${status.toUpperCase()} =====`);
  console.log(`[DailySyncData] ${summary}`);

  return { success: overallSuccess, googleAds, instagram, anomalies, durationMs };
}

// ─── Agendamento via node-cron ────────────────────────────────────────────────
// Todo dia às 11h UTC = 8h Brasília (UTC-3)
cron.schedule("0 11 * * *", async () => {
  try {
    await runDailySyncData();
  } catch (err) {
    console.error("[DailySyncData] Erro inesperado no cron:", err);
  }
}, { timezone: "UTC" });

console.log("[DailySyncData] Job registrado — executa todo dia às 8h (Brasília).");
