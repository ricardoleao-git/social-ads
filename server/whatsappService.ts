/**
 * WhatsApp Alert Service
 * Suporta Evolution API (self-hosted) e Twilio WhatsApp API.
 * Rate limit: máximo 10 mensagens por hora.
 * Quiet hours: não envia entre 22h e 7h (horário de Brasília).
 */

import { getDb } from "./db";
import { whatsappAlerts, whatsappConfig } from "../drizzle/schema";
import { desc, gte, sql } from "drizzle-orm";

const DASHBOARD_URL = "https://social-ads.zenitetech.com";

// Verifica se está em horário de silêncio (Brasília = UTC-3)
function isQuietHours(start: number, end: number): boolean {
  const now = new Date();
  // UTC-3
  const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
  if (start > end) {
    // Crosses midnight: e.g., 22h–7h
    return brasiliaHour >= start || brasiliaHour < end;
  }
  return brasiliaHour >= start && brasiliaHour < end;
}

// Conta mensagens enviadas na última hora
async function countRecentMessages(db: Awaited<ReturnType<typeof getDb>>): Promise<number> {
  if (!db) return 0;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(whatsappAlerts)
    .where(gte(whatsappAlerts.createdAt, oneHourAgo));
  return rows[0]?.count ?? 0;
}

// Envia via Evolution API
async function sendViaEvolutionApi(
  apiUrl: string,
  instanceName: string,
  apiKey: string,
  to: string,
  message: string
): Promise<void> {
  const url = `${apiUrl}/message/sendText/${instanceName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({
      number: to,
      text: message,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API error ${res.status}: ${body}`);
  }
}

// Envia via Twilio WhatsApp
async function sendViaTwilio(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  message: string
): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({
    From: `whatsapp:${from}`,
    To: `whatsapp:${to}`,
    Body: message,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twilio error ${res.status}: ${body}`);
  }
}

export interface WhatsAppAlertPayload {
  type: "ctr_drop" | "cpc_spike" | "anomaly" | "test" | "hot_lead" | "budget_alert";
  adGroupName?: string;
  metricValue?: string;
  message: string;
}

/**
 * Envia um alerta WhatsApp, respeitando rate limit e quiet hours.
 * Registra o envio na tabela whatsapp_alerts.
 */
export async function sendWhatsAppAlert(payload: WhatsAppAlertPayload): Promise<{
  success: boolean;
  status: "sent" | "failed" | "rate_limited" | "quiet_hours";
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { success: false, status: "failed", error: "Database not available" };

  // Buscar configuração
  const configs = await db.select().from(whatsappConfig).limit(1);
  const config = configs[0];

  if (!config || !config.enabled || !config.phoneNumber) {
    return { success: false, status: "failed", error: "WhatsApp não configurado ou desabilitado" };
  }

  // Verificar quiet hours
  if (isQuietHours(config.quietHoursStart, config.quietHoursEnd)) {
    await db.insert(whatsappAlerts).values({
      type: payload.type,
      toNumber: config.phoneNumber,
      message: payload.message,
      dashboardLink: DASHBOARD_URL,
      status: "quiet_hours",
      adGroupName: payload.adGroupName,
      metricValue: payload.metricValue,
    });
    return { success: false, status: "quiet_hours" };
  }

  // Verificar rate limit
  const recentCount = await countRecentMessages(db);
  if (recentCount >= config.maxPerHour) {
    await db.insert(whatsappAlerts).values({
      type: payload.type,
      toNumber: config.phoneNumber,
      message: payload.message,
      dashboardLink: DASHBOARD_URL,
      status: "rate_limited",
      adGroupName: payload.adGroupName,
      metricValue: payload.metricValue,
    });
    return { success: false, status: "rate_limited" };
  }

  // Tentar enviar
  try {
    if (config.provider === "evolution_api" && config.apiUrl && config.instanceName) {
      const apiKey = (config as any).apiKey ?? process.env.EVOLUTION_API_KEY ?? "";
      if (!apiKey) throw new Error("API Key da Evolution API não configurada");
      await sendViaEvolutionApi(config.apiUrl, config.instanceName, apiKey, config.phoneNumber, payload.message);
    } else if (config.provider === "twilio") {
      const accountSid = (config as any).twilioAccountSid ?? process.env.TWILIO_ACCOUNT_SID ?? "";
      const authToken = (config as any).twilioAuthToken ?? process.env.TWILIO_AUTH_TOKEN ?? "";
      const from = (config as any).twilioWhatsappFrom ?? process.env.TWILIO_WHATSAPP_FROM ?? "";
      if (!accountSid || !authToken) throw new Error("Credenciais Twilio não configuradas");
      await sendViaTwilio(accountSid, authToken, from, config.phoneNumber, payload.message);
    } else {
      throw new Error("Provedor não configurado corretamente");
    }

    await db.insert(whatsappAlerts).values({
      type: payload.type,
      toNumber: config.phoneNumber,
      message: payload.message,
      dashboardLink: DASHBOARD_URL,
      status: "sent",
      adGroupName: payload.adGroupName,
      metricValue: payload.metricValue,
    });
    return { success: true, status: "sent" };
  } catch (err: any) {
    const errorMsg = err?.message ?? "Erro desconhecido";
    await db.insert(whatsappAlerts).values({
      type: payload.type,
      toNumber: config.phoneNumber,
      message: payload.message,
      dashboardLink: DASHBOARD_URL,
      status: "failed",
      errorMessage: errorMsg,
      adGroupName: payload.adGroupName,
      metricValue: payload.metricValue,
    });
    return { success: false, status: "failed", error: errorMsg };
  }
}

/**
 * Formata a mensagem padrão de alerta Zênite Tech.
 */
export function formatAlertMessage(params: {
  adGroupName: string;
  problem: string;
  time: string;
}): string {
  return `🔴 ALERTA Zênite Tech
Grupo: ${params.adGroupName}
Problema: ${params.problem}
Horário: ${params.time}
Ver no dashboard: ${DASHBOARD_URL}`;
}

/**
 * Busca histórico de alertas WhatsApp.
 */
export async function getWhatsAppHistory(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(whatsappAlerts).orderBy(desc(whatsappAlerts.createdAt)).limit(limit);
}

/**
 * Busca configuração atual.
 */
export async function getWhatsAppConfig() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(whatsappConfig).limit(1);
  return rows[0] ?? null;
}
