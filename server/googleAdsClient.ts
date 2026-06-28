/**
 * Google Ads API client helper for Node.js (google-ads-api library)
 *
 * ⚠️  NÃO coloque tokens ou IDs aqui.
 *     Todos os valores vêm de server/credentials.ts (ponto único de verdade).
 *
 * NOTA: Não usa singleton para garantir que as credenciais do credentials.ts
 *       (que têm fallback hardcoded para o app correto) sejam sempre usadas.
 */
import { GoogleAdsApi } from "google-ads-api";
import {
  GOOGLE_ADS_REFRESH_TOKEN,
  GOOGLE_ADS_CUSTOMER_ID,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
} from "./credentials";

export function getGoogleAdsClient(): GoogleAdsApi {
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET) {
    throw new Error(
      "Missing Google Ads credentials. Please set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET."
    );
  }

  return new GoogleAdsApi({
    client_id: GOOGLE_ADS_CLIENT_ID,
    client_secret: GOOGLE_ADS_CLIENT_SECRET,
    developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
  });
}

export function getCustomerId(): string {
  return GOOGLE_ADS_CUSTOMER_ID;
}

export function getRefreshToken(): string {
  return GOOGLE_ADS_REFRESH_TOKEN;
}

export function getLoginCustomerId(): string | undefined {
  return GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined;
}
