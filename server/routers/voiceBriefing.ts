import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { voiceBriefings, voiceBriefingConfig } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";

async function getVoxforgeUrl(): Promise<string> {
  const db = await getDb();
  if (!db) return process.env.VOXFORGE_URL ?? "http://localhost:8000";
  const rows = await db.select().from(voiceBriefingConfig).limit(1);
  return rows[0]?.voxforgeUrl ?? process.env.VOXFORGE_URL ?? "http://localhost:8000";
}

async function getVoice(): Promise<string> {
  const db = await getDb();
  if (!db) return "pt-BR-Ricardo";
  const rows = await db.select().from(voiceBriefingConfig).limit(1);
  return rows[0]?.voice ?? "pt-BR-Ricardo";
}

/**
 * Gera o texto do briefing via LLM com dados do dia.
 */
async function generateBriefingText(data: {
  date: string;
  alerts: string[];
  ctr?: number;
  cpc?: number;
  conversions?: number;
}): Promise<string> {
  const alertsText = data.alerts.length > 0
    ? data.alerts.slice(0, 3).join("; ")
    : "Nenhum alerta crítico";

  const metricsText = [
    data.ctr !== undefined ? `CTR: ${(data.ctr * 100).toFixed(1)}%` : null,
    data.cpc !== undefined ? `CPC: R$${data.cpc.toFixed(2)}` : null,
    data.conversions !== undefined ? `Conversões: ${data.conversions}` : null,
  ].filter(Boolean).join(", ");

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Você é o assistente de marketing da Zênite Tech. Gere briefings executivos concisos em português BR.",
        },
        {
          role: "user",
          content: `Gere um briefing executivo de 60 segundos em português BR, natural e direto, com os dados abaixo. Comece com a saudação e termine com a ação mais urgente do dia.

Data: ${data.date}
Alertas: ${alertsText}
Métricas do dia: ${metricsText || "Dados não disponíveis"}

Máximo 150 palavras. Tom profissional e objetivo.`,
        },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    return "Briefing não disponível.";
  } catch {
    return `Bom dia! Briefing Zênite Tech — ${data.date}. ${alertsText}. ${metricsText}. Acesse o dashboard para detalhes completos.`;
  }
}

/**
 * Sintetiza texto em áudio via VoxForge TTS.
 */
async function synthesizeSpeech(text: string, voice: string, voxforgeUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`${voxforgeUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, language: "pt" }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

export const voiceBriefingRouter = router({
  /**
   * Busca o briefing mais recente.
   */
  getLatest: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(voiceBriefings).orderBy(desc(voiceBriefings.createdAt)).limit(1);
    return rows[0] ?? null;
  }),

  /**
   * Busca histórico de briefings.
   */
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(90).default(30) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(voiceBriefings).orderBy(desc(voiceBriefings.createdAt)).limit(input?.limit ?? 30);
    }),

  /**
   * Gera um briefing agora (manual).
   */
  generateNow: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const today = new Date().toISOString().slice(0, 10);
    const voxforgeUrl = await getVoxforgeUrl();
    const voice = await getVoice();

    // Gerar texto via LLM
    const text = await generateBriefingText({
      date: today,
      alerts: ["Verificar performance das campanhas", "Revisar grupos com CTR abaixo de 5%"],
    });

    // Tentar sintetizar áudio
    const audioBuffer = await synthesizeSpeech(text, voice, voxforgeUrl);
    let audioUrl: string | null = null;
    let audioKey: string | null = null;

    if (audioBuffer) {
      const key = `briefings/${today}.mp3`;
      try {
        const result = await storagePut(key, audioBuffer, "audio/mpeg");
        audioUrl = result.url;
        audioKey = result.key;
      } catch {
        // Continua sem áudio se S3 falhar
      }
    }

    // Salvar no banco (upsert por data)
    const existing = await db.select().from(voiceBriefings).where(eq(voiceBriefings.date, today)).limit(1);
    if (existing.length > 0) {
      await db.update(voiceBriefings).set({
        text,
        audioUrl: audioUrl ?? undefined,
        audioKey: audioKey ?? undefined,
        listenedAt: undefined,
      }).where(eq(voiceBriefings.date, today));
    } else {
      await db.insert(voiceBriefings).values({
        date: today,
        text,
        audioUrl: audioUrl ?? undefined,
        audioKey: audioKey ?? undefined,
      });
    }

    return {
      success: true,
      date: today,
      text,
      hasAudio: !!audioUrl,
      audioUrl,
      voxforgeAvailable: !!audioBuffer,
    };
  }),

  /**
   * Marca um briefing como ouvido.
   */
  markAsListened: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(voiceBriefings).set({ listenedAt: new Date() }).where(eq(voiceBriefings.id, input.id));
      return { success: true };
    }),

  /**
   * Busca a configuração do briefing de voz.
   */
  getConfig: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(voiceBriefingConfig).limit(1);
    return rows[0] ?? null;
  }),

  /**
   * Atualiza a configuração do briefing de voz.
   */
  updateConfig: protectedProcedure
    .input(z.object({
      enabled: z.boolean().optional(),
      voxforgeUrl: z.string().optional(),
      voice: z.string().optional(),
      generationHour: z.number().min(0).max(23).optional(),
      generationMinute: z.number().min(0).max(59).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const existing = await db.select().from(voiceBriefingConfig).limit(1);
      if (existing.length > 0) {
        await db.update(voiceBriefingConfig).set({
          ...(input.enabled !== undefined && { enabled: input.enabled }),
          ...(input.voxforgeUrl !== undefined && { voxforgeUrl: input.voxforgeUrl }),
          ...(input.voice !== undefined && { voice: input.voice }),
          ...(input.generationHour !== undefined && { generationHour: input.generationHour }),
          ...(input.generationMinute !== undefined && { generationMinute: input.generationMinute }),
        });
      } else {
        await db.insert(voiceBriefingConfig).values({
          enabled: input.enabled ?? false,
          voxforgeUrl: input.voxforgeUrl ?? "http://localhost:8000",
          voice: input.voice ?? "pt-BR-Ricardo",
          generationHour: input.generationHour ?? 7,
          generationMinute: input.generationMinute ?? 45,
        });
      }
      return { success: true };
    }),
});
