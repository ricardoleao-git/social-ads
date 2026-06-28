import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { editorialPosts, instagramDrafts } from "../../drizzle/schema";
import { eq, and, like, gte, lte, sql, desc } from "drizzle-orm";

const platformEnum = z.enum(["instagram", "facebook", "both"]);
const contentTypeEnum = z.enum(["post", "story", "reels", "carousel"]);
const statusEnum = z.enum(["planned", "ready", "published", "cancelled"]);

export const editorialCalendarRouter = router({
  // ── List posts by month ───────────────────────────────────────────────────
  listByMonth: publicProcedure
    .input(z.object({
      year: z.number(),
      month: z.number(), // 1-12
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { year, month } = input;
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

      const posts = await db
        .select()
        .from(editorialPosts)
        .where(
          and(
            gte(editorialPosts.scheduledDate, startDate),
            lte(editorialPosts.scheduledDate, endDate)
          )
        )
        .orderBy(editorialPosts.scheduledDate, editorialPosts.scheduledTime);

      return posts;
    }),

  // ── Get single post ───────────────────────────────────────────────────────
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const [post] = await db.select().from(editorialPosts).where(eq(editorialPosts.id, input.id));
      if (!post) throw new Error("Post não encontrado");

      // If linked to an instagram draft, fetch it too
      let draft = null;
      if (post.instagramDraftId) {
        const [d] = await db.select().from(instagramDrafts).where(eq(instagramDrafts.id, post.instagramDraftId));
        draft = d || null;
      }

      return { post, draft };
    }),

  // ── Create post ───────────────────────────────────────────────────────────
  create: publicProcedure
    .input(z.object({
      title: z.string().min(1),
      platform: platformEnum.default("instagram"),
      contentType: contentTypeEnum.default("post"),
      caption: z.string().optional(),
      hashtags: z.string().optional(),
      instagramDraftId: z.number().optional(),
      scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      scheduledTime: z.string().default("09:00"),
      status: statusEnum.default("planned"),
      assignedTo: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const [result] = await db.insert(editorialPosts).values({
        title: input.title,
        platform: input.platform,
        contentType: input.contentType,
        caption: input.caption,
        hashtags: input.hashtags,
        instagramDraftId: input.instagramDraftId,
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime,
        status: input.status,
        assignedTo: input.assignedTo,
        notes: input.notes,
      });
      return { id: (result as any).insertId, success: true };
    }),

  // ── Update post ───────────────────────────────────────────────────────────
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      platform: platformEnum.optional(),
      contentType: contentTypeEnum.optional(),
      caption: z.string().optional(),
      hashtags: z.string().optional(),
      instagramDraftId: z.number().optional(),
      scheduledDate: z.string().optional(),
      scheduledTime: z.string().optional(),
      status: statusEnum.optional(),
      assignedTo: z.string().optional(),
      notes: z.string().optional(),
      // Performance metrics (after publishing)
      reach: z.number().optional(),
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
      saves: z.number().optional(),
      publishedPostId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { id, ...data } = input;
      await db.update(editorialPosts).set(data).where(eq(editorialPosts.id, id));
      return { success: true };
    }),

  // ── Delete post ───────────────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      await db.delete(editorialPosts).where(eq(editorialPosts.id, input.id));
      return { success: true };
    }),

  // ── Get stats ─────────────────────────────────────────────────────────────
  getStats: publicProcedure
    .input(z.object({
      year: z.number(),
      month: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { year, month } = input;
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

      const [counts] = await db.select({
        total: sql<number>`COUNT(*)`,
        planned: sql<number>`SUM(CASE WHEN status_ep = 'planned' THEN 1 ELSE 0 END)`,
        ready: sql<number>`SUM(CASE WHEN status_ep = 'ready' THEN 1 ELSE 0 END)`,
        published: sql<number>`SUM(CASE WHEN status_ep = 'published' THEN 1 ELSE 0 END)`,
        cancelled: sql<number>`SUM(CASE WHEN status_ep = 'cancelled' THEN 1 ELSE 0 END)`,
        total_reach: sql<number>`SUM(COALESCE(reach, 0))`,
        total_likes: sql<number>`SUM(COALESCE(likes, 0))`,
        total_comments: sql<number>`SUM(COALESCE(comments, 0))`,
        instagram_count: sql<number>`SUM(CASE WHEN platform_ep IN ('instagram', 'both') THEN 1 ELSE 0 END)`,
        facebook_count: sql<number>`SUM(CASE WHEN platform_ep IN ('facebook', 'both') THEN 1 ELSE 0 END)`,
      }).from(editorialPosts).where(
        and(
          gte(editorialPosts.scheduledDate, startDate),
          lte(editorialPosts.scheduledDate, endDate)
        )
      );

      return {
        total: Number(counts?.total || 0),
        byStatus: {
          planned: Number(counts?.planned || 0),
          ready: Number(counts?.ready || 0),
          published: Number(counts?.published || 0),
          cancelled: Number(counts?.cancelled || 0),
        },
        performance: {
          totalReach: Number(counts?.total_reach || 0),
          totalLikes: Number(counts?.total_likes || 0),
          totalComments: Number(counts?.total_comments || 0),
        },
        byPlatform: {
          instagram: Number(counts?.instagram_count || 0),
          facebook: Number(counts?.facebook_count || 0),
        },
      };
    }),

  // ── List drafts available to link ─────────────────────────────────────────
  listAvailableDrafts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database unavailable');
    const drafts = await db
      .select({
        id: instagramDrafts.id,
        type: instagramDrafts.type,
        caption: instagramDrafts.caption,
        status: instagramDrafts.status,
        createdAt: instagramDrafts.createdAt,
      })
      .from(instagramDrafts)
      .where(eq(instagramDrafts.status, "draft"))
      .orderBy(desc(instagramDrafts.createdAt))
      .limit(50);

    return drafts;
  }),
});
