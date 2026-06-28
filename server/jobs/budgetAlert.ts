/**
 * budgetAlert.ts
 * Job de alerta de orçamento diário — executa a cada 2 horas.
 * Verifica se o gasto do dia atual ultrapassou 80% do orçamento diário configurado.
 * Se sim, envia alerta por e-mail para todos os destinatários configurados no banco.
 */
import cron from "node-cron";
import { execSync } from "child_process";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { notifyOwner } from "../_core/notification";
import { getAlertEmails } from "../helpers/getAlertEmails";
import { sendWhatsAppAlert } from "../whatsappService";

// Limiar de alerta: 80% do orçamento diário
const ALERT_THRESHOLD = 0.80;
const DASHBOARD_URL = "https://social-ads.zenitetech.com";

// Evitar envio duplicado na mesma hora
const sentAlerts = new Set<string>();

export async function checkBudgetAlert() {
  const now = new Date();
  const hourKey = `${now.toISOString().slice(0, 13)}`; // ex: "2026-04-14T10"

  if (sentAlerts.has(hourKey)) {
    console.log(`[BudgetAlert] Alerta já enviado nesta hora (${hourKey}). Pulando.`);
    return;
  }

  console.log("[BudgetAlert] Verificando orçamento diário...");

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

    // Buscar gasto do dia atual e orçamento das campanhas ativas
    const today = now.toISOString().slice(0, 10).replace(/-/g, "");
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign_budget.amount_micros,
        metrics.cost_micros
      FROM campaign
      WHERE campaign.status = 'ENABLED'
        AND segments.date = '${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}'
    `;

    const rows = await customer.query(query);

    if (!rows || rows.length === 0) {
      console.log("[BudgetAlert] Nenhuma campanha ativa encontrada para hoje.");
      return;
    }

    // Agregar gasto total e orçamento total
    let totalSpendMicros = 0;
    let totalBudgetMicros = 0;
    const campaignAlerts: { name: string; spend: number; budget: number; pct: number }[] = [];

    for (const row of rows) {
      const spendMicros = Number(row.metrics?.cost_micros ?? 0);
      const budgetMicros = Number(row.campaign_budget?.amount_micros ?? 0);

      if (budgetMicros <= 0) continue;

      totalSpendMicros += spendMicros;
      totalBudgetMicros += budgetMicros;

      const pct = spendMicros / budgetMicros;
      if (pct >= ALERT_THRESHOLD) {
        campaignAlerts.push({
          name: row.campaign?.name ?? "Campanha",
          spend: spendMicros / 1e6,
          budget: budgetMicros / 1e6,
          pct: Math.round(pct * 100),
        });
      }
    }

    const totalPct = totalBudgetMicros > 0 ? totalSpendMicros / totalBudgetMicros : 0;
    const totalSpend = totalSpendMicros / 1e6;
    const totalBudget = totalBudgetMicros / 1e6;

    console.log(`[BudgetAlert] Gasto: R$ ${totalSpend.toFixed(2)} / Orçamento: R$ ${totalBudget.toFixed(2)} (${Math.round(totalPct * 100)}%)`);

    // Só envia alerta se ultrapassou o limiar geral OU há campanhas individuais acima
    if (totalPct < ALERT_THRESHOLD && campaignAlerts.length === 0) {
      console.log("[BudgetAlert] Orçamento dentro do limite. Nenhum alerta necessário.");
      return;
    }

    // Montar corpo do e-mail
    const timestamp = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const subject = `⚠️ Alerta de Orçamento Google Ads — ${Math.round(totalPct * 100)}% consumido`;

    let body = `**Alerta de Orçamento Diário — Zênite Tech**\n\n`;
    body += `📅 Data/Hora: ${timestamp}\n\n`;
    body += `**Resumo Geral:**\n`;
    body += `- Gasto hoje: R$ ${totalSpend.toFixed(2)}\n`;
    body += `- Orçamento diário total: R$ ${totalBudget.toFixed(2)}\n`;
    body += `- Consumo: **${Math.round(totalPct * 100)}%**\n\n`;

    if (campaignAlerts.length > 0) {
      body += `**Campanhas com orçamento crítico (≥ 80%):**\n`;
      for (const c of campaignAlerts) {
        body += `- ${c.name}: R$ ${c.spend.toFixed(2)} / R$ ${c.budget.toFixed(2)} (${c.pct}%)\n`;
      }
      body += `\n`;
    }

    body += `**Ação recomendada:** Verifique o painel do Google Ads e considere pausar grupos de baixo desempenho para preservar o orçamento.\n\n`;
    body += `🔗 Dashboard: https://social-ads.zenitetech.com\n`;

    // Enviar para todos os destinatários configurados no banco
    const recipients = await getAlertEmails();
    console.log(`[BudgetAlert] Enviando alerta para: ${recipients.join(", ")}`);

    for (const email of recipients) {
      try {
        const payload = JSON.stringify({
          to: email,
          subject,
          body,
        });
        execSync(
          `manus-mcp-cli tool call send_email --server gmail --input '${payload.replace(/'/g, "'\\''")}'`,
          { timeout: 30000 }
        );
        console.log(`[BudgetAlert] E-mail enviado para ${email}`);
      } catch (err) {
        console.error(`[BudgetAlert] Erro ao enviar e-mail para ${email}:`, err);
      }
    }

    // Notificação in-app
    await notifyOwner({
      title: `⚠️ Orçamento Google Ads: ${Math.round(totalPct * 100)}% consumido`,
      content: `Gasto hoje: R$ ${totalSpend.toFixed(2)} de R$ ${totalBudget.toFixed(2)} (${Math.round(totalPct * 100)}%). ${campaignAlerts.length > 0 ? `${campaignAlerts.length} campanha(s) com orçamento crítico.` : ""}`,
    });

    // Enviar alerta WhatsApp
    try {
      const whatsappMsg = `\u26a0\ufe0f ALERTA DE OR\u00c7AMENTO\n\nGasto hoje: R$ ${totalSpend.toFixed(2)} / R$ ${totalBudget.toFixed(2)} (${Math.round(totalPct * 100)}%)\n${campaignAlerts.length > 0 ? `\n${campaignAlerts.map(c => `\u2022 ${c.name}: ${c.pct}%`).join("\n")}\n` : ""}\nA\u00e7\u00e3o: Verifique o dashboard\n${DASHBOARD_URL ?? "https://social-ads.zenitetech.com"}`;

      await sendWhatsAppAlert({
        type: "budget_alert",
        message: whatsappMsg,
        metricValue: `${Math.round(totalPct * 100)}%`,
      });
      console.log("[BudgetAlert] Alerta WhatsApp enviado.");
    } catch (whatsErr) {
      console.warn("[BudgetAlert] Falha ao enviar WhatsApp (canal opcional):", whatsErr);
    }

    // Marcar como enviado nesta hora para evitar duplicatas
    sentAlerts.add(hourKey);
    // Limpar entradas antigas (manter apenas as últimas 48h)
    if (sentAlerts.size > 48) {
      const oldest = Array.from(sentAlerts)[0];
      sentAlerts.delete(oldest);
    }

    console.log("[BudgetAlert] Alerta enviado com sucesso.");
  } catch (err) {
    console.error("[BudgetAlert] Erro ao verificar orçamento:", err);
  }
}

// Agenda o job para executar a cada 2 horas
export function scheduleBudgetAlert() {
  // A cada 2 horas: minuto 0 de cada hora par
  cron.schedule("0 0,2,4,6,8,10,12,14,16,18,20,22 * * *", async () => {
    await checkBudgetAlert();
  }, { timezone: "America/Sao_Paulo" });
  console.log("[BudgetAlert] Job agendado: verificação de orçamento a cada 2h.");
}
