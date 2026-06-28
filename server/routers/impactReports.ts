import { execSync } from "child_process";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { chartAnnotations, impactReports } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

export const impactReportsRouter = router({
  /**
   * List all impact reports ordered by date descending.
   * Returns summary data for the period filter and comparisons.
   */
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db
      .select({
        id: impactReports.id,
        data: impactReports.data,
        negativos: impactReports.negativos,
        urlsCorrigidas: impactReports.urlsCorrigidas,
        extensoes: impactReports.extensoes,
        economiaMin: impactReports.economiaMin,
        economiaMax: impactReports.economiaMax,
        ctrAtual: impactReports.ctrAtual,
        cpcAtual: impactReports.cpcAtual,
        createdAt: impactReports.createdAt,
      })
      .from(impactReports)
      .orderBy(desc(impactReports.createdAt));
  }),

  /**
   * Get a single report by its display date string (e.g., '04/04/2026').
   * Returns the full JSON payload for the detailed view.
   */
  getByDate: publicProcedure
    .input(z.object({ data: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const result = await db
        .select()
        .from(impactReports)
        .where(eq(impactReports.data, input.data))
        .limit(1);

      return result[0] ?? null;
    }),

  /**
   * Send the impact report summary by email via Gmail MCP.
   * Builds a plain-text summary and dispatches via gmail_send_messages.
   */
  sendReport: protectedProcedure
    .input(
      z.object({
        data: z.string(),
        negativos: z.number().int(),
        urlsCorrigidas: z.number().int(),
        extensoes: z.number().int(),
        economiaMin: z.number().int(),
        economiaMax: z.number().int(),
        ctrMin: z.number(),
        ctrMax: z.number(),
        cpcMin: z.number(),
        cpcMax: z.number(),
        kwsMarca: z.number().int(),
        postsGBP: z.number().int(),
        dashboardUrl: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      const subject = `Relatório de Impacto Google Ads — ${input.data} — Zênite Tech`;
      const content = [
        `Relatório de Impacto — Zênite Tech`,
        `Data: ${input.data}`,
        ``,
        `RESUMO EXECUTIVO`,
        `================`,
        `- ${input.negativos} negativos adicionados`,
        `- ${input.urlsCorrigidas} anúncios com URL corrigida`,
        `- ${input.extensoes} extensões de anúncio criadas`,
        `- Grupo Institucional ativado (${input.kwsMarca} keywords de marca)`,
        `- ${input.postsGBP} posts publicados no Google Business`,
        ``,
        `IMPACTO ESTIMADO`,
        `================`,
        `- Redução de CPC: -${input.cpcMin}% a -${input.cpcMax}%`,
        `- Aumento de CTR: +${input.ctrMin}% a +${input.ctrMax}%`,
        `- Economia mensal estimada: R$ ${input.economiaMin} a R$ ${input.economiaMax}`,
        ``,
        `Acesse o dashboard completo em:`,
        input.dashboardUrl,
      ].join("\n");

      try {
        const payload = JSON.stringify({
          messages: [{
            to: ["rjll70@gmail.com"],
            subject,
            content,
          }],
        });
        execSync(
          `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${payload.replace(/'/g, "'\"'\"'")}'`,
          { timeout: 30000 }
        );
        return { success: true };
      } catch (err: any) {
        // MCP may require interactive confirmation — treat as pending
        return { success: false, message: err?.message ?? "Confirmação interativa necessária" };
      }
    }),

  /**
   * Save a new optimization session report.
   * Protected — only authenticated users can create reports.
   */
  create: protectedProcedure
    .input(
      z.object({
        data: z.string(),
        negativos: z.number().int().min(0),
        urlsCorrigidas: z.number().int().min(0),
        extensoes: z.number().int().min(0),
        economiaMin: z.number().int().min(0),
        economiaMax: z.number().int().min(0),
        ctrAtual: z.number().min(0).max(100),
        cpcAtual: z.number().min(0),
        dadosJson: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.insert(impactReports).values({
        data: input.data,
        negativos: input.negativos,
        urlsCorrigidas: input.urlsCorrigidas,
        extensoes: input.extensoes,
        economiaMin: input.economiaMin,
        economiaMax: input.economiaMax,
        ctrAtual: String(input.ctrAtual),
        cpcAtual: String(input.cpcAtual),
        dadosJson: input.dadosJson ?? null,
      });

      return { success: true };
    }),
});

export const chartAnnotationsRouter = router({
  /**
   * List all annotations for a given report ID.
   */
  listByReport: publicProcedure
    .input(z.object({ reportId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(chartAnnotations)
        .where(eq(chartAnnotations.reportId, input.reportId))
        .orderBy(chartAnnotations.semana);
    }),

  /**
   * Add a new annotation to a CTR trend chart.
   * Protected — only authenticated users can add annotations.
   */
  create: protectedProcedure
    .input(
      z.object({
        reportId: z.number().int(),
        semana: z.string().max(20),
        label: z.string().max(100),
        cor: z.string().max(20).default("#f59e0b"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.insert(chartAnnotations).values({
        reportId: input.reportId,
        semana: input.semana,
        label: input.label,
        cor: input.cor,
      });

      return { success: true };
    }),
  /**
   * Update an existing annotation.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        semana: z.string().max(20),
        label: z.string().max(100),
        cor: z.string().max(20),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(chartAnnotations)
        .set({ semana: input.semana, label: input.label, cor: input.cor })
        .where(eq(chartAnnotations.id, input.id));

      return { success: true };
    }),

  /**
   * Delete an annotation by ID.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(chartAnnotations).where(eq(chartAnnotations.id, input.id));
      return { success: true };
    }),
});
