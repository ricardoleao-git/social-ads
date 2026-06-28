/**
 * Gmail Alerts Router
 * Lê e-mails do Gmail (rjll70@gmail.com) relacionados ao Google Ads,
 * compara com dados da API do Google Ads e registra alertas no banco.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { gmailAlerts, gmailAlertActions } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { invokeLLM } from "../\_core/llm";
import {
  GOOGLE_ADS_REFRESH_TOKEN,
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_CUSTOMER_ID,
  GMAIL_REFRESH_TOKEN,
} from "../credentials";

// ─── Gmail OAuth Helper ────────────────────────────────────────────────────
async function getGmailAccessToken(): Promise<string> {
  const clientId = GOOGLE_ADS_CLIENT_ID;
  const clientSecret = GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = GMAIL_REFRESH_TOKEN;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await resp.json() as any;
  if (!data.access_token) throw new Error("Failed to get Gmail access token: " + JSON.stringify(data));
  return data.access_token;
}

// ─── Gmail API Helpers ─────────────────────────────────────────────────────
async function listGmailMessages(accessToken: string, query: string, maxResults = 20): Promise<any[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json() as any;
  return data.messages || [];
}

async function getGmailMessage(accessToken: string, messageId: string): Promise<any> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return resp.json();
}

function extractEmailBody(message: any): string {
  const payload = message.payload;
  if (!payload) return "";

  const extractText = (part: any): string => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.parts) {
      return part.parts.map(extractText).join("\n");
    }
    return "";
  };

  return extractText(payload).substring(0, 3000);
}

function getHeader(message: any, name: string): string {
  const headers = message.payload?.headers || [];
  const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

// ─── Google Ads API Helper ─────────────────────────────────────────────────
async function getGadsAccessToken(): Promise<string> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_ADS_CLIENT_ID,
      client_secret: GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await resp.json() as any;
  return data.access_token;
}

async function getGadsCampaignStatus(): Promise<any[]> {
  try {
    const accessToken = await getGadsAccessToken();
    const customerId = GOOGLE_ADS_CUSTOMER_ID || process.env.GOOGLE_ADS_CUSTOMER_ID!;
    const query = `SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.name`;

    const resp = await fetch(
      `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );
    const data = await resp.json() as any;
    return data.results || [];
  } catch {
    return [];
  }
}

// ─── AI Analysis ──────────────────────────────────────────────────────────
async function analyzeEmailWithAI(subject: string, body: string, adsContext: string): Promise<{
  summary: string;
  urgency: "critical" | "warning" | "info";
  category: "google_ads" | "billing" | "policy" | "performance" | "divergence" | "other";
  divergence: { type: string; emailValue: string; apiValue: string; description: string } | null;
  isRelevant: boolean;
}> {
  const prompt = `Você é um especialista em Google Ads analisando e-mails para um gestor de tráfego pago B2B.

E-MAIL:
Assunto: ${subject}
Conteúdo: ${body.substring(0, 2000)}

CONTEXTO DA API GOOGLE ADS (campanhas ativas):
${adsContext}

Analise este e-mail e responda em JSON com:
- isRelevant: boolean (true se relacionado a Google Ads, cobrança, política, performance ou divergências)
- summary: string (resumo em português, máx 200 chars)
- urgency: "critical" | "warning" | "info"
  - critical: suspensão, política violada, cobrança inesperada, campanha pausada automaticamente
  - warning: recomendação importante, orçamento esgotando, CTR caindo, divergência detectada
  - info: relatório de performance, sugestão, novidade
- category: "google_ads" | "billing" | "policy" | "performance" | "divergence" | "other"
- divergence: null ou { type, emailValue, apiValue, description } se o e-mail menciona algo diferente do que está na API`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Responda APENAS com JSON válido, sem markdown." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isRelevant: { type: "boolean" },
              summary: { type: "string" },
              urgency: { type: "string", enum: ["critical", "warning", "info"] },
              category: { type: "string", enum: ["google_ads", "billing", "policy", "performance", "divergence", "other"] },
              divergence: {
                oneOf: [
                  { type: "null" },
                  {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      emailValue: { type: "string" },
                      apiValue: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["type", "emailValue", "apiValue", "description"],
                    additionalProperties: false,
                  },
                ],
              },
            },
            required: ["isRelevant", "summary", "urgency", "category", "divergence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  } catch {
    return {
      isRelevant: true,
      summary: subject.substring(0, 200),
      urgency: "info",
      category: "other",
      divergence: null,
    };
  }
}

// ─── Main Job Function ─────────────────────────────────────────────────────
export async function runGmailSyncJob(): Promise<{ processed: number; saved: number }> {
  let processed = 0;
  let saved = 0;

  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const accessToken = await getGmailAccessToken();

    // Buscar campanhas da API para contexto
    const campaigns = await getGadsCampaignStatus();
    const adsContext = campaigns.length > 0
      ? campaigns.map((c: any) => `${c.campaign?.name}: ${c.campaign?.status}`).join(", ")
      : "Nenhuma campanha encontrada";

    // Queries de busca no Gmail — últimos 90 dias, apenas remetentes relevantes
    const queries = [
      // Google Ads (todos os remetentes oficiais)
      "from:(ads-noreply@google.com OR ads-account-noreply@google.com) newer_than:90d",
      // Google Search Console, Business Profile, Analytics
      "from:(sc-noreply@google.com OR businessprofile-noreply@google.com OR analytics-noreply@google.com) newer_than:90d",
      // Meta / Instagram / Facebook
      "from:(facebookmail.com OR instagram.com) newer_than:90d",
      // Relatórios automáticos do dashboard
      "from:rjll70@gmail.com subject:(Google Ads OR Relatório OR Monitor) newer_than:90d",
      // Consultores Google Ads (domínio xwf.google.com)
      "from:xwf.google.com newer_than:90d",
      // Google Ads Policy
      "from:ads-account-noreply@google.com newer_than:90d",
    ];

    const allMessageIds = new Set<string>();

    for (const query of queries) {
      const messages = await listGmailMessages(accessToken, query, 10);
      messages.forEach((m: any) => allMessageIds.add(m.id));
    }

    for (const messageId of allMessageIds) {
      processed++;

      // Verificar se já foi processado
      const existing = await db
        .select({ id: gmailAlerts.id })
        .from(gmailAlerts)
        .where(eq(gmailAlerts.gmailMessageId, messageId))
        .limit(1);

      if (existing.length > 0) continue;

      // Buscar e-mail completo
      const message = await getGmailMessage(accessToken, messageId);
      const subject = getHeader(message, "subject") || "(sem assunto)";
      const sender = getHeader(message, "from") || "unknown";
      const dateStr = getHeader(message, "date");
      const body = extractEmailBody(message);

      const emailDate = dateStr ? new Date(dateStr) : new Date();

      // Analisar com IA
      const analysis = await analyzeEmailWithAI(subject, body, adsContext);

      if (!analysis.isRelevant) continue;

      // Salvar no banco
      await db.insert(gmailAlerts).values({
        gmailMessageId: messageId,
        subject: subject.substring(0, 512),
        sender: sender.substring(0, 255),
        summary: analysis.summary,
        urgency: analysis.urgency,
        category: analysis.category,
        divergence: analysis.divergence,
        isBlinking: analysis.urgency !== "info",
        isResolved: false,
        emailDate,
      });

      saved++;
    }
  } catch (err) {
    console.error("[GmailSync] Error:", err);
  }

  return { processed, saved };
}

//// ─── Classificação de Relevância ────────────────────────────────────────────────────────
const DIGITAL_KEYWORDS = [
  // Google Ads
  "google ads", "adwords", "campanha", "anúncio", "cpc", "ctr", "conversão", "impressoes",
  // GBP / Search Console
  "google business", "search console", "indexação", "seo", "zenitetech.com", "zenite.tech",
  // Instagram / Meta
  "instagram", "meta", "facebook", "reels", "stories", "alcance", "engajamento",
  // Sistemas Zênite
  "zênite", "zenite", "wallbox", "guardia", "concierg", "zipy", "zface", "zblock",
  "catraca", "relógio de ponto", "controle de acesso", "pabx", "whatsapp",
  // Dashboard / Automações
  "dashboard", "relatório", "automação", "monitor", "alerta",
  // Leads / CRM
  "lead", "proposta", "cliente", "contato", "orçamento",
  // Segurança eletrônica
  "segurança eletrônica", "câmera", "cftv", "monitoramento",
];

// E-mail iCloud vinculado ao Instagram @zenite.tech (conta Apple ID da Zênite Tech)
export const INSTAGRAM_ICLOUD_EMAIL = "zenitetech@icloud.com";
// E-mail Google principal (Google Ads, Search Console, GBP, Analytics)
export const GOOGLE_MAIN_EMAIL = "rjll70@gmail.com";

const RELEVANT_SENDERS = [
  "google.com", "googleads", "ads-noreply", "businessprofile-noreply",
  "sc-noreply", "accounts.google.com", "meta.com", "facebook.com",
  "instagram.com", "facebookmail.com", "rjll70@gmail.com",
  "xwf.google.com", // Consultores Google Ads
  "zenitetech@icloud.com", // Instagram @zenite.tech
];

// ─── Lista Negra de Remetentes (nunca processar) ───────────────────────────────
// Adicione aqui remetentes de spam, cobranças e newsletters irrelevantes
export const SENDER_BLACKLIST = [
  "seowriting.ai",
  "acerto.com.br",
  "cobranca.acerto",
  "negociar.acerto",
  "pesquisa.vivo",
  "pagamento@registro.br",
  "railway.app",
  "notify.railway",
  "news.railway",
  "qrcode-tiger",
  "qrcg.com",
  "lovable.dev",
  "dhl.com",
  "correios.com.br",
  "startse.com",
  "hubspot.com",
  "mailchimp.com",
  "unsubscribe",
  "noreply@medium.com",
  "noreply@substack.com",
];

function isBlacklisted(sender: string): boolean {
  const s = sender.toLowerCase();
  return SENDER_BLACKLIST.some(bl => s.includes(bl));
}

function classifyEmail(from: string, subject: string, snippet: string): {
  relevant: boolean;
  category: string;
  score: number;
} {
  const text = (from + " " + subject + " " + snippet).toLowerCase();
  let score = 0;
  let category = "Outros";

  // Bonus por remetente confiável
  if (RELEVANT_SENDERS.some(s => from.toLowerCase().includes(s))) score += 3;

  // Classificação por categoria
  if (text.includes("google ads") || text.includes("adwords") || text.includes("campanha") || text.includes("anúncio")) {
    category = "Google Ads"; score += 5;
  } else if (text.includes("search console") || text.includes("indexação") || text.includes("seo")) {
    category = "Search Console"; score += 5;
  } else if (text.includes("google business") || text.includes("businessprofile")) {
    category = "Google Business"; score += 5;
  } else if (text.includes("instagram") || text.includes("meta") || text.includes("facebook") || text.includes("reels")) {
    category = "Instagram / Meta"; score += 4;
  } else if (text.includes("zênite") || text.includes("zenite") || text.includes("wallbox") || text.includes("guardia") || text.includes("zipy") || text.includes("zface")) {
    category = "Zênite Tech"; score += 4;
  } else if (text.includes("lead") || text.includes("proposta") || text.includes("cliente") || text.includes("orçamento")) {
    category = "Leads / CRM"; score += 3;
  } else if (text.includes("dashboard") || text.includes("relatório") || text.includes("automação") || text.includes("monitor")) {
    category = "Dashboard"; score += 3;
  } else if (text.includes("segurança") || text.includes("câmera") || text.includes("cftv")) {
    category = "Segurança Eletrônica"; score += 3;
  }

  // Bonus por keywords digitais
  const keywordMatches = DIGITAL_KEYWORDS.filter(kw => text.includes(kw)).length;
  score += Math.min(keywordMatches, 5);

  return { relevant: score >= 3, category, score };
}

// ─── tRPC Router ────────────────────────────────────────────────────────
export const gmailAlertsRouter = router({
  // Listar alertas
  list: protectedProcedure
    .input(z.object({
      showResolved: z.boolean().default(false),
      urgency: z.enum(["critical", "warning", "info", "all"]).default("all"),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (!input.showResolved) {
        conditions.push(eq(gmailAlerts.isResolved, false));
      }

      const alerts = await db
        .select()
        .from(gmailAlerts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(gmailAlerts.emailDate))
        .limit(input.limit);

      // Buscar ações para cada alerta
      const allActions = await db
        .select()
        .from(gmailAlertActions)
        .orderBy(desc(gmailAlertActions.createdAt));

      return alerts.map(alert => ({
        ...alert,
        actions: allActions.filter(a => a.alertId === alert.id),
      }));
    }),

  // Contar alertas não resolvidos
  countUnresolved: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, critical: 0, warning: 0, info: 0 };

      const result = await db
        .select({ id: gmailAlerts.id, urgency: gmailAlerts.urgency })
        .from(gmailAlerts)
        .where(eq(gmailAlerts.isResolved, false));

      return {
        total: result.length,
        critical: result.filter(a => a.urgency === "critical").length,
        warning: result.filter(a => a.urgency === "warning").length,
        info: result.filter(a => a.urgency === "info").length,
      };
    }),

  // Marcar como resolvido + registrar ação
  resolve: protectedProcedure
    .input(z.object({
      alertId: z.number(),
      actionTaken: z.string().min(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userName = (ctx.user as any)?.name || "Ricardo";

      await db.insert(gmailAlertActions).values({
        alertId: input.alertId,
        actionTaken: input.actionTaken,
        takenBy: userName,
      });

      await db
        .update(gmailAlerts)
        .set({
          isResolved: true,
          isBlinking: false,
          resolvedAt: new Date(),
          resolvedBy: userName,
        })
        .where(eq(gmailAlerts.id, input.alertId));

      return { success: true };
    }),

  // Ignorar alerta (parar de piscar)
  dismiss: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(gmailAlerts)
        .set({ isBlinking: false })
        .where(eq(gmailAlerts.id, input.alertId));
      return { success: true };
    }),

  // Executar sync manual
  syncNow: protectedProcedure
    .mutation(async () => {
      return runGmailSyncJob();
    }),

  // Info do último sync
  lastSync: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { lastSync: null };
      const last = await db
        .select({ processedAt: gmailAlerts.processedAt })
        .from(gmailAlerts)
        .orderBy(desc(gmailAlerts.processedAt))
        .limit(1);
      return { lastSync: last[0]?.processedAt || null };
    }),

  // Caixa de entrada: busca e-mails diretamente da API do Gmail e classifica por relevância
  inbox: protectedProcedure
    .input(z.object({
      maxResults: z.number().default(50),
      onlyRelevant: z.boolean().default(false),
      onlyUnread: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      const accessToken = await getGmailAccessToken();
      const INBOX_KEYWORDS = [
        "google ads", "adwords", "campanha", "anúncio", "cpc", "ctr", "conversão",
        "google business", "search console", "indexação", "seo", "zenitetech.com",
        "instagram", "meta", "facebook", "reels", "stories", "alcance", "engajamento",
        "zênite", "zenite", "wallbox", "guardia", "concierg", "zipy", "zface", "zblock",
        "catraca", "relógio de ponto", "controle de acesso", "pabx", "whatsapp",
        "dashboard", "relatório", "automação", "monitor", "alerta",
        "lead", "proposta", "cliente", "orçamento",
        "segurança eletrônica", "câmera", "cftv",
      ];
      const INBOX_RELEVANT_SENDERS = [
        "google.com", "googleads", "ads-noreply", "businessprofile-noreply",
        "sc-noreply", "accounts.google.com", "meta.com", "facebook.com",
        "instagram.com", "facebookmail.com", "rjll70@gmail.com",
        "xwf.google.com", "zenitetech@icloud.com",
      ];
      function classifyInboxEmail(from: string, subject: string, snippet: string) {
        const text = (from + " " + subject + " " + snippet).toLowerCase();
        let score = 0;
        let category = "Outros";
        if (INBOX_RELEVANT_SENDERS.some(s => from.toLowerCase().includes(s))) score += 3;
        if (text.includes("google ads") || text.includes("adwords") || text.includes("campanha") || text.includes("anúncio")) {
          category = "Google Ads"; score += 5;
        } else if (text.includes("search console") || text.includes("indexação") || text.includes("seo")) {
          category = "Search Console"; score += 5;
        } else if (text.includes("google business") || text.includes("businessprofile")) {
          category = "Google Business"; score += 5;
        } else if (text.includes("instagram") || text.includes("meta") || text.includes("facebook") || text.includes("reels")) {
          category = "Instagram / Meta"; score += 4;
        } else if (text.includes("zênite") || text.includes("zenite") || text.includes("wallbox") || text.includes("guardia") || text.includes("zipy") || text.includes("zface")) {
          category = "Zênite Tech"; score += 4;
        } else if (text.includes("lead") || text.includes("proposta") || text.includes("cliente") || text.includes("orçamento")) {
          category = "Leads / CRM"; score += 3;
        } else if (text.includes("dashboard") || text.includes("relatório") || text.includes("automação") || text.includes("monitor")) {
          category = "Dashboard"; score += 3;
        } else if (text.includes("segurança") || text.includes("câmera") || text.includes("cftv")) {
          category = "Segurança Eletrônica"; score += 3;
        }
        const keywordMatches = INBOX_KEYWORDS.filter(kw => text.includes(kw)).length;
        score += Math.min(keywordMatches, 5);
        return { relevant: score >= 3, category, score };
      }

      // Buscar os e-mails mais recentes da INBOX (com filtro de não lidos se solicitado)
      const labelFilter = input.onlyUnread ? "&labelIds=INBOX&labelIds=UNREAD" : "&labelIds=INBOX";
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${input.maxResults}${labelFilter}`;
      const listResp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const listData = await listResp.json() as any;
      const messages: any[] = listData.messages || [];

      // Buscar metadados em paralelo (lotes de 10)
      const results: any[] = [];
      for (let i = 0; i < messages.length; i += 10) {
        const batch = messages.slice(i, i + 10);
        const batchResults = await Promise.all(
          batch.map(async (msg: any) => {
            const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
            const detailResp = await fetch(detailUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
            const detail = await detailResp.json() as any;
            const headers = detail.payload?.headers || [];
            const from = headers.find((h: any) => h.name === "From")?.value || "";
            const subject = headers.find((h: any) => h.name === "Subject")?.value || "(sem assunto)";
            const date = headers.find((h: any) => h.name === "Date")?.value || "";
            const snippet = (detail.snippet || "").substring(0, 200);
            const isRead = !((detail.labelIds || []).includes("UNREAD"));
            // Filtrar lista negra
            if (isBlacklisted(from)) return null;
            const classification = classifyInboxEmail(from, subject, snippet);
            return { id: msg.id, from, subject, date, snippet, isRead, ...classification };
          })
        );
        results.push(...batchResults.filter(Boolean));
      }

      const sorted = results.sort((a, b) => {
        // Não lidos primeiro, depois por relevância e score
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        if (a.relevant !== b.relevant) return a.relevant ? -1 : 1;
        return b.score - a.score;
      });
      return input.onlyRelevant ? sorted.filter(e => e.relevant) : sorted;
    }),

  // Contar e-mails não lidos (para badge no menu)
  unreadCount: protectedProcedure
    .query(async () => {
      try {
        const accessToken = await getGmailAccessToken();
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await resp.json() as any;
        return { count: data.messagesUnread || 0 };
      } catch {
        return { count: 0 };
      }
    }),

  // Buscar corpo completo de um e-mail
  getEmailBody: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ input }) => {
      const accessToken = await getGmailAccessToken();
      const message = await getGmailMessage(accessToken, input.messageId);
      const body = extractEmailBody(message);
      const headers = message.payload?.headers || [];
      const from = headers.find((h: any) => h.name === "From")?.value || "";
      const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
      const date = headers.find((h: any) => h.name === "Date")?.value || "";
      return { from, subject, date, body };
    }),
});
