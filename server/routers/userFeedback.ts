import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userFeedback } from "../../drizzle/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { notifyAndSave } from "../notifyAndSave";

export const userFeedbackRouter = router({
  // Listar feedbacks com filtros
  list: protectedProcedure
    .input(z.object({
      type: z.enum(["all", "suggestion", "bug", "improvement", "other"]).default("all"),
      status: z.enum(["all", "open", "in_progress", "resolved", "closed"]).default("all"),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      let query = db.select().from(userFeedback).$dynamic();

      const conditions = [];
      if (input.type !== "all") conditions.push(eq(userFeedback.type, input.type));
      if (input.status !== "all") conditions.push(eq(userFeedback.status, input.status));
      if (conditions.length > 0) query = query.where(and(...conditions)) as any;

      const items = await (query as any).orderBy(desc(userFeedback.createdAt)).limit(input.limit);
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(userFeedback);

      return { items, total: Number(countRow?.count ?? 0) };
    }),

  // Criar novo feedback
  create: protectedProcedure
    .input(z.object({
      type: z.enum(["suggestion", "bug", "improvement", "other"]),
      title: z.string().min(3).max(255),
      description: z.string().min(10),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      page: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [result] = await db.insert(userFeedback).values({
        type: input.type,
        title: input.title,
        description: input.description,
        priority: input.priority,
        page: input.page,
        authorName: (ctx.user as any)?.name ?? "Ricardo",
        authorEmail: (ctx.user as any)?.email,
        status: "open",
      });

      // Notificar sobre novo feedback de alta prioridade
      if (input.priority === "high" || input.priority === "critical") {
        await notifyAndSave({
          title: `🔔 Novo feedback ${input.priority === "critical" ? "CRÍTICO" : "de alta prioridade"}`,
          content: `**${input.title}**\n\n${input.description}\n\nTipo: ${input.type} | Página: ${input.page ?? "—"}`,
          type: "warning",
          source: "user_feedback",
        });
      }

      return { success: true, id: (result as any).insertId };
    }),

  // Atualizar status/notas de um feedback
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      adminNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const updateData: any = { updatedAt: new Date() };
      if (input.status) {
        updateData.status = input.status;
        if (input.status === "resolved") updateData.resolvedAt = new Date();
      }
      if (input.adminNotes !== undefined) updateData.adminNotes = input.adminNotes;

      await db.update(userFeedback).set(updateData).where(eq(userFeedback.id, input.id));
      return { success: true };
    }),

  // Deletar feedback
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(userFeedback).where(eq(userFeedback.id, input.id));
      return { success: true };
    }),

  // Estatísticas
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, open: 0, resolved: 0, bugs: 0, suggestions: 0 };

    const [total] = await db.select({ count: sql<number>`count(*)` }).from(userFeedback);
    const [open] = await db.select({ count: sql<number>`count(*)` }).from(userFeedback).where(eq(userFeedback.status, "open"));
    const [resolved] = await db.select({ count: sql<number>`count(*)` }).from(userFeedback).where(eq(userFeedback.status, "resolved"));
    const [bugs] = await db.select({ count: sql<number>`count(*)` }).from(userFeedback).where(eq(userFeedback.type, "bug"));
    const [suggestions] = await db.select({ count: sql<number>`count(*)` }).from(userFeedback).where(eq(userFeedback.type, "suggestion"));

    return {
      total: Number(total?.count ?? 0),
      open: Number(open?.count ?? 0),
      resolved: Number(resolved?.count ?? 0),
      bugs: Number(bugs?.count ?? 0),
      suggestions: Number(suggestions?.count ?? 0),
    };
  }),
});
