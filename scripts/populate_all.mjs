/**
 * Script de população forçada — executa todos os jobs imediatamente
 * para popular o banco com dados reais antes da apresentação ao cliente
 * 
 * Uso: node --loader tsx scripts/populate_all.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Carregar env
require('dotenv').config();

async function runJob(name, fn) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[POPULATE] Executando: ${name}`);
  console.log('='.repeat(50));
  const start = Date.now();
  try {
    await fn();
    console.log(`[POPULATE] ✅ ${name} concluído em ${Date.now() - start}ms`);
  } catch (e) {
    console.error(`[POPULATE] ❌ ${name} ERRO: ${e.message}`);
  }
}

async function main() {
  console.log('\n🚀 POPULAÇÃO FORÇADA DO BANCO — AVANT CHARGE DASHBOARD');
  console.log(`Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`);

  // Importar jobs dinamicamente
  const { runPageSpeedMonitor } = await import('../server/jobs/pageSpeedMonitor.ts');
  const { runWeeklyUrlMonitor } = await import('../server/jobs/weeklyUrlMonitor.ts');
  const { runWeeklyLandingPageAnalysis } = await import('../server/jobs/weeklyLandingPageAnalysis.ts');
  const { runWeeklyRSARotation } = await import('../server/jobs/weeklyRSARotation.ts');
  const { runWeeklyLeadPrediction } = await import('../server/jobs/weeklyLeadPrediction.ts');
  const { runWeeklyHealthScore } = await import('../server/jobs/weeklyHealthScore.ts');
  const { runWeeklyProductROI } = await import('../server/jobs/weeklyProductROI.ts');
  const { runDailyCompetitiveIntelligence } = await import('../server/jobs/dailyCompetitiveIntelligence.ts');
  const { runDailyAdGroupScore } = await import('../server/jobs/dailyAdGroupScore.ts');
  const { runDailyGBZeniteDiagnosis } = await import('../server/jobs/dailyGBZeniteDiagnosis.ts');
  const { runAnomalyCheck } = await import('../server/routers/automations.ts');

  // Executar em sequência para não sobrecarregar a API
  await runJob('PageSpeed Monitor (zenitetech.com + zenite.tech)', runPageSpeedMonitor);
  await runJob('Weekly URL Monitor (verificar 404s)', runWeeklyUrlMonitor);
  await runJob('Daily Ad Group Score (score 0-100 por grupo)', runDailyAdGroupScore);
  await runJob('Daily GB Zênite Diagnosis (diagnóstico campanha)', runDailyGBZeniteDiagnosis);
  await runJob('Daily Competitive Intelligence (auction insights)', runDailyCompetitiveIntelligence);
  await runJob('Anomaly Check (CTR/CPC/conversões)', runAnomalyCheck);
  await runJob('Weekly Health Score (score da conta)', runWeeklyHealthScore);
  await runJob('Weekly RSA Rotation (sugestões de headlines)', runWeeklyRSARotation);
  await runJob('Weekly Lead Prediction (previsão de leads)', runWeeklyLeadPrediction);
  await runJob('Weekly Product ROI (ROI por produto)', runWeeklyProductROI);
  await runJob('Weekly Landing Page Analysis (análise de LPs)', runWeeklyLandingPageAnalysis);

  console.log('\n\n✅ POPULAÇÃO CONCLUÍDA');
  console.log('Verifique o banco de dados para confirmar os registros.\n');
  process.exit(0);
}

main().catch(e => {
  console.error('ERRO FATAL:', e);
  process.exit(1);
});
