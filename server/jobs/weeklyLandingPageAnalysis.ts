/**
 * Job: Análise Semanal de Landing Pages dos Anúncios (toda segunda às 9h30)
 *
 * Para cada grupo de anúncios ativo:
 * 1. Extrai a URL de destino dos RSAs
 * 2. Faz scraping do conteúdo (título, H1, CTA, formulário, WhatsApp)
 * 3. Consulta PageSpeed Insights (mobile + desktop)
 * 4. Cruza com métricas do grupo (CTR, CPC, conversões)
 * 5. Gera diagnóstico via LLM como gestor de tráfego
 * 6. Gera prompt pronto para colar no Lovable e melhorar a LP
 * 7. Salva no banco + notifica owner
 */
import cron from "node-cron";
import {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
} from "../credentials";
import { getDb } from "../db";
import { landingPageAnalyses } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { invokeLLM } from "../_core/llm";

const JOB_NAME = "WeeklyLandingPageAnalysis";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

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
  } catch { return null; }
}

interface AdGroupMetrics {
  adGroupName: string;
  campaignName: string;
  url: string;
  ctr: number;
  cpc: number;
  conversions: number;
  clicks: number;
  spend: number;
}

async function fetchAdGroupMetrics(accessToken: string, customerId: string): Promise<AdGroupMetrics[]> {
  const env = process.env;
  const loginCustomerId = (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const query = `
    SELECT
      ad_group.name,
      campaign.name,
      ad_group_ad.ad.final_urls,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.clicks,
      metrics.cost_micros
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${fmt(startDate)}' AND '${fmt(endDate)}'
      AND ad_group_ad.status = 'ENABLED'
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
      AND campaign.status = 'ENABLED'
    ORDER BY metrics.cost_micros DESC
  `;

  const res = await fetch(
    `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`,
    { method: "POST", headers, body: JSON.stringify({ query }) }
  );

  if (!res.ok) return [];
  const data = await res.json() as any;

  // Deduplicar por URL (pegar o grupo com maior gasto por URL)
  const byUrl = new Map<string, AdGroupMetrics>();
  for (const row of data.results || []) {
    const urls: string[] = row.adGroupAd?.ad?.finalUrls || [];
    if (!urls.length) continue;
    const url = urls[0];
    const existing = byUrl.get(url);
    const spend = (row.metrics?.costMicros || 0) / 1_000_000;
    if (!existing || spend > existing.spend) {
      byUrl.set(url, {
        adGroupName: row.adGroup?.name || "",
        campaignName: row.campaign?.name || "",
        url,
        ctr: (row.metrics?.ctr || 0) * 100,
        cpc: (row.metrics?.averageCpc || 0) / 1_000_000,
        conversions: Math.round(row.metrics?.conversions || 0),
        clicks: row.metrics?.clicks || 0,
        spend,
      });
    }
  }

  return Array.from(byUrl.values());
}

interface PageContent {
  title: string;
  metaDescription: string;
  h1: string;
  cta: string;
  hasForm: boolean;
  hasWhatsapp: boolean;
  wordCount: number;
}

async function scrapePage(url: string): Promise<PageContent> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ZeniteAnalyzer/1.0)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return { title: "", metaDescription: "", h1: "", cta: "", hasForm: false, hasWhatsapp: false, wordCount: 0 };

    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

    // CTA: procurar botões ou links com texto de ação
    const ctaPatterns = [
      /<button[^>]*>([^<]{5,50})<\/button>/gi,
      /<a[^>]*class=["'][^"']*btn[^"']*["'][^>]*>([^<]{5,50})<\/a>/gi,
    ];
    let cta = "";
    for (const pattern of ctaPatterns) {
      const match = pattern.exec(html);
      if (match) { cta = match[1].trim(); break; }
    }

    const hasForm = /<form/i.test(html);
    const hasWhatsapp = /whatsapp|wa\.me/i.test(html);

    // Contar palavras no texto visível (aproximado)
    const textOnly = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const wordCount = textOnly.split(" ").filter(w => w.length > 3).length;

    return {
      title: (titleMatch?.[1] || "").trim().substring(0, 200),
      metaDescription: (metaMatch?.[1] || "").trim().substring(0, 300),
      h1: (h1Match?.[1] || "").trim().substring(0, 200),
      cta: cta.substring(0, 100),
      hasForm,
      hasWhatsapp,
      wordCount,
    };
  } catch {
    return { title: "", metaDescription: "", h1: "", cta: "", hasForm: false, hasWhatsapp: false, wordCount: 0 };
  }
}

interface PageSpeedResult {
  mobile: number;
  desktop: number;
  lcpMs: number;
  cls: string;
}

async function getPageSpeed(url: string): Promise<PageSpeedResult> {
  const defaultResult: PageSpeedResult = { mobile: 0, desktop: 0, lcpMs: 0, cls: "N/A" };
  try {
    const [mobileRes, desktopRes] = await Promise.all([
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile`),
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=desktop`),
    ]);

    const [mobileData, desktopData] = await Promise.all([
      mobileRes.ok ? mobileRes.json() as Promise<any> : Promise.resolve(null),
      desktopRes.ok ? desktopRes.json() as Promise<any> : Promise.resolve(null),
    ]);

    const mobileScore = Math.round((mobileData?.lighthouseResult?.categories?.performance?.score || 0) * 100);
    const desktopScore = Math.round((desktopData?.lighthouseResult?.categories?.performance?.score || 0) * 100);
    const lcpMs = Math.round((mobileData?.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue || 0));
    const cls = mobileData?.lighthouseResult?.audits?.["cumulative-layout-shift"]?.displayValue || "N/A";

    return { mobile: mobileScore, desktop: desktopScore, lcpMs, cls };
  } catch {
    return defaultResult;
  }
}

interface LPDiagnosis {
  score: number;
  summary: string;
  issues: string[];
  lovablePrompt: string;
  priority: "low" | "medium" | "high" | "critical";
}

async function diagnoseLandingPage(
  metrics: AdGroupMetrics,
  content: PageContent,
  speed: PageSpeedResult
): Promise<LPDiagnosis> {
  const prompt = `Você é um gestor de tráfego pago B2B sênior analisando a landing page de um anúncio do Google Ads.

## Dados do Grupo de Anúncios
- Grupo: ${metrics.adGroupName}
- Campanha: ${metrics.campaignName}
- URL: ${metrics.url}
- CTR: ${metrics.ctr.toFixed(2)}% | CPC: R$ ${metrics.cpc.toFixed(2)} | Conversões: ${metrics.conversions} | Cliques: ${metrics.clicks} | Gasto: R$ ${metrics.spend.toFixed(2)}

## Conteúdo da Página
- Título: ${content.title || "Não encontrado"}
- Meta Description: ${content.metaDescription || "Não encontrada"}
- H1: ${content.h1 || "Não encontrado"}
- CTA Principal: ${content.cta || "Não identificado"}
- Tem Formulário: ${content.hasForm ? "Sim" : "Não"}
- Tem WhatsApp: ${content.hasWhatsapp ? "Sim" : "Não"}
- Contagem de palavras: ${content.wordCount}

## PageSpeed
- Mobile: ${speed.mobile}/100 | Desktop: ${speed.desktop}/100
- LCP: ${speed.lcpMs}ms | CLS: ${speed.cls}

## Sua Análise (responda em JSON):
{
  "score": [0-100, onde 100 = LP perfeita para conversão B2B],
  "summary": "[2-3 frases resumindo o diagnóstico]",
  "issues": ["problema 1", "problema 2", "problema 3"],
  "priority": "low|medium|high|critical",
  "lovable_prompt": "[prompt completo em português para colar no Lovable e melhorar a LP. Deve ser específico, acionável e incluir: o que mudar, por que, e como. Mínimo 150 palavras.]"
}

Critérios B2B:
- CTR < 5% = problema sério de relevância
- 0 conversões com > 50 cliques = LP não converte
- PageSpeed mobile < 50 = crítico para Google Ads Quality Score
- Sem formulário E sem WhatsApp = sem captura de lead
- H1 genérico ou sem proposta de valor clara = problema
- Meta description ausente = SEO e CTR prejudicados`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Você é um gestor de tráfego pago B2B especialista em Google Ads e otimização de landing pages. Responda sempre em JSON válido." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lp_diagnosis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              score: { type: "integer" },
              summary: { type: "string" },
              issues: { type: "array", items: { type: "string" } },
              priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
              lovable_prompt: { type: "string" },
            },
            required: ["score", "summary", "issues", "priority", "lovable_prompt"],
            additionalProperties: false,
          },
        },
      },
    });

    const content_text = response?.choices?.[0]?.message?.content;
    if (!content_text) throw new Error("No LLM response");
    const parsed = typeof content_text === "string" ? JSON.parse(content_text) : content_text;
    return {
      score: parsed.score || 50,
      summary: parsed.summary || "",
      issues: parsed.issues || [],
      lovablePrompt: parsed.lovable_prompt || "",
      priority: parsed.priority || "medium",
    };
  } catch (e) {
    console.warn(`[${JOB_NAME}] Erro no LLM para ${metrics.url}:`, e);
    return {
      score: 50,
      summary: "Análise automática indisponível",
      issues: ["Não foi possível gerar diagnóstico automático"],
      lovablePrompt: "",
      priority: "medium",
    };
  }
}

// ─── Job Principal ────────────────────────────────────────────────────────────

export async function runWeeklyLandingPageAnalysis() {
  const startTime = Date.now();
  console.log(`[${JOB_NAME}] Iniciando análise semanal de landing pages...`);

  const env = process.env;
  const customerId = (env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  if (!customerId || !env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    console.warn(`[${JOB_NAME}] Credenciais não configuradas.`);
    return;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn(`[${JOB_NAME}] Falha ao obter access token.`);
    return;
  }

  const weekLabel = getWeekLabel();
  const adGroups = await fetchAdGroupMetrics(accessToken, customerId);
  console.log(`[${JOB_NAME}] ${adGroups.length} grupos únicos encontrados.`);

  if (!adGroups.length) return;

  const db = await getDb();
  const analyses: Array<{ adGroupName: string; score: number; priority: string; url: string }> = [];

  for (const group of adGroups) {
    console.log(`[${JOB_NAME}] Analisando: ${group.adGroupName} → ${group.url}`);

    const [content, speed] = await Promise.all([
      scrapePage(group.url),
      getPageSpeed(group.url),
    ]);

    const diagnosis = await diagnoseLandingPage(group, content, speed);

    if (db) {
      try {
        await db.insert(landingPageAnalyses).values({
          url: group.url,
          adGroupName: group.adGroupName,
          campaignName: group.campaignName,
          pagespeedMobile: speed.mobile,
          pagespeedDesktop: speed.desktop,
          lcpMs: speed.lcpMs,
          clsScore: speed.cls,
          pageTitle: content.title,
          metaDescription: content.metaDescription,
          h1Text: content.h1,
          ctaText: content.cta,
          hasForm: content.hasForm,
          hasWhatsapp: content.hasWhatsapp,
          wordCount: content.wordCount,
          groupCtr: group.ctr.toFixed(2),
          groupCpc: group.cpc.toFixed(2),
          groupConversions: group.conversions,
          groupClicks: group.clicks,
          groupSpend: group.spend.toFixed(2),
          diagnosisScore: diagnosis.score,
          diagnosisSummary: diagnosis.summary,
          mainIssues: diagnosis.issues,
          lovablePrompt: diagnosis.lovablePrompt,
          priority: diagnosis.priority,
          weekLabel,
        });
      } catch (e) {
        console.warn(`[${JOB_NAME}] Erro ao salvar análise de ${group.url}:`, e);
      }
    }

    analyses.push({
      adGroupName: group.adGroupName,
      score: diagnosis.score,
      priority: diagnosis.priority,
      url: group.url,
    });
  }

  // Resumo para notificação
  const critical = analyses.filter(a => a.priority === "critical");
  const high = analyses.filter(a => a.priority === "high");
  const avgScore = analyses.reduce((s, a) => s + a.score, 0) / (analyses.length || 1);

  const summary = `📊 Análise Semanal de Landing Pages — ${weekLabel}

Total analisadas: ${analyses.length}
Score médio: ${avgScore.toFixed(0)}/100
🔴 Críticas: ${critical.length} | 🟠 Alta prioridade: ${high.length}

${critical.length > 0 ? `⚠️ LPs Críticas:\n${critical.map(a => `• ${a.adGroupName}: ${a.score}/100\n  ${a.url}`).join("\n")}` : "✅ Nenhuma LP crítica esta semana."}

Acesse social-ads.zenitetech.com/gestao-semanal para ver prompts prontos para o Lovable.`;

  await notifyOwner({
    title: `📊 Análise de LPs: ${analyses.length} páginas | Score médio ${avgScore.toFixed(0)}/100`,
    content: summary,
  });

  console.log(`[${JOB_NAME}] Concluído em ${Date.now() - startTime}ms. ${analyses.length} LPs analisadas.`);
}

// ─── Agendamento ──────────────────────────────────────────────────────────────
// Toda segunda-feira às 9h30 (America/Sao_Paulo)
cron.schedule("0 30 9 * * 1", () => {
  runWeeklyLandingPageAnalysis().catch(e => console.error(`[${JOB_NAME}] Erro:`, e));
}, { timezone: "America/Sao_Paulo" });

console.log(`[${JOB_NAME}] Job agendado: toda segunda às 9h30 (Brasília)`);
