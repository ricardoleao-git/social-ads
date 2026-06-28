/**
 * Script para marcar whatsapp_click como evento de conversão no GA4
 * via Google Analytics Admin API
 */
import * as dotenv from 'dotenv';
dotenv.config();

const propertyId = process.env.GA4_PROPERTY_ID;
const serviceAccountJson = process.env.GA4_SERVICE_ACCOUNT_JSON;

if (!propertyId || !serviceAccountJson) {
  console.error('GA4_PROPERTY_ID ou GA4_SERVICE_ACCOUNT_JSON não configurados');
  process.exit(1);
}

console.log('Property ID:', propertyId);

// Parse service account
let serviceAccount: any;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
  console.log('Service account email:', serviceAccount.client_email);
} catch (e) {
  console.error('Erro ao parsear GA4_SERVICE_ACCOUNT_JSON:', e);
  process.exit(1);
}

// Usar a Google Analytics Admin API para marcar evento como conversão
// Endpoint: PATCH https://analyticsadmin.googleapis.com/v1beta/properties/{property}/conversionEvents
// Ou criar via: POST https://analyticsadmin.googleapis.com/v1beta/properties/{property}/conversionEvents

import { GoogleAuth } from 'google-auth-library';

async function markAsConversion() {
  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/analytics.edit'],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  
  if (!token.token) {
    console.error('Não foi possível obter token de acesso');
    process.exit(1);
  }

  console.log('Token obtido com sucesso');

  // Listar eventos de conversão existentes
  const listUrl = `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/conversionEvents`;
  const listResponse = await fetch(listUrl, {
    headers: {
      'Authorization': `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
  });

  const listData = await listResponse.json() as any;
  console.log('Eventos de conversão existentes:', JSON.stringify(listData, null, 2));

  // Verificar se whatsapp_click já existe
  const existingEvents = listData.conversionEvents || [];
  const whatsappExists = existingEvents.find((e: any) => e.eventName === 'whatsapp_click');
  
  if (whatsappExists) {
    console.log('✅ whatsapp_click já está marcado como evento de conversão!');
    console.log('Detalhes:', JSON.stringify(whatsappExists, null, 2));
    return;
  }

  // Criar evento de conversão whatsapp_click
  console.log('\nCriando evento de conversão whatsapp_click...');
  const createResponse = await fetch(listUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      eventName: 'whatsapp_click',
    }),
  });

  const createData = await createResponse.json() as any;
  
  if (createResponse.ok) {
    console.log('✅ whatsapp_click marcado como evento de conversão com sucesso!');
    console.log('Resultado:', JSON.stringify(createData, null, 2));
  } else {
    console.error('❌ Erro ao criar evento de conversão:', JSON.stringify(createData, null, 2));
  }
}

markAsConversion().catch(console.error);
