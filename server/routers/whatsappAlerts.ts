import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { whatsappConfig, whatsappAlerts } from "../../drizzle/schema";
import { desc } from "drizzle-orm";
import {
  sendWhatsAppAlert,
  formatAlertMessage,
  getWhatsAppConfig,
  getWhatsAppHistory,
} from "../whatsappService";

export const whatsappAlertsRouter = router({
  /**
   * Busca histórico de alertas enviados via WhatsApp.
   */
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      return getWhatsAppHistory(input?.limit ?? 50);
    }),

  /**
   * Busca a configuração atual do WhatsApp.
   */
  getConfig: protectedProcedure.query(async () => {
    return getWhatsAppConfig();
  }),

  /**
   * Atualiza a configuração do WhatsApp.
   */
  updateConfig: protectedProcedure
    .input(
      z.object({
        phoneNumber: z.string().optional(),
        enabled: z.boolean().optional(),
        provider: z.enum(["evolution_api", "twilio"]).optional(),
        apiUrl: z.string().optional(),
        instanceName: z.string().optional(),
        apiKey: z.string().optional(),
        twilioAccountSid: z.string().optional(),
        twilioAuthToken: z.string().optional(),
        twilioWhatsappFrom: z.string().optional(),
        quietHoursStart: z.number().min(0).max(23).optional(),
        quietHoursEnd: z.number().min(0).max(23).optional(),
        maxPerHour: z.number().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const existing = await getWhatsAppConfig();
      if (existing) {
        await db
          .update(whatsappConfig)
          .set({
            ...(input.phoneNumber !== undefined && { phoneNumber: input.phoneNumber }),
            ...(input.enabled !== undefined && { enabled: input.enabled }),
            ...(input.provider !== undefined && { provider: input.provider }),
            ...(input.apiUrl !== undefined && { apiUrl: input.apiUrl }),
            ...(input.instanceName !== undefined && { instanceName: input.instanceName }),
            ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
            ...(input.twilioAccountSid !== undefined && { twilioAccountSid: input.twilioAccountSid }),
            ...(input.twilioAuthToken !== undefined && { twilioAuthToken: input.twilioAuthToken }),
            ...(input.twilioWhatsappFrom !== undefined && { twilioWhatsappFrom: input.twilioWhatsappFrom }),
            ...(input.quietHoursStart !== undefined && { quietHoursStart: input.quietHoursStart }),
            ...(input.quietHoursEnd !== undefined && { quietHoursEnd: input.quietHoursEnd }),
            ...(input.maxPerHour !== undefined && { maxPerHour: input.maxPerHour }),
          });
      } else {
        await db.insert(whatsappConfig).values({
          phoneNumber: input.phoneNumber ?? null,
          enabled: input.enabled ?? false,
          provider: input.provider ?? "evolution_api",
          apiUrl: input.apiUrl ?? null,
          instanceName: input.instanceName ?? null,
          apiKey: input.apiKey ?? null,
          twilioAccountSid: input.twilioAccountSid ?? null,
          twilioAuthToken: input.twilioAuthToken ?? null,
          twilioWhatsappFrom: input.twilioWhatsappFrom ?? null,
          quietHoursStart: input.quietHoursStart ?? 22,
          quietHoursEnd: input.quietHoursEnd ?? 7,
          maxPerHour: input.maxPerHour ?? 10,
        });
      }
      return { success: true };
    }),

  /**
   * Envia uma mensagem de teste para o número configurado.
   */
  testSend: protectedProcedure.mutation(async () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    const result = await sendWhatsAppAlert({
      type: "test",
      message: `✅ Teste Zênite Tech\nSistema de alertas WhatsApp funcionando.\nHorário: ${timeStr}\nVer dashboard: https://social-ads.zenitetech.com`,
    });
    return result;
  }),

  /**
   * Estatísticas rápidas de alertas.
   */
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, sent: 0, failed: 0, rateLimited: 0, quietHours: 0, last: null };
    const all = await db
      .select()
      .from(whatsappAlerts)
      .orderBy(desc(whatsappAlerts.createdAt))
      .limit(200);

    const total = all.length;
    const sent = all.filter((a: (typeof all)[0]) => a.status === "sent").length;
    const failed = all.filter((a: (typeof all)[0]) => a.status === "failed").length;
    const rateLimited = all.filter((a: (typeof all)[0]) => a.status === "rate_limited").length;
    const quietHours = all.filter((a: (typeof all)[0]) => a.status === "quiet_hours").length;
    const last = all[0] ?? null;

    return { total, sent, failed, rateLimited, quietHours, last };
  }),
});
