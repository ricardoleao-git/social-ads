import { z } from "zod";
import { desc, eq, gte, sql, and, lt } from "drizzle-orm";
import { execSync } from "child_process";
import { protectedProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { jobRunLogs, systemErrors, alertHistory } from "../../drizzle/schema.js";

// Definição de todos os jobs registrados no sistema com seus metadados
const REGISTERED_JOBS = [
  { name: "anomalyAlertCheck", label: "Alerta de Anomalia", schedule: "A cada 4h (8h–20h)", category: "alertas" },
  { name: "budgetAlertCheck", label: "Alerta de Orçamento", schedule: "A cada 2h (8h–16h)", category: "alertas" },
  { name: "criticalAlertEscalation", label: "Escalação de Alertas Críticos", schedule: "A cada 6h", category: "alertas" },
  { name: "dailyInstagramSync", label: "Sincronização Instagram", schedule: "Diário 8h", category: "social" },
  { name: "dailyGBZeniteDiagnosis", label: "Diagnóstico GB Zênite", schedule: "Diário 7h30", category: "google_ads" },
  { name: "weeklyExecutiveReport", label: "Relatório Executivo Semanal", schedule: "Segunda 8h", category: "relatorios" },
  { name: "dynamicBudget", label: "Orçamento Dinâmico", schedule: "A cada 2h (8h–18h)", category: "google_ads" },
  { name: "weeklyLeadPrediction", label: "Previsão de Leads IA", schedule: "Sexta 16h", category: "ia" },
  { name: "monthlyClientReports", label: "Relatórios Mensais", schedule: "Dia 1 às 9h", category: "relatorios" },
  { name: "dailyVoiceBriefing", label: "Briefing de Voz Diário", schedule: "Diário 7h45", category: "ia" },
  { name: "dailyAutoPauseCheck", label: "Verificação de Pausa Automática", schedule: "Diário 9h", category: "google_ads" },
  { name: "dailyAdGroupScore", label: "Score de Grupos de Anúncios", schedule: "Diário 8h30", category: "google_ads" },
  { name: "weeklyProductROI", label: "ROI por Produto Semanal", schedule: "Sexta 17h", category: "relatorios" },
  { name: "pageSpeedMonitor", label: "Monitor PageSpeed", schedule: "Horário", category: "monitoramento" },
  { name: "weeklyHealthScore", label: "Account Health Score", schedule: "Segunda 7h30", category: "google_ads" },
  { name: "dailyMetaAdsCheck", label: "Verificação Meta Ads", schedule: "Diário 9h30", category: "social" },
  { name: "seasonalCalendarCheck", label: "Calendário Sazonal", schedule: "Diário 8h", category: "alertas" },
  { name: "weeklyRSARotation", label: "Rotação RSA Semanal", schedule: "Quarta 10h", category: "google_ads" },
  { name: "dailySitemapPing", label: "Ping Sitemap Diário", schedule: "Diário 7h", category: "seo" },
  { name: "monthlyExecutiveReport", label: "Relatório Executivo Mensal", schedule: "Dia 1 às 8h", category: "relatorios" },
  { name: "weeklyUrlMonitor", label: "Monitor de URLs Semanal", schedule: "Sexta 8h", category: "monitoramento" },
  { name: "weeklyLandingPageAnalysis", label: "Análise de Landing Pages", schedule: "Segunda 9h30", category: "seo" },
  { name: "whatsappConversionSyncJob", label: "Sync Conversão WhatsApp", schedule: "Diário 9h", category: "google_ads" },
  { name: "criticalAlertsScheduler", label: "Scheduler de Alertas Críticos", schedule: "Múltiplos horários", category: "alertas" },
  { name: "mediumPriorityScheduler", label: "Scheduler Prioridade Média", schedule: "Múltiplos horários", category: "google_ads" },
  { name: "opportunityScheduler", label: "Scheduler de Oportunidades", schedule: "Múltiplos horários", category: "ia" },
];

export const systemHealthRouter = router({
  // Retorna o status de todos os jobs com último disparo e resultado
  getJobsStatus: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { jobs: REGISTERED_JOBS.map(j => ({ ...j, lastRun: null, lastStatus: "unknown", lastMessage: null })) };

    // Buscar o último log de cada job
    const recentLogs = await db
      .select()
      .from(jobRunLogs)
      .orderBy(desc(jobRunLogs.executedAt))
      .limit(200);

    // Mapear último log por job
    const logsByJob = new Map<string, typeof recentLogs[0]>();
    for (const log of recentLogs) {
      if (!logsByJob.has(log.jobName)) {
        logsByJob.set(log.jobName, log);
      }
    }

    return {
      jobs: REGISTERED_JOBS.map(job => {
        const lastLog = logsByJob.get(job.name);
        return {
          ...job,
          lastRun: lastLog?.executedAt ?? null,
          lastStatus: lastLog?.status ?? "never",
          lastMessage: lastLog?.message ?? null,
          durationMs: lastLog?.durationMs ?? null,
        };
      }),
    };
  }),

  // Retorna os últimos 10 erros do sistema
  getSystemErrors: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { errors: [] };

    const errors = await db
      .select()
      .from(systemErrors)
      .orderBy(desc(systemErrors.occurredAt))
      .limit(10);

    return { errors };
  }),

  // Retorna estatísticas gerais dos jobs (total, sucesso, erro, últimas 24h)
  getHealthStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalJobs: REGISTERED_JOBS.length, successLast24h: 0, errorLast24h: 0, totalErrors: 0 };

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [successCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobRunLogs)
      .where(sql`${jobRunLogs.executedAt} >= ${since24h} AND ${jobRunLogs.status} = 'success'`);

    const [errorCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobRunLogs)
      .where(sql`${jobRunLogs.executedAt} >= ${since24h} AND ${jobRunLogs.status} = 'error'`);

    const [totalErrors] = await db
      .select({ count: sql<number>`count(*)` })
      .from(systemErrors);

    return {
      totalJobs: REGISTERED_JOBS.length,
      successLast24h: Number(successCount?.count ?? 0),
      errorLast24h: Number(errorCount?.count ?? 0),
      totalErrors: Number(totalErrors?.count ?? 0),
    };
  }),

  // Retorna taxa de sucesso por hora nas últimas 24h para o gráfico de linha
  getSuccessRateHistory: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { history: [] };

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const logs = await db
      .select()
      .from(jobRunLogs)
      .where(sql`${jobRunLogs.executedAt} >= ${since24h}`)
      .orderBy(jobRunLogs.executedAt);

    // Agrupar por hora
    const byHour: Record<string, { success: number; error: number }> = {};
    for (const log of logs) {
      const hour = new Date(log.executedAt).toISOString().slice(0, 13) + ":00";
      if (!byHour[hour]) byHour[hour] = { success: 0, error: 0 };
      if (log.status === "success") byHour[hour].success++;
      else byHour[hour].error++;
    }

    // Preencher todas as horas das últimas 24h
    const history: Array<{ hour: string; successRate: number; total: number }> = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.now() - i * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 13) + ":00";
      const label = `${String(d.getHours()).padStart(2, "0")}h`;
      const bucket = byHour[key];
      const total = bucket ? bucket.success + bucket.error : 0;
      const successRate = total > 0 ? Math.round((bucket!.success / total) * 100) : null;
      history.push({ hour: label, successRate: successRate as any, total });
    }

    return { history };
  }),

  // Verifica jobs críticos com 2 falhas consecutivas e envia alerta por e-mail
  checkConsecutiveFailures: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { alerted: [] };

    const since2h = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const alerted: string[] = [];

    for (const job of REGISTERED_JOBS) {
      // Buscar os 2 últimos logs do job
      const lastTwo = await db
        .select()
        .from(jobRunLogs)
        .where(eq(jobRunLogs.jobName, job.name))
        .orderBy(desc(jobRunLogs.executedAt))
        .limit(2);

      if (lastTwo.length === 2 && lastTwo[0].status === "error" && lastTwo[1].status === "error") {
        // 2 falhas consecutivas — enviar alerta por e-mail
        const { getAlertEmails } = await import("../helpers/getAlertEmails.js");
        const recipients = await getAlertEmails();

        if (recipients.length > 0) {
          try {
            const subject = `🚨 Job Crítico com 2 Falhas Consecutivas: ${job.label}`;
            const body = `O job "${job.label}" (${job.name}) falhou 2 vezes consecutivas.\n\nÚltimo erro: ${lastTwo[0].message ?? "sem mensagem"}\nHorário: ${new Date(lastTwo[0].executedAt).toLocaleString("pt-BR")}\n\nAcesse o painel: https://social-ads.zenitetech.com/admin/status`;

            for (const to of recipients) {
              const payload = JSON.stringify({ to, subject, body });
              execSync(`manus-mcp-cli tool call send_email --server gmail --input '${payload.replace(/'/g, "'\\''")}' 2>/dev/null`, { timeout: 15000 });
            }
            alerted.push(job.name);
          } catch (_) {
            // silently fail — não bloquear o painel
          }
        }
      }
    }

    return { alerted };
  }),

  // Verifica status das APIs externas (Google Ads, GA4, Instagram)
  checkApiStatus: protectedProcedure.query(async () => {
    const results: Array<{ api: string; status: "ok" | "error" | "unknown"; latencyMs?: number; message?: string }> = [];

    // Google Ads
    try {
      const start = Date.now();
      const { getGoogleAdsClient } = await import("../googleAdsClient.js");
      const client = getGoogleAdsClient();
      if (client) {
        results.push({ api: "Google Ads", status: "ok", latencyMs: Date.now() - start, message: "Credenciais configuradas" });
      } else {
        results.push({ api: "Google Ads", status: "error", message: "Cliente não inicializado" });
      }
    } catch (err: any) {
      results.push({ api: "Google Ads", status: "error", message: err?.message ?? "Erro desconhecido" });
    }

    // GA4
    try {
      const ga4Key = process.env.GA4_SERVICE_ACCOUNT_JSON;
      const ga4Prop = process.env.GA4_PROPERTY_ID;
      if (ga4Key && ga4Prop) {
        results.push({ api: "GA4 Analytics", status: "ok", message: `Property ${ga4Prop} configurada` });
      } else {
        results.push({ api: "GA4 Analytics", status: "error", message: "GA4_SERVICE_ACCOUNT_JSON ou GA4_PROPERTY_ID não configurados" });
      }
    } catch (err: any) {
      results.push({ api: "GA4 Analytics", status: "error", message: err?.message ?? "Erro desconhecido" });
    }

    // Instagram MCP (verifica se há dados recentes na tabela alert_history)
    try {
      const db = await getDb();
      if (db) {
        const [recent] = await db
          .select({ count: sql<number>`count(*)` })
          .from(alertHistory)
          .where(sql`${alertHistory.type} = 'instagram' AND ${alertHistory.createdAt} >= ${new Date(Date.now() - 48 * 60 * 60 * 1000)}`);
        const count = Number(recent?.count ?? 0);
        results.push({
          api: "Instagram MCP",
          status: count > 0 ? "ok" : "unknown",
          message: count > 0 ? `${count} alertas nas últimas 48h` : "Sem dados recentes (normal se não houve alertas)",
        });
      } else {
        results.push({ api: "Instagram MCP", status: "unknown", message: "Banco indisponível" });
      }
    } catch (err: any) {
      results.push({ api: "Instagram MCP", status: "error", message: err?.message ?? "Erro desconhecido" });
    }

    // Gmail MCP (verifica variável de ambiente)
    const gmailConfigured = !!process.env.BUILT_IN_FORGE_API_KEY;
    results.push({
      api: "Gmail MCP",
      status: gmailConfigured ? "ok" : "error",
      message: gmailConfigured ? "API Key configurada" : "BUILT_IN_FORGE_API_KEY não configurado",
    });

    return { apis: results };
  }),
});
