/**
 * Job: Alerta de Anomalia (a cada 4 horas)
 * Detecta quedas de CTR, picos de CPC e zero conversões nos grupos de anúncios.
 */
import cron from "node-cron";
import { runAnomalyCheck } from "../routers/automations";

// Executa a cada 4 horas (0h, 4h, 8h, 12h, 16h, 20h)
cron.schedule(
  "0 */4 * * *",
  async () => {
    console.log("[AnomalyAlert] Iniciando verificação de anomalias...");
    try {
      const result = await runAnomalyCheck();
      if (result.detected > 0) {
        console.log(`[AnomalyAlert] ${result.detected} anomalia(s) detectada(s) e salvas no banco.`);
      } else {
        console.log("[AnomalyAlert] Nenhuma anomalia detectada nesta verificação.");
      }
    } catch (err) {
      console.error("[AnomalyAlert] Erro na verificação de anomalias:", err);
    }
  },
  { timezone: "America/Sao_Paulo" }
);

console.log("[AnomalyAlert] Job agendado: a cada 4 horas (America/Sao_Paulo)");
