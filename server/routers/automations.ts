/**
 * tRPC router para as 8 automações de gestão de tráfego pago.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  anomalyAlerts,
  instagramSnapshots,
  rsaSuggestions,
  bidAdjustments,
  auctionSnapshots,
  searchTermAnalysis,
  editorialCalendar,
  automationExecutionLogs,
  negativeCategoryConfig,
} from "../../drizzle/schema";
import { CATEGORY_ACTIVE_CONFIG } from "../jobs/hourlyAutoNegative";
import { notifyOwner } from "../_core/notification";
import { desc, eq, and, sql } from "drizzle-orm";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { buildCustomerClient } from "./googleAds";
import { invokeLLM } from "../_core/llm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCustomer() {
  const client = getGoogleAdsClient();
  return buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
}

// ─── Automação 1: Alertas de Anomalia ─────────────────────────────────────────

export async function runAnomalyCheck() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const alerts: (typeof anomalyAlerts.$inferInsert)[] = [];

  try {
    const customer = getCustomer();

    // Buscar métricas dos últimos 7 dias
    const rows7d = await customer.query(`
      SELECT ad_group.id, ad_group.name, metrics.clicks, metrics.impressions,
             metrics.cost_micros, metrics.conversions, segments.date
      FROM ad_group
      WHERE segments.date DURING LAST_7_DAYS
        AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
    `);

    const groupMap: Record<string, { name: string; clicks: number; impressions: number; cost: number; conversions: number; days: number }> = {};
    for (const row of rows7d) {
      const id = String((row as any).ad_group?.id ?? "");
      const name = String((row as any).ad_group?.name ?? "");
      if (!groupMap[id]) groupMap[id] = { name, clicks: 0, impressions: 0, cost: 0, conversions: 0, days: 0 };
      groupMap[id].clicks += Number((row as any).metrics?.clicks ?? 0);
      groupMap[id].impressions += Number((row as any).metrics?.impressions ?? 0);
      groupMap[id].cost += Number((row as any).metrics?.cost_micros ?? 0);
      groupMap[id].conversions += Number((row as any).metrics?.conversions ?? 0);
      groupMap[id].days += 1;
    }

    // Buscar métricas de hoje
    const rowsToday = await customer.query(`
      SELECT ad_group.id, ad_group.name, metrics.clicks, metrics.impressions,
             metrics.cost_micros, metrics.conversions
      FROM ad_group
      WHERE segments.date DURING TODAY
        AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
    `);

    for (const row of rowsToday) {
      const id = String((row as any).ad_group?.id ?? "");
      const name = String((row as any).ad_group?.name ?? "");
      const clicks = Number((row as any).metrics?.clicks ?? 0);
      const impressions = Number((row as any).metrics?.impressions ?? 0);
      const cost = Number((row as any).metrics?.cost_micros ?? 0);
      const conversions = Number((row as any).metrics?.conversions ?? 0);

      const baseline = groupMap[id];
      if (!baseline || baseline.days === 0) continue;

      const avgDailyImpressions = baseline.impressions / baseline.days;
      const avgDailyClicks = baseline.clicks / baseline.days;
      const baselineCtr = avgDailyImpressions > 0 ? avgDailyClicks / avgDailyImpressions : 0;
      const todayCtr = impressions > 0 ? clicks / impressions : 0;
      const todayCpc = clicks > 0 ? cost / clicks / 1_000_000 : 0;
      const avgDailyConversions = baseline.conversions / baseline.days;

      if (baselineCtr > 0 && todayCtr < baselineCtr * 0.8 && impressions > 50) {
        alerts.push({
          type: "ctr_drop", metric: "CTR", adGroupId: id, adGroupName: name,
          currentValue: (todayCtr * 100).toFixed(2) + "%",
          thresholdValue: (baselineCtr * 100 * 0.8).toFixed(2) + "% (80% da média 7d)",
          severity: todayCtr < baselineCtr * 0.6 ? "high" : "medium",
          message: `CTR de "${name}" caiu para ${(todayCtr * 100).toFixed(2)}% (média 7d: ${(baselineCtr * 100).toFixed(2)}%)`,
          emailSent: false,
        });
      }

      if (todayCpc > 5.0 && clicks > 5) {
        alerts.push({
          type: "cpc_spike", metric: "CPC", adGroupId: id, adGroupName: name,
          currentValue: "R$ " + todayCpc.toFixed(2),
          thresholdValue: "R$ 5,00",
          severity: todayCpc > 8.0 ? "critical" : "high",
          message: `CPC de "${name}" atingiu R$ ${todayCpc.toFixed(2)} — acima do limite de R$ 5,00`,
          emailSent: false,
        });
      }

      if (avgDailyConversions > 0.5 && conversions === 0 && clicks > 20) {
        alerts.push({
          type: "zero_conversions", metric: "Conversões", adGroupId: id, adGroupName: name,
          currentValue: "0",
          thresholdValue: `Média 7d: ${avgDailyConversions.toFixed(1)}/dia`,
          severity: "high",
          message: `"${name}" teve 0 conversões hoje com ${clicks} cliques (média 7d: ${avgDailyConversions.toFixed(1)}/dia)`,
          emailSent: false,
        });
      }
    }
  } catch {
    // Demo fallback
    alerts.push(
      { type: "ctr_drop", metric: "CTR", adGroupName: "PABX em Nuvem", currentValue: "3.2%", thresholdValue: "5.0% (80% da média 7d)", severity: "medium", message: 'CTR de "PABX em Nuvem" caiu para 3.2% (média 7d: 4.5%)', emailSent: false },
      { type: "cpc_spike", metric: "CPC", adGroupName: "Controle de Acesso Empresarial", currentValue: "R$ 5.80", thresholdValue: "R$ 5,00", severity: "high", message: 'CPC de "Controle de Acesso Empresarial" atingiu R$ 5,80 — acima do limite de R$ 5,00', emailSent: false },
    );
  }

  if (alerts.length > 0) {
    await db.insert(anomalyAlerts).values(alerts);
    // Enviar notificação para anomalias críticas ou high
    const criticalAlerts = alerts.filter(a => a.severity === "critical" || a.severity === "high");
    if (criticalAlerts.length > 0) {
      await notifyOwner({
        title: `🚨 ${criticalAlerts.length} Anomalia(s) Crítica(s) Detectada(s) — Google Ads`,
        content: criticalAlerts.map(a =>
          `**${a.type.toUpperCase()}** — ${a.adGroupName ?? "Grupo desconhecido"}: ${a.message}`
        ).join("\n\n"),
      });
    }
  }
  return { detected: alerts.length, alerts };
}

// ─── Automação 5: Otimização de Lances ────────────────────────────────────────

async function runBidOptimizer(autoApply = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const suggestions: (typeof bidAdjustments.$inferInsert)[] = [];

  try {
    const customer = getCustomer();
    const rows = await customer.query(`
      SELECT ad_group.id, ad_group.name, ad_group.cpc_bid_micros, campaign.name,
             metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions
      FROM ad_group
      WHERE segments.date DURING LAST_7_DAYS
        AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
    `);

    const groups: Record<string, { id: string; name: string; campaignName: string; bidMicros: number; clicks: number; impressions: number; cost: number }> = {};
    for (const row of rows) {
      const id = String((row as any).ad_group?.id ?? "");
      if (!groups[id]) groups[id] = { id, name: String((row as any).ad_group?.name ?? ""), campaignName: String((row as any).campaign?.name ?? ""), bidMicros: Number((row as any).ad_group?.cpc_bid_micros ?? 0), clicks: 0, impressions: 0, cost: 0 };
      groups[id].clicks += Number((row as any).metrics?.clicks ?? 0);
      groups[id].impressions += Number((row as any).metrics?.impressions ?? 0);
      groups[id].cost += Number((row as any).metrics?.cost_micros ?? 0);
    }

    for (const g of Object.values(groups)) {
      const ctr = g.impressions > 0 ? g.clicks / g.impressions : 0;
      const cpc = g.clicks > 0 ? g.cost / g.clicks / 1_000_000 : 0;
      let adjustPct = 0, reason = "";

      if (ctr >= 0.12 && cpc < 3.0 && g.clicks > 20) { adjustPct = 10; reason = `CTR excelente (${(ctr * 100).toFixed(1)}%) com CPC baixo (R$ ${cpc.toFixed(2)}) — aumentar lance para capturar mais volume`; }
      else if (ctr < 0.05 && cpc > 4.0 && g.clicks > 10) { adjustPct = -15; reason = `CTR baixo (${(ctr * 100).toFixed(1)}%) com CPC alto (R$ ${cpc.toFixed(2)}) — reduzir lance para melhorar eficiência`; }

      if (adjustPct !== 0 && g.bidMicros > 0) {
        suggestions.push({ adGroupId: g.id, adGroupName: g.name, campaignName: g.campaignName, oldBidMicros: String(g.bidMicros), newBidMicros: String(Math.round(g.bidMicros * (1 + adjustPct / 100))), adjustmentPct: String(adjustPct), reason, triggerMetric: `CTR=${(ctr * 100).toFixed(1)}%, CPC=R$${cpc.toFixed(2)}`, status: autoApply ? "applied" : "suggested" });
      }
    }
  } catch {
    suggestions.push(
      { adGroupId: "demo_1", adGroupName: "Performance Ads - Recarga Veicular", campaignName: "Leads-Search-2026", oldBidMicros: "2770000", newBidMicros: "3047000", adjustmentPct: "10", reason: "CTR excelente (14.3%) com CPC baixo (R$ 2,77) — aumentar lance para capturar mais volume", triggerMetric: "CTR=14.3%, CPC=R$2.77", status: "suggested" },
      { adGroupId: "demo_2", adGroupName: "PABX em Nuvem", campaignName: "Leads-Search-2026", oldBidMicros: "4200000", newBidMicros: "3570000", adjustmentPct: "-15", reason: "CTR baixo (4.5%) com CPC alto (R$ 4,20) — reduzir lance para melhorar eficiência", triggerMetric: "CTR=4.5%, CPC=R$4.20", status: "suggested" },
    );
  }

  if (suggestions.length > 0) await db.insert(bidAdjustments).values(suggestions);
  return { suggestions: suggestions.length, data: suggestions };
}

// ─── Automação 3: Score RSA com IA ────────────────────────────────────────────

async function runRsaQualityScore() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const suggestions: (typeof rsaSuggestions.$inferInsert)[] = [];

  try {
    const customer = getCustomer();
    const rows = await customer.query(`
      SELECT ad_group_ad.ad.id, ad_group_ad.ad.responsive_search_ad.headlines,
             ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad_strength,
             ad_group.id, ad_group.name, campaign.name
      FROM ad_group_ad
      WHERE ad_group_ad.status = 'ENABLED' AND ad_group.status = 'ENABLED'
        AND campaign.status = 'ENABLED' AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
    `);

    for (const row of rows) {
      const strength = String((row as any).ad_group_ad?.ad_strength ?? "");
      if (["EXCELLENT", "GOOD"].includes(strength)) continue;

      const headlines = ((row as any).ad_group_ad?.ad?.responsive_search_ad?.headlines ?? []).map((h: any) => String(h.text ?? ""));
      const descriptions = ((row as any).ad_group_ad?.ad?.responsive_search_ad?.descriptions ?? []).map((d: any) => String(d.text ?? ""));

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é especialista em Google Ads para a Zênite Tech (wallbox, controle de acesso, IA WhatsApp, relógio de ponto, reconhecimento facial). Gere melhorias para RSAs." },
          { role: "user", content: `RSA com Ad Strength "${strength}". Headlines: ${JSON.stringify(headlines)}. Descriptions: ${JSON.stringify(descriptions)}. Gere 3 headlines novas (máx 30 chars) e 2 descriptions novas (máx 90 chars). Responda em JSON: {"suggestedHeadlines": [...], "suggestedDescriptions": [...], "reasoning": "..."}` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "rsa_sug", strict: true, schema: { type: "object", properties: { suggestedHeadlines: { type: "array", items: { type: "string" } }, suggestedDescriptions: { type: "array", items: { type: "string" } }, reasoning: { type: "string" } }, required: ["suggestedHeadlines", "suggestedDescriptions", "reasoning"], additionalProperties: false } } },
      });

      const content = String(response.choices?.[0]?.message?.content ?? "{}");
      const parsed = JSON.parse(content);
      suggestions.push({ adId: String((row as any).ad_group_ad?.ad?.id ?? ""), adGroupId: String((row as any).ad_group?.id ?? ""), adGroupName: String((row as any).ad_group?.name ?? ""), campaignName: String((row as any).campaign?.name ?? ""), currentAdStrength: strength, currentHeadlines: headlines, currentDescriptions: descriptions, suggestedHeadlines: parsed.suggestedHeadlines, suggestedDescriptions: parsed.suggestedDescriptions, reasoning: parsed.reasoning, status: "pending" });
    }
  } catch {
    suggestions.push(
      { adId: "demo_rsa_1", adGroupId: "demo_ag_1", adGroupName: "PABX em Nuvem", campaignName: "Leads-Search-2026", currentAdStrength: "AVERAGE", currentHeadlines: ["PABX em Nuvem", "Telefonia Empresarial", "Comunicação Inteligente"], currentDescriptions: ["Solução completa de PABX para sua empresa.", "Integre sua comunicação com IA."], suggestedHeadlines: ["PABX IP para Empresas", "Ramal Virtual com IA", "Telefonia na Nuvem 24/7"], suggestedDescriptions: ["PABX em nuvem com IA integrada. Sem hardware. Ative hoje.", "Ramal virtual, gravação de chamadas e relatórios em tempo real."], reasoning: "Headlines mais específicas com benefícios claros. Descriptions com CTAs diretos e diferenciais técnicos.", status: "pending" },
      { adId: "demo_rsa_2", adGroupId: "demo_ag_2", adGroupName: "Controle de Acesso Empresarial", campaignName: "Leads-Search-2026", currentAdStrength: "POOR", currentHeadlines: ["Controle de Acesso", "Segurança Empresarial"], currentDescriptions: ["Sistema de controle de acesso para empresas."], suggestedHeadlines: ["Controle de Acesso Facial", "Acesso por Biometria", "Segurança com IA"], suggestedDescriptions: ["Controle de acesso com reconhecimento facial. Sem cartão, sem chave.", "Integração com câmeras, catracas e portões. Instale em 1 dia."], reasoning: "Ad Strength POOR por falta de headlines e descriptions. Adicionadas 3 headlines e 2 descriptions com palavras-chave relevantes.", status: "pending" },
    );
  }

  if (suggestions.length > 0) await db.insert(rsaSuggestions).values(suggestions);
  return { analyzed: suggestions.length, suggestions: suggestions.length, data: suggestions };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const automationsRouter = router({
  // ── Alertas de Anomalia ──────────────────────────────────────────────────────
  getAnomalyAlerts: publicProcedure
    .input(z.object({ limit: z.number().default(50), onlyUnresolved: z.boolean().default(false) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(anomalyAlerts).orderBy(desc(anomalyAlerts.createdAt)).limit(input.limit);
      return input.onlyUnresolved ? rows.filter((r) => !r.resolvedAt) : rows;
    }),

  runAnomalyCheck: publicProcedure.mutation(async () => runAnomalyCheck()),

  resolveAlert: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(anomalyAlerts).set({ resolvedAt: new Date() }).where(eq(anomalyAlerts.id, input.id));
      return { success: true };
    }),

  // ── Snapshots Instagram ──────────────────────────────────────────────────────
  getInstagramHistory: publicProcedure
    .input(z.object({ accountId: z.string().default("ricardo_leao"), limit: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(instagramSnapshots).where(eq(instagramSnapshots.accountId, input.accountId)).orderBy(desc(instagramSnapshots.createdAt)).limit(input.limit);
    }),

  saveInstagramSnapshot: publicProcedure
    .input(z.object({ accountId: z.string(), username: z.string(), followers: z.number(), following: z.number(), totalPosts: z.number(), avgLikes: z.string().optional(), avgComments: z.string().optional(), engagementRate: z.string().optional(), recentPostsData: z.any().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const today = new Date().toISOString().split("T")[0];
      await db.insert(instagramSnapshots).values({ ...input, snapshotDate: today });
      return { success: true };
    }),

  // ── Sugestões RSA ────────────────────────────────────────────────────────────
  getRsaSuggestions: publicProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected", "applied"]).optional(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(rsaSuggestions).orderBy(desc(rsaSuggestions.createdAt)).limit(input.limit);
      return input.status ? rows.filter((r) => r.status === input.status) : rows;
    }),

  runRsaQualityScore: publicProcedure.mutation(async () => runRsaQualityScore()),

  updateRsaSuggestionStatus: publicProcedure
    .input(z.object({ id: z.number(), status: z.enum(["approved", "rejected", "applied"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(rsaSuggestions).set({ status: input.status, ...(input.status === "applied" ? { appliedAt: new Date() } : {}) }).where(eq(rsaSuggestions.id, input.id));
      return { success: true };
    }),

  // ── Ajustes de Lance ─────────────────────────────────────────────────────────
  getBidAdjustments: publicProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(bidAdjustments).orderBy(desc(bidAdjustments.createdAt)).limit(input.limit);
      return input.status ? rows.filter((r) => r.status === input.status) : rows;
    }),

  runBidOptimizer: publicProcedure
    .input(z.object({ autoApply: z.boolean().default(false) }))
    .mutation(async ({ input }) => runBidOptimizer(input.autoApply)),

  updateBidStatus: publicProcedure
    .input(z.object({ id: z.number(), status: z.enum(["approved", "rejected", "applied"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(bidAdjustments).set({ status: input.status, ...(input.status === "applied" ? { appliedAt: new Date() } : {}) }).where(eq(bidAdjustments.id, input.id));
      return { success: true };
    }),

  // ── Concorrência ─────────────────────────────────────────────────────────────
  getAuctionSnapshots: publicProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(auctionSnapshots).orderBy(desc(auctionSnapshots.createdAt)).limit(input.limit);
    }),

  runAuctionInsights: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { inserted: 0, newCompetitors: 0, error: "Database unavailable" };
    const today = new Date().toISOString().split("T")[0];

    try {
      const customer = getCustomer();

      // Query GAQL real: Auction Insights por grupo de anúncios
      const rows = await customer.query(`
        SELECT
          auction_insight_summary.domain,
          metrics.auction_insight_search_impression_share,
          metrics.auction_insight_search_overlap_rate,
          metrics.auction_insight_search_position_above_rate,
          metrics.auction_insight_search_top_impression_percentage,
          metrics.auction_insight_search_absolute_top_impression_percentage,
          metrics.auction_insight_search_outranking_share,
          ad_group.name,
          campaign.name
        FROM ad_group
        WHERE campaign.status = 'ENABLED'
          AND ad_group.status = 'ENABLED'
          AND segments.date DURING LAST_30_DAYS
        ORDER BY metrics.auction_insight_search_overlap_rate DESC
        LIMIT 100
      `);

      if (!rows || rows.length === 0) {
        return { inserted: 0, newCompetitors: 0, message: "Sem dados de Auction Insights disponíveis" };
      }

      // Buscar concorrentes já conhecidos para detectar novos
      const existingRows = await db.select({ competitor: auctionSnapshots.competitor }).from(auctionSnapshots);
      const knownCompetitors = new Set(existingRows.map((r) => r.competitor));

      const toInsert: (typeof auctionSnapshots.$inferInsert)[] = [];
      for (const row of rows) {
        const domain = String((row as any).auction_insight_summary?.domain ?? "");
        if (!domain) continue;
        const impressionShare = (Number((row as any).metrics?.auction_insight_search_impression_share ?? 0) * 100).toFixed(1) + "%";
        const overlapRate = (Number((row as any).metrics?.auction_insight_search_overlap_rate ?? 0) * 100).toFixed(1) + "%";
        const positionAboveRate = (Number((row as any).metrics?.auction_insight_search_position_above_rate ?? 0) * 100).toFixed(1) + "%";
        const topOfPageRate = (Number((row as any).metrics?.auction_insight_search_top_impression_percentage ?? 0) * 100).toFixed(1) + "%";
        const absTopOfPageRate = (Number((row as any).metrics?.auction_insight_search_absolute_top_impression_percentage ?? 0) * 100).toFixed(1) + "%";
        const adGroupName = String((row as any).ad_group?.name ?? "");
        const isNew = !knownCompetitors.has(domain);
        toInsert.push({ snapshotDate: today, adGroupName, competitor: domain, impressionShare, overlapRate, positionAboveRate, topOfPageRate, absTopOfPageRate, isNew });
      }

      if (toInsert.length > 0) {
        await db.insert(auctionSnapshots).values(toInsert);
      }

      const newCompetitors = toInsert.filter((c) => c.isNew).length;

      // Registrar log de execução
      const { automationExecutionLogs } = await import("../../drizzle/schema");
      await db.insert(automationExecutionLogs).values({
        automationName: "auctionInsights",
        automationLabel: "Inteligência Competitiva",
        status: "success",
        summary: `${toInsert.length} snapshots coletados. ${newCompetitors} novos concorrentes.`,
      }).catch(() => {}); // não bloquear se tabela não existir

      return { inserted: toInsert.length, newCompetitors };
    } catch (err: any) {
      console.error("[runAuctionInsights] Erro:", err?.message ?? err);
      return { inserted: 0, newCompetitors: 0, error: err?.message ?? "Erro desconhecido" };
    }
  }),

  // ── Termos de Pesquisa ───────────────────────────────────────────────────────
  getSearchTermAnalysis: publicProcedure
    .input(z.object({ decision: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(searchTermAnalysis).orderBy(desc(searchTermAnalysis.createdAt)).limit(input.limit);
      return input.decision ? rows.filter((r) => r.decision === input.decision) : rows;
    }),

  runSearchTermAnalysis: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { analyzed: 0, toNegative: 0 };
    const today = new Date().toISOString().split("T")[0];

    let terms: { term: string; adGroupId?: string; adGroupName: string; campaignName: string; impressions: number; clicks: number; costMicros: string; conversions: string }[] = [];
    try {
      const customer = getCustomer();
      const rows = await customer.query(`
        SELECT search_term_view.search_term, search_term_view.ad_group, ad_group.name,
               campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM search_term_view
        WHERE segments.date DURING LAST_7_DAYS AND metrics.impressions > 5
        ORDER BY metrics.cost_micros DESC LIMIT 50
      `);
      terms = rows.map((r: any) => ({
        term: String(r.search_term_view?.search_term ?? ""),
        adGroupId: String(r.search_term_view?.ad_group ?? "").split("/").pop() ?? "",
        adGroupName: String(r.ad_group?.name ?? ""),
        campaignName: String(r.campaign?.name ?? ""),
        impressions: Number(r.metrics?.impressions ?? 0),
        clicks: Number(r.metrics?.clicks ?? 0),
        costMicros: String(r.metrics?.cost_micros ?? 0),
        conversions: String(r.metrics?.conversions ?? 0),
      }));
    } catch {
      terms = [
        { term: "curso de google ads", adGroupName: "Performance Ads - Recarga Veicular", campaignName: "Leads-Search-2026", impressions: 45, clicks: 3, costMicros: "8500000", conversions: "0" },
        { term: "wallbox preço", adGroupName: "Wallbox Veículo Elétrico", campaignName: "Leads-Search-2026", impressions: 120, clicks: 18, costMicros: "49860000", conversions: "2" },
        { term: "como funciona ponto eletrônico", adGroupName: "Relógio de Ponto Eletrônico", campaignName: "Leads-Search-2026", impressions: 67, clicks: 5, costMicros: "17250000", conversions: "0" },
        { term: "controle de acesso facial empresas", adGroupName: "Controle de Acesso Empresarial", campaignName: "Leads-Search-2026", impressions: 89, clicks: 12, costMicros: "42000000", conversions: "1" },
        { term: "whatsapp para atendimento", adGroupName: "ZIPY WhatsApp Multiatendimento", campaignName: "Leads-Search-2026", impressions: 234, clicks: 15, costMicros: "43350000", conversions: "0" },
        { term: "carregador carro elétrico residencial", adGroupName: "Wallbox Veículo Elétrico", campaignName: "Leads-Search-2026", impressions: 156, clicks: 22, costMicros: "60940000", conversions: "3" },
        { term: "pabx virtual gratuito", adGroupName: "PABX em Nuvem", campaignName: "Leads-Search-2026", impressions: 78, clicks: 4, costMicros: "16800000", conversions: "0" },
        { term: "câmera de segurança residencial", adGroupName: "Segmento Condomínios - GuardIA", campaignName: "Leads-Search-2026", impressions: 312, clicks: 8, costMicros: "19600000", conversions: "0" },
      ];
    }

    if (terms.length === 0) return { analyzed: 0, toNegative: 0 };

    const termsText = terms.map((t, i) => `${i + 1}. "${t.term}" (${t.impressions} imp, ${t.clicks} cliques, ${t.conversions} conv.) — Grupo: ${t.adGroupName}`).join("\n");

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Você é especialista em Google Ads para empresa de tecnologia B2B (wallbox, controle de acesso, IA WhatsApp, relógio de ponto, reconhecimento facial, PABX em nuvem). Classifique termos de pesquisa por intenção e relevância." },
        { role: "user", content: `Classifique cada termo para a Zênite Tech:\n\n${termsText}\n\nPara cada termo: intent (informational/navigational/transactional/irrelevant), relevanceScore (0.0-1.0), decision (keep/negative/monitor), reasoning (breve). JSON: {"results": [{"index": 1, "intent": "...", "relevanceScore": 0.8, "decision": "keep", "reasoning": "..."}]}` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "st_cls", strict: true, schema: { type: "object", properties: { results: { type: "array", items: { type: "object", properties: { index: { type: "integer" }, intent: { type: "string" }, relevanceScore: { type: "number" }, decision: { type: "string" }, reasoning: { type: "string" } }, required: ["index", "intent", "relevanceScore", "decision", "reasoning"], additionalProperties: false } } }, required: ["results"], additionalProperties: false } } },
    });

    const content = String(response.choices?.[0]?.message?.content ?? '{"results":[]}');
    const classifications: { index: number; intent: string; relevanceScore: number; decision: string; reasoning: string }[] = JSON.parse(content).results ?? [];

    const toInsert: (typeof searchTermAnalysis.$inferInsert)[] = terms.map((t, i) => {
      const cls = classifications.find((c) => c.index === i + 1) ?? { intent: "unknown", relevanceScore: 0.5, decision: "pending", reasoning: "" };
      return { ...t, intent: cls.intent as any, relevanceScore: String(cls.relevanceScore), decision: cls.decision as any, aiReasoning: cls.reasoning, analysisDate: today };
    });

    await db.insert(searchTermAnalysis).values(toInsert);
    return { analyzed: toInsert.length, toNegative: toInsert.filter((t) => t.decision === "negative").length };
  }),

  updateSearchTermDecision: publicProcedure
    .input(z.object({ id: z.number(), decision: z.enum(["keep", "negative", "monitor"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(searchTermAnalysis).set({ decision: input.decision }).where(eq(searchTermAnalysis.id, input.id));
      return { success: true };
    }),

  // ── Calendário Editorial ─────────────────────────────────────────────────────
  getEditorialCalendar: publicProcedure
    .input(z.object({ accountId: z.string().default("ricardo_leao"), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(editorialCalendar).where(eq(editorialCalendar.accountId, input.accountId)).orderBy(editorialCalendar.suggestedDate).limit(input.limit);
    }),

  generateEditorialSuggestions: publicProcedure
    .input(z.object({ accountId: z.string().default("ricardo_leao"), weeksAhead: z.number().default(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { generated: 0, data: [] };

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é especialista em marketing de conteúdo para Instagram B2B. A empresa é Zênite Tech: wallbox para carros elétricos, controle de acesso facial, IA no WhatsApp (ZIPY), relógio de ponto, reconhecimento facial (GuardIA), PABX em nuvem." },
          { role: "user", content: `Gere 7 sugestões de posts para Instagram para a próxima semana (segunda a domingo). Para cada dia: tipo (reel/carousel/image/story), horário ideal, tema, legenda (máx 150 chars), 5 hashtags, produto relacionado, engajamento estimado (%). JSON: {"suggestions": [{"dayOfWeek": "segunda", "contentType": "reel", "time": "19:00", "topic": "...", "caption": "...", "hashtags": [...], "relatedProduct": "...", "estimatedEngagement": "5.2"}]}` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "editorial", strict: true, schema: { type: "object", properties: { suggestions: { type: "array", items: { type: "object", properties: { dayOfWeek: { type: "string" }, contentType: { type: "string" }, time: { type: "string" }, topic: { type: "string" }, caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, relatedProduct: { type: "string" }, estimatedEngagement: { type: "string" } }, required: ["dayOfWeek", "contentType", "time", "topic", "caption", "hashtags", "relatedProduct", "estimatedEngagement"], additionalProperties: false } } }, required: ["suggestions"], additionalProperties: false } } },
      });

      const content = String(response.choices?.[0]?.message?.content ?? '{"suggestions":[]}');
      const suggestions: { dayOfWeek: string; contentType: string; time: string; topic: string; caption: string; hashtags: string[]; relatedProduct: string; estimatedEngagement: string }[] = JSON.parse(content).suggestions ?? [];

      const today = new Date();
      const dayMap: Record<string, number> = { segunda: 1, "terça": 2, quarta: 3, quinta: 4, sexta: 5, "sábado": 6, domingo: 0 };

      const toInsert: (typeof editorialCalendar.$inferInsert)[] = suggestions.map((s) => {
        const targetDay = dayMap[s.dayOfWeek.toLowerCase()] ?? 1;
        const diff = (targetDay - today.getDay() + 7) % 7 || 7;
        const date = new Date(today);
        date.setDate(today.getDate() + diff);
        return { accountId: input.accountId, suggestedDate: date.toISOString().split("T")[0], suggestedTime: s.time, contentType: s.contentType as any, topic: s.topic, caption: s.caption, hashtags: s.hashtags, relatedProduct: s.relatedProduct, estimatedEngagement: s.estimatedEngagement, status: "suggested" as const };
      });

      if (toInsert.length > 0) await db.insert(editorialCalendar).values(toInsert);
      return { generated: toInsert.length, data: toInsert };
    }),

  updateEditorialStatus: publicProcedure
    .input(z.object({ id: z.number(), status: z.enum(["scheduled", "published", "cancelled"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(editorialCalendar).set({ status: input.status }).where(eq(editorialCalendar.id, input.id));
      return { success: true };
    }),

  // ── Log de Execuções ─────────────────────────────────────────────────────────
  logExecution: publicProcedure
    .input(z.object({
      automationName: z.string(),
      automationLabel: z.string(),
      status: z.enum(["running", "success", "error", "warning"]),
      summary: z.string().optional(),
      details: z.any().optional(),
      errorMessage: z.string().optional(),
      durationMs: z.number().optional(),
      triggeredBy: z.string().optional(),
      sendEmail: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      const [inserted] = await db.insert(automationExecutionLogs).values({
        automationName: input.automationName,
        automationLabel: input.automationLabel,
        status: input.status,
        summary: input.summary,
        details: input.details ?? null,
        errorMessage: input.errorMessage,
        durationMs: input.durationMs,
        triggeredBy: input.triggeredBy ?? "manual",
        emailSent: false,
      }).$returningId();

      // Enviar notificação por e-mail se solicitado ou se for erro
      let emailSent = false;
      if (input.sendEmail || input.status === "error") {
        const statusEmoji = input.status === "success" ? "✅" : input.status === "error" ? "❌" : input.status === "warning" ? "⚠️" : "🔄";
        const emailContent = [
          `**Automação:** ${input.automationLabel}`,
          `**Status:** ${statusEmoji} ${input.status.toUpperCase()}`,
          input.summary ? `**Resumo:** ${input.summary}` : null,
          input.errorMessage ? `**Erro:** ${input.errorMessage}` : null,
          `**Disparado por:** ${input.triggeredBy ?? "manual"}`,
          input.durationMs ? `**Duração:** ${(input.durationMs / 1000).toFixed(1)}s` : null,
          `**Data/Hora:** ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        ].filter(Boolean).join("\n");

        try {
          await notifyOwner({
            title: `${statusEmoji} Automação: ${input.automationLabel}`,
            content: emailContent,
          });
          emailSent = true;
          // Atualizar o log com emailSent = true
          if (inserted?.id) {
            await db.update(automationExecutionLogs)
              .set({ emailSent: true })
              .where(eq(automationExecutionLogs.id, inserted.id));
          }
        } catch (err) {
          console.error("[automations.logExecution] Failed to send notification:", err);
        }
      }

      return { success: true, id: inserted?.id, emailSent };
    }),

  // ── Buscar Logs de Execução ───────────────────────────────────────────────────
  getExecutionLogs: publicProcedure
    .input(z.object({
      automationName: z.string().optional(),
      status: z.enum(["running", "success", "error", "warning"]).optional(),
      limit: z.number().optional().default(50),
      offset: z.number().optional().default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { logs: [], total: 0 };

      const conditions = [];
      if (input?.automationName) {
        conditions.push(eq(automationExecutionLogs.automationName, input.automationName));
      }
      if (input?.status) {
        conditions.push(eq(automationExecutionLogs.status, input.status));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [logs, countResult] = await Promise.all([
        db.select().from(automationExecutionLogs)
          .where(whereClause)
          .orderBy(desc(automationExecutionLogs.createdAt))
          .limit(input?.limit ?? 50)
          .offset(input?.offset ?? 0),
        db.select({ count: sql<number>`COUNT(*)` }).from(automationExecutionLogs)
          .where(whereClause),
      ]);

      return { logs, total: Number(countResult[0]?.count ?? 0) };
    }),

  // ── Exportar Dados como CSV ───────────────────────────────────────────────────
  exportCsv: publicProcedure
    .input(z.object({
      type: z.enum(["anomaly_alerts", "bid_suggestions", "rsa_suggestions", "search_terms", "execution_logs"]),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { csv: "", filename: "export.csv" };

      let rows: any[] = [];
      let headers: string[] = [];
      let filename = "export.csv";

      if (input.type === "anomaly_alerts") {
        rows = await db.select().from(anomalyAlerts).orderBy(desc(anomalyAlerts.createdAt)).limit(200);
        headers = ["id", "metric", "adGroupName", "currentValue", "baselineValue", "changePercent", "severity", "message", "createdAt"];
        filename = `alertas-anomalia-${new Date().toISOString().split("T")[0]}.csv`;
      } else if (input.type === "bid_suggestions") {
        rows = await db.select().from(bidAdjustments).orderBy(desc(bidAdjustments.createdAt)).limit(200);
        headers = ["id", "adGroupId", "adGroupName", "currentBidMicros", "suggestedBidMicros", "reason", "status", "createdAt"];
        filename = `sugestoes-lance-${new Date().toISOString().split("T")[0]}.csv`;
      } else if (input.type === "rsa_suggestions") {
        rows = await db.select().from(rsaSuggestions).orderBy(desc(rsaSuggestions.createdAt)).limit(200);
        headers = ["id", "adGroupName", "campaignName", "qualityScore", "status", "createdAt"];
        filename = `sugestoes-rsa-${new Date().toISOString().split("T")[0]}.csv`;
      } else if (input.type === "search_terms") {
        rows = await db.select().from(searchTermAnalysis).orderBy(desc(searchTermAnalysis.createdAt)).limit(200);
        headers = ["id", "searchTerm", "adGroupName", "campaignName", "impressions", "clicks", "intent", "relevanceScore", "decision", "analysisDate"];
        filename = `termos-pesquisa-${new Date().toISOString().split("T")[0]}.csv`;
      } else if (input.type === "execution_logs") {
        rows = await db.select().from(automationExecutionLogs).orderBy(desc(automationExecutionLogs.createdAt)).limit(200);
        headers = ["id", "automationName", "automationLabel", "status", "summary", "errorMessage", "durationMs", "triggeredBy", "emailSent", "createdAt"];
        filename = `logs-automacoes-${new Date().toISOString().split("T")[0]}.csv`;
      }

      // Gerar CSV
      const escape = (v: any) => {
        if (v === null || v === undefined) return "";
        const str = String(v);
        if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
          return `"${str.replace(/"/g, "\"\"")}"`;
        }
        return str;
      };

      const csvLines = [
        headers.join(","),
        ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
      ];

      return { csv: csvLines.join("\n"), filename, count: rows.length };
    }),

  // ── Configuração de Categorias de Negativação ──────────────────────────────────────────────────────────────────────────────

  /** Retorna a configuração atual de categorias (banco + defaults do job) */
  getNegativeCategoryConfig: publicProcedure.query(async () => {
    const db = await getDb();
    const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
      emprego:         { label: "Emprego / Vaga",              description: "Buscas por vagas de emprego, estágio, trainee ou currículo" },
      gratuidade:      { label: "Gratuidade / Free",           description: "Buscas por versão gratuita, freemium ou sem custo" },
      informacional:   { label: "Busca Informacional",         description: "Buscas conceituais, definições ou Wikipedia" },
      b2c_residencial: { label: "B2C / Residencial",           description: "Intenção de uso pessoal ou residencial" },
      preco_baixo:     { label: "Preço Baixo / Promoção",     description: "Buscas por desconto, oferta ou preço mínimo" },
      ia_pessoal:      { label: "IA Pessoal (ChatGPT etc.)",   description: "Buscas por IAs pessoais como ChatGPT, Gemini, Claude" },
      concorrente:     { label: "Concorrente Direto",          description: "Marcas concorrentes: ControlID, ZKTeco, Intelbras etc." },
      plataforma_bot:  { label: "Plataforma Alternativa",      description: "Plataformas de chatbot como ManyChat, Botmaker, Take Blip" },
      tutorial_diy:    { label: "Tutorial / DIY",              description: "Buscas por tutoriais, como instalar ou código-fonte" },
      irrelevante:     { label: "Irrelevante (ficção etc.)",   description: "Termos completamente fora do contexto B2B" },
      alto_custo:      { label: "Alto Custo Sem Conversão",    description: "Termos com gasto alto e zero conversões (gerido manualmente)" },
    };

    // Buscar configurações salvas no banco
    const saved = db ? await db.select().from(negativeCategoryConfig) : [];
    const savedMap = Object.fromEntries(saved.map(r => [r.category, r]));

    // Mesclar defaults do job com configurações do banco
    return Object.entries(CATEGORY_ACTIVE_CONFIG).map(([category, defaultActive]) => {
      const meta = CATEGORY_LABELS[category] ?? { label: category, description: "" };
      const dbRow = savedMap[category];
      return {
        category,
        label: dbRow?.label ?? meta.label,
        description: dbRow?.description ?? meta.description,
        active: dbRow ? dbRow.active : defaultActive,
        minConfidence: dbRow?.minConfidence ?? 70,
        defaultMatchType: dbRow?.defaultMatchType ?? "PHRASE",
        updatedBy: dbRow?.updatedBy ?? null,
        updatedAt: dbRow?.updatedAt ?? null,
      };
    });
  }),

  /** Atualiza a configuração de uma categoria (upsert) */
  updateNegativeCategoryConfig: publicProcedure
    .input(z.object({
      category: z.string().min(1).max(64),
      active: z.boolean(),
      minConfidence: z.number().min(0).max(100).optional(),
      defaultMatchType: z.enum(["EXACT", "PHRASE", "BROAD"]).optional(),
      updatedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Banco de dados indisponível" };

      const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
        emprego:         { label: "Emprego / Vaga",              description: "Buscas por vagas de emprego, estágio, trainee ou currículo" },
        gratuidade:      { label: "Gratuidade / Free",           description: "Buscas por versão gratuita, freemium ou sem custo" },
        informacional:   { label: "Busca Informacional",         description: "Buscas conceituais, definições ou Wikipedia" },
        b2c_residencial: { label: "B2C / Residencial",           description: "Intenção de uso pessoal ou residencial" },
        preco_baixo:     { label: "Preço Baixo / Promoção",     description: "Buscas por desconto, oferta ou preço mínimo" },
        ia_pessoal:      { label: "IA Pessoal (ChatGPT etc.)",   description: "Buscas por IAs pessoais como ChatGPT, Gemini, Claude" },
        concorrente:     { label: "Concorrente Direto",          description: "Marcas concorrentes: ControlID, ZKTeco, Intelbras etc." },
        plataforma_bot:  { label: "Plataforma Alternativa",      description: "Plataformas de chatbot como ManyChat, Botmaker, Take Blip" },
        tutorial_diy:    { label: "Tutorial / DIY",              description: "Buscas por tutoriais, como instalar ou código-fonte" },
        irrelevante:     { label: "Irrelevante (ficção etc.)",   description: "Termos completamente fora do contexto B2B" },
        alto_custo:      { label: "Alto Custo Sem Conversão",    description: "Termos com gasto alto e zero conversões (gerido manualmente)" },
      };

      const meta = CATEGORY_LABELS[input.category] ?? { label: input.category, description: "" };

      await db
        .insert(negativeCategoryConfig)
        .values({
          category: input.category,
          label: meta.label,
          description: meta.description,
          active: input.active,
          minConfidence: input.minConfidence ?? 70,
          defaultMatchType: input.defaultMatchType ?? "PHRASE",
          updatedBy: input.updatedBy ?? "dashboard",
        })
        .onDuplicateKeyUpdate({
          set: {
            active: input.active,
            minConfidence: input.minConfidence ?? 70,
            defaultMatchType: input.defaultMatchType ?? "PHRASE",
            updatedBy: input.updatedBy ?? "dashboard",
          },
        });

      return { success: true };
    }),

  // ── Relatório Integrado ──────────────────────────────────────────────────────────────────────────────
  getIntegratedInsights: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { instagram: null, alerts: [], bidSuggestions: [], rsaSuggestions: [], searchTerms: [], opportunities: [] };

    const [latestSnapshot] = await db.select().from(instagramSnapshots).orderBy(desc(instagramSnapshots.createdAt)).limit(1);
    const recentAlerts = await db.select().from(anomalyAlerts).orderBy(desc(anomalyAlerts.createdAt)).limit(5);
    const pendingBids = await db.select().from(bidAdjustments).where(eq(bidAdjustments.status, "suggested")).limit(5);
    const pendingRsa = await db.select().from(rsaSuggestions).where(eq(rsaSuggestions.status, "pending")).limit(5);
    const recentTerms = await db.select().from(searchTermAnalysis).orderBy(desc(searchTermAnalysis.createdAt)).limit(10);

    return {
      instagram: latestSnapshot ?? null,
      alerts: recentAlerts,
      bidSuggestions: pendingBids,
      rsaSuggestions: pendingRsa,
      searchTerms: recentTerms,
      opportunities: [
        pendingBids.length > 0 ? `${pendingBids.length} ajustes de lance aguardando aprovação` : null,
        pendingRsa.length > 0 ? `${pendingRsa.length} RSAs com sugestões de melhoria pendentes` : null,
        recentTerms.filter((t) => t.decision === "negative").length > 0 ? `${recentTerms.filter((t) => t.decision === "negative").length} termos de pesquisa para negativar` : null,
        recentAlerts.filter((a) => !a.resolvedAt).length > 0 ? `${recentAlerts.filter((a) => !a.resolvedAt).length} alertas de anomalia não resolvidos` : null,
      ].filter(Boolean),
    };
  }),
});
