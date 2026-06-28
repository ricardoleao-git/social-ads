/**
 * tRPC router for Instagram content creation.
 * Creates drafts (posts, stories, reels) and publishes via Meta Graph API.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { instagramDrafts } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { META_PAGE_ID, INSTAGRAM_ACCOUNT_ID, META_ACCESS_TOKEN } from "../credentials";

// ⚠️  IDs centralizados em server/credentials.ts — não edite aqui
const IG_BASE = "https://graph.facebook.com/v20.0";

const ACCOUNT_IG_IDS: Record<string, string> = {
  zenitetech: INSTAGRAM_ACCOUNT_ID,   // 17841406636761935 — @zenite.tech
  avantclube: "103614866023681",       // @avantclube
};

function getMetaToken(): string | null {
  return META_ACCESS_TOKEN || null;
}

// Instagram account metadata for UI
const INSTAGRAM_ACCOUNTS = {
  zenitetech: {
    pageId: META_PAGE_ID,
    username: "@zenite.tech",
    label: "Zênite Tech",
  },
  avantclube: {
    pageId: "103614866023681",
    username: "@avantclube",
    label: "AvantClube",
  },
};

/**
 * Aguarda o processamento de vídeo pela Meta API (polling).
 * Vídeos ficam em status PROCESSING antes de FINISHED.
 */
async function waitForVideoProcessing(
  containerId: string,
  token: string,
  maxAttempts = 12,
  intervalMs = 5000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(
      `${IG_BASE}/${containerId}?fields=status_code&access_token=${token}`
    );
    const data = await res.json();
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new Error("Processamento de vídeo falhou na Meta API");
    }
  }
  throw new Error("Timeout: vídeo não processado em 60s");
}

/**
 * Publica um rascunho no Instagram via Meta Graph API.
 * Suporta imagem simples, vídeo/reels e carrossel (até 10 mídias).
 * Exportada para ser reutilizada pelo job de agendamento.
 */
export async function publishInstagramDraft(draftId: number): Promise<{ igMediaId: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [draft] = await db
    .select()
    .from(instagramDrafts)
    .where(eq(instagramDrafts.id, draftId))
    .limit(1);

  if (!draft) throw new Error("Rascunho não encontrado");
  if (draft.status === "published") throw new Error("Rascunho já foi publicado");

  const token = META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ADS_ACCESS_TOKEN não configurado");

  const igUserId = ACCOUNT_IG_IDS[draft.account] ?? INSTAGRAM_ACCOUNT_ID;
  const mediaUrls: string[] = Array.isArray(draft.mediaUrls) ? draft.mediaUrls : [];
  const mediaTypes: string[] = Array.isArray(draft.mediaTypes) ? draft.mediaTypes : [];
  const caption = draft.caption ?? "";

  if (mediaUrls.length === 0) throw new Error("Rascunho sem mídia");

  try {
    let containerId: string;

    if (mediaUrls.length === 1) {
      // ── POST SIMPLES (imagem ou vídeo/reels) ──────────────────────────────
      const isVideo = mediaTypes[0] === "video";
      const body: Record<string, string> = { caption, access_token: token };

      if (isVideo) {
        body.media_type = draft.type === "reels" ? "REELS" : "VIDEO";
        body.video_url = mediaUrls[0];
      } else {
        body.image_url = mediaUrls[0];
      }

      const containerRes = await fetch(`${IG_BASE}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const containerData = await containerRes.json();
      if (containerData.error) throw new Error(containerData.error.message);
      containerId = containerData.id;

      if (isVideo) {
        await waitForVideoProcessing(containerId, token);
      }
    } else {
      // ── CARROSSEL (múltiplas mídias) ──────────────────────────────────────
      const childIds: string[] = [];

      for (let i = 0; i < mediaUrls.length; i++) {
        const isVideo = mediaTypes[i] === "video";
        const childBody: Record<string, string> = {
          is_carousel_item: "true",
          access_token: token,
        };
        if (isVideo) {
          childBody.media_type = "VIDEO";
          childBody.video_url = mediaUrls[i];
        } else {
          childBody.image_url = mediaUrls[i];
        }

        const childRes = await fetch(`${IG_BASE}/${igUserId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(childBody),
        });
        const childData = await childRes.json();
        if (childData.error) throw new Error(childData.error.message);
        childIds.push(childData.id);
      }

      const carouselRes = await fetch(`${IG_BASE}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          caption,
          children: childIds.join(","),
          access_token: token,
        }),
      });
      const carouselData = await carouselRes.json();
      if (carouselData.error) throw new Error(carouselData.error.message);
      containerId = carouselData.id;
    }

    // ── PUBLICAR O CONTAINER ──────────────────────────────────────────────
    const publishRes = await fetch(`${IG_BASE}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: token }),
    });
    const publishData = await publishRes.json();
    if (publishData.error) throw new Error(publishData.error.message);

    const igMediaId: string = publishData.id;

    await db
      .update(instagramDrafts)
      .set({
        status: "published",
        igMediaId,
        publishedAt: new Date(),
        publishError: null,
        updatedAt: new Date(),
      })
      .where(eq(instagramDrafts.id, draftId));

    console.log(`[InstagramPublish] Publicado: ${igMediaId} (draft ${draftId})`);
    return { igMediaId };

  } catch (err: any) {
    await db
      .update(instagramDrafts)
      .set({ publishError: err.message, updatedAt: new Date() })
      .where(eq(instagramDrafts.id, draftId));
    throw new Error(`Falha na publicação: ${err.message}`);
  }
}

export const instagramCreatorRouter = router({
  // List saved drafts
  listDrafts: protectedProcedure
    .input(z.object({
      account: z.enum(["zenitetech", "avantclube"]).default("zenitetech"),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { drafts: [] };
        const drafts = await db
          .select()
          .from(instagramDrafts)
          .where(eq(instagramDrafts.account, input.account))
          .orderBy(desc(instagramDrafts.createdAt))
          .limit(input.limit);

        return { drafts };
      } catch (e: any) {
        console.error("[InstagramCreator] listDrafts error:", e.message);
        return { drafts: [] };
      }
    }),

  // Save a draft (before publishing)
  saveDraft: protectedProcedure
    .input(z.object({
      account: z.enum(["zenitetech", "avantclube"]).default("zenitetech"),
      type: z.enum(["post", "story", "reels"]),
      caption: z.string().max(2200).optional(),
      hashtags: z.string().optional(),
      mediaUrls: z.array(z.string().url()).min(1).max(10),
      mediaTypes: z.array(z.enum(["image", "video"])).min(1).max(10),
      scheduledFor: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const fullCaption = input.caption
          ? `${input.caption}${input.hashtags ? "\n\n" + input.hashtags : ""}`
          : (input.hashtags ?? "");

        const [draft] = await db
          .insert(instagramDrafts)
          .values({
            account: input.account,
            type: input.type,
            caption: fullCaption,
            hashtags: input.hashtags ?? "",
            mediaUrls: input.mediaUrls,
            mediaTypes: input.mediaTypes,
            scheduledFor: input.scheduledFor ?? null,
            notes: input.notes ?? "",
            status: "draft",
            createdAt: new Date(),
          })
          .$returningId();

        return { success: true, draftId: draft.id };
      } catch (e: any) {
        console.error("[InstagramCreator] saveDraft error:", e.message);
        throw new Error("Erro ao salvar rascunho: " + e.message);
      }
    }),

  // Publish a draft to Instagram via Meta Graph API
  publishDraft: protectedProcedure
    .input(z.object({ draftId: z.number() }))
    .mutation(async ({ input }) => {
      return publishInstagramDraft(input.draftId);
    }),

  // Delete a draft
  deleteDraft: protectedProcedure
    .input(z.object({ draftId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(instagramDrafts).where(eq(instagramDrafts.id, input.draftId));
      return { success: true };
    }),

  // Update draft status (manual override)
  updateDraftStatus: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      status: z.enum(["draft", "scheduled", "published", "cancelled"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(instagramDrafts)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(instagramDrafts.id, input.draftId));
      return { success: true };
    }),

  // Generate caption with AI
  generateCaption: protectedProcedure
    .input(z.object({
      topic: z.string().min(5).max(500),
      type: z.enum(["post", "story", "reels"]),
      tone: z.enum(["profissional", "descontraído", "técnico", "comercial"]).default("profissional"),
      product: z.string().optional(),
      includeHashtags: z.boolean().default(true),
      includeEmoji: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const systemPrompt = `Você é especialista em marketing digital B2B para a empresa Zênite Tech (tecnologia, segurança eletrônica, controle de acesso, IA, WhatsApp, mobilidade elétrica). 
Crie legendas para Instagram que sejam diretas, profissionais e com CTA claro.
Produtos: GuardIA (segurança com IA), ZIPY (WhatsApp multiatendimento), Wallbox (carregador veículo elétrico), Zface (reconhecimento facial), Zblock, Catraca, PABX em nuvem, ConciergIA.`;

      const userPrompt = `Crie uma legenda para ${input.type} no Instagram com tom ${input.tone}.
Tema: ${input.topic}${input.product ? `\nProduto em destaque: ${input.product}` : ""}
${input.includeEmoji ? "Use emojis relevantes." : "Sem emojis."}
${input.includeHashtags ? "Inclua 10-15 hashtags relevantes no final." : "Sem hashtags."}
Formato de resposta JSON: { "caption": "...", "hashtags": "...", "cta": "..." }`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "instagram_caption",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  caption: { type: "string", description: "Legenda principal sem hashtags" },
                  hashtags: { type: "string", description: "Hashtags separadas por espaço" },
                  cta: { type: "string", description: "Call to action sugerido" },
                },
                required: ["caption", "hashtags", "cta"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response?.choices?.[0]?.message?.content;
        const parsed = typeof content === "string" ? JSON.parse(content) : content;
        return {
          caption: parsed.caption ?? "",
          hashtags: parsed.hashtags ?? "",
          cta: parsed.cta ?? "",
        };
      } catch (e: any) {
        console.error("[InstagramCreator] generateCaption error:", e.message);
        throw new Error("Erro ao gerar legenda: " + e.message);
      }
    }),

  // Get account info
  getAccounts: protectedProcedure.query(async () => {
    return {
      accounts: Object.entries(INSTAGRAM_ACCOUNTS).map(([key, val]) => ({
        key,
        ...val,
      })),
      isConfigured: !!getMetaToken(),
    };
  }),

  // Get draft stats
  getStats: protectedProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) return { total: 0, byStatus: {}, byType: {}, recent: [] };
      const allDrafts = await db.select().from(instagramDrafts);
      const byStatus = allDrafts.reduce((acc: Record<string, number>, d) => {
        acc[d.status] = (acc[d.status] ?? 0) + 1;
        return acc;
      }, {});
      const byType = allDrafts.reduce((acc: Record<string, number>, d) => {
        acc[d.type] = (acc[d.type] ?? 0) + 1;
        return acc;
      }, {});

      return {
        total: allDrafts.length,
        byStatus,
        byType,
        recent: allDrafts.slice(0, 5).map((d) => ({
          id: d.id,
          account: d.account,
          type: d.type,
          status: d.status,
          createdAt: d.createdAt,
        })),
      };
    } catch (e: any) {
      return { total: 0, byStatus: {}, byType: {}, recent: [] };
    }
  }),

  /**
   * Faz upload de uma imagem/vídeo (base64) para o S3 e retorna a URL pública.
   * A URL pode ser usada diretamente como mediaUrl no rascunho e na Meta API.
   * Limite: 16 MB por arquivo.
   */
  uploadMedia: protectedProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        mimeType: z.string(),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const MAX_BYTES = 16 * 1024 * 1024;
      const base64Data = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length > MAX_BYTES) {
        throw new Error(
          `Arquivo muito grande. Máximo 16 MB (enviado: ${(buffer.length / 1024 / 1024).toFixed(1)} MB).`
        );
      }
      const ext = input.mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
      const safeName = (input.fileName ?? "media")
        .replace(/[^a-z0-9_.-]/gi, "_")
        .slice(0, 40);
      const key = `instagram-media/${Date.now()}-${safeName}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),
});
