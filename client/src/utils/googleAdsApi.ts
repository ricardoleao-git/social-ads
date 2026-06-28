/**
 * Google Ads API Integration Template
 * 
 * Este arquivo contém templates e funções para integração com a Google Ads API.
 * Requer upgrade para web-db-user para implementar backend com autenticação OAuth.
 * 
 * Funcionalidades:
 * - Autenticação OAuth com Google Ads
 * - Fetch de dados de campanhas, grupos de anúncios, keywords
 * - Cálculo de métricas (CTR, CPC, ROI, ROAS)
 * - Sincronização de dados em tempo real
 */

export interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string; // Google Ads Customer ID (sem hífens)
}

export interface CampaignData {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  roi: number;
  roas: number;
}

export interface AdGroupData {
  id: string;
  campaignId: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  spend: number;
}

/**
 * FASE 1: Autenticação OAuth
 * 
 * Passos para implementar:
 * 1. Criar aplicação no Google Cloud Console
 * 2. Gerar Client ID e Client Secret
 * 3. Configurar redirect URI: https://seu-dominio.com/auth/callback
 * 4. Armazenar credenciais em variáveis de ambiente (backend)
 */
export const googleAdsAuthUrl = (clientId: string, redirectUri: string) => {
  const scope = 'https://www.googleapis.com/auth/adwords';
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline`;
};

/**
 * FASE 2: Fetch de Dados (Backend)
 * 
 * Implementar no backend (Node.js/Express):
 * 
 * ```typescript
 * import { GoogleAdsApi, enums } from 'google-ads-api';
 * 
 * const client = new GoogleAdsApi({
 *   client_id: process.env.GOOGLE_ADS_CLIENT_ID,
 *   client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
 *   developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
 * });
 * 
 * const customer = client.Customer({
 *   customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
 *   refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
 * });
 * 
 * // Fetch campanhas
 * const campaigns = await customer.query(`
 *   SELECT campaign.id, campaign.name, campaign.status,
 *          metrics.impressions, metrics.clicks, metrics.conversions,
 *          metrics.cost_micros
 *   FROM campaign
 *   WHERE segments.date BETWEEN '2026-03-01' AND '2026-04-01'
 * `);
 * ```
 */

/**
 * FASE 3: Cálculo de Métricas
 */
export const calculateMetrics = (data: {
  clicks: number;
  conversions: number;
  impressions: number;
  spend: number;
  aov?: number; // Average Order Value em centavos
}) => {
  const { clicks, conversions, impressions, spend, aov = 10000 } = data;

  return {
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    revenue: (conversions * aov) / 100,
    roi: spend > 0 ? (((conversions * aov) / 100 - spend) / spend) * 100 : 0,
    roas: spend > 0 ? ((conversions * aov) / 100) / spend : 0,
  };
};

/**
 * FASE 4: Sincronização com Google Sheets
 * 
 * Implementar no backend com Google Sheets API:
 * 
 * ```typescript
 * import { google } from 'googleapis';
 * 
 * const sheets = google.sheets('v4');
 * 
 * // Atualizar planilha com dados do Google Ads
 * await sheets.spreadsheets.values.update({
 *   spreadsheetId: process.env.GOOGLE_SHEETS_ID,
 *   range: 'Performance!A1',
 *   valueInputOption: 'RAW',
 *   requestBody: {
 *     values: campaignData.map(c => [
 *       c.name, c.clicks, c.conversions, c.ctr, c.cpc, c.roi
 *     ])
 *   }
 * });
 * ```
 */

/**
 * FASE 5: Sistema de Alertas
 * 
 * Monitorar quedas de performance:
 */
export const checkPerformanceAlerts = (
  current: CampaignData,
  previous: CampaignData
) => {
  const alerts: Array<{
    type: 'CTR_DROP' | 'SPEND_SPIKE' | 'CONVERSION_DROP' | 'ROI_DROP';
    severity: 'HIGH' | 'MEDIUM';
    message: string;
  }> = [];

  // CTR caiu > 20%
  if (previous.ctr > 0 && (current.ctr / previous.ctr) < 0.8) {
    alerts.push({
      type: 'CTR_DROP',
      severity: 'HIGH',
      message: `CTR caiu de ${previous.ctr.toFixed(2)}% para ${current.ctr.toFixed(2)}%`,
    });
  }

  // Gasto aumentou > 30%
  if (previous.spend > 0 && (current.spend / previous.spend) > 1.3) {
    alerts.push({
      type: 'SPEND_SPIKE',
      severity: 'MEDIUM',
      message: `Gasto aumentou de R$ ${previous.spend.toFixed(2)} para R$ ${current.spend.toFixed(2)}`,
    });
  }

  // ROI caiu abaixo de 100%
  if (current.roi < 100) {
    alerts.push({
      type: 'ROI_DROP',
      severity: 'HIGH',
      message: `ROI abaixo de 100%: ${current.roi.toFixed(2)}%`,
    });
  }

  return alerts;
};

/**
 * FASE 6: Fetch Frontend (com backend proxy)
 * 
 * Após implementar backend:
 */
export const fetchCampaignsFromBackend = async () => {
  try {
    const response = await fetch('/api/google-ads/campaigns', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch campaigns');
    return await response.json();
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return [];
  }
};

/**
 * PRÓXIMOS PASSOS:
 * 
 * 1. Upgrade para web-db-user (adiciona backend + database)
 * 2. Implementar autenticação OAuth no backend
 * 3. Criar endpoints API para fetch de dados
 * 4. Configurar Google Sheets API para sincronização
 * 5. Implementar sistema de alertas com SendGrid/SMTP
 * 6. Adicionar agendamento diário com node-cron
 */
