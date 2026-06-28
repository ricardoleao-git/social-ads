/**
 * Router: Gestão Semanal de Tráfego Pago
 * Endpoints para a página /gestao-semanal do dashboard.
 * Expõe dados de análise de landing pages, relatórios semanais e ações pendentes.
 */
import { z } from "zod";
import {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
} from "../../server/credentials";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { landingPageAnalyses, weeklyTrafficReviews } from "../../drizzle/schema";
import { desc, eq, like } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { runWeeklyLandingPageAnalysis } from "../jobs/weeklyLandingPageAnalysis";
import { runWeeklyUrlMonitor } from "../jobs/weeklyUrlMonitor";

export const gestaoSemanalRouter = router({
  // Buscar análises de LPs da semana atual ou de uma semana específica
  getLandingPageAnalyses: publicProcedure
    .input(z.object({ weekLabel: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { analyses: [], weekLabel: "" };

      // Determinar semana
      let weekLabel = input?.weekLabel;
      if (!weekLabel) {
        const now = new Date();
        const year = now.getFullYear();
        const start = new Date(year, 0, 1);
        const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
        weekLabel = `${year}-W${String(week).padStart(2, "0")}`;
      }

      const analyses = await db
        .select()
        .from(landingPageAnalyses)
        .where(eq(landingPageAnalyses.weekLabel, weekLabel))
        .orderBy(desc(landingPageAnalyses.diagnosisScore));

      // Se não há dados desta semana, buscar da semana mais recente disponível
      if (analyses.length === 0) {
        const latest = await db
          .select()
          .from(landingPageAnalyses)
          .orderBy(desc(landingPageAnalyses.analyzedAt))
          .limit(50);
        return { analyses: latest, weekLabel: latest[0]?.weekLabel || weekLabel };
      }

      return { analyses, weekLabel };
    }),

  // Buscar relatório semanal holístico
  getWeeklyReview: publicProcedure
    .input(z.object({ weekLabel: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      let weekLabel = input?.weekLabel;
      if (!weekLabel) {
        const now = new Date();
        const year = now.getFullYear();
        const start = new Date(year, 0, 1);
        const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
        weekLabel = `${year}-W${String(week).padStart(2, "0")}`;
      }

      const reviews = await db
        .select()
        .from(weeklyTrafficReviews)
        .where(eq(weeklyTrafficReviews.weekLabel, weekLabel))
        .orderBy(desc(weeklyTrafficReviews.generatedAt))
        .limit(1);

      if (reviews.length > 0) return reviews[0];

      // Buscar o mais recente disponível
      const latest = await db
        .select()
        .from(weeklyTrafficReviews)
        .orderBy(desc(weeklyTrafficReviews.generatedAt))
        .limit(1);

      return latest[0] || null;
    }),

  // Gerar relatório holístico via LLM com dados reais da Google Ads API
  generateWeeklyReview: publicProcedure
    .mutation(async () => {
      const env = process.env;
      const customerId = (env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
      if (!customerId || !env.GOOGLE_ADS_DEVELOPER_TOKEN) {
        return { success: false, error: "Credenciais Google Ads não configuradas" };
      }

      // Obter access token
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_ADS_CLIENT_ID,
          client_secret: GOOGLE_ADS_CLIENT_SECRET,
          refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
          grant_type: "refresh_token",
        }),
      });
      const tokenData = await tokenRes.json() as any;
      if (!tokenData.access_token) return { success: false, error: "Falha ao obter token" };

      const loginCustomerId = (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
        "Content-Type": "application/json",
      };
      if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      const fmt = (d: Date) => d.toISOString().split("T")[0];

      // Buscar métricas de todos os grupos
      const query = `
        SELECT
          ad_group.name,
          campaign.name,
          campaign.advertising_channel_type,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.clicks,
          metrics.impressions,
          metrics.cost_micros
        FROM ad_group
        WHERE segments.date BETWEEN '${fmt(startDate)}' AND '${fmt(endDate)}'
          AND campaign.status = 'ENABLED'
          AND ad_group.status = 'ENABLED'
        ORDER BY metrics.cost_micros DESC
      `;

      const adsRes = await fetch(
        `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`,
        { method: "POST", headers, body: JSON.stringify({ query }) }
      );

      const adsData = await adsRes.json() as any;
      const rows = adsData.results || [];

      // Agregar métricas
      let totalSpend = 0, totalClicks = 0, totalImpressions = 0, totalConversions = 0;
      const groups: any[] = [];

      for (const row of rows) {
        const spend = (row.metrics?.costMicros || 0) / 1_000_000;
        const clicks = row.metrics?.clicks || 0;
        const impressions = row.metrics?.impressions || 0;
        const conversions = Math.round(row.metrics?.conversions || 0);
        const ctr = (row.metrics?.ctr || 0) * 100;
        const cpc = (row.metrics?.averageCpc || 0) / 1_000_000;

        totalSpend += spend;
        totalClicks += clicks;
        totalImpressions += impressions;
        totalConversions += conversions;

        groups.push({
          name: row.adGroup?.name || "",
          campaign: row.campaign?.name || "",
          type: row.campaign?.advertisingChannelType || "",
          ctr: ctr.toFixed(2),
          cpc: cpc.toFixed(2),
          conversions,
          clicks,
          impressions,
          spend: spend.toFixed(2),
        });
      }

      const avgCtr = totalClicks > 0 ? ((totalClicks / (totalImpressions || 1)) * 100).toFixed(2) : "0";
      const avgCpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : "0";

      // Gerar análise holística via LLM
      const now = new Date();
      const year = now.getFullYear();
      const start = new Date(year, 0, 1);
      const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
      const weekLabel = `${year}-W${String(week).padStart(2, "0")}`;

      const llmPrompt = `Você é um gestor de tráfego pago B2B sênior da Zênite Tech, responsável por todas as campanhas Google Ads.

## Dados da Semana (${fmt(startDate)} a ${fmt(endDate)})
- Gasto total: R$ ${totalSpend.toFixed(2)}
- Cliques: ${totalClicks} | Impressões: ${totalImpressions}
- Conversões: ${totalConversions}
- CTR médio: ${avgCtr}% | CPC médio: R$ ${avgCpc}

## Performance por Grupo de Anúncios
${groups.map(g => `- ${g.name} (${g.campaign}): CTR ${g.ctr}% | CPC R$${g.cpc} | Conv: ${g.conversions} | Cliques: ${g.clicks} | Gasto: R$${g.spend}`).join("\n")}

## Sua Análise como Gestor (responda em JSON):
{
  "executive_summary": "[3-4 frases com visão executiva da semana: o que foi bem, o que precisa atenção, tendência geral]",
  "top_performers": [{"name": "...", "reason": "...", "action": "..."}],
  "underperformers": [{"name": "...", "problem": "...", "action": "..."}],
  "urgent_actions": ["ação urgente 1", "ação urgente 2"],
  "weekly_actions": ["ação da semana 1", "ação da semana 2", "ação da semana 3"],
  "pmax_diagnosis": "[análise específica da Performance Max se houver]"
}`;

      const llmRes = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um gestor de tráfego pago B2B especialista em Google Ads. Responda sempre em JSON válido." },
          { role: "user", content: llmPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "weekly_review",
            strict: true,
            schema: {
              type: "object",
              properties: {
                executive_summary: { type: "string" },
                top_performers: { type: "array", items: { type: "object", properties: { name: { type: "string" }, reason: { type: "string" }, action: { type: "string" } }, required: ["name", "reason", "action"], additionalProperties: false } },
                underperformers: { type: "array", items: { type: "object", properties: { name: { type: "string" }, problem: { type: "string" }, action: { type: "string" } }, required: ["name", "problem", "action"], additionalProperties: false } },
                urgent_actions: { type: "array", items: { type: "string" } },
                weekly_actions: { type: "array", items: { type: "string" } },
                pmax_diagnosis: { type: "string" },
              },
              required: ["executive_summary", "top_performers", "underperformers", "urgent_actions", "weekly_actions", "pmax_diagnosis"],
              additionalProperties: false,
            },
          },
        },
      });

      const llmContent = llmRes?.choices?.[0]?.message?.content;
      const analysis = typeof llmContent === "string" ? JSON.parse(llmContent) : (llmContent || {});

      // Salvar no banco
      const db = await getDb();
      if (db) {
        await db.insert(weeklyTrafficReviews).values({
          weekLabel,
          totalSpend: totalSpend.toFixed(2),
          totalClicks,
          totalImpressions,
          totalConversions,
          avgCtr,
          avgCpc,
          executiveSummary: analysis.executive_summary || "",
          topPerformers: analysis.top_performers || [],
          underperformers: analysis.underperformers || [],
          urgentActions: analysis.urgent_actions || [],
          weeklyActions: analysis.weekly_actions || [],
          pmaxDiagnosis: analysis.pmax_diagnosis || "",
          status: "ready",
        });
      }

      return {
        success: true,
        weekLabel,
        summary: analysis.executive_summary,
        urgentActions: analysis.urgent_actions || [],
        topPerformers: analysis.top_performers || [],
        underperformers: analysis.underperformers || [],
        weeklyActions: analysis.weekly_actions || [],
        metrics: { totalSpend: totalSpend.toFixed(2), totalClicks, totalConversions, avgCtr, avgCpc },
      };
    }),

  // Disparar análise de LPs manualmente
  triggerLandingPageAnalysis: publicProcedure
    .mutation(async () => {
      try {
        // Rodar em background
        runWeeklyLandingPageAnalysis().catch(e => console.error("[gestaoSemanal] LP analysis error:", e));
        return { success: true, message: "Análise de landing pages iniciada em background. Resultados disponíveis em ~5 minutos." };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }),

  // Disparar verificação de URLs manualmente
  triggerUrlMonitor: publicProcedure
    .mutation(async () => {
      try {
        runWeeklyUrlMonitor().catch(e => console.error("[gestaoSemanal] URL monitor error:", e));
        return { success: true, message: "Verificação de URLs iniciada em background. Resultados em ~2 minutos." };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }),
});
