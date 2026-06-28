/**
 * Job: Monitor de PageSpeed (mobile + desktop)
 * Roda a cada 1h (0h, 1h, 2h, ..., 23h)
 *
 * Mede performance, acessibilidade, SEO e Core Web Vitals via PageSpeed Insights API.
 * Salva histórico na tabela pagespeed_history.
 * Gera alerta quando score de performance cair abaixo de 50.
 *
 * URLs monitoradas: zenitetech.com e zenite.tech
 */
import cron from "node-cron";
import { getDb } from "../db";
import { pagespeedHistory, alertHistory } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

const URLS_TO_MONITOR = [
  // Páginas principais
  "https://www.zenitetech.com",
  "https://zenite.tech",
  // Landing pages dos grupos ativos (Pesquisa Leads) — atualizado 12/04/2026
  "https://zenitetech.com/solucoes/avant-charge",
  "https://www.zenitetech.com/solucoes/conciergia/clinicas",
  "https://zenitetech.com/segmentos/escolas",
];
const STRATEGIES = ["mobile", "desktop"] as const;
const ALERT_THRESHOLD = 50; // Score abaixo disso gera alerta crítico

interface PageSpeedResult {
  performanceScore: number;
  accessibilityScore: number;
  seoScore: number;
  lcpMs: number;
  fidMs: number;
  clsX1000: number;
  tbtMs: number;
  speedIndexMs: number;
}

async function measurePageSpeed(url: string, strategy: string): Promise<PageSpeedResult | null> {
  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&category=accessibility&category=seo`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) {
      console.error(`[PageSpeed] HTTP ${res.status} para ${url} (${strategy})`);
      return null;
    }
    const data = await res.json() as any;
    const cats = data.lighthouseResult?.categories || {};
    const audits = data.lighthouseResult?.audits || {};

    const performanceScore = Math.round((cats.performance?.score || 0) * 100);
    const accessibilityScore = Math.round((cats.accessibility?.score || 0) * 100);
    const seoScore = Math.round((cats.seo?.score || 0) * 100);
    const lcpMs = Math.round((audits["largest-contentful-paint"]?.numericValue || 0));
    const fidMs = Math.round((audits["max-potential-fid"]?.numericValue || audits["interactive"]?.numericValue || 0));
    const clsRaw = audits["cumulative-layout-shift"]?.numericValue || 0;
    const clsX1000 = Math.round(clsRaw * 1000);
    const tbtMs = Math.round((audits["total-blocking-time"]?.numericValue || 0));
    const speedIndexMs = Math.round((audits["speed-index"]?.numericValue || 0));

    return { performanceScore, accessibilityScore, seoScore, lcpMs, fidMs, clsX1000, tbtMs, speedIndexMs };
  } catch (err: any) {
    console.error(`[PageSpeed] Erro ao medir ${url} (${strategy}):`, err?.message);
    return null;
  }
}

export async function runPageSpeedMonitor() {
  console.log("[PageSpeed] Iniciando medições...");
  const db = await getDb();
  if (!db) {
    console.log("[PageSpeed] DB indisponível.");
    return;
  }

  const alerts: string[] = [];

  for (const url of URLS_TO_MONITOR) {
    for (const strategy of STRATEGIES) {
      const result = await measurePageSpeed(url, strategy);
      if (!result) continue;

      await db.insert(pagespeedHistory).values({
        url,
        strategy,
        performanceScore: result.performanceScore,
        accessibilityScore: result.accessibilityScore,
        seoScore: result.seoScore,
        lcpMs: result.lcpMs,
        fidMs: result.fidMs,
        clsX1000: result.clsX1000,
        tbtMs: result.tbtMs,
        speedIndexMs: result.speedIndexMs,
      });

      console.log(`[PageSpeed] ${url} (${strategy}): Performance=${result.performanceScore} LCP=${result.lcpMs}ms`);

      if (result.performanceScore < ALERT_THRESHOLD) {
        alerts.push(`${url} (${strategy}): score ${result.performanceScore}/100`);
      }
    }
  }

  if (alerts.length > 0) {
    const msg = `PageSpeed crítico detectado:\n${alerts.join("\n")}\n\nAcesse /pagespeed para ver o histórico completo.`;
    await db.insert(alertHistory).values({
      type: "pagespeed_alert",
      severity: "critical",
      title: `⚡ PageSpeed crítico — ${alerts.length} medição(ões) abaixo de ${ALERT_THRESHOLD}`,
      message: msg,
      metadata: JSON.stringify({ alerts, threshold: ALERT_THRESHOLD }),
    });
    await notifyOwner({
      title: `⚡ PageSpeed crítico detectado`,
      content: msg,
    });
    console.log(`[PageSpeed] ${alerts.length} alerta(s) de performance crítica gerado(s).`);
  }

  console.log("[PageSpeed] Medições concluídas.");
}

// A cada 1h (0h, 1h, 2h, ..., 23h) — monitoramento contínuo horário
cron.schedule(
  "0 0 * * * *",
  () => { runPageSpeedMonitor(); },
  { timezone: "America/Sao_Paulo" }
);
console.log("[PageSpeed] Job agendado: a cada 1h (America/Sao_Paulo) — zenitetech.com + zenite.tech + landing pages ativas, mobile + desktop");
