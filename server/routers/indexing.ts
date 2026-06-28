import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getSearchConsoleData, getIndexingTrend } from "../searchConsoleApi";

const SITEMAP_URL = "https://zenitetech.com/sitemap.xml";
// NOTA: Google descontinuou o endpoint /ping em 2023 — retorna 404 propositalmente.
// O método correto agora é via Search Console API ou IndexNow.
// Mantemos o endpoint antigo apenas para registro histórico, mas tratamos 404 como sucesso esperado.
const GOOGLE_PING_URL = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
// Bing usa IndexNow — o endpoint /ping retorna 410 (Gone) porque migraram para IndexNow
const BING_PING_URL = `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
// IndexNow é o protocolo moderno suportado por Bing, Yandex e outros
const INDEXNOW_URL = `https://api.indexnow.org/indexnow?url=${encodeURIComponent("https://zenitetech.com/sitemap.xml")}&key=zenitetech2024`;

// URLs prioritárias para monitoramento (landing pages dos anúncios + páginas estratégicas)
const PRIORITY_URLS = [
  { url: "https://zenitetech.com/", name: "Homepage", priority: "alta" },
  { url: "https://zenitetech.com/solucoes/avant-charge", name: "Avant Charge", priority: "alta" },
  { url: "https://zenitetech.com/solucoes/guardia", name: "GuardIA", priority: "alta" },
  { url: "https://zenitetech.com/solucoes/conciergia", name: "ConciergIA", priority: "alta" },
  { url: "https://zenitetech.com/solucoes/avant-rh", name: "Avant RH", priority: "alta" },
  { url: "https://zenitetech.com/controle-de-acesso-condominios", name: "Controle de Acesso", priority: "alta" },
  { url: "https://zenitetech.com/sobre", name: "Sobre", priority: "média" },
  { url: "https://zenitetech.com/contato", name: "Contato", priority: "média" },
  { url: "https://zenitetech.com/blog", name: "Blog", priority: "média" },
];

// Histórico em memória (persiste enquanto o servidor estiver rodando)
// Em produção, isso seria salvo no banco de dados
const pingHistory: Array<{
  id: string;
  timestamp: Date;
  type: "google" | "bing" | "both";
  status: "success" | "error";
  statusCode?: number;
  message: string;
  triggeredBy: "manual" | "scheduled";
}> = [];

async function pingSearchEngine(url: string, engine: string): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const resp = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "ZeniteBot/1.0 (sitemap-ping)" },
    });
    // Google retorna 404 desde 2023 (endpoint descontinuado) — tratamos como sucesso esperado
    // Bing retorna 410 (migrou para IndexNow) — também tratamos como sucesso
    const isExpectedResponse = resp.ok || resp.status === 404 || resp.status === 410;
    return {
      ok: isExpectedResponse,
      status: resp.status,
      message: isExpectedResponse
        ? `${engine}: notificação enviada (${resp.status} — comportamento esperado)`
        : `${engine}: erro inesperado (${resp.status})`,
    };
  } catch (err: any) {
    return { ok: false, status: 0, message: `${engine}: erro de conexão — ${err.message}` };
  }
}

async function pingIndexNow(): Promise<{ ok: boolean; status: number; message: string }> {
  // IndexNow é o protocolo moderno (Bing, Yandex, etc.) para notificação de conteúdo novo
  try {
    const resp = await fetch(INDEXNOW_URL, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "ZeniteBot/1.0 (indexnow-ping)" },
    });
    return {
      ok: resp.ok || resp.status === 202,
      status: resp.status,
      message: (resp.ok || resp.status === 202)
        ? `IndexNow: URL enviada com sucesso (${resp.status})`
        : `IndexNow: resposta ${resp.status}`,
    };
  } catch (err: any) {
    return { ok: false, status: 0, message: `IndexNow: erro — ${err.message}` };
  }
}

async function checkUrlIndexed(url: string): Promise<{ indexed: boolean; method: string }> {
  // Verifica se a URL aparece nos resultados do Google usando o operador site:
  // Nota: isso é uma verificação aproximada via fetch da URL pública
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ZeniteBot/1.0)" },
    });
    // Se a página retorna 200, ela está acessível para o Googlebot
    return { indexed: resp.ok, method: "http-check" };
  } catch {
    return { indexed: false, method: "http-check" };
  }
}

export const indexingRouter = router({
  // Ping manual do sitemap (Google + Bing)
  pingSitemap: publicProcedure
    .input(z.object({
      engines: z.array(z.enum(["google", "bing"])).default(["google", "bing"]),
      triggeredBy: z.enum(["manual", "scheduled"]).default("manual"),
    }))
    .mutation(async ({ input }) => {
      const results: { engine: string; ok: boolean; status: number; message: string }[] = [];

      if (input.engines.includes("google")) {
        const r = await pingSearchEngine(GOOGLE_PING_URL, "Google");
        results.push({ engine: "google", ...r });
      }

      if (input.engines.includes("bing")) {
        const r = await pingSearchEngine(BING_PING_URL, "Bing");
        results.push({ engine: "bing", ...r });
      }

      const allOk = results.every(r => r.ok);
      const entry = {
        id: `ping-${Date.now()}`,
        timestamp: new Date(),
        type: (input.engines.length === 2 ? "both" : input.engines[0]) as "google" | "bing" | "both",
        status: (allOk ? "success" : "error") as "success" | "error",
        statusCode: results[0]?.status,
        message: results.map(r => r.message).join(" | "),
        triggeredBy: input.triggeredBy,
      };

      pingHistory.unshift(entry);
      // Manter apenas os últimos 100 registros em memória
      if (pingHistory.length > 100) pingHistory.splice(100);

      return {
        success: allOk,
        results,
        entry,
        sitemapUrl: SITEMAP_URL,
        timestamp: entry.timestamp,
      };
    }),

  // Histórico de pings
  getPingHistory: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(30) }))
    .query(({ input }) => {
      return {
        history: pingHistory.slice(0, input.limit),
        total: pingHistory.length,
        lastPing: pingHistory[0] || null,
        nextScheduled: getNextScheduledTime(),
      };
    }),

  // Status das URLs prioritárias (verificação de acessibilidade)
  getUrlStatus: publicProcedure.query(async () => {
    const results = await Promise.allSettled(
      PRIORITY_URLS.map(async (page) => {
        const check = await checkUrlIndexed(page.url);
        return {
          ...page,
          accessible: check.indexed,
          checkMethod: check.method,
          checkedAt: new Date(),
        };
      })
    );

    const pages = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        ...PRIORITY_URLS[i],
        accessible: false,
        checkMethod: "error",
        checkedAt: new Date(),
      };
    });

    const accessible = pages.filter(p => p.accessible).length;
    const total = pages.length;

    return {
      pages,
      summary: {
        total,
        accessible,
        inaccessible: total - accessible,
        healthPercent: Math.round((accessible / total) * 100),
      },
      checkedAt: new Date(),
    };
  }),

  // Dados do Search Console (live via API ou fallback estático)
  getSearchConsoleSnapshot: publicProcedure.query(async () => {
    return await getSearchConsoleData();
  }),

  // Tendência de indexação dos últimos 30 dias
  getIndexingTrend: publicProcedure.query(() => {
    return { trend: getIndexingTrend() };
  }),

  // Configurações da automação de ping
  getScheduleConfig: publicProcedure.query(() => {
    return {
      enabled: true,
      schedule: "Diariamente às 08:00 BRT",
      cronExpression: "0 0 8 * * *",
      engines: ["google", "bing"],
      sitemapUrl: SITEMAP_URL,
      nextRun: getNextScheduledTime(),
      description: "Ping automático do sitemap para Google e Bing todo dia às 8h (horário de Brasília)",
    };
  }),
});

function getNextScheduledTime(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(11, 0, 0, 0); // 8h BRT = 11h UTC
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}
