import { boolean, datetime, decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, tinyint, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// TODO: Add your tables here

/**
 * Audit log for negative keyword additions made via the dashboard.
 * Tracks every negative keyword added through the UI for historical analysis.
 */
export const negativeKeywordHistory = mysqlTable("negative_keyword_history", {
  id: int("id").autoincrement().primaryKey(),
  /** The negative keyword text */
  text: varchar("text", { length: 255 }).notNull(),
  /** Match type: EXACT, PHRASE, or BROAD */
  matchType: varchar("matchType", { length: 20 }).notNull(),
  /** Level: campaign or ad_group */
  level: varchar("level", { length: 20 }).notNull(),
  /** Campaign ID where the negative was added */
  campaignId: varchar("campaignId", { length: 64 }).notNull(),
  /** Campaign name for display */
  campaignName: varchar("campaignName", { length: 255 }),
  /** Ad group ID (only for ad_group level) */
  adGroupId: varchar("adGroupId", { length: 64 }),
  /** Ad group name for display */
  adGroupName: varchar("adGroupName", { length: 255 }),
  /** Whether the addition was successful */
  success: int("success").default(1).notNull(),
  /** Error message if failed */
  errorMessage: text("errorMessage"),
  /** Reason for adding this negative keyword */
  reason: varchar("reason", { length: 255 }),
  /** Whether this negative has been reviewed and confirmed by the user */
  confirmed: boolean("confirmed").default(false).notNull(),
  /** When this negative was added */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** When this record was last updated */
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type NegativeKeywordHistory = typeof negativeKeywordHistory.$inferSelect;
export type InsertNegativeKeywordHistory = typeof negativeKeywordHistory.$inferInsert;

/**
 * Stores each optimization session report for the /impact-report dashboard.
 * Each row represents one optimization session (e.g., 04/04/2026).
 */
export const impactReports = mysqlTable("impact_reports", {
  id: int("id").autoincrement().primaryKey(),
  /** Display date string, e.g. '04/04/2026' */
  data: varchar("data", { length: 20 }).notNull().unique(),
  /** Total negative keywords added in this session */
  negativos: int("negativos").notNull().default(0),
  /** Total ad URLs corrected */
  urlsCorrigidas: int("urls_corrigidas").notNull().default(0),
  /** Total extensions created (sitelinks + callouts) */
  extensoes: int("extensoes").notNull().default(0),
  /** Minimum estimated monthly savings in BRL */
  economiaMin: int("economia_min").notNull().default(0),
  /** Maximum estimated monthly savings in BRL */
  economiaMax: int("economia_max").notNull().default(0),
  /** Current average CTR at time of report */
  ctrAtual: decimal("ctr_atual", { precision: 5, scale: 2 }).notNull(),
  /** Current average CPC at time of report */
  cpcAtual: decimal("cpc_atual", { precision: 5, scale: 2 }).notNull(),
  /** Full JSON payload with detailed breakdown (negativos por grupo, URLs, etc.) */
  dadosJson: text("dados_json"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImpactReport = typeof impactReports.$inferSelect;
export type InsertImpactReport = typeof impactReports.$inferInsert;

/**
 * Chart annotations for CTR trend graph events.
 * Each row marks a specific week with a label (e.g., 'Mudança de Bid').
 */
export const chartAnnotations = mysqlTable("chart_annotations", {
  id: int("id").autoincrement().primaryKey(),
  /** Report ID this annotation belongs to */
  reportId: int("report_id").notNull(),
  /** Week label matching the CTR chart x-axis (e.g., 'Sem. 2') */
  semana: varchar("semana", { length: 20 }).notNull(),
  /** Event description shown on the chart */
  label: varchar("label", { length: 100 }).notNull(),
  /** Hex color for the annotation line (e.g., '#f59e0b') */
  cor: varchar("cor", { length: 20 }).notNull().default("#f59e0b"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChartAnnotation = typeof chartAnnotations.$inferSelect;
export type InsertChartAnnotation = typeof chartAnnotations.$inferInsert;

/**
 * Dashboard users with email/password authentication.
 * Separate from the Manus OAuth users table.
 */
export const dashboardUsers = mysqlTable("dashboard_users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "viewer"]).default("viewer").notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
  avatarUrl: varchar("avatar_url", { length: 1024 }),
});

export type DashboardUser = typeof dashboardUsers.$inferSelect;
export type InsertDashboardUser = typeof dashboardUsers.$inferInsert;

/**
 * Active sessions for dashboard users.
 * Each login creates a session token stored as httpOnly cookie.
 */
export const dashboardSessions = mysqlTable("dashboard_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: varchar("user_agent", { length: 512 }),
});

export type DashboardSession = typeof dashboardSessions.$inferSelect;
export type InsertDashboardSession = typeof dashboardSessions.$inferInsert;

/**
 * Password reset tokens sent by email.
 * Each token is single-use and expires in 1 hour.
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * Activity log / audit trail for all user actions in the dashboard.
 * Tracks login, logout, user creation, password changes, etc.
 */
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** ID of the user who performed the action */
  userId: int("user_id"),
  /** Email of the user at the time of the action */
  userEmail: varchar("user_email", { length: 320 }),
  /** Action type: login, logout, create_user, update_user, delete_user, change_password, reset_password */
  action: varchar("action", { length: 64 }).notNull(),
  /** Human-readable description of the action */
  description: text("description"),
  /** Target resource (e.g., user email that was created/modified) */
  targetEmail: varchar("target_email", { length: 320 }),
  /** IP address of the request */
  ipAddress: varchar("ip_address", { length: 64 }),
  /** HTTP status code of the response */
  statusCode: int("status_code"),
  /** Additional metadata as JSON */
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;
/**
 * Log de todas as ações automáticas de otimização realizadas pelo sistema.
 * Cada linha representa uma ação executada pelo gestor automático (job horário/diário).
 */
export const optimizationActions = mysqlTable("optimization_actions", {
  id: int("id").autoincrement().primaryKey(),
  /** Tipo: auto_negative, competitive_alert, keyword_suggestion, budget_alert, audit_cleanup */
  actionType: varchar("action_type", { length: 64 }).notNull(),
  /** Status: applied, pending_approval, rejected, skipped */
  status: varchar("status", { length: 32 }).notNull().default("applied"),
  /** Termo ou palavra-chave envolvida */
  keyword: varchar("keyword", { length: 255 }),
  /** Match type: EXACT, PHRASE, BROAD */
  matchType: varchar("match_type", { length: 20 }),
  /** Nível: campaign ou ad_group */
  level: varchar("level", { length: 20 }),
  /** ID da campanha */
  campaignId: varchar("campaign_id", { length: 64 }),
  /** Nome da campanha */
  campaignName: varchar("campaign_name", { length: 255 }),
  /** ID do grupo de anúncio */
  adGroupId: varchar("ad_group_id", { length: 64 }),
  /** Nome do grupo de anúncio */
  adGroupName: varchar("ad_group_name", { length: 255 }),
  /** Justificativa automática da ação */
  reason: text("reason"),
  /** Dados de performance (JSON): cliques, impressões, gasto, conversões */
  performanceData: text("performance_data"),
  /** Economia estimada em R$ */
  estimatedSavings: decimal("estimated_savings", { precision: 10, scale: 2 }),
  /** Ciclo de execução (ex: hourly_2026-04-05T10:00) */
  executionCycle: varchar("execution_cycle", { length: 64 }),
  /** Aprovado por (email do usuário, se ação manual) */
  approvedBy: varchar("approved_by", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OptimizationAction = typeof optimizationActions.$inferSelect;
export type InsertOptimizationAction = typeof optimizationActions.$inferInsert;

/**
 * Candidatos a negativar identificados pelo job horário.
 * Ficam em status 'pending_review' até serem aprovados automaticamente ou manualmente.
 */
export const searchTermCandidates = mysqlTable("search_term_candidates", {
  id: int("id").autoincrement().primaryKey(),
  /** Termo de pesquisa */
  term: varchar("term", { length: 255 }).notNull(),
  /** Campanha onde apareceu */
  campaignName: varchar("campaign_name", { length: 255 }),
  /** Grupo de anúncio onde apareceu */
  adGroupName: varchar("ad_group_name", { length: 255 }),
  /** Impressões */
  impressions: int("impressions").default(0),
  /** Cliques */
  clicks: int("clicks").default(0),
  /** Gasto em R$ */
  spend: decimal("spend", { precision: 10, scale: 2 }).default("0"),
  /** Conversões */
  conversions: decimal("conversions", { precision: 10, scale: 2 }).default("0"),
  /** Categoria de intenção detectada */
  intentCategory: varchar("intent_category", { length: 64 }),
  /** Justificativa para negativar */
  reason: text("reason"),
  /** Status: pending_review, auto_applied, manually_applied, dismissed */
  status: varchar("status", { length: 32 }).notNull().default("pending_review"),
  /** Confiança da decisão automática (0-100) */
  confidence: int("confidence").default(0),
  /** Quando foi detectado */
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  /** Quando foi aplicado */
  appliedAt: timestamp("applied_at"),
});
export type SearchTermCandidate = typeof searchTermCandidates.$inferSelect;
export type InsertSearchTermCandidate = typeof searchTermCandidates.$inferInsert;

/**
 * Dados de inteligência competitiva (Auction Insights).
 * Rastreia concorrentes que aparecem nos mesmos leilões ao longo do tempo.
 */
export const competitiveInsights = mysqlTable("competitive_insights", {
  id: int("id").autoincrement().primaryKey(),
  /** Domínio do concorrente */
  competitor: varchar("competitor", { length: 255 }).notNull(),
  /** Taxa de sobreposição (impression share) */
  overlapRate: decimal("overlap_rate", { precision: 5, scale: 2 }),
  /** Taxa de posição acima */
  positionAboveRate: decimal("position_above_rate", { precision: 5, scale: 2 }),
  /** Impression share do concorrente */
  impressionShare: decimal("impression_share", { precision: 5, scale: 2 }),
  /** Impression share da nossa conta */
  ourImpressionShare: decimal("our_impression_share", { precision: 5, scale: 2 }),
  /** Campanha analisada */
  campaignName: varchar("campaign_name", { length: 255 }),
  /** Data da coleta */
  collectedAt: timestamp("collected_at").defaultNow().notNull(),
});
export type CompetitiveInsight = typeof competitiveInsights.$inferSelect;
export type InsertCompetitiveInsight = typeof competitiveInsights.$inferInsert;

/**
 * Sugestões de novas palavras-chave positivas identificadas pelo sistema.
 * Termos de pesquisa com alta performance que ainda não são palavras-chave ativas.
 */
export const keywordSuggestions = mysqlTable("keyword_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  /** Termo sugerido */
  term: varchar("term", { length: 255 }).notNull(),
  /** Grupo de anúncio sugerido */
  suggestedAdGroup: varchar("suggested_ad_group", { length: 255 }),
  /** Match type sugerido */
  suggestedMatchType: varchar("suggested_match_type", { length: 20 }),
  /** CTR observado como termo de pesquisa */
  observedCtr: decimal("observed_ctr", { precision: 5, scale: 2 }),
  /** Conversões observadas */
  observedConversions: decimal("observed_conversions", { precision: 10, scale: 2 }),
  /** Gasto observado */
  observedSpend: decimal("observed_spend", { precision: 10, scale: 2 }),
  /** Justificativa da sugestão */
  reason: text("reason"),
  /** Status: pending_review, approved, rejected */
  status: varchar("status", { length: 32 }).notNull().default("pending_review"),
  /** Prioridade: high, medium, low */
  priority: varchar("priority", { length: 16 }).notNull().default("medium"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});
export type KeywordSuggestion = typeof keywordSuggestions.$inferSelect;
export type InsertKeywordSuggestion = typeof keywordSuggestions.$inferInsert;

/**
 * Stores confirmed reasons for negative keywords.
 * Keyed by keyword text (normalized lowercase) — applies across all campaigns/groups.
 * Used to persist both manually-set and user-confirmed inferred reasons.
 */
export const keywordReasons = mysqlTable("keyword_reasons", {
  id: int("id").autoincrement().primaryKey(),
  /** Normalized keyword text (lowercase, trimmed) */
  keywordText: varchar("keyword_text", { length: 255 }).notNull().unique(),
  /** Reason code from NEGATIVE_REASONS list */
  reason: varchar("reason", { length: 100 }).notNull(),
  /** 1 = manually set, 0 = confirmed from inferred */
  isManual: int("is_manual").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type KeywordReason = typeof keywordReasons.$inferSelect;
export type InsertKeywordReason = typeof keywordReasons.$inferInsert;

/**
 * Stores hourly snapshots of Instagram metrics received from the social media dashboard.
 * Each row represents one sync cycle from redes-sociais.zenitetech.com.
 */
export const instagramSync = mysqlTable("instagram_sync", {
  id: int("id").autoincrement().primaryKey(),
  /** Instagram account handle (e.g., @ricardo_leao) */
  accountHandle: varchar("account_handle", { length: 100 }).notNull(),
  /** Display name of the account */
  accountName: varchar("account_name", { length: 255 }),
  /** Total followers count */
  followers: int("followers").default(0),
  /** Reach in the period */
  reach: int("reach").default(0),
  /** Total likes */
  likes: int("likes").default(0),
  /** Engagement rate (%) */
  engagementRate: decimal("engagement_rate", { precision: 5, scale: 2 }),
  /** Total impressions */
  impressions: int("impressions").default(0),
  /** Total comments */
  comments: int("comments").default(0),
  /** Total shares */
  shares: int("shares").default(0),
  /** Period covered: 7d, 30d, 90d */
  period: varchar("period", { length: 10 }).default("7d"),
  /** Full JSON payload with all metrics for detailed analysis */
  rawJson: text("raw_json"),
  /** Source system identifier */
  source: varchar("source", { length: 100 }).default("redes-sociais.zenitetech.com"),
  /** When this snapshot was received */
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});
export type InstagramSync = typeof instagramSync.$inferSelect;
export type InsertInstagramSync = typeof instagramSync.$inferInsert;

/**
 * Integration sync log — tracks every cross-system API call.
 * Records both incoming (Instagram → Google Ads) and outgoing (Google Ads → Instagram) syncs.
 */
export const integrationSyncLog = mysqlTable("integration_sync_log", {
  id: int("id").autoincrement().primaryKey(),
  /** Direction: inbound (received data) or outbound (sent data) */
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  /** Source system URL */
  sourceSystem: varchar("source_system", { length: 255 }).notNull(),
  /** Target system URL */
  targetSystem: varchar("target_system", { length: 255 }).notNull(),
  /** Endpoint called */
  endpoint: varchar("endpoint", { length: 255 }),
  /** HTTP status code */
  statusCode: int("status_code"),
  /** Whether the sync was successful */
  success: int("success").default(1).notNull(),
  /** Error message if failed */
  errorMessage: text("error_message"),
  /** Summary of data exchanged */
  summary: text("summary"),
  /** Duration in milliseconds */
  durationMs: int("duration_ms"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type IntegrationSyncLog = typeof integrationSyncLog.$inferSelect;
export type InsertIntegrationSyncLog = typeof integrationSyncLog.$inferInsert;

/**
 * Propostas de negativação geradas pelo job horário (Nível 2 — Semiautomático).
 * Cada proposta agrupa N termos candidatos e aguarda aprovação explícita do Ricardo.
 * Expiram em 24h se não houver resposta. Nenhuma ação é executada sem aprovação.
 */
export const negativeProposals = mysqlTable("negative_proposals", {
  id: int("id").autoincrement().primaryKey(),
  /** ID único da proposta, ex: NP-1A2B3C4D */
  proposalId: varchar("proposal_id", { length: 32 }).notNull().unique(),
  /** Status: pending | approved | rejected | expired */
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  /** JSON array com os termos: [{term, matchType, confidence, reason}] */
  termsJson: text("terms_json").notNull(),
  /** Quantidade de termos na proposta */
  termCount: int("term_count").notNull().default(0),
  /** Gasto total dos termos (R$) */
  totalSpend: decimal("total_spend", { precision: 10, scale: 2 }).default("0"),
  /** Campanha alvo */
  campaignId: varchar("campaign_id", { length: 64 }),
  campaignName: varchar("campaign_name", { length: 255 }),
  /** Ciclo de execução do job que gerou esta proposta */
  executionCycle: varchar("execution_cycle", { length: 64 }),
  /** Quando a proposta expira (24h após criação) */
  expiresAt: timestamp("expires_at"),
  /** Quando foi aprovada/rejeitada */
  appliedAt: timestamp("applied_at"),
  /** Quantos termos foram efetivamente aplicados após aprovação */
  appliedCount: int("applied_count").default(0),
  /** Quem aprovou (email ou "dashboard") */
  approvedBy: varchar("approved_by", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type NegativeProposal = typeof negativeProposals.$inferSelect;
export type InsertNegativeProposal = typeof negativeProposals.$inferInsert;


// ============================================
// MÓDULO: REDES SOCIAIS
// Suporte multi-plataforma: Instagram, Facebook, LinkedIn, YouTube
// ============================================

/**
 * Plataformas de redes sociais suportadas.
 * Seed inicial: instagram, facebook, linkedin, youtube
 */
export const socialPlatforms = mysqlTable("social_platforms", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SocialPlatform = typeof socialPlatforms.$inferSelect;
export type InsertSocialPlatform = typeof socialPlatforms.$inferInsert;

/**
 * Contas de redes sociais conectadas.
 * Cada conta pertence a uma plataforma e pode ter credenciais de API.
 */
export const socialAccounts = mysqlTable("social_accounts", {
  id: varchar("id", { length: 50 }).primaryKey(),
  platformId: varchar("platform_id", { length: 50 }).notNull(),
  accountName: varchar("account_name", { length: 100 }).notNull(),
  accountHandle: varchar("account_handle", { length: 100 }).notNull(),
  externalId: varchar("external_id", { length: 100 }),
  credentials: json("credentials"),
  isActive: boolean("is_active").default(true),
  lastSync: timestamp("last_sync"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type InsertSocialAccount = typeof socialAccounts.$inferInsert;

/**
 * Métricas diárias de redes sociais.
 * Armazena seguidores, alcance, engajamento, etc. por conta e período.
 */
export const socialMetrics = mysqlTable("social_metrics", {
  id: varchar("id", { length: 50 }).primaryKey(),
  accountId: varchar("account_id", { length: 50 }).notNull(),
  platformId: varchar("platform_id", { length: 50 }).notNull(),
  metricType: varchar("metric_type", { length: 50 }).notNull(),
  metricValue: decimal("metric_value", { precision: 15, scale: 2 }).notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  date: timestamp("date").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SocialMetric = typeof socialMetrics.$inferSelect;
export type InsertSocialMetric = typeof socialMetrics.$inferInsert;

/**
 * Posts publicados nas redes sociais.
 * Armazena métricas de engajamento por post.
 */
export const socialPosts = mysqlTable("social_posts", {
  id: varchar("id", { length: 50 }).primaryKey(),
  accountId: varchar("account_id", { length: 50 }).notNull(),
  platformId: varchar("platform_id", { length: 50 }).notNull(),
  postId: varchar("post_id", { length: 100 }).notNull(),
  caption: text("caption"),
  mediaUrl: varchar("media_url", { length: 500 }),
  postType: varchar("post_type", { length: 50 }),
  likes: int("likes").default(0),
  comments: int("comments").default(0),
  shares: int("shares").default(0),
  engagement: decimal("engagement", { precision: 5, scale: 2 }).default("0"),
  postedAt: timestamp("posted_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

/**
 * Alertas de redes sociais.
 * Notificações de queda de engajamento, picos de seguidores, etc.
 */
export const socialAlerts = mysqlTable("social_alerts", {
  id: varchar("id", { length: 50 }).primaryKey(),
  accountId: varchar("account_id", { length: 50 }).notNull(),
  platformId: varchar("platform_id", { length: 50 }).notNull(),
  alertType: varchar("alert_type", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SocialAlert = typeof socialAlerts.$inferSelect;
export type InsertSocialAlert = typeof socialAlerts.$inferInsert;

/**
 * Integrações com APIs externas de redes sociais.
 * Configurações de MCP, webhooks e API keys.
 */
export const socialIntegrations = mysqlTable("social_integrations", {
  id: varchar("id", { length: 50 }).primaryKey(),
  platformId: varchar("platform_id", { length: 50 }).notNull(),
  integrationType: varchar("integration_type", { length: 50 }).notNull(),
  config: json("config").notNull(),
  isActive: boolean("is_active").default(true),
  lastSyncStatus: varchar("last_sync_status", { length: 20 }),
  lastSyncTime: timestamp("last_sync_time"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SocialIntegration = typeof socialIntegrations.$inferSelect;
export type InsertSocialIntegration = typeof socialIntegrations.$inferInsert;

/**
 * Automações de redes sociais.
 * Agendamento de posts, respostas automáticas, gatilhos de alerta.
 */
export const socialAutomations = mysqlTable("social_automations", {
  id: varchar("id", { length: 50 }).primaryKey(),
  accountId: varchar("account_id", { length: 50 }).notNull(),
  platformId: varchar("platform_id", { length: 50 }).notNull(),
  automationType: varchar("automation_type", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  config: json("config").notNull(),
  isActive: boolean("is_active").default(true),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SocialAutomation = typeof socialAutomations.$inferSelect;
export type InsertSocialAutomation = typeof socialAutomations.$inferInsert;

/**
 * Relatórios de redes sociais.
 * Snapshots semanais/mensais/trimestrais com dados completos em JSON.
 */
export const socialReports = mysqlTable("social_reports", {
  id: varchar("id", { length: 50 }).primaryKey(),
  accountId: varchar("account_id", { length: 50 }).notNull(),
  platformId: varchar("platform_id", { length: 50 }).notNull(),
  reportType: varchar("report_type", { length: 50 }).notNull(),
  period: varchar("period", { length: 50 }).notNull(),
  data: json("data").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SocialReport = typeof socialReports.$inferSelect;
export type InsertSocialReport = typeof socialReports.$inferInsert;

// ─── AUTOMAÇÕES DE GESTÃO DE TRÁFEGO PAGO ──────────────────────────────────

/**
 * Automação 1: Alertas de Anomalia
 * Registra anomalias detectadas nas métricas do Google Ads a cada 4h.
 */
export const anomalyAlerts = mysqlTable("anomaly_alerts", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // ctr_drop, cpc_spike, zero_conversions, budget_80pct
  metric: varchar("metric", { length: 100 }).notNull(),
  adGroupId: varchar("adGroupId", { length: 64 }),
  adGroupName: varchar("adGroupName", { length: 255 }),
  currentValue: varchar("currentValue", { length: 50 }).notNull(),
  thresholdValue: varchar("thresholdValue", { length: 50 }).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  message: text("message").notNull(),
  emailSent: boolean("emailSent").default(false),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AnomalyAlert = typeof anomalyAlerts.$inferSelect;
export type InsertAnomalyAlert = typeof anomalyAlerts.$inferInsert;

/**
 * Automação 2: Snapshots diários do Instagram
 * Histórico de métricas para análise de tendência.
 */
export const instagramSnapshots = mysqlTable("instagram_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("accountId", { length: 100 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  followers: int("followers").default(0),
  following: int("following").default(0),
  totalPosts: int("totalPosts").default(0),
  avgLikes: varchar("avgLikes", { length: 20 }),
  avgComments: varchar("avgComments", { length: 20 }),
  engagementRate: varchar("engagementRate", { length: 20 }),
  recentPostsData: json("recentPostsData"),
  snapshotDate: varchar("snapshotDate", { length: 20 }).notNull(), // YYYY-MM-DD
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InstagramSnapshot = typeof instagramSnapshots.$inferSelect;
export type InsertInstagramSnapshot = typeof instagramSnapshots.$inferInsert;

/**
 * Automação 3: Sugestões de melhoria de RSA geradas por IA
 */
export const rsaSuggestions = mysqlTable("rsa_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  adId: varchar("adId", { length: 64 }).notNull(),
  adGroupId: varchar("adGroupId", { length: 64 }),
  adGroupName: varchar("adGroupName", { length: 255 }),
  campaignName: varchar("campaignName", { length: 255 }),
  currentAdStrength: varchar("currentAdStrength", { length: 50 }),
  currentHeadlines: json("currentHeadlines"),
  currentDescriptions: json("currentDescriptions"),
  suggestedHeadlines: json("suggestedHeadlines"),
  suggestedDescriptions: json("suggestedDescriptions"),
  reasoning: text("reasoning"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "applied"]).default("pending").notNull(),
  appliedAt: timestamp("appliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RsaSuggestion = typeof rsaSuggestions.$inferSelect;
export type InsertRsaSuggestion = typeof rsaSuggestions.$inferInsert;

/**
 * Automação 5: Histórico de ajustes de lance
 */
export const bidAdjustments = mysqlTable("bid_adjustments", {
  id: int("id").autoincrement().primaryKey(),
  adGroupId: varchar("adGroupId", { length: 64 }).notNull(),
  adGroupName: varchar("adGroupName", { length: 255 }),
  campaignName: varchar("campaignName", { length: 255 }),
  oldBidMicros: varchar("oldBidMicros", { length: 30 }),
  newBidMicros: varchar("newBidMicros", { length: 30 }),
  adjustmentPct: varchar("adjustmentPct", { length: 20 }),
  reason: text("reason"),
  triggerMetric: varchar("triggerMetric", { length: 100 }), // e.g. "CTR=14.5%, CPC=2.77"
  status: mysqlEnum("status", ["suggested", "approved", "rejected", "applied", "failed"]).default("suggested").notNull(),
  appliedAt: timestamp("appliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BidAdjustment = typeof bidAdjustments.$inferSelect;
export type InsertBidAdjustment = typeof bidAdjustments.$inferInsert;

/**
 * Automação 7: Snapshots de concorrência (Auction Insights)
 */
export const auctionSnapshots = mysqlTable("auction_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotDate: varchar("snapshotDate", { length: 20 }).notNull(),
  adGroupId: varchar("adGroupId", { length: 64 }),
  adGroupName: varchar("adGroupName", { length: 255 }),
  competitor: varchar("competitor", { length: 255 }).notNull(),
  impressionShare: varchar("impressionShare", { length: 20 }),
  overlapRate: varchar("overlapRate", { length: 20 }),
  positionAboveRate: varchar("positionAboveRate", { length: 20 }),
  topOfPageRate: varchar("topOfPageRate", { length: 20 }),
  absTopOfPageRate: varchar("absTopOfPageRate", { length: 20 }),
  isNew: boolean("isNew").default(false), // novo concorrente detectado
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuctionSnapshot = typeof auctionSnapshots.$inferSelect;
export type InsertAuctionSnapshot = typeof auctionSnapshots.$inferInsert;

/**
 * Automação 8: Análise de termos de pesquisa por IA
 */
export const searchTermAnalysis = mysqlTable("search_term_analysis", {
  id: int("id").autoincrement().primaryKey(),
  term: varchar("term", { length: 500 }).notNull(),
  adGroupId: varchar("adGroupId", { length: 64 }),
  adGroupName: varchar("adGroupName", { length: 255 }),
  campaignName: varchar("campaignName", { length: 255 }),
  impressions: int("impressions").default(0),
  clicks: int("clicks").default(0),
  costMicros: varchar("costMicros", { length: 30 }),
  conversions: varchar("conversions", { length: 20 }),
  intent: mysqlEnum("intent", ["informational", "navigational", "transactional", "irrelevant", "unknown"]).default("unknown"),
  relevanceScore: varchar("relevanceScore", { length: 10 }), // 0.0 to 1.0
  aiReasoning: text("aiReasoning"),
  decision: mysqlEnum("decision", ["keep", "negative", "monitor", "pending"]).default("pending"),
  negativeApplied: boolean("negativeApplied").default(false),
  analysisDate: varchar("analysisDate", { length: 20 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SearchTermAnalysis = typeof searchTermAnalysis.$inferSelect;
export type InsertSearchTermAnalysis = typeof searchTermAnalysis.$inferInsert;

/**
 * Calendário Editorial — sugestões de posts geradas por IA
 */
export const editorialCalendar = mysqlTable("editorial_calendar", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("accountId", { length: 100 }).notNull(),
  suggestedDate: varchar("suggestedDate", { length: 20 }).notNull(), // YYYY-MM-DD
  suggestedTime: varchar("suggestedTime", { length: 10 }), // HH:MM
  contentType: mysqlEnum("contentType", ["reel", "carousel", "image", "story"]).default("image"),
  topic: varchar("topic", { length: 255 }),
  caption: text("caption"),
  hashtags: json("hashtags"),
  relatedProduct: varchar("relatedProduct", { length: 100 }),
  estimatedEngagement: varchar("estimatedEngagement", { length: 20 }),
  status: mysqlEnum("status", ["suggested", "scheduled", "published", "cancelled"]).default("suggested"),
  googleCalendarEventId: varchar("googleCalendarEventId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EditorialCalendarEntry = typeof editorialCalendar.$inferSelect;
export type InsertEditorialCalendarEntry = typeof editorialCalendar.$inferInsert;

// ---- AUTOMATION EXECUTION LOGS ----
/**
 * Log de execuções de automações — registra cada execução com status, resumo e detalhes.
 * Usado pela Central de Automações para exibir histórico e enviar notificações por e-mail.
 */
export const automationExecutionLogs = mysqlTable("automation_execution_logs", {
  id: int("id").autoincrement().primaryKey(),
  automationName: varchar("automation_name", { length: 100 }).notNull(), // ex: "anomaly_check"
  automationLabel: varchar("automation_label", { length: 200 }).notNull(), // ex: "Alertas de Anomalia"
  status: mysqlEnum("status", ["running", "success", "error", "warning"]).notNull().default("running"),
  summary: text("summary"), // Resumo do que foi executado
  details: json("details"), // Dados detalhados da execução (JSON)
  errorMessage: text("error_message"), // Mensagem de erro se falhou
  durationMs: int("duration_ms"), // Duração em milissegundos
  triggeredBy: varchar("triggered_by", { length: 50 }).default("manual"), // "manual" | "schedule" | "api"
  emailSent: boolean("email_sent").default(false), // Se enviou notificação por e-mail
  createdAt: timestamp("created_at").defaultNow(),
});
export type AutomationExecutionLog = typeof automationExecutionLogs.$inferSelect;
export type InsertAutomationExecutionLog = typeof automationExecutionLogs.$inferInsert;

// ---- SYSTEM SETTINGS ----
/**
 * Configurações do sistema — armazena pares chave/valor ajustáveis pelo painel.
 * Ex: limiar de engajamento do Instagram, e-mail de alerta, etc.
 */
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  label: varchar("label", { length: 200 }),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

// ---- INSIGHTS HISTORY ----
/**
 * Histórico de insights gerados pela IA — salva cada análise com período, tags e conteúdo.
 * Permite consultar e comparar recomendações ao longo do tempo.
 */
export const insightsHistory = mysqlTable("insights_history", {
  id: int("id").autoincrement().primaryKey(),
  /** Período analisado (ex: "7 dias", "Este Mês") */
  period: varchar("period", { length: 50 }).notNull(),
  /** Data de início do período analisado */
  startDate: varchar("start_date", { length: 20 }).notNull(),
  /** Data de fim do período analisado */
  endDate: varchar("end_date", { length: 20 }).notNull(),
  /** Conteúdo do insight gerado pela IA (Markdown) */
  content: text("content").notNull(),
  /** Tags aplicadas pelo usuário (JSON array de strings) */
  tags: json("tags").$type<string[]>().default([]),
  /** Métricas resumidas do período (JSON) */
  metrics: json("metrics").$type<{
    totalImpressions: number;
    totalClicks: number;
    avgCTR: number;
    avgCPC: number;
    totalConversions: number;
    totalSpend: number;
  }>(),
  /** Quando foi gerado */
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type InsightsHistoryEntry = typeof insightsHistory.$inferSelect;
export type InsertInsightsHistoryEntry = typeof insightsHistory.$inferInsert;

// ---- CTR ALERT RULES ----
/**
 * Regras de alerta de CTR — define limites por grupo de anúncios para envio de e-mail automático.
 */
export const ctrAlertRules = mysqlTable("ctr_alert_rules", {
  id: int("id").autoincrement().primaryKey(),
  /** Nome do grupo de anúncios (ou "all" para todos) */
  adGroupName: varchar("ad_group_name", { length: 255 }).notNull().default("all"),
  /** Limiar de CTR (%) abaixo do qual o alerta é disparado */
  thresholdPercent: int("threshold_percent").notNull().default(5),
  /** E-mail para envio do alerta */
  email: varchar("email", { length: 320 }).notNull(),
  /** Se a regra está ativa */
  active: boolean("active").default(true).notNull(),
  /** Última vez que o alerta foi disparado */
  lastTriggeredAt: timestamp("last_triggered_at"),
  /** Quando foi criada */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  /** Quando foi atualizada */
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CtrAlertRule = typeof ctrAlertRules.$inferSelect;
export type InsertCtrAlertRule = typeof ctrAlertRules.$inferInsert;

// ---- NEGATIVE CATEGORY CONFIG ----
/**
 * Configuração de categorias ativas para a automação de negativação.
 * Permite ativar/desativar categorias inteiras de negativação via dashboard.
 * Uma linha por categoria — upsert ao salvar.
 */
export const negativeCategoryConfig = mysqlTable("negative_category_config", {
  id: int("id").autoincrement().primaryKey(),
  /** Identificador da categoria (ex: "emprego", "gratuidade", "concorrente") */
  category: varchar("category", { length: 64 }).notNull().unique(),
  /** Label legível para exibição */
  label: varchar("label", { length: 128 }).notNull(),
  /** Descrição da categoria */
  description: text("description"),
  /** Se a categoria está ativa (true = gera propostas, false = ignorada) */
  active: boolean("active").default(true).notNull(),
  /** Nível de confiança mínimo para proposta automática (0-100) */
  minConfidence: int("min_confidence").default(70).notNull(),
  /** Tipo de correspondência padrão para esta categoria */
  defaultMatchType: varchar("default_match_type", { length: 20 }).default("PHRASE").notNull(),
  /** Quem atualizou por último */
  updatedBy: varchar("updated_by", { length: 128 }),
  /** Quando foi criada */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  /** Quando foi atualizada */
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type NegativeCategoryConfig = typeof negativeCategoryConfig.$inferSelect;
export type InsertNegativeCategoryConfig = typeof negativeCategoryConfig.$inferInsert;

// ─── Chat com IA ──────────────────────────────────────────────────────────────
export const aiChatMessages = mysqlTable("ai_chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  /** ID da conversa (agrupa mensagens de uma sessão) */
  conversationId: varchar("conversation_id", { length: 64 }).notNull(),
  /** Papel: user ou assistant */
  role: varchar("role", { length: 20 }).notNull(),
  /** Conteúdo da mensagem */
  content: text("content").notNull(),
  /** Contexto adicional (JSON: página atual, campanha, métricas) */
  context: text("context"),
  /** Quando foi criada */
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiChatMessage = typeof aiChatMessages.$inferSelect;
export type InsertAiChatMessage = typeof aiChatMessages.$inferInsert;

// ─── Experimentos A/B ─────────────────────────────────────────────────────────
import { bigint } from "drizzle-orm/mysql-core";

export const abExperiments = mysqlTable("ab_experiments", {
  id: int("id").autoincrement().primaryKey(),
  /** Nome descritivo do experimento */
  name: varchar("name", { length: 256 }).notNull(),
  /** Descrição e objetivo do teste */
  description: text("description"),
  /** Campanha alvo */
  campaignId: varchar("campaign_id", { length: 64 }),
  campaignName: varchar("campaign_name", { length: 256 }),
  /** Grupo de anúncios alvo */
  adGroupId: varchar("ad_group_id", { length: 64 }),
  adGroupName: varchar("ad_group_name", { length: 256 }),
  /** Tipo: rsa_variant | bid_strategy | keyword_match | landing_page */
  experimentType: varchar("experiment_type", { length: 64 }).notNull().default("rsa_variant"),
  /** Status: draft | running | paused | completed | archived */
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  /** Hipótese do teste */
  hypothesis: text("hypothesis"),
  /** Métrica principal: ctr | cpc | conversions | cost_per_conversion */
  primaryMetric: varchar("primary_metric", { length: 64 }).default("ctr"),
  /** Meta da métrica (ex: CTR > 10%) */
  metricGoal: varchar("metric_goal", { length: 128 }),
  /** Data de início */
  startDate: timestamp("start_date"),
  /** Data de término */
  endDate: timestamp("end_date"),
  /** Resultado: control_wins | variant_wins | inconclusive */
  result: varchar("result", { length: 32 }),
  /** Análise final gerada por IA */
  aiAnalysis: text("ai_analysis"),
  /** Quem criou */
  createdBy: varchar("created_by", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AbExperiment = typeof abExperiments.$inferSelect;
export type InsertAbExperiment = typeof abExperiments.$inferInsert;

export const abVariants = mysqlTable("ab_variants", {
  id: int("id").autoincrement().primaryKey(),
  experimentId: int("experiment_id").notNull(),
  /** control ou variant_N */
  variantType: varchar("variant_type", { length: 32 }).notNull().default("control"),
  /** Nome da variante */
  name: varchar("name", { length: 256 }).notNull(),
  /** Descrição das mudanças */
  description: text("description"),
  /** Conteúdo JSON: headlines, descriptions, bid, etc. */
  content: text("content"),
  /** Impressões acumuladas */
  impressions: int("impressions").default(0),
  /** Cliques acumulados */
  clicks: int("clicks").default(0),
  /** Custo em micros */
  costMicros: bigint("cost_micros", { mode: "number" }).default(0),
  /** Conversões */
  conversions: int("conversions").default(0),
  /** CTR calculado */
  ctr: varchar("ctr", { length: 16 }).default("0.00"),
  /** CPC calculado */
  cpc: varchar("cpc", { length: 16 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AbVariant = typeof abVariants.$inferSelect;
export type InsertAbVariant = typeof abVariants.$inferInsert;


/**
 * Histórico de ajustes automáticos de orçamento dinâmico entre grupos de anúncios.
 * Registra cada realocação de verba executada (ou simulada) pelo job dynamicBudget.
 */
export const budgetAdjustments = mysqlTable("budget_adjustments", {
  id: int("id").autoincrement().primaryKey(),
  /** Data do ajuste (YYYY-MM-DD) */
  date: varchar("date", { length: 16 }).notNull(),
  /** ID do grupo de anúncios que cedeu verba (doador) */
  donorAdGroupId: varchar("donor_ad_group_id", { length: 64 }),
  /** Nome do grupo doador */
  donorAdGroupName: varchar("donor_ad_group_name", { length: 255 }),
  /** ID do grupo de anúncios que recebeu verba (receptor) */
  recipientAdGroupId: varchar("recipient_ad_group_id", { length: 64 }).notNull(),
  /** Nome do grupo receptor */
  recipientAdGroupName: varchar("recipient_ad_group_name", { length: 255 }).notNull(),
  /** Orçamento anterior do receptor (em centavos) */
  oldBudgetMicros: bigint("old_budget_micros", { mode: "number" }).notNull(),
  /** Novo orçamento do receptor (em centavos) */
  newBudgetMicros: bigint("new_budget_micros", { mode: "number" }).notNull(),
  /** Valor realocado (em centavos) */
  amountMovedMicros: bigint("amount_moved_micros", { mode: "number" }).notNull(),
  /** Motivo da realocação */
  reason: text("reason").notNull(),
  /** Quem disparou: scheduled | manual | simulation */
  triggeredBy: varchar("triggered_by", { length: 32 }).notNull().default("scheduled"),
  /** Status: applied | skipped | failed | simulated */
  status: mysqlEnum("status", ["applied", "skipped", "failed", "simulated"]).notNull().default("simulated"),
  /** Mensagem de erro se falhou */
  errorMessage: text("error_message"),
  /** CTR do grupo receptor no momento do ajuste */
  recipientCtr: varchar("recipient_ctr", { length: 16 }),
  /** CPL do grupo receptor no momento do ajuste */
  recipientCpl: varchar("recipient_cpl", { length: 16 }),
  /** CTR do grupo doador no momento do ajuste */
  donorCtr: varchar("donor_ctr", { length: 16 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BudgetAdjustment = typeof budgetAdjustments.$inferSelect;
export type InsertBudgetAdjustment = typeof budgetAdjustments.$inferInsert;

/**
 * Configuração do modo de operação da automação de orçamento dinâmico.
 * Armazena se o modo simulação está ativo ou não.
 */
export const budgetAutomationConfig = mysqlTable("budget_automation_config", {
  id: int("id").autoincrement().primaryKey(),
  /** Se true, apenas simula sem aplicar no Google Ads */
  simulationMode: boolean("simulation_mode").notNull().default(true),
  /** Se a automação está habilitada */
  enabled: boolean("enabled").notNull().default(true),
  /** Última vez que o job foi executado */
  lastRunAt: timestamp("last_run_at"),
  /** Próxima execução agendada */
  nextRunAt: timestamp("next_run_at"),
  /** Total realocado hoje em micros */
  totalMovedTodayMicros: bigint("total_moved_today_micros", { mode: "number" }).default(0),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type BudgetAutomationConfig = typeof budgetAutomationConfig.$inferSelect;


/**
 * Histórico de alertas enviados via WhatsApp.
 */
export const whatsappAlerts = mysqlTable("whatsapp_alerts", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 32 }).notNull(),
  toNumber: varchar("to_number", { length: 32 }).notNull(),
  message: text("message").notNull(),
  dashboardLink: varchar("dashboard_link", { length: 512 }),
  status: mysqlEnum("status", ["sent", "failed", "rate_limited", "quiet_hours"]).notNull().default("sent"),
  errorMessage: text("error_message"),
  adGroupName: varchar("ad_group_name", { length: 255 }),
  metricValue: varchar("metric_value", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WhatsappAlert = typeof whatsappAlerts.$inferSelect;
export type InsertWhatsappAlert = typeof whatsappAlerts.$inferInsert;

/**
 * Configuração do sistema de alertas WhatsApp.
 */
export const whatsappConfig = mysqlTable("whatsapp_config", {
  id: int("id").autoincrement().primaryKey(),
  phoneNumber: varchar("phone_number", { length: 32 }),
  enabled: boolean("enabled").notNull().default(false),
  provider: varchar("provider", { length: 32 }).notNull().default("evolution_api"),
  apiUrl: varchar("api_url", { length: 512 }),
  instanceName: varchar("instance_name", { length: 128 }),
  apiKey: varchar("api_key", { length: 512 }),
  twilioAccountSid: varchar("twilio_account_sid", { length: 128 }),
  twilioAuthToken: varchar("twilio_auth_token", { length: 256 }),
  twilioWhatsappFrom: varchar("twilio_whatsapp_from", { length: 32 }),
  quietHoursStart: int("quiet_hours_start").notNull().default(22),
  quietHoursEnd: int("quiet_hours_end").notNull().default(7),
  maxPerHour: int("max_per_hour").notNull().default(10),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type WhatsappConfig = typeof whatsappConfig.$inferSelect;

/**
 * Previsões de conversão de termos de busca geradas pela IA.
 */
export const leadPredictions = mysqlTable("lead_predictions", {
  id: int("id").autoincrement().primaryKey(),
  term: varchar("term", { length: 255 }).notNull(),
  probability: mysqlEnum("probability", ["alta", "media", "baixa"]).notNull(),
  reason: text("reason").notNull(),
  suggestedAction: text("suggested_action"),
  weekOf: varchar("week_of", { length: 16 }).notNull(),
  status: mysqlEnum("status", ["pending", "added", "rejected"]).notNull().default("pending"),
  clicks: int("clicks").default(0),
  impressions: int("impressions").default(0),
  ctr: varchar("ctr", { length: 16 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LeadPrediction = typeof leadPredictions.$inferSelect;
export type InsertLeadPrediction = typeof leadPredictions.$inferInsert;

/**
 * Clientes cadastrados para receber relatórios mensais.
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  product: varchar("product", { length: 64 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  adGroupFilter: varchar("ad_group_filter", { length: 255 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Relatórios mensais gerados para clientes.
 */
export const clientReports = mysqlTable("client_reports", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("client_id").notNull(),
  month: varchar("month", { length: 7 }).notNull(),
  pdfUrl: varchar("pdf_url", { length: 512 }),
  pdfKey: varchar("pdf_key", { length: 512 }),
  status: mysqlEnum("status", ["pending", "generated", "sent", "failed"]).notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  totalLeads: int("total_leads").default(0),
  totalSpend: varchar("total_spend", { length: 32 }),
  avgCpl: varchar("avg_cpl", { length: 32 }),
  avgCtr: varchar("avg_ctr", { length: 16 }),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ClientReport = typeof clientReports.$inferSelect;
export type InsertClientReport = typeof clientReports.$inferInsert;

/**
 * Briefings diários de voz gerados pela IA.
 */
export const voiceBriefings = mysqlTable("voice_briefings", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 16 }).notNull().unique(),
  text: text("text").notNull(),
  audioUrl: varchar("audio_url", { length: 512 }),
  audioKey: varchar("audio_key", { length: 512 }),
  duration: int("duration"),
  listenedAt: timestamp("listened_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type VoiceBriefing = typeof voiceBriefings.$inferSelect;
export type InsertVoiceBriefing = typeof voiceBriefings.$inferInsert;

/**
 * Configuração do briefing de voz diário.
 */
export const voiceBriefingConfig = mysqlTable("voice_briefing_config", {
  id: int("id").autoincrement().primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  voxforgeUrl: varchar("voxforge_url", { length: 512 }).default("http://localhost:8000"),
  voice: varchar("voice", { length: 64 }).default("pt-BR-Ricardo"),
  generationHour: int("generation_hour").notNull().default(7),
  generationMinute: int("generation_minute").notNull().default(45),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type VoiceBriefingConfig = typeof voiceBriefingConfig.$inferSelect;

/**
 * Preferências persistidas por usuário do dashboard.
 * Armazena filtros, favoritos, período selecionado e outras configurações de UI.
 */
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  /** ID do usuário (referência à tabela dashboard_users) */
  userId: int("user_id").notNull(),
  /** Período padrão selecionado: 7d, 30d, 90d ou custom */
  defaultPeriod: varchar("default_period", { length: 16 }).default("7d"),
  /** Data de início do período customizado (ISO string) */
  customStartDate: varchar("custom_start_date", { length: 32 }),
  /** Data de fim do período customizado (ISO string) */
  customEndDate: varchar("custom_end_date", { length: 32 }),
  /** IDs dos grupos de anúncios favoritados (JSON array de strings) */
  favoriteGroups: text("favorite_groups"),
  /** Filtro de status padrão: all, EXCELLENT, GOOD, AVERAGE, POOR */
  defaultStatusFilter: varchar("default_status_filter", { length: 16 }).default("all"),
  /** Filtro de campanha padrão */
  defaultCampaignFilter: varchar("default_campaign_filter", { length: 128 }),
  /** Documentos favoritados na página /documentos (JSON array de IDs) */
  favoriteDocuments: text("favorite_documents"),
  /** Grupos do menu sidebar que estão abertos (JSON array de strings) */
  openMenuGroups: text("open_menu_groups"),
  /** Última atualização */
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;

/**
 * Cache de dados do Google Ads para stale-while-revalidate na Home.
 * Armazena o último resultado bem-sucedido da API para exibição imediata.
 */
export const adsDataCache = mysqlTable("ads_data_cache", {
  id: int("id").autoincrement().primaryKey(),
  /** Chave do cache: summary_7d, summary_30d, trends_7d, etc. */
  cacheKey: varchar("cache_key", { length: 64 }).notNull().unique(),
  /** Dados em JSON */
  data: text("data").notNull(),
  /** Quando os dados foram buscados da API */
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  /** Período de validade em segundos (padrão: 3600 = 1h) */
  ttlSeconds: int("ttl_seconds").default(3600).notNull(),
});
export type AdsDataCache = typeof adsDataCache.$inferSelect;
export type InsertAdsDataCache = typeof adsDataCache.$inferInsert;

/**
 * Histórico de alertas do sistema (anomalias, tokens, automações).
 * Permite visualizar linha do tempo de alertas em /automacoes.
 */
export const alertHistory = mysqlTable("alert_history", {
  id: int("id").autoincrement().primaryKey(),
  /** Tipo: anomaly, token_expiry, auto_pause, meta_ads, whatsapp */
  type: varchar("type", { length: 32 }).notNull(),
  /** Severidade: info, warning, critical */
  severity: varchar("severity", { length: 16 }).notNull().default("info"),
  /** Título curto do alerta */
  title: varchar("title", { length: 255 }).notNull(),
  /** Descrição detalhada */
  message: text("message"),
  /** Dados adicionais em JSON (métricas, thresholds, etc.) */
  metadata: text("metadata"),
  /** Se o alerta foi lido/reconhecido */
  acknowledged: boolean("acknowledged").default(false).notNull(),
  /** Quando foi reconhecido */
  acknowledgedAt: timestamp("acknowledged_at"),
  /** Quando o alerta foi gerado */
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AlertHistory = typeof alertHistory.$inferSelect;
export type InsertAlertHistory = typeof alertHistory.$inferInsert;

/**
 * Propostas de pausa automática de grupos de anúncios.
 * Grupos com CTR < 2% por 7 dias consecutivos entram aqui para aprovação manual.
 */
export const autoPauseProposals = mysqlTable("auto_pause_proposals", {
  id: int("id").autoincrement().primaryKey(),
  /** ID do grupo de anúncios no Google Ads */
  adGroupId: varchar("ad_group_id", { length: 64 }).notNull(),
  /** Nome do grupo */
  adGroupName: varchar("ad_group_name", { length: 255 }).notNull(),
  /** CTR médio dos últimos 7 dias */
  avgCtr: varchar("avg_ctr", { length: 16 }).notNull(),
  /** Gasto total nos últimos 7 dias */
  totalSpend: varchar("total_spend", { length: 32 }).notNull(),
  /** Status: pending, approved, rejected */
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  /** Quem aprovou/rejeitou */
  reviewedBy: varchar("reviewed_by", { length: 128 }),
  /** Quando foi revisado */
  reviewedAt: timestamp("reviewed_at"),
  /** Observação do revisor */
  reviewNote: text("review_note"),
  /** Quando a proposta foi gerada */
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AutoPauseProposal = typeof autoPauseProposals.$inferSelect;
export type InsertAutoPauseProposal = typeof autoPauseProposals.$inferInsert;

/**
 * Score de qualidade diário por grupo de anúncios.
 * Calculado às 8h30 pelo job dailyAdGroupScore.
 */
export const adGroupScores = mysqlTable("ad_group_scores", {
  id: int("id").autoincrement().primaryKey(),
  adGroupId: varchar("ad_group_id", { length: 64 }).notNull(),
  adGroupName: varchar("ad_group_name", { length: 255 }).notNull(),
  score: int("score").notNull().default(0),
  ctrPct: varchar("ctr_pct", { length: 16 }).notNull().default("0"),
  cpcBrl: varchar("cpc_brl", { length: 16 }).notNull().default("0"),
  convRatePct: varchar("conv_rate_pct", { length: 16 }).notNull().default("0"),
  impressions: int("impressions").notNull().default(0),
  clicks: int("clicks").notNull().default(0),
  conversions: int("conversions").notNull().default(0),
  spendBrl: varchar("spend_brl", { length: 32 }).notNull().default("0"),
  period: varchar("period", { length: 16 }).notNull().default("7d"),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});
export type AdGroupScore = typeof adGroupScores.$inferSelect;
export type InsertAdGroupScore = typeof adGroupScores.$inferInsert;

/**
 * Índice de saúde da conta Google Ads (Account Health Score).
 * Calculado semanalmente pelo job weeklyHealthScore.
 */
export const accountHealthScores = mysqlTable("account_health_scores", {
  id: int("id").autoincrement().primaryKey(),
  overallScore: int("overall_score").notNull().default(0),
  rsaQualityScore: int("rsa_quality_score").notNull().default(0),
  negativeCoverageScore: int("negative_coverage_score").notNull().default(0),
  ctrScore: int("ctr_score").notNull().default(0),
  conversionScore: int("conversion_score").notNull().default(0),
  budgetScore: int("budget_score").notNull().default(0),
  anomalyScore: int("anomaly_score").notNull().default(0),
  details: text("details"),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});
export type AccountHealthScore = typeof accountHealthScores.$inferSelect;
export type InsertAccountHealthScore = typeof accountHealthScores.$inferInsert;

/**
 * Histórico de medições de PageSpeed (mobile + desktop).
 * Medido a cada 2h pelo job pageSpeedMonitor.
 */
export const pagespeedHistory = mysqlTable("pagespeed_history", {
  id: int("id").autoincrement().primaryKey(),
  url: varchar("url", { length: 512 }).notNull(),
  strategy: varchar("strategy", { length: 16 }).notNull(),
  performanceScore: int("performance_score").notNull().default(0),
  accessibilityScore: int("accessibility_score").notNull().default(0),
  seoScore: int("seo_score").notNull().default(0),
  lcpMs: int("lcp_ms").notNull().default(0),
  fidMs: int("fid_ms").notNull().default(0),
  clsX1000: int("cls_x1000").notNull().default(0),
  tbtMs: int("tbt_ms").notNull().default(0),
  speedIndexMs: int("speed_index_ms").notNull().default(0),
  measuredAt: timestamp("measured_at").defaultNow().notNull(),
});
export type PagespeedHistory = typeof pagespeedHistory.$inferSelect;
export type InsertPagespeedHistory = typeof pagespeedHistory.$inferInsert;

/**
 * Whitelist de fornecedores protegidos — nunca negativar esses termos.
 * Gerenciado via UI em /supplier-whitelist.
 */
export const supplierWhitelist = mysqlTable("supplier_whitelist", {
  id: int("id").autoincrement().primaryKey(),
  term: varchar("term", { length: 255 }).notNull(),
  supplierName: varchar("supplier_name", { length: 255 }).notNull(),
  reason: varchar("reason", { length: 512 }).notNull().default("Fornecedor de equipamentos parceiro"),
  active: tinyint("active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SupplierWhitelist = typeof supplierWhitelist.$inferSelect;
export type InsertSupplierWhitelist = typeof supplierWhitelist.$inferInsert;

/**
 * Notificações in-app para o painel do dashboard.
 * Substitui emails de alertas de jobs.
 */
export const inAppNotifications = mysqlTable("in_app_notifications", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  type: varchar("type", { length: 32 }).notNull().default("info"), // info | warning | error | success
  source: varchar("source", { length: 128 }).notNull().default("system"), // job name or system
  read: tinyint("read").notNull().default(0),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type InsertInAppNotification = typeof inAppNotifications.$inferInsert;

/**
 * Feedback do usuário — sugestões e relatórios de bugs.
 * Gerenciado via UI em /feedback.
 */

/**
 * Feedback do usuário — sugestões e relatórios de bugs.
 */
export const userFeedback = mysqlTable("user_feedback", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 32 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  priority: varchar("priority", { length: 16 }).notNull().default("medium"),
  status: varchar("status", { length: 32 }).notNull().default("open"),
  authorName: varchar("author_name", { length: 128 }).notNull().default("Ricardo"),
  authorEmail: varchar("author_email", { length: 255 }),
  page: varchar("page", { length: 255 }),
  adminNotes: text("admin_notes"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type UserFeedback = typeof userFeedback.$inferSelect;
export type InsertUserFeedback = typeof userFeedback.$inferInsert;

/**
 * Uptime checks — histórico de verificações de saúde dos serviços.
 */
export const uptimeChecks = mysqlTable("uptime_checks", {
  id: int("id").autoincrement().primaryKey(),
  service: varchar("service", { length: 128 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  responseTimeMs: int("response_time_ms"),
  errorMessage: varchar("error_message", { length: 512 }),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});
export type UptimeCheck = typeof uptimeChecks.$inferSelect;

// ─── Análise de Landing Pages (Lovable) ──────────────────────────────────────
/**
 * Histórico de análises semanais de landing pages dos anúncios.
 * Inclui PageSpeed, conteúdo extraído, diagnóstico LLM e prompt pronto para o Lovable.
 */
export const landingPageAnalyses = mysqlTable("landing_page_analyses", {
  id: int("id").autoincrement().primaryKey(),
  url: varchar("url", { length: 512 }).notNull(),
  adGroupName: varchar("ad_group_name", { length: 255 }).notNull(),
  campaignName: varchar("campaign_name", { length: 255 }).notNull(),
  pagespeedMobile: int("pagespeed_mobile"),
  pagespeedDesktop: int("pagespeed_desktop"),
  lcpMs: int("lcp_ms"),
  clsScore: varchar("cls_score", { length: 16 }),
  pageTitle: varchar("page_title", { length: 512 }),
  metaDescription: text("meta_description"),
  h1Text: varchar("h1_text", { length: 512 }),
  ctaText: varchar("cta_text", { length: 255 }),
  hasForm: boolean("has_form").default(false),
  hasWhatsapp: boolean("has_whatsapp").default(false),
  wordCount: int("word_count"),
  groupCtr: varchar("group_ctr", { length: 16 }),
  groupCpc: varchar("group_cpc", { length: 16 }),
  groupConversions: int("group_conversions"),
  groupClicks: int("group_clicks"),
  groupSpend: varchar("group_spend", { length: 32 }),
  diagnosisScore: int("diagnosis_score"),
  diagnosisSummary: text("diagnosis_summary"),
  mainIssues: json("main_issues"),
  lovablePrompt: text("lovable_prompt"),
  priority: varchar("priority", { length: 16 }).default("medium"),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
  weekLabel: varchar("week_label", { length: 32 }).notNull(),
});
export type LandingPageAnalysis = typeof landingPageAnalyses.$inferSelect;
export type InsertLandingPageAnalysis = typeof landingPageAnalyses.$inferInsert;

// ─── Relatório Semanal de Gestão Holística ────────────────────────────────────
/**
 * Relatório semanal gerado automaticamente como gestor de tráfego pago.
 * Visão holística de todas as campanhas: diagnóstico, prioridades, ações.
 */
export const weeklyTrafficReviews = mysqlTable("weekly_traffic_reviews", {
  id: int("id").autoincrement().primaryKey(),
  weekLabel: varchar("week_label", { length: 32 }).notNull(),
  totalSpend: varchar("total_spend", { length: 32 }),
  totalClicks: int("total_clicks"),
  totalImpressions: int("total_impressions"),
  totalConversions: int("total_conversions"),
  avgCtr: varchar("avg_ctr", { length: 16 }),
  avgCpc: varchar("avg_cpc", { length: 16 }),
  executiveSummary: text("executive_summary"),
  topPerformers: json("top_performers"),
  underperformers: json("underperformers"),
  urgentActions: json("urgent_actions"),
  weeklyActions: json("weekly_actions"),
  urlIssues: json("url_issues"),
  lpInsights: json("lp_insights"),
  pmaxCtr: varchar("pmax_ctr", { length: 16 }),
  pmaxSpend: varchar("pmax_spend", { length: 32 }),
  pmaxConversions: int("pmax_conversions"),
  pmaxDiagnosis: text("pmax_diagnosis"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  emailSent: boolean("email_sent").default(false),
  status: varchar("status", { length: 16 }).default("pending"),
});
export type WeeklyTrafficReview = typeof weeklyTrafficReviews.$inferSelect;
export type InsertWeeklyTrafficReview = typeof weeklyTrafficReviews.$inferInsert;

// ---- JOB CONFIGS ----
/**
 * Configurações de ativação/desativação de jobs automáticos.
 * Permite pausar/reativar qualquer job sem editar código.
 */
export const jobConfigs = mysqlTable("job_configs", {
  id: int("id").autoincrement().primaryKey(),
  jobName: varchar("job_name", { length: 100 }).notNull().unique(), // ex: "anomalyCheck"
  jobLabel: varchar("job_label", { length: 200 }).notNull(), // ex: "Alertas de Anomalia"
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updated_by", { length: 100 }).default("system"),
});
export type JobConfig = typeof jobConfigs.$inferSelect;
export type InsertJobConfig = typeof jobConfigs.$inferInsert;

// ---- ALERT EMAIL CONFIG ----
/**
 * Configuração de destinatários de e-mail para alertas automáticos do sistema.
 * Campo único com múltiplos e-mails separados por vírgula ou ponto-e-vírgula.
 */
export const alertEmailConfig = mysqlTable("alert_email_config", {
  id: int("id").autoincrement().primaryKey(),
  /** Lista de e-mails separados por vírgula ou ponto-e-vírgula */
  emails: varchar("emails", { length: 2000 }).notNull().default("atendimento@zenite.tech,rjll70@gmail.com"),
  /** Descrição/rótulo da configuração */
  label: varchar("label", { length: 200 }).default("Destinatários de Alertas"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updated_by", { length: 100 }).default("admin"),
});
export type AlertEmailConfig = typeof alertEmailConfig.$inferSelect;
export type InsertAlertEmailConfig = typeof alertEmailConfig.$inferInsert;

// ---- CONVERSION GOALS ----
/**
 * Metas de conversão por produto/grupo de anúncios.
 * Migrado do localStorage para o banco para garantir persistência entre dispositivos.
 */
export const conversionGoals = mysqlTable("conversion_goals", {
  id: int("id").autoincrement().primaryKey(),
  goalId: varchar("goal_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  monthly: int("monthly").notNull().default(10),
  cpaTarget: int("cpa_target").notNull().default(80),
  color: varchar("color", { length: 20 }).notNull().default("#3b82f6"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updated_by", { length: 100 }).default("admin"),
});
export type ConversionGoal = typeof conversionGoals.$inferSelect;
export type InsertConversionGoal = typeof conversionGoals.$inferInsert;

// ---- JOB RUN LOGS ----
/**
 * Registro de execuções dos jobs automáticos do sistema.
 * Permite monitorar status, duração e resultado de cada job.
 */
export const jobRunLogs = mysqlTable("job_run_logs", {
  id: int("id").autoincrement().primaryKey(),
  jobName: varchar("job_name", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("success"),
  message: text("message"),
  durationMs: int("duration_ms"),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});
export type JobRunLog = typeof jobRunLogs.$inferSelect;
export type InsertJobRunLog = typeof jobRunLogs.$inferInsert;

// ---- SYSTEM ERRORS ----
/**
 * Registro dos últimos erros do sistema (jobs, APIs, routers).
 * Exibido no painel de administração para diagnóstico rápido.
 */
export const systemErrors = mysqlTable("system_errors", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 50 }).notNull().default("job"),
  component: varchar("component", { length: 100 }).notNull(),
  message: text("message").notNull(),
  stack: text("stack"),
  metadata: text("metadata"),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});
export type SystemError = typeof systemErrors.$inferSelect;
export type InsertSystemError = typeof systemErrors.$inferInsert;

// ---- DISCREPANCY ALERT LOGS ----
/**
 * Histórico de alertas de discrepância entre GA4 e Google Ads.
 * Registra cada envio de alerta por e-mail com os dados do momento.
 */
export const discrepancyAlertLogs = mysqlTable("discrepancy_alert_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** Período analisado (7d, 30d, 90d) */
  period: varchar("period", { length: 20 }).notNull(),
  /** Conversões Google Ads no momento do alerta */
  adsConversions: int("ads_conversions").notNull().default(0),
  /** Conversões GA4 (canal pago) no momento do alerta */
  ga4Conversions: int("ga4_conversions").notNull().default(0),
  /** Percentual de discrepância no momento do alerta */
  discrepancyPct: int("discrepancy_pct").notNull().default(0),
  /** Threshold configurado no momento do alerta */
  threshold: int("threshold").notNull().default(20),
  /** E-mails destinatários (JSON array) */
  sentTo: text("sent_to"),
  /** Status do envio: success ou error */
  status: varchar("status", { length: 20 }).notNull().default("success"),
  /** Mensagem de erro se falhou */
  errorMessage: text("error_message"),
  /** Quando o alerta foi enviado */
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});
export type DiscrepancyAlertLog = typeof discrepancyAlertLogs.$inferSelect;
export type InsertDiscrepancyAlertLog = typeof discrepancyAlertLogs.$inferInsert;


// ─── DASHBOARD COMPARTILHÁVEL COM CLIENTE ──────────────────────────────────

/**
 * Links de compartilhamento público do dashboard.
 * Cada link gera um token único que dá acesso read-only a métricas filtradas.
 * Pode ser vinculado a um cliente ou ser um link genérico.
 */
export const sharedDashboards = mysqlTable("shared_dashboards", {
  id: int("id").autoincrement().primaryKey(),
  /** Token único para acesso público (UUID v4) */
  token: varchar("token", { length: 64 }).notNull().unique(),
  /** Nome do compartilhamento (ex: "Relatório Wallbox - Abril 2026") */
  name: varchar("name", { length: 255 }).notNull(),
  /** ID do cliente (opcional - pode ser link genérico) */
  clientId: int("client_id"),
  /** Tipo de dashboard compartilhado */
  dashboardType: mysqlEnum("dashboard_type", ["executive_summary", "campaign_detail", "client_report", "custom"]).notNull().default("executive_summary"),
  /** Filtros aplicados (JSON): campanhas, período, métricas visíveis */
  filters: json("filters").$type<{
    campaigns?: string[];
    adGroups?: string[];
    period?: string;
    metrics?: string[];
    customDateStart?: string;
    customDateEnd?: string;
  }>(),
  /** Seções visíveis no dashboard compartilhado */
  visibleSections: json("visible_sections").$type<string[]>().default(["kpis", "funnel", "trends", "adgroups"]),
  /** Mensagem personalizada para o cliente */
  welcomeMessage: text("welcome_message"),
  /** Logo personalizado (URL) */
  customLogo: varchar("custom_logo", { length: 512 }),
  /** Se o link está ativo */
  isActive: boolean("is_active").default(true).notNull(),
  /** Data de expiração (null = sem expiração) */
  expiresAt: timestamp("expires_at"),
  /** Senha de acesso (opcional, hash) */
  accessPassword: varchar("access_password", { length: 255 }),
  /** Contagem de visualizações */
  viewCount: int("view_count").default(0).notNull(),
  /** Última visualização */
  lastViewedAt: timestamp("last_viewed_at"),
  /** Quem criou o link */
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SharedDashboard = typeof sharedDashboards.$inferSelect;
export type InsertSharedDashboard = typeof sharedDashboards.$inferInsert;

// ─── ALERTAS DE E-MAIL GMAIL ────────────────────────────────────────────────
export const gmailAlerts = mysqlTable("gmail_alerts", {
  id: int("id").autoincrement().primaryKey(),
  gmailMessageId: varchar("gmail_message_id", { length: 128 }).notNull().unique(),
  subject: varchar("subject", { length: 512 }).notNull(),
  sender: varchar("sender", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  urgency: mysqlEnum("urgency", ["critical", "warning", "info"]).notNull().default("info"),
  category: mysqlEnum("category_gmail", ["google_ads", "billing", "policy", "performance", "divergence", "other"]).notNull().default("other"),
  divergence: json("divergence").$type<{ type?: string; emailValue?: string; apiValue?: string; description?: string } | null>(),
  isBlinking: boolean("is_blinking").default(true).notNull(),
  isResolved: boolean("is_resolved").default(false).notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 255 }),
  emailDate: timestamp("email_date").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type GmailAlert = typeof gmailAlerts.$inferSelect;
export type InsertGmailAlert = typeof gmailAlerts.$inferInsert;

export const gmailAlertActions = mysqlTable("gmail_alert_actions", {
  id: int("id").autoincrement().primaryKey(),
  alertId: int("alert_id").notNull(),
  actionTaken: text("action_taken").notNull(),
  takenBy: varchar("taken_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GmailAlertAction = typeof gmailAlertActions.$inferSelect;
export type InsertGmailAlertAction = typeof gmailAlertActions.$inferInsert;


/**
 * Instagram content drafts for the creator module.
 * Stores posts, stories and reels before publishing.
 */
export const instagramDrafts = mysqlTable("instagram_drafts", {
  id: int("id").autoincrement().primaryKey(),
  /** Instagram account: zenitetech or avantclube */
  account: varchar("account", { length: 64 }).notNull().default("zenitetech"),
  /** Content type: post, story, reels */
  type: mysqlEnum("type_ig", ["post", "story", "reels"]).notNull().default("post"),
  /** Caption text (includes hashtags) */
  caption: text("caption"),
  /** Hashtags string */
  hashtags: varchar("hashtags", { length: 2200 }),
  /** JSON array of media URLs */
  mediaUrls: json("media_urls").$type<string[]>().notNull(),
  /** JSON array of media types (image/video) */
  mediaTypes: json("media_types").$type<string[]>().notNull(),
  /** Optional scheduled publish date */
  scheduledFor: varchar("scheduled_for", { length: 64 }),
  /** Internal notes */
  notes: text("notes"),
  /** Draft status */
  status: mysqlEnum("status_ig", ["draft", "scheduled", "published", "cancelled"]).notNull().default("draft"),
  /** Instagram media ID returned after successful publish */
  igMediaId: varchar("ig_media_id", { length: 64 }),
  /** Timestamp when the post was actually published to Instagram */
  publishedAt: timestamp("published_at"),
  /** Error message if publish failed (cleared on next attempt) */
  publishError: text("publish_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type InstagramDraft = typeof instagramDrafts.$inferSelect;
export type InsertInstagramDraft = typeof instagramDrafts.$inferInsert;

// ─── CRM DE LEADS ────────────────────────────────────────────────────────────
/**
 * CRM Leads — funil de vendas com origem por campanha e qualificação com IA.
 */
export const crmLeads = mysqlTable("crm_leads", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  company: varchar("company", { length: 255 }),
  source: mysqlEnum("source_crm", ["google_ads", "meta_ads", "organic", "whatsapp", "referral", "other"]).notNull().default("other"),
  sourceCampaign: varchar("source_campaign", { length: 255 }),
  stage: mysqlEnum("stage_crm", ["new", "qualified", "proposal", "closed_won", "closed_lost"]).notNull().default("new"),
  aiScore: int("ai_score"),
  aiNextAction: text("ai_next_action"),
  estimatedValue: int("estimated_value"),
  product: varchar("product", { length: 255 }),
  notes: text("notes"),
  priority: mysqlEnum("priority_crm", ["low", "medium", "high"]).notNull().default("medium"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  lastContactAt: timestamp("last_contact_at"),
  expectedCloseAt: timestamp("expected_close_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CrmLead = typeof crmLeads.$inferSelect;
export type InsertCrmLead = typeof crmLeads.$inferInsert;

/**
 * CRM Activities — histórico de atividades por lead.
 */
export const crmActivities = mysqlTable("crm_activities", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("lead_id").notNull(),
  type: mysqlEnum("activity_type", ["note", "call", "email", "meeting", "whatsapp", "stage_change", "ai_analysis"]).notNull().default("note"),
  description: text("description").notNull(),
  fromStage: varchar("from_stage", { length: 64 }),
  toStage: varchar("to_stage", { length: 64 }),
  author: varchar("author", { length: 255 }).notNull().default("Sistema"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CrmActivity = typeof crmActivities.$inferSelect;
export type InsertCrmActivity = typeof crmActivities.$inferInsert;

// ─── CALENDÁRIO EDITORIAL ────────────────────────────────────────────────────
/**
 * Editorial Calendar — planejamento de posts para Instagram/Facebook.
 */
export const editorialPosts = mysqlTable("editorial_posts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  platform: mysqlEnum("platform_ep", ["instagram", "facebook", "both"]).notNull().default("instagram"),
  contentType: mysqlEnum("content_type_ep", ["post", "story", "reels", "carousel"]).notNull().default("post"),
  caption: text("caption"),
  hashtags: varchar("hashtags", { length: 2200 }),
  instagramDraftId: int("instagram_draft_id"),
  scheduledDate: varchar("scheduled_date", { length: 10 }).notNull(),
  scheduledTime: varchar("scheduled_time", { length: 5 }).notNull().default("09:00"),
  status: mysqlEnum("status_ep", ["planned", "ready", "published", "cancelled"]).notNull().default("planned"),
  publishedPostId: varchar("published_post_id", { length: 255 }),
  reach: int("reach"),
  likes: int("likes"),
  comments: int("comments"),
  shares: int("shares"),
  saves: int("saves"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type EditorialPost = typeof editorialPosts.$inferSelect;
export type InsertEditorialPost = typeof editorialPosts.$inferInsert;

/**
 * Sincronização Diária — Resumo de campanhas Google Ads por dia
 * Populado pelo job dailySyncData.ts às 8h (America/Sao_Paulo)
 */
export const googleAdsSummary = mysqlTable("google_ads_summary", {
  id: int("id").autoincrement().primaryKey(),
  /** Data do resumo: YYYY-MM-DD */
  summaryDate: varchar("summary_date", { length: 10 }).notNull(),
  /** ID da campanha */
  campaignId: varchar("campaign_id", { length: 64 }).notNull(),
  /** Nome da campanha */
  campaignName: varchar("campaign_name", { length: 255 }).notNull(),
  /** Status: ENABLED, PAUSED, REMOVED */
  campaignStatus: varchar("campaign_status", { length: 20 }).default("ENABLED"),
  /** Total de impressões no período */
  impressions: int("impressions").default(0),
  /** Total de cliques no período */
  clicks: int("clicks").default(0),
  /** Custo total em R$ no período */
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0"),
  /** CTR calculado (%) */
  ctr: decimal("ctr", { precision: 5, scale: 2 }).default("0"),
  /** CPC médio em R$ */
  cpc: decimal("cpc", { precision: 8, scale: 2 }).default("0"),
  /** Conversões no período */
  conversions: decimal("conversions", { precision: 8, scale: 2 }).default("0"),
  /** Custo por conversão em R$ */
  costPerConversion: decimal("cost_per_conversion", { precision: 10, scale: 2 }).default("0"),
  /** Quando foi sincronizado */
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});
export type GoogleAdsSummary = typeof googleAdsSummary.$inferSelect;
export type InsertGoogleAdsSummary = typeof googleAdsSummary.$inferInsert;

/**
 * Tabela: sitemap_submissions
 * Histórico de submissões de sitemap ao Google (IndexNow) e Bing.
 * Equivalente ao sitemap_submissions do SCHEMA_BANCO_DADOS.sql.
 */
export const sitemapSubmissions = mysqlTable("sitemap_submissions", {
  id: int("id").autoincrement().primaryKey(),
  /** Serviço: IndexNow, Google Indexing API, Bing */
  service: varchar("service", { length: 50 }).notNull(),
  /** Quantidade de URLs submetidas */
  urlCount: int("url_count").default(0),
  /** Status: success, error, pending */
  status: mysqlEnum("status", ["success", "error", "pending"]).default("pending").notNull(),
  /** HTTP status code da resposta */
  statusCode: int("status_code"),
  /** Resposta completa da API */
  response: text("response"),
  /** Quando foi submetido */
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SitemapSubmission = typeof sitemapSubmissions.$inferSelect;
export type InsertSitemapSubmission = typeof sitemapSubmissions.$inferInsert;

/**
 * Tabela: daily_reports
 * Relatórios diários consolidados com métricas do Google Ads, Instagram e anomalias.
 * Equivalente ao daily_reports do SCHEMA_BANCO_DADOS.sql.
 */
export const dailyReports = mysqlTable("daily_reports", {
  id: int("id").autoincrement().primaryKey(),
  /** Data do relatório: YYYY-MM-DD (único por dia) */
  date: varchar("date", { length: 10 }).notNull().unique(),
  /** Métricas consolidadas do Google Ads (JSON) */
  googleAdsMetrics: json("google_ads_metrics"),
  /** Métricas consolidadas do Instagram (JSON) */
  instagramMetrics: json("instagram_metrics"),
  /** Anomalias detectadas no dia (JSON) */
  anomalies: json("anomalies"),
  /** URL do relatório gerado (PDF ou link) */
  reportUrl: varchar("report_url", { length: 500 }),
  /** Quando o relatório foi enviado por e-mail */
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DailyReport = typeof dailyReports.$inferSelect;
export type InsertDailyReport = typeof dailyReports.$inferInsert;

/**
 * Tabela: instagram_posts
 * Posts individuais do Instagram com métricas de engajamento por post.
 * Complementa instagram_snapshots (que armazena métricas de conta/dia).
 * Equivalente ao instagram_snapshots do SCHEMA_BANCO_DADOS.sql (estrutura por post).
 */
export const instagramPosts = mysqlTable("instagram_posts", {
  id: int("id").autoincrement().primaryKey(),
  /** ID único do post no Instagram */
  postId: varchar("post_id", { length: 255 }).notNull().unique(),
  /** Legenda do post */
  caption: text("caption"),
  /** Tipo de mídia: IMAGE, VIDEO, CAROUSEL_ALBUM, REEL */
  mediaType: varchar("media_type", { length: 50 }),
  /** URL da mídia */
  mediaUrl: varchar("media_url", { length: 500 }),
  /** Data/hora de publicação do post */
  postedAt: timestamp("posted_at"),
  /** Curtidas */
  likes: int("likes").default(0),
  /** Comentários */
  comments: int("comments").default(0),
  /** Engajamento total (likes + comments + saves + shares) */
  engagement: int("engagement").default(0),
  /** Impressões */
  impressions: int("impressions").default(0),
  /** Alcance */
  reach: int("reach").default(0),
  /** Taxa de engajamento calculada (%) */
  engagementRate: decimal("engagement_rate", { precision: 5, scale: 2 }).default("0"),
  /** Quando foi sincronizado */
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type InstagramPost = typeof instagramPosts.$inferSelect;
export type InsertInstagramPost = typeof instagramPosts.$inferInsert;
