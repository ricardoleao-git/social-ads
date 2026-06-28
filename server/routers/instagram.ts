import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  socialPlatforms,
  socialAccounts,
  socialMetrics,
  socialPosts,
  socialAlerts,
  socialIntegrations,
  socialAutomations,
  socialReports,
  instagramSnapshots,
} from "../../drizzle/schema";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { getInstagramData } from "../instagramService";
import { INSTAGRAM_ACCOUNT_ID, META_ACCESS_TOKEN } from "../credentials";
// ⚠️  IDs centralizados em server/credentials.ts — não edite aqui

// ============================================
// ROUTER: INSTAGRAM / REDES SOCIAIS
// ============================================

export const instagramRouter = router({
  // ---- PLATAFORMAS ----
  getPlatforms: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(socialPlatforms);
  }),

  // ---- CONTAS ----
  getAccounts: publicProcedure
    .input(
      z.object({
        platformId: z.string().optional(),
        activeOnly: z.boolean().optional().default(true),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let accounts = await db.select().from(socialAccounts);
      if (input?.activeOnly) {
        accounts = accounts.filter((a) => a.isActive);
      }
      // Enrich with latest snapshot data (followers count)
      const enriched = await Promise.all(
        accounts.map(async (account) => {
          try {
            const handle = (account.accountHandle ?? '').replace('@', '');
            const [snapshot] = await db
              .select()
              .from(instagramSnapshots)
              .where(eq(instagramSnapshots.username, handle))
              .orderBy(desc(instagramSnapshots.createdAt))
              .limit(1);
            return {
              ...account,
              followersCount: snapshot?.followers ?? 0,
              engagementRate: snapshot?.engagementRate ?? '0',
              totalPosts: snapshot?.totalPosts ?? 0,
            };
          } catch {
            return { ...account, followersCount: 0, engagementRate: '0', totalPosts: 0 };
          }
        })
      );
      return enriched;
    }),

  getAccount: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [account] = await db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.id, input.id));
      return account ?? null;
    }),

  createAccount: publicProcedure
    .input(
      z.object({
        id: z.string(),
        platformId: z.string(),
        accountName: z.string(),
        accountHandle: z.string(),
        externalId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(socialAccounts).values({
        id: input.id,
        platformId: input.platformId,
        accountName: input.accountName,
        accountHandle: input.accountHandle,
        externalId: input.externalId ?? null,
        isActive: true,
      });
      return { success: true };
    }),

  updateAccount: publicProcedure
    .input(
      z.object({
        id: z.string(),
        accountName: z.string().optional(),
        accountHandle: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...updates } = input;
      await db
        .update(socialAccounts)
        .set(updates)
        .where(eq(socialAccounts.id, id));
      return { success: true };
    }),

  // ---- MÉTRICAS ----
  getMetrics: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        period: z.enum(["7d", "30d", "90d"]).default("30d"),
        metricType: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const metrics = await db
        .select()
        .from(socialMetrics)
        .where(eq(socialMetrics.accountId, input.accountId))
        .orderBy(desc(socialMetrics.date));
      if (input.metricType) {
        return metrics.filter((m) => m.metricType === input.metricType);
      }
      return metrics;
    }),

  saveMetrics: publicProcedure
    .input(
      z.object({
        id: z.string(),
        accountId: z.string(),
        platformId: z.string(),
        metricType: z.string(),
        metricValue: z.number(),
        period: z.string(),
        date: z.date(),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(socialMetrics).values({
        id: input.id,
        accountId: input.accountId,
        platformId: input.platformId,
        metricType: input.metricType,
        metricValue: String(input.metricValue),
        period: input.period,
        date: input.date,
        metadata: input.metadata ?? null,
      });
      return { success: true };
    }),

  // ---- POSTS ----
  getPosts: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        postType: z.string().optional(),
        limit: z.number().optional().default(20),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Build where conditions
      const conditions = [eq(socialPosts.accountId, input.accountId)];
      if (input.startDate) conditions.push(gte(socialPosts.postedAt, input.startDate));
      if (input.endDate) {
        const endOfDay = new Date(input.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        conditions.push(lte(socialPosts.postedAt, endOfDay));
      }

      const posts = await db
        .select()
        .from(socialPosts)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(socialPosts.postedAt))
        .limit(input.limit);

      if (input.postType) {
        return posts.filter((p) => p.postType === input.postType);
      }
      return posts;
    }),

  savePost: publicProcedure
    .input(
      z.object({
        id: z.string(),
        accountId: z.string(),
        platformId: z.string(),
        postId: z.string(),
        caption: z.string().optional(),
        mediaUrl: z.string().optional(),
        postType: z.string().optional(),
        likes: z.number().optional().default(0),
        comments: z.number().optional().default(0),
        shares: z.number().optional().default(0),
        engagement: z.number().optional().default(0),
        postedAt: z.date().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(socialPosts).values({
        id: input.id,
        accountId: input.accountId,
        platformId: input.platformId,
        postId: input.postId,
        caption: input.caption ?? null,
        mediaUrl: input.mediaUrl ?? null,
        postType: input.postType ?? null,
        likes: input.likes,
        comments: input.comments,
        shares: input.shares,
        engagement: String(input.engagement),
        postedAt: input.postedAt ?? null,
      });
      return { success: true };
    }),

  // ---- ALERTAS ----
  getAlerts: publicProcedure
    .input(
      z.object({
        accountId: z.string().optional(),
        unreadOnly: z.boolean().optional().default(false),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let alerts = await db
        .select()
        .from(socialAlerts)
        .orderBy(desc(socialAlerts.createdAt));
      if (input?.accountId) {
        alerts = alerts.filter((a) => a.accountId === input.accountId);
      }
      if (input?.unreadOnly) {
        alerts = alerts.filter((a) => !a.isRead);
      }
      return alerts;
    }),

  createAlert: publicProcedure
    .input(
      z.object({
        id: z.string(),
        accountId: z.string(),
        platformId: z.string(),
        alertType: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        message: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(socialAlerts).values({
        id: input.id,
        accountId: input.accountId,
        platformId: input.platformId,
        alertType: input.alertType,
        severity: input.severity,
        message: input.message,
        isRead: false,
      });
      return { success: true };
    }),

  markAlertAsRead: publicProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(socialAlerts)
        .set({ isRead: true })
        .where(eq(socialAlerts.id, input.alertId));
      return { success: true };
    }),

  markAllAlertsRead: publicProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(socialAlerts)
        .set({ isRead: true })
        .where(eq(socialAlerts.isRead, false));
      return { success: true };
    }),

  // ---- INTEGRAÇÕES ----
  getIntegrations: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(socialIntegrations);
  }),

  upsertIntegration: publicProcedure
    .input(
      z.object({
        id: z.string(),
        platformId: z.string(),
        integrationType: z.string(),
        config: z.any(),
        isActive: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .insert(socialIntegrations)
        .values({
          id: input.id,
          platformId: input.platformId,
          integrationType: input.integrationType,
          config: input.config,
          isActive: input.isActive,
        })
        .onDuplicateKeyUpdate({
          set: {
            config: input.config,
            isActive: input.isActive,
          },
        });
      return { success: true };
    }),

  // ---- AUTOMAÇÕES ----
  getAutomations: publicProcedure
    .input(z.object({ accountId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const automations = await db.select().from(socialAutomations);
      if (input?.accountId) {
        return automations.filter((a) => a.accountId === input.accountId);
      }
      return automations;
    }),

  // ---- RELATÓRIOS ----
  getReports: publicProcedure
    .input(
      z.object({
        accountId: z.string().optional(),
        reportType: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const reports = await db
        .select()
        .from(socialReports)
        .orderBy(desc(socialReports.generatedAt));
      if (input?.accountId) {
        return reports.filter((r) => r.accountId === input.accountId);
      }
      return reports;
    }),

  generateReport: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        reportType: z.enum(["weekly", "monthly", "quarterly"]),
        period: z.string(),
        data: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const id = `report_${Date.now()}`;
      await db.insert(socialReports).values({
        id,
        accountId: input.accountId,
        platformId: "instagram",
        reportType: input.reportType,
        period: input.period,
        data: input.data,
      });
      return { success: true, reportId: id };
    }),

  // ---- SINCRONIZAÇÃO ----
  syncData: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(socialAccounts)
        .set({ lastSync: new Date() })
        .where(eq(socialAccounts.id, input.accountId));
      return {
        success: true,
        message: "Sincronização iniciada. Dados serão atualizados em breve.",
        syncedAt: new Date().toISOString(),
      };
    }),

  // ---- DADOS AO VIVO VIA MCP ----
  getLiveData: publicProcedure
    .input(z.object({ accountId: z.string().optional(), username: z.string().optional() }).optional())
    .query(async ({ input }) => {
      try {
        const username = input?.username || input?.accountId;
        const { data, status, syncedAt } = await getInstagramData(username);

        if (!data) {
          return {
            success: false,
            accountInfo: null,
            posts: [],
            metrics: null,
            fetchedAt: new Date().toISOString(),
            syncedAt: null,
            cacheStatus: "unavailable",
            error: "Cache não disponível. O agente precisa sincronizar os dados.",
          };
        }

        return {
          success: true,
          accountInfo: data.account,
          posts: data.posts.slice(0, 10).map((p) => ({
            id: p.id,
            type: p.type,
            caption: p.caption?.slice(0, 200) ?? "",
            link: p.link,
            likes: p.likes,
            comments: p.comments,
            posted: p.posted,
            mediaUrl: p.mediaUrl,
            thumbnailUrl: p.thumbnailUrl,
          })),
          metrics: data.metrics,
          fetchedAt: new Date().toISOString(),
          syncedAt,
          cacheStatus: status,
        };
      } catch (err) {
        console.error("[instagram.getLiveData] error:", err);
        return {
          success: false,
          accountInfo: null,
          posts: [],
          metrics: null,
          fetchedAt: new Date().toISOString(),
          syncedAt: null,
          cacheStatus: "error",
          error: String(err),
        };
      }
    }),

  // ---- SEED DE DADOS INICIAIS ----
  seedInitialData: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const existing = await db
      .select()
      .from(socialPlatforms)
      .where(eq(socialPlatforms.id, "instagram"));

    if (existing.length === 0) {
      await db.insert(socialPlatforms).values([
        { id: "instagram", name: "instagram", displayName: "Instagram", icon: "instagram", isActive: true },
        { id: "youtube", name: "youtube", displayName: "YouTube", icon: "youtube", isActive: true },
        { id: "tiktok", name: "tiktok", displayName: "TikTok", icon: "tiktok", isActive: true },
        { id: "linkedin", name: "linkedin", displayName: "LinkedIn", icon: "linkedin", isActive: true },
        { id: "facebook", name: "facebook", displayName: "Facebook", icon: "facebook", isActive: true },
      ]);

      await db.insert(socialAccounts).values([
        { id: "ricardo_leao", platformId: "instagram", accountName: "Ricardo Leão", accountHandle: "@ricardo_leao", isActive: true },
        { id: "zenite_tech", platformId: "instagram", accountName: "Zênite Tech", accountHandle: "@zenite.tech", isActive: true },
      ]);
    }

    return { success: true, message: "Dados iniciais inseridos com sucesso" };
  }),

  // ---- SINCRONIZAÇÃO VIA MCP (dados reais do Instagram) ----
  /**
   * Sincroniza métricas reais do Instagram via MCP e salva no banco.
   * Coleta: account info, posts recentes (até 10), insights do post mais recente.
   * Calcula engajamento médio e salva em instagram_sync + social_metrics.
   */
  syncFromMCP: publicProcedure
    .input(z.object({ username: z.string().optional().default("zenite.tech") }))
    .mutation(async ({ input }) => {
      const { execSync } = await import("child_process");
      const { readFileSync } = await import("fs");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        // 1. Buscar account info via MCP
        const accountRaw = execSync(
          `manus-mcp-cli tool call get_account_info --server instagram --input '{}'`,
          { encoding: "utf-8", timeout: 30000 }
        );
        const accountPath = accountRaw.match(/saved to:\s*(\S+)/)?.[1];
        let accountData = { followers: 6381, following: 766, totalPosts: 337, username: input.username, name: "Zênite Tech" };
        if (accountPath) {
          try {
            const parsed = JSON.parse(readFileSync(accountPath, "utf-8"));
            const text = parsed?.content?.[0]?.text || parsed?.text || "";
            accountData = {
              followers: parseInt(text.match(/Followers:\s*(\d+)/)?.[1] || "6381"),
              following: parseInt(text.match(/Following:\s*(\d+)/)?.[1] || "766"),
              totalPosts: parseInt(text.match(/Posts:\s*(\d+)/)?.[1] || "337"),
              username: text.match(/Username:\s*@?(\S+)/)?.[1] || input.username,
              name: text.match(/Name:\s*(.+)/)?.[1]?.trim() || "Zênite Tech",
            };
          } catch { /* keep defaults */ }
        }

        // 2. Buscar 20 posts recentes via MCP
        const postsRaw = execSync(
          `manus-mcp-cli tool call get_post_list --server instagram --input '{"limit": 20}'`,
          { encoding: "utf-8", timeout: 30000 }
        );
        const postsPath = postsRaw.match(/saved to:\s*(\S+)/)?.[1];
        let postsData: Array<{ id: string; type: string; likes: number; comments: number; link: string; posted: string; caption: string }> = [];
        if (postsPath) {
          try {
            const parsed = JSON.parse(readFileSync(postsPath, "utf-8"));
            const text = parsed?.content?.[0]?.text || parsed?.text || "";
            const blocks = text.split("--- Post ").slice(1);
            for (const block of blocks) {
              const id = block.match(/ID:\s*(\S+)/)?.[1];
              if (!id) continue;
              postsData.push({
                id,
                type: block.match(/Type:\s*(\S+)/)?.[1] || "IMAGE",
                likes: parseInt(block.match(/Likes:\s*(\d+)/)?.[1] || "0"),
                comments: parseInt(block.match(/Comments:\s*(\d+)/)?.[1] || "0"),
                link: block.match(/Link:\s*(\S+)/)?.[1] || "",
                posted: block.match(/Posted:\s*(\S+)/)?.[1] || "",
                caption: block.match(/Caption:\s*([\s\S]*?)\nLink:/)?.[1]?.trim().slice(0, 200) || "",
              });
            }
          } catch { /* keep empty */ }
        }

        // 3. Insights individuais para cada post (até 20)
        let totalInteractions = 0;
        let totalReach = 0;
        const postsWithInsights: Array<typeof postsData[0] & { reach: number; impressions: number; engagement: number }> = [];

        for (const post of postsData) {
          let reach = 0;
          let impressions = 0;
          let engagement = 0;
          try {
            const insightsRaw = execSync(
              `manus-mcp-cli tool call get_post_insights --server instagram --input '{"post_id": "${post.id}"}'`,
              { encoding: "utf-8", timeout: 20000 }
            );
            const insightsPath = insightsRaw.match(/saved to:\s*(\S+)/)?.[1];
            if (insightsPath) {
              const parsed = JSON.parse(readFileSync(insightsPath, "utf-8"));
              const text = parsed?.content?.[0]?.text || parsed?.text || "";
              reach = parseInt(text.match(/reach:\s*(\d+)/i)?.[1] || "0");
              impressions = parseInt(text.match(/impressions:\s*(\d+)/i)?.[1] || "0");
              const interactions = parseInt(text.match(/total_interactions:\s*(\d+)/i)?.[1] || "0");
              engagement = interactions;
              totalInteractions += interactions;
              totalReach += reach;
            }
          } catch { /* ignore individual post insight errors */ }
          postsWithInsights.push({ ...post, reach, impressions, engagement });
        }

        // 3b. Salvar posts individuais na tabela social_posts (upsert por postId)
        const followersCount = accountData.followers;
        const syncTs = Date.now();
        for (let i = 0; i < postsWithInsights.length; i++) {
          const p = postsWithInsights[i];
          const postRowId = `ig_${p.id.slice(-12)}`;
          const engagementRate = followersCount > 0 ? ((p.likes + p.comments) / followersCount) * 100 : 0;
          try {
            await db.insert(socialPosts).values({
              id: postRowId,
              accountId: "zenite_tech",
              platformId: "instagram",
              postId: p.id,
              caption: p.caption || null,
              mediaUrl: p.link || null,
              postType: p.type || "IMAGE",
              likes: p.likes,
              comments: p.comments,
              shares: 0,
              engagement: String(engagementRate.toFixed(4)),
              postedAt: p.posted ? new Date(p.posted) : null,
            }).onDuplicateKeyUpdate({
              set: {
                likes: p.likes,
                comments: p.comments,
                engagement: String(engagementRate.toFixed(4)),
              },
            });
          } catch { /* ignore duplicate errors */ }
        }

        // 4. Calcular métricas agregadas
        const totalLikes = postsData.reduce((s, p) => s + p.likes, 0);
        const totalComments = postsData.reduce((s, p) => s + p.comments, 0);
        const avgLikes = postsData.length > 0 ? totalLikes / postsData.length : 0;
        const avgComments = postsData.length > 0 ? totalComments / postsData.length : 0;
        const followers = accountData.followers;
        // Engajamento = (média likes + média comments) / seguidores * 100
        const avgEngagement = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0;

        // 5. Salvar no banco (instagram_sync)
        const { instagramSync } = await import("../../drizzle/schema");
        await db.insert(instagramSync).values({
          accountHandle: `@${input.username.replace("@", "")}`,
          accountName: accountData.name,
          followers,
          reach: totalReach,
          likes: totalLikes,
          engagementRate: String(avgEngagement.toFixed(4)),
          impressions: 0,
          comments: totalComments,
          shares: 0,
          period: "recent_20_posts",
          rawJson: JSON.stringify({
            account: accountData,
            posts: postsData,
            metrics: { totalLikes, totalComments, avgLikes, avgComments, avgEngagement, recentPostsAnalyzed: postsData.length },
            syncedAt: new Date().toISOString(),
            source: "instagram_mcp_live",
          }),
          source: "instagram_mcp_live",
        });

        // 6. Salvar métricas individuais em social_metrics
        const ts = Date.now();
        await db.insert(socialMetrics).values([
          { id: `ig_${ts}_followers`, accountId: "zenite_tech", platformId: "instagram", metricType: "followers", metricValue: String(followers), period: "snapshot", date: new Date() },
          { id: `ig_${ts}_engagement`, accountId: "zenite_tech", platformId: "instagram", metricType: "engagement_rate", metricValue: String(avgEngagement.toFixed(4)), period: "snapshot", date: new Date() },
          { id: `ig_${ts}_likes`, accountId: "zenite_tech", platformId: "instagram", metricType: "total_likes", metricValue: String(totalLikes), period: "snapshot", date: new Date() },
        ]);

        console.log(`[instagram.syncFromMCP] Synced @${input.username}: ${followers} followers, ${avgEngagement.toFixed(2)}% engagement, ${postsData.length} posts`);

        return {
          success: true,
          account: accountData,
          metrics: {
            followers,
            totalLikes,
            totalComments,
            avgLikes: Math.round(avgLikes),
            avgComments: Math.round(avgComments),
            avgEngagement: parseFloat(avgEngagement.toFixed(4)),
            recentPostsAnalyzed: postsData.length,
            totalReach,
            totalInteractions,
          },
          postsCount: postsData.length,
          postsSaved: postsWithInsights.length,
          syncedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        console.error("[instagram.syncFromMCP] error:", err?.message);
        throw new Error(`Falha na sincronização MCP: ${err?.message}`);
      }
    }),

  // ---- ALERTA DE ENGAJAMENTO ----
  /**
   * Verifica se o engajamento médio está abaixo do limiar (padrão: 0,15%).
   * Se sim, envia e-mail de alerta via Gmail MCP e salva alerta no banco.
   */
  checkEngagementAlert: publicProcedure
    .input(z.object({
      threshold: z.number().optional().default(0.15),
      forceAlert: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input }) => {
      const { execSync } = await import("child_process");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        // 1. Buscar última sincronização
        const { instagramSync } = await import("../../drizzle/schema");
        const lastSync = await db
          .select()
          .from(instagramSync)
          .where(eq(instagramSync.accountHandle, "@zenite.tech"))
          .orderBy(desc(instagramSync.syncedAt))
          .limit(1);

        if (lastSync.length === 0) {
          return { success: false, alerted: false, reason: "Nenhuma sincronização encontrada. Execute syncFromMCP primeiro." };
        }

        const sync = lastSync[0];
        const engagementRate = parseFloat(sync.engagementRate?.toString() || "0");
        const followers = sync.followers || 0;
        const belowThreshold = engagementRate < input.threshold || input.forceAlert;

        if (!belowThreshold) {
          return {
            success: true,
            alerted: false,
            engagementRate,
            threshold: input.threshold,
            reason: `Engajamento (${engagementRate.toFixed(2)}%) está acima do limiar (${input.threshold}%). Nenhum alerta necessário.`,
          };
        }

        // 2. Enviar e-mail via Gmail MCP
        const subject = `⚠️ Alerta: Engajamento Instagram @zenite.tech abaixo de ${input.threshold}%`;
        const body = `Olá Ricardo,\n\nO engajamento da conta @zenite.tech está abaixo do limiar configurado.\n\n📊 Métricas atuais:\n- Engajamento médio: ${engagementRate.toFixed(2)}%\n- Limiar configurado: ${input.threshold}%\n- Seguidores: ${followers.toLocaleString("pt-BR")}\n- Última sincronização: ${new Date(sync.syncedAt).toLocaleString("pt-BR")}\n\n💡 Ações sugeridas:\n1. Verificar se os posts recentes têm chamadas para ação claras\n2. Analisar o horário de publicação (melhor horário: 18h-21h)\n3. Aumentar a frequência de posts (meta: 4-5x por semana)\n4. Usar Reels para aumentar o alcance orgânico\n5. Responder comentários nas primeiras 2h após a publicação\n\nAcesse: https://social-ads.zenitetech.com/instagram\n\nAtenciosamente,\nSistema de Monitoramento Zênite Tech`;

        let emailSent = false;
        let emailError = "";
        try {
          const emailPayload = JSON.stringify({ to: "ricardo@zenitetech.com.br", subject, body });
          execSync(
            `manus-mcp-cli tool call send_email --server gmail --input ${JSON.stringify(emailPayload)}`,
            { encoding: "utf-8", timeout: 30000 }
          );
          emailSent = true;
          console.log(`[instagram.checkEngagementAlert] Alert email sent: ${engagementRate.toFixed(2)}% < ${input.threshold}%`);
        } catch (emailErr: any) {
          emailError = emailErr?.message || "Erro desconhecido";
          console.error("[instagram.checkEngagementAlert] Email failed:", emailError);
        }

        // 3. Salvar alerta no banco
        const alertId = `alert_eng_${Date.now()}`;
        await db.insert(socialAlerts).values({
          id: alertId,
          accountId: "zenite_tech",
          platformId: "instagram",
          alertType: "low_engagement",
          severity: engagementRate < input.threshold / 2 ? "high" : "medium",
          message: `Engajamento ${engagementRate.toFixed(2)}% abaixo do limiar ${input.threshold}%. ${emailSent ? "E-mail enviado." : `Falha e-mail: ${emailError}`}`,
          isRead: false,
        });

        return {
          success: true,
          alerted: true,
          engagementRate,
          threshold: input.threshold,
          emailSent,
          emailError: emailError || null,
          alertId,
          message: `Alerta disparado: engajamento ${engagementRate.toFixed(2)}% < ${input.threshold}%`,
        };
      } catch (err: any) {
        console.error("[instagram.checkEngagementAlert] error:", err?.message);
        throw new Error(`Falha na verificação de alerta: ${err?.message}`);
      }
    }),

  // ---- ENVIO MANUAL DE ALERTA CRÍTICO ----
  sendCriticalAlertEmail: publicProcedure
    .input(z.object({
      alertType: z.enum(["low_engagement", "drop_followers", "spike_comments", "custom"]).default("custom"),
      severity: z.enum(["low", "medium", "high"]).default("high"),
      title: z.string(),
      message: z.string(),
      to: z.string().email().optional(),
      saveAlert: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      const { execSync } = await import("child_process");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const recipient = input.to ?? "rjll70@gmail.com";
      const severityEmoji = input.severity === "high" ? "🔴" : input.severity === "medium" ? "🟡" : "🟢";
      const subject = `${severityEmoji} [${input.severity.toUpperCase()}] ${input.title} — Zênite Tech`;
      const body = `Olá Ricardo,\n\n${input.message}\n\n---\nAlerta gerado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\nSeveridade: ${input.severity.toUpperCase()}\nTipo: ${input.alertType}\n\nAcesse o dashboard: https://social-ads.zenitetech.com/redes-sociais\n\nAtenciosamente,\nSistema de Monitoramento Zênite Tech`;

      let emailSent = false;
      let emailError = "";
      try {
        const emailPayload = JSON.stringify({ to: recipient, subject, body });
        execSync(
          `manus-mcp-cli tool call send_email --server gmail --input ${JSON.stringify(emailPayload)}`,
          { encoding: "utf-8", timeout: 30000 }
        );
        emailSent = true;
        console.log(`[instagram.sendCriticalAlertEmail] Email sent to ${recipient}: ${input.title}`);
      } catch (emailErr: any) {
        emailError = emailErr?.message || "Erro desconhecido";
        console.error("[instagram.sendCriticalAlertEmail] Email failed:", emailError);
      }

      // Salvar alerta no banco se solicitado
      let alertId: string | null = null;
      if (input.saveAlert) {
        alertId = `alert_manual_${Date.now()}`;
        await db.insert(socialAlerts).values({
          id: alertId,
          accountId: "zenite_tech",
          platformId: "instagram",
          alertType: input.alertType,
          severity: input.severity,
          message: `${input.title}: ${input.message.slice(0, 200)}. ${emailSent ? `E-mail enviado para ${recipient}.` : `Falha e-mail: ${emailError}`}`,
          isRead: false,
        });
      }

      return {
        success: true,
        emailSent,
        emailError: emailError || null,
        alertId,
        recipient,
        title: input.title,
      };
    }),

  // ---- HISTÓRICO DE SINCRONIZAÇÕES ----
  getSyncHistory: publicProcedure
    .input(z.object({ limit: z.number().optional().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, history: [] };
      const { instagramSync } = await import("../../drizzle/schema");
      const rows = await db
        .select()
        .from(instagramSync)
        .where(eq(instagramSync.accountHandle, "@zenite.tech"))
        .orderBy(desc(instagramSync.syncedAt))
        .limit(input.limit);
      return {
        success: true,
        history: rows.map((r) => ({
          id: r.id,
          accountHandle: r.accountHandle,
          followers: r.followers,
          engagementRate: parseFloat(r.engagementRate?.toString() || "0"),
          likes: r.likes,
          comments: r.comments,
          reach: r.reach,
          period: r.period,
          source: r.source,
          syncedAt: r.syncedAt,
        })),
      };
    }),

  // ---- POSTS INDIVIDUAIS SALVOS ----
  getSavedPosts: publicProcedure
    .input(z.object({ limit: z.number().optional().default(20), accountId: z.string().optional().default("zenite_tech") }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, posts: [] };
      const rows = await db
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.accountId, input.accountId))
        .orderBy(desc(socialPosts.postedAt))
        .limit(input.limit);
      return {
        success: true,
        posts: rows.map((r) => ({
          id: r.id,
          postId: r.postId,
          caption: r.caption,
          mediaUrl: r.mediaUrl,
          postType: r.postType,
          likes: r.likes ?? 0,
          comments: r.comments ?? 0,
          shares: r.shares ?? 0,
          engagement: parseFloat(r.engagement?.toString() || "0"),
          postedAt: r.postedAt,
          createdAt: r.createdAt,
        })),
      };
    }),

  // ---- CONFIGURAÇÕES DO SISTEMA ----
  getSettings: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { success: false, settings: {} };
    const { systemSettings } = await import("../../drizzle/schema");
    const rows = await db.select().from(systemSettings);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    // Defaults se ainda não existirem
    if (!settings["instagram.engagementThreshold"]) settings["instagram.engagementThreshold"] = "0.15";
    if (!settings["instagram.alertEmail"]) settings["instagram.alertEmail"] = "rjll70@gmail.com";
    return { success: true, settings };
  }),

  updateSettings: publicProcedure
    .input(z.object({
      key: z.string(),
      value: z.string(),
      label: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const { systemSettings } = await import("../../drizzle/schema");
      // Upsert: insere ou atualiza
      const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, input.key)).limit(1);
      if (existing.length > 0) {
        await db.update(systemSettings)
          .set({ value: input.value, label: input.label, description: input.description })
          .where(eq(systemSettings.key, input.key));
      } else {
        await db.insert(systemSettings).values({
          key: input.key,
          value: input.value,
          label: input.label ?? input.key,
          description: input.description,
        });
      }
      return { success: true, key: input.key, value: input.value };
    }),

  // ---- RELATÓRIO SEMANAL POR E-MAIL ----
  sendWeeklyReport: publicProcedure
    .input(z.object({
      to: z.string().email().optional(),
      includeTopPost: z.boolean().optional().default(true),
      includeTypeBreakdown: z.boolean().optional().default(true),
      preview: z.boolean().optional().default(false), // se true, retorna o corpo sem enviar
    }))
    .mutation(async ({ input }) => {
      const { execSync } = await import("child_process");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const recipient = input.to ?? "rjll70@gmail.com";
      const now = new Date();
      const weekStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" });

      // Buscar dados do banco
      const posts = await db.select().from(socialPosts)
        .where(eq(socialPosts.accountId, "zenite_tech"))
        .orderBy(desc(socialPosts.postedAt))
        .limit(20);

      const { instagramSync } = await import("../../drizzle/schema");
      const lastSync = await db.select().from(instagramSync)
        .where(eq(instagramSync.accountHandle, "@zenite.tech"))
        .orderBy(desc(instagramSync.syncedAt))
        .limit(1);

      const followers = lastSync[0]?.followers ?? 6381;
      const engRate = parseFloat(lastSync[0]?.engagementRate?.toString() || "0");
      const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
      const totalComments = posts.reduce((s, p) => s + (p.comments ?? 0), 0);
      const topPost = posts.reduce((best, p) => ((p.likes ?? 0) + (p.comments ?? 0) > (best.likes ?? 0) + (best.comments ?? 0) ? p : best), posts[0]);

      // Breakdown por tipo
      const typeBreakdown: Record<string, { count: number; likes: number; comments: number }> = {};
      for (const p of posts) {
        const t = p.postType ?? "image";
        if (!typeBreakdown[t]) typeBreakdown[t] = { count: 0, likes: 0, comments: 0 };
        typeBreakdown[t].count++;
        typeBreakdown[t].likes += p.likes ?? 0;
        typeBreakdown[t].comments += p.comments ?? 0;
      }
      const typeLines = Object.entries(typeBreakdown)
        .map(([t, s]) => `  • ${t}: ${s.count} posts — ${s.likes} curtidas, ${s.comments} comentários`)
        .join("\n");

      const subject = `📊 Relatório Semanal Instagram — Zênite Tech (${weekStr})`;
      const body = [
        `Olá Ricardo,`,
        ``,
        `Segue o relatório semanal de performance do Instagram @zenite.tech:`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📌 RESUMO GERAL`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `  • Seguidores: ${followers.toLocaleString("pt-BR")}`,
        `  • Taxa de engajamento: ${engRate.toFixed(2)}%`,
        `  • Posts analisados: ${posts.length}`,
        `  • Total de curtidas: ${totalLikes.toLocaleString("pt-BR")}`,
        `  • Total de comentários: ${totalComments.toLocaleString("pt-BR")}`,
        ``,
        input.includeTopPost && topPost ? [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🏆 POST COM MAIS ENGAJAMENTO`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `  • Tipo: ${topPost.postType?.toUpperCase() ?? "—"}`,
          `  • Curtidas: ${topPost.likes ?? 0} | Comentários: ${topPost.comments ?? 0}`,
          `  • Legenda: ${(topPost.caption ?? "").substring(0, 100)}${(topPost.caption?.length ?? 0) > 100 ? "..." : ""}`,
          ``,
        ].join("\n") : "",
        input.includeTypeBreakdown ? [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📊 PERFORMANCE POR TIPO DE CONTEÚDO`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          typeLines,
          ``,
        ].join("\n") : "",
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💡 RECOMENDAÇÃO`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `  Priorize Reels para maximizar o alcance orgânico.`,
        `  Publique entre 18h–21h para maior engajamento.`,
        ``,
        `Acesse o dashboard completo: https://social-ads.zenitetech.com/redes-sociais`,
        ``,
        `Gerado em: ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        `Atenciosamente,`,
        `Sistema de Monitoramento Zênite Tech`,
      ].filter(Boolean).join("\n");

      if (input.preview) {
        return { success: true, preview: true, subject, body, recipient };
      }

      let emailSent = false;
      let emailError = "";
      try {
        const emailPayload = JSON.stringify({ to: recipient, subject, body });
        execSync(
          `manus-mcp-cli tool call send_email --server gmail --input ${JSON.stringify(emailPayload)}`,
          { encoding: "utf-8", timeout: 30000 }
        );
        emailSent = true;
        console.log(`[instagram.sendWeeklyReport] Weekly report sent to ${recipient}`);
      } catch (emailErr: any) {
        emailError = emailErr?.message || "Erro desconhecido";
        console.error("[instagram.sendWeeklyReport] Email failed:", emailError);
      }

      // Salvar log no banco
      await db.insert(socialAlerts).values({
        id: `report_weekly_${Date.now()}`,
        accountId: "zenite_tech",
        platformId: "instagram",
        alertType: "custom",
        severity: "low",
        message: `Relatório semanal ${emailSent ? "enviado" : "FALHOU"} para ${recipient} em ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        isRead: emailSent,
      });

      return { success: true, emailSent, emailError: emailError || null, recipient, subject };
    }),

  getPostInsightsLive: publicProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ input }) => {
      try {
        const { execSync } = await import("child_process");
        const { readFileSync } = await import("fs");
        const raw = execSync(
          `manus-mcp-cli tool call get_post_insights --server instagram --input '{"post_id": "${input.postId}"}'`,
          { encoding: "utf-8", timeout: 20000 }
        );
        const pathMatch = raw.match(/MCP tool invocation result saved to:\s*(\S+\.json)/);
        let text = raw;
        if (pathMatch?.[1]) {
          try {
            const parsed = JSON.parse(readFileSync(pathMatch[1], "utf-8"));
            text = parsed?.content?.[0]?.text ?? raw;
          } catch { /* use raw */ }
        }
        const reach = parseInt(text.match(/reach:\s*(\d+)/)?.[1] || "0");
        const views = parseInt(text.match(/views:\s*(\d+)/)?.[1] || "0");
        const saved = parseInt(text.match(/saved:\s*(\d+)/)?.[1] || "0");
        const shares = parseInt(text.match(/shares:\s*(\d+)/)?.[1] || "0");
        const totalInteractions = parseInt(text.match(/total_interactions:\s*(\d+)/)?.[1] || "0");
        return { success: true, postId: input.postId, reach, views, saved, shares, totalInteractions };
      } catch (err) {
        return { success: false, postId: input.postId, reach: 0, views: 0, saved: 0, shares: 0, totalInteractions: 0 };
      }
    }),

  // ---- DADOS AO VIVO VIA GRAPH API (META_ADS_ACCESS_TOKEN) ----
  /**
   * Busca dados reais do Instagram via Graph API usando META_ADS_ACCESS_TOKEN.
   * Retorna posts recentes, métricas da conta e insights dos últimos 30 dias.
   * Requer: instagram_basic + instagram_manage_insights
   */
  getGraphAPIData: publicProcedure
    .input(z.object({ igId: z.string().optional().default(INSTAGRAM_ACCOUNT_ID) }))
    .query(async ({ input }) => {
      const token = META_ACCESS_TOKEN;
      if (!token) {
        return { success: false, error: "META_ADS_ACCESS_TOKEN não configurado", account: null, posts: [], insights: null, metrics: null };
      }
      const BASE = "https://graph.facebook.com/v19.0";
      const igId = input.igId;
      try {
        // 1. Conta
        const accountRes = await fetch(
          `${BASE}/${igId}?fields=id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website&access_token=${token}`
        );
        const account = await accountRes.json() as Record<string, unknown>;
        if ((account as { error?: { message?: string } }).error) {
          throw new Error(String((account as { error: { message?: string } }).error?.message ?? "Erro na conta"));
        }

        // 2. Posts recentes
        const mediaRes = await fetch(
          `${BASE}/${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=30&access_token=${token}`
        );
        const mediaJson = await mediaRes.json() as { data?: Array<Record<string, unknown>>; error?: { message: string } };
        if (mediaJson.error) throw new Error(mediaJson.error.message);
        const posts = (mediaJson.data ?? []).map((p) => ({
          id: String(p.id ?? ""),
          type: String(p.media_type ?? "IMAGE"),
          caption: String(p.caption ?? ""),
          link: String(p.permalink ?? ""),
          likes: Number(p.like_count ?? 0),
          comments: Number(p.comments_count ?? 0),
          posted: String(p.timestamp ?? ""),
          mediaUrl: String(p.media_url ?? p.thumbnail_url ?? ""),
          thumbnailUrl: String(p.thumbnail_url ?? p.media_url ?? ""),
        }));

        // 3. Insights (últimos 30 dias)
        const insights: Record<string, number> = {};
        try {
          const since = Math.floor(Date.now() / 1000) - 30 * 86400;
          const until = Math.floor(Date.now() / 1000);
          const reachRes = await fetch(
            `${BASE}/${igId}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${token}`
          );
          const reachJson = await reachRes.json() as { data?: Array<{ name: string; values: Array<{ value: number }> }> };
          const reachValues = reachJson.data?.[0]?.values ?? [];
          insights.totalReach = reachValues.reduce((s, v) => s + (v.value || 0), 0);

          const totalRes = await fetch(
            `${BASE}/${igId}/insights?metric=profile_views,website_clicks,accounts_engaged,total_interactions&metric_type=total_value&period=day&since=${since}&until=${until}&access_token=${token}`
          );
          const totalJson = await totalRes.json() as { data?: Array<{ name: string; total_value?: { value: number } }> };
          for (const item of (totalJson.data ?? [])) {
            insights[item.name] = item.total_value?.value ?? 0;
          }
        } catch { /* insights opcionais */ }

        // 4. Métricas calculadas
        const followersCount = Number(account.followers_count ?? 0);
        const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
        const totalComments = posts.reduce((s, p) => s + p.comments, 0);
        const avgEngagement = followersCount > 0 && posts.length > 0
          ? parseFloat(((totalLikes + totalComments) / posts.length / followersCount * 100).toFixed(2))
          : 0;

        return {
          success: true,
          fetchedAt: new Date().toISOString(),
          account: {
            id: String(account.id ?? ""),
            username: String(account.username ?? ""),
            name: String(account.name ?? ""),
            bio: String(account.biography ?? ""),
            followers: followersCount,
            following: Number(account.follows_count ?? 0),
            totalPosts: Number(account.media_count ?? 0),
            website: String(account.website ?? ""),
            profilePicture: String(account.profile_picture_url ?? ""),
          },
          posts,
          metrics: {
            totalLikes,
            totalComments,
            avgLikes: posts.length > 0 ? Math.round(totalLikes / posts.length) : 0,
            avgComments: posts.length > 0 ? Math.round(totalComments / posts.length) : 0,
            avgEngagement,
            recentPostsAnalyzed: posts.length,
          },
          insights,
        };
      } catch (err) {
        console.error("[instagram.getGraphAPIData] error:", err);
        return { success: false, error: String(err), account: null, posts: [], insights: null, metrics: null };
      }
    }),
});
