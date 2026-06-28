/**
 * conversionGoals.ts
 * Router tRPC para gerenciar metas de conversão por produto/grupo.
 * Migrado do localStorage para o banco de dados para persistência real entre dispositivos.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { conversionGoals } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const DEFAULT_GOALS = [
  { goalId: "wallbox", name: "Wallbox / Recarga Elétrica", monthly: 20, cpaTarget: 65, color: "#3b82f6" },
  { goalId: "guardia", name: "GuardIA / Segurança", monthly: 15, cpaTarget: 80, color: "#10b981" },
  { goalId: "conciergia", name: "ConciergIA / WhatsApp", monthly: 10, cpaTarget: 90, color: "#f59e0b" },
  { goalId: "ponto", name: "Relógio de Ponto", monthly: 8, cpaTarget: 70, color: "#8b5cf6" },
];

export const conversionGoalsRouter = router({
  /** Retorna todas as metas de conversão. Se não houver nenhuma, insere os padrões. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return DEFAULT_GOALS;

    let rows = await db.select().from(conversionGoals);

    // Seed automático se a tabela estiver vazia
    if (rows.length === 0) {
      await db.insert(conversionGoals).values(
        DEFAULT_GOALS.map(g => ({ ...g, updatedBy: ctx.user.email ?? "admin" }))
      );
      rows = await db.select().from(conversionGoals);
    }

    return rows.map(r => ({
      id: r.goalId,
      name: r.name,
      monthly: r.monthly,
      cpaTarget: r.cpaTarget,
      color: r.color,
    }));
  }),

  /** Atualiza uma meta específica (meta mensal e CPA alvo). */
  update: protectedProcedure
    .input(z.object({
      goalId: z.string(),
      monthly: z.number().int().min(1).max(9999),
      cpaTarget: z.number().int().min(1).max(9999),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");

      await db
        .update(conversionGoals)
        .set({
          monthly: input.monthly,
          cpaTarget: input.cpaTarget,
          updatedBy: ctx.user.email ?? "admin",
        })
        .where(eq(conversionGoals.goalId, input.goalId));

      return { success: true };
    }),

  /** Restaura todas as metas para os valores padrão. */
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados indisponível");

    for (const g of DEFAULT_GOALS) {
      await db
        .update(conversionGoals)
        .set({
          monthly: g.monthly,
          cpaTarget: g.cpaTarget,
          color: g.color,
          name: g.name,
          updatedBy: ctx.user.email ?? "admin",
        })
        .where(eq(conversionGoals.goalId, g.goalId));
    }

    return { success: true };
  }),
});
