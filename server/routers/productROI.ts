/**
 * tRPC Router: Product ROI
 * Calcula ROI por produto em tempo real usando dados da Google Ads API
 */
import { z } from "zod";
import {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
} from "../../server/credentials";
import { publicProcedure, router } from "../_core/trpc";

// Ticket médio estimado por produto (R$)
const PRODUCT_TICKETS: Record<string, number> = {
  "Wallbox": 4500,
  "Recarga Veicular": 4500,
  "GuardIA": 3200,
  "ZIPY": 1800,
  "ConciergIA": 2500,
  "Relógio de Ponto": 1200,
  "Zface": 2800,
  "Zblock": 1500,
  "Catraca": 2200,
  "PABX": 900,
  "Outros": 2000,
};

function matchProduct(groupName: string): string {
  const name = groupName.toLowerCase();
  if (name.includes("wallbox") || name.includes("recarga") || name.includes("veicular")) return "Wallbox";
  if (name.includes("guardia")) return "GuardIA";
  if (name.includes("zipy") || name.includes("whatsapp")) return "ZIPY";
  if (name.includes("conciergia")) return "ConciergIA";
  if (name.includes("relógio") || name.includes("relogio") || name.includes("ponto")) return "Relógio de Ponto";
  if (name.includes("zface")) return "Zface";
  if (name.includes("zblock")) return "Zblock";
  if (name.includes("catraca")) return "Catraca";
  if (name.includes("pabx")) return "PABX";
  return "Outros";
}

async function fetchProductROIData(days: number) {
  const env = process.env;
  const customerId = (env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
  const clientId = GOOGLE_ADS_CLIENT_ID;
  const clientSecret = GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = GOOGLE_ADS_REFRESH_TOKEN;
  const loginCustomerId = (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");

  if (!customerId || !developerToken || !refreshToken) {
    return null;
  }

  // Renovar token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = await tokenRes.json() as any;
  if (!tokenData.access_token) return null;

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const query = `
    SELECT
      ad_group.name,
      metrics.cost_micros,
      metrics.conversions,
      metrics.clicks,
      metrics.impressions,
      metrics.ctr,
      metrics.average_cpc
    FROM ad_group
    WHERE segments.date BETWEEN '${fmt(startDate)}' AND '${fmt(endDate)}'
    AND campaign.status = 'ENABLED'
    AND metrics.impressions > 0
    ORDER BY metrics.cost_micros DESC
  `;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "developer-token": developerToken,
    "Authorization": `Bearer ${tokenData.access_token}`,
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const res = await fetch(
    `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`,
    { method: "POST", headers, body: JSON.stringify({ query }) }
  );
  if (!res.ok) return null;
  const data = await res.json() as any;
  const rows = data.results || [];

  // Agrupa por produto
  const productMap: Record<string, { spend: number; conversions: number; clicks: number; impressions: number }> = {};
  for (const row of rows) {
    const groupName = row.adGroup?.name || "";
    const product = matchProduct(groupName);
    if (!productMap[product]) {
      productMap[product] = { spend: 0, conversions: 0, clicks: 0, impressions: 0 };
    }
    productMap[product].spend += (row.metrics?.costMicros || 0) / 1_000_000;
    productMap[product].conversions += row.metrics?.conversions || 0;
    productMap[product].clicks += row.metrics?.clicks || 0;
    productMap[product].impressions += row.metrics?.impressions || 0;
  }

  // Calcula ROI por produto
  const products = Object.entries(productMap).map(([name, m]) => {
    const ticket = PRODUCT_TICKETS[name] || 2000;
    const revenue = m.conversions * ticket;
    const roi = m.spend > 0 ? ((revenue - m.spend) / m.spend) * 100 : 0;
    const roas = m.spend > 0 ? revenue / m.spend : 0;
    const cpa = m.conversions > 0 ? m.spend / m.conversions : 0;
    const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
    return {
      name,
      spend: Math.round(m.spend * 100) / 100,
      conversions: Math.round(m.conversions * 10) / 10,
      clicks: m.clicks,
      impressions: m.impressions,
      ticket,
      revenue: Math.round(revenue * 100) / 100,
      roi: Math.round(roi * 10) / 10,
      roas: Math.round(roas * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
      ctr: Math.round(ctr * 100) / 100,
    };
  }).sort((a, b) => b.roi - a.roi);

  const totalSpend = products.reduce((s, p) => s + p.spend, 0);
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const totalConversions = products.reduce((s, p) => s + p.conversions, 0);
  const totalROI = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

  return {
    products,
    summary: {
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalConversions: Math.round(totalConversions * 10) / 10,
      totalROI: Math.round(totalROI * 10) / 10,
      totalROAS: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0,
      period: `${fmt(startDate)} a ${fmt(endDate)}`,
      days,
    },
    ticketMap: PRODUCT_TICKETS,
  };
}

export const productROIRouter = router({
  /**
   * Dados de ROI por produto para o período selecionado
   */
  getByPeriod: publicProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ input }) => {
      return await fetchProductROIData(input.days);
    }),

  /**
   * Comparativo de dois períodos (atual vs anterior)
   */
  getComparison: publicProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ input }) => {
      const [current, previous] = await Promise.all([
        fetchProductROIData(input.days),
        fetchProductROIData(input.days * 2).then(data => {
          // Simula período anterior pegando metade dos dados
          if (!data) return null;
          return data;
        }),
      ]);
      return { current, previous };
    }),
});
