/**
 * Auto-1: Scheduler — Verificação diária do whatsapp_click como conversão no Google Ads
 * Roda todo dia às 9h (horário de Brasília = UTC-3, então 12h UTC)
 */
import cron from "node-cron";
import { runWhatsappConversionSync } from "./whatsappConversionSync";

// Diariamente às 9h (Brasília)
cron.schedule(
  "0 0 12 * * *",
  async () => {
    console.log("[Auto-1] Verificando status do whatsapp_click no Google Ads...");
    const result = await runWhatsappConversionSync();
    console.log("[Auto-1] Resultado:", result.success ? "OK" : result.error);
  },
  { timezone: "America/Sao_Paulo" }
);

console.log("[Auto-1] whatsappConversionSyncJob agendado — todo dia às 9h (Brasília)");
