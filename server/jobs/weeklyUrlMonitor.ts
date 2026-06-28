/**
 * Job: Monitor Semanal de URLs dos Anúncios (toda sexta às 8h)
 *
 * Busca todas as URLs de destino dos anúncios RSA ativos via Google Ads API,
 * verifica o status HTTP de cada uma, identifica 404s e URLs com redirect,
 * e envia alerta por e-mail via Gmail MCP quando encontra problemas.
 *
 * Também salva o resultado no banco para histórico e exibição no dashboard.
 */
import cron from "node-cron";
import {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
} from "../credentials";
import { getDb } from "../db";
import { automationExecutionLogs } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { invokeLLM } from "../_core/llm";

const JOB_NAME = "WeeklyUrlMonitor";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  const env = process.env;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_ADS_CLIENT_ID,
        client_secret: GOOGLE_ADS_CLIENT_SECRET,
        refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json() as any;
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function fetchAdUrls(accessToken: string, customerId: string): Promise<Array<{
  adGroupName: string;
  campaignName: string;
  url: string;
  adId: string;
}>> {
  const env = process.env;
  const loginCustomerId = (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const query = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.final_urls,
      ad_group_ad.status,
      ad_group.name,
      campaign.name
    FROM ad_group_ad
    WHERE ad_group_ad.status = 'ENABLED'
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
      AND campaign.status = 'ENABLED'
  `;

  const res = await fetch(
    `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    }
  );

  if (!res.ok) {
    console.warn(`[${JOB_NAME}] Erro ao buscar URLs: ${res.status}`);
    return [];
  }

  const data = await res.json() as any;
  const results: Array<{ adGroupName: string; campaignName: string; url: string; adId: string }> = [];
  const seen = new Set<string>();

  for (const row of data.results || []) {
    const urls: string[] = row.adGroupAd?.ad?.finalUrls || [];
    for (const url of urls) {
      if (!seen.has(url)) {
        seen.add(url);
        results.push({
          adGroupName: row.adGroup?.name || "",
          campaignName: row.campaign?.name || "",
          url,
          adId: row.adGroupAd?.ad?.id || "",
        });
      }
    }
  }

  return results;
}

async function checkUrl(url: string): Promise<{ status: number; ok: boolean; redirected: boolean; finalUrl: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ZeniteBot/1.0)" },
    });
    clearTimeout(timeout);
    return {
      status: res.status,
      ok: res.ok,
      redirected: res.redirected,
      finalUrl: res.url,
    };
  } catch (e: any) {
    return { status: 0, ok: false, redirected: false, finalUrl: url };
  }
}

// ─── Job Principal ────────────────────────────────────────────────────────────

export async function runWeeklyUrlMonitor() {
  const startTime = Date.now();
  console.log(`[${JOB_NAME}] Iniciando verificação de URLs dos anúncios...`);

  const env = process.env;
  const customerId = (env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  if (!customerId || !env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    console.warn(`[${JOB_NAME}] Credenciais Google Ads não configuradas.`);
    return;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn(`[${JOB_NAME}] Falha ao obter access token.`);
    return;
  }

  // 1. Buscar URLs dos anúncios ativos
  const adUrls = await fetchAdUrls(accessToken, customerId);
  console.log(`[${JOB_NAME}] ${adUrls.length} URLs únicas encontradas nos anúncios ativos.`);

  if (adUrls.length === 0) {
    console.warn(`[${JOB_NAME}] Nenhuma URL encontrada. Encerrando.`);
    return;
  }

  // 2. Verificar status HTTP de cada URL
  const results: Array<{
    adGroupName: string;
    campaignName: string;
    url: string;
    status: number;
    ok: boolean;
    redirected: boolean;
    finalUrl: string;
  }> = [];

  for (const item of adUrls) {
    const check = await checkUrl(item.url);
    results.push({ ...item, ...check });
    console.log(`[${JOB_NAME}] ${check.status} ${item.url} (grupo: ${item.adGroupName})`);
  }

  // 3. Separar problemas
  const broken = results.filter(r => !r.ok || r.status === 404 || r.status === 0);
  const redirected = results.filter(r => r.ok && r.redirected && r.finalUrl !== r.url);
  const healthy = results.filter(r => r.ok && !r.redirected);

  console.log(`[${JOB_NAME}] Resultado: ${healthy.length} OK | ${redirected.length} redirect | ${broken.length} quebradas`);

  const durationMs = Date.now() - startTime;

  // 4. Salvar no banco
  const db = await getDb();
  if (db) {
    try {
      await db.insert(automationExecutionLogs).values({
        automationName: "weekly_url_monitor",
        automationLabel: "Monitor Semanal de URLs",
        status: broken.length > 0 ? "warning" : "success",
        summary: `${results.length} URLs verificadas: ${healthy.length} OK, ${redirected.length} redirect, ${broken.length} quebradas`,
        details: { results, broken, redirected, healthy, checkedAt: new Date().toISOString() },
        durationMs,
        triggeredBy: "schedule",
        emailSent: false,
      });
    } catch (e) {
      console.warn(`[${JOB_NAME}] Erro ao salvar no banco:`, e);
    }
  }

  // 5. Enviar alerta se houver URLs quebradas
  if (broken.length > 0) {
    const brokenList = broken.map(r =>
      `• [${r.status || "TIMEOUT"}] ${r.url}\n  Grupo: ${r.adGroupName} | Campanha: ${r.campaignName}`
    ).join("\n");

    const redirectList = redirected.length > 0
      ? `\n\n⚠️ URLs com Redirect (${redirected.length}):\n` + redirected.map(r =>
          `• ${r.url} → ${r.finalUrl}\n  Grupo: ${r.adGroupName}`
        ).join("\n")
      : "";

    const emailBody = `🚨 ALERTA: URLs Quebradas nos Anúncios Google Ads

Data: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}

❌ URLs com Problema (${broken.length}):
${brokenList}${redirectList}

📊 Resumo:
• Total verificadas: ${results.length}
• Saudáveis (200 OK): ${healthy.length}
• Com redirect: ${redirected.length}
• Quebradas (4xx/timeout): ${broken.length}

⚡ Ação Recomendada:
Acesse o dashboard em social-ads.zenitetech.com → Gestão Semanal para ver detalhes e corrigir as URLs nos anúncios afetados.

—
Zênite Tech — Dashboard de Tráfego Pago
Automação: Monitor Semanal de URLs`;

    // Notificar via sistema interno
    await notifyOwner({
      title: `🚨 ${broken.length} URL(s) quebrada(s) nos anúncios`,
      content: emailBody,
    });

    console.log(`[${JOB_NAME}] Alerta enviado: ${broken.length} URLs quebradas encontradas.`);
  } else {
    console.log(`[${JOB_NAME}] Todas as URLs estão saudáveis. Nenhum alerta necessário.`);
  }

  console.log(`[${JOB_NAME}] Concluído em ${durationMs}ms.`);
}

// ─── Agendamento ──────────────────────────────────────────────────────────────
// Toda sexta-feira às 8h (America/Sao_Paulo)
cron.schedule("0 8 * * 5", () => {
  runWeeklyUrlMonitor().catch(e => console.error(`[${JOB_NAME}] Erro:`, e));
}, { timezone: "America/Sao_Paulo" });

console.log(`[${JOB_NAME}] Job agendado: toda sexta às 8h (Brasília)`);
