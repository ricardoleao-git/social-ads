/**
 * internationalTrafficMonitorJob — Roda todo dia às 09:30 (Brasília)
 * Verifica se o tráfego de 'Outros Países' ultrapassou 15% do total.
 * Se sim, envia alerta por e-mail via Gmail MCP.
 */

import { getGA4Summary, isGA4Configured } from "../ga4Service.js";
import { getAlertEmails } from "../helpers/getAlertEmails.js";
import { execSync } from "child_process";

const THRESHOLD_PCT = 15; // Alerta quando Outros > 15% do total
const SUPPRESS_HOURS = 24; // Não alertar mais de 1x por dia

let lastAlertAt: Date | null = null;

export async function runInternationalTrafficMonitor(): Promise<void> {
  try {
    // Suprimir alertas duplicados no mesmo dia
    if (lastAlertAt) {
      const hoursSince = (Date.now() - lastAlertAt.getTime()) / 3_600_000;
      if (hoursSince < SUPPRESS_HOURS) {
        console.log(`[IntlTrafficMonitor] Suprimido — último alerta há ${hoursSince.toFixed(1)}h`);
        return;
      }
    }

    if (!isGA4Configured()) {
      console.log("[IntlTrafficMonitor] GA4 não configurado — usando dados estáticos para verificação");
    }

    // Buscar dados dos últimos 7 dias com filtro "all" para calcular proporção
    const allData = await getGA4Summary("7d", "all");
    const brazilData = await getGA4Summary("7d", "brazil");

    if (!allData.summary || !brazilData.summary) {
      console.log("[IntlTrafficMonitor] Dados GA4 indisponíveis — pulando verificação");
      return;
    }

    const totalSessions = allData.summary.totalSessions;
    const brazilSessions = brazilData.summary.totalSessions;
    const othersSessions = Math.max(0, totalSessions - brazilSessions);
    const othersPct = totalSessions > 0 ? (othersSessions / totalSessions) * 100 : 0;

    console.log(`[IntlTrafficMonitor] Brasil: ${brazilSessions} | Outros: ${othersSessions} (${othersPct.toFixed(1)}%) | Threshold: ${THRESHOLD_PCT}%`);

    if (othersPct <= THRESHOLD_PCT) {
      console.log(`[IntlTrafficMonitor] OK — tráfego internacional dentro do limite (${othersPct.toFixed(1)}% ≤ ${THRESHOLD_PCT}%)`);
      return;
    }

    // Ultrapassou o threshold — enviar alerta
    const recipients = await getAlertEmails();
    if (!recipients.length) {
      console.warn("[IntlTrafficMonitor] Threshold ultrapassado mas nenhum destinatário configurado");
      return;
    }

    const subject = `⚠️ Alerta: Tráfego Internacional acima de ${THRESHOLD_PCT}% — Zênite Tech`;
    const body = `Olá,\n\nO tráfego de 'Outros Países' ultrapassou o limite configurado de ${THRESHOLD_PCT}%.\n\nPeríodo: últimos 7 dias\n\n🇧🇷 Brasil: ${brazilSessions.toLocaleString("pt-BR")} sessões (${(100 - othersPct).toFixed(1)}%)\n🌍 Outros: ${othersSessions.toLocaleString("pt-BR")} sessões (${othersPct.toFixed(1)}%)\n📊 Total: ${totalSessions.toLocaleString("pt-BR")} sessões\n\nPossíveis causas:\n• Bot/scraper de outros países\n• Campanha ativa fora do Brasil (verifique segmentação geográfica no Google Ads)\n• Tráfego orgânico internacional crescendo\n\nAcesse o painel para investigar:\nhttps://social-ads.zenitetech.com/ga4-analytics\n\nAtenciosamente,\nDashboard Zênite Tech — Monitoramento Automático`;

    for (const to of recipients) {
      execSync(
        `manus-mcp-cli tool call send_email --server gmail --input '${JSON.stringify({ to, subject, body })}'`,
        { timeout: 30000 }
      );
    }

    lastAlertAt = new Date();
    console.log(`[IntlTrafficMonitor] ⚠️ Alerta enviado para ${recipients.join(", ")} — tráfego internacional: ${othersPct.toFixed(1)}%`);
  } catch (err: any) {
    console.error("[IntlTrafficMonitor] Erro:", err?.message);
  }
}

export function scheduleInternationalTrafficMonitor(): void {
  // Roda todo dia às 09:30 (Brasília = UTC-3 → 12:30 UTC)
  const now = new Date();
  const next = new Date();
  next.setUTCHours(12, 30, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  const msUntilFirst = next.getTime() - now.getTime();
  setTimeout(() => {
    runInternationalTrafficMonitor();
    setInterval(runInternationalTrafficMonitor, 24 * 60 * 60 * 1000);
  }, msUntilFirst);

  console.log(`[IntlTrafficMonitor] Job agendado: verificação diária às 09:30 (Brasília). Próxima em ${Math.round(msUntilFirst / 60000)}min`);
}

// Auto-inicializar ao importar o módulo
scheduleInternationalTrafficMonitor();
