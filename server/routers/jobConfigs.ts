import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { jobConfigs } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Lista de todos os 23 jobs com metadados
const ALL_JOBS = [
  // Jobs existentes (10)
  { jobName: "anomalyCheck", jobLabel: "Alertas de Anomalia", category: "monitoring", frequency: "A cada 4h" },
  { jobName: "dailyInstagramSync", jobLabel: "Sincronização Instagram", category: "social", frequency: "Diária às 8h" },
  { jobName: "weeklyRSARotation", jobLabel: "Score RSA Semanal", category: "optimization", frequency: "Segunda às 8h" },
  { jobName: "weeklyExecutiveReport", jobLabel: "Relatório Executivo Integrado", category: "reporting", frequency: "Segunda às 8h" },
  { jobName: "dynamicBudget", jobLabel: "Orçamento Dinâmico", category: "optimization", frequency: "Diário" },
  { jobName: "seasonalCalendar", jobLabel: "Calendário Editorial", category: "content", frequency: "Semanal" },
  { jobName: "competitiveIntelligence", jobLabel: "Inteligência Competitiva", category: "monitoring", frequency: "Semanal" },
  { jobName: "advancedNegatives", jobLabel: "Detecção de Negativos", category: "optimization", frequency: "Semanal" },
  { jobName: "pageSpeedMonitor", jobLabel: "Monitor de PageSpeed", category: "monitoring", frequency: "A cada hora" },
  { jobName: "ga4Sync", jobLabel: "Sincronização GA4", category: "data", frequency: "Diária" },
  // Novos jobs (13)
  { jobName: "whatsappConversionSync", jobLabel: "Auto-1: Importar whatsapp_click", category: "conversion", frequency: "Diária às 9h" },
  { jobName: "budgetAlert", jobLabel: "Auto-2: Alerta Orçamento Esgotado", category: "monitoring", frequency: "A cada hora" },
  { jobName: "autoPauseKeywords", jobLabel: "Auto-3: Pausar Keywords Caras", category: "optimization", frequency: "Diária às 7h" },
  { jobName: "dailyPerformanceReport", jobLabel: "Auto-4: Relatório Diário 8h", category: "reporting", frequency: "Diária às 8h" },
  { jobName: "negativesSync", jobLabel: "Auto-5: Sync Negativos Entre Campanhas", category: "optimization", frequency: "Diária às 6h" },
  { jobName: "qualityScoreAlert", jobLabel: "Auto-6: Alerta Quality Score", category: "monitoring", frequency: "Semanal" },
  { jobName: "landingPageMonitor", jobLabel: "Auto-7: Monitor Landing Pages", category: "monitoring", frequency: "A cada hora" },
  { jobName: "conversionChannelReport", jobLabel: "Auto-8: Relatório por Canal", category: "reporting", frequency: "Semanal" },
  { jobName: "autoReactivation", jobLabel: "Auto-9: Reativação Automática", category: "optimization", frequency: "Diária às 10h" },
  { jobName: "leadScoring", jobLabel: "Auto-10: Score de Lead IA", category: "ai", frequency: "A cada novo lead" },
  { jobName: "dayparting", jobLabel: "Auto-11: Dayparting Automático", category: "optimization", frequency: "Diária às 6h" },
  { jobName: "competitorAlert", jobLabel: "Auto-12: Alerta Concorrente Novo", category: "monitoring", frequency: "Semanal" },
  { jobName: "leadsSheetSync", jobLabel: "Auto-13: Sync Leads Google Sheets", category: "data", frequency: "Diária às 7h" },
];

export const jobConfigsRouter = router({
  // Listar todos os jobs com status de ativação
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return ALL_JOBS.map(j => ({ ...j, enabled: true }));

    const configs = await db.select().from(jobConfigs);
    const configMap = new Map(configs.map(c => [c.jobName, c.enabled]));

    return ALL_JOBS.map(job => ({
      ...job,
      enabled: configMap.has(job.jobName) ? configMap.get(job.jobName)! : true,
    }));
  }),

  // Ativar ou desativar um job
  toggle: protectedProcedure
    .input(z.object({ jobName: z.string(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const job = ALL_JOBS.find(j => j.jobName === input.jobName);
      if (!job) throw new Error(`Job '${input.jobName}' não encontrado`);

      // Upsert: criar ou atualizar
      const existing = await db.select().from(jobConfigs).where(eq(jobConfigs.jobName, input.jobName)).limit(1);

      if (existing.length > 0) {
        await db.update(jobConfigs)
          .set({ enabled: input.enabled, updatedBy: "user" })
          .where(eq(jobConfigs.jobName, input.jobName));
      } else {
        await db.insert(jobConfigs).values({
          jobName: input.jobName,
          jobLabel: job.jobLabel,
          enabled: input.enabled,
          updatedBy: "user",
        });
      }

      return { success: true, jobName: input.jobName, enabled: input.enabled };
    }),

  // Ativar todos os jobs
  enableAll: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    for (const job of ALL_JOBS) {
      const existing = await db.select().from(jobConfigs).where(eq(jobConfigs.jobName, job.jobName)).limit(1);
      if (existing.length > 0) {
        await db.update(jobConfigs).set({ enabled: true, updatedBy: "user" }).where(eq(jobConfigs.jobName, job.jobName));
      } else {
        await db.insert(jobConfigs).values({ jobName: job.jobName, jobLabel: job.jobLabel, enabled: true, updatedBy: "user" });
      }
    }
    return { success: true };
  }),
});
