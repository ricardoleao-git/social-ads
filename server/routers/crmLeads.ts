import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { crmLeads, crmActivities } from "../../drizzle/schema";
import { eq, desc, and, like, or, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const stageEnum = z.enum(["new", "qualified", "proposal", "closed_won", "closed_lost"]);
const sourceEnum = z.enum(["google_ads", "meta_ads", "organic", "whatsapp", "referral", "other"]);
const priorityEnum = z.enum(["low", "medium", "high"]);

export const crmLeadsRouter = router({
  // ── List leads with optional filters ──────────────────────────────────────
  list: publicProcedure
    .input(z.object({
      stage: stageEnum.optional(),
      source: sourceEnum.optional(),
      priority: priorityEnum.optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const conditions: any[] = [];

      if (input?.stage) conditions.push(eq(crmLeads.stage, input.stage));
      if (input?.source) conditions.push(eq(crmLeads.source, input.source));
      if (input?.priority) conditions.push(eq(crmLeads.priority, input.priority));
      if (input?.search) {
        conditions.push(
          or(
            like(crmLeads.name, `%${input.search}%`),
            like(crmLeads.email, `%${input.search}%`),
            like(crmLeads.company, `%${input.search}%`),
            like(crmLeads.phone, `%${input.search}%`)
          )
        );
      }

      const leads = await db
        .select()
        .from(crmLeads)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(crmLeads.createdAt));

      return leads;
    }),

  // ── Get single lead with activities ───────────────────────────────────────
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, input.id));
      if (!lead) throw new Error("Lead não encontrado");

      const activities = await db
        .select()
        .from(crmActivities)
        .where(eq(crmActivities.leadId, input.id))
        .orderBy(desc(crmActivities.createdAt));

      return { lead, activities };
    }),

  // ── Create lead ───────────────────────────────────────────────────────────
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      source: sourceEnum.default("other"),
      sourceCampaign: z.string().optional(),
      estimatedValue: z.number().optional(),
      product: z.string().optional(),
      notes: z.string().optional(),
      priority: priorityEnum.default("medium"),
      assignedTo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const [result] = await db.insert(crmLeads).values({
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        source: input.source,
        sourceCampaign: input.sourceCampaign,
        stage: "new",
        estimatedValue: input.estimatedValue,
        product: input.product,
        notes: input.notes,
        priority: input.priority,
        assignedTo: input.assignedTo,
      });

      const newId = (result as any).insertId;

      // Log activity
      await db.insert(crmActivities).values({
        leadId: newId,
        type: "note",
        description: `Lead criado via dashboard. Origem: ${input.source}${input.sourceCampaign ? ` (${input.sourceCampaign})` : ""}.`,
        author: "Sistema",
      });

      return { id: newId, success: true };
    }),

  // ── Update lead ───────────────────────────────────────────────────────────
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      source: sourceEnum.optional(),
      sourceCampaign: z.string().optional(),
      estimatedValue: z.number().optional(),
      product: z.string().optional(),
      notes: z.string().optional(),
      priority: priorityEnum.optional(),
      assignedTo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { id, ...data } = input;
      await db.update(crmLeads).set(data).where(eq(crmLeads.id, id));
      return { success: true };
    }),

  // ── Move lead through funnel ───────────────────────────────────────────────
  moveStage: publicProcedure
    .input(z.object({
      id: z.number(),
      stage: stageEnum,
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');

      // Get current stage
      const [lead] = await db.select({ stage: crmLeads.stage }).from(crmLeads).where(eq(crmLeads.id, input.id));
      if (!lead) throw new Error("Lead não encontrado");

      const fromStage = lead.stage;

      await db.update(crmLeads)
        .set({ stage: input.stage })
        .where(eq(crmLeads.id, input.id));

      const stageLabels: Record<string, string> = {
        new: "Novo",
        qualified: "Qualificado",
        proposal: "Proposta",
        closed_won: "Fechado (Ganho)",
        closed_lost: "Fechado (Perdido)",
      };

      await db.insert(crmActivities).values({
        leadId: input.id,
        type: "stage_change",
        description: input.note || `Movido de "${stageLabels[fromStage] || fromStage}" para "${stageLabels[input.stage] || input.stage}".`,
        fromStage,
        toStage: input.stage,
        author: "Usuário",
      });

      return { success: true };
    }),

  // ── Delete lead ───────────────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      await db.delete(crmActivities).where(eq(crmActivities.leadId, input.id));
      await db.delete(crmLeads).where(eq(crmLeads.id, input.id));
      return { success: true };
    }),

  // ── Add activity to lead ──────────────────────────────────────────────────
  addActivity: publicProcedure
    .input(z.object({
      leadId: z.number(),
      type: z.enum(["note", "call", "email", "meeting", "whatsapp"]),
      description: z.string().min(1),
      author: z.string().default("Usuário"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      await db.insert(crmActivities).values({
        leadId: input.leadId,
        type: input.type,
        description: input.description,
        author: input.author,
      });

      // Update last contact
      await db.update(crmLeads)
        .set({ lastContactAt: new Date() })
        .where(eq(crmLeads.id, input.leadId));

      return { success: true };
    }),

  // ── AI qualification ──────────────────────────────────────────────────────
  qualifyWithAI: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, input.id));
      if (!lead) throw new Error("Lead não encontrado");

      const activities = await db
        .select()
        .from(crmActivities)
        .where(eq(crmActivities.leadId, input.id))
        .orderBy(desc(crmActivities.createdAt))
        .limit(10);

      const prompt = `Você é um especialista em vendas B2B de tecnologia. Analise este lead e retorne um JSON com score e próxima ação.

Lead:
- Nome: ${lead.name}
- Empresa: ${lead.company || "não informado"}
- Produto de interesse: ${lead.product || "não informado"}
- Origem: ${lead.source} ${lead.sourceCampaign ? `(${lead.sourceCampaign})` : ""}
- Estágio atual: ${lead.stage}
- Valor estimado: ${lead.estimatedValue ? `R$ ${lead.estimatedValue}` : "não informado"}
- Notas: ${lead.notes || "nenhuma"}
- Histórico de atividades (últimas ${activities.length}): ${activities.map(a => `[${a.type}] ${a.description}`).join(" | ")}

Retorne APENAS JSON válido no formato:
{
  "score": <número de 0 a 100>,
  "reasoning": "<explicação em 1-2 frases>",
  "nextAction": "<próxima ação recomendada em 1 frase>",
  "priority": "<low|medium|high>"
}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um especialista em vendas B2B. Responda apenas com JSON válido." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "lead_qualification",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  score: { type: "integer" },
                  reasoning: { type: "string" },
                  nextAction: { type: "string" },
                  priority: { type: "string" },
                },
                required: ["score", "reasoning", "nextAction", "priority"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0].message.content;
        const result = typeof content === "string" ? JSON.parse(content) : content;

        await db.update(crmLeads).set({
          aiScore: result.score,
          aiNextAction: result.nextAction,
          priority: result.priority as any,
        }).where(eq(crmLeads.id, input.id));

        await db.insert(crmActivities).values({
          leadId: input.id,
          type: "ai_analysis",
          description: `IA analisou o lead. Score: ${result.score}/100. ${result.reasoning} Próxima ação: ${result.nextAction}`,
          author: "IA",
        });

        return { success: true, score: result.score, nextAction: result.nextAction, reasoning: result.reasoning };
      } catch (e) {
        throw new Error("Erro ao qualificar com IA: " + String(e));
      }
    }),

  // ── Stats for dashboard ───────────────────────────────────────────────────
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database unavailable');

    const [counts] = await db.select({
      total: sql<number>`COUNT(*)`,
      new_count: sql<number>`SUM(CASE WHEN stage_crm = 'new' THEN 1 ELSE 0 END)`,
      qualified_count: sql<number>`SUM(CASE WHEN stage_crm = 'qualified' THEN 1 ELSE 0 END)`,
      proposal_count: sql<number>`SUM(CASE WHEN stage_crm = 'proposal' THEN 1 ELSE 0 END)`,
      won_count: sql<number>`SUM(CASE WHEN stage_crm = 'closed_won' THEN 1 ELSE 0 END)`,
      lost_count: sql<number>`SUM(CASE WHEN stage_crm = 'closed_lost' THEN 1 ELSE 0 END)`,
      total_value: sql<number>`SUM(CASE WHEN stage_crm = 'closed_won' THEN estimated_value ELSE 0 END)`,
      pipeline_value: sql<number>`SUM(CASE WHEN stage_crm NOT IN ('closed_won', 'closed_lost') THEN estimated_value ELSE 0 END)`,
    }).from(crmLeads);

    const bySource = await db.select({
      source: crmLeads.source,
      count: sql<number>`COUNT(*)`,
    }).from(crmLeads).groupBy(crmLeads.source);

    return {
      total: Number(counts?.total || 0),
      byStage: {
        new: Number(counts?.new_count || 0),
        qualified: Number(counts?.qualified_count || 0),
        proposal: Number(counts?.proposal_count || 0),
        closed_won: Number(counts?.won_count || 0),
        closed_lost: Number(counts?.lost_count || 0),
      },
      totalValue: Number(counts?.total_value || 0),
      pipelineValue: Number(counts?.pipeline_value || 0),
      bySource: bySource.map(s => ({ source: s.source, count: Number(s.count) })),
    };
  }),
});
