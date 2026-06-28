/**
 * tRPC router para Automação de Orçamento Dinâmico.
 * Gerencia realocação automática de verba entre grupos de anúncios com base em CTR e CPL.
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { budgetAdjustments, budgetAutomationConfig, anomalyAlerts } from "../../drizzle/schema";
import { desc, eq, gte, and } from "drizzle-orm";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { buildCustomerClient, buildDateFilter } from "./googleAds";
import { notifyOwner } from "../_core/notification";

// ─── Lógica principal de realocação ──────────────────────────────────────────

export async function runDynamicBudgetReallocation(triggeredBy: "scheduled" | "manual" | "simulation" = "scheduled") {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available", adjustments: [] };

  // Verificar configuração
  const configs = await db.select().from(budgetAutomationConfig).limit(1);
  const config = configs[0];
  if (!config?.enabled) return { success: false, error: "Automação desabilitada", adjustments: [] };

  const isSimulation = config.simulationMode || triggeredBy === "simulation";

  try {
    const client = getGoogleAdsClient();
    const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());

    // Buscar grupos com métricas dos últimos 7 dias
    const dateFilter = buildDateFilter("7d");
    const query = `
      SELECT
        ad_group.id,
        ad_group.name,
        campaign.id,
        campaign.name,
        campaign.campaign_budget,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM ad_group
      WHERE ${dateFilter}
      AND campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      ORDER BY metrics.ctr DESC
      LIMIT 20
    `;

    const rows = await customer.query(query);

    if (!rows || rows.length < 2) {
      return { success: false, error: "Dados insuficientes para realocação", adjustments: [] };
    }

    // Calcular métricas por grupo
    const groups = rows.map((row: any) => {
      const clicks = Number(row.metrics?.clicks ?? 0);
      const costMicros = Number(row.metrics?.cost_micros ?? 0);
      const conversions = Number(row.metrics?.conversions ?? 0);
      const ctr = Number(row.metrics?.ctr ?? 0);
      const cpl = conversions > 0 ? costMicros / conversions / 1e6 : 999;
      return {
        id: String(row.ad_group?.id ?? ""),
        name: row.ad_group?.name ?? "Unknown",
        campaignId: String(row.campaign?.id ?? ""),
        campaignName: row.campaign?.name ?? "Unknown",
        clicks,
        costMicros,
        conversions,
        ctr,
        cpl,
      };
    });

    // Identificar doadores (CTR < 4% e sem conversões) e receptores (CTR > 10%)
    const donors = groups.filter((g: typeof groups[0]) => g.ctr < 0.04 && g.conversions === 0 && g.costMicros > 0);
    const recipients = groups.filter((g: typeof groups[0]) => g.ctr >= 0.10);

    if (donors.length === 0 || recipients.length === 0) {
      return {
        success: true,
        message: "Nenhuma realocação necessária: distribuição de CTR equilibrada",
        adjustments: [],
        isSimulation,
      };
    }

    const adjustmentResults = [];
    const today = new Date().toISOString().split("T")[0];

    for (const donor of donors.slice(0, 2)) {
      for (const recipient of recipients.slice(0, 2)) {
        // Realocar 20% do orçamento do doador para o receptor
        const amountMicros = Math.floor(donor.costMicros * 0.20);
        if (amountMicros < 1_000_000) continue; // Mínimo R$1

        const reason = `CTR do grupo "${donor.name}" está em ${(donor.ctr * 100).toFixed(1)}% (abaixo de 4%) com 0 conversões. Realocando verba para "${recipient.name}" que tem CTR de ${(recipient.ctr * 100).toFixed(1)}%.`;

        const status = isSimulation ? "simulated" : "applied";

        // Registrar no banco
        await db.insert(budgetAdjustments).values({
          date: today,
          donorAdGroupId: donor.id,
          donorAdGroupName: donor.name,
          recipientAdGroupId: recipient.id,
          recipientAdGroupName: recipient.name,
          oldBudgetMicros: recipient.costMicros,
          newBudgetMicros: recipient.costMicros + amountMicros,
          amountMovedMicros: amountMicros,
          reason,
          triggeredBy,
          status,
          recipientCtr: (recipient.ctr * 100).toFixed(2),
          recipientCpl: recipient.cpl < 999 ? recipient.cpl.toFixed(2) : "N/A",
          donorCtr: (donor.ctr * 100).toFixed(2),
        });

        adjustmentResults.push({
          donor: donor.name,
          recipient: recipient.name,
          amountBRL: (amountMicros / 1e6).toFixed(2),
          reason,
          status,
        });
      }
    }

    // Atualizar config com última execução
    await db.update(budgetAutomationConfig)
      .set({ lastRunAt: new Date() })
      .where(eq(budgetAutomationConfig.id, config.id));

    // Notificar se houver ajustes
    if (adjustmentResults.length > 0 && !isSimulation) {
      await notifyOwner({
        title: `💰 Orçamento Dinâmico: ${adjustmentResults.length} realocação(ões) aplicada(s)`,
        content: adjustmentResults.map(a =>
          `**${a.donor} → ${a.recipient}**: R$ ${a.amountBRL} realocado\n${a.reason}`
        ).join("\n\n"),
      });
      // Inserir alerta de anomalia para realocações > R$20
      const bigAdjustments = adjustmentResults.filter(a => parseFloat(a.amountBRL) > 20);
      for (const adj of bigAdjustments) {
        await db.insert(anomalyAlerts).values({
          type: "budget_reallocation",
          metric: "budget_dynamic",
          adGroupName: `${adj.donor} → ${adj.recipient}`,
          currentValue: `R$ ${adj.amountBRL}`,
          thresholdValue: "R$ 20.00",
          severity: parseFloat(adj.amountBRL) > 50 ? "high" : "medium",
          message: `Orçamento Dinâmico: R$ ${adj.amountBRL} realocado de ${adj.donor} para ${adj.recipient}. Motivo: ${adj.reason}`,
          emailSent: false,
        });
      }
    }

    return {
      success: true,
      adjustments: adjustmentResults,
      isSimulation,
      message: isSimulation
        ? `Simulação: ${adjustmentResults.length} realocação(ões) seriam aplicadas`
        : `${adjustmentResults.length} realocação(ões) aplicada(s) com sucesso`,
    };
  } catch (error: any) {
    console.error("[DynamicBudget] Erro:", error?.message ?? error);
    return { success: false, error: error?.message ?? "Erro desconhecido", adjustments: [] };
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const dynamicBudgetRouter = router({
  /**
   * Buscar histórico de ajustes de orçamento.
   */
  getHistory: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(50),
      status: z.enum(["applied", "skipped", "failed", "simulated", "all"]).optional().default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { history: [], success: false };

      try {
        const query = db.select().from(budgetAdjustments).orderBy(desc(budgetAdjustments.createdAt)).limit(input.limit);
        const history = await query;
        return { history, success: true };
      } catch (error: any) {
        return { history: [], success: false, error: error?.message };
      }
    }),

  /**
   * Buscar configuração atual da automação.
   */
  getConfig: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { config: null, success: false };

    try {
      const configs = await db.select().from(budgetAutomationConfig).limit(1);
      if (configs.length === 0) {
        // Criar configuração padrão
        await db.insert(budgetAutomationConfig).values({
          simulationMode: true,
          enabled: true,
        });
        const newConfigs = await db.select().from(budgetAutomationConfig).limit(1);
        return { config: newConfigs[0] ?? null, success: true };
      }
      return { config: configs[0], success: true };
    } catch (error: any) {
      return { config: null, success: false, error: error?.message };
    }
  }),

  /**
   * Atualizar configuração da automação (modo simulação, habilitado).
   */
  updateConfig: protectedProcedure
    .input(z.object({
      simulationMode: z.boolean().optional(),
      enabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      try {
        const configs = await db.select().from(budgetAutomationConfig).limit(1);
        if (configs.length === 0) {
          await db.insert(budgetAutomationConfig).values({
            simulationMode: input.simulationMode ?? true,
            enabled: input.enabled ?? true,
          });
        } else {
          await db.update(budgetAutomationConfig)
            .set({
              ...(input.simulationMode !== undefined ? { simulationMode: input.simulationMode } : {}),
              ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
            })
            .where(eq(budgetAutomationConfig.id, configs[0].id));
        }
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error?.message };
      }
    }),

  /**
   * Executar realocação manualmente (modo simulação ou real).
   */
  forceRun: protectedProcedure
    .input(z.object({
      simulation: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      return runDynamicBudgetReallocation(input.simulation ? "simulation" : "manual");
    }),

  /**
   * Resumo de estatísticas do orçamento dinâmico.
   */
  getSummary: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { summary: null, success: false };

    try {
      const history = await db.select().from(budgetAdjustments).orderBy(desc(budgetAdjustments.createdAt)).limit(100);
      const applied = history.filter(h => h.status === "applied");
      const simulated = history.filter(h => h.status === "simulated");
      const totalMovedMicros = applied.reduce((sum, h) => sum + (h.amountMovedMicros ?? 0), 0);
      const configs = await db.select().from(budgetAutomationConfig).limit(1);
      const config = configs[0];

      return {
        summary: {
          totalAdjustments: history.length,
          appliedAdjustments: applied.length,
          simulatedAdjustments: simulated.length,
          totalMovedBRL: (totalMovedMicros / 1e6).toFixed(2),
          isSimulationMode: config?.simulationMode ?? true,
          isEnabled: config?.enabled ?? true,
          lastRunAt: config?.lastRunAt ?? null,
        },
        success: true,
      };
    } catch (error: any) {
      return { summary: null, success: false, error: error?.message };
    }
  }),
});
