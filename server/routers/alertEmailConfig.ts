import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { alertEmailConfig, activityLogs } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

async function logEmailConfigChange(db: any, opts: {
  userId?: number;
  userEmail?: string;
  oldEmails: string;
  newEmails: string;
}) {
  try {
    await db.insert(activityLogs).values({
      userId: opts.userId ?? null,
      userEmail: opts.userEmail ?? null,
      action: "update_alert_emails",
      description: `E-mails de alerta atualizados`,
      targetEmail: opts.newEmails,
      statusCode: 200,
      metadata: JSON.stringify({ before: opts.oldEmails, after: opts.newEmails }),
    });
  } catch (e) {
    console.error("[alertEmailLog] Failed to write log:", e);
  }
}

/**
 * Router para gerenciar os destinatários de e-mail de alertas automáticos.
 * Apenas administradores podem alterar; qualquer usuário autenticado pode ler.
 */
export const alertEmailConfigRouter = router({
  /** Retorna a configuração atual de e-mails de alerta */
  get: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { id: 1, emails: "atendimento@zenite.tech,rjll70@gmail.com", label: "Destinatários de Alertas" };
    const rows = await db.select().from(alertEmailConfig).limit(1);
    if (rows.length === 0) {
      // Cria registro padrão se não existir
      await db.insert(alertEmailConfig).values({
        id: 1,
        emails: "atendimento@zenite.tech,rjll70@gmail.com",
        label: "Destinatários de Alertas",
        updatedBy: "system",
      });
      return { id: 1, emails: "atendimento@zenite.tech,rjll70@gmail.com", label: "Destinatários de Alertas" };
    }
    return rows[0];
  }),

  /** Atualiza a lista de e-mails de alerta (apenas admin) */
  update: protectedProcedure
    .input(
      z.object({
        emails: z.string().min(1, "Informe ao menos um e-mail"),
        label: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false, emails: input.emails };
      // Normaliza: substitui ; por , e remove espaços extras
      const normalized = input.emails
        .replace(/;/g, ",")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
        .join(",");

      const rows = await db.select().from(alertEmailConfig).limit(1);
      if (rows.length === 0) {
        await db.insert(alertEmailConfig).values({
          id: 1,
          emails: normalized,
          label: input.label ?? "Destinatários de Alertas",
          updatedBy: (ctx.user as any)?.name ?? "admin",
        });
      } else {
        await db
          .update(alertEmailConfig)
          .set({
            emails: normalized,
            label: input.label ?? rows[0].label ?? "Destinatários de Alertas",
            updatedBy: (ctx.user as any)?.name ?? "admin",
          })
          .where(eq(alertEmailConfig.id, rows[0].id));
      }
      // Registrar auditoria
      await logEmailConfigChange(db, {
        userId: (ctx.user as any)?.id,
        userEmail: (ctx.user as any)?.email,
        oldEmails: rows.length > 0 ? (rows[0].emails ?? "") : "",
        newEmails: normalized,
      });

      return { success: true, emails: normalized };
    }),

  /** Retorna o histórico de alterações dos e-mails de alerta */
  history: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.action, "update_alert_emails"))
      .orderBy(desc(activityLogs.createdAt))
      .limit(50);
    return rows.map((r: any) => ({
      id: r.id,
      userEmail: r.userEmail ?? "sistema",
      newEmails: r.targetEmail ?? "",
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      createdAt: r.createdAt,
    }));
  }),
});
