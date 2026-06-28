/**
 * ============================================================
 * CENTRAL CREDENTIALS — Zênite Tech Dashboard
 * ============================================================
 * Ponto único de importação para tokens, IDs e credenciais.
 *
 * REGRA: segredos NUNCA ficam hardcoded. Todos vêm de variáveis
 *        de ambiente (.env — não versionado). Veja .env.example.
 *
 * IDs públicos (customer ID, campanha, página, etc.) não são
 * segredos e podem ter fallback hardcoded para conveniência.
 * ============================================================
 */

// ─── SEGREDOS (somente via ambiente) ─────────────────────────
export const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || "";
export const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || "";
export const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN || "";
export const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
export const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN || "";
export const META_ACCESS_TOKEN = process.env.META_ADS_ACCESS_TOKEN || "";
export const INTEGRATION_API_KEY = process.env.INTEGRATION_API_KEY || "";

// ─── IDs PÚBLICOS (não-secretos; fallback permitido) ─────────
export const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || "";
export const GOOGLE_ADS_LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "";
export const GOOGLE_ADS_MAIN_CAMPAIGN_ID = process.env.GOOGLE_ADS_MAIN_CAMPAIGN_ID || "";
export const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "";

// IDs fixos da conta Zênite Tech (públicos — não mudam)
export const META_PAGE_ID = process.env.META_PAGE_ID || "314981148545042";
export const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || "17841406636761935";
export const META_APP_ID = process.env.META_APP_ID || "1275143434784515";
export const META_BUSINESS_ID = process.env.META_BUSINESS_ID || "781288252291861";

// ─── AVISO DE CONFIGURAÇÃO ───────────────────────────────────
// Em vez de quebrar os jobs, apenas alerta no boot se faltar segredo crítico.
const REQUIRED_SECRETS: Record<string, string> = {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
  GOOGLE_ADS_DEVELOPER_TOKEN,
};
const missing = Object.entries(REQUIRED_SECRETS)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length > 0) {
  console.warn(
    `[credentials] Variáveis de ambiente ausentes: ${missing.join(", ")}. ` +
      `Configure-as no .env (veja .env.example).`
  );
}

// ─── ALERTAS DE RENOVAÇÃO DE TOKENS ─────────────────────────
// Datas configuráveis por ambiente (YYYY-MM-DD). Google revoga após ~6 meses sem uso.
export const TOKEN_EXPIRY_DATES = {
  googleAds: process.env.GOOGLE_ADS_TOKEN_EXPIRES_AT
    ? new Date(process.env.GOOGLE_ADS_TOKEN_EXPIRES_AT)
    : null,
  gmail: process.env.GMAIL_TOKEN_EXPIRES_AT
    ? new Date(process.env.GMAIL_TOKEN_EXPIRES_AT)
    : null,
  meta: null, // Token de Página — não expira
} as Record<string, Date | null>;

// Verifica se algum token vai vencer em menos de 30 dias
export function getTokenAlerts(): { token: string; daysLeft: number; expiresAt: string }[] {
  const alerts: { token: string; daysLeft: number; expiresAt: string }[] = [];
  const now = new Date();
  for (const [name, expiry] of Object.entries(TOKEN_EXPIRY_DATES)) {
    if (!expiry) continue;
    const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 30) {
      alerts.push({ token: name, daysLeft, expiresAt: expiry.toLocaleDateString("pt-BR") });
    }
  }
  return alerts;
}
