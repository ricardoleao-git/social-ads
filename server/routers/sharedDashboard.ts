/**
 * Router: Shared Dashboard — Links públicos de compartilhamento
 * Permite criar links de acesso read-only para clientes visualizarem métricas.
 * Endpoints protegidos para gestão + endpoint público para visualização.
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sharedDashboards, clients } from "../../drizzle/schema";
import { desc, eq, and, gt, isNull, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  getGoogleAdsClient,
  getCustomerId,
  getRefreshToken,
  getLoginCustomerId,
} from "../googleAdsClient";
import { buildCustomerClient, buildDateFilter } from "./googleAds";

// ─── Buscar métricas reais para o dashboard compartilhado ───────────────────
async function fetchSharedMetrics(filters?: {
  campaigns?: string[];
  adGroups?: string[];
  period?: string;
  customDateStart?: string;
  customDateEnd?: string;
}) {
  try {
    const client = getGoogleAdsClient();
    const customer = buildCustomerClient(
      client,
      getCustomerId(),
      getRefreshToken(),
      getLoginCustomerId()
    );

    const period = filters?.period ?? "30d";
    const dateFilter = buildDateFilter(period as any);

    // 1. Resumo geral (KPIs)
    const summaryQuery = `
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
    const summaryRows = await customer.query(summaryQuery);
    let totalClicks = 0, totalImpressions = 0, totalConversions = 0, totalCostMicros = 0;
    for (const row of summaryRows) {
      totalClicks += Number(row.metrics?.clicks ?? 0);
      totalImpressions += Number(row.metrics?.impressions ?? 0);
      totalConversions += Number(row.metrics?.conversions ?? 0);
      totalCostMicros += Number(row.metrics?.cost_micros ?? 0);
    }
    const totalSpend = totalCostMicros / 1e6;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

    // 2. Top grupos de anúncios
    let adGroupFilter = "";
    if (filters?.adGroups && filters.adGroups.length > 0) {
      const conditions = filters.adGroups.map(ag => `ad_group.name LIKE '%${ag}%'`).join(" OR ");
      adGroupFilter = `AND (${conditions})`;
    }

    const adGroupQuery = `
      SELECT
        ad_group.name,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM ad_group
      WHERE ${dateFilter}
      AND campaign.status != 'REMOVED'
      ${adGroupFilter}
      ORDER BY metrics.clicks DESC
      LIMIT 10
    `;
    const adGroupRows = await customer.query(adGroupQuery);
    const adGroups = adGroupRows.map((row: any) => {
      const clicks = Number(row.metrics?.clicks ?? 0);
      const costMicros = Number(row.metrics?.cost_micros ?? 0);
      const conversions = Number(row.metrics?.conversions ?? 0);
      const ctr = Number(row.metrics?.ctr ?? 0) * 100;
      const cpc = clicks > 0 ? costMicros / clicks / 1e6 : 0;
      return {
        name: row.ad_group?.name ?? "Desconhecido",
        campaign: row.campaign?.name ?? "",
        clicks,
        impressions: Number(row.metrics?.impressions ?? 0),
        conversions,
        ctr: Number(ctr.toFixed(2)),
        cpc: Number(cpc.toFixed(2)),
        spend: Number((costMicros / 1e6).toFixed(2)),
      };
    });

    // 3. Tendência diária (últimos 7 dias)
    const trendQuery = `
      SELECT
        segments.date,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM campaign
      WHERE ${dateFilter}
      AND campaign.status != 'REMOVED'
      ORDER BY segments.date
    `;
    const trendRows = await customer.query(trendQuery);
    const trendMap = new Map<string, { clicks: number; impressions: number; spend: number; conversions: number }>();
    for (const row of trendRows) {
      const date = String(row.segments?.date ?? "");
      if (!date) continue;
      const existing = trendMap.get(date) ?? { clicks: 0, impressions: 0, spend: 0, conversions: 0 };
      existing.clicks += Number(row.metrics?.clicks ?? 0);
      existing.impressions += Number(row.metrics?.impressions ?? 0);
      existing.spend += Number(row.metrics?.cost_micros ?? 0) / 1e6;
      existing.conversions += Number(row.metrics?.conversions ?? 0);
      trendMap.set(date, existing);
    }
    const trends = Array.from(trendMap.entries()).map(([date, data]) => ({
      date,
      ...data,
      ctr: data.impressions > 0 ? Number(((data.clicks / data.impressions) * 100).toFixed(2)) : 0,
      cpc: data.clicks > 0 ? Number((data.spend / data.clicks).toFixed(2)) : 0,
    }));

    return {
      kpis: {
        totalClicks,
        totalImpressions,
        totalConversions,
        totalSpend: Number(totalSpend.toFixed(2)),
        avgCtr: Number(avgCtr.toFixed(2)),
        avgCpc: Number(avgCpc.toFixed(2)),
        cpa: Number(cpa.toFixed(2)),
      },
      adGroups,
      trends,
      funnel: {
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
      },
    };
  } catch (error: any) {
    console.error("[SharedDashboard] Erro ao buscar métricas:", error?.message);
    return null;
  }
}

export const sharedDashboardRouter = router({
  /**
   * Criar um novo link de compartilhamento.
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      clientId: z.number().optional(),
      dashboardType: z.enum(["executive_summary", "campaign_detail", "client_report", "custom"]).default("executive_summary"),
      filters: z.object({
        campaigns: z.array(z.string()).optional(),
        adGroups: z.array(z.string()).optional(),
        period: z.string().optional(),
        metrics: z.array(z.string()).optional(),
        customDateStart: z.string().optional(),
        customDateEnd: z.string().optional(),
      }).optional(),
      visibleSections: z.array(z.string()).optional(),
      welcomeMessage: z.string().optional(),
      expiresInDays: z.number().min(1).max(365).optional(),
      accessPassword: z.string().optional(),
      customLogo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const token = randomUUID().replace(/-/g, "");
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const [result] = await db.insert(sharedDashboards).values({
        token,
        name: input.name,
        clientId: input.clientId ?? null,
        dashboardType: input.dashboardType,
        filters: input.filters ?? null,
        visibleSections: input.visibleSections ?? ["kpis", "funnel", "trends", "adgroups"],
        welcomeMessage: input.welcomeMessage ?? null,
        customLogo: input.customLogo ?? null,
        expiresAt,
        accessPassword: input.accessPassword ?? null,
        createdBy: ctx.user?.name ?? "sistema",
      });

      return {
        success: true,
        token,
        shareUrl: `/shared/${token}`,
        id: (result as any).insertId,
      };
    }),

  /**
   * Listar todos os links de compartilhamento.
   */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(sharedDashboards).orderBy(desc(sharedDashboards.createdAt));
  }),

  /**
   * Revogar (desativar) um link de compartilhamento.
   */
  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(sharedDashboards).set({ isActive: false }).where(eq(sharedDashboards.id, input.id));
      return { success: true };
    }),

  /**
   * Reativar um link de compartilhamento.
   */
  reactivate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(sharedDashboards).set({ isActive: true }).where(eq(sharedDashboards.id, input.id));
      return { success: true };
    }),

  /**
   * Deletar um link de compartilhamento.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(sharedDashboards).where(eq(sharedDashboards.id, input.id));
      return { success: true };
    }),

  /**
   * PÚBLICO: Acessar dashboard compartilhado via token.
   * Retorna métricas read-only sem necessidade de autenticação.
   */
  getPublic: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      password: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Serviço indisponível");

      // Buscar o link
      const rows = await db
        .select()
        .from(sharedDashboards)
        .where(eq(sharedDashboards.token, input.token))
        .limit(1);

      const share = rows[0];
      if (!share) {
        return { error: "Link não encontrado", data: null };
      }

      // Verificar se está ativo
      if (!share.isActive) {
        return { error: "Este link foi desativado", data: null };
      }

      // Verificar expiração
      if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
        return { error: "Este link expirou", data: null };
      }

      // Verificar senha
      if (share.accessPassword && share.accessPassword !== input.password) {
        return { error: "password_required", data: null, needsPassword: true };
      }

      // Incrementar visualizações
      try {
        await db.update(sharedDashboards).set({
          viewCount: (share.viewCount ?? 0) + 1,
          lastViewedAt: new Date(),
        }).where(eq(sharedDashboards.id, share.id));
      } catch { /* não bloquear por erro de contagem */ }

      // Buscar nome do cliente se vinculado
      let clientName: string | null = null;
      if (share.clientId) {
        try {
          const clientRows = await db.select().from(clients).where(eq(clients.id, share.clientId)).limit(1);
          clientName = clientRows[0]?.name ?? null;
        } catch { /* opcional */ }
      }

      // Buscar métricas reais
      const metrics = await fetchSharedMetrics(share.filters as any);

      return {
        error: null,
        data: {
          name: share.name,
          clientName,
          dashboardType: share.dashboardType,
          welcomeMessage: share.welcomeMessage,
          customLogo: share.customLogo ?? null,
          visibleSections: share.visibleSections as string[] ?? ["kpis", "funnel", "trends", "adgroups"],
          filters: share.filters ?? null,
          metrics,
          generatedAt: new Date().toISOString(),
        },
      };
    }),
});
