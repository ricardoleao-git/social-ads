import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { googleAdsRouter } from "./routers/googleAds";
import { ga4Router } from "./routers/ga4";
import { ga4RealRouter } from "./routers/ga4Real";
import { chartAnnotationsRouter, impactReportsRouter } from "./routers/impactReports";
import { dashboardAuthRouter, dashboardUsersRouter } from "./routers/dashboardAuth";
import { instagramRouter } from "./routers/instagram";
import { automationsRouter } from "./routers/automations";
import { insightsRouter } from "./routers/insights";
import { insightsHistoryRouter } from "./routers/insightsHistory";
import { gbZeniteRouter } from "./routers/gbZenite";
import { aiChatRouter } from "./routers/aiChat";
import { abExperimentsRouter } from "./routers/abExperiments";
import { pageSpeedRouter } from "./routers/pageSpeed";
import { indexingRouter } from "./routers/indexing";
import { searchConsoleRouter } from "./routers/searchConsole";
import { dynamicBudgetRouter } from "./routers/dynamicBudget";
import { whatsappAlertsRouter } from "./routers/whatsappAlerts";
import { leadPredictionRouter } from "./routers/leadPrediction";
import { clientReportRouter } from "./routers/clientReport";
import { voiceBriefingRouter } from "./routers/voiceBriefing";
import { metaAdsRouter } from "./routers/metaAds";
import { userPreferencesRouter, adsCacheRouter } from "./routers/userPreferences";
import { alertHistoryRouter } from "./routers/alertHistory";
import { autoPauseRouter } from "./routers/autoPause";
import { healthScoreRouter } from "./routers/healthScore";
import { adGroupScoresRouter } from "./routers/adGroupScores";
import { productROIRouter } from "./routers/productROI";
import { supplierWhitelistRouter } from "./routers/supplierWhitelist";
import { inAppNotificationsRouter } from "./routers/inAppNotifications";
import { userFeedbackRouter } from "./routers/userFeedback";
import { systemSettingsRouter } from "./routers/systemSettings";
import { gestaoSemanalRouter } from "./routers/gestaoSemanal";
import { jobConfigsRouter } from "./routers/jobConfigs";
import { leadsSheetRouter } from "./routers/leadsSheet";
import { alertEmailConfigRouter } from "./routers/alertEmailConfig";
import { conversionGoalsRouter } from "./routers/conversionGoals";
import { systemHealthRouter } from "./routers/systemHealth";
import { sharedDashboardRouter } from "./routers/sharedDashboard";
import { campaignCreatorRouter } from "./routers/campaignCreator";
import { gmailAlertsRouter } from "./routers/gmailAlerts";
import { metaLeadsRouter } from "./routers/metaLeads";
import { facebookPageRouter } from "./routers/facebookPage";
import { instagramCreatorRouter } from "./routers/instagramCreator";
import { crmLeadsRouter } from "./routers/crmLeads";
import { editorialCalendarRouter } from "./routers/editorialCalendar";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  googleAds: googleAdsRouter,
  ga4: ga4Router,
  ga4Real: ga4RealRouter,
  impactReports: impactReportsRouter,
  chartAnnotations: chartAnnotationsRouter,
  dashboardAuth: dashboardAuthRouter,
  dashboardUsers: dashboardUsersRouter,
  instagram: instagramRouter,
  automations: automationsRouter,
  insights: insightsRouter,
  insightsHistory: insightsHistoryRouter,
  gbZenite: gbZeniteRouter,
  aiChat: aiChatRouter,
  abExperiments: abExperimentsRouter,
  pageSpeed: pageSpeedRouter,
  indexing: indexingRouter,
  searchConsole: searchConsoleRouter,
  dynamicBudget: dynamicBudgetRouter,
  whatsappAlerts: whatsappAlertsRouter,
  leadPrediction: leadPredictionRouter,
  clientReport: clientReportRouter,
  voiceBriefing: voiceBriefingRouter,
  metaAds: metaAdsRouter,
  userPreferences: userPreferencesRouter,
  adsCache: adsCacheRouter,
  alertHistory: alertHistoryRouter,
  autoPause: autoPauseRouter,
  healthScore: healthScoreRouter,
  adGroupScores: adGroupScoresRouter,
  productROI: productROIRouter,
  supplierWhitelist: supplierWhitelistRouter,
  inAppNotifications: inAppNotificationsRouter,
  userFeedback: userFeedbackRouter,
  systemSettings: systemSettingsRouter,
  gestaoSemanal: gestaoSemanalRouter,
  jobConfigs: jobConfigsRouter,
  leadsSheet: leadsSheetRouter,
  alertEmailConfig: alertEmailConfigRouter,
  conversionGoals: conversionGoalsRouter,
  systemHealth: systemHealthRouter,
  sharedDashboard: sharedDashboardRouter,
  campaignCreator: campaignCreatorRouter,
  gmailAlerts: gmailAlertsRouter,
  metaLeads: metaLeadsRouter,
  facebookPage: facebookPageRouter,
  instagramCreator: instagramCreatorRouter,
  crmLeads: crmLeadsRouter,
  editorialCalendar: editorialCalendarRouter,
});

export type AppRouter = typeof appRouter;
