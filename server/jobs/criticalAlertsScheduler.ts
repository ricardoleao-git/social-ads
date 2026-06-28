/**
 * Auto-2: Alerta de orçamento esgotado — a cada hora entre 8h e 18h
 * Auto-3: Pausa de keywords caras — todo dia às 7h
 * Auto-4: Relatório diário de performance — todo dia às 8h
 */
import cron from "node-cron";
import { runBudgetExhaustionAlert, runExpensiveKeywordPause, runDailyPerformanceReport } from "./criticalAlerts";

// Auto-2: A cada hora entre 8h e 18h (Brasília)
cron.schedule(
  "0 0 8-18 * * 1-5",
  async () => {
    console.log("[Auto-2] Verificando orçamento diário das campanhas...");
    const result = await runBudgetExhaustionAlert();
    console.log(`[Auto-2] ${result.alerts || 0} alertas de orçamento`);
  },
  { timezone: "America/Sao_Paulo" }
);

// Auto-3: Todo dia às 7h (Brasília)
cron.schedule(
  "0 0 7 * * *",
  async () => {
    console.log("[Auto-3] Verificando keywords caras sem conversão...");
    const result = await runExpensiveKeywordPause();
    console.log(`[Auto-3] ${result.paused || 0} keywords pausadas`);
  },
  { timezone: "America/Sao_Paulo" }
);

// Auto-4: Todo dia às 8h (Brasília)
cron.schedule(
  "0 0 8 * * *",
  async () => {
    console.log("[Auto-4] Gerando relatório diário de performance...");
    const result = await runDailyPerformanceReport();
    console.log(`[Auto-4] Relatório enviado — Gasto: R$${(result as any).totalCost?.toFixed(2) || "?"}`);
  },
  { timezone: "America/Sao_Paulo" }
);

console.log("[Auto-2,3,4] criticalAlertsScheduler agendado");
