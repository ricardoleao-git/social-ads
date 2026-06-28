export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // GA4 Data API — G-XN8107LBV6 (zenitetech.com)
  ga4ServiceAccountJson: process.env.GA4_SERVICE_ACCOUNT_JSON ?? "",
  ga4PropertyId: process.env.GA4_PROPERTY_ID ?? "",
  // Google Ads API
  GOOGLE_ADS_CUSTOMER_ID: process.env.GOOGLE_ADS_CUSTOMER_ID ?? "",
  GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
  GOOGLE_ADS_REFRESH_TOKEN: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
  GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
  GOOGLE_ADS_CLIENT_SECRET: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "",
  // Token management — data de criação do refresh token para calcular expiração
  GOOGLE_ADS_TOKEN_CREATED_AT: process.env.GOOGLE_ADS_TOKEN_CREATED_AT ?? "2026-04-26",
  // Integration
  INTEGRATION_API_KEY: process.env.INTEGRATION_API_KEY ?? "",
};
