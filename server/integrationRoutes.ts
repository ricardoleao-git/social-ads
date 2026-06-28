/**
 * Integration REST API — Cross-system communication endpoints
 *
 * Base path: /api/integration
 *
 * These endpoints allow the Instagram Analytics Dashboard (redes-sociais.zenitetech.com)
 * and the Google Ads Dashboard (zenite-ads.manus.space / social-ads.zenitetech.com)
 * to exchange data every hour via authenticated REST calls.
 *
 * Authentication: Bearer token via X-Integration-Key header.
 * The key is stored in the INTEGRATION_API_KEY environment variable.
 *
 * Endpoints exposed by THIS system (Google Ads Dashboard):
 *   POST /api/integration/instagram/sync        — Receive Instagram metrics snapshot
 *   GET  /api/integration/gads/summary          — Send Google Ads summary to Instagram dashboard
 *   GET  /api/integration/gads/campaigns        — Send campaign list
 *   GET  /api/integration/gads/trends           — Send 7-day CTR/CPC trend
 *   GET  /api/integration/instagram/history     — Get stored Instagram snapshots
 *   GET  /api/integration/sync-log              — Get sync history log
 *   GET  /api/integration/health                — Health check (no auth required)
 */

import { Router } from "express";
import { getDb } from "./db";
import { instagramSync, integrationSyncLog, negativeProposals } from "../drizzle/schema";
import { executeApprovedProposal } from "./jobs/hourlyAutoNegative";
import { desc, gte } from "drizzle-orm";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "./googleAdsClient";
import { buildCustomerClient, buildDateFilter } from "./routers/googleAds";

const integrationRouter = Router();

// ─── Auth Middleware ──────────────────────────────────────────────────────────

function requireIntegrationKey(req: any, res: any, next: any) {
  const key = req.headers["x-integration-key"] as string | undefined;
  const expected = process.env.INTEGRATION_API_KEY;

  if (!expected) {
    // If no key configured, allow all (dev mode)
    console.warn("[Integration] INTEGRATION_API_KEY not set — running in open mode");
    return next();
  }

  if (!key || key !== expected) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized — invalid or missing X-Integration-Key header",
    });
  }
  next();
}

// ─── Log helper ───────────────────────────────────────────────────────────────

async function logSync(opts: {
  direction: "inbound" | "outbound";
  sourceSystem: string;
  targetSystem: string;
  endpoint: string;
  statusCode: number;
  success: boolean;
  errorMessage?: string;
  summary?: string;
  durationMs?: number;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(integrationSyncLog).values({
      direction: opts.direction,
      sourceSystem: opts.sourceSystem,
      targetSystem: opts.targetSystem,
      endpoint: opts.endpoint,
      statusCode: opts.statusCode,
      success: opts.success ? 1 : 0,
      errorMessage: opts.errorMessage ?? null,
      summary: opts.summary ?? null,
      durationMs: opts.durationMs ?? null,
    });
  } catch (e) {
    console.error("[Integration] Failed to write sync log:", e);
  }
}

// ─── GET /api/integration/health — No auth required ──────────────────────────

integrationRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    system: "Google Ads Dashboard",
    domain: "social-ads.zenitetech.com",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    endpoints: {
      receive_instagram: "POST /api/integration/instagram/sync",
      send_gads_summary: "GET /api/integration/gads/summary",
      send_gads_campaigns: "GET /api/integration/gads/campaigns",
      send_gads_trends: "GET /api/integration/gads/trends",
      get_instagram_history: "GET /api/integration/instagram/history",
      get_sync_log: "GET /api/integration/sync-log",
    },
  });
});

// ─── POST /api/integration/instagram/sync — Receive Instagram metrics ─────────

integrationRouter.post("/instagram/sync", requireIntegrationKey, async (req, res) => {
  const start = Date.now();
  try {
    const body = req.body;

    // Validate required fields
    if (!body.accountHandle) {
      return res.status(400).json({ success: false, error: "accountHandle is required" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ success: false, error: "Database unavailable" });
    }

    // Insert snapshot
    await db.insert(instagramSync).values({
      accountHandle: String(body.accountHandle).toLowerCase().trim(),
      accountName: body.accountName ?? null,
      followers: Number(body.followers ?? 0),
      reach: Number(body.reach ?? 0),
      likes: Number(body.likes ?? 0),
      engagementRate: body.engagementRate != null ? String(body.engagementRate) : null,
      impressions: Number(body.impressions ?? 0),
      comments: Number(body.comments ?? 0),
      shares: Number(body.shares ?? 0),
      period: body.period ?? "7d",
      rawJson: JSON.stringify(body),
      source: "redes-sociais.zenitetech.com",
    });

    const durationMs = Date.now() - start;

    await logSync({
      direction: "inbound",
      sourceSystem: "redes-sociais.zenitetech.com",
      targetSystem: "social-ads.zenitetech.com",
      endpoint: "POST /api/integration/instagram/sync",
      statusCode: 200,
      success: true,
      summary: `Received metrics for ${body.accountHandle}: ${body.followers} followers, ${body.engagementRate}% engagement`,
      durationMs,
    });

    console.log(`[Integration] Instagram sync received for ${body.accountHandle} in ${durationMs}ms`);

    return res.json({
      success: true,
      message: "Instagram metrics snapshot saved",
      account: body.accountHandle,
      syncedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    const durationMs = Date.now() - start;
    await logSync({
      direction: "inbound",
      sourceSystem: "redes-sociais.zenitetech.com",
      targetSystem: "social-ads.zenitetech.com",
      endpoint: "POST /api/integration/instagram/sync",
      statusCode: 500,
      success: false,
      errorMessage: e?.message,
      durationMs,
    });
    console.error("[Integration] instagram/sync error:", e?.message);
    return res.status(500).json({ success: false, error: e?.message ?? "Internal error" });
  }
});

// ─── GET /api/integration/gads/summary — Send Google Ads summary ──────────────

integrationRouter.get("/gads/summary", requireIntegrationKey, async (req, res) => {
  const start = Date.now();
  try {
    const period = (req.query.period as string) ?? "7d";
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const customer = buildCustomerClient(client, customerId, getRefreshToken(), getLoginCustomerId());

    const dateFilter = buildDateFilter(period as any);
    const query = `
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM campaign
      WHERE ${dateFilter}
      AND campaign.status != 'REMOVED'
    `;

    const rows = await customer.query(query);
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

    const summary = {
      period,
      totalClicks,
      totalImpressions,
      totalConversions,
      totalSpend: parseFloat(totalSpend.toFixed(2)),
      avgCtrPercent: parseFloat(avgCtr.toFixed(2)),
      avgCpcBrl: parseFloat(avgCpc.toFixed(2)),
      currency: "BRL",
      generatedAt: new Date().toISOString(),
    };

    const durationMs = Date.now() - start;
    await logSync({
      direction: "outbound",
      sourceSystem: "social-ads.zenitetech.com",
      targetSystem: "redes-sociais.zenitetech.com",
      endpoint: "GET /api/integration/gads/summary",
      statusCode: 200,
      success: true,
      summary: `Sent summary: ${totalClicks} clicks, R$${totalSpend.toFixed(2)} spend, ${avgCtr.toFixed(2)}% CTR`,
      durationMs,
    });

    return res.json({ success: true, data: summary });
  } catch (e: any) {
    console.error("[Integration] gads/summary error:", e?.message);
    return res.status(500).json({ success: false, error: e?.message ?? "Internal error" });
  }
});

// ─── GET /api/integration/gads/campaigns — Send campaign list ─────────────────

integrationRouter.get("/gads/campaigns", requireIntegrationKey, async (req, res) => {
  try {
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const customer = buildCustomerClient(client, customerId, getRefreshToken(), getLoginCustomerId());

    const rows = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      AND segments.date DURING LAST_7_DAYS
    `);

    const campaigns = rows.map((row: any) => ({
      id: String(row.campaign?.id ?? ""),
      name: row.campaign?.name ?? "",
      status: row.campaign?.status ?? "",
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      spend: parseFloat(((Number(row.metrics?.cost_micros ?? 0)) / 1e6).toFixed(2)),
      conversions: Number(row.metrics?.conversions ?? 0),
    }));

    return res.json({
      success: true,
      data: { campaigns, count: campaigns.length, generatedAt: new Date().toISOString() },
    });
  } catch (e: any) {
    console.error("[Integration] gads/campaigns error:", e?.message);
    return res.status(500).json({ success: false, error: e?.message ?? "Internal error" });
  }
});

// ─── GET /api/integration/gads/trends — Send 7-day CTR/CPC trend ──────────────

integrationRouter.get("/gads/trends", requireIntegrationKey, async (req, res) => {
  try {
    const client = getGoogleAdsClient();
    const customerId = getCustomerId();
    const customer = buildCustomerClient(client, customerId, getRefreshToken(), getLoginCustomerId());

    const rows = await customer.query(`
      SELECT
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      AND segments.date DURING LAST_7_DAYS
      ORDER BY segments.date ASC
    `);

    // Group by date
    const byDate: Record<string, { impressions: number; clicks: number; costMicros: number; conversions: number }> = {};
    for (const row of rows) {
      const date = row.segments?.date ?? "";
      if (!byDate[date]) byDate[date] = { impressions: 0, clicks: 0, costMicros: 0, conversions: 0 };
      byDate[date].impressions += Number(row.metrics?.impressions ?? 0);
      byDate[date].clicks += Number(row.metrics?.clicks ?? 0);
      byDate[date].costMicros += Number(row.metrics?.cost_micros ?? 0);
      byDate[date].conversions += Number(row.metrics?.conversions ?? 0);
    }

    const trends = Object.entries(byDate).map(([date, m]) => ({
      date,
      impressions: m.impressions,
      clicks: m.clicks,
      spend: parseFloat((m.costMicros / 1e6).toFixed(2)),
      conversions: m.conversions,
      ctrPercent: m.impressions > 0 ? parseFloat(((m.clicks / m.impressions) * 100).toFixed(2)) : 0,
      cpcBrl: m.clicks > 0 ? parseFloat(((m.costMicros / 1e6) / m.clicks).toFixed(2)) : 0,
    }));

    return res.json({
      success: true,
      data: { trends, days: trends.length, generatedAt: new Date().toISOString() },
    });
  } catch (e: any) {
    console.error("[Integration] gads/trends error:", e?.message);
    return res.status(500).json({ success: false, error: e?.message ?? "Internal error" });
  }
});

// ─── GET /api/integration/instagram/history — Get stored Instagram snapshots ──

integrationRouter.get("/instagram/history", requireIntegrationKey, async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });

    const limit = Math.min(Number(req.query.limit ?? 48), 200);
    const handle = req.query.handle as string | undefined;

    let query = db.select().from(instagramSync).orderBy(desc(instagramSync.syncedAt)).limit(limit);
    const rows = await query;

    const filtered = handle
      ? rows.filter(r => r.accountHandle === handle.toLowerCase().trim())
      : rows;

    return res.json({
      success: true,
      data: { snapshots: filtered, count: filtered.length },
    });
  } catch (e: any) {
    console.error("[Integration] instagram/history error:", e?.message);
    return res.status(500).json({ success: false, error: e?.message ?? "Internal error" });
  }
});

// ─── GET /api/integration/sync-log — Get sync history ─────────────────────────

integrationRouter.get("/sync-log", requireIntegrationKey, async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });

    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const rows = await db.select().from(integrationSyncLog).orderBy(desc(integrationSyncLog.createdAt)).limit(limit);

    return res.json({ success: true, data: { logs: rows, count: rows.length } });
  } catch (e: any) {
    console.error("[Integration] sync-log error:", e?.message);
    return res.status(500).json({ success: false, error: e?.message ?? "Internal error" });
  }
});

// ─── POST /api/integration/approve-negatives — Aprovar proposta de negativação ─
// Nível 2: executa a proposta aprovada pelo Ricardo via dashboard ou API.

integrationRouter.post("/approve-negatives", requireIntegrationKey, async (req, res) => {
  try {
    const { proposalId } = req.body as { proposalId?: string };
    if (!proposalId) {
      return res.status(400).json({ success: false, error: "proposalId é obrigatório" });
    }

    const result = await executeApprovedProposal(proposalId);

    // Registrar aprovação no banco
    const db = await getDb();
    if (db) {
      try {
        await db
          .update(negativeProposals)
          .set({ approvedBy: (req as any).headers["x-approved-by"] ?? "api" })
          .where(require("drizzle-orm").eq(negativeProposals.proposalId, proposalId));
      } catch (_) {}
    }

    return res.json({
      success: true,
      data: {
        proposalId,
        applied: result.applied,
        errors: result.errors,
        message: `${result.applied} negativos aplicados com sucesso na campanha "Pesquisa Leads"`,
      },
    });
  } catch (e: any) {
    console.error("[Integration] approve-negatives error:", e?.message);
    return res.status(500).json({ success: false, error: e?.message ?? "Internal error" });
  }
});

// ─── POST /api/integration/reject-negatives — Rejeitar proposta de negativação ─

integrationRouter.post("/reject-negatives", requireIntegrationKey, async (req, res) => {
  try {
    const { proposalId, reason } = req.body as { proposalId?: string; reason?: string };
    if (!proposalId) {
      return res.status(400).json({ success: false, error: "proposalId é obrigatório" });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });

    const { eq } = await import("drizzle-orm");
    await db
      .update(negativeProposals)
      .set({ status: "rejected", appliedAt: new Date(), approvedBy: (req as any).headers["x-approved-by"] ?? "api" })
      .where(eq(negativeProposals.proposalId, proposalId));

    console.log(`[Integration] Proposta ${proposalId} rejeitada. Motivo: ${reason ?? "não informado"}`);

    return res.json({
      success: true,
      data: { proposalId, status: "rejected", message: "Proposta rejeitada. Nenhum negativo foi aplicado." },
    });
  } catch (e: any) {
    console.error("[Integration] reject-negatives error:", e?.message);
    return res.status(500).json({ success: false, error: e?.message ?? "Internal error" });
  }
});

// ─── GET /api/integration/proposals — Listar propostas pendentes ───────────────

integrationRouter.get("/proposals", requireIntegrationKey, async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });

    const { desc, eq } = await import("drizzle-orm");
    const status = (req.query.status as string) ?? "pending";

    const rows = await db
      .select()
      .from(negativeProposals)
      .orderBy(desc(negativeProposals.createdAt))
      .limit(50);

    const filtered = status === "all" ? rows : rows.filter(r => r.status === status);

    return res.json({
      success: true,
      data: { proposals: filtered, count: filtered.length },
    });
  } catch (e: any) {
    console.error("[Integration] proposals error:", e?.message);
    return res.status(500).json({ success: false, error: e?.message ?? "Internal error" });
  }
});

// ─── POST /api/integration/scheduled/sync-data — Disparo manual/agendado da sincronização diária ──
// Aceita chamadas autenticadas via X-Integration-Key ou session cookie (role: user/admin)
// Usado pelo Manus Schedule (SCHEDULED_TASK_COOKIE) e pelo botão manual no dashboard
integrationRouter.post("/scheduled/sync-data", async (req: any, res: any) => {
  // Aceitar tanto X-Integration-Key quanto session cookie autenticada
  const integrationKey = req.headers["x-integration-key"] as string | undefined;
  const expectedKey = process.env.INTEGRATION_API_KEY;
  const hasValidKey = expectedKey && integrationKey === expectedKey;
  const hasValidSession = req.user?.role === "admin" || req.user?.role === "user";

  if (!hasValidKey && !hasValidSession) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  console.log("[scheduled/sync-data] Disparo recebido — iniciando sincronização...");
  try {
    const { runDailySyncData } = await import("./jobs/dailySyncData");
    const result = await runDailySyncData();
    return res.json({
      success: result.success,
      message: "Sincronização concluída",
      data: {
        googleAds: result.googleAds,
        instagram: result.instagram,
        anomalies: result.anomalies,
        durationMs: result.durationMs,
      },
    });
  } catch (e: any) {
    console.error("[scheduled/sync-data] Erro:", e?.message);
    return res.status(500).json({ success: false, error: e?.message ?? "Internal error" });
  }
});

export { integrationRouter };
