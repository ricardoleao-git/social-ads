/**
 * criticalAlertEscalation.ts
 * Job que verifica alertas críticos não reconhecidos há mais de 24 horas
 * e envia notificação por e-mail ao responsável.
 * Roda a cada 6 horas.
 */
import cron from "node-cron";
import { execSync } from "child_process";
import { getDb } from "../db";
import { alertHistory } from "../../drizzle/schema";
import { eq, and, lt } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { getAlertEmails } from "../helpers/getAlertEmails";


const CHECK_INTERVAL_HOURS = 6;
const ESCALATION_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 horas em ms

// Rastreia quais alertas já foram escalados para evitar spam
const escalatedAlertIds = new Set<number>();

async function checkCriticalAlerts() {
  console.log("[CriticalAlertEscalation] Verificando alertas críticos não reconhecidos há +24h...");
  const recipients = await getAlertEmails();
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[CriticalAlertEscalation] Banco de dados indisponível — abortando.");
      return;
    }

    const cutoff = new Date(Date.now() - ESCALATION_THRESHOLD_MS);

    // Buscar alertas críticos não reconhecidos criados há mais de 24h
    const rows = await db
      .select()
      .from(alertHistory)
      .where(
        and(
          eq(alertHistory.severity, "critical"),
          eq(alertHistory.acknowledged, false),
          lt(alertHistory.createdAt, cutoff)
        )
      );

    if (rows.length === 0) {
      console.log("[CriticalAlertEscalation] Nenhum alerta crítico pendente há +24h.");
      return;
    }

    // Filtrar apenas os que ainda não foram escalados nesta sessão
    const newEscalations = rows.filter(r => !escalatedAlertIds.has(r.id));

    if (newEscalations.length === 0) {
      console.log("[CriticalAlertEscalation] Todos os alertas críticos já foram escalados anteriormente.");
      return;
    }

    console.log(`[CriticalAlertEscalation] ${newEscalations.length} alerta(s) crítico(s) para escalar.`);

    // Montar corpo do e-mail
    const alertLines = newEscalations.map(a => {
      const hoursAgo = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 3600000);
      return `• [${a.type.toUpperCase()}] ${a.title}\n  Mensagem: ${a.message ?? "—"}\n  Criado há ${hoursAgo}h (${new Date(a.createdAt).toLocaleString("pt-BR")})`;
    }).join("\n\n");

    const subject = `⚠️ ALERTA CRÍTICO: ${newEscalations.length} alerta(s) sem reconhecimento há +24h — Zênite Tech Dashboard`;
    const content = `Zênite Tech — Dashboard de Tráfego Pago
Verificação automática de alertas críticos

ATENÇÃO: Os seguintes alertas críticos estão sem reconhecimento há mais de 24 horas:

${alertLines}

---
Acesse o painel em: https://social-ads.zenitetech.com/alertas-saude
para reconhecer os alertas e evitar novas notificações.

Este e-mail foi enviado automaticamente pelo sistema de monitoramento da Zênite Tech.
Gerado em: ${new Date().toLocaleString("pt-BR")}`;

    const payload = JSON.stringify({
      messages: [
        {
          to: recipients,
          subject,
          content,
        },
      ],
    });

    let emailSent = false;
    try {
      execSync(
        `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${payload.replace(/'/g, "'\"'\"'")}'`,
        { timeout: 30000 }
      );
      emailSent = true;
      console.log(`[CriticalAlertEscalation] E-mail enviado para ${recipients.join(", ")} com ${newEscalations.length} alerta(s).`);

      // Marcar como escalados para evitar spam
      newEscalations.forEach(a => escalatedAlertIds.add(a.id));
    } catch (emailErr: any) {
      console.error("[CriticalAlertEscalation] Erro ao enviar e-mail:", emailErr?.message ?? emailErr);
    }

    // Notificação push no painel Manus
    await notifyOwner({
      title: emailSent
        ? `Escalação: ${newEscalations.length} alerta(s) crítico(s) sem reconhecimento há +24h`
        : `Falha ao escalar alertas críticos — verifique o e-mail`,
      content: `Alertas: ${newEscalations.map(a => a.title).join(", ")}`,
    });

  } catch (err: any) {
    console.error("[CriticalAlertEscalation] Erro inesperado:", err?.message ?? err);
  }
}

// Roda a cada 6 horas: 0h, 6h, 12h, 18h
cron.schedule("0 0 */6 * * *", checkCriticalAlerts, {
  timezone: "America/Sao_Paulo",
});

console.log("[CriticalAlertEscalation] Job agendado: verificação a cada 6h para alertas críticos sem reconhecimento há +24h.");
