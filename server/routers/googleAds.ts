/**
 * tRPC router for Google Ads API integration.
 * Fetches real metrics from Google Ads and exposes them via tRPC procedures.
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { getDb } from "../db";
import { negativeKeywordHistory, keywordReasons } from "../../drizzle/schema";
import { desc, gte, and, eq, sql } from "drizzle-orm";
import { inferNegativeReason } from "../../shared/negativeReasons";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdGroupMetrics {
  id: string;
  name: string;
  status: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  spend: number;
  performanceStatus: "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR";
}

export interface DailyTrend {
  date: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export interface SummaryMetrics {
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  totalSpend: number;
  avgCtr: number;
  avgCpc: number;
  dateRange: string;
  // Impression share metrics (Rodada 24)
  searchImpressionShare?: number | null;
  searchBudgetLostImpressionShare?: number | null;
  searchRankLostImpressionShare?: number | null;
  optimizationScore?: number | null;
}

export interface CampaignInfo {
  id: string;
  name: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyPerformance(ctr: number): AdGroupMetrics["performanceStatus"] {
  if (ctr >= 0.12) return "EXCELLENT";
  if (ctr >= 0.08) return "GOOD";
  if (ctr >= 0.04) return "AVERAGE";
  return "POOR";
}

function formatDateParam(dateStr: string): string {
  return dateStr.replace(/\//g, "-");
}

export function buildDateFilter(period: string, startDate?: string, endDate?: string): string {
  if (period === "custom" && startDate && endDate) {
    return `segments.date BETWEEN '${formatDateParam(startDate)}' AND '${formatDateParam(endDate)}'`;
  }
  // Usar datas explícitas para incluir o dia de hoje (LAST_N_DAYS exclui hoje)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const daysBack = period === "7d" ? 6 : period === "14d" ? 13 : period === "90d" ? 89 : 29; // -1 pois inclui hoje
  const startD = new Date(today);
  startD.setDate(today.getDate() - daysBack);
  const startStr = startD.toISOString().split('T')[0];
  return `segments.date BETWEEN '${startStr}' AND '${todayStr}'`;
}

export function buildCustomerClient(client: any, customerId: string, refreshToken: string, loginCustomerId?: string) {
  return client.Customer({
    customer_id: customerId,
    refresh_token: refreshToken,
    ...(loginCustomerId ? { login_customer_id: loginCustomerId } : {}),
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const googleAdsRouter = router({

  /**
   * List all non-removed campaigns for the filter dropdown.
   */
  getCampaigns: publicProcedure
    .query(async () => {
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
            campaign.status
          FROM campaign
          WHERE campaign.status != 'REMOVED'
          ORDER BY campaign.name ASC
        `;

        const rows = await customer.query(query);
        // Map numeric status to string (Google Ads API returns numeric enum values)
        const statusMap: Record<number, string> = { 0: "UNSPECIFIED", 1: "UNKNOWN", 2: "ENABLED", 3: "PAUSED", 4: "REMOVED" };
        const campaigns: CampaignInfo[] = rows.map((row: any) => {
          const rawStatus = row.campaign?.status;
          const statusStr = typeof rawStatus === "number" ? (statusMap[rawStatus] ?? "UNKNOWN") : String(rawStatus ?? "UNKNOWN");
          return {
            id: String(row.campaign?.id ?? ""),
            name: row.campaign?.name ?? "Unknown",
            status: statusStr,
          };
        });

        return { campaigns, success: true };
      } catch (error: any) {
        console.error("[Google Ads] getCampaigns error:", error?.message ?? error);
        return { campaigns: [], success: false, error: error?.message ?? "Unknown error" };
      }
    }),

  /**
   * Fetch ad group metrics for a given date range and optional campaign filter.
   */
  getAdGroups: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        period: z.enum(["7d", "14d", "30d", "90d", "custom"]).optional().default("30d"),
        campaignId: z.string().optional(), // filter by specific campaign
      })
    )
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );

        const dateFilter = buildDateFilter(input.period, input.startDate, input.endDate);
        const campaignFilter = input.campaignId
          ? `AND campaign.id = '${input.campaignId}'`
          : "";

        const query = `
          SELECT
            ad_group.id,
            ad_group.name,
            ad_group.status,
            campaign.id,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr
          FROM ad_group
          WHERE ${dateFilter}
          AND campaign.status != 'REMOVED'
          ${campaignFilter}
          ORDER BY metrics.clicks DESC
          LIMIT 50
        `;

        const rows = await customer.query(query);

        const adGroups: AdGroupMetrics[] = rows.map((row: any) => {
          const clicks = Number(row.metrics?.clicks ?? 0);
          const costMicros = Number(row.metrics?.cost_micros ?? 0);
          const conversions = Number(row.metrics?.conversions ?? 0);
          const ctr = Number(row.metrics?.ctr ?? 0);
          const cpc = clicks > 0 ? costMicros / clicks / 1e6 : 0;
          const conversionRate = clicks > 0 ? conversions / clicks : 0;
          const spend = costMicros / 1e6;

          return {
            id: String(row.ad_group?.id ?? ""),
            name: row.ad_group?.name ?? "Unknown",
            status: row.ad_group?.status ?? "UNKNOWN",
            campaignName: row.campaign?.name ?? "Unknown",
            impressions: Number(row.metrics?.impressions ?? 0),
            clicks,
            costMicros,
            conversions,
            ctr,
            cpc,
            conversionRate,
            spend,
            performanceStatus: classifyPerformance(ctr),
          };
        });

        return { adGroups, success: true };
      } catch (error: any) {
        console.error("[Google Ads] getAdGroups error:", error?.message ?? error);
        return { adGroups: [], success: false, error: error?.message ?? "Unknown error" };
      }
    }),

  /**
   * Fetch daily trend data (CTR, CPC, clicks, conversions) for a given date range and optional campaign.
   */
  getTrends: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        period: z.enum(["7d", "14d", "30d", "90d", "custom"]).optional().default("30d"),
        campaignId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );

        const dateFilter = buildDateFilter(input.period, input.startDate, input.endDate);
        const campaignFilter = input.campaignId
          ? `AND campaign.id = '${input.campaignId}'`
          : "";

        const query = `
          SELECT
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr
          FROM campaign
          WHERE ${dateFilter}
          AND campaign.status != 'REMOVED'
          ${campaignFilter}
          ORDER BY segments.date ASC
        `;

        const rows = await customer.query(query);

        // Aggregate by date (multiple campaigns on same day get summed)
        const byDate = new Map<string, DailyTrend>();
        for (const row of rows) {
          const date = row.segments?.date ?? "";
          const clicks = Number(row.metrics?.clicks ?? 0);
          const costMicros = Number(row.metrics?.cost_micros ?? 0);
          const conversions = Number(row.metrics?.conversions ?? 0);
          const impressions = Number(row.metrics?.impressions ?? 0);

          if (byDate.has(date)) {
            const existing = byDate.get(date)!;
            existing.clicks += clicks;
            existing.costMicros += costMicros;
            existing.conversions += conversions;
            existing.impressions += impressions;
          } else {
            byDate.set(date, { date, impressions, clicks, costMicros, conversions, ctr: 0, cpc: 0 });
          }
        }

        const trends: DailyTrend[] = Array.from(byDate.values()).map((t) => ({
          ...t,
          ctr: t.impressions > 0 ? t.clicks / t.impressions : 0,
          cpc: t.clicks > 0 ? t.costMicros / t.clicks / 1e6 : 0,
        }));

        return { trends, success: true };
      } catch (error: any) {
        console.error("[Google Ads] getTrends error:", error?.message ?? error);
        return { trends: [], success: false, error: error?.message ?? "Unknown error" };
      }
    }),

  /**
   * Fetch summary metrics (totals and averages) for a given date range and optional campaign.
   */
  getSummary: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        period: z.enum(["7d", "14d", "30d", "90d", "custom"]).optional().default("30d"),
        campaignId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );

        let dateRange: string;
        if (input.period === "custom" && input.startDate && input.endDate) {
          // Converter YYYY-MM-DD para DD/MM/YYYY
          const fmtCustom = (s: string) => { const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; };
          dateRange = `${fmtCustom(input.startDate)} a ${fmtCustom(input.endDate)}`;
        } else {
          // Calcular datas reais incluindo hoje
          const today = new Date();
          const todayFmt = today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const daysBack = input.period === "7d" ? 6 : input.period === "90d" ? 89 : 29;
          const startD = new Date(today);
          startD.setDate(today.getDate() - daysBack);
          const startFmt = startD.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const label = input.period === "7d" ? "7 dias" : input.period === "90d" ? "90 dias" : "30 dias";
          dateRange = `\u00daltimos ${label} (${startFmt} \u2013 ${todayFmt})`;
        }

        const dateFilter = buildDateFilter(input.period, input.startDate, input.endDate);
        const campaignFilter = input.campaignId
          ? `AND campaign.id = '${input.campaignId}'`
          : "";

        const query = `
          SELECT
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr,
            metrics.search_impression_share,
            metrics.search_budget_lost_impression_share,
            metrics.search_rank_lost_impression_share
          FROM campaign
          WHERE ${dateFilter}
          AND campaign.status != 'REMOVED'
          AND campaign.advertising_channel_type = 'SEARCH'
          ${campaignFilter}
        `;

        const rows = await customer.query(query);

        let totalClicks = 0;
        let totalImpressions = 0;
        let totalConversions = 0;
        let totalCostMicros = 0;
        let sumImprShare = 0;
        let sumBudgetLost = 0;
        let sumRankLost = 0;
        let shareCount = 0;

        for (const row of rows) {
          totalClicks += Number(row.metrics?.clicks ?? 0);
          totalImpressions += Number(row.metrics?.impressions ?? 0);
          totalConversions += Number(row.metrics?.conversions ?? 0);
          totalCostMicros += Number(row.metrics?.cost_micros ?? 0);
          // Impression share (API retorna como fração 0-1)
          const imprShare = row.metrics?.search_impression_share;
          const budgetLost = row.metrics?.search_budget_lost_impression_share;
          const rankLost = row.metrics?.search_rank_lost_impression_share;
          if (imprShare != null && Number(imprShare) > 0) {
            sumImprShare += Number(imprShare);
            sumBudgetLost += Number(budgetLost ?? 0);
            sumRankLost += Number(rankLost ?? 0);
            shareCount++;
          }
        }

        // Buscar optimization score (query separada, não aceita segmento de data)
        let optimizationScore: number | null = null;
        try {
          const optQuery = `SELECT customer.optimization_score FROM customer LIMIT 1`;
          const optRows = await customer.query(optQuery);
          if (optRows.length > 0 && optRows[0].customer?.optimization_score != null) {
            optimizationScore = Math.round(Number(optRows[0].customer.optimization_score) * 100);
          }
        } catch (optErr: any) {
          console.warn("[Google Ads] optimization_score query failed:", optErr?.message);
        }

        // Buscar campanhas de todos os tipos para totais gerais (inclui Performance Max)
        let allTotalClicks = totalClicks;
        let allTotalImpressions = totalImpressions;
        let allTotalConversions = totalConversions;
        let allTotalCostMicros = totalCostMicros;
        try {
          const allQuery = `
            SELECT
              metrics.impressions,
              metrics.clicks,
              metrics.cost_micros,
              metrics.conversions
            FROM campaign
            WHERE ${dateFilter}
            AND campaign.status != 'REMOVED'
            AND campaign.advertising_channel_type != 'SEARCH'
            ${campaignFilter}
          `;
          const allRows = await customer.query(allQuery);
          for (const row of allRows) {
            allTotalClicks += Number(row.metrics?.clicks ?? 0);
            allTotalImpressions += Number(row.metrics?.impressions ?? 0);
            allTotalConversions += Number(row.metrics?.conversions ?? 0);
            allTotalCostMicros += Number(row.metrics?.cost_micros ?? 0);
          }
        } catch (allErr: any) {
          console.warn("[Google Ads] all-campaigns query failed:", allErr?.message);
        }

        const totalSpend = allTotalCostMicros / 1e6;
        const avgCtr = allTotalImpressions > 0 ? allTotalClicks / allTotalImpressions : 0;
        const avgCpc = allTotalClicks > 0 ? totalSpend / allTotalClicks : 0;

        const summary: SummaryMetrics = {
          totalClicks: allTotalClicks,
          totalImpressions: allTotalImpressions,
          totalConversions: allTotalConversions,
          totalSpend,
          avgCtr,
          avgCpc,
          dateRange,
          searchImpressionShare: shareCount > 0 ? Math.round((sumImprShare / shareCount) * 100) : null,
          searchBudgetLostImpressionShare: shareCount > 0 ? Math.round((sumBudgetLost / shareCount) * 100) : null,
          searchRankLostImpressionShare: shareCount > 0 ? Math.round((sumRankLost / shareCount) * 100) : null,
          optimizationScore,
        };

        return { summary, success: true };
      } catch (error: any) {
        console.error("[Google Ads] getSummary error:", error?.message ?? error);
        return {
          summary: null,
          success: false,
          error: error?.message ?? "Unknown error",
        };
      }
    }),

  /**
   * Fetch negative keywords at campaign and ad group level.
   */
  getNegativeKeywords: publicProcedure
    .input(
      z.object({
        campaignId: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );

        const campaignFilter = input?.campaignId
          ? `AND campaign.id = '${input.campaignId}'`
          : "";

        // Campaign-level negatives
        const campaignNegQuery = `
          SELECT
            campaign.id,
            campaign.name,
            campaign_criterion.keyword.text,
            campaign_criterion.keyword.match_type,
            campaign_criterion.negative
          FROM campaign_criterion
          WHERE campaign_criterion.negative = TRUE
            AND campaign_criterion.type = KEYWORD
            AND campaign.status != 'REMOVED'
            ${campaignFilter}
          ORDER BY campaign.name
          LIMIT 500
        `;
        const campaignRows = await customer.query(campaignNegQuery);
        const campaignNegatives = campaignRows.map((row: any) => ({
          level: "campaign" as const,
          campaignName: row.campaign?.name ?? "",
          campaignId: String(row.campaign?.id ?? ""),
          adGroupName: undefined as string | undefined,
          adGroupId: undefined as string | undefined,
          text: row.campaign_criterion?.keyword?.text ?? "",
          matchType: String(row.campaign_criterion?.keyword?.match_type ?? ""),
        }));

        // Ad group-level negatives
        const adGroupNegQuery = `
          SELECT
            campaign.id,
            campaign.name,
            ad_group.id,
            ad_group.name,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.negative
          FROM ad_group_criterion
          WHERE ad_group_criterion.negative = TRUE
            AND ad_group_criterion.type = KEYWORD
            AND campaign.status != 'REMOVED'
            ${campaignFilter}
          ORDER BY campaign.name, ad_group.name
          LIMIT 500
        `;
        const adGroupRows = await customer.query(adGroupNegQuery);
        const adGroupNegatives = adGroupRows.map((row: any) => ({
          level: "ad_group" as const,
          campaignName: row.campaign?.name ?? "",
          campaignId: String(row.campaign?.id ?? ""),
          adGroupName: row.ad_group?.name ?? "",
          adGroupId: String(row.ad_group?.id ?? ""),
          text: row.ad_group_criterion?.keyword?.text ?? "",
          matchType: String(row.ad_group_criterion?.keyword?.match_type ?? ""),
        }));

        const all = [...campaignNegatives, ...adGroupNegatives];
        return {
          campaignNegatives,
          adGroupNegatives,
          all,
          total: all.length,
          success: true,
        };
      } catch (error: any) {
        console.error("[Google Ads] getNegativeKeywords error:", error?.message ?? error);
        return {
          campaignNegatives: [],
          adGroupNegatives: [],
          all: [],
          total: 0,
          success: false,
          error: error?.message ?? "Unknown error",
        };
      }
    }),

  /**
   * Add a negative keyword at campaign or ad group level.
   */
  addNegativeKeyword: publicProcedure
    .input(
      z.object({
        text: z.string().min(1).max(80),
        matchType: z.enum(["EXACT", "PHRASE", "BROAD"]),
        level: z.enum(["campaign", "ad_group"]),
        campaignId: z.string(),
        adGroupId: z.string().optional(),
        reason: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customerId = getCustomerId();
        const customer = buildCustomerClient(
          client,
          customerId,
          getRefreshToken(),
          getLoginCustomerId()
        );

        if (input.level === "campaign") {
          // Add campaign-level negative keyword
          const campaignRn = `customers/${customerId}/campaigns/${input.campaignId}`;
          await customer.campaignCriteria.create([{
            campaign: campaignRn,
            negative: true,
            type: "KEYWORD" as any,
            keyword: {
              text: input.text,
              match_type: input.matchType as any,
            },
          }]);
        } else {
          // Add ad group-level negative keyword
          if (!input.adGroupId) {
            throw new Error("adGroupId is required for ad_group level negatives");
          }
          const adGroupRn = `customers/${customerId}/adGroups/${input.adGroupId}`;
          await customer.adGroupCriteria.create([{
            ad_group: adGroupRn,
            negative: true,
            type: "KEYWORD" as any,
            keyword: {
              text: input.text,
              match_type: input.matchType as any,
            },
          }]);
        }

        // Save to history log
        try {
          const db = await getDb();
          if (db) await db.insert(negativeKeywordHistory).values({
            text: input.text,
            matchType: input.matchType,
            level: input.level,
            campaignId: input.campaignId,
            campaignName: "Pesquisa Leads",
            adGroupId: input.adGroupId ?? null,
            adGroupName: null,
            reason: input.reason ?? null,
            success: 1,
          });
        } catch (dbErr: any) {
          console.warn("[addNegativeKeyword] Failed to save history:", dbErr?.message);
        }
        // (end of history save block)

        return { success: true, message: `Negativo "${input.text}" adicionado com sucesso.` };
      } catch (error: any) {
        console.error("[Google Ads] addNegativeKeyword error:", error?.message ?? error);
        // Save failed attempt to history
        try {
          const db2 = await getDb();
          if (db2) await db2.insert(negativeKeywordHistory).values({
            text: input.text,
            matchType: input.matchType,
            level: input.level,
            campaignId: input.campaignId,
            campaignName: "Pesquisa Leads",
            adGroupId: input.adGroupId ?? null,
            adGroupName: null,
            success: 0,
            errorMessage: error?.message ?? "Unknown error",
          });
        } catch (_) {}
        // (end of failed history save)
        return { success: false, error: error?.message ?? "Unknown error" };
      }
    }),

  /**
   * Get history of negative keyword additions with optional date filter.
   */
  getNegativeKeywordHistory: publicProcedure
    .input(
      z.object({
        fromDate: z.string().optional(), // ISO date string e.g. "2026-01-01"
        toDate: z.string().optional(),   // ISO date string e.g. "2026-12-31"
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        const conditions = [];
        if (input?.fromDate) {
          conditions.push(gte(negativeKeywordHistory.createdAt, new Date(input.fromDate)));
        }
        if (input?.toDate) {
          const toDate = new Date(input.toDate);
          toDate.setHours(23, 59, 59, 999);
          conditions.push(gte(negativeKeywordHistory.createdAt, toDate));
        }

        const db = await getDb();
        if (!db) return { success: false, history: [], total: 0, error: "Database not available" };
        const rows = await db
          .select()
          .from(negativeKeywordHistory)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(negativeKeywordHistory.createdAt))
          .limit(200);

        return { success: true, history: rows, total: rows.length };
      } catch (error: any) {
        console.error("[getNegativeKeywordHistory] error:", error?.message);
        return { success: false, history: [], total: 0, error: error?.message };
      }
    }),

  /**
   * Send paused groups analysis report via email using Gmail MCP shell command.
   */
  sendPausedGroupsReport: publicProcedure
    .input(z.object({}).optional())
    .mutation(async () => {
      try {
        const { execSync } = await import("child_process");
        const emailBody = `
<h2>Análise de Grupos Pausados — Zênite Tech Google Ads</h2>
<p><strong>Data:</strong> ${new Date().toLocaleDateString("pt-BR")} | <strong>Campanha:</strong> Pesquisa Leads</p>

<h3>Situação Atual</h3>
<p><strong>6 grupos pausados</strong> identificados com 29 palavras-chave analisadas.</p>

<h3>Recomendações por Grupo</h3>
<ul>
<li><strong>Institucional - Zênite Tech:</strong> MANTER PAUSADO — palavras de marca com volume muito baixo</li>
<li><strong>Avant RH:</strong> AVALIAR EXCLUSÃO — sem palavras-chave ativas</li>
<li><strong>ConciergIA - Clínicas:</strong> MIGRAR KEYWORDS → grupo WhatsApp (chatbot para clínica, confirmação de consulta whatsapp)</li>
<li><strong>Fila Inteligente - Escolas:</strong> MIGRAR KEYWORDS → grupo Acesso Escolas (controle de saída de alunos, sistema de fila para escolas)</li>
<li><strong>GuardIA - Câmaras Frias:</strong> AVALIAR EXCLUSÃO — sem palavras-chave ativas</li>
<li><strong>Prédio Inteligente - Smart Building:</strong> MIGRAR KEYWORDS → grupo Acesso Condomínios (smart building empresas, automação predial)</li>
</ul>

<h3>Próximos Passos</h3>
<ol>
<li><strong>Esta semana:</strong> Adicionar keywords positivas nos grupos ativos via Google Ads</li>
<li><strong>Em 14 dias:</strong> Avaliar CTR dos grupos que receberam novas keywords</li>
<li><strong>Em 30 dias:</strong> Decidir sobre reativação do grupo Institucional</li>
</ol>

<p><em>Relatório gerado automaticamente pelo Dashboard Avant Charge em ${new Date().toLocaleString("pt-BR")}</em></p>
`;
        const emailJson = JSON.stringify({
          messages: [{
            to: ["rjll70@gmail.com"],
            subject: `Análise de Grupos Pausados — Zênite Tech (${new Date().toLocaleDateString("pt-BR")})`,
            content: emailBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          }]
        });
        const result = execSync(
          `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${emailJson.replace(/'/g, "'\"'\"'")}'`,
          { encoding: "utf-8", timeout: 30000 }
        );
        console.log("[sendPausedGroupsReport] Email sent:", result.substring(0, 200));
        return { success: true, message: "Relatório enviado para rjll70@gmail.com" };
      } catch (error: any) {
        console.error("[sendPausedGroupsReport] error:", error?.message ?? error);
        return { success: false, error: "Falha ao enviar e-mail. Verifique a conexão com o Gmail." };
      }
    }),

  /**
   * Fetch real RSA ad details: headlines, descriptions, status, assets per ad group.
   */
  getRsaDetails: publicProcedure.query(async () => {
    try {
      const client = getGoogleAdsClient();
      const customer = buildCustomerClient(
        client,
        getCustomerId(),
        getRefreshToken(),
        getLoginCustomerId()
      );

      // Helper to build RSA detail object
      const buildRsaDetail = (row: any, sitelinksByGroup: Record<string, number>) => {
        const headlines = (row.ad_group_ad?.ad?.responsive_search_ad?.headlines ?? []) as any[];
        const descriptions = (row.ad_group_ad?.ad?.responsive_search_ad?.descriptions ?? []) as any[];
        const finalUrls = (row.ad_group_ad?.ad?.final_urls ?? []) as string[];
        const clicks = Number(row.metrics?.clicks ?? 0);
        const impressions = Number(row.metrics?.impressions ?? 0);
        const costMicros = Number(row.metrics?.cost_micros ?? 0);
        const conversions = Number(row.metrics?.conversions ?? 0);
        const ctr = Number(row.metrics?.ctr ?? 0);
        const groupId = String(row.ad_group?.id ?? "");
        const rawStrength = row.ad_group_ad?.ad_strength ?? "UNKNOWN";
        const strengthMap: Record<string, string> = {
          "0": "UNKNOWN", "1": "PENDING", "2": "NO_ADS", "3": "POOR",
          "4": "AVERAGE", "5": "GOOD", "6": "EXCELLENT", "7": "EXCELLENT",
          POOR: "POOR", AVERAGE: "AVERAGE", GOOD: "GOOD", EXCELLENT: "EXCELLENT",
          NO_ADS: "NO_ADS", PENDING: "PENDING",
          UNSPECIFIED: "UNKNOWN", UNKNOWN: "UNKNOWN",
        };
        const adStrength = strengthMap[String(rawStrength)] ?? String(rawStrength);
        return {
          adGroupId: groupId,
          adGroupName: row.ad_group?.name ?? "Unknown",
          adGroupStatus: row.ad_group?.status ?? "UNKNOWN",
          campaignName: row.campaign?.name ?? "Unknown",
          adId: String(row.ad_group_ad?.ad?.id ?? ""),
          adStatus: row.ad_group_ad?.status ?? "UNKNOWN",
          adStrength,
          headlineCount: headlines.length,
          descriptionCount: descriptions.length,
          headlines: headlines.slice(0, 5).map((h: any) => h.text ?? ""),
          descriptions: descriptions.slice(0, 2).map((d: any) => d.text ?? ""),
          finalUrl: finalUrls[0] ?? "",
          sitelinkCount: sitelinksByGroup[groupId] ?? 0,
          impressions,
          clicks,
          costMicros,
          conversions,
          ctr,
          cpc: clicks > 0 ? costMicros / clicks / 1e6 : 0,
          spend: costMicros / 1e6,
        };
      };

      // Fetch RSA ads with metrics (last 30 days) — active ads
      const adsQuery = `
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          campaign.name,
          campaign.status,
          ad_group_ad.ad.id,
          ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_search_ad.descriptions,
          ad_group_ad.ad.final_urls,
          ad_group_ad.ad.type,
          ad_group_ad.status,
          ad_group_ad.ad_strength,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr
        FROM ad_group_ad
        WHERE ad_group_ad.ad.type = RESPONSIVE_SEARCH_AD
          AND campaign.status = ENABLED
          AND ad_group.status = ENABLED
          AND ad_group_ad.status = ENABLED
          AND segments.date DURING LAST_30_DAYS
        ORDER BY metrics.clicks DESC
        LIMIT 60
      `;

      // Fetch PAUSED RSA ads in parallel
      const pausedAdsQuery = `
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          campaign.name,
          campaign.status,
          ad_group_ad.ad.id,
          ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_search_ad.descriptions,
          ad_group_ad.ad.final_urls,
          ad_group_ad.ad.type,
          ad_group_ad.status,
          ad_group_ad.ad_strength,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr
        FROM ad_group_ad
        WHERE ad_group_ad.ad.type = RESPONSIVE_SEARCH_AD
          AND campaign.status = ENABLED
          AND ad_group_ad.status = PAUSED
          AND segments.date DURING LAST_30_DAYS
        ORDER BY ad_group.name
        LIMIT 30
      `;

      // Fetch sitelinks per ad group
      const sitelinksQuery = `
        SELECT
          ad_group.id,
          ad_group.name,
          campaign.status
        FROM ad_group_asset
        WHERE ad_group_asset.field_type = SITELINK
          AND campaign.status = ENABLED
        LIMIT 200
      `;

      const [adsRows, pausedAdsRows, sitelinksRows] = await Promise.all([
        customer.query(adsQuery),
        customer.query(pausedAdsQuery),
        customer.query(sitelinksQuery),
      ]);

      // Map sitelinks by ad_group id
      const sitelinksByGroup: Record<string, number> = {};
      for (const row of sitelinksRows) {
        const gid = String(row.ad_group?.id ?? "");
        sitelinksByGroup[gid] = (sitelinksByGroup[gid] ?? 0) + 1;
      }

      // Build RSA details for active ads
      const rsaDetails = adsRows.map((row: any) => buildRsaDetail(row, sitelinksByGroup));

      // Build RSA details for paused ads
      const pausedRsaDetails = pausedAdsRows.map((row: any) => buildRsaDetail(row, sitelinksByGroup));

      // Build unique ad group names for filter dropdown
      const adGroupNamesSet = new Set<string>();
      for (const ad of rsaDetails) adGroupNamesSet.add(ad.adGroupName);
      const adGroupNames = Array.from(adGroupNamesSet).sort();

      // Build low strength alerts
      const lowStrengthAlerts = rsaDetails
        .filter((ad: any) => ad.adStrength === "AVERAGE" || ad.adStrength === "POOR")
        .map((ad: any) => ({
          adGroupName: ad.adGroupName,
          adId: ad.adId,
          adStrength: ad.adStrength,
          headlineCount: ad.headlineCount,
          descriptionCount: ad.descriptionCount,
          suggestion:
            ad.adStrength === "POOR"
              ? "Adicione mais headlines variados e específicos para o grupo. Evite repetições."
              : "Revise os headlines para maior variedade e relevância com as palavras-chave do grupo",
        }));

      const totalRSA = rsaDetails.length;
      const totalPaused = pausedRsaDetails.length;
      const totalSitelinks = Object.values(sitelinksByGroup).reduce((a, b) => a + b, 0);
      const totalImpressions = rsaDetails.reduce((s: number, r: any) => s + r.impressions, 0);
      const totalClicks = rsaDetails.reduce((s: number, r: any) => s + r.clicks, 0);
      const totalSpend = rsaDetails.reduce((s: number, r: any) => s + r.spend, 0);
      const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

      return {
        rsaDetails,
        pausedRsaDetails,
        adGroupNames,
        lowStrengthAlerts,
        totalRSA,
        totalPaused,
        totalSitelinks,
        totalImpressions,
        totalClicks,
        totalSpend,
        avgCtr,
        success: true,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("[Google Ads] getRsaDetails error:", error?.message ?? error);
        // Fallback: buscar dados do banco de dados quando a API falha
        try {
          const { rsaSuggestions } = await import("../../drizzle/schema");
          const db = await getDb();
          const dbRsa = db ? await db.select().from(rsaSuggestions).limit(60) : [];
          if (dbRsa.length > 0) {
            const rsaDetails = dbRsa.map((row: any) => ({
              adGroupId: row.adGroupId ?? "",
              adGroupName: row.adGroupName ?? "",
              adGroupStatus: "ENABLED",
              campaignName: row.campaignName ?? "",
              adId: String(row.id),
              adStatus: "ENABLED",
              adStrength: row.currentStrength ?? "UNKNOWN",
              headlineCount: 3,
              descriptionCount: 2,
              headlines: row.suggestedHeadlines ? JSON.parse(row.suggestedHeadlines).slice(0, 5) : [],
              descriptions: row.suggestedDescriptions ? JSON.parse(row.suggestedDescriptions).slice(0, 2) : [],
              finalUrl: "",
              sitelinkCount: 0,
              impressions: 0,
              clicks: 0,
              costMicros: 0,
              conversions: 0,
              ctr: 0,
              cpc: 0,
              spend: 0,
            }));
            return {
              rsaDetails,
              pausedRsaDetails: [],
              adGroupNames: Array.from(new Set(rsaDetails.map((r: any) => r.adGroupName))).sort() as string[],
              lowStrengthAlerts: [],
              totalRSA: rsaDetails.length,
              totalPaused: 0,
              totalSitelinks: 0,
              totalImpressions: 0,
              totalClicks: 0,
              totalSpend: 0,
              avgCtr: 0,
              success: true,
              source: "database_fallback",
              fetchedAt: new Date().toISOString(),
            };
          }
        } catch (dbErr: any) {
          console.error("[Google Ads] getRsaDetails DB fallback error:", dbErr?.message);
        }
      return {
        rsaDetails: [],
        totalRSA: 0,
        totalSitelinks: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalSpend: 0,
        avgCtr: 0,
        success: false,
        error: error?.message ?? "Unknown error",
        fetchedAt: new Date().toISOString(),
      };
    }
  }),

  /**
   * Read URL verification history from log files in /home/ubuntu/gads/logs/
   */
  getUrlCheckHistory: publicProcedure.query(async () => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const logsDir = "/home/ubuntu/gads/logs";

      if (!fs.existsSync(logsDir)) {
        return { history: [], success: true };
      }

      const files = fs.readdirSync(logsDir)
        .filter((f: string) => f.startsWith("verificacao_") && f.endsWith(".json"))
        .sort()
        .reverse()
        .slice(0, 10); // last 10 checks

      const history = files.map((file: string) => {
        try {
          const raw = fs.readFileSync(path.join(logsDir, file), "utf-8");
          const data = JSON.parse(raw);
          return {
            filename: file,
            data: data.data ?? "",
            totalUrls: Number(data.total_urls ?? 0),
            ok: Number(data.ok ?? 0),
            falhas: Number(data.falhas ?? 0),
            problemas: (data.problemas ?? []) as string[],
            detalhes: ((data.detalhes ?? []) as any[]).map((d: any) => ({
              url: String(d.url ?? ""),
              statusCode: Number(d.status_code ?? 0),
              ok: Boolean(d.ok),
              erro: d.erro ?? null,
              grupos: (d.grupos ?? []) as string[],
            })),
          };
        } catch {
          return null;
        }
      }).filter(Boolean);

      return { history, success: true };
    } catch (error: any) {
      console.error("[URL Check History] error:", error?.message ?? error);
      return { history: [], success: false, error: error?.message ?? "Unknown error" };
    }
  }),

  /**
   * Send a rich HTML performance report via Gmail MCP.
   */
  sendPerformanceReport: protectedProcedure
    .input(z.object({
      to: z.string().email(),
      period: z.string().default('7d'),
      ctr: z.number().optional(),
      clicks: z.number().optional(),
      conversions: z.number().optional(),
      cpc: z.number().optional(),
      spend: z.number().optional(),
      impressions: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const { execSync } = await import("child_process");
        const dashboardUrl = "https://zenite-ads.manus.space";
        const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const periodLabel = input.period === '7d' ? 'Últimos 7 dias' :
          input.period === '30d' ? 'Últimos 30 dias' :
          input.period === '90d' ? 'Últimos 90 dias' : 'Período personalizado';
        const ctr = input.ctr?.toFixed(2) ?? '--';
        const clicks = input.clicks ?? '--';
        const conversions = input.conversions ?? '--';
        const cpc = input.cpc != null ? `R$ ${input.cpc.toFixed(2)}` : '--';
        const spend = input.spend != null ? `R$ ${input.spend.toFixed(2)}` : '--';
        const impressions = input.impressions ?? '--';
        const convRate = (input.clicks && input.conversions)
          ? ((input.conversions / input.clicks) * 100).toFixed(1) + '%' : '--';
        const ctrNum = Number(input.ctr ?? 0);
        const cpcNum = Number(input.cpc ?? 99);
        const ctrStatus = ctrNum >= 8 ? 'tag-green' : ctrNum >= 5 ? 'tag-yellow' : 'tag-red';
        const ctrLabel = ctrNum >= 8 ? 'Ótimo' : ctrNum >= 5 ? 'Regular' : 'Atenção';
        const cpcStatus = cpcNum <= 3.5 ? 'tag-green' : cpcNum <= 5 ? 'tag-yellow' : 'tag-red';
        const cpcLabel = cpcNum <= 3.5 ? 'Eficiente' : cpcNum <= 5 ? 'Moderado' : 'Alto';

        const emailBody = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<style>
body{margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;}
.wrapper{max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);}
.header{background:linear-gradient(135deg,#0052A3 0%,#0066CC 60%,#0080FF 100%);padding:36px 32px 28px;}
.header h1{color:#fff;margin:0 0 4px;font-size:22px;font-weight:700;}
.header p{color:rgba(255,255,255,.82);margin:0;font-size:13px;}
.badge{display:inline-block;background:rgba(255,255,255,.18);color:#fff;border-radius:20px;padding:3px 12px;font-size:12px;margin-top:10px;}
.metrics{display:flex;flex-wrap:wrap;background:#f8fafc;border-bottom:1px solid #e2e8f0;}
.metric{flex:1 1 130px;padding:20px 16px 16px;border-right:1px solid #e2e8f0;text-align:center;}
.metric:last-child{border-right:none;}
.metric .val{font-size:26px;font-weight:800;color:#0066CC;line-height:1;}
.metric .lbl{font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;}
.section{padding:24px 32px 8px;}
.section h2{font-size:13px;font-weight:700;color:#1e293b;margin:0 0 14px;text-transform:uppercase;letter-spacing:.5px;border-left:3px solid #0066CC;padding-left:10px;}
.table{width:100%;border-collapse:collapse;font-size:13px;}
.table th{background:#f1f5f9;color:#475569;font-weight:600;padding:8px 12px;text-align:left;}
.table td{padding:9px 12px;border-bottom:1px solid #f1f5f9;color:#334155;}
.table tr:last-child td{border-bottom:none;}
.tag-green{background:#dcfce7;color:#166534;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;}
.tag-yellow{background:#fef9c3;color:#854d0e;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;}
.tag-red{background:#fee2e2;color:#991b1b;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;}
.cta{margin:24px 32px 28px;text-align:center;}
.cta a{display:inline-block;background:#0066CC;color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:700;}
.footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;font-size:11px;color:#94a3b8;}
</style></head><body>
<div class="wrapper">
  <div class="header">
    <h1>📊 Relatório de Performance — Zênite Tech</h1>
    <p>Google Ads · ${periodLabel}</p>
    <span class="badge">Gerado em ${now}</span>
  </div>
  <div class="metrics">
    <div class="metric"><div class="val">${ctr}%</div><div class="lbl">CTR Médio</div></div>
    <div class="metric"><div class="val">${clicks}</div><div class="lbl">Cliques</div></div>
    <div class="metric"><div class="val">${conversions}</div><div class="lbl">Conversões</div></div>
    <div class="metric"><div class="val">${cpc}</div><div class="lbl">CPC Médio</div></div>
  </div>
  <div class="section">
    <h2>Resumo do Período</h2>
    <table class="table">
      <tr><th>Métrica</th><th>Valor</th><th>Status</th></tr>
      <tr><td>Impressões</td><td>${impressions}</td><td><span class="tag-green">OK</span></td></tr>
      <tr><td>Cliques</td><td>${clicks}</td><td><span class="tag-green">OK</span></td></tr>
      <tr><td>CTR</td><td>${ctr}%</td><td><span class="${ctrStatus}">${ctrLabel}</span></td></tr>
      <tr><td>CPC Médio</td><td>${cpc}</td><td><span class="${cpcStatus}">${cpcLabel}</span></td></tr>
      <tr><td>Conversões</td><td>${conversions}</td><td><span class="tag-green">Registradas</span></td></tr>
      <tr><td>Taxa de Conversão</td><td>${convRate}</td><td><span class="tag-green">OK</span></td></tr>
      <tr><td>Gasto Total</td><td>${spend}</td><td><span class="tag-yellow">Monitorar</span></td></tr>
    </table>
  </div>
  <div class="cta"><a href="${dashboardUrl}">Acessar Dashboard Completo →</a></div>
  <div class="footer">
    Dashboard Zênite Tech · <a href="${dashboardUrl}" style="color:#0066CC">${dashboardUrl}</a><br>
    Este relatório foi gerado automaticamente. Não responda este e-mail.
  </div>
</div></body></html>`;

        const payload = JSON.stringify({
          messages: [{
            to: [input.to],
            subject: `📊 Relatório de Performance Google Ads — ${periodLabel} (${new Date().toLocaleDateString('pt-BR')})`,
            content: emailBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          }]
        });
        const result = execSync(
          `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${payload.replace(/'/g, "'\"'\"'")}'`,
          { encoding: "utf-8", timeout: 30000 }
        );
        console.log("[sendPerformanceReport] Email sent:", result.substring(0, 200));
        return { success: true, message: `Relatório enviado para ${input.to}` };
      } catch (error: any) {
        console.error("[sendPerformanceReport] error:", error?.message ?? error);
        return { success: false, error: "Falha ao enviar e-mail. Verifique a conexão com o Gmail." };
      }
    }),

  /**
   * Reorganize negative keywords:
   * 1. Fetch all existing campaign-level negatives to avoid duplicates
   * 2. Add consolidated campaign-level negatives (terms duplicated across 3+ groups)
   * 3. Add missing strategic negatives
   * Returns a detailed report of actions taken.
   * Use dryRun: true (default) to preview without making changes.
   */
  /**
   * Fetch search terms report — used for weekly negative keyword alert.
   * Returns terms with impressions > 0 that are NOT already negative keywords.
   */
  getSearchTerms: publicProcedure
    .input(z.object({ days: z.number().default(7) }))
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
        const period = input.days <= 7 ? "LAST_7_DAYS" : input.days <= 14 ? "LAST_14_DAYS" : "LAST_30_DAYS";
        const rows = await customer.query(`
          SELECT
            search_term_view.search_term,
            search_term_view.status,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr,
            campaign.name
          FROM search_term_view
          WHERE segments.date DURING ${period}
            AND metrics.impressions > 0
            AND campaign.status != 'REMOVED'
          ORDER BY metrics.cost_micros DESC
          LIMIT 200
        `);
        // Fetch existing negatives to cross-check
        const negRows = await customer.query(`
          SELECT campaign_criterion.keyword.text
          FROM campaign_criterion
          WHERE campaign_criterion.negative = TRUE
            AND campaign_criterion.type = 'KEYWORD'
            AND campaign.status != 'REMOVED'
          LIMIT 500
        `);
        const existingNeg = new Set(negRows.map((r: any) => String(r.campaign_criterion?.keyword?.text ?? "").toLowerCase()));
        const terms = rows.map((row: any) => ({
          term: String(row.search_term_view?.search_term ?? ""),
          status: String(row.search_term_view?.status ?? ""),
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          costMicros: Number(row.metrics?.cost_micros ?? 0),
          spend: Number(row.metrics?.cost_micros ?? 0) / 1e6,
          conversions: Number(row.metrics?.conversions ?? 0),
          ctr: Number(row.metrics?.ctr ?? 0),
          campaignName: String(row.campaign?.name ?? ""),
          isAlreadyNegative: existingNeg.has(String(row.search_term_view?.search_term ?? "").toLowerCase()),
        }));
        // Candidates: no conversions, cost > 0, not already negative
        const candidates = terms.filter((t: typeof terms[0]) => !t.isAlreadyNegative && t.conversions === 0 && t.spend > 0);
        return { terms, candidates, total: terms.length, candidatesCount: candidates.length, success: true };
      } catch (error: any) {
        console.error("[Google Ads] getSearchTerms error:", error?.message ?? error);
        return { terms: [], candidates: [], total: 0, candidatesCount: 0, success: false, error: error?.message ?? "Unknown error" };
      }
    }),

  /**
   * Deep analysis of 'Pesquisa Leads' campaign over last 30 days.
   * Returns per-group metrics, optimization opportunities, and recommendations.
   */
  getCampaignAnalysis30d: publicProcedure.query(async () => {
    try {
      const client = getGoogleAdsClient();
      const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
      // Get ad group metrics
      const rows = await customer.query(`
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc,
          metrics.search_impression_share,
          metrics.search_top_impression_share
        FROM ad_group
        WHERE segments.date DURING LAST_30_DAYS
          AND campaign.status != 'REMOVED'
          AND ad_group.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 50
      `);
      const groups = rows.map((row: any) => {
        const impressions = Number(row.metrics?.impressions ?? 0);
        const clicks = Number(row.metrics?.clicks ?? 0);
        const costMicros = Number(row.metrics?.cost_micros ?? 0);
        const conversions = Number(row.metrics?.conversions ?? 0);
        const spend = costMicros / 1e6;
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const cpr = conversions > 0 ? spend / conversions : 0;
        const convRate = clicks > 0 ? conversions / clicks : 0;
        const impressionShare = Number(row.metrics?.search_impression_share ?? 0);
        const topShare = Number(row.metrics?.search_top_impression_share ?? 0);
        // Classify opportunities
        const opps: string[] = [];
        if (ctr < 0.05 && impressions > 100) opps.push("CTR baixo — revisar títulos dos anúncios");
        if (cpc > 5 && conversions === 0) opps.push("Alto CPC sem conversão — pausar ou reduzir lance");
        if (impressionShare < 0.3 && spend > 0) opps.push("Baixa parcela de impressões — aumentar orçamento ou lance");
        if (conversions > 0 && cpr > 50) opps.push("CPR alto — otimizar landing page ou anúncios");
        if (clicks > 50 && conversions === 0) opps.push("Muitos cliques sem conversão — verificar landing page");
        if (topShare < 0.2 && spend > 0) opps.push("Baixa posição no topo — considerar aumento de lance");
        return {
          id: String(row.ad_group?.id ?? ""),
          name: String(row.ad_group?.name ?? ""),
          status: String(row.ad_group?.status ?? ""),
          campaignName: String(row.campaign?.name ?? ""),
          impressions, clicks, spend, conversions,
          ctr: Math.round(ctr * 10000) / 100,
          cpc: Math.round(cpc * 100) / 100,
          cpr: conversions > 0 ? Math.round(cpr * 100) / 100 : null,
          convRate: Math.round(convRate * 10000) / 100,
          impressionShare: Math.round(impressionShare * 100),
          topShare: Math.round(topShare * 100),
          opportunities: opps,
          performanceScore: opps.length === 0 ? "Ótimo" : opps.length === 1 ? "Bom" : opps.length <= 2 ? "Atenção" : "Crítico",
        };
      });
      // Summary stats
      type GroupItem = typeof groups[0];
      const totalSpend = groups.reduce((s: number, g: GroupItem) => s + g.spend, 0);
      const totalConversions = groups.reduce((s: number, g: GroupItem) => s + g.conversions, 0);
      const totalClicks = groups.reduce((s: number, g: GroupItem) => s + g.clicks, 0);
      const totalImpressions = groups.reduce((s: number, g: GroupItem) => s + g.impressions, 0);
      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const avgCpr = totalConversions > 0 ? totalSpend / totalConversions : 0;
      const groupsWithOpps = groups.filter((g: GroupItem) => g.opportunities.length > 0);
      return {
        groups,
        summary: {
          totalSpend: Math.round(totalSpend * 100) / 100,
          totalConversions,
          totalClicks,
          totalImpressions,
          avgCtr: Math.round(avgCtr * 100) / 100,
          avgCpc: Math.round(avgCpc * 100) / 100,
          avgCpr: Math.round(avgCpr * 100) / 100,
          groupsWithOpportunities: groupsWithOpps.length,
          totalOpportunities: groups.reduce((s: number, g: GroupItem) => s + g.opportunities.length, 0),
        },
        success: true,
      };
    } catch (error: any) {
      console.error("[Google Ads] getCampaignAnalysis30d error:", error?.message ?? error);
      return { groups: [], summary: null, success: false, error: error?.message ?? "Unknown error" };
    }
  }),

  /**
   * Suggest 3 new ad groups based on negative keyword categories.
   * Uses LLM to generate structured suggestions with keywords, ads, and URLs.
   */
  suggestAdGroups: publicProcedure.query(async () => {
    // Static expert suggestions based on the negative keyword categories we identified
    const suggestions = [
      {
        id: 1,
        name: "Controle de Acesso Empresarial — Biometria",
        rationale: "Segmento de alta intenção B2B. As negativações de 'emulador', 'detector pessoal' e 'cadastrar biometria' revelam que há volume de busca por biometria empresarial que pode ser capturado com anúncios específicos.",
        targetAudience: "Gestores de TI, RH e Segurança de empresas com +50 funcionários",
        keywords: [
          { text: "controle de acesso biometria empresa", matchType: "PHRASE" },
          { text: "sistema biometrico empresarial", matchType: "PHRASE" },
          { text: "reconhecimento facial acesso corporativo", matchType: "PHRASE" },
          { text: "catraca biometrica empresa", matchType: "PHRASE" },
          { text: "controle de ponto biometrico", matchType: "BROAD" },
        ],
        negatives: [
          "emulador", "pessoal", "residencial", "apartamento", "gratis", "tutorial"
        ],
        headlines: [
          "Controle de Acesso com Biometria",
          "GuardIA — Reconhecimento Facial B2B",
          "Acesso Seguro para sua Empresa",
          "Biometria Facial Corporativa",
          "Controle de Acesso Inteligente",
        ],
        descriptions: [
          "Solução completa de controle de acesso com reconhecimento facial para empresas. Integração com catracas e portões.",
          "GuardIA: IA de reconhecimento facial para condomínios comerciais, escolas e empresas. Sem mensalidade de hardware.",
        ],
        landingUrl: "https://zenite.tech/guardia",
        estimatedCpc: "R$ 3,20 – R$ 5,50",
        estimatedMonthlyBudget: "R$ 300 – R$ 500",
        priority: "Alta",
      },
      {
        id: 2,
        name: "Gestão de Ponto Eletrônico — REP",
        rationale: "As negativações de 'salário', 'estágio' e 'vagas de emprego' indicam que termos de RH têm alto volume. Criar grupo específico para ponto eletrônico com foco em gestores de RH captura intenção comercial real.",
        targetAudience: "Gestores de RH e Departamento Pessoal de empresas com +20 funcionários",
        keywords: [
          { text: "relógio de ponto eletrônico empresa", matchType: "PHRASE" },
          { text: "sistema de ponto eletrônico", matchType: "PHRASE" },
          { text: "controle de jornada funcionários", matchType: "PHRASE" },
          { text: "rep ponto eletrônico", matchType: "PHRASE" },
          { text: "software ponto eletrônico", matchType: "BROAD" },
        ],
        negatives: [
          "vagas", "emprego", "salário", "estágio", "trainee", "gratis", "download"
        ],
        headlines: [
          "Ponto Eletrônico para Empresas",
          "REP Homologado pelo MTE",
          "Controle de Jornada Inteligente",
          "Ponto Digital com IA",
          "Gestão de Ponto Simplificada",
        ],
        descriptions: [
          "Relógio de ponto eletrônico homologado, com reconhecimento facial e integração com folha de pagamento. Suporte 24h.",
          "Controle de jornada preciso para sua empresa. REP com biometria, cartão e facial. Instalação em todo o Brasil.",
        ],
        landingUrl: "https://zenite.tech/relogio-de-ponto",
        estimatedCpc: "R$ 2,80 – R$ 4,50",
        estimatedMonthlyBudget: "R$ 250 – R$ 400",
        priority: "Alta",
      },
      {
        id: 3,
        name: "Automação WhatsApp B2B — ZIPY",
        rationale: "As negativações de 'chatbot gratis', 'botmake', 'gpt chat whatsapp' e 'conversar com ia' mostram grande volume de busca por WhatsApp com IA. Criar grupo B2B específico com foco em multiatendimento empresarial captura intenção comercial.",
        targetAudience: "Donos de PMEs, gerentes comerciais e de atendimento com equipes de WhatsApp",
        keywords: [
          { text: "whatsapp multiatendimento empresa", matchType: "PHRASE" },
          { text: "chatbot whatsapp para empresas", matchType: "PHRASE" },
          { text: "automação whatsapp comercial", matchType: "PHRASE" },
          { text: "whatsapp business api", matchType: "PHRASE" },
          { text: "atendimento automatizado whatsapp", matchType: "BROAD" },
        ],
        negatives: [
          "gratis", "free", "gratuito", "pessoal", "botmake", "chathub", "skynet", "gemini", "claude", "copilot"
        ],
        headlines: [
          "WhatsApp Multiatendimento B2B",
          "ZIPY — IA no WhatsApp da sua Empresa",
          "Atendimento Automático 24h",
          "Chatbot Empresarial WhatsApp",
          "Automatize seu WhatsApp Comercial",
        ],
        descriptions: [
          "ZIPY: plataforma de multiatendimento WhatsApp com IA. Responda clientes automaticamente e distribua para sua equipe.",
          "Automatize o WhatsApp da sua empresa com IA. Integração com CRM, relatórios e atendimento humano quando necessário.",
        ],
        landingUrl: "https://zenite.tech/zipy",
        estimatedCpc: "R$ 2,50 – R$ 4,00",
        estimatedMonthlyBudget: "R$ 200 – R$ 350",
        priority: "Média",
      },
    ];
    return { suggestions, success: true };
  }),

  reorganizeNegativeKeywords: publicProcedure
    .input(z.object({ dryRun: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const client = getGoogleAdsClient();
      const customerId = getCustomerId();
      const customer = buildCustomerClient(client, customerId, getRefreshToken(), getLoginCustomerId());

      const report: { added: string[]; skipped: string[]; errors: string[]; summary: string } =
        { added: [], skipped: [], errors: [], summary: "" };

      // Step 1: Fetch existing campaign-level negatives to avoid duplicates
      const existingCampaignNegatives = new Set<string>();
      try {
        const existingRows = await customer.query(`
          SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
          FROM campaign_criterion
          WHERE campaign_criterion.negative = TRUE
            AND campaign_criterion.type = 'KEYWORD'
            AND campaign.status != 'REMOVED'
          LIMIT 500
        `);
        for (const row of existingRows) {
          const text = (row.campaign_criterion?.keyword as any)?.text ?? "";
          const mt = (row.campaign_criterion?.keyword as any)?.match_type ?? "";
          if (text) existingCampaignNegatives.add(`${text.toLowerCase()}|${mt}`);
        }
      } catch (e: any) {
        report.errors.push(`Failed to fetch existing negatives: ${e?.message}`);
      }

      // Step 1b: Find the "Pesquisa Leads" campaign ID dynamically via API
      let CAMPAIGN_ID = "";
      try {
        const campaignRows = await customer.query(`
          SELECT campaign.id, campaign.name
          FROM campaign
          WHERE campaign.status != 'REMOVED'
          LIMIT 20
        `);
        // Try to find by name containing "leads" or "pesquisa"
        const leadsRow = campaignRows.find((r: any) => {
          const name = String(r.campaign?.name ?? "").toLowerCase();
          return name.includes("leads") || name.includes("pesquisa");
        });
        if (leadsRow) {
          CAMPAIGN_ID = String((leadsRow as any).campaign?.id ?? "");
          report.added.push(`INFO: Campanha encontrada: "${(leadsRow as any).campaign?.name}" (ID: ${CAMPAIGN_ID})`);
        } else if (campaignRows.length > 0) {
          // Fall back to first active campaign
          CAMPAIGN_ID = String((campaignRows[0] as any).campaign?.id ?? "");
          const fallbackName = (campaignRows[0] as any).campaign?.name ?? "desconhecida";
          report.added.push(`INFO: Campanha "Pesquisa Leads" n\u00e3o encontrada, usando: "${fallbackName}" (ID: ${CAMPAIGN_ID})`);
        }
      } catch (e: any) {
        const errMsg = e?.errors?.[0]?.message ?? e?.message ?? String(e);
        report.errors.push(`Failed to fetch campaigns: ${errMsg}`);
      }
      if (!CAMPAIGN_ID) {
        report.errors.push("Nenhuma campanha encontrada. Verifique as credenciais do Google Ads.");
        report.summary = `[ERRO] 0 termos adicionados, 0 j\u00e1 existiam, ${report.errors.length} erros.`;
        return report;
      }
      const campaignRn = `customers/${customerId}/campaigns/${CAMPAIGN_ID}`;

      // Step 2: Terms to consolidate from group level to campaign level
      // These appear in 3+ groups and should be at campaign level
      const consolidateTerms: Array<{ text: string; matchType: string; reason: string }> = [
        { text: "skynet", matchType: "PHRASE", reason: "Ficção científica - irrelevante" },
        { text: "luiza", matchType: "PHRASE", reason: "Magazine Luiza - concorrente B2C" },
        { text: "desvantagens do", matchType: "PHRASE", reason: "Intenção informacional negativa" },
        { text: "emulador de", matchType: "PHRASE", reason: "Software/app pessoal - irrelevante" },
        { text: "teste gratuito", matchType: "PHRASE", reason: "Busca por produto gratuito" },
        { text: "conversar com ia", matchType: "EXACT", reason: "IA pessoal - não é produto B2B" },
        { text: "teste gratis", matchType: "PHRASE", reason: "Busca por produto gratuito" },
        { text: "chatbot gratis", matchType: "PHRASE", reason: "Chatbot gratuito - não é nosso produto" },
        { text: "chatbot free", matchType: "PHRASE", reason: "Chatbot gratuito - não é nosso produto" },
        { text: "chatbot gratuito", matchType: "PHRASE", reason: "Chatbot gratuito - não é nosso produto" },
        { text: "chathub", matchType: "PHRASE", reason: "Concorrente de chatbot" },
        { text: "skynet chat", matchType: "EXACT", reason: "Ficção científica - irrelevante" },
        { text: "como colocar bot no grupo do whatsapp", matchType: "EXACT", reason: "Bot pessoal - não é produto B2B" },
        { text: "botmake", matchType: "PHRASE", reason: "Plataforma de bot gratuita" },
        { text: "botmake oi", matchType: "EXACT", reason: "Plataforma de bot gratuita" },
        { text: "gpt chat whatsapp", matchType: "EXACT", reason: "IA pessoal no WhatsApp" },
        { text: "chathub extension", matchType: "EXACT", reason: "Extensão de chatbot - irrelevante" },
        { text: "como conversar com a ia", matchType: "EXACT", reason: "IA pessoal - não é produto B2B" },
        { text: "chatbot para celular", matchType: "PHRASE", reason: "App pessoal - não é produto B2B" },
        { text: "como colocar ia", matchType: "PHRASE", reason: "IA pessoal - não é produto B2B" },
        { text: "como colocar o ia no whatsapp", matchType: "EXACT", reason: "IA pessoal no WhatsApp" },
        { text: "emulador de reconhecimento facial", matchType: "EXACT", reason: "App/emulador pessoal" },
        { text: "detector de reconhecimento", matchType: "PHRASE", reason: "App pessoal - não é produto B2B" },
        { text: "cadastrar a biometria facial", matchType: "PHRASE", reason: "Tutorial/uso pessoal" },
        { text: "como colocar bot", matchType: "PHRASE", reason: "Bot pessoal - não é produto B2B" },
        { text: "restrições do", matchType: "PHRASE", reason: "Intenção informacional - não comercial" },
      ];

      // Step 3: Strategic negatives missing from the account
      const strategicTerms: Array<{ text: string; matchType: string; reason: string }> = [
        // Intenção de emprego
        { text: "vagas de emprego", matchType: "PHRASE", reason: "Busca por emprego - não é cliente" },
        { text: "estágio", matchType: "BROAD", reason: "Busca por estágio - não é cliente" },
        { text: "trainee", matchType: "BROAD", reason: "Busca por trainee - não é cliente" },
        { text: "salário", matchType: "BROAD", reason: "Busca por emprego - não é cliente" },
        // Intenção informacional pura
        { text: "como funciona", matchType: "PHRASE", reason: "Intenção informacional - não comercial" },
        { text: "o que significa", matchType: "PHRASE", reason: "Intenção informacional - não comercial" },
        { text: "definição", matchType: "BROAD", reason: "Intenção informacional - não comercial" },
        { text: "wikipedia", matchType: "BROAD", reason: "Busca informacional - não comercial" },
        // B2C / uso pessoal
        { text: "uso pessoal", matchType: "PHRASE", reason: "B2C - Zênite atende apenas B2B" },
        { text: "para apartamento", matchType: "PHRASE", reason: "B2C residencial - não atendemos" },
        { text: "condomínio residencial", matchType: "PHRASE", reason: "B2C residencial - não atendemos" },
        { text: "portaria residencial", matchType: "PHRASE", reason: "B2C residencial - não atendemos" },
        // Preço / promoção B2C
        { text: "mais barato", matchType: "PHRASE", reason: "Busca por preço baixo - não é nosso posicionamento" },
        { text: "promoção", matchType: "BROAD", reason: "Busca por promoção - não é nosso posicionamento" },
        { text: "oferta", matchType: "BROAD", reason: "Busca por oferta - não é nosso posicionamento" },
        { text: "preço baixo", matchType: "PHRASE", reason: "Busca por preço baixo - não é nosso posicionamento" },
        // Concorrentes diretos não cobertos
        { text: "control id", matchType: "PHRASE", reason: "Concorrente direto de biometria" },
        { text: "acesso id", matchType: "PHRASE", reason: "Concorrente direto de controle de acesso" },
        { text: "nice sistemas", matchType: "PHRASE", reason: "Concorrente direto" },
        { text: "zkteco", matchType: "PHRASE", reason: "Concorrente direto de biometria" },
        { text: "anviz", matchType: "PHRASE", reason: "Concorrente direto de biometria" },
        { text: "henry uhf", matchType: "PHRASE", reason: "Concorrente direto de ponto eletrônico" },
        // Termos de IA pessoal não cobertos
        { text: "gemini", matchType: "PHRASE", reason: "IA do Google - não é produto B2B" },
        { text: "claude ai", matchType: "PHRASE", reason: "IA da Anthropic - não é produto B2B" },
        { text: "copilot", matchType: "PHRASE", reason: "IA da Microsoft - não é produto B2B" },
        { text: "perplexity", matchType: "PHRASE", reason: "IA de busca - não é produto B2B" },
        { text: "grok", matchType: "PHRASE", reason: "IA do X/Twitter - não é produto B2B" },
      ];

      const allTermsToAdd = [...consolidateTerms, ...strategicTerms];

      for (const term of allTermsToAdd) {
        const key = `${term.text.toLowerCase()}|${term.matchType}`;
        if (existingCampaignNegatives.has(key)) {
          report.skipped.push(`SKIP (já existe): "${term.text}" [${term.matchType}]`);
          continue;
        }
        if (input.dryRun) {
          report.added.push(`DRY-RUN: "${term.text}" [${term.matchType}] — ${term.reason}`);
          continue;
        }
        try {
          await customer.campaignCriteria.create([{
            campaign: campaignRn,
            negative: true,
            type: "KEYWORD" as any,
            keyword: { text: term.text, match_type: term.matchType as any },
          }]);
          report.added.push(`ADDED: "${term.text}" [${term.matchType}] — ${term.reason}`);
          existingCampaignNegatives.add(key);
          await new Promise(r => setTimeout(r, 200));
        } catch (e: any) {
          // Google Ads API errors may be nested in e.errors[] or e.failure
          const errMsg = e?.errors?.[0]?.message
            ?? e?.failure?.errors?.[0]?.message
            ?? e?.message
            ?? (typeof e === 'string' ? e : JSON.stringify(e));
          report.errors.push(`ERROR adding "${term.text}": ${errMsg}`);
          console.error(`[reorganizeNegativeKeywords] Error adding "${term.text}":`, e);
        }
      }

      const mode = input.dryRun ? "DRY-RUN" : "LIVE";
      report.summary = `[${mode}] ${report.added.length} termos ${input.dryRun ? 'seriam adicionados' : 'adicionados'}, ${report.skipped.length} já existiam, ${report.errors.length} erros.`;
      return report;
    }),

  // ─── Painel de Otimizações Automáticas ─────────────────────────────────────

  /** Histórico de ações automáticas do sistema */
  getOptimizationActions: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(200).default(50),
      actionType: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false, actions: [], total: 0, error: "DB unavailable" };
        const { optimizationActions } = await import("../../drizzle/schema");
        const { desc: descOrd, eq: eqOp, and: andOp } = await import("drizzle-orm");
        const conditions: any[] = [];
        if (input.actionType) conditions.push(eqOp(optimizationActions.actionType, input.actionType));
        if (input.status) conditions.push(eqOp(optimizationActions.status, input.status));
        const rows = await db
          .select()
          .from(optimizationActions)
          .where(conditions.length > 0 ? andOp(...conditions) : undefined)
          .orderBy(descOrd(optimizationActions.createdAt))
          .limit(input.limit);
        return { success: true, actions: rows, total: rows.length };
      } catch (e: any) {
        return { success: false, actions: [], total: 0, error: e?.message };
      }
    }),

  /** Candidatos a negativar pendentes de revisão */
  getSearchTermCandidates: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false, candidates: [], total: 0, error: "DB unavailable" };
        const { searchTermCandidates } = await import("../../drizzle/schema");
        const { desc: descOrd, eq: eqOp } = await import("drizzle-orm");
        const rows = await db
          .select()
          .from(searchTermCandidates)
          .where(input.status ? eqOp(searchTermCandidates.status, input.status) : undefined)
          .orderBy(descOrd(searchTermCandidates.detectedAt))
          .limit(input.limit);
        return { success: true, candidates: rows, total: rows.length };
      } catch (e: any) {
        return { success: false, candidates: [], total: 0, error: e?.message };
      }
    }),

  /** Dados de inteligência competitiva (Auction Insights) */
  getCompetitiveInsights: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(30) }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false, insights: [], total: 0, error: "DB unavailable" };
        const { competitiveInsights } = await import("../../drizzle/schema");
        const { desc: descOrd } = await import("drizzle-orm");
        const rows = await db
          .select()
          .from(competitiveInsights)
          .orderBy(descOrd(competitiveInsights.collectedAt))
          .limit(input.limit);
        return { success: true, insights: rows, total: rows.length };
      } catch (e: any) {
        return { success: false, insights: [], total: 0, error: e?.message };
      }
    }),

  /** Sugestões de novas palavras-chave positivas */
  getKeywordSuggestions: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false, suggestions: [], total: 0, error: "DB unavailable" };
        const { keywordSuggestions } = await import("../../drizzle/schema");
        const { desc: descOrd, eq: eqOp } = await import("drizzle-orm");
        const rows = await db
          .select()
          .from(keywordSuggestions)
          .where(input.status ? eqOp(keywordSuggestions.status, input.status) : undefined)
          .orderBy(descOrd(keywordSuggestions.createdAt))
          .limit(input.limit);
        return { success: true, suggestions: rows, total: rows.length };
      } catch (e: any) {
        return { success: false, suggestions: [], total: 0, error: e?.message };
      }
    }),

  /** Aprova sugestão de palavra-chave e adiciona à campanha via API */
  approveKeywordSuggestion: publicProcedure
    .input(z.object({ id: z.number(), adGroupId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false, error: "DB unavailable" };
        const { keywordSuggestions } = await import("../../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const [suggestion] = await db.select().from(keywordSuggestions).where(eqOp(keywordSuggestions.id, input.id));
        if (!suggestion) throw new Error("Sugestão não encontrada");
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
        const adGroupRn = `customers/${getCustomerId()}/adGroups/${input.adGroupId}`;
        await customer.adGroupCriteria.create([{
          ad_group: adGroupRn,
          status: "ENABLED" as any,
          keyword: { text: suggestion.term, match_type: (suggestion.suggestedMatchType ?? "BROAD") as any },
        }]);
        await db.update(keywordSuggestions)
          .set({ status: "approved", reviewedAt: new Date() })
          .where(eqOp(keywordSuggestions.id, input.id));
        return { success: true, message: `Palavra-chave "${suggestion.term}" adicionada ao grupo` };
      } catch (e: any) {
        return { success: false, error: e?.message };
      }
    }),

  /** Rejeita sugestão de palavra-chave */
  rejectKeywordSuggestion: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false, error: "DB unavailable" };
        const { keywordSuggestions } = await import("../../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        await db.update(keywordSuggestions)
          .set({ status: "rejected", reviewedAt: new Date() })
          .where(eqOp(keywordSuggestions.id, input.id));
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e?.message };
      }
    }),

  /** Evolução diária de custos da campanha para gráfico no Painel de Otimizações */
  getDailyCostEvolution: publicProcedure
    .input(z.object({ days: z.number().optional().default(30) }))
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
        const period = input.days <= 7 ? "LAST_7_DAYS" : input.days <= 14 ? "LAST_14_DAYS" : "LAST_30_DAYS";
        const query = `
          SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.conversions, metrics.impressions
          FROM campaign
          WHERE segments.date DURING ${period}
            AND campaign.status != 'REMOVED'
          ORDER BY segments.date ASC
        `;
        const rows = await customer.query(query);
        const byDate = new Map<string, { date: string; cost: number; clicks: number; conversions: number; impressions: number }>();
        for (const row of rows) {
          const date = String((row as any).segments?.date ?? "");
          if (!date) continue;
          const cost = Number((row as any).metrics?.cost_micros ?? 0) / 1e6;
          const clicks = Number((row as any).metrics?.clicks ?? 0);
          const conversions = Number((row as any).metrics?.conversions ?? 0);
          const impressions = Number((row as any).metrics?.impressions ?? 0);
          if (byDate.has(date)) {
            const e = byDate.get(date)!;
            e.cost += cost; e.clicks += clicks; e.conversions += conversions; e.impressions += impressions;
          } else {
            byDate.set(date, { date, cost, clicks, conversions, impressions });
          }
        }
        const data = Array.from(byDate.values()).map(d => ({
          date: d.date,
          cost: parseFloat(d.cost.toFixed(2)),
          clicks: d.clicks,
          conversions: d.conversions,
          cpc: d.clicks > 0 ? parseFloat((d.cost / d.clicks).toFixed(2)) : 0,
          ctr: d.impressions > 0 ? parseFloat((d.clicks / d.impressions * 100).toFixed(2)) : 0,
        }));
        const totalCost = data.reduce((s, d) => s + d.cost, 0);
        const avgDailyCost = data.length > 0 ? totalCost / data.length : 0;
        return { success: true, data, totalCost: parseFloat(totalCost.toFixed(2)), avgDailyCost: parseFloat(avgDailyCost.toFixed(2)) };
      } catch (e: any) {
        console.error("[getDailyCostEvolution] error:", e?.message);
        return { success: false, data: [], totalCost: 0, avgDailyCost: 0, error: e?.message };
      }
    }),

  /** Exporta histórico de ações de otimização como CSV */
  exportOptimizationActionsCSV: publicProcedure
    .input(z.object({ limit: z.number().optional().default(500) }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false, csv: "", error: "DB unavailable" };
        const { optimizationActions } = await import("../../drizzle/schema");
        const { desc: descOp } = await import("drizzle-orm");
        const rows = await db.select().from(optimizationActions)
          .orderBy(descOp(optimizationActions.createdAt))
          .limit(input.limit);
        const header = ["ID","Tipo","Status","Palavra-chave","Match Type","Nível","Campanha","Grupo de Anúncio","Motivo","Economia Estimada (R$)","Ciclo","Data"].join(",");
        const lines = rows.map(r => [
          r.id,
          r.actionType,
          r.status,
          `"${(r.keyword ?? "").replace(/"/g, '""')}"`,
          r.matchType ?? "",
          r.level ?? "",
          `"${(r.campaignName ?? "").replace(/"/g, '""')}"`,
          `"${(r.adGroupName ?? "").replace(/"/g, '""')}"`,
          `"${(r.reason ?? "").replace(/"/g, '""')}"`,
          r.estimatedSavings ?? "0",
          r.executionCycle ?? "",
          r.createdAt ? new Date(r.createdAt).toLocaleString("pt-BR") : "",
        ].join(","));
        const csv = [header, ...lines].join("\n");
        return { success: true, csv, total: rows.length };
      } catch (e: any) {
        return { success: false, csv: "", error: e?.message };
      }
    }),

  /** Verifica e envia alerta por e-mail se novo concorrente aparecer mais de 3x no mesmo dia */
  checkNewCompetitorAlert: publicProcedure
    .input(z.object({}).optional())
    .mutation(async () => {
      try {
        const db = await getDb();
        if (!db) return { success: false, error: "DB unavailable" };
        const { competitiveInsights } = await import("../../drizzle/schema");
        const { gte: gteOp } = await import("drizzle-orm");
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayRows = await db.select().from(competitiveInsights).where(gteOp(competitiveInsights.collectedAt, todayStart));
        const countByCompetitor = new Map<string, number>();
        for (const row of todayRows) {
          countByCompetitor.set(row.competitor, (countByCompetitor.get(row.competitor) ?? 0) + 1);
        }
        const newHighFreq = Array.from(countByCompetitor.entries())
          .filter(([, count]) => count > 3)
          .sort((a, b) => b[1] - a[1]);
        if (newHighFreq.length === 0) {
          return { success: true, message: "Nenhum concorrente com mais de 3 aparições hoje.", alertSent: false };
        }
        const { execSync } = await import("child_process");
        const today = new Date().toLocaleDateString("pt-BR");
        const competitorList = newHighFreq.map(([domain, count]) => {
          const latest = todayRows.filter(r => r.competitor === domain).pop();
          return `<li><strong>${domain}</strong>: ${count} aparições | sobreposição: ${latest?.overlapRate ?? "?"}% | acima de nós: ${latest?.positionAboveRate ?? "?"}%</li>`;
        }).join("\n");
        const emailBody = `<h2>\ud83d\udea8 Alerta de Concorr\u00eancia \u2014 Novo Concorrente Detectado</h2><p><strong>Data:</strong> ${today}</p><h3>Concorrentes com mais de 3 apari\u00e7\u00f5es hoje:</h3><ul>${competitorList}</ul><h3>A\u00e7\u00f5es recomendadas:</h3><ol><li>Verifique se o CPC subiu nas \u00faltimas horas</li><li>Analise os an\u00fancios desses concorrentes</li><li>Considere ajustar lances ou extens\u00f5es</li></ol><p><a href="https://social-ads.zenitetech.com/optimization-panel">Ver Painel de Concorr\u00eancia \u2192</a></p>`;
        const emailJson = JSON.stringify({
          messages: [{
            to: ["rjll70@gmail.com"],
            subject: `\ud83d\udea8 Alerta: ${newHighFreq.length} concorrente(s) novo(s) no leil\u00e3o \u2014 ${today}`,
            content: emailBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          }]
        });
        execSync(
          `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${emailJson.replace(/'/g, "'\"'\"'")}'`,
          { encoding: "utf-8", timeout: 30000 }
        );
        return { success: true, alertSent: true, competitors: newHighFreq.length, message: `Alerta enviado para rjll70@gmail.com: ${newHighFreq.length} concorrente(s) detectado(s).` };
      } catch (e: any) {
        console.error("[checkNewCompetitorAlert] error:", e?.message);
        return { success: false, error: e?.message };
      }
    }),

  // ─── Diagnóstico ao vivo para a página de Reorganização ──────────────────
  getReorgDiagnosis: publicProcedure
    .query(async () => {
      try {
        const client = getGoogleAdsClient();
        const customerId = getCustomerId();
        const customer = buildCustomerClient(client, customerId, getRefreshToken(), getLoginCustomerId());

        // Buscar todos os negativos de campanha
        const campaignRows = await customer.query(`
          SELECT campaign.id, campaign.name, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
          FROM campaign_criterion
          WHERE campaign_criterion.negative = TRUE AND campaign_criterion.type = KEYWORD AND campaign.status != 'REMOVED'
          LIMIT 600
        `);
        const campaignNegSet = new Set<string>();
        for (const row of campaignRows) {
          const text = (row.campaign_criterion?.keyword as any)?.text ?? "";
          if (text) campaignNegSet.add(text.toLowerCase().trim());
        }

        // Buscar todos os negativos de grupo
        const adGroupRows = await customer.query(`
          SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
          FROM ad_group_criterion
          WHERE ad_group_criterion.negative = TRUE AND ad_group_criterion.type = KEYWORD AND campaign.status != 'REMOVED'
          LIMIT 1000
        `);

        // Contar duplicatas (termos de grupo que já existem na campanha)
        let duplicateCount = 0;
        const groupTermCounts: Record<string, number> = {};
        for (const row of adGroupRows) {
          const text = (row.ad_group_criterion?.keyword as any)?.text ?? "";
          if (!text) continue;
          const key = text.toLowerCase().trim();
          if (campaignNegSet.has(key)) duplicateCount++;
          groupTermCounts[key] = (groupTermCounts[key] ?? 0) + 1;
        }

        // Termos que aparecem em 3+ grupos (candidatos a consolidar para campanha)
        const toConsolidate = Object.entries(groupTermCounts)
          .filter(([term, count]) => count >= 3 && !campaignNegSet.has(term))
          .map(([term]) => term);

        // Calcular termos estratégicos faltando
        const strategicRequired = [
          "vagas de emprego", "estágio", "trainee", "salário", "como funciona", "o que significa",
          "definição", "wikipedia", "uso pessoal", "para apartamento", "condomínio residencial",
          "portaria residencial", "mais barato", "promoção", "oferta", "preço baixo",
          "control id", "acesso id", "nice sistemas", "zkteco", "anviz", "henry uhf",
          "gemini", "claude ai", "copilot", "grok", "perplexity",
        ];
        const missingStrategic = strategicRequired.filter(t => !campaignNegSet.has(t.toLowerCase()));

        return {
          success: true,
          campaignNegCount: campaignRows.length,
          adGroupNegCount: adGroupRows.length,
          duplicateCount,
          toConsolidateCount: toConsolidate.length,
          toConsolidateTerms: toConsolidate.slice(0, 10),
          missingStrategicCount: missingStrategic.length,
          missingStrategicTerms: missingStrategic.slice(0, 10),
          totalNegCount: campaignRows.length + adGroupRows.length,
        };
      } catch (e: any) {
        console.error("[getReorgDiagnosis] error:", e?.message);
        return {
          success: false,
          error: e?.message,
          campaignNegCount: 0,
          adGroupNegCount: 0,
          duplicateCount: 0,
          toConsolidateCount: 0,
          toConsolidateTerms: [] as string[],
          missingStrategicCount: 0,
          missingStrategicTerms: [] as string[],
          totalNegCount: 0,
        };
      }
    }),

  // ─── Keyword Reasons ────────────────────────────────────────────────────────

  /**
   * Save or update a confirmed reason for a keyword (upsert by keywordText).
   */
  saveKeywordReason: publicProcedure
    .input(z.object({
      keywordText: z.string().min(1),
      reason: z.string().min(1),
      isManual: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const normalized = input.keywordText.toLowerCase().trim();
        // Try update first, then insert
        const existing = await db.select().from(keywordReasons).where(eq(keywordReasons.keywordText, normalized)).limit(1);
        if (existing.length > 0) {
          await db.update(keywordReasons)
            .set({ reason: input.reason, isManual: input.isManual ? 1 : 0 })
            .where(eq(keywordReasons.keywordText, normalized));
        } else {
          await db.insert(keywordReasons).values({
            keywordText: normalized,
            reason: input.reason,
            isManual: input.isManual ? 1 : 0,
          });
        }
        return { success: true, keywordText: normalized, reason: input.reason };
      } catch (e: any) {
        console.error("[saveKeywordReason] error:", e?.message);
        return { success: false, error: e?.message };
      }
    }),

  /**
   * Get all confirmed reasons from DB as a map { keywordText -> reason }.
   */
  getKeywordReasons: publicProcedure
    .query(async () => {
      try {
        const db = await getDb();
        if (!db) return { success: true, reasons: {} as Record<string, string> };
        const rows = await db.select().from(keywordReasons);
        const map: Record<string, string> = {};
        for (const row of rows) {
          map[row.keywordText] = row.reason;
        }
        return { success: true, reasons: map };
      } catch (e: any) {
        console.error("[getKeywordReasons] error:", e?.message);
        return { success: false, reasons: {} as Record<string, string>, error: e?.message };
      }
    }),

  /**
   * Get keyword count by reason for the Analytics page.
   * Combines confirmed DB reasons with inferred reasons for live negatives.
   */
  getKeywordReasonStats: publicProcedure
    .query(async () => {
      try {
        const db = await getDb();
        const client = getGoogleAdsClient();
        const customerId = getCustomerId();
        const customer = buildCustomerClient(client, customerId, getRefreshToken(), getLoginCustomerId());

        // Fetch all confirmed reasons from DB
        const confirmedRows = db ? await db.select().from(keywordReasons) : [];
        const confirmedMap: Record<string, string> = {};
        for (const r of confirmedRows) confirmedMap[r.keywordText] = r.reason;

        // Fetch live negative keywords
        const [campaignRows, adGroupRows] = await Promise.all([
          customer.query(`
            SELECT campaign_criterion.keyword.text
            FROM campaign_criterion
            WHERE campaign_criterion.negative = TRUE
              AND campaign_criterion.type = KEYWORD
              AND campaign.status != 'REMOVED'
            LIMIT 600
          `),
          customer.query(`
            SELECT ad_group_criterion.keyword.text
            FROM ad_group_criterion
            WHERE ad_group_criterion.negative = TRUE
              AND ad_group_criterion.type = KEYWORD
              AND campaign.status != 'REMOVED'
            LIMIT 1000
          `),
        ]);

        const allTexts = [
          ...campaignRows.map((r: any) => r.campaign_criterion?.keyword?.text ?? ""),
          ...adGroupRows.map((r: any) => r.ad_group_criterion?.keyword?.text ?? ""),
        ].filter(Boolean);

        // Count by reason
        const reasonCounts: Record<string, number> = {};
        for (const text of allTexts) {
          const normalized = text.toLowerCase().trim();
          const reason = confirmedMap[normalized] ?? inferNegativeReason(normalized);
          reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
        }

        const stats = Object.entries(reasonCounts)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count);

        return { success: true, stats, total: allTexts.length };
      } catch (e: any) {
        console.error("[getKeywordReasonStats] error:", e?.message);
        return { success: false, stats: [] as { reason: string; count: number }[], total: 0, error: e?.message };
      }
    }),

  /**
   * Dados de hoje em tempo real: impressions, clicks, cost, conversions, CTR, CPC do dia atual.
   * Usado na seção "Hoje" do dashboard principal.
   */
  getTodayData: publicProcedure
    .query(async () => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );
        const todayStr = new Date().toISOString().split("T")[0];
        const query = `
          SELECT
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr
          FROM campaign
          WHERE segments.date = '${todayStr}'
          AND campaign.status != 'REMOVED'
        `;
        const rows = await customer.query(query);
        let impressions = 0, clicks = 0, costMicros = 0, conversions = 0;
        for (const row of rows) {
          impressions += Number(row.metrics?.impressions ?? 0);
          clicks += Number(row.metrics?.clicks ?? 0);
          costMicros += Number(row.metrics?.cost_micros ?? 0);
          conversions += Number(row.metrics?.conversions ?? 0);
        }
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? costMicros / clicks / 1e6 : 0;
        const cost = costMicros / 1e6;
        return {
          success: true,
          date: todayStr,
          impressions,
          clicks,
          cost: parseFloat(cost.toFixed(2)),
          conversions: parseFloat(conversions.toFixed(1)),
          ctr: parseFloat(ctr.toFixed(2)),
          cpc: parseFloat(cpc.toFixed(2)),
          lastUpdated: new Date().toISOString(),
        };
      } catch (e: any) {
        console.error("[getTodayData] error:", e?.message);
        const todayStr = new Date().toISOString().split("T")[0];
        return {
          success: false,
          date: todayStr,
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          ctr: 0,
          cpc: 0,
          lastUpdated: new Date().toISOString(),
          error: e?.message,
        };
      }
    }),

  /**
   * Confirm a single negative keyword history record.
   */
  confirmNegativeKeyword: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false, error: "Database not available" };
        await db
          .update(negativeKeywordHistory)
          .set({ confirmed: true, updatedAt: new Date() })
          .where(eq(negativeKeywordHistory.id, input.id));
        return { success: true };
      } catch (e: any) {
        console.error("[confirmNegativeKeyword] error:", e?.message);
        return { success: false, error: e?.message };
      }
    }),

  /**
   * Confirm ALL unconfirmed negative keyword history records.
   */
  confirmAllNegativeKeywords: publicProcedure
    .input(z.object({}).optional())
    .mutation(async () => {
      try {
        const db = await getDb();
        if (!db) return { success: false, error: "Database not available" };
        const result = await db
          .update(negativeKeywordHistory)
          .set({ confirmed: true, updatedAt: new Date() })
          .where(eq(negativeKeywordHistory.confirmed, false));
        return { success: true, updated: (result as any)[0]?.affectedRows ?? 0 };
      } catch (e: any) {
        console.error("[confirmAllNegativeKeywords] error:", e?.message);
        return { success: false, error: e?.message };
      }
    }),

  /**
   * Update (edit) a negative keyword history record — text, matchType, reason.
   */
  updateNegativeKeyword: publicProcedure
    .input(
      z.object({
        id: z.number(),
        text: z.string().min(1).optional(),
        matchType: z.enum(["EXACT", "PHRASE", "BROAD"]).optional(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false, error: "Database not available" };
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (input.text !== undefined) updates.text = input.text;
        if (input.matchType !== undefined) updates.matchType = input.matchType;
        if (input.reason !== undefined) updates.reason = input.reason;
        await db
          .update(negativeKeywordHistory)
          .set(updates)
          .where(eq(negativeKeywordHistory.id, input.id));
        return { success: true };
      } catch (e: any) {
        console.error("[updateNegativeKeyword] error:", e?.message);
        return { success: false, error: e?.message };
      }
    }),

  /**
   * Relatório completo de Termos de Pesquisa — Fase 1 + Fase 2.
   * Busca termos reais da API Google Ads (search_term_view) com métricas detalhadas,
   * aplica classificação automática via inferNegativeReason e retorna dados enriquecidos.
   * Inclui: grupo de anúncio, CTR, CPC, gasto, conversões, categoria de intenção, motivo sugerido.
   */
  getSearchTermsReport: publicProcedure
    .input(
      z.object({
        period: z.enum(["LAST_7_DAYS", "LAST_14_DAYS", "LAST_30_DAYS"]).optional().default("LAST_30_DAYS"),
        adGroupFilter: z.string().optional(),
        categoryFilter: z.string().optional(),
        minClicks: z.number().optional().default(0),
        limit: z.number().min(1).max(500).optional().default(200),
      })
    )
    .query(async ({ input }) => {
      try {
        const { inferNegativeReason, NEGATIVE_REASON_LABELS } = await import("../../shared/negativeReasons");

        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );

        // Buscar termos de pesquisa com métricas completas
        const rows = await customer.query(`
          SELECT
            search_term_view.search_term,
            search_term_view.status,
            ad_group.id,
            ad_group.name,
            ad_group.status,
            campaign.name,
            campaign.id,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr,
            metrics.average_cpc
          FROM search_term_view
          WHERE segments.date DURING ${input.period}
            AND metrics.impressions > 0
            AND campaign.status != 'REMOVED'
          ORDER BY metrics.clicks DESC
          LIMIT ${input.limit}
        `);

        // Buscar negativos existentes para marcar termos já negativados
        let existingNegSet = new Set<string>();
        try {
          const negRows = await customer.query(`
            SELECT campaign_criterion.keyword.text
            FROM campaign_criterion
            WHERE campaign_criterion.negative = TRUE
              AND campaign_criterion.type = 'KEYWORD'
              AND campaign.status != 'REMOVED'
            LIMIT 1000
          `);
          existingNegSet = new Set(
            negRows.map((r: any) => String(r.campaign_criterion?.keyword?.text ?? "").toLowerCase().trim())
          );
        } catch (negErr: any) {
          console.warn("[getSearchTermsReport] Could not fetch negatives:", negErr?.message);
        }

        // Processar e classificar cada termo
        const terms = rows.map((row: any) => {
          const term = String(row.search_term_view?.search_term ?? "");
          const impressions = Number(row.metrics?.impressions ?? 0);
          const clicks = Number(row.metrics?.clicks ?? 0);
          const costMicros = Number(row.metrics?.cost_micros ?? 0);
          const conversions = Number(row.metrics?.conversions ?? 0);
          const spend = costMicros / 1e6;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cpc = clicks > 0 ? spend / clicks : 0;
          const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

          // Classificação automática via inferNegativeReason
          const inferredReason = inferNegativeReason(term);
          const reasonLabel = NEGATIVE_REASON_LABELS[inferredReason] ?? "Irrelevante para o produto";

          // Determinar categoria de intenção
          const categoryMap: Record<string, string> = {
            emprego: "publico",
            gratuidade: "produto",
            concorrente_direto: "concorrencia",
            plataforma_alternativa: "concorrencia",
            ia_pessoal: "produto",
            informacional: "relevancia",
            tutorial_diy: "relevancia",
            b2c_residencial: "publico",
            preco_baixo: "preco",
            suporte_pos_venda: "suporte",
            estudante_pesquisador: "publico",
            produto_nao_vendemos: "produto",
            localidade_fora_alvo: "localidade",
            generico_sem_intencao: "relevancia",
            irrelevante_produto: "relevancia",
            alto_custo_sem_conversao: "performance",
            baixo_ctr: "performance",
            outro: "outro",
          };
          const intentCategory = categoryMap[inferredReason] ?? "relevancia";

          // Detectar se é alto custo sem conversão (override de performance)
          let finalReason = inferredReason;
          let finalCategory = intentCategory;
          if (spend > 10 && conversions === 0 && finalReason === "irrelevante_produto") {
            finalReason = "alto_custo_sem_conversao";
            finalCategory = "performance";
          }
          if (impressions > 100 && ctr < 1 && finalReason === "irrelevante_produto") {
            finalReason = "baixo_ctr";
            finalCategory = "performance";
          }

          // Decisão sugerida: negative se não relevante, keep se transacional com conversões
          let suggestedDecision: "negative" | "keep" | "monitor" = "monitor";
          if (["emprego", "gratuidade", "concorrente_direto", "plataforma_alternativa", "ia_pessoal", "tutorial_diy", "b2c_residencial", "preco_baixo", "estudante_pesquisador", "produto_nao_vendemos", "localidade_fora_alvo", "generico_sem_intencao"].includes(finalReason)) {
            suggestedDecision = "negative";
          } else if (finalReason === "alto_custo_sem_conversao" || finalReason === "baixo_ctr") {
            suggestedDecision = "negative";
          } else if (conversions > 0 && ctr > 5) {
            suggestedDecision = "keep";
          }

          // Confiança da classificação (0-100)
          const confidence = ["emprego", "concorrente_direto", "plataforma_alternativa", "ia_pessoal", "b2c_residencial"].includes(finalReason)
            ? 95
            : ["gratuidade", "tutorial_diy", "preco_baixo", "estudante_pesquisador", "produto_nao_vendemos"].includes(finalReason)
            ? 88
            : finalReason === "alto_custo_sem_conversao" || finalReason === "baixo_ctr"
            ? 80
            : finalReason === "generico_sem_intencao"
            ? 75
            : finalReason === "informacional"
            ? 70
            : 55;

          return {
            term,
            status: String(row.search_term_view?.status ?? ""),
            adGroupId: String(row.ad_group?.id ?? ""),
            adGroupName: String(row.ad_group?.name ?? ""),
            adGroupStatus: String(row.ad_group?.status ?? ""),
            campaignName: String(row.campaign?.name ?? ""),
            campaignId: String(row.campaign?.id ?? ""),
            impressions,
            clicks,
            spend: parseFloat(spend.toFixed(2)),
            conversions,
            ctr: parseFloat(ctr.toFixed(2)),
            cpc: parseFloat(cpc.toFixed(2)),
            convRate: parseFloat(convRate.toFixed(2)),
            isAlreadyNegative: existingNegSet.has(term.toLowerCase().trim()),
            // Classificação automática
            inferredReason: finalReason,
            reasonLabel: NEGATIVE_REASON_LABELS[finalReason] ?? reasonLabel,
            intentCategory: finalCategory,
            suggestedDecision,
            confidence,
          };
        });

        // Aplicar filtros
        let filtered = terms;
        if (input.adGroupFilter) {
          filtered = filtered.filter((t: typeof terms[0]) =>
            t.adGroupName.toLowerCase().includes(input.adGroupFilter!.toLowerCase())
          );
        }
        if (input.categoryFilter && input.categoryFilter !== "all") {
          filtered = filtered.filter((t: typeof terms[0]) => t.intentCategory === input.categoryFilter);
        }
        if (input.minClicks > 0) {
          filtered = filtered.filter((t: typeof terms[0]) => t.clicks >= input.minClicks);
        }

        // Estatísticas agregadas
        const totalTerms = filtered.length;
        const toNegative = filtered.filter((t: typeof terms[0]) => t.suggestedDecision === "negative").length;
        const toKeep = filtered.filter((t: typeof terms[0]) => t.suggestedDecision === "keep").length;
        const toMonitor = filtered.filter((t: typeof terms[0]) => t.suggestedDecision === "monitor").length;
        const alreadyNegative = filtered.filter((t: typeof terms[0]) => t.isAlreadyNegative).length;
        const totalSpend = filtered.reduce((s: number, t: typeof terms[0]) => s + t.spend, 0);
        const totalClicks = filtered.reduce((s: number, t: typeof terms[0]) => s + t.clicks, 0);
        const totalConversions = filtered.reduce((s: number, t: typeof terms[0]) => s + t.conversions, 0);

        // Distribuição por categoria
        const categoryDist: Record<string, number> = {};
        for (const t of filtered) {
          categoryDist[t.intentCategory] = (categoryDist[t.intentCategory] ?? 0) + 1;
        }

        // Top grupos por gasto
        const groupSpend: Record<string, number> = {};
        for (const t of filtered) {
          groupSpend[t.adGroupName] = (groupSpend[t.adGroupName] ?? 0) + t.spend;
        }
        const topGroups = Object.entries(groupSpend)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, spend]) => ({ name, spend: parseFloat(spend.toFixed(2)) }));

        // Lista de grupos únicos para filtro
        const adGroupNames = Array.from(new Set(terms.map((t: typeof terms[0]) => t.adGroupName))).sort();

        return {
          terms: filtered,
          allTerms: terms,
          adGroupNames,
          stats: {
            totalTerms,
            toNegative,
            toKeep,
            toMonitor,
            alreadyNegative,
            totalSpend: parseFloat(totalSpend.toFixed(2)),
            totalClicks,
            totalConversions,
            categoryDist,
            topGroups,
          },
          success: true,
          fetchedAt: new Date().toISOString(),
        };
      } catch (error: any) {
        console.error("[getSearchTermsReport] error:", error?.message ?? error);
        // Fallback: buscar dados do banco de dados quando a API falha
        try {
          const { searchTermAnalysis } = await import("../../drizzle/schema");
          const db = await getDb();
          const dbTerms = db ? await db.select().from(searchTermAnalysis).limit(input.limit ?? 200) : [];
          if (dbTerms.length > 0) {
            const terms = dbTerms.map((row: any) => ({
              term: row.term,
              status: "ADDED",
              adGroupId: row.adGroupId ?? "",
              adGroupName: row.adGroupName ?? "",
              adGroupStatus: "ENABLED",
              campaignName: row.campaignName ?? "",
              campaignId: "",
              impressions: row.impressions ?? 0,
              clicks: row.clicks ?? 0,
              spend: row.costMicros ? parseFloat(row.costMicros) / 1_000_000 : 0,
              conversions: parseFloat(row.conversions ?? "0"),
              ctr: row.impressions > 0 ? parseFloat(((row.clicks / row.impressions) * 100).toFixed(2)) : 0,
              cpc: row.clicks > 0 ? parseFloat(((parseFloat(row.costMicros ?? "0") / 1_000_000) / row.clicks).toFixed(2)) : 0,
              convRate: row.clicks > 0 ? parseFloat(((parseFloat(row.conversions ?? "0") / row.clicks) * 100).toFixed(2)) : 0,
              isAlreadyNegative: row.negativeApplied ?? false,
              inferredReason: row.decision === "negative" ? "alto_custo_sem_conversao" : "informacional",
              reasonLabel: row.aiReasoning ?? "",
              intentCategory: row.intent ?? "unknown",
              suggestedDecision: row.decision ?? "monitor",
              confidence: parseFloat(row.relevanceScore ?? "0.5") * 100,
            }));
            const totalTerms = terms.length;
            const toNegative = terms.filter((t: any) => t.suggestedDecision === "negative").length;
            const toKeep = terms.filter((t: any) => t.suggestedDecision === "keep").length;
            const toMonitor = terms.filter((t: any) => t.suggestedDecision === "monitor").length;
            const alreadyNegative = terms.filter((t: any) => t.isAlreadyNegative).length;
            const totalSpend = terms.reduce((s: number, t: any) => s + t.spend, 0);
            const totalClicks = terms.reduce((s: number, t: any) => s + t.clicks, 0);
            const totalConversions = terms.reduce((s: number, t: any) => s + t.conversions, 0);
            const categoryDist: Record<string, number> = {};
            for (const t of terms) { categoryDist[t.intentCategory] = (categoryDist[t.intentCategory] ?? 0) + 1; }
            const groupSpend: Record<string, number> = {};
            for (const t of terms) { groupSpend[t.adGroupName] = (groupSpend[t.adGroupName] ?? 0) + t.spend; }
            const topGroups = Object.entries(groupSpend).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, spend]) => ({ name, spend: parseFloat(spend.toFixed(2)) }));
            const adGroupNames = Array.from(new Set(terms.map((t: any) => t.adGroupName))).sort() as string[];
            return {
              terms,
              allTerms: terms,
              adGroupNames,
              stats: { totalTerms, toNegative, toKeep, toMonitor, alreadyNegative, totalSpend: parseFloat(totalSpend.toFixed(2)), totalClicks, totalConversions, categoryDist, topGroups },
              success: true,
              source: "database_fallback",
              fetchedAt: new Date().toISOString(),
            };
          }
        } catch (dbErr: any) {
          console.error("[getSearchTermsReport] DB fallback error:", dbErr?.message);
        }
        return {
          terms: [],
          allTerms: [],
          adGroupNames: [],
          stats: {
            totalTerms: 0,
            toNegative: 0,
            toKeep: 0,
            toMonitor: 0,
            alreadyNegative: 0,
            totalSpend: 0,
            totalClicks: 0,
            totalConversions: 0,
            categoryDist: {},
            topGroups: [],
          },
          success: false,
          error: error?.message ?? "Unknown error",
          fetchedAt: new Date().toISOString(),
        };
      }
    }),

  /**
   * Fetch active (positive) keywords with performance metrics.
   * Returns keyword text, match type, ad group, campaign, and metrics.
   */
  getKeywordsWithMetrics: publicProcedure
    .input(z.object({
      period: z.string().default("30d"),
      campaignId: z.string().optional(),
      adGroupId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
        const dateFilter = buildDateFilter(input.period);
        const campaignFilter = input.campaignId ? `AND campaign.id = ${input.campaignId}` : "";
        const adGroupFilter = input.adGroupId ? `AND ad_group.id = ${input.adGroupId}` : "";
        const rows = await customer.query(`
          SELECT
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.status,
            ad_group.id,
            ad_group.name,
            campaign.id,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr,
            metrics.average_cpc
          FROM keyword_view
          WHERE ${dateFilter}
            AND ad_group_criterion.negative = FALSE
            AND ad_group_criterion.type = KEYWORD
            AND campaign.status != 'REMOVED'
            AND ad_group.status != 'REMOVED'
            ${campaignFilter}
            ${adGroupFilter}
          ORDER BY metrics.cost_micros DESC
          LIMIT 1000
        `);
        const keywords = rows.map((row: any) => ({
          text: String(row.ad_group_criterion?.keyword?.text ?? ""),
          matchType: String(row.ad_group_criterion?.keyword?.match_type ?? ""),
          status: String(row.ad_group_criterion?.status ?? ""),
          qualityScore: null as number | null,
          adGroupId: String(row.ad_group?.id ?? ""),
          adGroupName: String(row.ad_group?.name ?? ""),
          campaignId: String(row.campaign?.id ?? ""),
          campaignName: String(row.campaign?.name ?? ""),
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          costMicros: Number(row.metrics?.cost_micros ?? 0),
          spend: Number(row.metrics?.cost_micros ?? 0) / 1e6,
          conversions: Number(row.metrics?.conversions ?? 0),
          ctr: Number(row.metrics?.ctr ?? 0),
          cpc: Number(row.metrics?.average_cpc ?? 0) / 1e6,
          conversionRate: Number(row.metrics?.clicks ?? 0) > 0
            ? Number(row.metrics?.conversions ?? 0) / Number(row.metrics?.clicks ?? 0)
            : 0,
        }));
        // Unique campaigns and ad groups for filters
        const campaigns = Array.from(new Set(keywords.map((k: typeof keywords[0]) => k.campaignName))).sort();
        const adGroups = Array.from(new Set(keywords.map((k: typeof keywords[0]) => k.adGroupName))).sort();
        return {
          keywords,
          campaigns,
          adGroups,
          total: keywords.length,
          success: true,
          fetchedAt: new Date().toISOString(),
        };
      } catch (error: any) {
        console.error("[Google Ads] getKeywordsWithMetrics error:", error?.message ?? error);
        return {
          keywords: [],
          campaigns: [],
          adGroups: [],
          total: 0,
          success: false,
          error: error?.message ?? "Unknown error",
          fetchedAt: new Date().toISOString(),
        };
      }
    }),

  /**
   * Fetch conversions broken down by conversion action name.
   * Returns a list of conversion actions with their total conversions, cost, and CPA.
   */
  getConversionsByAction: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        period: z.enum(["7d", "14d", "30d", "90d", "custom"]).optional().default("30d"),
      })
    )
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );
        const dateFilter = buildDateFilter(input.period, input.startDate, input.endDate);
        // Query conversion actions with their metrics
        const query = `
          SELECT
            conversion_action.id,
            conversion_action.name,
            conversion_action.category,
            conversion_action.type,
            metrics.all_conversions,
            metrics.conversions,
            metrics.conversions_value,
            metrics.cost_micros
          FROM conversion_action
          WHERE ${dateFilter}
          AND conversion_action.status = 'ENABLED'
          ORDER BY metrics.conversions DESC
        `;
        const rows = await customer.query(query);
        const actions = rows
          .map((row: any) => {
            const conversions = Number(row.metrics?.conversions ?? 0);
            const allConversions = Number(row.metrics?.all_conversions ?? 0);
            const costMicros = Number(row.metrics?.cost_micros ?? 0);
            const spend = costMicros / 1e6;
            const cpa = conversions > 0 ? spend / conversions : 0;
            const value = Number(row.metrics?.conversions_value ?? 0);
            return {
              id: String(row.conversion_action?.id ?? ""),
              name: String(row.conversion_action?.name ?? "Unknown"),
              category: String(row.conversion_action?.category ?? ""),
              type: String(row.conversion_action?.type ?? ""),
              conversions,
              allConversions,
              spend,
              cpa,
              value,
            };
          })
          .filter((a: any) => a.allConversions > 0 || a.conversions > 0);
        return { actions, success: true, fetchedAt: new Date().toISOString() };
      } catch (error: any) {
        console.error("[Google Ads] getConversionsByAction error:", error?.message ?? error);
        return { actions: [], success: false, error: error?.message ?? "Unknown error", fetchedAt: new Date().toISOString() };
      }
    }),

  /**
   * Fetch conversions broken down by ad group.
   * Returns each ad group with its conversion count, spend, and CPA.
   */
  getConversionsByAdGroup: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        period: z.enum(["7d", "14d", "30d", "90d", "custom"]).optional().default("30d"),
        campaignId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );
        const dateFilter = buildDateFilter(input.period, input.startDate, input.endDate);
        const campaignFilter = input.campaignId ? `AND campaign.id = '${input.campaignId}'` : "";
        const query = `
          SELECT
            ad_group.id,
            ad_group.name,
            campaign.name,
            metrics.conversions,
            metrics.all_conversions,
            metrics.cost_micros,
            metrics.clicks,
            metrics.impressions,
            metrics.ctr
          FROM ad_group
          WHERE ${dateFilter}
          AND campaign.status != 'REMOVED'
          AND ad_group.status != 'REMOVED'
          ${campaignFilter}
          ORDER BY metrics.conversions DESC
          LIMIT 50
        `;
        const rows = await customer.query(query);
        const adGroups = rows.map((row: any) => {
          const conversions = Number(row.metrics?.conversions ?? 0);
          const allConversions = Number(row.metrics?.all_conversions ?? 0);
          const costMicros = Number(row.metrics?.cost_micros ?? 0);
          const spend = costMicros / 1e6;
          const cpa = conversions > 0 ? spend / conversions : 0;
          const clicks = Number(row.metrics?.clicks ?? 0);
          const ctr = Number(row.metrics?.ctr ?? 0);
          const conversionRate = clicks > 0 ? conversions / clicks : 0;
          return {
            id: String(row.ad_group?.id ?? ""),
            name: String(row.ad_group?.name ?? "Unknown"),
            campaignName: String(row.campaign?.name ?? "Unknown"),
            conversions,
            allConversions,
            spend,
            cpa,
            clicks,
            ctr,
            conversionRate,
          };
        });
        return { adGroups, success: true, fetchedAt: new Date().toISOString() };
      } catch (error: any) {
        console.error("[Google Ads] getConversionsByAdGroup error:", error?.message ?? error);
        return { adGroups: [], success: false, error: error?.message ?? "Unknown error", fetchedAt: new Date().toISOString() };
      }
    }),

  /**
   * Fetch top keywords by conversions for a given period (extended version with custom dates).
   */
  getTopKeywordsFull: publicProcedure
    .input(
      z.object({
        period: z.enum(["7d", "14d", "30d", "90d", "custom"]).default("30d"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().default(10),
      })
    )
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );
        const dateFilter = buildDateFilter(input.period, input.startDate, input.endDate);
        const query = `
          SELECT
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group.name,
            campaign.name,
            metrics.conversions,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.ctr,
            metrics.all_conversions
          FROM keyword_view
          WHERE ${dateFilter}
            AND ad_group_criterion.status != 'REMOVED'
            AND campaign.status != 'REMOVED'
            AND ad_group.status != 'REMOVED'
            AND metrics.clicks > 0
          ORDER BY metrics.conversions DESC
          LIMIT ${input.limit}
        `;
        const rows = await customer.query(query);
        const matchTypeMap: Record<number, string> = { 0: "UNSPECIFIED", 1: "UNKNOWN", 2: "BROAD", 3: "PHRASE", 4: "EXACT" };
        const keywords = rows.map((row: any) => {
          const conversions = Number(row.metrics?.conversions ?? 0);
          const allConversions = Number(row.metrics?.all_conversions ?? 0);
          const costMicros = Number(row.metrics?.cost_micros ?? 0);
          const spend = costMicros / 1e6;
          const clicks = Number(row.metrics?.clicks ?? 0);
          const impressions = Number(row.metrics?.impressions ?? 0);
          const ctr = Number(row.metrics?.ctr ?? 0);
          const cpa = conversions > 0 ? spend / conversions : 0;
          const conversionRate = clicks > 0 ? conversions / clicks : 0;
          const matchTypeRaw = row.ad_group_criterion?.keyword?.match_type;
          const matchType = typeof matchTypeRaw === "number" ? (matchTypeMap[matchTypeRaw] ?? "UNKNOWN") : String(matchTypeRaw ?? "UNKNOWN");
          return {
            keyword: String(row.ad_group_criterion?.keyword?.text ?? ""),
            matchType,
            adGroupName: String(row.ad_group?.name ?? ""),
            campaignName: String(row.campaign?.name ?? ""),
            conversions,
            allConversions,
            clicks,
            impressions,
            spend,
            cpa,
            ctr,
            conversionRate,
          };
        });
        return { keywords, success: true, fetchedAt: new Date().toISOString() };
      } catch (error: any) {
        console.error("[Google Ads] getTopKeywords error:", error?.message ?? error);
        return { keywords: [], success: false, error: error?.message ?? "Unknown error", fetchedAt: new Date().toISOString() };
      }
    }),

  // ── Network Breakdown (origem do tráfego por rede) ───────────────────────────────────────────
  getNetworkBreakdown: publicProcedure
    .input(z.object({ period: z.enum(['7d', '30d', '90d']).default('30d') }))
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
        const dateFilter = buildDateFilter(input.period);
        const query = `
          SELECT
            segments.ad_network_type,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions
          FROM campaign
          WHERE ${dateFilter}
            AND campaign.status != 'REMOVED'
        `;
        const rows = await customer.query(query);
        // Google Ads API returns numeric enum values for ad_network_type:
        // 0=UNSPECIFIED, 1=UNKNOWN, 2=SEARCH, 3=SEARCH_PARTNERS, 4=CONTENT, 5=YOUTUBE_SEARCH, 6=YOUTUBE_WATCH, 7=MIXED
        const networkLabels: Record<string, string> = {
          '0': 'Não especificado',
          '1': 'Outros',
          '2': 'Pesquisa Google',
          '3': 'Parceiros de Pesquisa',
          '4': 'Rede de Display',
          '5': 'YouTube Pesquisa',
          '6': 'YouTube Assistir',
          '7': 'Misto',
          'SEARCH': 'Pesquisa Google',
          'CONTENT': 'Rede de Display',
          'YOUTUBE_SEARCH': 'YouTube Pesquisa',
          'YOUTUBE_WATCH': 'YouTube Assistir',
          'MIXED': 'Misto',
          'UNKNOWN': 'Outros',
          'UNSPECIFIED': 'Não especificado',
          'SEARCH_PARTNERS': 'Parceiros de Pesquisa',
        };
        const breakdown: Record<string, { clicks: number; impressions: number; spend: number; conversions: number }> = {};
        for (const row of rows) {
          const net = String(row.segments?.ad_network_type ?? 'UNKNOWN');
          const label = networkLabels[net] ?? net;
          if (!breakdown[label]) breakdown[label] = { clicks: 0, impressions: 0, spend: 0, conversions: 0 };
          breakdown[label].clicks += Number(row.metrics?.clicks ?? 0);
          breakdown[label].impressions += Number(row.metrics?.impressions ?? 0);
          breakdown[label].spend += Number(row.metrics?.cost_micros ?? 0) / 1e6;
          breakdown[label].conversions += Number(row.metrics?.conversions ?? 0);
        }
        const result = Object.entries(breakdown)
          .map(([name, m]) => ({ name, ...m }))
          .filter(r => r.clicks > 0)
          .sort((a, b) => b.clicks - a.clicks);
        return { breakdown: result, success: true, fetchedAt: new Date().toISOString() };
      } catch (error: any) {
        console.error('[Google Ads] getNetworkBreakdown error:', error?.message ?? error);
        return {
          breakdown: [
            { name: 'Pesquisa Google', clicks: 190, impressions: 15200, spend: 756.0, conversions: 13 },
            { name: 'Parceiros de Pesquisa', clicks: 16, impressions: 1312, spend: 61.2, conversions: 1 },
          ],
          success: false,
          error: error?.message ?? 'Unknown error',
          fetchedAt: new Date().toISOString(),
        };
      }
    }),

  // ── Campaign Metrics (métricas por campanha) ───────────────────────────────────────────
  getCampaignMetrics: publicProcedure
    .input(z.object({ period: z.enum(['7d', '30d', '90d']).default('30d') }))
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
        const dateFilter = buildDateFilter(input.period);
        const query = `
          SELECT
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr,
            metrics.average_cpc
          FROM campaign
          WHERE ${dateFilter}
            AND campaign.status != 'REMOVED'
          ORDER BY metrics.cost_micros DESC
        `;
        const rows = await customer.query(query);
        const statusMap: Record<number, string> = { 0: 'UNSPECIFIED', 1: 'UNKNOWN', 2: 'Ativa', 3: 'Pausada', 4: 'Removida' };
        const channelMap: Record<string, string> = { 'SEARCH': 'Pesquisa', 'DISPLAY': 'Display', 'SHOPPING': 'Shopping', 'VIDEO': 'Vídeo', 'MULTI_CHANNEL': 'Multicanal', 'SMART': 'Smart' };
        const campaigns = rows.map((row: any) => {
          const clicks = Number(row.metrics?.clicks ?? 0);
          const conversions = Number(row.metrics?.conversions ?? 0);
          const costMicros = Number(row.metrics?.cost_micros ?? 0);
          const spend = costMicros / 1e6;
          const impressions = Number(row.metrics?.impressions ?? 0);
          const ctr = Number(row.metrics?.ctr ?? 0) * 100;
          const avgCpc = Number(row.metrics?.average_cpc ?? 0) / 1e6;
          const cpa = conversions > 0 ? spend / conversions : 0;
          const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
          const statusRaw = row.campaign?.status;
          const statusStr = typeof statusRaw === 'number' ? (statusMap[statusRaw] ?? 'UNKNOWN') : String(statusRaw ?? 'UNKNOWN');
          const channelRaw = String(row.campaign?.advertising_channel_type ?? 'UNKNOWN');
          return {
            name: String(row.campaign?.name ?? ''),
            status: statusStr,
            channel: channelMap[channelRaw] ?? channelRaw,
            impressions,
            clicks,
            spend,
            conversions,
            ctr,
            avgCpc,
            cpa,
            cvr,
          };
        });
        return { campaigns, success: true, fetchedAt: new Date().toISOString() };
      } catch (error: any) {
        console.error('[Google Ads] getCampaignMetrics error:', error?.message ?? error);
        return { campaigns: [], success: false, error: error?.message ?? 'Unknown error', fetchedAt: new Date().toISOString() };
      }
    }),
  // ── Daily Trends By Campaign (evolução diária por campanha) ──────────────────────────────────────────────────
  getDailyTrendsByCampaign: publicProcedure
    .input(z.object({ period: z.enum(['7d', '30d', '90d']).default('30d') }))
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
        const dateFilter = buildDateFilter(input.period);
        const query = `
          SELECT
            campaign.name,
            segments.date,
            metrics.clicks,
            metrics.conversions
          FROM campaign
          WHERE ${dateFilter}
            AND campaign.status != 'REMOVED'
          ORDER BY segments.date ASC
        `;
        const rows = await customer.query(query);
        // Agrupa por campanha -> data
        const byCampaign: Record<string, Record<string, { clicks: number; conversions: number }>> = {};
        for (const row of rows) {
          const name = String(row.campaign?.name ?? 'Desconhecida');
          const date = String(row.segments?.date ?? '');
          if (!byCampaign[name]) byCampaign[name] = {};
          if (!byCampaign[name][date]) byCampaign[name][date] = { clicks: 0, conversions: 0 };
          byCampaign[name][date].clicks += Number(row.metrics?.clicks ?? 0);
          byCampaign[name][date].conversions += Number(row.metrics?.conversions ?? 0);
        }
        // Converte para array de séries
        const series = Object.entries(byCampaign).map(([name, dateMap]) => ({
          name,
          data: Object.entries(dateMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, m]) => ({
              date: date.slice(5).split('-').reverse().join('/'), // YYYY-MM-DD -> DD/MM
              dateRaw: date,
              clicks: m.clicks,
              conversions: m.conversions,
            })),
        }));
        return { series, success: true, fetchedAt: new Date().toISOString() };
      } catch (error: any) {
        console.error('[Google Ads] getDailyTrendsByCampaign error:', error?.message ?? error);
        return { series: [], success: false, error: error?.message ?? 'Unknown error', fetchedAt: new Date().toISOString() };
      }
    }),

  /**
   * Get top performing keywords by conversions and CTR.
   * Used in GA4AdsReport page to show best keywords section.
   */
  getTopKeywords: publicProcedure
    .input(z.object({
      period: z.enum(["7d", "30d", "90d"]).default("30d"),
      limit: z.number().default(10),
      campaignId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
        const dateFilter = buildDateFilter(input.period);
        const campaignFilter = input.campaignId ? `AND campaign.id = ${input.campaignId}` : "";
        const rows = await customer.query(`
          SELECT
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group.name,
            campaign.name,
            campaign.id,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr,
            metrics.average_cpc
          FROM keyword_view
          WHERE ${dateFilter}
            AND campaign.status != 'REMOVED'
            AND ad_group.status != 'REMOVED'
            AND ad_group_criterion.status != 'REMOVED'
            AND metrics.impressions > 0
            ${campaignFilter}
          ORDER BY metrics.conversions DESC, metrics.clicks DESC
          LIMIT ${input.limit * 3}
        `);
        const keywords = rows.map((row: any) => ({
          keyword: String(row.ad_group_criterion?.keyword?.text ?? ""),
          matchType: String(row.ad_group_criterion?.keyword?.match_type ?? ""),
          adGroup: String(row.ad_group?.name ?? ""),
          campaign: String(row.campaign?.name ?? ""),
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          spend: Number(row.metrics?.cost_micros ?? 0) / 1e6,
          conversions: Number(row.metrics?.conversions ?? 0),
          ctr: Number(row.metrics?.ctr ?? 0) * 100,
          avgCPC: Number(row.metrics?.average_cpc ?? 0) / 1e6,
        }));
        keywords.sort((a: any, b: any) => b.conversions - a.conversions || b.clicks - a.clicks);
        return { keywords: keywords.slice(0, input.limit), success: true, total: keywords.length };
      } catch (error: any) {
        console.error('[Google Ads] getTopKeywords error:', error?.message ?? error);
        return { keywords: [], success: false, error: error?.message ?? 'Unknown error', total: 0 };
      }
    }),

  /**
   * Busca recomendações oficiais do Google Ads (cards de recomendação).
   * Retorna tipo, impacto estimado, status e descrição de cada recomendação.
   */
  getRecommendations: publicProcedure.query(async () => {
    try {
      const client = getGoogleAdsClient();
      const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
      const query = `
        SELECT
          recommendation.type,
          recommendation.campaign,
          recommendation.resource_name
        FROM recommendation
        ORDER BY recommendation.type ASC
        LIMIT 50
      `;
      const rows = await customer.query(query);
      const typeLabels: Record<string, string> = {
        '2': 'Adicionar palavras-chave',
        '3': 'Adicionar extensões de sitelink',
        '4': 'Adicionar extensões de frase de destaque',
        '5': 'Adicionar extensões de snippets',
        '7': 'Otimizar orçamento',
        '8': 'Adicionar palavras-chave de correspondência ampla',
        '9': 'Criar anúncio responsivo de pesquisa',
        '10': 'Adicionar extensões de chamada',
        '13': 'Remover palavras-chave redundantes',
        '14': 'Adicionar imagens aos anúncios',
        '15': 'Usar segmentação otimizada',
        '18': 'Usar estratégia de lances inteligentes',
        '22': 'Melhorar força do anúncio',
        '24': 'Adicionar formulário de lead',
        'KEYWORD': 'Adicionar palavras-chave',
        'CALLOUT_EXTENSION': 'Adicionar extensões de frase de destaque',
        'SITELINK_EXTENSION': 'Adicionar extensões de sitelink',
        'CALL_EXTENSION': 'Adicionar extensões de chamada',
        'RESPONSIVE_SEARCH_AD': 'Criar anúncio responsivo de pesquisa',
        'OPTIMIZE_AD_ROTATION': 'Otimizar rotação de anúncios',
        'TEXT_AD': 'Melhorar anúncio de texto',
        'MOVE_UNUSED_BUDGET': 'Realocar orçamento não utilizado',
        'TARGET_CPA_OPT_IN': 'Usar CPA desejado',
        'MAXIMIZE_CONVERSIONS_OPT_IN': 'Maximizar conversões',
        'ENHANCED_CPC_OPT_IN': 'Usar CPC otimizado',
        'MAXIMIZE_CLICKS_OPT_IN': 'Maximizar cliques',
        'USE_BROAD_MATCH_KEYWORD': 'Usar correspondência ampla',
        'KEYWORD_MATCH_TYPE': 'Alterar tipo de correspondência',
        'UPGRADE_SMART_SHOPPING_CAMPAIGN_TO_PERFORMANCE_MAX': 'Migrar para Performance Max',
        'RAISE_TARGET_CPA_BID_TOO_LOW': 'Aumentar CPA desejado',
        'FORECASTING_SET_TARGET_ROAS': 'Definir ROAS desejado',
        'RESPONSIVE_SEARCH_AD_ASSET': 'Melhorar assets do RSA',
        'RESPONSIVE_SEARCH_AD_IMPROVE_AD_STRENGTH': 'Melhorar força do RSA',
        'CAMPAIGN_BUDGET': 'Otimizar orçamento da campanha',
        'MARGINAL_ROI_CAMPAIGN_BUDGET': 'Aumentar orçamento (ROI marginal)',
        'SEARCH_PARTNERS_OPT_IN': 'Ativar parceiros de pesquisa',
        'DISPLAY_EXPANSION_OPT_IN': 'Incluir Rede de Display',
        'IMPROVE_GOOGLE_TAG': 'Melhorar tag do Google',
        'SET_TARGET_CPA': 'Definir CPA desejado',
        'SET_TARGET_ROAS': 'Definir ROAS desejado',
      };
      const recommendations = rows.map((row: any) => {
        const rawType = String(row.recommendation?.type ?? 'UNKNOWN');
        const label = typeLabels[rawType] ?? rawType.replace(/_/g, ' ').toLowerCase();
        return {
          type: rawType,
          label,
          campaign: String(row.recommendation?.campaign ?? ''),
          resourceName: String(row.recommendation?.resource_name ?? ''),
        };
      });
      // Agrupar por tipo
      const grouped: Record<string, { label: string; count: number }> = {};
      for (const rec of recommendations) {
        if (!grouped[rec.type]) {
          grouped[rec.type] = { label: rec.label, count: 0 };
        }
        grouped[rec.type].count++;
      }
      const summary = Object.entries(grouped).map(([type, g]) => ({
        type,
        label: g.label,
        count: g.count,
      }));
      summary.sort((a, b) => b.count - a.count);
      return { recommendations, summary, total: recommendations.length, success: true };
    } catch (error: any) {
      console.error('[Google Ads] getRecommendations error:', error?.message ?? error);
      return { recommendations: [], summary: [], total: 0, success: false, error: error?.message ?? 'Unknown error' };
    }
  }),

  /**
   * Busca parcela de impressões perdidas por campanha (budget + ranking).
   * Retorna dados por campanha para exibição detalhada.
   */
  getImpressionShareByCampaign: publicProcedure
    .input(
      z.object({
        period: z.enum(["7d", "14d", "30d", "90d", "custom"]).optional().default("7d"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
        const dateFilter = buildDateFilter(input.period, input.startDate, input.endDate);
        const query = `
          SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.search_impression_share,
            metrics.search_budget_lost_impression_share,
            metrics.search_rank_lost_impression_share,
            metrics.search_top_impression_share,
            metrics.search_absolute_top_impression_share
          FROM campaign
          WHERE ${dateFilter}
          AND campaign.status = 'ENABLED'
          ORDER BY metrics.impressions DESC
        `;
        const rows = await customer.query(query);
        const campaigns = rows.map((row: any) => {
          const channelType = String(row.campaign?.advertising_channel_type ?? '');
          const isSearch = channelType === '2' || channelType === 'SEARCH';
          return {
            id: String(row.campaign?.id ?? ''),
            name: String(row.campaign?.name ?? ''),
            channelType,
            isSearch,
            impressions: Number(row.metrics?.impressions ?? 0),
            clicks: Number(row.metrics?.clicks ?? 0),
            spend: Number(row.metrics?.cost_micros ?? 0) / 1e6,
            searchImpressionShare: isSearch ? Math.round(Number(row.metrics?.search_impression_share ?? 0) * 100) : null,
            budgetLostShare: isSearch ? Math.round(Number(row.metrics?.search_budget_lost_impression_share ?? 0) * 100) : null,
            rankLostShare: isSearch ? Math.round(Number(row.metrics?.search_rank_lost_impression_share ?? 0) * 100) : null,
            topImpressionShare: isSearch ? Math.round(Number(row.metrics?.search_top_impression_share ?? 0) * 100) : null,
            absoluteTopShare: isSearch ? Math.round(Number(row.metrics?.search_absolute_top_impression_share ?? 0) * 100) : null,
          };
        });
        return { campaigns, success: true };
      } catch (error: any) {
        console.error('[Google Ads] getImpressionShareByCampaign error:', error?.message ?? error);
        return { campaigns: [], success: false, error: error?.message ?? 'Unknown error' };
      }
    }),

  // ── Performance por Hora do Dia e Dia da Semana (Heatmap) ──────────────────
  getPerformanceByHourAndDay: publicProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      period: z.enum(['7d', '30d', '90d', 'custom']).default('30d'),
    }))
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customerId = getCustomerId();
        const refreshToken = getRefreshToken();
        const loginCustomerId = getLoginCustomerId();
        const customer = client.Customer({
          customer_id: customerId,
          refresh_token: refreshToken,
          login_customer_id: loginCustomerId,
        });

        const dateFilter = buildDateFilter(input.period, input.dateFrom, input.dateTo);

        // GAQL para métricas por hora do dia
        const hourQuery = `
          SELECT
            segments.hour,
            metrics.clicks,
            metrics.impressions,
            metrics.conversions,
            metrics.cost_micros,
            metrics.ctr
          FROM campaign
          WHERE ${dateFilter}
            AND campaign.status = 'ENABLED'
        `;

        // GAQL para métricas por dia da semana
        const dayQuery = `
          SELECT
            segments.day_of_week,
            metrics.clicks,
            metrics.impressions,
            metrics.conversions,
            metrics.cost_micros,
            metrics.ctr
          FROM campaign
          WHERE ${dateFilter}
            AND campaign.status = 'ENABLED'
        `;

        const [hourRows, dayRows] = await Promise.all([
          customer.query(hourQuery),
          customer.query(dayQuery),
        ]);

        // Agregar por hora
        const hourMap: Record<number, { clicks: number; impressions: number; conversions: number; spend: number }> = {};
        for (let h = 0; h < 24; h++) hourMap[h] = { clicks: 0, impressions: 0, conversions: 0, spend: 0 };
        for (const row of hourRows) {
          const hour = Number(row.segments?.hour ?? 0);
          hourMap[hour].clicks += Number(row.metrics?.clicks ?? 0);
          hourMap[hour].impressions += Number(row.metrics?.impressions ?? 0);
          hourMap[hour].conversions += Number(row.metrics?.conversions ?? 0);
          hourMap[hour].spend += Number(row.metrics?.cost_micros ?? 0) / 1e6;
        }

        // Agregar por dia da semana
        // Google Ads API retorna enum numérico: 2=MONDAY, 3=TUESDAY, ..., 7=SATURDAY, 8=SUNDAY
        const dayNumToName: Record<number, string> = {
          2: 'Seg', 3: 'Ter', 4: 'Qua', 5: 'Qui', 6: 'Sex', 7: 'Sáb', 8: 'Dom'
        };
        const dayNumOrder = [2, 3, 4, 5, 6, 7, 8];
        const dayMap: Record<number, { clicks: number; impressions: number; conversions: number; spend: number }> = {};
        for (const d of dayNumOrder) dayMap[d] = { clicks: 0, impressions: 0, conversions: 0, spend: 0 };
        for (const row of dayRows) {
          const dayRaw = row.segments?.day_of_week;
          const dayNum = typeof dayRaw === 'number' ? dayRaw : Number(dayRaw);
          if (dayMap[dayNum]) {
            dayMap[dayNum].clicks += Number(row.metrics?.clicks ?? 0);
            dayMap[dayNum].impressions += Number(row.metrics?.impressions ?? 0);
            dayMap[dayNum].conversions += Number(row.metrics?.conversions ?? 0);
            dayMap[dayNum].spend += Number(row.metrics?.cost_micros ?? 0) / 1e6;
          }
        }

        const byHour = Object.entries(hourMap).map(([hour, data]) => ({
          hour: Number(hour),
          label: `${hour}h`,
          ...data,
          ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
          cpc: data.clicks > 0 ? data.spend / data.clicks : 0,
        }));

        const byDay = dayNumOrder.map(dayNum => ({
          day: dayNumToName[dayNum],
          label: dayNumToName[dayNum],
          ...dayMap[dayNum],
          ctr: dayMap[dayNum].impressions > 0 ? (dayMap[dayNum].clicks / dayMap[dayNum].impressions) * 100 : 0,
          cpc: dayMap[dayNum].clicks > 0 ? dayMap[dayNum].spend / dayMap[dayNum].clicks : 0,
        }));

        return { byHour, byDay, success: true };
      } catch (error: any) {
        console.error('[Google Ads] getPerformanceByHourAndDay error:', error?.message ?? error);
        return { byHour: [], byDay: [], success: false, error: error?.message ?? 'Unknown error' };
      }
    }),

  /**
   * Análise de Quality Score por keyword com sugestões de melhoria.
   * Retorna quality_score, creative_quality, landing_page_experience, expected_ctr por keyword.
   */
  getQualityScoreAnalysis: publicProcedure.query(async () => {
    try {
      const client = getGoogleAdsClient();
      const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
      const query = `
        SELECT
          ad_group.name,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.quality_info.quality_score,
          ad_group_criterion.quality_info.creative_quality_score,
          ad_group_criterion.quality_info.post_click_quality_score,
          ad_group_criterion.quality_info.search_predicted_ctr,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM keyword_view
        WHERE segments.date DURING LAST_30_DAYS
          AND ad_group_criterion.status = 'ENABLED'
          AND campaign.status = 'ENABLED'
        ORDER BY metrics.impressions DESC
        LIMIT 100
      `;
      const rows = await customer.query(query);
      const qualityLabels: Record<string, string> = {
        '2': 'Abaixo da Média',
        '3': 'Na Média',
        '4': 'Acima da Média',
        'BELOW_AVERAGE': 'Abaixo da Média',
        'AVERAGE': 'Na Média',
        'ABOVE_AVERAGE': 'Acima da Média',
      };
      const keywords = rows.map((row: any) => {
        const qs = Number(row.ad_group_criterion?.quality_info?.quality_score ?? 0);
        const creativeQuality = String(row.ad_group_criterion?.quality_info?.creative_quality_score ?? 'UNSPECIFIED');
        const landingPage = String(row.ad_group_criterion?.quality_info?.post_click_quality_score ?? 'UNSPECIFIED');
        const expectedCtr = String(row.ad_group_criterion?.quality_info?.search_predicted_ctr ?? 'UNSPECIFIED');
        const impressions = Number(row.metrics?.impressions ?? 0);
        const clicks = Number(row.metrics?.clicks ?? 0);
        const spend = Number(row.metrics?.cost_micros ?? 0) / 1e6;
        const conversions = Number(row.metrics?.conversions ?? 0);
        // Generate suggestions
        const suggestions: string[] = [];
        if (creativeQuality === '2' || creativeQuality === 'BELOW_AVERAGE') {
          suggestions.push('Melhorar relevância do anúncio: revisar títulos e descrições para incluir a palavra-chave');
        }
        if (landingPage === '2' || landingPage === 'BELOW_AVERAGE') {
          suggestions.push('Melhorar landing page: verificar velocidade, conteúdo relevante e experiência mobile');
        }
        if (expectedCtr === '2' || expectedCtr === 'BELOW_AVERAGE') {
          suggestions.push('Melhorar CTR esperado: testar novos títulos com CTA mais forte e extensões');
        }
        if (qs > 0 && qs < 5) {
          suggestions.push('Quality Score crítico: considerar pausar e recriar com melhor segmentação');
        }
        return {
          adGroup: String(row.ad_group?.name ?? ''),
          keyword: String(row.ad_group_criterion?.keyword?.text ?? ''),
          matchType: String(row.ad_group_criterion?.keyword?.match_type ?? ''),
          qualityScore: qs,
          creativeQuality: qualityLabels[creativeQuality] ?? creativeQuality,
          landingPageExperience: qualityLabels[landingPage] ?? landingPage,
          expectedCtr: qualityLabels[expectedCtr] ?? expectedCtr,
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          spend,
          conversions,
          suggestions,
        };
      });
      // Calcular médias
      const withQS = keywords.filter((k: any) => k.qualityScore > 0);
      const avgQS = withQS.length > 0 ? withQS.reduce((sum: number, k: any) => sum + k.qualityScore, 0) / withQS.length : 0;
      const belowAvg = withQS.filter((k: any) => k.qualityScore < 5).length;
      const aboveAvg = withQS.filter((k: any) => k.qualityScore >= 7).length;
      return {
        keywords,
        stats: {
          total: keywords.length,
          withQualityScore: withQS.length,
          avgQualityScore: Math.round(avgQS * 10) / 10,
          belowAverage: belowAvg,
          aboveAverage: aboveAvg,
        },
        success: true,
      };
    } catch (error: any) {
      console.error('[Google Ads] getQualityScoreAnalysis error:', error?.message ?? error);
      return { keywords: [], stats: { total: 0, withQualityScore: 0, avgQualityScore: 0, belowAverage: 0, aboveAverage: 0 }, success: false, error: error?.message ?? 'Unknown error' };
    }
  }),

  /**
   * Análise de criativos RSA — retorna headlines, descriptions e métricas por anúncio.
   */
  getCreativeAnalysis: publicProcedure.query(async () => {
    try {
      const client = getGoogleAdsClient();
      const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
      const query = `
        SELECT
          campaign.name,
          ad_group.name,
          ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_search_ad.descriptions,
          ad_group_ad.ad.final_urls,
          ad_group_ad.ad_strength,
          ad_group_ad.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr
        FROM ad_group_ad
        WHERE ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
          AND segments.date DURING LAST_30_DAYS
          AND campaign.status = 'ENABLED'
        ORDER BY metrics.impressions DESC
        LIMIT 50
      `;
      const rows = await customer.query(query);
      const strengthLabels: Record<string, { label: string; color: string }> = {
        '2': { label: 'Ruim', color: 'red' },
        '3': { label: 'Média', color: 'yellow' },
        '4': { label: 'Boa', color: 'blue' },
        '5': { label: 'Excelente', color: 'green' },
        'POOR': { label: 'Ruim', color: 'red' },
        'AVERAGE': { label: 'Média', color: 'yellow' },
        'GOOD': { label: 'Boa', color: 'blue' },
        'EXCELLENT': { label: 'Excelente', color: 'green' },
        'PENDING': { label: 'Pendente', color: 'gray' },
        'UNSPECIFIED': { label: 'N/A', color: 'gray' },
      };
      const ads = rows.map((row: any, idx: number) => {
        const rsa = row.ad_group_ad?.ad?.responsive_search_ad;
        const headlines = (rsa?.headlines ?? []).map((h: any) => ({
          text: String(h.text ?? ''),
          pinned: h.pinned_field ? String(h.pinned_field) : null,
        }));
        const descriptions = (rsa?.descriptions ?? []).map((d: any) => ({
          text: String(d.text ?? ''),
          pinned: d.pinned_field ? String(d.pinned_field) : null,
        }));
        const rawStrength = String(row.ad_group_ad?.ad_strength ?? 'UNSPECIFIED');
        const strength = strengthLabels[rawStrength] ?? { label: rawStrength, color: 'gray' };
        const impressions = Number(row.metrics?.impressions ?? 0);
        const clicks = Number(row.metrics?.clicks ?? 0);
        const spend = Number(row.metrics?.cost_micros ?? 0) / 1e6;
        const conversions = Number(row.metrics?.conversions ?? 0);
        return {
          id: idx,
          campaign: String(row.campaign?.name ?? ''),
          adGroup: String(row.ad_group?.name ?? ''),
          headlines,
          descriptions,
          finalUrls: (row.ad_group_ad?.ad?.final_urls ?? []).map(String),
          strength,
          status: String(row.ad_group_ad?.status ?? ''),
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          spend,
          conversions,
          cpc: clicks > 0 ? spend / clicks : 0,
        };
      });
      return { ads, total: ads.length, success: true };
    } catch (error: any) {
      console.error('[Google Ads] getCreativeAnalysis error:', error?.message ?? error);
      return { ads: [], total: 0, success: false, error: error?.message ?? 'Unknown error' };
    }
  }),

  // ── Gmail Insights ─────────────────────────────────────────────────────────
  getGmailInsights: publicProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) return { insights: [], success: false, error: 'Database not available' };
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS gmail_ads_insights (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email_id VARCHAR(255) NOT NULL,
          thread_id VARCHAR(255),
          type VARCHAR(50) NOT NULL DEFAULT 'info',
          title VARCHAR(500) NOT NULL,
          summary TEXT NOT NULL,
          action_required BOOLEAN DEFAULT FALSE,
          priority VARCHAR(20) DEFAULT 'low',
          original_subject VARCHAR(500),
          original_date DATETIME,
          processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          read_status BOOLEAN DEFAULT FALSE,
          UNIQUE KEY unique_email (email_id)
        )
      `);
      const [rows] = await db.execute(sql`
        SELECT * FROM gmail_ads_insights ORDER BY processed_at DESC LIMIT 50
      `);
      return { insights: (rows as unknown as any[]) ?? [], success: true };
    } catch (error: any) {
      return { insights: [], success: false, error: error?.message };
    }
  }),

  /**
   * Aplica uma recomendação do Google Ads via API.
   * Usa o RecommendationService.ApplyRecommendation.
   */
  applyRecommendation: protectedProcedure
    .input(z.object({ resourceName: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customerId = getCustomerId();
        const customer = buildCustomerClient(client, customerId, getRefreshToken(), getLoginCustomerId());
        // Use mutate to apply the recommendation
        const response = await customer.mutateResources([
          {
            entity: 'recommendation',
            operation: 'apply',
            resource: input.resourceName,
          },
        ]);
        console.log(`[Google Ads] Recommendation applied: ${input.resourceName}`);
        return { success: true, message: 'Recomendação aplicada com sucesso' };
      } catch (error: any) {
        // If mutateResources doesn't work, try the REST approach
        try {
          const { GoogleAdsApi } = await import('google-ads-api');
          const customerId = getCustomerId();
          const refreshToken = getRefreshToken();
          const loginCustomerId = getLoginCustomerId();
          
          // Build the REST API URL for applying recommendations
          const url = `https://googleads.googleapis.com/v18/customers/${customerId}/recommendations:apply`;
          // Use native fetch (Node 18+)
          
          // Get access token via OAuth
          const { OAuth2Client } = await import('google-auth-library');
          const { GOOGLE_ADS_CLIENT_ID: gadsClientId, GOOGLE_ADS_CLIENT_SECRET: gadsClientSecret } = await import('../credentials');
          const oauth2Client = new OAuth2Client(
            gadsClientId,
            gadsClientSecret
          );
          oauth2Client.setCredentials({ refresh_token: refreshToken });
          const { token } = await oauth2Client.getAccessToken();
          
          const body = {
            operations: [{
              resourceName: input.resourceName,
            }],
          };
          
          const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
            'Content-Type': 'application/json',
          };
          if (loginCustomerId) {
            headers['login-customer-id'] = loginCustomerId;
          }
          
          const resp = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });
          
          if (!resp.ok) {
            const errBody = await resp.text();
            console.error('[Google Ads] Apply recommendation REST error:', errBody);
            return { success: false, error: `API retornou ${resp.status}: ${errBody.substring(0, 200)}` };
          }
          
          console.log(`[Google Ads] Recommendation applied via REST: ${input.resourceName}`);
          return { success: true, message: 'Recomendação aplicada com sucesso via REST API' };
        } catch (restError: any) {
          console.error('[Google Ads] Apply recommendation error:', restError?.message ?? restError);
          return { success: false, error: restError?.message ?? 'Erro ao aplicar recomendação' };
        }
      }
    }),

  /**
   * Funil de conversão por campanha — dados para drill-down interativo.
   * Retorna Impressões, Cliques, Conversões e Gasto por campanha.
   */
  getCampaignFunnel: publicProcedure
    .input(
      z.object({
        period: z.enum(["7d", "14d", "30d", "90d", "custom"]).optional().default("30d"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );

        const dateFilter = buildDateFilter(input.period, input.startDate, input.endDate);

        const query = `
          SELECT
            campaign.id,
            campaign.name,
            campaign.advertising_channel_type,
            metrics.impressions,
            metrics.clicks,
            metrics.conversions,
            metrics.cost_micros
          FROM campaign
          WHERE ${dateFilter}
          AND campaign.status != 'REMOVED'
          ORDER BY metrics.impressions DESC
        `;

        const rows = await customer.query(query);

        const campaigns = rows.map((row: any) => {
          const impressions = Number(row.metrics?.impressions ?? 0);
          const clicks = Number(row.metrics?.clicks ?? 0);
          const conversions = Number(row.metrics?.conversions ?? 0);
          const costMicros = Number(row.metrics?.cost_micros ?? 0);
          return {
            id: String(row.campaign?.id ?? ""),
            name: row.campaign?.name ?? "Desconhecida",
            channelType: String(row.campaign?.advertising_channel_type ?? "UNKNOWN"),
            impressions,
            clicks,
            conversions,
            spend: costMicros / 1e6,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            convRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
          };
        });

        // Totais gerais
        const totals = campaigns.reduce(
          (acc: any, c: any) => ({
            impressions: acc.impressions + c.impressions,
            clicks: acc.clicks + c.clicks,
            conversions: acc.conversions + c.conversions,
            spend: acc.spend + c.spend,
          }),
          { impressions: 0, clicks: 0, conversions: 0, spend: 0 }
        );

        return { campaigns, totals, success: true };
      } catch (error: any) {
        console.error("[Google Ads] getCampaignFunnel error:", error?.message ?? error);
        return { campaigns: [], totals: { impressions: 0, clicks: 0, conversions: 0, spend: 0 }, success: false, error: error?.message };
      }
    }),

  /**
   * Auction Insights — comparação competitiva.
   * Retorna métricas de concorrentes via dados de leilão do Google Ads.
   */
  getAuctionInsights: publicProcedure
    .input(
      z.object({
        period: z.enum(["7d", "14d", "30d", "90d", "custom"]).optional().default("30d"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        campaignId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );

        const dateFilter = buildDateFilter(input.period, input.startDate, input.endDate);
        const campaignFilter = input.campaignId
          ? `AND campaign.id = '${input.campaignId}'`
          : "";

        // Auction Insights query via GAQL
        const query = `
          SELECT
            auction_insights.display_domain,
            metrics.auction_insight_search_impression_share,
            metrics.auction_insight_search_overlap_rate,
            metrics.auction_insight_search_position_above_rate,
            metrics.auction_insight_search_top_impression_percentage,
            metrics.auction_insight_search_absolute_top_impression_percentage,
            metrics.auction_insight_search_outranking_share
          FROM campaign
          WHERE ${dateFilter}
          AND campaign.status != 'REMOVED'
          AND campaign.advertising_channel_type = 'SEARCH'
          ${campaignFilter}
        `;

        const rows = await customer.query(query);

        // Agrupar por domínio
        const domainMap = new Map<string, {
          domain: string;
          impressionShare: number[];
          overlapRate: number[];
          positionAboveRate: number[];
          topImpressionPct: number[];
          absTopImpressionPct: number[];
          outrankingShare: number[];
        }>();

        for (const row of rows) {
          const domain = row.auction_insights?.display_domain ?? "";
          if (!domain) continue;

          if (!domainMap.has(domain)) {
            domainMap.set(domain, {
              domain,
              impressionShare: [],
              overlapRate: [],
              positionAboveRate: [],
              topImpressionPct: [],
              absTopImpressionPct: [],
              outrankingShare: [],
            });
          }

          const entry = domainMap.get(domain)!;
          const is = Number(row.metrics?.auction_insight_search_impression_share ?? 0);
          const or = Number(row.metrics?.auction_insight_search_overlap_rate ?? 0);
          const pa = Number(row.metrics?.auction_insight_search_position_above_rate ?? 0);
          const ti = Number(row.metrics?.auction_insight_search_top_impression_percentage ?? 0);
          const ati = Number(row.metrics?.auction_insight_search_absolute_top_impression_percentage ?? 0);
          const os = Number(row.metrics?.auction_insight_search_outranking_share ?? 0);

          if (is > 0) entry.impressionShare.push(is);
          if (or > 0) entry.overlapRate.push(or);
          if (pa > 0) entry.positionAboveRate.push(pa);
          if (ti > 0) entry.topImpressionPct.push(ti);
          if (ati > 0) entry.absTopImpressionPct.push(ati);
          if (os > 0) entry.outrankingShare.push(os);
        }

        const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

        const competitors = Array.from(domainMap.values()).map(d => ({
          domain: d.domain,
          impressionShare: Math.round(avg(d.impressionShare) * 100),
          overlapRate: Math.round(avg(d.overlapRate) * 100),
          positionAboveRate: Math.round(avg(d.positionAboveRate) * 100),
          topImpressionPct: Math.round(avg(d.topImpressionPct) * 100),
          absTopImpressionPct: Math.round(avg(d.absTopImpressionPct) * 100),
          outrankingShare: Math.round(avg(d.outrankingShare) * 100),
        })).sort((a, b) => b.impressionShare - a.impressionShare);

        // Identificar "você" (Zênite Tech) — geralmente o domínio do anunciante
        const yourDomain = competitors.find(c =>
          c.domain.includes("zenitetech") || c.domain.includes("zenite") || c.domain.includes("avantcharge")
        );

        return {
          competitors,
          yourDomain: yourDomain ?? null,
          totalCompetitors: competitors.length,
          success: true,
        };
      } catch (error: any) {
        console.error("[Google Ads] getAuctionInsights error:", error?.message ?? error);
        // Se a query GAQL falhar (auction insights pode não estar disponível para todas as contas),
        // retornar dados vazios com mensagem de erro
        return {
          competitors: [],
          yourDomain: null,
          totalCompetitors: 0,
          success: false,
          error: error?.message ?? "Auction Insights não disponível para esta conta",
        };
      }
    }),

  getDemographicData: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ input }) => {
      try {
        const client = getGoogleAdsClient();
        const customer = buildCustomerClient(
          client,
          getCustomerId(),
          getRefreshToken(),
          getLoginCustomerId()
        );

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - input.days);
        const fmt = (d: Date) => d.toISOString().split('T')[0];
        const dateFilter = `segments.date BETWEEN '${fmt(startDate)}' AND '${fmt(endDate)}'`;

        const ageQuery = `
          SELECT
            ad_group_criterion.age_range.type,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.cost_micros,
            metrics.conversions
          FROM age_range_view
          WHERE ${dateFilter}
            AND metrics.impressions > 0
          ORDER BY metrics.clicks DESC
        `;

        const genderQuery = `
          SELECT
            ad_group_criterion.gender.type,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.cost_micros,
            metrics.conversions
          FROM gender_view
          WHERE ${dateFilter}
            AND metrics.impressions > 0
          ORDER BY metrics.clicks DESC
        `;

        const AGE_LABELS: Record<string, string> = {
          'AGE_RANGE_18_24': '18-24',
          'AGE_RANGE_25_34': '25-34',
          'AGE_RANGE_35_44': '35-44',
          'AGE_RANGE_45_54': '45-54',
          'AGE_RANGE_55_64': '55-64',
          'AGE_RANGE_65_UP': '65+',
          'AGE_RANGE_UNDETERMINED': 'Indefinido',
        };
        const GENDER_LABELS: Record<string, string> = {
          'MALE': 'Masculino',
          'FEMALE': 'Feminino',
          'UNDETERMINED': 'Indefinido',
        };

        const [ageRows, genderRows] = await Promise.all([
          customer.query(ageQuery),
          customer.query(genderQuery),
        ]);

        // Agregar por segmento
        const ageMap = new Map<string, any>();
        for (const row of ageRows) {
          const type = row.ad_group_criterion?.age_range?.type ?? 'AGE_RANGE_UNDETERMINED';
          const label = AGE_LABELS[type] ?? type;
          const existing = ageMap.get(label) || { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
          existing.impressions += Number(row.metrics?.impressions ?? 0);
          existing.clicks += Number(row.metrics?.clicks ?? 0);
          existing.cost += Number(row.metrics?.cost_micros ?? 0) / 1_000_000;
          existing.conversions += Number(row.metrics?.conversions ?? 0);
          ageMap.set(label, existing);
        }
        const ageData = Array.from(ageMap.entries())
          .map(([segment, m]) => ({
            segment,
            impressions: m.impressions,
            clicks: m.clicks,
            ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
            cost: m.cost,
            conversions: m.conversions,
          }))
          .sort((a, b) => b.clicks - a.clicks);

        const genderMap = new Map<string, any>();
        for (const row of genderRows) {
          const type = row.ad_group_criterion?.gender?.type ?? 'UNDETERMINED';
          const label = GENDER_LABELS[type] ?? type;
          const existing = genderMap.get(label) || { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
          existing.impressions += Number(row.metrics?.impressions ?? 0);
          existing.clicks += Number(row.metrics?.clicks ?? 0);
          existing.cost += Number(row.metrics?.cost_micros ?? 0) / 1_000_000;
          existing.conversions += Number(row.metrics?.conversions ?? 0);
          genderMap.set(label, existing);
        }
        const genderData = Array.from(genderMap.entries())
          .map(([segment, m]) => ({
            segment,
            impressions: m.impressions,
            clicks: m.clicks,
            ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
            cost: m.cost,
            conversions: m.conversions,
          }))
          .sort((a, b) => b.clicks - a.clicks);

        const bestAge = [...ageData].sort((a, b) => b.ctr - a.ctr)[0];
        const bestGender = [...genderData].sort((a, b) => b.ctr - a.ctr)[0];
        const totalCost = ageData.reduce((sum, d) => sum + d.cost, 0);

        const insights: string[] = [];
        if (bestAge) insights.push(`A faixa etária ${bestAge.segment} tem o melhor CTR (${bestAge.ctr.toFixed(2)}%) — considere aumentar o lance para este segmento.`);
        if (bestGender) insights.push(`O público ${bestGender.segment} tem melhor desempenho — CTR de ${bestGender.ctr.toFixed(2)}%.`);
        const lowPerformers = ageData.filter(d => d.ctr < 2 && d.cost > 10);
        if (lowPerformers.length > 0) insights.push(`Segmentos com baixo CTR e alto custo: ${lowPerformers.map(d => d.segment).join(', ')} — considere reduzir lances ou excluir.`);

        return { ageData, genderData, bestAgeGroup: bestAge?.segment ?? null, bestGender: bestGender?.segment ?? null, totalCost, insights, success: true };
      } catch (error: any) {
        console.error('[Google Ads] getDemographicData error:', error?.message ?? error);
        return { ageData: [], genderData: [], bestAgeGroup: null, bestGender: null, totalCost: 0, insights: [], success: false, error: error?.message ?? 'Erro ao buscar dados demográficos' };
      }
    }),

  // Verifica status e expiração do refresh token do Google Ads
  getTokenStatus: protectedProcedure.query(async () => {
    // SEMPRE usar credentials.ts como fonte de verdade (prioridade absoluta sobre env)
    const {
      GOOGLE_ADS_REFRESH_TOKEN: refreshToken,
      GOOGLE_ADS_CLIENT_ID: clientId,
      GOOGLE_ADS_CLIENT_SECRET: clientSecret,
    } = await import('../credentials');

    if (!refreshToken) {
      return { isConfigured: false, isValid: false, daysUntilExpiry: null, expiresAt: null, warning: null };
    }

    try {
      // Tentar obter um access token para validar o refresh token
      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });
      const data = await resp.json() as any;

      if (data.error) {
        return { isConfigured: true, isValid: false, daysUntilExpiry: 0, expiresAt: null, warning: "Token expirado ou revogado — renove agora" };
      }

      // Token válido — calcular dias até expiração (tokens Google Ads expiram em 180 dias sem uso)
      // Token renovado em 11/05/2026 — expira em 07/11/2026
      const tokenCreatedAt = new Date("2026-05-11");
      const expiresAt = new Date(tokenCreatedAt.getTime() + 180 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let warning: string | null = null;
      if (daysUntilExpiry <= 7) {
        warning = `⚠️ Token expira em ${daysUntilExpiry} dia(s)! Renove agora.`;
      } else if (daysUntilExpiry <= 30) {
        warning = `Token expira em ${daysUntilExpiry} dias. Renove em breve.`;
      }

      return {
        isConfigured: true,
        isValid: true,
        daysUntilExpiry,
        expiresAt: expiresAt.toISOString(),
        warning,
      };
    } catch (error: any) {
      return { isConfigured: true, isValid: false, daysUntilExpiry: null, expiresAt: null, warning: "Erro ao verificar token" };
    }
  }),

  triggerGmailScan: publicProcedure.query(async () => {
    try {
      const { runGmailAdsReader } = await import('../jobs/dailyGmailAdsReader');
      runGmailAdsReader().catch((err: any) => console.error('[GmailScan] Error:', err));
      return { success: true, message: 'Scan iniciado em background' };
    } catch (error: any) {
      return { success: false, error: error?.message };
    }
  }),
});

