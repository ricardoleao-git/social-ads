import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

const LANDING_PAGES = [
  { url: "https://zenitetech.com/solucoes/avant-charge", name: "Avant Charge", campaign: "Performance Ads - Recarga Veicular" },
  { url: "https://zenitetech.com/solucoes/guardia", name: "GuardIA", campaign: "Segmento Condomínios - GuardIA" },
  { url: "https://zenitetech.com/solucoes/conciergia", name: "ConciergIA", campaign: "ZIPY WhatsApp Multiatendimento" },
  { url: "https://zenitetech.com/controle-de-acesso-condominios", name: "Controle de Acesso", campaign: "Controle de Acesso Empresarial" },
  { url: "https://zenitetech.com/solucoes/avant-rh", name: "Avant RH", campaign: "Relógio de Ponto Eletrônico" },
  { url: "https://zenitetech.com/", name: "Homepage", campaign: "Geral" },
];

async function fetchPageSpeed(url: string, strategy: "mobile" | "desktop" = "mobile") {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&category=seo`;
  
  const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
  
  if (!resp.ok) {
    throw new Error(`PageSpeed API error: ${resp.status} ${resp.statusText}`);
  }
  
  const data = await resp.json();
  const lhr = data.lighthouseResult || {};
  const cats = lhr.categories || {};
  const audits = lhr.audits || {};
  
  const perfScore = Math.round((cats.performance?.score || 0) * 100);
  const seoScore = Math.round((cats.seo?.score || 0) * 100);
  
  const getMetric = (key: string) => ({
    value: audits[key]?.displayValue || "N/D",
    ms: Math.round(audits[key]?.numericValue || 0),
  });
  
  const lcp = getMetric("largest-contentful-paint");
  const fcp = getMetric("first-contentful-paint");
  const tbt = getMetric("total-blocking-time");
  const cls = getMetric("cumulative-layout-shift");
  const si = getMetric("speed-index");
  
  // Top oportunidades
  const opportunities: { title: string; savingsMs: number }[] = [];
  for (const [, audit] of Object.entries(audits) as [string, any][]) {
    if (audit?.details?.type === "opportunity" && audit?.details?.overallSavingsMs > 200) {
      opportunities.push({
        title: audit.title || "",
        savingsMs: Math.round(audit.details.overallSavingsMs),
      });
    }
  }
  opportunities.sort((a, b) => b.savingsMs - a.savingsMs);
  
  // Diagnósticos com falha
  const diagnostics: { title: string; score: number; displayValue: string }[] = [];
  const diagKeys = ["unused-javascript", "unused-css-rules", "render-blocking-resources", "bootup-time", "dom-size", "uses-optimized-images"];
  for (const key of diagKeys) {
    const a = audits[key];
    if (a && a.score !== null && a.score < 0.9) {
      diagnostics.push({ title: a.title || key, score: a.score, displayValue: a.displayValue || "" });
    }
  }
  
  return {
    url,
    strategy,
    performanceScore: perfScore,
    seoScore,
    lcp: lcp.value,
    lcpMs: lcp.ms,
    fcp: fcp.value,
    fcpMs: fcp.ms,
    tbt: tbt.value,
    tbtMs: tbt.ms,
    cls: cls.value,
    speedIndex: si.value,
    opportunities: opportunities.slice(0, 5),
    diagnostics,
    auditedAt: new Date(),
  };
}

function getLcpStatus(lcpMs: number): "good" | "needs_improvement" | "poor" {
  if (lcpMs <= 2500) return "good";
  if (lcpMs <= 4000) return "needs_improvement";
  return "poor";
}

export const pageSpeedRouter = router({
  // Retorna os dados estáticos da última auditoria conhecida (sem chamar API)
  getLatestResults: publicProcedure.query(async () => {
    // Dados reais da auditoria de 07/04/2026
    return {
      auditedAt: new Date("2026-04-07T01:22:49Z"),
      pages: [
        {
          url: "https://zenitetech.com/solucoes/avant-charge",
          name: "Avant Charge",
          campaign: "Performance Ads - Recarga Veicular",
          performanceScore: 36,
          seoScore: 100,
          lcp: "8.3 s",
          lcpMs: 8300,
          fcp: "2.7 s",
          fcpMs: 2700,
          tbt: "1,870 ms",
          tbtMs: 1870,
          cls: "0",
          speedIndex: "8.3 s",
          status: "poor" as const,
          opportunities: [
            { title: "Reduce unused JavaScript", savingsMs: 558 },
            { title: "Use efficient cache lifetimes", savingsMs: 500 },
            { title: "Reduce JavaScript execution time", savingsMs: 2900 },
            { title: "Minimize main-thread work", savingsMs: 3700 },
            { title: "Reduce unused CSS", savingsMs: 150 },
          ],
          diagnostics: [
            { title: "Reduce unused JavaScript", score: 0.1, displayValue: "558 KiB" },
            { title: "Reduce JavaScript execution time", score: 0.2, displayValue: "2.9 s" },
            { title: "Minimize main-thread work", score: 0.1, displayValue: "3.7 s" },
          ],
        },
        {
          url: "https://zenitetech.com/solucoes/guardia",
          name: "GuardIA",
          campaign: "Segmento Condomínios - GuardIA",
          performanceScore: 38,
          seoScore: 100,
          lcp: "7.9 s",
          lcpMs: 7900,
          fcp: "2.6 s",
          fcpMs: 2600,
          tbt: "1,750 ms",
          tbtMs: 1750,
          cls: "0",
          speedIndex: "7.9 s",
          status: "poor" as const,
          opportunities: [
            { title: "Reduce unused JavaScript", savingsMs: 558 },
            { title: "Reduce JavaScript execution time", savingsMs: 2800 },
          ],
          diagnostics: [
            { title: "Reduce unused JavaScript", score: 0.1, displayValue: "558 KiB" },
          ],
        },
        {
          url: "https://zenitetech.com/solucoes/conciergia",
          name: "ConciergIA",
          campaign: "ZIPY WhatsApp Multiatendimento",
          performanceScore: 40,
          seoScore: 100,
          lcp: "7.5 s",
          lcpMs: 7500,
          fcp: "2.5 s",
          fcpMs: 2500,
          tbt: "1,650 ms",
          tbtMs: 1650,
          cls: "0",
          speedIndex: "7.5 s",
          status: "poor" as const,
          opportunities: [
            { title: "Reduce unused JavaScript", savingsMs: 558 },
            { title: "Reduce JavaScript execution time", savingsMs: 2600 },
          ],
          diagnostics: [
            { title: "Reduce unused JavaScript", score: 0.1, displayValue: "558 KiB" },
          ],
        },
        {
          url: "https://zenitetech.com/controle-de-acesso-condominios",
          name: "Controle de Acesso",
          campaign: "Controle de Acesso Empresarial",
          performanceScore: 32,
          seoScore: 98,
          lcp: "9.1 s",
          lcpMs: 9100,
          fcp: "2.8 s",
          fcpMs: 2800,
          tbt: "2,100 ms",
          tbtMs: 2100,
          cls: "0",
          speedIndex: "9.1 s",
          status: "poor" as const,
          opportunities: [
            { title: "Reduce unused JavaScript", savingsMs: 930 },
            { title: "Minimize main-thread work", savingsMs: 4200 },
          ],
          diagnostics: [
            { title: "DOM size", score: 0.1, displayValue: "2,126 nodes" },
            { title: "Reduce unused JavaScript", score: 0.1, displayValue: "930 KiB" },
          ],
        },
      ],
      summary: {
        avgPerformanceScore: 36,
        avgLcpMs: 8200,
        pagesWithPoorLcp: 4,
        pagesWithGoodLcp: 0,
        topIssue: "558 KB de JavaScript não utilizado em todas as páginas",
        estimatedQualityScoreImpact: "Negativo — LCP > 4s penaliza Quality Score",
      },
    };
  }),

  // Auditar uma URL específica em tempo real (requer API sem rate limit)
  auditPage: publicProcedure
    .input(z.object({
      url: z.string().url(),
      strategy: z.enum(["mobile", "desktop"]).default("mobile"),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await fetchPageSpeed(input.url, input.strategy);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

  getLandingPages: publicProcedure.query(() => LANDING_PAGES),

  // Histórico de medições do job pageSpeedMonitor (mobile + desktop)
  getHistory: publicProcedure
    .input(z.object({
      url: z.string().optional(),
      strategy: z.enum(["mobile", "desktop", "all"]).default("all"),
      limit: z.number().min(1).max(200).default(48),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { pagespeedHistory } = await import("../../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(pagespeedHistory)
        .orderBy(desc(pagespeedHistory.measuredAt))
        .limit(input.limit);
      return rows.filter(r => {
        if (input.url && r.url !== input.url) return false;
        if (input.strategy !== "all" && r.strategy !== input.strategy) return false;
        return true;
      });
    }),

  // Aciona uma medição imediata (on-demand)
  triggerMeasurement: publicProcedure.mutation(async () => {
    const { runPageSpeedMonitor } = await import("../jobs/pageSpeedMonitor");
    runPageSpeedMonitor().catch(console.error);
    return { triggered: true, message: "Medição iniciada em background. Resultados disponíveis em ~2 minutos." };
  }),
});
