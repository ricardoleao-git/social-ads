import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { inAppNotifications } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

export const inAppNotificationsRouter = router({
  // Listar notificações (mais recentes primeiro)
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        unreadOnly: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { notifications: [], unreadCount: 0 };

      const query = db
        .select()
        .from(inAppNotifications)
        .orderBy(desc(inAppNotifications.createdAt))
        .limit(input.limit);

      const all = await query;
      const unreadCount = all.filter((n) => !n.read).length;
      const notifications = input.unreadOnly ? all.filter((n) => !n.read) : all;
      return { notifications, unreadCount };
    }),

  // Marcar uma notificação como lida
  markRead: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(inAppNotifications)
        .set({ read: 1, readAt: new Date() })
        .where(eq(inAppNotifications.id, input.id));
      return { success: true };
    }),

  // Marcar todas como lidas
  markAllRead: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db
      .update(inAppNotifications)
      .set({ read: 1, readAt: new Date() })
      .where(eq(inAppNotifications.read, 0));
    return { success: true };
  }),

  // Deletar notificação
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .delete(inAppNotifications)
        .where(eq(inAppNotifications.id, input.id));
      return { success: true };
    }),

  // Limpar todas as notificações lidas
  clearRead: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db
      .delete(inAppNotifications)
      .where(eq(inAppNotifications.read, 1));
    return { success: true };
  }),

  // Criar notificação (usado pelos jobs internos)
  create: publicProcedure
    .input(
      z.object({
        title: z.string().max(255),
        content: z.string(),
        type: z.enum(["info", "warning", "error", "success"]).optional().default("info"),
        source: z.string().max(128).optional().default("system"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.insert(inAppNotifications).values({
        title: input.title,
        content: input.content,
        type: input.type,
        source: input.source,
        read: 0,
      });
      return { success: true };
    }),
});
