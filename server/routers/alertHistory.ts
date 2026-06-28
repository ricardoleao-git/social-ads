import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { alertHistory } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const alertHistoryRouter = router({
  /**
   * Lista o histórico de alertas com paginação.
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        type: z.string().optional(),
        severity: z.string().optional(),
        onlyUnread: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { alerts: [], total: 0 };
      const rows = await db
        .select()
        .from(alertHistory)
        .orderBy(desc(alertHistory.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      let filtered = rows;
      if (input.type) filtered = filtered.filter((r) => r.type === input.type);
      if (input.severity) filtered = filtered.filter((r) => r.severity === input.severity);
      if (input.onlyUnread) filtered = filtered.filter((r) => !r.acknowledged);
      return {
        alerts: filtered.map((r) => ({
          id: r.id,
          type: r.type,
          severity: r.severity,
          title: r.title,
          message: r.message,
          metadata: r.metadata ? JSON.parse(r.metadata) : null,
          acknowledged: r.acknowledged,
          acknowledgedAt: r.acknowledgedAt,
          createdAt: r.createdAt,
        })),
        total: filtered.length,
      };
    }),

  /**
   * Reconhece (marca como lido) um alerta específico.
   */
  acknowledge: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db
        .update(alertHistory)
        .set({ acknowledged: true, acknowledgedAt: new Date() })
        .where(eq(alertHistory.id, input.id));
      return { success: true };
    }),

  /**
   * Reconhece todos os alertas não lidos.
   */
  acknowledgeAll: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { success: false };
    await db
      .update(alertHistory)
      .set({ acknowledged: true, acknowledgedAt: new Date() })
      .where(eq(alertHistory.acknowledged, false));
    return { success: true };
  }),

  /**
   * Conta alertas não lidos por severidade.
   */
  unreadCount: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, critical: 0, warning: 0, info: 0 };
    const rows = await db
      .select()
      .from(alertHistory)
      .where(eq(alertHistory.acknowledged, false));
    const counts = { total: rows.length, critical: 0, warning: 0, info: 0 };
    for (const r of rows) {
      if (r.severity === "critical") counts.critical++;
      else if (r.severity === "warning") counts.warning++;
      else counts.info++;
    }
    return counts;
  }),

  /**
   * Cria um novo alerta no histórico (usado pelos jobs internamente).
   */
  create: protectedProcedure
    .input(
      z.object({
        type: z.string(),
        severity: z.enum(["info", "warning", "critical"]),
        title: z.string(),
        message: z.string().optional(),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, id: null };
      const [result] = await db.insert(alertHistory).values({
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      });
      return { success: true, id: (result as any).insertId };
    }),
});
