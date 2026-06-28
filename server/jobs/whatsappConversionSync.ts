/**
 * Auto-1: Verificação e importação automática do whatsapp_click no Google Ads
 * Roda diariamente às 9h — verifica se o evento whatsapp_click do GA4
 * já está disponível para importação no Google Ads e notifica o owner.
 */
import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { automationExecutionLogs } from "../../drizzle/schema";
import { GOOGLE_ADS_REFRESH_TOKEN } from "../credentials";

const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || "";
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "";

export async function runWhatsappConversionSync() {
  const startTime = Date.now();
  const results: string[] = [];

  try {
    // Verificar via Google Ads API se o whatsapp_click já está disponível como conversão
    const { GoogleAdsApi } = await import("google-ads-api");

    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    });

    const customer = client.Customer({
      customer_id: CUSTOMER_ID,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
      login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "",
    });

    // Buscar conversões existentes do GA4
    const conversions = await customer.query(`
      SELECT
        conversion_action.name,
        conversion_action.status,
        conversion_action.type,
        conversion_action.tag_snippets
      FROM conversion_action
      WHERE conversion_action.type = 'GOOGLE_ANALYTICS_4'
        AND conversion_action.status != 'REMOVED'
    `);

    const whatsappConversion = conversions.find((c: any) =>
      c.conversion_action?.name?.toLowerCase().includes("whatsapp")
    );

    if (whatsappConversion) {
      const status = whatsappConversion.conversion_action?.status;
      if (status === "ENABLED") {
        results.push(`✅ whatsapp_click já está ATIVO como conversão no Google Ads`);
        results.push(`   Nome: ${whatsappConversion.conversion_action?.name}`);
      } else if (status === "HIDDEN") {
        results.push(`⚠️ whatsapp_click existe mas está OCULTO — ativar manualmente`);
        results.push(`   Acesse: Google Ads → Metas → Conversões → editar → Ativar`);
        await notifyOwner({
          title: "⚠️ whatsapp_click oculto no Google Ads",
          content: `A conversão whatsapp_click existe no Google Ads mas está com status HIDDEN. Acesse Google Ads → Metas → Conversões e ative-a manualmente.`,
        });
      }
    } else {
      results.push(`❌ whatsapp_click NÃO encontrado como conversão no Google Ads`);
      results.push(`   Ação: Aguardar evento ocorrer no GA4 e importar manualmente`);
      results.push(`   URL: ads.google.com → Metas → Conversões → Criar → Importar GA4`);
      await notifyOwner({
        title: "📋 whatsapp_click ainda não importado no Google Ads",
        content: `O evento whatsapp_click ainda não aparece na lista de conversões do Google Ads. Assim que ocorrer no site, acesse: Google Ads → Metas → Conversões → Criar → Importar → Google Analytics 4 → selecionar whatsapp_click.`,
      });
    }

    // Salvar log
    const dbConn = await getDb();
    await dbConn?.insert(automationExecutionLogs).values({
      automationName: "whatsappConversionSync",
      automationLabel: "Sync Conversão WhatsApp",
      status: "success",
      summary: results.join("\n"),
      durationMs: Date.now() - startTime,
      triggeredBy: "schedule",
    }).catch(() => {}); // Silenciar erro se tabela não existir

    console.log("[whatsappConversionSync]", results.join("\n"));
    return { success: true, results };
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    console.error("[whatsappConversionSync] Erro:", errMsg);
    return { success: false, error: errMsg };
  }
}
