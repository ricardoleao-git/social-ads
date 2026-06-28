import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { systemSettings, uptimeChecks } from "../../drizzle/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export const systemSettingsRouter = router({
  // Obter configuração por chave
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, input.key));
      return row ?? null;
    }),

  // Obter todas as configurações
  getAll: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(systemSettings);
  }),

  // Atualizar configuração
  set: protectedProcedure
    .input(z.object({
      key: z.string(),
      value: z.string(),
      updatedBy: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db.update(systemSettings)
        .set({
          value: input.value,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.key, input.key));

      return { success: true };
    }),

  // Status do modo manutenção
  getMaintenanceMode: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { enabled: false, message: "", endTime: "" };

    const rows = await db.select().from(systemSettings).where(
      sql`\`key\` IN ('maintenance_mode', 'maintenance_message', 'maintenance_end_time')`
    );

    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    return {
      enabled: map["maintenance_mode"] === "true",
      message: map["maintenance_message"] ?? "Sistema em manutenção. Voltamos em breve.",
      endTime: map["maintenance_end_time"] ?? "",
    };
  }),

  // Ativar/desativar modo manutenção
  setMaintenanceMode: protectedProcedure
    .input(z.object({
      enabled: z.boolean(),
      message: z.string().optional(),
      endTime: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const now = new Date();

      await db.update(systemSettings)
        .set({ value: input.enabled ? "true" : "false", updatedAt: now })
        .where(eq(systemSettings.key, "maintenance_mode"));

      if (input.message !== undefined) {
        await db.update(systemSettings)
          .set({ value: input.message, updatedAt: now })
          .where(eq(systemSettings.key, "maintenance_message"));
      }

      if (input.endTime !== undefined) {
        await db.update(systemSettings)
          .set({ value: input.endTime, updatedAt: now })
          .where(eq(systemSettings.key, "maintenance_end_time"));
      }

      return { success: true };
    }),

  // Registrar check de uptime
  recordUptimeCheck: protectedProcedure
    .input(z.object({
      service: z.string(),
      status: z.enum(["up", "down", "degraded"]),
      responseTimeMs: z.number().optional(),
      errorMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db.insert(uptimeChecks).values({
        service: input.service,
        status: input.status,
        responseTimeMs: input.responseTimeMs,
        errorMessage: input.errorMessage,
      });

      return { success: true };
    }),

  // Obter histórico de uptime por serviço (últimas 24h)
  getUptimeHistory: protectedProcedure
    .input(z.object({
      service: z.string().optional(),
      hours: z.number().default(24),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { checks: [], summary: {} };

      const since = new Date(Date.now() - input.hours * 3600 * 1000);
      let query = db.select().from(uptimeChecks).where(gte(uptimeChecks.checkedAt, since)).$dynamic();

      if (input.service) {
        query = query.where(and(
          gte(uptimeChecks.checkedAt, since),
          eq(uptimeChecks.service, input.service)
        )) as any;
      }

      const checks = await (query as any).orderBy(desc(uptimeChecks.checkedAt)).limit(200);

      // Calcular uptime % por serviço
      const summary: Record<string, { uptime: number; avgResponseMs: number; lastStatus: string; lastCheck: Date | null }> = {};
      for (const c of checks) {
        if (!summary[c.service]) {
          summary[c.service] = { uptime: 0, avgResponseMs: 0, lastStatus: c.status, lastCheck: c.checkedAt };
        }
      }

      // Calcular por serviço
      const services = Array.from(new Set(checks.map((c: any) => c.service as string)));
      for (const svc of services) {
        const svcChecks = checks.filter((c: any) => c.service === svc);
        const upChecks = svcChecks.filter((c: any) => c.status === "up").length;
        const avgMs = svcChecks.filter((c: any) => c.responseTimeMs).reduce((a: number, c: any) => a + c.responseTimeMs, 0) / (svcChecks.filter((c: any) => c.responseTimeMs).length || 1);
        summary[svc as string] = {
          uptime: svcChecks.length > 0 ? Math.round((upChecks / svcChecks.length) * 100) : 0,
          avgResponseMs: Math.round(avgMs),
          lastStatus: svcChecks[0]?.status ?? "unknown",
          lastCheck: svcChecks[0]?.checkedAt ?? null,
        };
      }

      return { checks: checks.slice(0, 50), summary };
    }),
});
