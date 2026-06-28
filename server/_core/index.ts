import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { authRouter } from "../authRoutes";
// INTEGRAÇÃO COM SISTEMA EXTERNO REMOVIDA — tudo é gerido neste projeto
// Job semanal: envio automático do relatório de impacto toda domingo às 18h
import "../jobs/weeklyReport";
// Job semanal: alerta de termos de pesquisa para negativar toda segunda-feira às 8h
import "../jobs/weeklySearchTermsAlert";
// Job horário: negativação automática de termos ruins (a cada hora)
import "../jobs/hourlyAutoNegative";
// Job diário: inteligência competitiva via Auction Insights (todo dia às 6h)
import "../jobs/dailyCompetitiveIntelligence";
// Job horário de integração externa REMOVIDO — não há mais sistema externo
// Job a cada 4 horas: verificação de anomalias em CTR, CPC e conversões
import "../jobs/anomalyAlertCheck";
// Job diário às 8h: sincronização Instagram via MCP + alerta de engajamento < 0,15%
import "../jobs/dailyInstagramSync";
// Job diário às 7h30: diagnóstico automático da campanha GB Zênite + log para diretoria
import "../jobs/dailyGBZeniteDiagnosis";
// Job semanal: relatório executivo para diretoria toda segunda-feira às 8h
import "../jobs/weeklyExecutiveReport";
// Job a cada 2h em horário comercial: realocação automática de orçamento entre grupos
import "../jobs/dynamicBudget";
// Job semanal: previsão de leads com IA toda sexta às 16h
import "../jobs/weeklyLeadPrediction";
// Job mensal: relatórios de performance para clientes todo dia 1 às 9h
import "../jobs/monthlyClientReports";
// Job diário: briefing de voz às 7h45
import "../jobs/dailyVoiceBriefing";
// Job diário: verificação de grupos com CTR < 2% por 7 dias (proposta de pausa automática)
import "../jobs/dailyAutoPauseCheck";
// Job diário (8h30): score de qualidade 0-100 por grupo de anúncios
import "../jobs/dailyAdGroupScore";
// Job a cada 2h (8h-16h): alerta de orçamento diário esgotando (>80% antes das 16h)
import "../jobs/budgetAlertCheck";
// Job semanal (sexta 17h): ROI por produto com e-mail comparativo
import "../jobs/weeklyProductROI";
// Job a cada hora: PageSpeed mobile + desktop para zenitetech.com e zenite.tech
import "../jobs/pageSpeedMonitor";
// Job semanal (segunda 7h30): Account Health Score composto 0-100
import "../jobs/weeklyHealthScore";
// Job diário (9h30): anomalias Meta Ads (alcance, engajamento, seguidores)
import "../jobs/dailyMetaAdsCheck";
// Job diário (8h): alertas de datas sazonais relevantes para campanhas
import "../jobs/seasonalCalendarCheck";
// Job semanal (quarta 10h): sugestão de rotação de headlines RSA via LLM
import "../jobs/weeklyRSARotation";
// Job horário: sincronização de integração com sistemas externos (Instagram Dashboard)
// Job diário (7h): ping automático do sitemap para Google (IndexNow) e Bing
import "../jobs/dailySitemapPing";
// Job a cada 6h: escalação por e-mail de alertas críticos sem reconhecimento há +24h
import "../jobs/criticalAlertEscalation";
// Job mensal (dia 1º às 8h): relatório executivo mensal com métricas reais + PDF + e-mail
import "../jobs/monthlyExecutiveReport";
// Job semanal (sexta 8h): verificar URLs dos anúncios ativos e alertar sobre 404s
import "../jobs/weeklyUrlMonitor";
// Job semanal (segunda 9h30): análise de landing pages + PageSpeed + prompts Lovable
import "../jobs/weeklyLandingPageAnalysis";
// Auto-1: Verificação diária (9h) do whatsapp_click como conversão no Google Ads
import "../jobs/whatsappConversionSyncJob";
// Auto-2,3,4: Alerta orçamento (horário), pausa keywords caras (7h), relatório diário (8h)
import "../jobs/criticalAlertsScheduler";
// Auto-5 a 9: Sync negativos, QS, landing page monitor, relatório por canal, reativação
import "../jobs/mediumPriorityScheduler";
// Auto-10 a 13: Score de lead IA, dayparting, concorrentes, sync leads Sheets
import "../jobs/opportunityScheduler";
// Job diário (8h e 20h): verificação de vinculação GA4 ↔ Google Ads + alerta por e-mail
import "../jobs/ga4LinkCheckJob";

// Job diário (09:30 Brasília): monitoramento de tráfego internacional > 15%
import "../jobs/internationalTrafficMonitorJob";
// Job diário (08:00 Brasília): lembrete de propostas de negativação pendentes
import "../jobs/dailyPendingProposalsJob";
// Job 2x/dia (10:00 e 16:00 BRT): alerta de impressões perdidas por orçamento > 20%
import { scheduleImpressionShareAlert } from "../jobs/impressionShareAlert";
scheduleImpressionShareAlert();
// Job semanal (segunda 08:00 BRT): relatório completo com impression share, otimização, recomendações
import { scheduleWeeklyFullReport } from "../jobs/weeklyFullReport";
scheduleWeeklyFullReport();
// Job diário (07:00 BRT): leitura automática de e-mails do Google Ads via Gmail MCP
import { scheduleDailyGmailAdsReader } from "../jobs/dailyGmailAdsReader";
scheduleDailyGmailAdsReader();
// Job a cada 4h: notificação de leads quentes por e-mail
import "../jobs/hotLeadNotifier";
// Job a cada 4h: sincronização de alertas Gmail (rjll70@gmail.com) + comparação com API Google Ads
import { scheduleGmailAlertSync } from "../jobs/gmailAlertSync";
scheduleGmailAlertSync();
// Job diário às 8h (Brasília): sincronização de dados Google Ads + Instagram + anomalias
import "../jobs/dailySyncData";
// Job a cada 5 minutos: publica rascunhos do Instagram com horário agendado vencido
import { startInstagramScheduler } from "../jobs/instagramSchedulerJob";
startInstagramScheduler();

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Cookie parser — required for reading dash_session cookie in dashboardAuth
  app.use(cookieParser());
  // Auth routes (login/logout/me via Express — avoids tRPC streaming cookie issue)
  app.use("/api/auth", authRouter);
  // Rotas de integração com sistema externo (health check + Instagram sync)
  const { integrationRouter } = await import("../integrationRoutes.js");
  app.use("/api/integration", integrationRouter);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
