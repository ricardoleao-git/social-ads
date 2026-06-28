/**
 * Hourly Integration Sync Job
 *
 * Runs every hour to synchronize data between:
 *   - Google Ads Dashboard (this system) → redes-sociais.zenitetech.com
 *
 * What this job does:
 *   1. Fetches the latest Google Ads summary (7d) and pushes it to the Instagram dashboard
 *   2. Logs the sync result in the integration_sync_log table
 *   3. Notifies the owner if sync fails 3 times in a row
 *
 * The Instagram dashboard is responsible for calling back to:
 *   POST /api/integration/instagram/sync
 * with its own metrics every hour.
 *
 * Schedule: every hour at minute 5 (to avoid collision with hourlyAutoNegative at :00)
 */

import cron from "node-cron";
import { getDb } from "../db";
import { integrationSyncLog } from "../../drizzle/schema";
import { desc } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { notifyAndSave } from "../notifyAndSave";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { buildCustomerClient, buildDateFilter } from "../routers/googleAds";

const INSTAGRAM_DASHBOARD_URL = "https://redes-sociais.zenitetech.com";
const THIS_SYSTEM_URL = "https://social-ads.zenitetech.com";

async function getIntegrationKey(): Promise<string | undefined> {
  return process.env.INTEGRATION_API_KEY;
}

async function pushGadsDataToInstagram(): Promise<{ success: boolean; message: string; durationMs: number }> {
  const start = Date.now();
  const db = await getDb();

  try {
    // 1. Fetch Google Ads summary (last 7 days)
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const customer = buildCustomerClient(client, customerId, getRefreshToken(), getLoginCustomerId());

    const dateFilter = buildDateFilter("7d");
    const rows = await customer.query(`
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM campaign
      WHERE ${dateFilter}
      AND campaign.status != 'REMOVED'
    `);

    let totalClicks = 0, totalImpressions = 0, totalConversions = 0, totalCostMicros = 0;
    for (const row of rows) {
      totalClicks += Number(row.metrics?.clicks ?? 0);
      totalImpressions += Number(row.metrics?.impressions ?? 0);
      totalConversions += Number(row.metrics?.conversions ?? 0);
      totalCostMicros += Number(row.metrics?.cost_micros ?? 0);
    }

    const totalSpend = totalCostMicros / 1e6;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    const payload = {
      period: "7d",
      totalClicks,
      totalImpressions,
      totalConversions,
      totalSpend: parseFloat(totalSpend.toFixed(2)),
      avgCtrPercent: parseFloat(avgCtr.toFixed(2)),
      avgCpcBrl: parseFloat(avgCpc.toFixed(2)),
      currency: "BRL",
      source: THIS_SYSTEM_URL,
      syncedAt: new Date().toISOString(),
    };

    // 2. Push to Instagram dashboard
    const integrationKey = await getIntegrationKey();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (integrationKey) {
      headers["X-Integration-Key"] = integrationKey;
    }

    const response = await fetch(`${INSTAGRAM_DASHBOARD_URL}/api/integration/gads/receive`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const durationMs = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const result = await response.json().catch(() => ({}));

    // 3. Log success
    if (db) {
      await db.insert(integrationSyncLog).values({
        direction: "outbound",
        sourceSystem: THIS_SYSTEM_URL,
        targetSystem: INSTAGRAM_DASHBOARD_URL,
        endpoint: "POST /api/integration/gads/receive",
        statusCode: response.status,
        success: 1,
        summary: `Sent 7d summary: ${totalClicks} clicks, R$${totalSpend.toFixed(2)} spend, ${avgCtr.toFixed(2)}% CTR`,
        durationMs,
      });
    }

    return {
      success: true,
      message: `Pushed Google Ads data to Instagram dashboard in ${durationMs}ms`,
      durationMs,
    };
  } catch (e: any) {
    const durationMs = Date.now() - start;

    // Log failure
    if (db) {
      await db.insert(integrationSyncLog).values({
        direction: "outbound",
        sourceSystem: THIS_SYSTEM_URL,
        targetSystem: INSTAGRAM_DASHBOARD_URL,
        endpoint: "POST /api/integration/gads/receive",
        statusCode: 0,
        success: 0,
        errorMessage: e?.message ?? "Unknown error",
        durationMs,
      });
    }

    return {
      success: false,
      message: e?.message ?? "Unknown error",
      durationMs,
    };
  }
}

// Cooldown: só notifica uma vez a cada 24h para evitar spam
let lastFailureNotificationAt: number | null = null;
const FAILURE_NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h
const CONSECUTIVE_FAILURES_THRESHOLD = 6; // 6 falhas = ~6h antes de notificar

async function checkConsecutiveFailures(): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;

    const recent = await db
      .select()
      .from(integrationSyncLog)
      .orderBy(desc(integrationSyncLog.createdAt))
      .limit(CONSECUTIVE_FAILURES_THRESHOLD);

    const outbound = recent.filter(r => r.direction === "outbound");
    if (outbound.length < CONSECUTIVE_FAILURES_THRESHOLD) return 0;

    const allFailed = outbound.every(r => r.success === 0);
    return allFailed ? outbound.length : 0;
  } catch {
    return 0;
  }
}

// ─── Cron: every hour at minute 5 ────────────────────────────────────────────

cron.schedule(
  "0 5 * * * *",
  async () => {
    const cycle = `hourly_integration_${new Date().toISOString().slice(0, 16)}`;
    console.log(`[IntegrationSync] Starting hourly sync cycle: ${cycle}`);

    try {
      const result = await pushGadsDataToInstagram();

      if (result.success) {
        console.log(`[IntegrationSync] ✓ ${result.message}`);
      } else {
        console.warn(`[IntegrationSync] ✗ Failed: ${result.message}`);

        // Check if we've had enough consecutive failures AND cooldown passed
        const failures = await checkConsecutiveFailures();
        const cooldownPassed = !lastFailureNotificationAt ||
          (Date.now() - lastFailureNotificationAt) > FAILURE_NOTIFICATION_COOLDOWN_MS;
        if (failures >= CONSECUTIVE_FAILURES_THRESHOLD && cooldownPassed) {
          lastFailureNotificationAt = Date.now();
          await notifyAndSave({
            title: "⚠️ Integração com Redes Sociais com falha (${failures}x)",
            content: `A sincronização horária com ${INSTAGRAM_DASHBOARD_URL} falhou ${failures} vezes consecutivas.\n\nÚltimo erro: ${result.message}\n\nO sistema redes-sociais.zenitetech.com pode estar offline. Esta notificação não se repetirá por 24h.`,
          }).catch(() => {});
        }
      }
    } catch (e: any) {
      console.error(`[IntegrationSync] Unexpected error in cycle ${cycle}:`, e?.message);
    }
  },
  {
    timezone: "America/Sao_Paulo",
  }
);

console.log("[IntegrationSync] Hourly sync job scheduled: every hour at minute 5 (America/Sao_Paulo)");
