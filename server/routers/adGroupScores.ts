/**
 * tRPC Router: Ad Group Scores
 * Exposes score de qualidade 0–100 por grupo de anúncios
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { adGroupScores } from "../../drizzle/schema";
import { desc, eq, gte } from "drizzle-orm";

export const adGroupScoresRouter = router({
  /**
   * Lista os scores mais recentes de todos os grupos
   */
  list: publicProcedure
    .input(z.object({ limit: z.number().optional().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(adGroupScores)
        .orderBy(desc(adGroupScores.calculatedAt))
        .limit(input.limit);
      return rows;
    }),

  /**
   * Top N grupos por score (para widget na Home)
   */
  getTop: publicProcedure
    .input(z.object({ limit: z.number().optional().default(5) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      // Busca os scores mais recentes (últimas 48h) e ordena por score desc
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const rows = await db
        .select()
        .from(adGroupScores)
        .where(gte(adGroupScores.calculatedAt, cutoff))
        .orderBy(desc(adGroupScores.score))
        .limit(input.limit);
      return rows;
    }),

  /**
   * Histórico de scores de um grupo específico
   */
  history: publicProcedure
    .input(z.object({ adGroupId: z.string(), days: z.number().optional().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const cutoff = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await db
        .select()
        .from(adGroupScores)
        .where(
          eq(adGroupScores.adGroupId, input.adGroupId)
        )
        .orderBy(desc(adGroupScores.calculatedAt))
        .limit(input.days);
      return rows;
    }),
});
