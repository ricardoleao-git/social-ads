/**
 * GA4 Data API Service
 * Integração com Google Analytics 4 Data API v1
 * Property: G-XN8107LBV6 (zenitetech.com)
 *
 * Requer:
 *   - GA4_SERVICE_ACCOUNT_JSON: JSON completo da Service Account (base64 ou raw JSON string)
 *   - GA4_PROPERTY_ID: ID numérico da propriedade GA4 (ex: "462784946")
 */

import { BetaAnalyticsDataClient } from "@google-analytics/data";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type CountryFilter = "all" | "brazil" | "others";

export interface GA4ChannelData {
  channel: string;
  sessions: number;
  pct: number;
  engagedSessions: number;
  engagementRate: number;
  conversions: number;
  conversionRate: number;
  color: string;
}

export interface GA4CountryData {
  country: string;
  users: number;
  pct: number;
  isBrazil: boolean;
}

export interface GA4PageData {
  page: string;
  sessions: number;
  conversions: number;
  bounceRate: number;
  avgDuration: string;
}

export interface GA4Summary {
  totalSessions: number;
  totalUsers: number;
  totalConversions: number;
  avgEngagementRate: number;
  avgSessionDuration: number;
  bounceRate: number;
  period: string;
  dataSource: string;
  propertyId: string;
  lastUpdated: string;
  googleAdsLinkWarning?: string;
  countryFilter?: CountryFilter;
}

export interface GA4WeeklyTrend {
  week: string;
  pago: number;
  organico: number;
  direto: number;
  social: number;
}

// ─── Cores por canal ───────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  "Organic Search": "#10b981",
  "Paid Search": "#3b82f6",
  "Direct": "#8b5cf6",
  "Social": "#f59e0b",
  "Referral": "#ef4444",
  "Email": "#06b6d4",
  "Organic Social": "#f59e0b",
  "Unassigned": "#94a3b8",
  "Display": "#ec4899",
  "(Other)": "#6b7280",
};

function getChannelColor(channel: string): string {
  return CHANNEL_COLORS[channel] ?? "#94a3b8";
}

function translateChannel(channel: string): string {
  const map: Record<string, string> = {
    "Organic Search": "Orgânico (SEO)",
    "Paid Search": "Google Ads (Pago)",
    "Direct": "Direto",
    "Social": "Redes Sociais",
    "Organic Social": "Redes Sociais",
    "Referral": "Referência",
    "Email": "E-mail",
    "Display": "Display",
    "Unassigned": "Não Atribuído",
    "(Other)": "Outros",
  };
  return map[channel] ?? channel;
}

// ─── Inicialização do cliente ──────────────────────────────────────────────────

function getGA4Client(): BetaAnalyticsDataClient | null {
  const serviceAccountJson = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) return null;

  try {
    let credentials: object;
    if (serviceAccountJson.startsWith("{")) {
      credentials = JSON.parse(serviceAccountJson);
    } else {
      credentials = JSON.parse(Buffer.from(serviceAccountJson, "base64").toString("utf-8"));
    }
    return new BetaAnalyticsDataClient({ credentials } as any);
  } catch (err) {
    console.error("[GA4Service] Erro ao inicializar cliente:", err);
    return null;
  }
}

function getPropertyId(): string {
  return process.env.GA4_PROPERTY_ID ?? "";
}

function periodToDates(period: "7d" | "14d" | "30d" | "90d"): { startDate: string; endDate: string } {
  const days = period === "7d" ? 7 : period === "14d" ? 14 : period === "30d" ? 30 : 90;
  return { startDate: `${days}daysAgo`, endDate: "today" };
}

function safeNum(val: string | null | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Gera o dimensionFilter da GA4 Data API para filtrar por país.
 * - "brazil": apenas Brasil
 * - "others": exclui Brasil (NOT_CONTAINS_CASE_SENSITIVE não existe; usamos filtro de exclusão)
 * - "all": sem filtro
 */
function buildCountryDimensionFilter(countryFilter: CountryFilter): any | undefined {
  if (countryFilter === "brazil") {
    return {
      filter: {
        fieldName: "country",
        stringFilter: {
          matchType: "EXACT",
          value: "Brazil",
          caseSensitive: true,
        },
      },
    };
  }
  if (countryFilter === "others") {
    // Exclui Brasil — usa notExpression
    return {
      notExpression: {
        filter: {
          fieldName: "country",
          stringFilter: {
            matchType: "EXACT",
            value: "Brazil",
            caseSensitive: true,
          },
        },
      },
    };
  }
  return undefined; // "all" — sem filtro
}

// ─── Funções principais ────────────────────────────────────────────────────────

export async function getTrafficByChannel(
  period: "7d" | "14d" | "30d" | "90d" = "30d",
  countryFilter: CountryFilter = "all"
): Promise<{
  channels: GA4ChannelData[];
  isReal: boolean;
  source: string;
}> {
  const client = getGA4Client();
  const propertyId = getPropertyId();
  if (!client || !propertyId) return { channels: [], isReal: false, source: "no_credentials" };

  try {
    const { startDate, endDate } = periodToDates(period);
    const dimensionFilter = buildCountryDimensionFilter(countryFilter);
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [
        { name: "sessions" },
        { name: "engagedSessions" },
        { name: "conversions" },
        { name: "engagementRate" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });

    const rows = response.rows ?? [];
    const totalSessions = rows.reduce((s, r) => s + safeNum(r.metricValues?.[0]?.value), 0);

    const channels: GA4ChannelData[] = rows.map((row) => {
      const rawChannel = row.dimensionValues?.[0]?.value ?? "Unknown";
      const sessions = safeNum(row.metricValues?.[0]?.value);
      const engagedSessions = safeNum(row.metricValues?.[1]?.value);
      const conversions = safeNum(row.metricValues?.[2]?.value);
      const engagementRate = safeNum(row.metricValues?.[3]?.value) * 100;
      const pct = totalSessions > 0 ? Math.round((sessions / totalSessions) * 1000) / 10 : 0;
      const conversionRate = sessions > 0 ? Math.round((conversions / sessions) * 10000) / 100 : 0;
      return {
        channel: translateChannel(rawChannel),
        sessions,
        pct,
        engagedSessions,
        engagementRate: Math.round(engagementRate * 10) / 10,
        conversions,
        conversionRate,
        color: getChannelColor(rawChannel),
      };
    });

    return { channels, isReal: true, source: `GA4 Property ${propertyId}` };
  } catch (err: any) {
    console.error("[GA4Service] getTrafficByChannel erro:", err?.message);
    return { channels: [], isReal: false, source: `error: ${err?.message}` };
  }
}

export async function getCountryBreakdown(period: "7d" | "14d" | "30d" | "90d" = "30d"): Promise<{
  countries: GA4CountryData[];
  isReal: boolean;
  source: string;
}> {
  const client = getGA4Client();
  const propertyId = getPropertyId();
  if (!client || !propertyId) return { countries: [], isReal: false, source: "no_credentials" };

  try {
    const { startDate, endDate } = periodToDates(period);
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 15,
    });

    const rows = response.rows ?? [];
    const totalUsers = rows.reduce((s, r) => s + safeNum(r.metricValues?.[0]?.value), 0);

    const countries: GA4CountryData[] = rows.map((row) => {
      const country = row.dimensionValues?.[0]?.value ?? "Unknown";
      const users = safeNum(row.metricValues?.[0]?.value);
      const pct = totalUsers > 0 ? Math.round((users / totalUsers) * 1000) / 10 : 0;
      return { country, users, pct, isBrazil: country === "Brazil" };
    });

    return { countries, isReal: true, source: `GA4 Property ${propertyId}` };
  } catch (err: any) {
    console.error("[GA4Service] getCountryBreakdown erro:", err?.message);
    return { countries: [], isReal: false, source: `error: ${err?.message}` };
  }
}

export async function getTopPages(
  period: "7d" | "14d" | "30d" | "90d" = "30d",
  countryFilter: CountryFilter = "all"
): Promise<{
  pages: GA4PageData[];
  isReal: boolean;
  source: string;
}> {
  const client = getGA4Client();
  const propertyId = getPropertyId();
  if (!client || !propertyId) return { pages: [], isReal: false, source: "no_credentials" };

  try {
    const { startDate, endDate } = periodToDates(period);
    const dimensionFilter = buildCountryDimensionFilter(countryFilter);
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "sessions" },
        { name: "conversions" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
      ],
      orderBys: [{ metric: { metricName: "conversions" }, desc: true }],
      limit: 10,
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });

    const rows = response.rows ?? [];
    const pages: GA4PageData[] = rows.map((row) => {
      const page = row.dimensionValues?.[0]?.value ?? "/";
      const sessions = safeNum(row.metricValues?.[0]?.value);
      const conversions = safeNum(row.metricValues?.[1]?.value);
      const bounceRate = Math.round(safeNum(row.metricValues?.[2]?.value) * 100);
      const avgDurationSec = safeNum(row.metricValues?.[3]?.value);
      return { page, sessions, conversions, bounceRate, avgDuration: formatDuration(avgDurationSec) };
    });

    return { pages, isReal: true, source: `GA4 Property ${propertyId}` };
  } catch (err: any) {
    console.error("[GA4Service] getTopPages erro:", err?.message);
    return { pages: [], isReal: false, source: `error: ${err?.message}` };
  }
}

export async function getGA4Summary(
  period: "7d" | "14d" | "30d" | "90d" = "30d",
  countryFilter: CountryFilter = "brazil"
): Promise<{
  summary: GA4Summary | null;
  isReal: boolean;
  source: string;
}> {
  const client = getGA4Client();
  const propertyId = getPropertyId();
  if (!client || !propertyId) return { summary: null, isReal: false, source: "no_credentials" };

  try {
    const { startDate, endDate } = periodToDates(period);
    const dimensionFilter = buildCountryDimensionFilter(countryFilter);
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "conversions" },
        { name: "engagementRate" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });

    const row = response.rows?.[0];
    if (!row) return { summary: null, isReal: false, source: "empty_response" };

    const filterLabel = countryFilter === "brazil" ? " · 🇧🇷 Somente Brasil" : countryFilter === "others" ? " · 🌍 Excluindo Brasil" : "";
    const summary: GA4Summary = {
      totalSessions: safeNum(row.metricValues?.[0]?.value),
      totalUsers: safeNum(row.metricValues?.[1]?.value),
      totalConversions: safeNum(row.metricValues?.[2]?.value),
      avgEngagementRate: Math.round(safeNum(row.metricValues?.[3]?.value) * 1000) / 10,
      avgSessionDuration: safeNum(row.metricValues?.[4]?.value),
      bounceRate: Math.round(safeNum(row.metricValues?.[5]?.value) * 1000) / 10,
      period,
      dataSource: `Google Analytics 4 — Property G-XN8107LBV6 (zenitetech.com)${filterLabel}`,
      propertyId,
      lastUpdated: new Date().toISOString(),
      countryFilter,
    };

    return { summary, isReal: true, source: `GA4 Property ${propertyId}` };
  } catch (err: any) {
    console.error("[GA4Service] getGA4Summary erro:", err?.message);
    return { summary: null, isReal: false, source: `error: ${err?.message}` };
  }
}

export async function getWeeklyTrend(
  period: "7d" | "14d" | "30d" | "90d" = "30d",
  countryFilter: CountryFilter = "brazil"
): Promise<{
  trend: GA4WeeklyTrend[];
  isReal: boolean;
  source: string;
}> {
  const client = getGA4Client();
  const propertyId = getPropertyId();
  if (!client || !propertyId) return { trend: [], isReal: false, source: "no_credentials" };

  try {
    const { startDate, endDate } = periodToDates(period);
    const dimensionFilter = buildCountryDimensionFilter(countryFilter);
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "week" }, { name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "week" } }],
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });

    const rows = response.rows ?? [];
    const weekMap: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      const week = row.dimensionValues?.[0]?.value ?? "?";
      const channel = row.dimensionValues?.[1]?.value ?? "Unknown";
      const sessions = safeNum(row.metricValues?.[0]?.value);
      if (!weekMap[week]) weekMap[week] = {};
      weekMap[week][channel] = (weekMap[week][channel] ?? 0) + sessions;
    }

    const trend: GA4WeeklyTrend[] = Object.entries(weekMap).map(([week, channels]) => ({
      week: `Sem ${week}`,
      pago: (channels["Paid Search"] ?? 0) + (channels["Display"] ?? 0),
      organico: channels["Organic Search"] ?? 0,
      direto: channels["Direct"] ?? 0,
      social: (channels["Social"] ?? 0) + (channels["Organic Social"] ?? 0),
    }));

    return { trend, isReal: true, source: `GA4 Property ${propertyId}` };
  } catch (err: any) {
    console.error("[GA4Service] getWeeklyTrend erro:", err?.message);
    return { trend: [], isReal: false, source: `error: ${err?.message}` };
  }
}

export function isGA4Configured(): boolean {
  return !!process.env.GA4_SERVICE_ACCOUNT_JSON && !!process.env.GA4_PROPERTY_ID;
}

// ─── Verificação real de vinculação GA4 ↔ Google Ads ──────────────────────────

export interface GoogleAdsLinkStatus {
  linked: boolean;
  customerId?: string;
  linkedAt?: string;
  error?: string;
  checkedAt: string;
}

let _cachedLinkStatus: GoogleAdsLinkStatus | null = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

/**
 * Verifica se a propriedade GA4 tem um Google Ads Link ativo.
 * Usa a GA4 Admin API v1alpha via HTTP com access token da service account.
 * Cache de 6 horas para evitar chamadas excessivas.
 */
export async function checkGoogleAdsLink(): Promise<GoogleAdsLinkStatus> {
  const now = Date.now();
  if (_cachedLinkStatus && now < _cacheExpiry) {
    return _cachedLinkStatus;
  }

  const checkedAt = new Date().toISOString();

  if (!isGA4Configured()) {
    return { linked: false, error: "GA4 não configurado (service account ausente)", checkedAt };
  }

  try {
    const serviceAccountJson = process.env.GA4_SERVICE_ACCOUNT_JSON!;
    let credentials: any;
    if (serviceAccountJson.startsWith("{")) {
      credentials = JSON.parse(serviceAccountJson);
    } else {
      credentials = JSON.parse(Buffer.from(serviceAccountJson, "base64").toString("utf-8"));
    }

    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
    const client = await auth.getClient();
    const tokenResponse = await (client as any).getAccessToken();
    const accessToken = tokenResponse?.token;

    if (!accessToken) {
      return { linked: false, error: "Falha ao obter access token da service account", checkedAt };
    }

    const propertyId = getPropertyId();
    const url = `https://analyticsadmin.googleapis.com/v1alpha/properties/${propertyId}/googleAdsLinks`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 403) {
        return {
          linked: false,
          error: "Service account sem permissão de Administrador no GA4 — eleve para Editor ou Administrador",
          checkedAt,
        };
      }
      return { linked: false, error: `GA4 Admin API retornou ${res.status}: ${errText.slice(0, 200)}`, checkedAt };
    }

    const data = await res.json() as any;
    const links: any[] = data.googleAdsLinks ?? [];

    if (links.length === 0) {
      const result: GoogleAdsLinkStatus = { linked: false, checkedAt };
      _cachedLinkStatus = result;
      _cacheExpiry = now + CACHE_TTL_MS;
      return result;
    }

    const firstLink = links[0];
    const result: GoogleAdsLinkStatus = {
      linked: true,
      customerId: firstLink.customerId ?? firstLink.name?.split("/").pop(),
      linkedAt: firstLink.createTime ?? undefined,
      checkedAt,
    };
    _cachedLinkStatus = result;
    _cacheExpiry = now + CACHE_TTL_MS;
    return result;
  } catch (err: any) {
    console.error("[GA4Service] checkGoogleAdsLink erro:", err?.message);
    return { linked: false, error: err?.message ?? "Erro desconhecido", checkedAt };
  }
}

/**
 * Retorna distribuição de sessões e conversões por tipo de dispositivo.
 */
export async function getDeviceBreakdown(
  period: "7d" | "14d" | "30d" | "90d" = "30d",
  countryFilter: CountryFilter = "all"
): Promise<{
  devices: Array<{ device: string; sessions: number; conversions: number; pct: number; color: string }>;
  isReal: boolean;
}> {
  const client = getGA4Client();
  const propertyId = getPropertyId();
  if (!client || !propertyId) {
    return {
      devices: [
        { device: "Mobile", sessions: 210, conversions: 42, pct: 62, color: "#3b82f6" },
        { device: "Desktop", sessions: 105, conversions: 18, pct: 31, color: "#10b981" },
        { device: "Tablet", sessions: 24, conversions: 6, pct: 7, color: "#f59e0b" },
      ],
      isReal: false,
    };
  }
  try {
    const { startDate, endDate } = periodToDates(period);
    const dimensionFilter = buildCountryDimensionFilter(countryFilter);
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }, { name: "conversions" }],
      ...(dimensionFilter ? { dimensionFilter } : {}),
    });
    const rows = response.rows ?? [];
    const total = rows.reduce((s, r) => s + safeNum(r.metricValues?.[0]?.value), 0);
    const DEVICE_COLORS: Record<string, string> = {
      mobile: "#3b82f6",
      desktop: "#10b981",
      tablet: "#f59e0b",
    };
    const DEVICE_LABELS: Record<string, string> = {
      mobile: "Mobile",
      desktop: "Desktop",
      tablet: "Tablet",
    };
    const devices = rows.map(r => {
      const raw = (r.dimensionValues?.[0]?.value ?? "other").toLowerCase();
      const sessions = safeNum(r.metricValues?.[0]?.value);
      const conversions = Math.round(safeNum(r.metricValues?.[1]?.value));
      return {
        device: DEVICE_LABELS[raw] ?? raw,
        sessions,
        conversions,
        pct: total > 0 ? Math.round((sessions / total) * 1000) / 10 : 0,
        color: DEVICE_COLORS[raw] ?? "#94a3b8",
      };
    }).sort((a, b) => b.sessions - a.sessions);
    return { devices, isReal: true };
  } catch (err: any) {
    console.error("[GA4Service] getDeviceBreakdown erro:", err?.message);
    return {
      devices: [
        { device: "Mobile", sessions: 210, conversions: 42, pct: 62, color: "#3b82f6" },
        { device: "Desktop", sessions: 105, conversions: 18, pct: 31, color: "#10b981" },
        { device: "Tablet", sessions: 24, conversions: 6, pct: 7, color: "#f59e0b" },
      ],
      isReal: false,
    };
  }
}

/** Invalida o cache de vinculação (útil após mudanças manuais) */
export function invalidateGoogleAdsLinkCache(): void {
  _cachedLinkStatus = null;
  _cacheExpiry = 0;
}
