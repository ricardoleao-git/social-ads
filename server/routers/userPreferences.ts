import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userPreferences, adsDataCache } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const DEFAULT_PREFS = {
  defaultPeriod: "7d",
  customStartDate: null as string | null,
  customEndDate: null as string | null,
  favoriteGroups: [] as string[],
  defaultStatusFilter: "all",
  defaultCampaignFilter: null as string | null,
  favoriteDocuments: [] as string[],
  openMenuGroups: ["principal", "google-ads"] as string[],
};

export const userPreferencesRouter = router({
  /**
   * Busca as preferências do usuário atual.
   * Se não existir, retorna valores padrão.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.user as any).dashboardUserId as number | undefined;
    if (!userId) return DEFAULT_PREFS;
    const db = await getDb();
    if (!db) return DEFAULT_PREFS;
    const rows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    if (rows.length === 0) return DEFAULT_PREFS;
    const pref = rows[0];
    return {
      defaultPeriod: pref.defaultPeriod || "7d",
      customStartDate: pref.customStartDate || null,
      customEndDate: pref.customEndDate || null,
      favoriteGroups: pref.favoriteGroups ? JSON.parse(pref.favoriteGroups) : [],
      defaultStatusFilter: pref.defaultStatusFilter || "all",
      defaultCampaignFilter: pref.defaultCampaignFilter || null,
      favoriteDocuments: pref.favoriteDocuments ? JSON.parse(pref.favoriteDocuments) : [],
      openMenuGroups: pref.openMenuGroups ? JSON.parse(pref.openMenuGroups) : ["principal", "google-ads"],
    };
  }),

  /**
   * Salva/atualiza as preferências do usuário atual.
   */
  save: protectedProcedure
    .input(
      z.object({
        defaultPeriod: z.string().optional(),
        customStartDate: z.string().nullable().optional(),
        customEndDate: z.string().nullable().optional(),
        favoriteGroups: z.array(z.string()).optional(),
        defaultStatusFilter: z.string().optional(),
        defaultCampaignFilter: z.string().nullable().optional(),
        favoriteDocuments: z.array(z.string()).optional(),
        openMenuGroups: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.user as any).dashboardUserId as number | undefined;
      if (!userId) return { success: false };
      const db = await getDb();
      if (!db) return { success: false };
      const existing = await db
        .select({ id: userPreferences.id })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);
      const data: any = {};
      if (input.defaultPeriod !== undefined) data.defaultPeriod = input.defaultPeriod;
      if (input.customStartDate !== undefined) data.customStartDate = input.customStartDate;
      if (input.customEndDate !== undefined) data.customEndDate = input.customEndDate;
      if (input.favoriteGroups !== undefined) data.favoriteGroups = JSON.stringify(input.favoriteGroups);
      if (input.defaultStatusFilter !== undefined) data.defaultStatusFilter = input.defaultStatusFilter;
      if (input.defaultCampaignFilter !== undefined) data.defaultCampaignFilter = input.defaultCampaignFilter;
      if (input.favoriteDocuments !== undefined) data.favoriteDocuments = JSON.stringify(input.favoriteDocuments);
      if (input.openMenuGroups !== undefined) data.openMenuGroups = JSON.stringify(input.openMenuGroups);
      if (existing.length === 0) {
        await db.insert(userPreferences).values({ userId, ...data });
      } else {
        await db.update(userPreferences).set(data).where(eq(userPreferences.userId, userId));
      }
      return { success: true };
    }),

  /**
   * Toggle de favorito de documento.
   */
  toggleFavoriteDocument: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.user as any).dashboardUserId as number | undefined;
      if (!userId) return { success: false, favorites: [] as string[] };
      const db = await getDb();
      if (!db) return { success: false, favorites: [] as string[] };
      const rows = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);
      let favorites: string[] = [];
      if (rows.length > 0 && rows[0].favoriteDocuments) {
        favorites = JSON.parse(rows[0].favoriteDocuments);
      }
      if (favorites.includes(input.documentId)) {
        favorites = favorites.filter((id) => id !== input.documentId);
      } else {
        favorites.push(input.documentId);
      }
      if (rows.length === 0) {
        await db.insert(userPreferences).values({
          userId,
          favoriteDocuments: JSON.stringify(favorites),
        });
      } else {
        await db
          .update(userPreferences)
          .set({ favoriteDocuments: JSON.stringify(favorites) })
          .where(eq(userPreferences.userId, userId));
      }
      return { success: true, favorites };
    }),
});

/**
 * Router de cache de dados do Google Ads para stale-while-revalidate.
 */
export const adsCacheRouter = router({
  /**
   * Busca dados do cache pelo cacheKey.
   */
  get: protectedProcedure
    .input(z.object({ cacheKey: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(adsDataCache)
        .where(eq(adsDataCache.cacheKey, input.cacheKey))
        .limit(1);
      if (rows.length === 0) return null;
      const row = rows[0];
      const ageSeconds = (Date.now() - row.fetchedAt.getTime()) / 1000;
      const isStale = ageSeconds > (row.ttlSeconds || 3600);
      return {
        data: JSON.parse(row.data),
        fetchedAt: row.fetchedAt,
        isStale,
        ageSeconds: Math.round(ageSeconds),
      };
    }),

  /**
   * Salva/atualiza dados no cache.
   */
  set: protectedProcedure
    .input(
      z.object({
        cacheKey: z.string(),
        data: z.any(),
        ttlSeconds: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const existing = await db
        .select({ id: adsDataCache.id })
        .from(adsDataCache)
        .where(eq(adsDataCache.cacheKey, input.cacheKey))
        .limit(1);
      const values = {
        cacheKey: input.cacheKey,
        data: JSON.stringify(input.data),
        fetchedAt: new Date(),
        ttlSeconds: input.ttlSeconds || 3600,
      };
      if (existing.length === 0) {
        await db.insert(adsDataCache).values(values);
      } else {
        await db
          .update(adsDataCache)
          .set({ data: values.data, fetchedAt: values.fetchedAt })
          .where(eq(adsDataCache.cacheKey, input.cacheKey));
      }
      return { success: true };
    }),
});
