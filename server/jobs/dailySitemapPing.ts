/**
 * Job: dailySitemapPing
 * Horário: todo dia às 7h00 (UTC-3 = 10h UTC)
 * Objetivo: Enviar ping automático do sitemap para Google (IndexNow) e Bing,
 *           acelerando a indexação de novas páginas e atualizações de conteúdo.
 */

import cron from "node-cron";
import { notifyOwner } from "../_core/notification";

const SITEMAP_URLS = [
  "https://zenitetech.com/sitemap.xml",
  "https://zenite.tech/sitemap.xml",
];

const GOOGLE_PING_BASE = "https://www.google.com/ping?sitemap=";
const BING_PING_BASE = "https://www.bing.com/ping?sitemap=";

interface PingResult {
  engine: string;
  sitemap: string;
  status: number | null;
  ok: boolean;
  error?: string;
}

async function pingSitemap(engine: string, url: string): Promise<PingResult> {
  const base = engine === "google" ? GOOGLE_PING_BASE : BING_PING_BASE;
  const pingUrl = `${base}${encodeURIComponent(url)}`;
  try {
    const res = await fetch(pingUrl, {
      method: "GET",
      headers: { "User-Agent": "ZeniteTech-DashboardBot/1.0" },
      redirect: "follow",
    });
    return { engine, sitemap: url, status: res.status, ok: res.ok };
  } catch (err: any) {
    return { engine, sitemap: url, status: null, ok: false, error: err.message };
  }
}

async function runSitemapPing() {
  console.log("[dailySitemapPing] Iniciando ping de sitemaps...");
  const results: PingResult[] = [];

  for (const sitemap of SITEMAP_URLS) {
    const [google, bing] = await Promise.all([
      pingSitemap("google", sitemap),
      pingSitemap("bing", sitemap),
    ]);
    results.push(google, bing);
  }

  const successCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;

  const lines = results.map(r =>
    `  ${r.ok ? "✅" : "❌"} ${r.engine.toUpperCase()} | ${r.sitemap} | HTTP ${r.status ?? "ERR"} ${r.error ? `| ${r.error}` : ""}`
  );

  console.log(`[dailySitemapPing] Resultado: ${successCount} OK, ${failCount} falhas`);
  results.forEach(r => console.log(`  ${r.engine} ${r.sitemap} → ${r.ok ? "OK" : r.error}`));

  if (failCount > 0) {
    await notifyOwner({
      title: `⚠️ Sitemap Ping: ${failCount} falha(s) detectada(s)`,
      content: `O job de ping de sitemap encontrou falhas:\n\n${lines.join("\n")}\n\nVerifique se os sitemaps estão acessíveis.`,
    });
  } else {
    console.log(`[dailySitemapPing] Todos os pings enviados com sucesso.`);
  }
}

// Todo dia às 7h (horário de Brasília = 10h UTC)
cron.schedule("0 10 * * *", async () => {
  try {
    await runSitemapPing();
  } catch (err) {
    console.error("[dailySitemapPing] Erro inesperado:", err);
  }
});

console.log("[dailySitemapPing] Job agendado: todo dia às 7h (Brasília)");
