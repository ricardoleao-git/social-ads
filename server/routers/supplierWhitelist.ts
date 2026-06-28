import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { supplierWhitelist } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const supplierWhitelistRouter = router({
  // Listar todos os fornecedores
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db
      .select()
      .from(supplierWhitelist)
      .orderBy(desc(supplierWhitelist.createdAt));
  }),

  // Criar novo fornecedor protegido
  create: publicProcedure
    .input(
      z.object({
        term: z.string().min(2).max(255),
        supplierName: z.string().min(2).max(255),
        reason: z.string().max(512).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.insert(supplierWhitelist).values({
        term: input.term.toLowerCase().trim(),
        supplierName: input.supplierName.trim(),
        reason: input.reason ?? "Fornecedor de equipamentos parceiro",
        active: 1,
      });
      return { success: true };
    }),

  // Atualizar fornecedor
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        term: z.string().min(2).max(255).optional(),
        supplierName: z.string().min(2).max(255).optional(),
        reason: z.string().max(512).optional(),
        active: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const { id, ...updates } = input;
      if (updates.term) updates.term = updates.term.toLowerCase().trim();
      await db
        .update(supplierWhitelist)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(supplierWhitelist.id, id));
      return { success: true };
    }),

  // Deletar fornecedor
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .delete(supplierWhitelist)
        .where(eq(supplierWhitelist.id, input.id));
      return { success: true };
    }),

  // Toggle ativo/inativo
  toggle: publicProcedure
    .input(z.object({ id: z.number(), active: z.number().min(0).max(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(supplierWhitelist)
        .set({ active: input.active, updatedAt: new Date() })
        .where(eq(supplierWhitelist.id, input.id));
      return { success: true };
    }),
});
