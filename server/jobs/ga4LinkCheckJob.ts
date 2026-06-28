/**
 * ga4LinkCheckJob.ts
 * Job diário que verifica se a vinculação GA4 ↔ Google Ads está ativa.
 * Se a vinculação cair, envia e-mail de alerta e notificação push.
 * Roda 1x por dia às 08:00 (Brasília).
 *
 * Vinculação esperada:
 *   - Property: 531461479 (zenitetech.com)
 *   - Conta Google Ads: 300-329-1643 (ZÊNITE TECH)
 *   - Vinculada em: 07/04/2026
 */

import cron from "node-cron";
import { execSync } from "child_process";
import { checkGoogleAdsLink } from "../ga4Service";
import { notifyOwner } from "../_core/notification";
import { getAlertEmails } from "../helpers/getAlertEmails";

// Evitar spam: só alerta uma vez por sessão se a vinculação cair
let _lastAlertSent: string | null = null;
let _lastStatusOk = true; // assume OK no início

async function checkGA4AdsLink() {
  console.log("[GA4LinkCheck] Verificando vinculação GA4 ↔ Google Ads...");

  const status = await checkGoogleAdsLink();

  if (status.linked) {
    console.log(`[GA4LinkCheck] ✅ Vinculação ativa — Conta: ${status.customerId}, vinculada em: ${status.linkedAt ?? "—"}`);
    _lastStatusOk = true;
    _lastAlertSent = null; // resetar para próxima falha
    return;
  }

  // Vinculação caiu ou erro
  const errorMsg = status.error ?? "Vinculação não encontrada";
  console.warn(`[GA4LinkCheck] ❌ Vinculação INATIVA — ${errorMsg}`);

  // Evitar spam: só alerta se não enviou alerta hoje
  const today = new Date().toISOString().split("T")[0];
  if (_lastAlertSent === today) {
    console.log("[GA4LinkCheck] Alerta já enviado hoje — suprimindo duplicata.");
    return;
  }

  const recipients = await getAlertEmails();
  const subject = "🚨 ALERTA: Vinculação GA4 ↔ Google Ads INATIVA — Zênite Tech";
  const content = `Zênite Tech — Dashboard de Tráfego Pago
Verificação automática de vinculação GA4 ↔ Google Ads

⚠️ ATENÇÃO: A vinculação entre o Google Analytics 4 e o Google Ads está INATIVA.

Detalhes:
  - Property GA4: 531461479 (zenitetech.com)
  - Conta Google Ads esperada: 300-329-1643 (ZÊNITE TECH)
  - Erro detectado: ${errorMsg}
  - Verificado em: ${new Date().toLocaleString("pt-BR")}

Impacto:
  - Dados de conversão do Google Ads não serão importados para o GA4
  - Relatórios de atribuição ficarão incompletos
  - Estratégia de lances "Maximizar conversões" pode ser afetada

Ação necessária:
  1. Acesse analytics.google.com
  2. Vá em Administrador → Vínculos de produtos → Vinculações do Google Ads
  3. Verifique se a conta 300-329-1643 está listada e ativa
  4. Se necessário, clique em "Vincular" para recriar a vinculação

---
Acesse o painel em: https://social-ads.zenitetech.com/ga4-ads-report
para monitorar o status da vinculação.

Este e-mail foi enviado automaticamente pelo sistema de monitoramento da Zênite Tech.
Gerado em: ${new Date().toLocaleString("pt-BR")}`;

  const payload = JSON.stringify({
    messages: [{ to: recipients, subject, content }],
  });

  let emailSent = false;
  try {
    execSync(
      `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${payload.replace(/'/g, "'\"'\"'")}'`,
      { timeout: 30000 }
    );
    emailSent = true;
    _lastAlertSent = today;
    _lastStatusOk = false;
    console.log(`[GA4LinkCheck] 📧 Alerta enviado para ${recipients.join(", ")}`);
  } catch (emailErr: any) {
    console.error("[GA4LinkCheck] Erro ao enviar e-mail:", emailErr?.message ?? emailErr);
  }

  // Notificação push no painel Manus
  await notifyOwner({
    title: emailSent
      ? "🚨 Vinculação GA4 ↔ Google Ads INATIVA — alerta enviado por e-mail"
      : "🚨 Vinculação GA4 ↔ Google Ads INATIVA — falha ao enviar e-mail",
    content: `Erro: ${errorMsg}. Acesse o painel para verificar.`,
  });
}

// Roda todos os dias às 08:00 (Brasília)
cron.schedule("0 0 8 * * *", checkGA4AdsLink, {
  timezone: "America/Sao_Paulo",
});

// Também roda às 20:00 para cobertura noturna
cron.schedule("0 0 20 * * *", checkGA4AdsLink, {
  timezone: "America/Sao_Paulo",
});

console.log("[GA4LinkCheck] Job agendado: verificação diária às 08:00 e 20:00 (Brasília).");

export { checkGA4AdsLink };
