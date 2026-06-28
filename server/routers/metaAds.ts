/**
 * tRPC router for Meta Ads (Facebook/Instagram Ads) integration.
 * Uses Meta Graph API when META_ADS_ACCESS_TOKEN is configured.
 * Falls back to realistic simulated data when token is not available.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { buildDateFilter, buildCustomerClient } from "./googleAds";
import { META_ACCESS_TOKEN } from "../credentials";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MetaCampaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  cpm: number;
  cpc: number;
  ctr: number;
  conversions: number;
  costPerConversion: number;
  frequency: number;
}

export interface MetaSummary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  totalConversions: number;
  avgCpm: number;
  avgCpc: number;
  avgCtr: number;
  avgFrequency: number;
  dateRange: string;
}

export interface MetaDailyTrend {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  cpm: number;
  cpc: number;
  ctr: number;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaignName: string;
  status: "ACTIVE" | "PAUSED";
  targeting: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  frequency: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Known Zênite Tech ad accounts with data
export const ZENITE_META_ACCOUNTS = [
  { id: "140041686391058", name: "Ricardo Leão (Principal)", hasData: true },
  { id: "689018166724593", name: "ZÊNITE TECH (Cartão)", hasData: true },
  { id: "1371568497098094", name: "ZENITE TECH", hasData: false },
  { id: "349408795951737", name: "Zênite Tech", hasData: false },
  { id: "2123093018063129", name: "AVANT CLUB", hasData: false },
];

function getMetaToken(): string | null {
  return META_ACCESS_TOKEN || null;
}

function getMetaAdAccountId(): string | null {
  return process.env.META_ADS_ACCOUNT_ID ?? null;
}

function buildDateRange(period: string, startDate?: string, endDate?: string): { since: string; until: string } {
  if (period === "custom" && startDate && endDate) {
    return { since: startDate, until: endDate };
  }
  const today = new Date();
  const until = today.toISOString().split("T")[0];
  const daysBack = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const start = new Date(today);
  start.setDate(today.getDate() - daysBack);
  const since = start.toISOString().split("T")[0];
  return { since, until };
}

// ─── Simulated data (used when token is not configured) ───────────────────────
function getSimulatedSummary(period: string): MetaSummary {
  const multiplier = period === "7d" ? 1 : period === "90d" ? 12 : 4;
  return {
    totalSpend: 1240.50 * multiplier,
    totalImpressions: 48200 * multiplier,
    totalClicks: 1850 * multiplier,
    totalReach: 32400 * multiplier,
    totalConversions: 42 * multiplier,
    avgCpm: 25.74,
    avgCpc: 0.67,
    avgCtr: 3.84,
    avgFrequency: 1.49,
    dateRange: period,
  };
}

function getSimulatedCampaigns(): MetaCampaign[] {
  return [
    {
      id: "meta_001",
      name: "Wallbox — Recarga Veicular (Conversão)",
      status: "ACTIVE",
      objective: "CONVERSIONS",
      spend: 520.30,
      impressions: 22400,
      clicks: 890,
      reach: 15200,
      cpm: 23.23,
      cpc: 0.58,
      ctr: 3.97,
      conversions: 18,
      costPerConversion: 28.91,
      frequency: 1.47,
    },
    {
      id: "meta_002",
      name: "GuardIA — Condomínios (Tráfego)",
      status: "ACTIVE",
      objective: "TRAFFIC",
      spend: 380.80,
      impressions: 18600,
      clicks: 720,
      reach: 12800,
      cpm: 20.47,
      cpc: 0.53,
      ctr: 3.87,
      conversions: 14,
      costPerConversion: 27.20,
      frequency: 1.45,
    },
    {
      id: "meta_003",
      name: "ZIPY WhatsApp — Empresas (Lead Gen)",
      status: "ACTIVE",
      objective: "LEAD_GENERATION",
      spend: 220.40,
      impressions: 8400,
      clicks: 320,
      reach: 6100,
      cpm: 26.24,
      cpc: 0.69,
      ctr: 3.81,
      conversions: 8,
      costPerConversion: 27.55,
      frequency: 1.38,
    },
    {
      id: "meta_004",
      name: "ConciergIA — Atendimento IA (Awareness)",
      status: "PAUSED",
      objective: "BRAND_AWARENESS",
      spend: 119.00,
      impressions: 6800,
      clicks: 210,
      reach: 5200,
      cpm: 17.50,
      cpc: 0.57,
      ctr: 3.09,
      conversions: 2,
      costPerConversion: 59.50,
      frequency: 1.31,
    },
  ];
}

function getSimulatedAdSets(): MetaAdSet[] {
  return [
    {
      id: "adset_001",
      name: "Wallbox — Proprietários de EV — Lookalike 1%",
      campaignName: "Wallbox — Recarga Veicular (Conversão)",
      status: "ACTIVE",
      targeting: "Lookalike 1% — Clientes Wallbox",
      spend: 280.50,
      impressions: 12200,
      clicks: 490,
      conversions: 10,
      ctr: 4.02,
      cpc: 0.57,
      frequency: 1.52,
    },
    {
      id: "adset_002",
      name: "Wallbox — Interesse Veículos Elétricos",
      campaignName: "Wallbox — Recarga Veicular (Conversão)",
      status: "ACTIVE",
      targeting: "Interesse: Veículos Elétricos, Tesla, BMW",
      spend: 239.80,
      impressions: 10200,
      clicks: 400,
      conversions: 8,
      ctr: 3.92,
      cpc: 0.60,
      frequency: 1.42,
    },
    {
      id: "adset_003",
      name: "GuardIA — Síndicos e Administradoras",
      campaignName: "GuardIA — Condomínios (Tráfego)",
      status: "ACTIVE",
      targeting: "Cargo: Síndico, Administrador de Condomínio",
      spend: 210.40,
      impressions: 10800,
      clicks: 420,
      conversions: 8,
      ctr: 3.89,
      cpc: 0.50,
      frequency: 1.48,
    },
    {
      id: "adset_004",
      name: "ZIPY — Decisores de PME",
      campaignName: "ZIPY WhatsApp — Empresas (Lead Gen)",
      status: "ACTIVE",
      targeting: "Cargo: CEO, Diretor, Gerente — Empresa 10-200 func.",
      spend: 220.40,
      impressions: 8400,
      clicks: 320,
      conversions: 8,
      ctr: 3.81,
      cpc: 0.69,
      frequency: 1.38,
    },
  ];
}

function getSimulatedTrends(period: string): MetaDailyTrend[] {
  const days = period === "7d" ? 7 : period === "90d" ? 30 : 14;
  const trends: MetaDailyTrend[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const base = 170 + Math.sin(i * 0.5) * 30 + Math.random() * 20;
    const impressions = Math.round(base * 200);
    const clicks = Math.round(base * 7.8);
    const reach = Math.round(impressions * 0.68);
    const spend = parseFloat((base * 1.1).toFixed(2));
    const conversions = Math.round(clicks * 0.023);
    trends.push({
      date: dateStr,
      spend,
      impressions,
      clicks,
      reach,
      conversions,
      cpm: parseFloat(((spend / impressions) * 1000).toFixed(2)),
      cpc: parseFloat((spend / clicks).toFixed(2)),
      ctr: parseFloat(((clicks / impressions) * 100).toFixed(2)),
    });
  }
  return trends;
}

// ─── Meta Graph API helpers ───────────────────────────────────────────────────
async function fetchMetaAPI(path: string, params: Record<string, string>): Promise<any> {
  const token = getMetaToken();
  if (!token) throw new Error("META_ADS_ACCESS_TOKEN not configured");
  const url = new URL(`https://graph.facebook.com/v19.0/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Meta API error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const metaAdsRouter = router({
  // List all known ad accounts
  getAccounts: protectedProcedure.query(async () => {
    const token = getMetaToken();
    if (!token) return { accounts: ZENITE_META_ACCOUNTS, isConfigured: false };
    try {
      const data = await fetchMetaAPI("me/adaccounts", {
        fields: "id,name,account_status",
      });
      const accounts = (data.data ?? []).map((a: any) => ({
        id: a.id.replace("act_", ""),
        name: a.name,
        hasData: ZENITE_META_ACCOUNTS.find(x => x.id === a.id.replace("act_", ""))?.hasData ?? false,
        status: a.account_status,
      }));
      return { accounts, isConfigured: true };
    } catch (e) {
      return { accounts: ZENITE_META_ACCOUNTS, isConfigured: true };
    }
  }),

  // Check if Meta Ads token is configured
  getStatus: protectedProcedure.query(async () => {
    const token = getMetaToken();
    const accountId = getMetaAdAccountId();
    return {
      isConfigured: !!token && !!accountId,
      hasToken: !!token,
      hasAccountId: !!accountId,
    };
  }),

  // Summary metrics
  getSummary: protectedProcedure
    .input(z.object({
      period: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      accountId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const token = getMetaToken();
      const accountId = input.accountId ?? getMetaAdAccountId();

      if (!token || !accountId) {
        return { ...getSimulatedSummary(input.period), isSimulated: true };
      }

      try {
        const { since, until } = buildDateRange(input.period, input.startDate, input.endDate);
        const data = await fetchMetaAPI(`act_${accountId}/insights`, {
          fields: "spend,impressions,clicks,reach,actions,cpm,cpc,ctr,frequency",
          time_range: JSON.stringify({ since, until }),
          level: "account",
        });
        const d = data.data?.[0] ?? {};
        const conversions = (d.actions ?? []).filter((a: any) =>
          ["offsite_conversion.fb_pixel_lead", "lead", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type)
        ).reduce((sum: number, a: any) => sum + parseInt(a.value ?? "0"), 0);
        const spend = parseFloat(d.spend ?? "0");
        return {
          totalSpend: spend,
          totalImpressions: parseInt(d.impressions ?? "0"),
          totalClicks: parseInt(d.clicks ?? "0"),
          totalReach: parseInt(d.reach ?? "0"),
          totalConversions: conversions,
          avgCpm: parseFloat(d.cpm ?? "0"),
          avgCpc: parseFloat(d.cpc ?? "0"),
          avgCtr: parseFloat(d.ctr ?? "0"),
          avgFrequency: parseFloat(d.frequency ?? "0"),
          dateRange: `${since} a ${until}`,
          isSimulated: false,
        };
      } catch (e) {
        console.error("[MetaAds] getSummary error:", e);
        return { ...getSimulatedSummary(input.period), isSimulated: true };
      }
    }),

  // Campaigns list
  getCampaigns: protectedProcedure
    .input(z.object({
      period: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      accountId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const token = getMetaToken();
      const accountId = input.accountId ?? getMetaAdAccountId();

      if (!token || !accountId) {
        return { campaigns: getSimulatedCampaigns(), isSimulated: true };
      }

      try {
        const { since, until } = buildDateRange(input.period, input.startDate, input.endDate);
        const data = await fetchMetaAPI(`act_${accountId}/campaigns`, {
          fields: "id,name,status,objective,insights{spend,impressions,clicks,reach,actions,cpm,cpc,ctr,frequency}",
          time_range: JSON.stringify({ since, until }),
        });
        const campaigns: MetaCampaign[] = (data.data ?? []).map((c: any) => {
          const ins = c.insights?.data?.[0] ?? {};
          const conversions = (ins.actions ?? []).filter((a: any) =>
            ["offsite_conversion.fb_pixel_lead", "lead"].includes(a.action_type)
          ).reduce((sum: number, a: any) => sum + parseInt(a.value ?? "0"), 0);
          const spend = parseFloat(ins.spend ?? "0");
          return {
            id: c.id,
            name: c.name,
            status: c.status,
            objective: c.objective,
            spend,
            impressions: parseInt(ins.impressions ?? "0"),
            clicks: parseInt(ins.clicks ?? "0"),
            reach: parseInt(ins.reach ?? "0"),
            cpm: parseFloat(ins.cpm ?? "0"),
            cpc: parseFloat(ins.cpc ?? "0"),
            ctr: parseFloat(ins.ctr ?? "0"),
            conversions,
            costPerConversion: conversions > 0 ? spend / conversions : 0,
            frequency: parseFloat(ins.frequency ?? "0"),
          };
        });
        return { campaigns, isSimulated: false };
      } catch (e) {
        console.error("[MetaAds] getCampaigns error:", e);
        return { campaigns: getSimulatedCampaigns(), isSimulated: true };
      }
    }),

  // Ad sets
  getAdSets: protectedProcedure
    .input(z.object({
      period: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
    }))
    .query(async ({ input }) => {
      const token = getMetaToken();
      if (!token) {
        return { adSets: getSimulatedAdSets(), isSimulated: true };
      }
      // Real API call would go here
      return { adSets: getSimulatedAdSets(), isSimulated: true };
    }),

  // Daily trends
  getTrends: protectedProcedure
    .input(z.object({
      period: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      accountId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const token = getMetaToken();
      const accountId = input.accountId ?? getMetaAdAccountId();

      if (!token || !accountId) {
        return { trends: getSimulatedTrends(input.period), isSimulated: true };
      }

      try {
        const { since, until } = buildDateRange(input.period, input.startDate, input.endDate);
        const data = await fetchMetaAPI(`act_${accountId}/insights`, {
          fields: "spend,impressions,clicks,reach,actions,cpm,cpc,ctr",
          time_range: JSON.stringify({ since, until }),
          time_increment: "1",
          level: "account",
        });
        const trends: MetaDailyTrend[] = (data.data ?? []).map((d: any) => {
          const conversions = (d.actions ?? []).filter((a: any) =>
            ["offsite_conversion.fb_pixel_lead", "lead"].includes(a.action_type)
          ).reduce((sum: number, a: any) => sum + parseInt(a.value ?? "0"), 0);
          const impressions = parseInt(d.impressions ?? "0");
          const clicks = parseInt(d.clicks ?? "0");
          const spend = parseFloat(d.spend ?? "0");
          return {
            date: d.date_start,
            spend,
            impressions,
            clicks,
            reach: parseInt(d.reach ?? "0"),
            conversions,
            cpm: parseFloat(d.cpm ?? "0"),
            cpc: parseFloat(d.cpc ?? "0"),
            ctr: parseFloat(d.ctr ?? "0"),
          };
        });
        return { trends, isSimulated: false };
      } catch (e) {
        console.error("[MetaAds] getTrends error:", e);
        return { trends: getSimulatedTrends(input.period), isSimulated: true };
      }
    }),

  // Google vs Meta comparison
  getComparison: protectedProcedure
    .input(z.object({
      period: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
    }))
    .query(async ({ input }) => {
      // Meta Ads data (real or simulated)
      const token = getMetaToken();
      const accountId = getMetaAdAccountId();
      let metaData: any;
      let metaSimulated = true;

      if (token && accountId) {
        try {
          const { since, until } = buildDateRange(input.period);
          const data = await fetchMetaAPI(`act_${accountId}/insights`, {
            fields: "spend,impressions,clicks,reach,actions,cpm,cpc,ctr",
            time_range: JSON.stringify({ since, until }),
            level: "account",
          });
          const d = data.data?.[0] ?? {};
          const conversions = (d.actions ?? []).filter((a: any) =>
            ["offsite_conversion.fb_pixel_lead", "lead", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type)
          ).reduce((sum: number, a: any) => sum + parseInt(a.value ?? "0"), 0);
          const spend = parseFloat(d.spend ?? "0");
          metaData = {
            spend,
            clicks: parseInt(d.clicks ?? "0"),
            conversions,
            cpc: parseFloat(d.cpc ?? "0"),
            ctr: parseFloat(d.ctr ?? "0"),
            cpm: parseFloat(d.cpm ?? "0"),
            costPerConversion: conversions > 0 ? spend / conversions : 0,
          };
          metaSimulated = false;
        } catch {
          const sim = getSimulatedSummary(input.period);
          metaData = {
            spend: sim.totalSpend, clicks: sim.totalClicks, conversions: sim.totalConversions,
            cpc: sim.avgCpc, ctr: sim.avgCtr, cpm: sim.avgCpm,
            costPerConversion: sim.totalConversions > 0 ? sim.totalSpend / sim.totalConversions : 0,
          };
        }
      } else {
        const sim = getSimulatedSummary(input.period);
        metaData = {
          spend: sim.totalSpend, clicks: sim.totalClicks, conversions: sim.totalConversions,
          cpc: sim.avgCpc, ctr: sim.avgCtr, cpm: sim.avgCpm,
          costPerConversion: sim.totalConversions > 0 ? sim.totalSpend / sim.totalConversions : 0,
        };
      }

      // Google Ads data (real)
      let googleData: any = { spend: 0, clicks: 0, conversions: 0, cpc: 0, ctr: 0, cpm: 0, costPerConversion: 0 };
      let googleSimulated = false;
      try {
        const client = getGoogleAdsClient();
        const customerId = getCustomerId();
        const refreshToken = getRefreshToken();
        const loginCustomerId = getLoginCustomerId();
        if (client && customerId && refreshToken) {
          const customer = buildCustomerClient(client, customerId, refreshToken, loginCustomerId);
          const dateFilter = buildDateFilter(input.period);
          const query = `SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.average_cpc, metrics.ctr, metrics.average_cpm FROM customer WHERE ${dateFilter}`;
          const [result] = await customer.query(query);
          if (result) {
            const m = result.metrics;
            const spend = (Number(m.cost_micros) || 0) / 1_000_000;
            const clicks = Number(m.clicks) || 0;
            const impressions = Number(m.impressions) || 0;
            const conversions = Number(m.conversions) || 0;
            googleData = {
              spend,
              clicks,
              conversions,
              cpc: (Number(m.average_cpc) || 0) / 1_000_000,
              ctr: (Number(m.ctr) || 0) * 100,
              cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
              costPerConversion: conversions > 0 ? spend / conversions : 0,
            };
          }
        }
      } catch (e) {
        console.error("[MetaAds] getComparison Google error:", e);
        googleSimulated = true;
      }

      return {
        meta: metaData,
        google: googleData,
        isSimulated: metaSimulated || googleSimulated,
      };
    }),
});
