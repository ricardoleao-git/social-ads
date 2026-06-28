/**
 * Job: ROI por Produto Semanal (A5)
 * Roda toda sexta-feira às 17h (America/Sao_Paulo)
 *
 * Calcula ROI estimado por produto (Wallbox, GuardIA, ZIPY, etc.)
 * com base em conversões × ticket médio estimado.
 * Envia comparativo por e-mail via Gmail MCP + notifyOwner().
 */
import cron from "node-cron";
import {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
} from "../credentials";
import { execSync } from "child_process";
import { notifyOwner } from "../_core/notification";

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

export async function runWeeklyProductROI() {
  console.log("[ProductROI] Iniciando cálculo de ROI por produto...");
  try {
    const env = process.env;
    const customerId = (env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
    const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
    const clientId = GOOGLE_ADS_CLIENT_ID;
    const clientSecret = GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = GOOGLE_ADS_REFRESH_TOKEN;
    const loginCustomerId = (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");

    if (!customerId || !developerToken || !refreshToken) return;

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
    if (!tokenData.access_token) return;

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const query = `
      SELECT
        ad_group.name,
        metrics.cost_micros,
        metrics.conversions,
        metrics.clicks,
        metrics.impressions
      FROM ad_group
      WHERE segments.date BETWEEN '${fmt(startDate)}' AND '${fmt(endDate)}'
        AND campaign.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 50
    `;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokenData.access_token}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    };
    if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

    const adsRes = await fetch(
      `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`,
      { method: "POST", headers, body: JSON.stringify({ query }) }
    );
    const adsData = await adsRes.json() as any;
    if (!adsData.results) return;

    // Agregar por produto
    const productData: Record<string, { spend: number; conversions: number; clicks: number; impressions: number }> = {};
    for (const row of adsData.results) {
      const product = matchProduct(row.adGroup?.name || "");
      if (!productData[product]) productData[product] = { spend: 0, conversions: 0, clicks: 0, impressions: 0 };
      productData[product].spend += (row.metrics?.costMicros || 0) / 1_000_000;
      productData[product].conversions += row.metrics?.conversions || 0;
      productData[product].clicks += row.metrics?.clicks || 0;
      productData[product].impressions += row.metrics?.impressions || 0;
    }

    // Calcular ROI
    const rows: Array<{ product: string; spend: number; conversions: number; revenue: number; roi: number; cpa: number }> = [];
    for (const [product, data] of Object.entries(productData)) {
      if (data.spend === 0) continue;
      const ticket = PRODUCT_TICKETS[product] || 1500;
      const revenue = data.conversions * ticket;
      const roi = data.spend > 0 ? ((revenue - data.spend) / data.spend) * 100 : 0;
      const cpa = data.conversions > 0 ? data.spend / data.conversions : 0;
      rows.push({ product, spend: data.spend, conversions: data.conversions, revenue, roi, cpa });
    }
    rows.sort((a, b) => b.roi - a.roi);

    const best = rows[0];
    const worst = rows[rows.length - 1];
    const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalROI = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

    const period = `${fmt(startDate)} a ${fmt(endDate)}`;
    const tableRows = rows.map(r =>
      `| ${r.product} | R$${r.spend.toFixed(2)} | ${r.conversions.toFixed(0)} | R$${r.revenue.toFixed(0)} | ${r.roi.toFixed(0)}% | R$${r.cpa.toFixed(0)} |`
    ).join("\n");

    const report = `
## Relatório de ROI por Produto — ${period}

| Produto | Gasto | Conversões | Receita Est. | ROI | CPA |
|---------|-------|-----------|-------------|-----|-----|
${tableRows}

**Total:** Gasto R$${totalSpend.toFixed(2)} | Receita Est. R$${totalRevenue.toFixed(0)} | ROI ${totalROI.toFixed(0)}%

🏆 **Melhor ROI:** ${best?.product || "N/A"} (${best?.roi.toFixed(0)}%)
⚠️ **Menor ROI:** ${worst?.product || "N/A"} (${worst?.roi.toFixed(0)}%)

*Receita estimada com base em ticket médio por produto. Dados reais de conversão via Google Ads.*
    `.trim();

    // Enviar por e-mail via Gmail MCP
    try {
      const recipient = "rjll70@gmail.com";
      execSync(
        `manus-mcp-cli tool call send_email --server gmail --input '${JSON.stringify({
          to: recipient,
          subject: `📊 ROI por Produto — Semana ${period}`,
          body: report,
        }).replace(/'/g, "'\\''")}'`,
        { timeout: 30000 }
      );
      console.log("[ProductROI] E-mail enviado.");
    } catch (emailErr: any) {
      console.error("[ProductROI] Erro ao enviar e-mail:", emailErr?.message);
    }

    await notifyOwner({
      title: `📊 ROI Semanal: ${best?.product || "N/A"} lidera com ${best?.roi.toFixed(0)}% ROI`,
      content: `Total: Gasto R$${totalSpend.toFixed(2)} | Receita Est. R$${totalRevenue.toFixed(0)} | ROI ${totalROI.toFixed(0)}%`,
    });

    console.log(`[ProductROI] Relatório gerado. ${rows.length} produtos analisados.`);
  } catch (err: any) {
    console.error("[ProductROI] Erro:", err?.message || err);
  }
}

// Toda sexta-feira às 17h (America/Sao_Paulo)
cron.schedule(
  "0 0 17 * * 5",
  () => { runWeeklyProductROI(); },
  { timezone: "America/Sao_Paulo" }
);
console.log("[ProductROI] Job agendado: toda sexta às 17h (America/Sao_Paulo)");
