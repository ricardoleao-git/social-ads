/**
 * Gmail Alert Sync Job
 * Executa a cada 4 horas: lê e-mails do Gmail (rjll70@gmail.com),
 * analisa com IA e salva alertas na tabela gmail_alerts.
 */

import cron from "node-cron";
import { runGmailSyncJob } from "../routers/gmailAlerts";

// ─── Schedule ───────────────────────────────────────────────────────────────
export function scheduleGmailAlertSync() {
  // Executa a cada 4 horas: 00h, 04h, 08h, 12h, 16h, 20h (UTC)
  // BRT = UTC-3, então: 21h, 01h, 05h, 09h, 13h, 17h BRT
  cron.schedule("0 0,4,8,12,16,20 * * *", async () => {
    console.log("[GmailAlertSync] Iniciando sincronização de alertas Gmail...");
    try {
      const result = await runGmailSyncJob();
      console.log(`[GmailAlertSync] Concluído: ${result.processed} e-mails processados, ${result.saved} alertas salvos`);
    } catch (err: any) {
      console.error("[GmailAlertSync] Erro:", err?.message ?? err);
    }
  });

  console.log("[GmailAlertSync] Agendado para execução a cada 4h (00h, 04h, 08h, 12h, 16h, 20h UTC).");
}
