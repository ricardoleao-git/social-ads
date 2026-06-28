/**
 * Google Sheets Sync Utility
 * 
 * Funcionalidade para sincronizar dados do dashboard com Google Sheets automaticamente.
 * Requer upgrade para web-db-user para implementar backend com agendamento.
 *
 * ⚠️  AVISO DE SEGURANÇA:
 * Este arquivo contém APENAS templates e interfaces — não executa código em runtime.
 * GOOGLE_SERVICE_ACCOUNT_KEY e GOOGLE_SHEETS_ID NÃO devem ser lidos no frontend.
 * A lógica de sincronização DEVE ser implementada no servidor (server/routers/).
 * Referência: server/routers/leadsSheet.ts
 */

export interface SheetSyncConfig {
  spreadsheetId: string;
  sheetName: string;
  range: string;
  serviceAccountKey?: string;
}

export interface CampaignDataForSheet {
  name: string;
  ctr: number;
  cpc: number;
  clicks: number;
  conversions: number;
  spend: number;
  roi: number;
  roas: number;
  timestamp: string;
}

/**
 * FASE 1: Configuração do Google Sheets
 * 
 * Passos:
 * 1. Criar planilha no Google Sheets
 * 2. Copiar ID da planilha (URL: /spreadsheets/d/{SHEET_ID}/edit)
 * 3. Criar Service Account no Google Cloud Console
 * 4. Fazer download da chave JSON
 * 5. Compartilhar planilha com o e-mail do Service Account
 */

/**
 * FASE 2: Template para Backend (Node.js + Express)
 * 
 * Instalar dependências:
 * npm install googleapis google-auth-library
 * 
 * Implementação:
 */
export const backendSyncTemplate = `
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets('v4');

export async function syncCampaignsToGoogleSheets(campaigns: CampaignDataForSheet[]) {
  try {
    const values = campaigns.map(c => [
      c.name,
      c.ctr.toFixed(2),
      c.cpc.toFixed(2),
      c.clicks,
      c.conversions,
      c.spend.toFixed(2),
      c.roi.toFixed(2),
      c.roas.toFixed(2),
      c.timestamp,
    ]);

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Performance!A2',
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    console.log('✅ Sincronização com Google Sheets concluída');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao sincronizar com Google Sheets:', error);
    throw error;
  }
}
`;

/**
 * FASE 3: Agendamento Automático (node-cron)
 * 
 * Instalar: npm install node-cron
 * 
 * Implementação:
 */
export const cronScheduleTemplate = `
import cron from 'node-cron';
import { syncCampaignsToGoogleSheets } from './googleSheetSync';

// Sincronizar todos os dias às 8 AM (horário do servidor)
cron.schedule('0 8 * * *', async () => {
  try {
    const campaigns = await fetchCampaignsFromGoogleAds();
    await syncCampaignsToGoogleSheets(campaigns);
    console.log('✅ Sincronização diária concluída com sucesso');
  } catch (error) {
    console.error('❌ Erro na sincronização diária:', error);
    // Enviar notificação de erro por e-mail
  }
});

// Sincronizar a cada 30 minutos durante o horário comercial
cron.schedule('*/30 9-18 * * 1-5', async () => {
  try {
    const campaigns = await fetchCampaignsFromGoogleAds();
    await syncCampaignsToGoogleSheets(campaigns);
    console.log('✅ Sincronização a cada 30 minutos concluída');
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
  }
});
`;

/**
 * FASE 4: Endpoint API para Sincronização Manual
 * 
 * Implementação:
 */
export const manualSyncEndpoint = `
// POST /api/google-sheets/sync
app.post('/api/google-sheets/sync', async (req, res) => {
  try {
    const campaigns = await fetchCampaignsFromGoogleAds();
    const result = await syncCampaignsToGoogleSheets(campaigns);
    
    res.json({
      success: true,
      message: 'Sincronização concluída com sucesso',
      rowsUpdated: result.updatedRows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
`;

/**
 * FASE 5: Hook React para Sincronização Manual
 * 
 * Uso no componente:
 */
import { useState } from 'react';

export const useSyncToGoogleSheets = () => {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncNow = async () => {
    setSyncing(true);
    setError(null);

    try {
      const response = await fetch('/api/google-sheets/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao sincronizar com Google Sheets');
      }

      const data = await response.json();
      setLastSync(new Date());
      return data;
    } catch (err: any) {
      setError(err?.message || 'Erro desconhecido');
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  return { syncNow, syncing, lastSync, error };
};

/**
 * FASE 6: Estrutura da Planilha Google Sheets
 * 
 * Cabeçalhos (Linha 1):
 * A: Campanha
 * B: CTR (%)
 * C: CPC (R$)
 * D: Cliques
 * E: Conversões
 * F: Gasto (R$)
 * G: ROI (%)
 * H: ROAS (x)
 * I: Data/Hora
 * 
 * Formatação recomendada:
 * - Coluna A: Texto
 * - Coluna B-H: Número (2 casas decimais)
 * - Coluna I: Data/Hora
 * - Linha 1: Negrito + Cor de fundo cinza
 * - Congelamento da linha 1
 */

/**
 * FASE 7: Variáveis de Ambiente Necessárias
 * 
 * .env:
 * GOOGLE_SHEETS_ID=seu_sheet_id
 * GOOGLE_SERVICE_ACCOUNT_KEY=path/to/service-account-key.json
 * SYNC_SCHEDULE_DAILY=0 8 * * * (cron expression)
 * SYNC_SCHEDULE_HOURLY=0 * * * * (a cada hora)
 */

/**
 * PRÓXIMOS PASSOS:
 * 
 * 1. Upgrade para web-db-user (adiciona backend)
 * 2. Configurar Google Sheets API no Google Cloud Console
 * 3. Criar Service Account e fazer download da chave JSON
 * 4. Implementar backend com node-cron
 * 5. Criar endpoints API para sincronização
 * 6. Testar sincronização manual e automática
 * 7. Configurar alertas para falhas de sincronização
 * 8. Documentar processo para stakeholders
 */
