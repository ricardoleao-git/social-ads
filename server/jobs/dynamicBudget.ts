/**
 * Job: Orçamento Dinâmico (a cada 2 horas em horário comercial)
 * Realoca verba automaticamente de grupos com baixo CTR para grupos de alto desempenho.
 */
import cron from "node-cron";
import { runDynamicBudgetReallocation } from "../routers/dynamicBudget";

// Executa às 6h, 8h, 10h, 12h, 14h, 16h (horário de Brasília)
cron.schedule(
  "0 6,8,10,12,14,16 * * *",
  async () => {
    console.log("[DynamicBudget] Iniciando realocação automática de orçamento...");
    try {
      const result = await runDynamicBudgetReallocation("scheduled");
      if (result.adjustments && result.adjustments.length > 0) {
        console.log(`[DynamicBudget] ${result.adjustments.length} ajuste(s) realizado(s). Simulação: ${result.isSimulation}`);
      } else {
        console.log("[DynamicBudget] Nenhum ajuste necessário nesta execução.");
      }
    } catch (err) {
      console.error("[DynamicBudget] Erro na execução:", err);
    }
  },
  { timezone: "America/Sao_Paulo" }
);

console.log("[DynamicBudget] Job agendado: 6h, 8h, 10h, 12h, 14h, 16h (America/Sao_Paulo)");
