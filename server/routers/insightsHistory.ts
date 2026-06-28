import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { insightsHistory, ctrAlertRules } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

export const insightsHistoryRouter = router({
  // ---- INSIGHTS HISTORY ----

  /** Salvar um insight gerado pela IA no histórico */
  save: publicProcedure
    .input(
      z.object({
        period: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        content: z.string(),
        tags: z.array(z.string()).default([]),
        metrics: z
          .object({
            totalImpressions: z.number(),
            totalClicks: z.number(),
            avgCTR: z.number(),
            avgCPC: z.number(),
            totalConversions: z.number(),
            totalSpend: z.number(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, id: 0 };
      const [result] = await db.insert(insightsHistory).values({
        period: input.period,
        startDate: input.startDate,
        endDate: input.endDate,
        content: input.content,
        tags: input.tags,
        metrics: input.metrics ?? null,
      });
      return { success: true, id: (result as any).insertId };
    }),

  /** Listar histórico de insights (mais recentes primeiro) */
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        tag: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(insightsHistory)
        .orderBy(desc(insightsHistory.createdAt))
        .limit(input.limit);

      // Filtrar por tag se especificado
      if (input.tag) {
        return rows.filter((r) => {
          const tags = (r.tags as string[]) ?? [];
          return (tags as string[]).includes(input.tag!);
        });
      }
      return rows;
    }),

  /** Buscar um insight específico por ID */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(insightsHistory)
        .where(eq(insightsHistory.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Atualizar tags de um insight */
  updateTags: publicProcedure
    .input(z.object({ id: z.number(), tags: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db
        .update(insightsHistory)
        .set({ tags: input.tags })
        .where(eq(insightsHistory.id, input.id));
      return { success: true };
    }),

  /** Deletar um insight do histórico */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(insightsHistory).where(eq(insightsHistory.id, input.id));
      return { success: true };
    }),

  // ---- CTR ALERT RULES ----

  /** Listar regras de alerta de CTR */
  listAlertRules: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db
      .select()
      .from(ctrAlertRules)
      .orderBy(desc(ctrAlertRules.createdAt));
  }),

  /** Criar ou atualizar regra de alerta de CTR */
  upsertAlertRule: publicProcedure
    .input(
      z.object({
        id: z.number().optional(),
        adGroupName: z.string().default("all"),
        thresholdPercent: z.number().min(1).max(100),
        email: z.string().email(),
        active: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, id: 0 };
      if (input.id) {
        await db
          .update(ctrAlertRules)
          .set({
            adGroupName: input.adGroupName,
            thresholdPercent: input.thresholdPercent,
            email: input.email,
            active: input.active,
          })
          .where(eq(ctrAlertRules.id, input.id));
        return { success: true, id: input.id };
      } else {
        const [result] = await db.insert(ctrAlertRules).values({
          adGroupName: input.adGroupName,
          thresholdPercent: input.thresholdPercent,
          email: input.email,
          active: input.active,
        });
        return { success: true, id: (result as any).insertId };
      }
    }),

  /** Deletar regra de alerta */
  deleteAlertRule: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(ctrAlertRules).where(eq(ctrAlertRules.id, input.id));
      return { success: true };
    }),

  /** Verificar alertas de CTR com base nos dados atuais e enviar e-mail se necessário */
  checkAndFireAlerts: publicProcedure
    .input(
      z.object({
        adGroups: z.array(
          z.object({
            name: z.string(),
            ctr: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, alertsFired: 0, details: [] };
      const rules = await db
        .select()
        .from(ctrAlertRules)
        .where(eq(ctrAlertRules.active, true));

      const fired: { rule: string; group: string; ctr: number; threshold: number }[] = [];

      for (const rule of rules) {
        const groupsToCheck =
          rule.adGroupName === "all"
            ? input.adGroups
            : input.adGroups.filter((g: { name: string; ctr: number }) =>
                g.name.toLowerCase().includes(rule.adGroupName.toLowerCase())
              );

        for (const group of groupsToCheck) {
          if (group.ctr < rule.thresholdPercent) {
            fired.push({
              rule: rule.adGroupName,
              group: group.name,
              ctr: group.ctr,
              threshold: rule.thresholdPercent,
            });

            // Notificar o owner via sistema de notificações
            await notifyOwner({
              title: `⚠️ Alerta de CTR: ${group.name}`,
              content: `O grupo "${group.name}" está com CTR de ${group.ctr.toFixed(2)}%, abaixo do limite configurado de ${rule.thresholdPercent}%. Verifique o dashboard para tomar ação.`,
            });

            // Atualizar lastTriggeredAt
            if (db) {
              await db
                .update(ctrAlertRules)
                .set({ lastTriggeredAt: new Date() })
                .where(eq(ctrAlertRules.id, rule.id));
            }
          }
        }
      }

      return { success: true, alertsFired: fired.length, details: fired };
    }),
});
