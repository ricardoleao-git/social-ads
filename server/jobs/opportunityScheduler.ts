/**
 * Auto-10: Score de lead via IA — todo dia às 11h
 * Auto-11: Dayparting automático — todo domingo às 6h
 * Auto-12: Alerta de concorrentes — toda quarta às 9h
 * Auto-13: Sync leads com Google Sheets — todo dia às 9h30
 */
import cron from "node-cron";
import {
  runLeadScoring,
  runDaypartingOptimization,
  runCompetitorAlert,
  runLeadSheetsSync,
} from "./opportunityJobs";

// Auto-10: Todo dia às 11h (Brasília)
cron.schedule(
  "0 0 11 * * *",
  async () => {
    console.log("[Auto-10] Executando score de lead via IA...");
    const result = await runLeadScoring();
    console.log("[Auto-10] Score de lead:", result.success ? "OK" : result.error);
  },
  { timezone: "America/Sao_Paulo" }
);

// Auto-11: Todo domingo às 6h (Brasília)
cron.schedule(
  "0 0 6 * * 0",
  async () => {
    console.log("[Auto-11] Analisando dayparting por hora do dia...");
    const result = await runDaypartingOptimization();
    console.log(`[Auto-11] Horários de pico: ${(result as any).peakHours?.join(", ")}`);
  },
  { timezone: "America/Sao_Paulo" }
);

// Auto-12: Toda quarta às 9h (Brasília)
cron.schedule(
  "0 0 9 * * 3",
  async () => {
    console.log("[Auto-12] Verificando concorrentes nos leilões...");
    const result = await runCompetitorAlert();
    console.log(`[Auto-12] ${(result as any).competitors || 0} concorrentes identificados`);
  },
  { timezone: "America/Sao_Paulo" }
);

// Auto-13: Todo dia às 9h30 (Brasília)
cron.schedule(
  "0 30 9 * * *",
  async () => {
    console.log("[Auto-13] Sincronizando leads com Google Sheets...");
    const result = await runLeadSheetsSync();
    console.log(`[Auto-13] ${(result as any).count || 0} conversões sincronizadas`);
  },
  { timezone: "America/Sao_Paulo" }
);

console.log("[Auto-10 a 13] opportunityScheduler agendado");
