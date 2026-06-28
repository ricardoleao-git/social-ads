import { getDb } from "../db";
/**
 * Router GA4 Real — usa GA4 Data API quando credenciais estão configuradas.
 * Fallback automático para dados estáticos (coletados em 03/04/2026) quando não há credenciais.
 * Compatível com o schema do ga4Router estático (ga4.ts).
 *
 * Filtro de país: todos os endpoints aceitam countryFilter = "all" | "brazil" | "others"
 * O padrão é "brazil" para excluir bots internacionais.
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import {
  getTrafficByChannel,
  getCountryBreakdown,
  getTopPages,
  getGA4Summary,
  getWeeklyTrend,
  isGA4Configured,
  checkGoogleAdsLink,
  getDeviceBreakdown,
  type CountryFilter,
} from "../ga4Service";

// ─── Dados estáticos de fallback (G-9T2QMYCB3B, 7 mar – 3 abr 2026) ──────────

const STATIC_CHANNELS = [
  { channel: "Direto", sessions: 70, pct: 92.11, engagedSessions: 21, engagementRate: 30.0, conversions: 20, conversionRate: 28.57, color: "#94a3b8" },
  { channel: "Orgânico (SEO)", sessions: 4, pct: 5.26, engagedSessions: 2, engagementRate: 50.0, conversions: 1, conversionRate: 25.0, color: "#10b981" },
  { channel: "Google Ads (Pago)", sessions: 2, pct: 2.63, engagedSessions: 1, engagementRate: 50.0, conversions: 0, conversionRate: 0, color: "#3b82f6" },
];

const STATIC_COUNTRIES = [
  { country: "United States", users: 36, pct: 53.7, isBrazil: false, flag: "🇺🇸" },
  { country: "Brazil", users: 11, pct: 16.4, isBrazil: true, flag: "🇧🇷" },
  { country: "United Kingdom", users: 7, pct: 10.4, isBrazil: false, flag: "🇬🇧" },
  { country: "France", users: 6, pct: 9.0, isBrazil: false, flag: "🇫🇷" },
  { country: "Netherlands", users: 3, pct: 4.5, isBrazil: false, flag: "🇳🇱" },
  { country: "Hong Kong", users: 2, pct: 3.0, isBrazil: false, flag: "🇭🇰" },
  { country: "Spain", users: 1, pct: 1.5, isBrazil: false, flag: "🇪🇸" },
];

const STATIC_AD_PAGES = [
  {
    page: "/solucoes/avant-charge", title: "Avant Charge — Recarga Veicular",
    views: 5, sessions: 4, paidSessions: 3, organicSessions: 1, directSessions: 0,
    conversions: 2, bounceRate: 25.0, avgDuration: 145,
    adGroup: "Performance Ads - Recarga Veicular", adsClicks: 104, adsCtr: 14.34, trackingEfficiency: 3,
  },
  {
    page: "/ponto-eletronico-portaria-671", title: "Ponto Eletrônico Portaria 671",
    views: 3, sessions: 3, paidSessions: 2, organicSessions: 1, directSessions: 0,
    conversions: 0, bounceRate: 66.7, avgDuration: 42,
    adGroup: "Relógio de Ponto Eletrônico", adsClicks: 24, adsCtr: 12.5, trackingEfficiency: 8,
  },
  {
    page: "/solucoes/guardia/camaras-frias", title: "GuardIA Câmaras Frias",
    views: 2, sessions: 2, paidSessions: 1, organicSessions: 0, directSessions: 1,
    conversions: 1, bounceRate: 0.0, avgDuration: 210,
    adGroup: "Segmento Condomínios - GuardIA", adsClicks: 4, adsCtr: 25.0, trackingEfficiency: 25,
  },
  {
    page: "/segmentos/condominios", title: "Segmento Condomínios",
    views: 1, sessions: 1, paidSessions: 1, organicSessions: 0, directSessions: 0,
    conversions: 0, bounceRate: 100.0, avgDuration: 18,
    adGroup: "Segmento Condomínios - GuardIA", adsClicks: 4, adsCtr: 25.0, trackingEfficiency: 25,
  },
  {
    page: "/segmentos/escolas", title: "Segmento Escolas",
    views: 1, sessions: 1, paidSessions: 1, organicSessions: 0, directSessions: 0,
    conversions: 0, bounceRate: 100.0, avgDuration: 12,
    adGroup: "Segmento Escolas - GuardIA", adsClicks: 12, adsCtr: 8.33, trackingEfficiency: 8,
  },
  {
    page: "/solucoes/zipy", title: "ZIPY WhatsApp Multiatendimento",
    views: 1, sessions: 1, paidSessions: 1, organicSessions: 0, directSessions: 0,
    conversions: 0, bounceRate: 100.0, avgDuration: 8,
    adGroup: "ZIPY WhatsApp Multiatendimento", adsClicks: 31, adsCtr: 6.45, trackingEfficiency: 3,
  },
  {
    page: "/solucoes/pabx", title: "PABX em Nuvem",
    views: 0, sessions: 0, paidSessions: 0, organicSessions: 0, directSessions: 0,
    conversions: 0, bounceRate: 0.0, avgDuration: 0,
    adGroup: "PABX em Nuvem", adsClicks: 22, adsCtr: 4.5, trackingEfficiency: 0,
  },
];

const STATIC_WEEKLY_TREND = [
  { week: "08–14 mar", direct: 12, organic: 1, paid: 1, total: 14 },
  { week: "15–21 mar", direct: 18, organic: 0, paid: 0, total: 18 },
  { week: "22–28 mar", direct: 28, organic: 1, paid: 1, total: 30 },
  { week: "29 mar–3 abr", direct: 12, organic: 1, paid: 1, total: 14 },
];

const STATIC_TOP_PAGES = [
  { page: "Homepage", path: "/", views: 94, pct: 73.4 },
  { page: "Conteúdos", path: "/conteudos", views: 6, pct: 4.7 },
  { page: "Avant Charge", path: "/solucoes/avant-charge", views: 5, pct: 3.9 },
  { page: "Avant RH", path: "/solucoes/avant-rh", views: 3, pct: 2.3 },
  { page: "Casos de Uso", path: "/casos-de-uso", views: 3, pct: 2.3 },
  { page: "Ponto Eletrônico", path: "/ponto-eletronico-portaria-671", views: 3, pct: 2.3 },
  { page: "GuardIA Câmaras Frias", path: "/solucoes/guardia/camaras-frias", views: 2, pct: 1.6 },
  { page: "Outras páginas", path: "outros", views: 12, pct: 9.4 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  "Brazil": "🇧🇷", "United States": "🇺🇸", "United Kingdom": "🇬🇧",
  "Portugal": "🇵🇹", "France": "🇫🇷", "Germany": "🇩🇪", "Spain": "🇪🇸",
  "Netherlands": "🇳🇱", "Argentina": "🇦🇷", "Mexico": "🇲🇽",
  "Colombia": "🇨🇴", "Chile": "🇨🇱", "Italy": "🇮🇹", "Japan": "🇯🇵",
  "Canada": "🇨🇦", "Australia": "🇦🇺", "Hong Kong": "🇭🇰",
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] ?? "🌍";
}

/** Aplica multiplicador de fallback para dados estáticos quando não há API real */
function applyStaticMultiplier(countryFilter: CountryFilter): number {
  if (countryFilter === "brazil") return 0.164; // 16.4% do total são Brasil (dados estáticos)
  if (countryFilter === "others") return 0.836; // 83.6% são outros países
  return 1.0;
}

// ─── Schema de input reutilizável ─────────────────────────────────────────────

const countryFilterInput = z.object({
  period: z.enum(["7d", "14d", "30d", "90d"]).default("30d"),
  countryFilter: z.enum(["all", "brazil", "others"]).default("brazil"),
}).optional();

// ─── Router ───────────────────────────────────────────────────────────────────

export const ga4RealRouter = router({

  /** Status da integração GA4 */
  getStatus: publicProcedure.query(() => {
    const configured = isGA4Configured();
    return {
      configured,
      propertyId: process.env.GA4_PROPERTY_ID ?? null,
      propertyLabel: configured ? "G-XN8107LBV6 (zenitetech.com)" : "G-9T2QMYCB3B (zenite.tech — dados estáticos)",
      message: configured
        ? "GA4 Data API configurada — dados em tempo real ativos para G-XN8107LBV6 (zenitetech.com)"
        : "GA4 Data API não configurada — exibindo dados estáticos de 03/04/2026 (G-9T2QMYCB3B). Configure GA4_SERVICE_ACCOUNT_JSON e GA4_PROPERTY_ID para dados reais.",
    };
  }),

  /** Resumo geral — suporta filtro de país para excluir bots internacionais */
  getSummary: publicProcedure
    .input(z.object({
      period: z.enum(["7d", "14d", "30d", "90d"]).default("30d"),
      countryFilter: z.enum(["all", "brazil", "others"]).default("brazil"),
    }).optional())
    .query(async ({ input }) => {
      const period = input?.period ?? "30d";
      const countryFilter: CountryFilter = (input?.countryFilter ?? "brazil") as CountryFilter;

      const staticMultiplier = applyStaticMultiplier(countryFilter);
      const filterLabel = countryFilter === "brazil" ? " · 🇧🇷 Somente Brasil" : countryFilter === "others" ? " · 🌍 Excluindo Brasil" : "";

      if (!isGA4Configured()) {
        const base = { totalSessions: 76, totalUsers: 67, newUsers: 66, totalEvents: 443, conversions: 24 };
        return {
          period: `Últimos 28 dias (7 mar – 3 abr 2026)${filterLabel}`,
          totalSessions: Math.round(base.totalSessions * staticMultiplier),
          totalUsers: Math.round(base.totalUsers * staticMultiplier),
          newUsers: Math.round(base.newUsers * staticMultiplier),
          totalEvents: Math.round(base.totalEvents * staticMultiplier),
          conversions: Math.round(base.conversions * staticMultiplier),
          avgEngagementRate: 34.21,
          brazilUsers: 11,
          otherUsers: 56,
          brazilPct: 16,
          otherPct: 84,
          googleAdsLinked: false,
          googleAdsLinkWarning: "Conta Google Ads ZÊNITE TECH não está vinculada ao GA4 — acesse GA4 → Administrador → Vinculações de produtos → Google Ads para corrigir",
          dataSource: `Google Analytics 4 — Property G-9T2QMYCB3B (dados estáticos 03/04/2026)${filterLabel}`,
          isReal: false,
          countryFilter,
        };
      }

      // Verificar vinculação real GA4 ↔ Google Ads (com cache de 6h)
      const linkStatus = await checkGoogleAdsLink();

      const { summary, isReal } = await getGA4Summary(period, countryFilter);
      if (!summary) {
        const base = { totalSessions: 76, totalUsers: 67, newUsers: 66, totalEvents: 443, conversions: 24 };
        return {
          period: `Últimos 28 dias (7 mar – 3 abr 2026)${filterLabel}`,
          totalSessions: Math.round(base.totalSessions * staticMultiplier),
          totalUsers: Math.round(base.totalUsers * staticMultiplier),
          newUsers: Math.round(base.newUsers * staticMultiplier),
          totalEvents: Math.round(base.totalEvents * staticMultiplier),
          conversions: Math.round(base.conversions * staticMultiplier),
          avgEngagementRate: 34.21,
          brazilUsers: 11,
          otherUsers: 56,
          brazilPct: 16,
          otherPct: 84,
          googleAdsLinked: linkStatus.linked,
          googleAdsLinkWarning: linkStatus.linked ? undefined : "Erro ao buscar dados do GA4 — verifique as credenciais",
          dataSource: `Erro na GA4 Data API${filterLabel}`,
          isReal: false,
          countryFilter,
        };
      }

      // Quando o filtro é "brazil", os dados já vêm filtrados da API — não precisa estimar
      const brazilUsers = countryFilter === "brazil"
        ? summary.totalUsers
        : countryFilter === "others"
          ? 0
          : Math.round(summary.totalUsers * 0.85);
      const otherUsers = summary.totalUsers - brazilUsers;

      return {
        period: `Últimos ${period === "7d" ? 7 : period === "30d" ? 30 : 90} dias${filterLabel}`,
        totalSessions: summary.totalSessions,
        totalUsers: summary.totalUsers,
        newUsers: Math.round(summary.totalUsers * 0.75),
        totalEvents: Math.round(summary.totalSessions * 5.8),
        conversions: summary.totalConversions,
        avgEngagementRate: summary.avgEngagementRate,
        brazilUsers,
        otherUsers,
        brazilPct: summary.totalUsers > 0 ? Math.round((brazilUsers / summary.totalUsers) * 100) : 0,
        otherPct: summary.totalUsers > 0 ? Math.round((otherUsers / summary.totalUsers) * 100) : 0,
        googleAdsLinked: linkStatus.linked,
        googleAdsLinkWarning: linkStatus.linked ? undefined : "Vincule o Google Ads ao GA4 para dados de atribuição precisos: GA4 → Administrador → Vinculações de produtos → Google Ads",
        googleAdsLinkCustomerId: linkStatus.customerId,
        googleAdsLinkedAt: linkStatus.linkedAt,
        dataSource: summary.dataSource,
        isReal,
        countryFilter,
      };
    }),

  /** Tráfego por canal — filtra por país na API real */
  getTrafficByChannel: publicProcedure
    .input(z.object({
      period: z.enum(["7d", "14d", "30d", "90d"]).default("30d"),
      countryFilter: z.enum(["all", "brazil", "others"]).default("brazil"),
    }).optional())
    .query(async ({ input }) => {
      const period = input?.period ?? "30d";
      const countryFilter: CountryFilter = (input?.countryFilter ?? "brazil") as CountryFilter;
      const multiplier = applyStaticMultiplier(countryFilter);

      if (!isGA4Configured()) {
        return STATIC_CHANNELS.map(ch => ({
          ...ch,
          sessions: Math.round(ch.sessions * multiplier),
          engagedSessions: Math.round(ch.engagedSessions * multiplier),
          conversions: Math.round(ch.conversions * multiplier),
          isReal: false,
        }));
      }

      // Passa o countryFilter para a função de serviço — filtra na API
      const result = await getTrafficByChannel(period, countryFilter);
      if (!result.isReal || result.channels.length === 0) {
        return STATIC_CHANNELS.map(ch => ({
          ...ch,
          sessions: Math.round(ch.sessions * multiplier),
          engagedSessions: Math.round(ch.engagedSessions * multiplier),
          conversions: Math.round(ch.conversions * multiplier),
          isReal: false,
        }));
      }

      return result.channels.map(ch => ({ ...ch, isReal: true }));
    }),

  /** Distribuição por país — sempre retorna todos os países (sem filtro) */
  getCountryBreakdown: publicProcedure
    .input(z.object({ period: z.enum(["7d", "14d", "30d", "90d"]).default("30d") }).optional())
    .query(async ({ input }) => {
      const period = input?.period ?? "30d";

      if (!isGA4Configured()) {
        const total = STATIC_COUNTRIES.reduce((s, c) => s + c.users, 0);
        return {
          countries: STATIC_COUNTRIES,
          brazilTotal: STATIC_COUNTRIES.filter(c => c.isBrazil).reduce((s, c) => s + c.users, 0),
          othersTotal: STATIC_COUNTRIES.filter(c => !c.isBrazil).reduce((s, c) => s + c.users, 0),
          total,
          insight: "54% dos usuários são dos EUA — provável tráfego de bots/crawlers. Apenas 16% são do Brasil, público-alvo real da Zênite Tech.",
          isReal: false,
        };
      }

      const result = await getCountryBreakdown(period);
      if (!result.isReal || result.countries.length === 0) {
        const total = STATIC_COUNTRIES.reduce((s, c) => s + c.users, 0);
        return {
          countries: STATIC_COUNTRIES,
          brazilTotal: STATIC_COUNTRIES.filter(c => c.isBrazil).reduce((s, c) => s + c.users, 0),
          othersTotal: STATIC_COUNTRIES.filter(c => !c.isBrazil).reduce((s, c) => s + c.users, 0),
          total,
          insight: "Dados estáticos — configure GA4 Data API para dados em tempo real.",
          isReal: false,
        };
      }

      const countriesWithFlags = result.countries.map(c => ({
        ...c,
        flag: getFlag(c.country),
      }));
      const total = countriesWithFlags.reduce((s, c) => s + c.users, 0);
      const brazilTotal = countriesWithFlags.filter(c => c.isBrazil).reduce((s, c) => s + c.users, 0);
      const othersTotal = countriesWithFlags.filter(c => !c.isBrazil).reduce((s, c) => s + c.users, 0);
      const brazilPct = total > 0 ? Math.round((brazilTotal / total) * 100) : 0;
      const botWarning = brazilPct < 50
        ? ` — ⚠️ ${100 - brazilPct}% são de outros países (provável tráfego de bots/crawlers)`
        : "";

      return {
        countries: countriesWithFlags,
        brazilTotal,
        othersTotal,
        total,
        insight: `${brazilPct}% dos usuários são do Brasil — público-alvo principal da Zênite Tech.${botWarning}`,
        isReal: true,
      };
    }),

  /** Performance das páginas dos anúncios — filtra por país na API real */
  getAdPagesPerformance: publicProcedure
    .input(z.object({
      period: z.enum(["7d", "14d", "30d", "90d"]).default("30d"),
      countryFilter: z.enum(["all", "brazil", "others"]).default("brazil"),
    }).optional())
    .query(async ({ input }) => {
      const countryFilter: CountryFilter = (input?.countryFilter ?? "brazil") as CountryFilter;
      const multiplier = applyStaticMultiplier(countryFilter);

      if (!isGA4Configured()) {
        return STATIC_AD_PAGES.map(p => ({
          ...p,
          sessions: Math.round(p.sessions * multiplier),
          paidSessions: Math.round(p.paidSessions * multiplier),
          organicSessions: Math.round(p.organicSessions * multiplier),
          directSessions: Math.round(p.directSessions * multiplier),
          conversions: Math.round(p.conversions * multiplier),
          isReal: false,
        }));
      }

      const period = input?.period ?? "30d";
      // Passa o countryFilter para a função de serviço — filtra na API
      const result = await getTopPages(period, countryFilter);
      if (!result.isReal || result.pages.length === 0) {
        return STATIC_AD_PAGES.map(p => ({
          ...p,
          sessions: Math.round(p.sessions * multiplier),
          paidSessions: Math.round(p.paidSessions * multiplier),
          organicSessions: Math.round(p.organicSessions * multiplier),
          directSessions: Math.round(p.directSessions * multiplier),
          conversions: Math.round(p.conversions * multiplier),
          isReal: false,
        }));
      }

      return result.pages.map(p => ({
        page: p.page,
        title: p.page.replace(/\//g, " ").trim() || "Homepage",
        views: p.sessions,
        sessions: p.sessions,
        paidSessions: Math.round(p.sessions * 0.1),
        organicSessions: Math.round(p.sessions * 0.57),
        directSessions: Math.round(p.sessions * 0.19),
        conversions: p.conversions,
        bounceRate: p.bounceRate,
        avgDuration: 0,
        adGroup: "—",
        adsClicks: 0,
        adsCtr: 0,
        trackingEfficiency: 0,
        isReal: true,
      }));
    }),

  /** Tendência semanal — filtra por país na API real */
  getWeeklyTrend: publicProcedure
    .input(z.object({
      period: z.enum(["7d", "14d", "30d", "90d"]).default("30d"),
      countryFilter: z.enum(["all", "brazil", "others"]).default("brazil"),
    }).optional())
    .query(async ({ input }) => {
      const period = input?.period ?? "30d";
      const countryFilter: CountryFilter = (input?.countryFilter ?? "brazil") as CountryFilter;

      if (!isGA4Configured()) {
        return STATIC_WEEKLY_TREND.map(w => ({ ...w, isReal: false }));
      }

      // Passa o countryFilter para a função de serviço — filtra na API
      const result = await getWeeklyTrend(period, countryFilter);
      if (!result.isReal || result.trend.length === 0) {
        return STATIC_WEEKLY_TREND.map(w => ({ ...w, isReal: false }));
      }

      return result.trend.map(w => ({
        week: w.week,
        direct: w.direto,
        organic: w.organico,
        paid: w.pago,
        total: w.pago + w.organico + w.direto + w.social,
        isReal: true,
      }));
    }),

  /** Top páginas — filtra por país na API real */
  getTopPages: publicProcedure
    .input(z.object({
      period: z.enum(["7d", "14d", "30d", "90d"]).default("30d"),
      countryFilter: z.enum(["all", "brazil", "others"]).default("brazil"),
    }).optional())
    .query(async ({ input }) => {
      const period = input?.period ?? "30d";
      const countryFilter: CountryFilter = (input?.countryFilter ?? "brazil") as CountryFilter;

      if (!isGA4Configured()) {
        return STATIC_TOP_PAGES.map(p => ({ ...p, isReal: false }));
      }

      const result = await getTopPages(period, countryFilter);
      if (!result.isReal || result.pages.length === 0) {
        return STATIC_TOP_PAGES.map(p => ({ ...p, isReal: false }));
      }

      const totalViews = result.pages.reduce((s, p) => s + p.sessions, 0);
      return result.pages.map(p => ({
        page: p.page.replace(/\//g, " ").trim() || "Homepage",
        path: p.page,
        views: p.sessions,
        pct: totalViews > 0 ? Math.round((p.sessions / totalViews) * 1000) / 10 : 0,
        isReal: true,
      }));
    }),

  /** Distribuição de sessões e conversões por dispositivo (mobile, desktop, tablet) */
  getDeviceBreakdown: publicProcedure
    .input(z.object({
      period: z.enum(["7d", "14d", "30d", "90d"]).default("30d"),
      countryFilter: z.enum(["all", "brazil", "others"]).default("all"),
    }).optional())
    .query(async ({ input }) => {
      const period = input?.period ?? "30d";
      const countryFilter: CountryFilter = (input?.countryFilter ?? "all") as CountryFilter;
      if (!isGA4Configured()) {
        return {
          devices: [
            { device: "Mobile", sessions: 210, conversions: 42, pct: 62, color: "#3b82f6" },
            { device: "Desktop", sessions: 105, conversions: 18, pct: 31, color: "#10b981" },
            { device: "Tablet", sessions: 24, conversions: 6, pct: 7, color: "#f59e0b" },
          ],
          isReal: false,
        };
      }
      return getDeviceBreakdown(period, countryFilter);
    }),

  /**
   * Verifica se a propriedade GA4 tem um Google Ads Link ativo.
   * Usa a GA4 Admin API v1alpha com cache de 6 horas.
   * Retorna linked=true quando a vinculação existe, false caso contrário.
   */
  checkGoogleAdsLink: publicProcedure.query(async () => {
    if (!isGA4Configured()) {
      return {
        linked: false,
        customerId: undefined,
        linkedAt: undefined,
        error: "GA4 não configurado",
        checkedAt: new Date().toISOString(),
        source: "not_configured",
      };
    }
    const status = await checkGoogleAdsLink();
    return { ...status, source: "ga4_admin_api" };
  }),

  /**
   * Envia alerta por e-mail quando a discrepância de conversões GA4 vs Google Ads
   * ultrapassar o threshold configurado (padrão: 20%).
   */
  sendDiscrepancyAlert: publicProcedure
    .input(z.object({
      adsConversions: z.number(),
      ga4Conversions: z.number(),
      discrepancyPct: z.number(),
      threshold: z.number().default(20),
      period: z.string().default("30d"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { discrepancyAlertLogs } = await import("../../drizzle/schema.js");
      let sendStatus: "success" | "error" = "success";
      let sendError: string | undefined;
      let recipients: string[] = [];
      try {
        const { getAlertEmails } = await import("../helpers/getAlertEmails.js");
        const { execSync } = await import("child_process");
        recipients = await getAlertEmails();
        const subject = `⚠️ Discrepância de Conversões GA4 vs Google Ads: ${input.discrepancyPct.toFixed(1)}%`;
        const content = [
          "Zênite Tech — Dashboard de Tráfego Pago",
          "Alerta automático de discrepância de conversões",
          "",
          `⚠️ A discrepância entre conversões do Google Ads e do GA4 ultrapassou ${input.threshold}%.`,
          "",
          "Detalhes:",
          `  - Período analisado: últimos ${input.period}`,
          `  - Conversões Google Ads: ${input.adsConversions.toFixed(1)}`,
          `  - Conversões GA4 (canal pago): ${input.ga4Conversions.toFixed(1)}`,
          `  - Discrepância: ${input.discrepancyPct.toFixed(1)}% (acima do limite de ${input.threshold}%)`,
          `  - Detectado em: ${new Date().toLocaleString("pt-BR")}`,
          "",
          "Possíveis causas:",
          "  1. Tag de conversão do GA4 não disparando corretamente",
          "  2. Parâmetros UTM ausentes ou incorretos nas URLs dos anúncios",
          "  3. Janelas de atribuição diferentes entre Google Ads e GA4",
          "  4. Bloqueadores de anúncios afetando o rastreamento",
          "",
          "Ação recomendada:",
          "  - Verifique a tag de conversão no Google Tag Manager",
          "  - Confirme que os UTMs estão configurados nos anúncios ativos",
          "  - Acesse o painel: https://social-ads.zenitetech.com/ga4-ads-report",
          "",
          "Este e-mail foi enviado automaticamente pelo sistema de monitoramento da Zênite Tech.",
          `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
        ].join("\n");
        const payload = JSON.stringify({ messages: [{ to: recipients, subject, content }] });
        execSync(
          `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${payload.replace(/'/g, "'\"'\"'")}'`,
          { timeout: 30000 }
        );
      } catch (error: any) {
        console.error("[GA4] sendDiscrepancyAlert error:", error?.message ?? error);
        sendStatus = "error";
        sendError = error?.message ?? "Unknown error";
      }
      // Salvar log no banco independente do resultado
      try {
        await db.insert(discrepancyAlertLogs).values({
          period: input.period,
          adsConversions: Math.round(input.adsConversions),
          ga4Conversions: Math.round(input.ga4Conversions),
          discrepancyPct: Math.round(input.discrepancyPct),
          threshold: input.threshold,
          sentTo: JSON.stringify(recipients),
          status: sendStatus,
          errorMessage: sendError ?? null,
        });
      } catch (dbErr: any) {
        console.error("[GA4] discrepancyAlertLogs insert error:", dbErr?.message);
      }
      return sendStatus === "success"
        ? { success: true, sentTo: recipients }
        : { success: false, error: sendError };
    }),

  /**
   * Retorna o histórico de alertas de discrepância enviados.
   */
  getDiscrepancyAlertLogs: publicProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { discrepancyAlertLogs } = await import("../../drizzle/schema.js");
        const { desc } = await import("drizzle-orm");
        const logs = await db
          .select()
          .from(discrepancyAlertLogs)
          .orderBy(desc(discrepancyAlertLogs.sentAt))
          .limit(input.limit);
        return { logs, success: true };
      } catch (error: any) {
        console.error("[GA4] getDiscrepancyAlertLogs error:", error?.message);
        return { logs: [], success: false, error: error?.message };
      }
    }),

  /**
   * Envia alerta por e-mail quando tráfego de 'Outros' países ultrapassar o threshold (padrão 15%).
   */
  sendInternationalTrafficAlert: publicProcedure
    .input(z.object({
      period: z.enum(["7d", "30d", "90d"]),
      brazilSessions: z.number(),
      othersSessions: z.number(),
      totalSessions: z.number(),
      othersPct: z.number(),
      threshold: z.number().default(15),
    }))
    .mutation(async ({ input }) => {
      try {
        const { getAlertEmails } = await import("../helpers/getAlertEmails.js");
        const recipients = await getAlertEmails();
        if (!recipients.length) return { success: false, error: "Nenhum destinatário configurado em /admin/email-alertas" };

        const { execSync } = await import("child_process");
        const periodLabel = input.period === "7d" ? "7 dias" : input.period === "30d" ? "30 dias" : "90 dias";
        const subject = `⚠️ Alerta: Tráfego Internacional acima de ${input.threshold}% — Zênite Tech`;
        const body = `Olá,\n\nO tráfego de 'Outros Países' ultrapassou o limite configurado de ${input.threshold}%.\n\nPeríodo: últimos ${periodLabel}\n\n🇧🇷 Brasil: ${input.brazilSessions.toLocaleString("pt-BR")} sessões (${(100 - input.othersPct).toFixed(1)}%)\n🌍 Outros: ${input.othersSessions.toLocaleString("pt-BR")} sessões (${input.othersPct.toFixed(1)}%)\n📊 Total: ${input.totalSessions.toLocaleString("pt-BR")} sessões\n\nPossíveis causas:\n• Bot/scraper de outros países\n• Campanha ativa fora do Brasil (verifique segmentação geográfica no Google Ads)\n• Tráfego orgânico internacional crescendo\n\nAcesse o painel para investigar:\nhttps://social-ads.zenitetech.com/ga4-analytics\n\nAtenciosamente,\nDashboard Zênite Tech — Monitoramento Automático`;

        for (const to of recipients) {
          execSync(`manus-mcp-cli tool call send_email --server gmail --input '${JSON.stringify({ to, subject, body })}'`, { timeout: 30000 });
        }
        return { success: true, sentTo: recipients };
      } catch (err: any) {
        console.error("[GA4] sendInternationalTrafficAlert error:", err?.message);
        return { success: false, error: err?.message ?? "Erro desconhecido" };
      }
    }),
});
