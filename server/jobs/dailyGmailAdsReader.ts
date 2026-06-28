/**
 * dailyGmailAdsReader.ts
 * Job diário que lê e-mails do Google Ads via Gmail MCP,
 * extrai recomendações/alertas e armazena no banco de dados.
 * Executa diariamente às 07:00 BRT (10:00 UTC).
 */
import cron from "node-cron";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getAlertEmails } from "../helpers/getAlertEmails";

// ─── Types ──────────────────────────────────────────────────────────────────
interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body?: string;
}

interface ExtractedInsight {
  type: "recommendation" | "alert" | "performance" | "policy" | "info";
  title: string;
  summary: string;
  actionRequired: boolean;
  priority: "high" | "medium" | "low";
  originalEmailId: string;
  originalSubject: string;
}

// ─── Ensure table exists ────────────────────────────────────────────────────
async function ensureGmailInsightsTable() {
    const db = await getDb();
    if (!db) {
      console.error("[GmailAdsReader] Database not available");
      return;
    }
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS gmail_ads_insights (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email_id VARCHAR(255) NOT NULL,
      thread_id VARCHAR(255),
      type VARCHAR(50) NOT NULL DEFAULT 'info',
      title VARCHAR(500) NOT NULL,
      summary TEXT NOT NULL,
      action_required BOOLEAN DEFAULT FALSE,
      priority VARCHAR(20) DEFAULT 'low',
      original_subject VARCHAR(500),
      original_date DATETIME,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_status BOOLEAN DEFAULT FALSE,
      UNIQUE KEY unique_email (email_id)
    )
  `);
}

// ─── Gmail MCP Integration ──────────────────────────────────────────────────
async function searchGmailAdsEmails(): Promise<GmailEmail[]> {
  const { execSync } = await import("child_process");
  
  // Search for Google Ads emails from the last 2 days
  const searchQuery = "from:ads-noreply@google.com OR from:google-ads-noreply@google.com OR from:adwords-noreply@google.com OR from:ads-account-noreply@google.com OR from:noreply-analytics@google.com newer_than:2d";
  
  try {
    const searchResult = execSync(
      `manus-mcp-cli tool call gmail_search_messages --server gmail --input '${JSON.stringify({ q: searchQuery, max_results: 20 })}'`,
      { encoding: "utf-8", timeout: 30000 }
    );
    
    // Parse the saved result file
    const fileMatch = searchResult.match(/saved to:\s*(.+\.json)/);
    if (!fileMatch) {
      console.log("[GmailAdsReader] No result file found from search");
      return [];
    }
    
    const fs = await import("fs");
    const resultData = JSON.parse(fs.readFileSync(fileMatch[1], "utf-8"));
    
    if (!resultData?.success || !resultData?.result) {
      console.log("[GmailAdsReader] No emails found");
      return [];
    }

    // Extract email data from the result
    const emails: GmailEmail[] = [];
    const messages = Array.isArray(resultData.result) ? resultData.result : [resultData.result];
    
    for (const msg of messages) {
      if (msg.messages) {
        for (const m of msg.messages) {
          emails.push({
            id: m.id || m.messageId || "",
            threadId: m.threadId || "",
            subject: m.subject || "",
            from: m.from || "",
            date: m.date || m.internalDate || "",
            snippet: m.snippet || "",
            body: m.pickedPlainContent || m.body || m.snippet || "",
          });
        }
      } else if (msg.id) {
        emails.push({
          id: msg.id || msg.messageId || "",
          threadId: msg.threadId || "",
          subject: msg.subject || "",
          from: msg.from || "",
          date: msg.date || "",
          snippet: msg.snippet || "",
          body: msg.pickedPlainContent || msg.body || msg.snippet || "",
        });
      }
    }
    
    return emails;
  } catch (error: any) {
    console.error("[GmailAdsReader] Error searching Gmail:", error?.message);
    return [];
  }
}

// ─── LLM Analysis ───────────────────────────────────────────────────────────
async function analyzeEmailWithLLM(email: GmailEmail): Promise<ExtractedInsight | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Você é um analista de Google Ads. Analise o e-mail abaixo e extraia a informação principal.
Responda APENAS em JSON válido com esta estrutura:
{
  "type": "recommendation" | "alert" | "performance" | "policy" | "info",
  "title": "Título curto e descritivo (max 80 chars)",
  "summary": "Resumo executivo da mensagem em 2-3 frases",
  "actionRequired": true/false,
  "priority": "high" | "medium" | "low"
}

Critérios:
- "recommendation": e-mails com sugestões de melhoria (recursos, lances, campanhas)
- "alert": problemas urgentes (reprovações, suspensões, orçamento)
- "performance": relatórios de desempenho (conversões, cliques, impressões)
- "policy": questões de política do Google Ads
- "info": informações gerais (vinculações, atualizações)

Prioridade:
- "high": ação urgente necessária (reprovação, suspensão, queda brusca)
- "medium": recomendação com impacto significativo
- "low": informação geral ou sugestão menor`
        },
        {
          role: "user",
          content: `Assunto: ${email.subject}\nDe: ${email.from}\nData: ${email.date}\n\nConteúdo:\n${(email.body || email.snippet).slice(0, 2000)}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["recommendation", "alert", "performance", "policy", "info"] },
              title: { type: "string" },
              summary: { type: "string" },
              actionRequired: { type: "boolean" },
              priority: { type: "string", enum: ["high", "medium", "low"] }
            },
            required: ["type", "title", "summary", "actionRequired", "priority"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    return {
      ...parsed,
      originalEmailId: email.id,
      originalSubject: email.subject,
    };
  } catch (error: any) {
    console.error("[GmailAdsReader] LLM analysis error:", error?.message);
    return null;
  }
}

// ─── Main Job ───────────────────────────────────────────────────────────────
async function runGmailAdsReader() {
  console.log("[GmailAdsReader] Iniciando leitura de e-mails do Google Ads...");
  
  try {
    await ensureGmailInsightsTable();
    
    const db = await getDb();
    if (!db) {
      console.error("[GmailAdsReader] Database not available");
      return;
    }
    
    // 1. Search emails
    const emails = await searchGmailAdsEmails();
    console.log(`[GmailAdsReader] ${emails.length} e-mails encontrados`);
    
    if (emails.length === 0) {
      console.log("[GmailAdsReader] Nenhum e-mail novo para processar");
      return;
    }
    
    // 2. Check which emails are already processed
    const existingIds = await db.execute(sql`
      SELECT email_id FROM gmail_ads_insights
    `) as any;
    const processedIds = new Set((existingIds as any[]).map((r: any) => r.email_id));
    
    const newEmails = emails.filter(e => !processedIds.has(e.id));
    console.log(`[GmailAdsReader] ${newEmails.length} e-mails novos para processar`);
    
    if (newEmails.length === 0) {
      console.log("[GmailAdsReader] Todos os e-mails já foram processados");
      return;
    }
    
    // 3. Analyze each email with LLM
    const insights: ExtractedInsight[] = [];
    for (const email of newEmails.slice(0, 10)) { // Limit to 10 per run
      const insight = await analyzeEmailWithLLM(email);
      if (insight) {
        insights.push(insight);
        
        // Save to database
        await db!.execute(sql`
          INSERT IGNORE INTO gmail_ads_insights 
          (email_id, thread_id, type, title, summary, action_required, priority, original_subject, original_date)
          VALUES (
            ${email.id},
            ${email.threadId},
            ${insight.type},
            ${insight.title},
            ${insight.summary},
            ${insight.actionRequired},
            ${insight.priority},
            ${email.subject},
            ${new Date(Number(email.date) || Date.now())}
          )
        `);
      }
    }
    
    console.log(`[GmailAdsReader] ${insights.length} insights extraídos e salvos`);
    
    // 4. Send summary email if there are high-priority items
    const highPriority = insights.filter(i => i.priority === "high" || i.actionRequired);
    if (highPriority.length > 0) {
      const alertEmails = await getAlertEmails();
      if (alertEmails.length > 0) {
        const insightsList = highPriority.map(i => 
          `• [${i.type.toUpperCase()}] ${i.title}\n  ${i.summary}`
        ).join("\n\n");
        
        const { execSync } = await import("child_process");
        const emailContent = `Leitura automática de e-mails do Google Ads\nData: ${new Date().toLocaleDateString("pt-BR")}\nE-mails analisados: ${newEmails.length}\nAlertas de alta prioridade: ${highPriority.length}\n\nALERTAS:\n${insightsList}\n\nAcesse o dashboard para mais detalhes: https://social-ads.zenitetech.com/gmail-insights`;
        const payload = JSON.stringify({
          messages: [{
            to: alertEmails,
            subject: `⚠️ ${highPriority.length} alerta(s) do Google Ads detectado(s)`,
            content: emailContent
          }]
        });
        try {
          execSync(
            `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${payload.replace(/'/g, "'\"'\"'")}'`,
            { timeout: 30000 }
          );
        } catch (emailErr: any) {
          console.error("[GmailAdsReader] Erro ao enviar e-mail:", emailErr?.message);
        }
        console.log(`[GmailAdsReader] E-mail de alerta enviado para ${alertEmails.length} destinatário(s)`);
      }
    }
    
    console.log("[GmailAdsReader] Concluído com sucesso");
  } catch (error: any) {
    console.error("[GmailAdsReader] Erro:", error?.message ?? error);
  }
}

// ─── Schedule ───────────────────────────────────────────────────────────────
export function scheduleDailyGmailAdsReader() {
  // Run daily at 07:00 BRT (10:00 UTC)
  cron.schedule("0 10 * * *", () => {
    runGmailAdsReader().catch(err => console.error("[GmailAdsReader] Erro no job:", err));
  });
  console.log("[GmailAdsReader] Agendado para 07:00 BRT (10:00 UTC) diariamente.");
}

export { runGmailAdsReader };
