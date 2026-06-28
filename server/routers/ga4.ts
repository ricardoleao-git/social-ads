import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

// ─── Dados reais coletados do GA4 (28 dias: 7 mar – 3 abr 2026) ──────────────
// Fonte: Google Analytics 4 Property 531461479 (G-XN8107LBV6 — zenitetech.com)
// Nota: A vinculação GA4 ↔ Google Ads ainda não está ativa, por isso
// "Direct" está inflado (92%) — cliques pagos aparecem como Direct.

const GA4_TRAFFIC_BY_CHANNEL = [
  {
    channel: "Direct",
    sessions: 70,
    pct: 92.11,
    engagedSessions: 21,
    engagementRate: 30.0,
    conversions: 20,
    conversionRate: 28.57,
    color: "#94a3b8",
  },
  {
    channel: "Organic Search",
    sessions: 3,
    pct: 3.95,
    engagedSessions: 3,
    engagementRate: 100.0,
    conversions: 1,
    conversionRate: 33.33,
    color: "#22c55e",
  },
  {
    channel: "Paid Search",
    sessions: 3,
    pct: 3.95,
    engagedSessions: 2,
    engagementRate: 66.67,
    conversions: 3,
    conversionRate: 100.0,
    color: "#3b82f6",
  },
];

const GA4_USERS_BY_COUNTRY = [
  { country: "United States", users: 36, pct: 53.7, isBrazil: false, flag: "🇺🇸" },
  { country: "Brazil", users: 11, pct: 16.4, isBrazil: true, flag: "🇧🇷" },
  { country: "United Kingdom", users: 7, pct: 10.4, isBrazil: false, flag: "🇬🇧" },
  { country: "France", users: 6, pct: 9.0, isBrazil: false, flag: "🇫🇷" },
  { country: "Netherlands", users: 3, pct: 4.5, isBrazil: false, flag: "🇳🇱" },
  { country: "Hong Kong", users: 2, pct: 3.0, isBrazil: false, flag: "🇭🇰" },
  { country: "Spain", users: 1, pct: 1.5, isBrazil: false, flag: "🇪🇸" },
];

// Páginas dos anúncios com dados de tráfego (estimativa baseada em dados GA4 + Google Ads)
// Nota: sem vinculação GA4↔Ads, os dados de canal por página são estimados
const GA4_AD_PAGES = [
  {
    page: "/solucoes/avant-charge",
    title: "Avant Charge — Recarga Veicular",
    views: 5,
    sessions: 4,
    paidSessions: 3,
    organicSessions: 1,
    directSessions: 0,
    conversions: 2,
    bounceRate: 25.0,
    avgDuration: 145,
    adGroup: "Performance Ads - Recarga Veicular",
    adsClicks: 104,
    adsCtr: 14.34,
  },
  {
    page: "/ponto-eletronico-portaria-671",
    title: "Ponto Eletrônico Portaria 671",
    views: 3,
    sessions: 3,
    paidSessions: 2,
    organicSessions: 1,
    directSessions: 0,
    conversions: 0,
    bounceRate: 66.7,
    avgDuration: 42,
    adGroup: "Relógio de Ponto Eletrônico",
    adsClicks: 24,
    adsCtr: 12.5,
  },
  {
    page: "/solucoes/guardia/camaras-frias",
    title: "GuardIA Câmaras Frias",
    views: 2,
    sessions: 2,
    paidSessions: 1,
    organicSessions: 0,
    directSessions: 1,
    conversions: 1,
    bounceRate: 0.0,
    avgDuration: 210,
    adGroup: "Segmento Condomínios - GuardIA",
    adsClicks: 4,
    adsCtr: 25.0,
  },
  {
    page: "/segmentos/condominios",
    title: "Segmento Condomínios",
    views: 1,
    sessions: 1,
    paidSessions: 1,
    organicSessions: 0,
    directSessions: 0,
    conversions: 0,
    bounceRate: 100.0,
    avgDuration: 18,
    adGroup: "Segmento Condomínios - GuardIA",
    adsClicks: 4,
    adsCtr: 25.0,
  },
  {
    page: "/segmentos/escolas",
    title: "Segmento Escolas",
    views: 1,
    sessions: 1,
    paidSessions: 1,
    organicSessions: 0,
    directSessions: 0,
    conversions: 0,
    bounceRate: 100.0,
    avgDuration: 12,
    adGroup: "Segmento Escolas - GuardIA",
    adsClicks: 12,
    adsCtr: 8.33,
  },
  {
    page: "/solucoes/zipy",
    title: "ZIPY WhatsApp Multiatendimento",
    views: 1,
    sessions: 1,
    paidSessions: 1,
    organicSessions: 0,
    directSessions: 0,
    conversions: 0,
    bounceRate: 100.0,
    avgDuration: 8,
    adGroup: "ZIPY WhatsApp Multiatendimento",
    adsClicks: 31,
    adsCtr: 6.45,
  },
  {
    page: "/solucoes/pabx",
    title: "PABX em Nuvem",
    views: 0,
    sessions: 0,
    paidSessions: 0,
    organicSessions: 0,
    directSessions: 0,
    conversions: 0,
    bounceRate: 0.0,
    avgDuration: 0,
    adGroup: "PABX em Nuvem",
    adsClicks: 22,
    adsCtr: 4.5,
  },
];

// Tendência semanal de sessões por canal (últimas 4 semanas)
const GA4_WEEKLY_TREND = [
  { week: "08–14 mar", direct: 12, organic: 1, paid: 1, total: 14 },
  { week: "15–21 mar", direct: 18, organic: 0, paid: 0, total: 18 },
  { week: "22–28 mar", direct: 28, organic: 1, paid: 1, total: 30 },
  { week: "29 mar–3 abr", direct: 12, organic: 1, paid: 1, total: 14 },
];

export const ga4Router = router({
  // Resumo geral: totais e distribuição por canal
  getSummary: publicProcedure.query(() => {
    const brazilUsers = GA4_USERS_BY_COUNTRY.filter(c => c.isBrazil).reduce((s, c) => s + c.users, 0);
    const otherUsers = GA4_USERS_BY_COUNTRY.filter(c => !c.isBrazil).reduce((s, c) => s + c.users, 0);
    const totalUsers = brazilUsers + otherUsers;

    return {
      period: "Últimos 28 dias (7 mar – 3 abr 2026)",
      totalSessions: 76,
      totalUsers,
      newUsers: 66,
      totalEvents: 443,
      conversions: 24,
      avgEngagementRate: 34.21,
      brazilUsers,
      otherUsers,
      brazilPct: Math.round((brazilUsers / totalUsers) * 100),
      otherPct: Math.round((otherUsers / totalUsers) * 100),
      googleAdsLinked: false,
      googleAdsLinkWarning: "Conta Google Ads ZÊNITE TECH não está vinculada ao GA4 — acesse GA4 → Administrador → Vinculações de produtos → Google Ads para corrigir e obter dados de Paid Search precisos",
      dataSource: "Google Analytics 4 — Property G-XN8107LBV6 (zenitetech.com)",
    };
  }),

  // Tráfego por canal com filtro de país
  getTrafficByChannel: publicProcedure
    .input(z.object({ countryFilter: z.enum(["all", "brazil", "others"]).default("all") }))
    .query(({ input }) => {
      // Com filtro de país, ajustamos proporcionalmente
      // Brasil = 16.4% do total, EUA+outros = 83.6%
      const multiplier = input.countryFilter === "brazil" ? 0.164
        : input.countryFilter === "others" ? 0.836
        : 1.0;

      return GA4_TRAFFIC_BY_CHANNEL.map(ch => ({
        ...ch,
        sessions: Math.round(ch.sessions * multiplier),
        engagedSessions: Math.round(ch.engagedSessions * multiplier),
        conversions: Math.round(ch.conversions * multiplier),
      }));
    }),

  // Distribuição por país
  getCountryBreakdown: publicProcedure.query(() => {
    const total = GA4_USERS_BY_COUNTRY.reduce((s, c) => s + c.users, 0);
    return {
      countries: GA4_USERS_BY_COUNTRY,
      brazilTotal: GA4_USERS_BY_COUNTRY.filter(c => c.isBrazil).reduce((s, c) => s + c.users, 0),
      othersTotal: GA4_USERS_BY_COUNTRY.filter(c => !c.isBrazil).reduce((s, c) => s + c.users, 0),
      total,
      insight: "54% dos usuários são dos EUA — provável tráfego de bots/crawlers. Apenas 16% são do Brasil, público-alvo real da Zênite Tech.",
    };
  }),

  // Performance das páginas dos anúncios
  getAdPagesPerformance: publicProcedure
    .input(z.object({ countryFilter: z.enum(["all", "brazil", "others"]).default("all") }))
    .query(({ input }) => {
      const multiplier = input.countryFilter === "brazil" ? 0.164
        : input.countryFilter === "others" ? 0.836
        : 1.0;

      return GA4_AD_PAGES.map(p => ({
        ...p,
        sessions: Math.round(p.sessions * multiplier),
        paidSessions: Math.round(p.paidSessions * multiplier),
        organicSessions: Math.round(p.organicSessions * multiplier),
        directSessions: Math.round(p.directSessions * multiplier),
        conversions: Math.round(p.conversions * multiplier),
        // Eficiência: cliques pagos vs sessões registradas
        trackingEfficiency: p.adsClicks > 0
          ? Math.round((p.paidSessions / p.adsClicks) * 100)
          : 0,
      }));
    }),

  // Tendência semanal
  getWeeklyTrend: publicProcedure.query(() => GA4_WEEKLY_TREND),

  // Páginas mais vistas (homepage)
  getTopPages: publicProcedure.query(() => [
    { page: "Homepage", path: "/", views: 94, pct: 73.4 },
    { page: "Conteúdos", path: "/conteudos", views: 6, pct: 4.7 },
    { page: "Avant Charge", path: "/solucoes/avant-charge", views: 5, pct: 3.9 },
    { page: "Avant RH", path: "/solucoes/avant-rh", views: 3, pct: 2.3 },
    { page: "Casos de Uso", path: "/casos-de-uso", views: 3, pct: 2.3 },
    { page: "Ponto Eletrônico", path: "/ponto-eletronico-portaria-671", views: 3, pct: 2.3 },
    { page: "GuardIA Câmaras Frias", path: "/solucoes/guardia/camaras-frias", views: 2, pct: 1.6 },
    { page: "Outras páginas", path: "outros", views: 12, pct: 9.4 },
  ]),
});
