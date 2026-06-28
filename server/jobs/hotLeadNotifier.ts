/**
 * hotLeadNotifier.ts
 * Verifica leads a cada 4 horas e envia alerta TRIPLO quando detecta leads QUENTES:
 * 1. E-mail urgente via Gmail MCP (prioridade alta)
 * 2. WhatsApp via serviço configurado (Evolution API / Twilio)
 * 3. Push notification via Manus notifyOwner
 *
 * Evita notificações duplicadas mantendo um cache de leads já notificados.
 */
import cron from "node-cron";
import { execSync } from "child_process";
import { google } from "googleapis";
import { getAlertEmails } from "../helpers/getAlertEmails";
import { notifyOwner } from "../_core/notification";
import { sendWhatsAppAlert } from "../whatsappService";

const SPREADSHEET_ID = "1xlYXBfgab0BzkjELK6Rx-fuUL3kNqlqV93tZns9sIsw";
const DASHBOARD_URL = "https://social-ads.zenitetech.com";

// Cache de leads já notificados (evita spam)
const notifiedLeadKeys = new Set<string>();

async function getSheetsClient() {
  const serviceAccountJson = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error("GA4_SERVICE_ACCOUNT_JSON não configurado");
  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

function classifyLead(lead: any): { score: number; qualification: string; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Quantidade de conversões
  if (lead.quantidade >= 3) { score += 3; reasons.push("Alta quantidade de conversões"); }
  else if (lead.quantidade >= 2) { score += 2; reasons.push("Múltiplas conversões"); }
  else if (lead.quantidade >= 1) { score += 1; reasons.push("Pelo menos 1 conversão"); }

  // CPA baixo = melhor qualidade
  const cpaVal = parseFloat((lead.cpa || "0").replace("R$", "").replace(",", "."));
  if (cpaVal > 0 && cpaVal < 5) { score += 2; reasons.push("CPA muito baixo (< R$5)"); }
  else if (cpaVal > 0 && cpaVal < 15) { score += 1; reasons.push("CPA moderado"); }

  // Keyword relevance (B2B terms)
  const kw = (lead.keyword || "").toLowerCase();
  const hotTerms = ["empresa", "comercial", "corporativo", "condomínio", "escola", "indústria", "comprar", "orçamento", "preço", "contratar"];
  const coldTerms = ["como", "o que é", "grátis", "gratuito", "tutorial", "curso"];
  if (hotTerms.some(t => kw.includes(t))) { score += 2; reasons.push("Keyword com intenção comercial"); }
  if (coldTerms.some(t => kw.includes(t))) { score -= 1; reasons.push("Keyword informacional"); }

  // Campanha relevance
  const camp = (lead.campanha || "").toLowerCase();
  if (camp.includes("lead") || camp.includes("pesquisa")) { score += 1; reasons.push("Campanha de leads"); }

  // Dispositivo (desktop geralmente é mais B2B)
  if ((lead.dispositivo || "").toLowerCase().includes("desktop") || (lead.dispositivo || "").toLowerCase().includes("computer")) {
    score += 1; reasons.push("Desktop (perfil B2B)");
  }

  let qualification: string;
  if (score >= 5) qualification = "quente";
  else if (score >= 3) qualification = "morno";
  else qualification = "frio";

  return { score, qualification, reasons };
}

async function checkHotLeads() {
  const prefix = "[HotLeadNotifier]";
  console.log(`${prefix} Verificando leads quentes...`);

  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Leads!A:H",
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      console.log(`${prefix} Nenhum lead encontrado na planilha.`);
      return;
    }

    const dataRows = rows.slice(1);
    const leads = dataRows.map((row, idx) => ({
      id: idx + 1,
      data: row[0] || "",
      campanha: row[1] || "",
      grupo: row[2] || "",
      conversao: row[3] || "",
      quantidade: parseInt(row[4] || "0"),
      cpa: row[5] || "",
      dispositivo: row[6] || "",
      keyword: row[7] || "",
    }));

    // Classify and filter hot leads
    const hotLeads = leads
      .map(lead => {
        const { score, qualification, reasons } = classifyLead(lead);
        return { ...lead, score, qualification, reasons };
      })
      .filter(l => l.qualification === "quente");

    // Filter out already notified leads
    const newHotLeads = hotLeads.filter(l => {
      const key = `${l.data}-${l.campanha}-${l.grupo}-${l.keyword}`;
      return !notifiedLeadKeys.has(key);
    });

    if (newHotLeads.length === 0) {
      console.log(`${prefix} Nenhum lead quente novo detectado (${hotLeads.length} já notificados).`);
      return;
    }

    console.log(`${prefix} ${newHotLeads.length} lead(s) quente(s) novo(s) detectado(s)!`);

    const nowStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CANAL 1: E-mail urgente via Gmail MCP
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const recipients = await getAlertEmails();
    const subject = `🔥 URGENTE: ${newHotLeads.length} Lead(s) Quente(s) — Responder em até 1h`;

    let emailContent = `⚡ ALERTA URGENTE DE LEADS QUENTES — Zênite Tech\n`;
    emailContent += `Detectados em: ${nowStr}\n`;
    emailContent += `Tempo máximo de resposta: 1 HORA\n\n`;
    emailContent += `${newHotLeads.length} lead(s) classificado(s) como QUENTE (score >= 5):\n\n`;

    for (const lead of newHotLeads) {
      emailContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      emailContent += `🔥 LEAD QUENTE (Score: ${lead.score})\n`;
      emailContent += `Data: ${lead.data}\n`;
      emailContent += `Campanha: ${lead.campanha}\n`;
      emailContent += `Grupo: ${lead.grupo}\n`;
      emailContent += `Keyword: ${lead.keyword}\n`;
      emailContent += `Conversões: ${lead.quantidade}\n`;
      emailContent += `CPA: ${lead.cpa}\n`;
      emailContent += `Dispositivo: ${lead.dispositivo}\n`;
      emailContent += `Motivos: ${lead.reasons.join(", ")}\n\n`;
    }

    emailContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    emailContent += `AÇÃO RECOMENDADA:\n`;
    emailContent += `- Entrar em contato em até 1 hora para maximizar conversão\n`;
    emailContent += `- Priorizar leads com maior score e keyword comercial\n`;
    emailContent += `- Ver qualificação completa: ${DASHBOARD_URL}/qualificacao-leads\n\n`;
    emailContent += `Total de leads quentes na base: ${hotLeads.length}\n`;
    emailContent += `Novos nesta verificação: ${newHotLeads.length}\n`;

    const emailPayload = JSON.stringify({
      messages: [{
        to: recipients,
        subject,
        content: emailContent,
      }],
    });

    try {
      execSync(
        `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${emailPayload.replace(/'/g, "'\"'\"'")}'`,
        { timeout: 30000 }
      );
      console.log(`${prefix} ✅ E-mail urgente enviado para ${recipients.join(", ")}.`);
    } catch (emailErr: any) {
      console.error(`${prefix} ❌ Erro ao enviar e-mail:`, emailErr?.message ?? emailErr);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CANAL 2: WhatsApp via serviço configurado (Evolution API / Twilio)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    try {
      const topLead = newHotLeads[0];
      const whatsappMsg = `🔥 *LEAD QUENTE DETECTADO*\n\n` +
        `📊 *${newHotLeads.length} lead(s)* com score >= 5\n\n` +
        `🏆 Principal:\n` +
        `• Keyword: ${topLead.keyword}\n` +
        `• Campanha: ${topLead.campanha}\n` +
        `• Score: ${topLead.score}\n` +
        `• Conversões: ${topLead.quantidade}\n\n` +
        `⏰ *Responder em até 1 hora!*\n\n` +
        `📱 Ver detalhes:\n${DASHBOARD_URL}/qualificacao-leads`;

      const waResult = await sendWhatsAppAlert({
        type: "hot_lead",
        message: whatsappMsg,
        adGroupName: topLead.grupo,
        metricValue: `Score ${topLead.score}`,
      });

      if (waResult.success) {
        console.log(`${prefix} ✅ WhatsApp enviado com sucesso.`);
      } else {
        console.log(`${prefix} ⚠️ WhatsApp não enviado (${waResult.status}): ${waResult.error ?? "sem detalhes"}`);
      }
    } catch (waErr: any) {
      console.error(`${prefix} ❌ Erro ao enviar WhatsApp:`, waErr?.message ?? waErr);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CANAL 3: Push notification via Manus
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    try {
      await notifyOwner({
        title: `🔥 ${newHotLeads.length} Lead(s) Quente(s) — Responder em 1h`,
        content: newHotLeads
          .map(l => `• ${l.keyword} (${l.campanha}) — Score ${l.score}, ${l.quantidade} conv.`)
          .join("\n"),
      });
      console.log(`${prefix} ✅ Push Manus enviado.`);
    } catch (pushErr: any) {
      console.error(`${prefix} ❌ Erro push Manus:`, pushErr?.message ?? pushErr);
    }

    // Mark as notified
    for (const lead of newHotLeads) {
      const key = `${lead.data}-${lead.campanha}-${lead.grupo}-${lead.keyword}`;
      notifiedLeadKeys.add(key);
    }

    console.log(`${prefix} Notificação tripla concluída: ${newHotLeads.length} lead(s) quente(s).`);

  } catch (err: any) {
    console.error(`${prefix} Erro:`, err?.message ?? err);
  }
}

// Run every 4 hours: 8h, 12h, 16h, 20h BRT
cron.schedule("0 0 11,15,19,23 * * *", checkHotLeads, {
  timezone: "America/Sao_Paulo",
});

console.log("[HotLeadNotifier] Agendado: verificação de leads quentes a cada 4h (8h, 12h, 16h, 20h BRT) — notificação tripla (E-mail + WhatsApp + Push).");

export { checkHotLeads };
