import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { accountHealthScores } from "../../drizzle/schema";
import { desc, gte, sql } from "drizzle-orm";

export const healthScoreRouter = router({
  /**
   * Retorna o score de saúde mais recente da conta.
   */
  getLatest: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(accountHealthScores)
      .orderBy(desc(accountHealthScores.calculatedAt))
      .limit(1);
    if (!rows.length) return null;
    const row = rows[0];
    // Parse details JSON for recommendations/grade/summary
    let details: any = {};
    try { details = row.details ? JSON.parse(row.details) : {}; } catch { details = {}; }
    return {
      id: row.id,
      totalScore: row.overallScore,
      rsaQualityScore: row.rsaQualityScore,
      negativeCoverageScore: row.negativeCoverageScore,
      avgCtrScore: row.ctrScore,
      conversionRateScore: row.conversionScore,
      budgetUtilizationScore: row.budgetScore,
      anomalyScore: row.anomalyScore,
      grade: details.grade ?? (row.overallScore >= 80 ? "A" : row.overallScore >= 60 ? "B" : row.overallScore >= 40 ? "C" : "D"),
      summary: details.summary ?? "",
      recommendations: details.recommendations ?? [],
      calculatedAt: row.calculatedAt,
    };
  }),

  /**
   * Retorna histórico de scores das últimas N semanas.
   */
  getHistory: publicProcedure
    .input(z.object({ weeks: z.number().min(1).max(52).default(12) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const since = new Date();
      since.setDate(since.getDate() - input.weeks * 7);
      const rows = await db
        .select()
        .from(accountHealthScores)
        .where(gte(accountHealthScores.calculatedAt, since))
        .orderBy(desc(accountHealthScores.calculatedAt))
        .limit(input.weeks);
      return rows.map(r => {
        let det: any = {};
        try { det = r.details ? JSON.parse(r.details) : {}; } catch { det = {}; }
        return {
          id: r.id,
          totalScore: r.overallScore,
          rsaQualityScore: r.rsaQualityScore ?? 0,
          negativeCoverageScore: r.negativeCoverageScore ?? 0,
          avgCtrScore: r.ctrScore ?? 0,
          conversionRateScore: r.conversionScore ?? 0,
          budgetEfficiencyScore: r.budgetScore ?? 0,
          anomalyScore: r.anomalyScore ?? 0,
          grade: det.grade ?? (r.overallScore >= 80 ? "A" : r.overallScore >= 60 ? "B" : r.overallScore >= 40 ? "C" : "D"),
          summary: det.summary ?? "",
          recommendations: det.recommendations ?? [],
          calculatedAt: r.calculatedAt,
        };
      });
    }),

  /**
   * Calcula e salva o score de saúde atual (on-demand).
   */
  calculate: protectedProcedure.mutation(async () => {
    const { runWeeklyHealthScore } = await import("../jobs/weeklyHealthScore");
    runWeeklyHealthScore().catch(console.error);
    return { triggered: true, message: "Cálculo iniciado em background. Resultado disponível em ~30 segundos." };
  }),
});
