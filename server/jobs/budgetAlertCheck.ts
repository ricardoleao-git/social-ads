/**
 * Job: Alerta de Orçamento Esgotando (A2)
 * Roda a cada 2h em horário comercial (8h–18h, America/Sao_Paulo)
 *
 * Detecta campanhas com >80% do orçamento diário consumido antes das 16h.
 * Gera alerta na tabela alert_history + notifyOwner().
 */
import cron from "node-cron";
import {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
} from "../credentials";
import { getDb } from "../db";
import { alertHistory } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { getAlertEmails } from "../helpers/getAlertEmails";
import { execSync } from "child_process";

const BUDGET_THRESHOLD = 0.8; // 80%

export async function runBudgetAlertCheck() {
  console.log("[BudgetAlert] Verificando orçamentos das campanhas...");
  try {
    const now = new Date();
    const hour = now.getHours();
    // Só alerta antes das 16h (horário de Brasília)
    if (hour >= 16) {
      console.log("[BudgetAlert] Após 16h — verificação ignorada.");
      return;
    }

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

    const today = new Date().toISOString().split("T")[0];
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign_budget.amount_micros,
        metrics.cost_micros
      FROM campaign
      WHERE segments.date = '${today}'
        AND campaign.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 20
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

    const db = await getDb();
    if (!db) return;

    const alerts: string[] = [];
    for (const row of adsData.results) {
      const campaignName = row.campaign?.name || "Campanha";
      const budgetMicros = row.campaignBudget?.amountMicros || 0;
      const spentMicros = row.metrics?.costMicros || 0;
      if (budgetMicros <= 0) continue;
      const ratio = spentMicros / budgetMicros;
      if (ratio >= BUDGET_THRESHOLD) {
        const pct = (ratio * 100).toFixed(1);
        const spent = (spentMicros / 1_000_000).toFixed(2);
        const budget = (budgetMicros / 1_000_000).toFixed(2);
        alerts.push(`"${campaignName}": ${pct}% (R$${spent}/R$${budget})`);
      }
    }

    if (alerts.length > 0) {
      const msg = `${alerts.length} campanha(s) com >${(BUDGET_THRESHOLD * 100).toFixed(0)}% do orçamento diário consumido antes das 16h:\n${alerts.join("\n")}`;
      await db.insert(alertHistory).values({
        type: "budget_alert",
        severity: "warning",
        title: `${alerts.length} campanha(s) com orçamento quase esgotado`,
        message: msg,
        metadata: JSON.stringify({ alerts, hour, threshold: BUDGET_THRESHOLD }),
      });
      await notifyOwner({
        title: `⚠️ Orçamento esgotando — ${alerts.length} campanha(s)`,
        content: msg,
      });
      // Enviar e-mail para todos os destinatários configurados no banco
      const recipients = await getAlertEmails();
      const subject = `⚠️ Alerta de Orçamento Google Ads — ${alerts.length} campanha(s) acima de 80%`;
      const emailBody = `**Alerta de Orçamento Diário — Zênite Tech**\n\n📅 Hora: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n\n${msg}\n\n**Ação recomendada:** Acesse o painel e revise os grupos de baixo desempenho.\n\n🔗 https://social-ads.zenitetech.com`;
      for (const email of recipients) {
        try {
          const payload = JSON.stringify({ to: email, subject, body: emailBody });
          execSync(`manus-mcp-cli tool call send_email --server gmail --input '${payload.replace(/'/g, "'\''")}' `, { timeout: 30000 });
          console.log(`[BudgetAlert] E-mail enviado para ${email}`);
        } catch (emailErr) {
          console.error(`[BudgetAlert] Erro ao enviar e-mail para ${email}:`, emailErr);
        }
      }
      console.log(`[BudgetAlert] ${alerts.length} alerta(s) gerado(s).`);
    } else {
      console.log("[BudgetAlert] Orçamentos dentro do limite.");
    }
  } catch (err: any) {
    console.error("[BudgetAlert] Erro:", err?.message || err);
  }
}

// A cada 2h em horário comercial (8h, 10h, 12h, 14h, 16h)
cron.schedule(
  "0 0 8,10,12,14,16 * * *",
  () => { runBudgetAlertCheck(); },
  { timezone: "America/Sao_Paulo" }
);
console.log("[BudgetAlert] Job agendado: a cada 2h (8h–16h, America/Sao_Paulo)");
