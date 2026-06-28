import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { autoPauseProposals, alertHistory } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const autoPauseRouter = router({
  /**
   * Lista propostas de pausa automática.
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "approved", "rejected", "all"]).default("all"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(autoPauseProposals)
        .orderBy(desc(autoPauseProposals.createdAt))
        .limit(50);
      const filtered =
        input.status === "all" ? rows : rows.filter((r) => r.status === input.status);
      return filtered.map((r) => ({
        id: r.id,
        adGroupId: r.adGroupId,
        adGroupName: r.adGroupName,
        avgCtr: r.avgCtr,
        totalSpend: r.totalSpend,
        status: r.status,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
        reviewNote: r.reviewNote,
        createdAt: r.createdAt,
      }));
    }),

  /**
   * Aprova uma proposta de pausa (registra aprovação).
   */
  approve: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        reviewNote: z.string().optional(),
        reviewedBy: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const user = ctx.user as any;
      const reviewerName = input.reviewedBy || user?.name || "Usuário";
      await db
        .update(autoPauseProposals)
        .set({
          status: "approved",
          reviewedBy: reviewerName,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote || null,
        })
        .where(eq(autoPauseProposals.id, input.id));
      await db.insert(alertHistory).values({
        type: "auto_pause",
        severity: "info",
        title: "Pausa automática aprovada",
        message: `Proposta #${input.id} aprovada por ${reviewerName}. Nota: ${input.reviewNote || "—"}`,
        metadata: JSON.stringify({ proposalId: input.id }),
      });
      return { success: true };
    }),

  /**
   * Rejeita uma proposta de pausa.
   */
  reject: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        reviewNote: z.string().optional(),
        reviewedBy: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const user = ctx.user as any;
      const reviewerName = input.reviewedBy || user?.name || "Usuário";
      await db
        .update(autoPauseProposals)
        .set({
          status: "rejected",
          reviewedBy: reviewerName,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote || null,
        })
        .where(eq(autoPauseProposals.id, input.id));
      return { success: true };
    }),

  /**
   * Conta propostas pendentes.
   */
  pendingCount: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { count: 0 };
    const rows = await db
      .select()
      .from(autoPauseProposals)
      .where(eq(autoPauseProposals.status, "pending"));
    return { count: rows.length };
  }),
});
