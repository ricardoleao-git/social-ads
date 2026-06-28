/**
 * Script de população forçada — executa todos os jobs imediatamente
 * para popular o banco com dados reais antes da apresentação ao cliente
 */
import { runPageSpeedMonitor } from "../server/jobs/pageSpeedMonitor";
import { runWeeklyLandingPageAnalysis } from "../server/jobs/weeklyLandingPageAnalysis";
import { runWeeklyUrlMonitor } from "../server/jobs/weeklyUrlMonitor";
import { runAnomalyCheck } from "../server/routers/automations";

async function main() {
  console.log("=== POPULAÇÃO FORÇADA DO BANCO ===");
  
  console.log("\n[1/4] PageSpeed Monitor...");
  try { await runPageSpeedMonitor(); } catch(e: any) { console.error("ERRO PageSpeed:", e.message); }
  
  console.log("\n[2/4] Weekly URL Monitor...");
  try { await runWeeklyUrlMonitor(); } catch(e: any) { console.error("ERRO URL Monitor:", e.message); }
  
  console.log("\n[3/4] Weekly Landing Page Analysis...");
  try { await runWeeklyLandingPageAnalysis(); } catch(e: any) { console.error("ERRO LP Analysis:", e.message); }
  
  console.log("\n[4/4] Anomaly Check...");
  try { await runAnomalyCheck(); } catch(e: any) { console.error("ERRO Anomaly:", e.message); }
  
  console.log("\n=== CONCLUÍDO ===");
  process.exit(0);
}

main();
