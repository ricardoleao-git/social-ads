/**
 * impressionShareAlert.ts
 * Job diário: verifica parcela de impressões perdidas por orçamento e ranking.
 * Se budget_lost > 20%, envia alerta por e-mail.
 * Roda 2x/dia: 10:00 e 16:00 BRT.
 */
import cron from "node-cron";
import { execSync } from "child_process";
import { notifyOwner } from "../_core/notification";
import { getAlertEmails } from "../helpers/getAlertEmails";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { buildCustomerClient } from "../routers/googleAds";

const BUDGET_LOST_THRESHOLD = 0.20; // 20%

export async function checkImpressionShareAlert() {
  const now = new Date();
  console.log(`[ImpressionShareAlert] Verificando parcela de impressões perdidas... ${now.toISOString()}`);

  try {
    const client = getGoogleAdsClient();
    const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());

    // Buscar dados dos últimos 7 dias para campanhas de pesquisa ativas
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.search_impression_share,
        metrics.search_budget_lost_impression_share,
        metrics.search_rank_lost_impression_share,
        metrics.search_top_impression_share
      FROM campaign
      WHERE segments.date DURING LAST_7_DAYS
      AND campaign.status = 'ENABLED'
      AND campaign.advertising_channel_type = 'SEARCH'
    `;

    const rows = await customer.query(query);
    if (!rows || rows.length === 0) {
      console.log("[ImpressionShareAlert] Nenhuma campanha de pesquisa ativa encontrada.");
      return;
    }

    const alerts: {
      name: string;
      impressionShare: number;
      budgetLost: number;
      rankLost: number;
      topShare: number;
      impressions: number;
      spend: number;
    }[] = [];

    for (const row of rows) {
      const budgetLost = Number(row.metrics?.search_budget_lost_impression_share ?? 0);
      const rankLost = Number(row.metrics?.search_rank_lost_impression_share ?? 0);
      const imprShare = Number(row.metrics?.search_impression_share ?? 0);
      const topShare = Number(row.metrics?.search_top_impression_share ?? 0);
      const impressions = Number(row.metrics?.impressions ?? 0);
      const spend = Number(row.metrics?.cost_micros ?? 0) / 1e6;

      if (budgetLost >= BUDGET_LOST_THRESHOLD) {
        alerts.push({
          name: String(row.campaign?.name ?? "Campanha"),
          impressionShare: Math.round(imprShare * 100),
          budgetLost: Math.round(budgetLost * 100),
          rankLost: Math.round(rankLost * 100),
          topShare: Math.round(topShare * 100),
          impressions,
          spend,
        });
      }
    }

    if (alerts.length === 0) {
      console.log("[ImpressionShareAlert] Nenhuma campanha com budget_lost > 20%. OK.");
      return;
    }

    // Montar e-mail
    const timestamp = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const subject = `⚠️ Alerta: Impressões Perdidas por Orçamento — ${alerts.length} campanha(s) acima de 20%`;

    let body = `<h2>⚠️ Alerta de Impressões Perdidas por Orçamento</h2>`;
    body += `<p><strong>Data/Hora:</strong> ${timestamp}</p>`;
    body += `<p>As seguintes campanhas estão perdendo mais de 20% das impressões por orçamento insuficiente:</p>`;
    body += `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;">`;
    body += `<tr style="background:#f2f2f2;"><th>Campanha</th><th>Parcela de Impressões</th><th>Perdidas (Orçamento)</th><th>Perdidas (Ranking)</th><th>Topo</th><th>Impressões</th><th>Gasto (R$)</th></tr>`;

    for (const a of alerts) {
      const budgetColor = a.budgetLost >= 30 ? "#dc2626" : "#f59e0b";
      body += `<tr>`;
      body += `<td><strong>${a.name}</strong></td>`;
      body += `<td>${a.impressionShare}%</td>`;
      body += `<td style="color:${budgetColor};font-weight:bold;">${a.budgetLost}%</td>`;
      body += `<td>${a.rankLost}%</td>`;
      body += `<td>${a.topShare}%</td>`;
      body += `<td>${a.impressions.toLocaleString("pt-BR")}</td>`;
      body += `<td>R$ ${a.spend.toFixed(2)}</td>`;
      body += `</tr>`;
    }
    body += `</table>`;
    body += `<br/><h3>Ações Recomendadas:</h3>`;
    body += `<ol>`;
    body += `<li>Avaliar aumento de orçamento diário nas campanhas afetadas</li>`;
    body += `<li>Pausar grupos de anúncios com baixo desempenho para redistribuir orçamento</li>`;
    body += `<li>Revisar palavras-chave de alto custo sem conversão</li>`;
    body += `<li>Considerar ajuste de lances para reduzir CPC médio</li>`;
    body += `</ol>`;
    body += `<p>🔗 <a href="https://social-ads.zenitetech.com">Ver Dashboard Completo →</a></p>`;

    // Enviar e-mail
    const recipients = await getAlertEmails();
    console.log(`[ImpressionShareAlert] Enviando alerta para: ${recipients.join(", ")}`);

    for (const email of recipients) {
      try {
        const payload = JSON.stringify({ to: email, subject, body });
        execSync(
          `manus-mcp-cli tool call send_email --server gmail --input '${payload.replace(/'/g, "'\\''")}'`,
          { timeout: 30000 }
        );
        console.log(`[ImpressionShareAlert] E-mail enviado para ${email}`);
      } catch (err) {
        console.error(`[ImpressionShareAlert] Erro ao enviar e-mail para ${email}:`, err);
      }
    }

    // Notificação in-app
    await notifyOwner({
      title: `⚠️ Impressões Perdidas: ${alerts.length} campanha(s) com budget_lost > 20%`,
      content: alerts.map(a => `${a.name}: ${a.budgetLost}% perdidas por orçamento`).join("; "),
    });

    console.log("[ImpressionShareAlert] Alerta enviado com sucesso.");
  } catch (err) {
    console.error("[ImpressionShareAlert] Erro:", err);
  }
}

export function scheduleImpressionShareAlert() {
  // 2x/dia: 10:00 e 16:00 BRT (13:00 e 19:00 UTC)
  cron.schedule("0 10,16 * * *", async () => {
    await checkImpressionShareAlert();
  }, { timezone: "America/Sao_Paulo" });
  console.log("[ImpressionShareAlert] Agendado para 10:00 e 16:00 BRT diariamente.");
}
