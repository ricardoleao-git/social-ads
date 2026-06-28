/**
 * Auto-5: Sync negativos entre campanhas — toda segunda às 7h
 * Auto-6: Alerta de Quality Score — toda sexta às 9h
 * Auto-7: Monitor de landing page — a cada hora
 * Auto-8: Relatório de conversões por canal — toda segunda às 8h30
 * Auto-9: Reativação de grupos pausados — todo dia às 10h
 */
import cron from "node-cron";
import {
  runNegativeKeywordSync,
  runQualityScoreAlert,
  runLandingPageMonitor,
  runConversionByChannelReport,
  runPausedGroupReactivation,
} from "./mediumPriorityJobs";

// Auto-5: Toda segunda às 7h (Brasília)
cron.schedule(
  "0 0 7 * * 1",
  async () => {
    console.log("[Auto-5] Sincronizando negativos entre campanhas...");
    const result = await runNegativeKeywordSync();
    console.log(`[Auto-5] ${result.totalAdded || 0} negativos para sincronizar`);
  },
  { timezone: "America/Sao_Paulo" }
);

// Auto-6: Toda sexta às 9h (Brasília)
cron.schedule(
  "0 0 9 * * 5",
  async () => {
    console.log("[Auto-6] Verificando Quality Score das keywords...");
    const result = await runQualityScoreAlert();
    console.log(`[Auto-6] ${result.lowQsCount || 0} keywords com QS < 7`);
  },
  { timezone: "America/Sao_Paulo" }
);

// Auto-7: A cada hora (Brasília)
cron.schedule(
  "0 0 * * * *",
  async () => {
    console.log("[Auto-7] Verificando status das landing pages...");
    const result = await runLandingPageMonitor();
    console.log(`[Auto-7] ${result.downCount || 0} páginas fora do ar`);
  },
  { timezone: "America/Sao_Paulo" }
);

// Auto-8: Toda segunda às 8h30 (Brasília)
cron.schedule(
  "0 30 8 * * 1",
  async () => {
    console.log("[Auto-8] Gerando relatório de conversões por canal...");
    await runConversionByChannelReport();
    console.log("[Auto-8] Relatório de canais enviado");
  },
  { timezone: "America/Sao_Paulo" }
);

// Auto-9: Todo dia às 10h (Brasília)
cron.schedule(
  "0 0 10 * * *",
  async () => {
    console.log("[Auto-9] Verificando grupos pausados para reativação...");
    const result = await runPausedGroupReactivation();
    console.log(`[Auto-9] ${result.candidates || 0} candidatos à reativação`);
  },
  { timezone: "America/Sao_Paulo" }
);

console.log("[Auto-5 a 9] mediumPriorityScheduler agendado");
