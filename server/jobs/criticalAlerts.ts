/**
 * Auto-2: Alerta de orçamento diário esgotado
 * Auto-3: Pausa automática de keywords com CPC > R$5 e zero conversão em 7 dias
 * Auto-4: Relatório diário de performance às 8h
 */
import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { automationExecutionLogs } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { GOOGLE_ADS_REFRESH_TOKEN } from "../credentials";

const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, "") || "";

async function getGoogleAdsClient() {
  const { GoogleAdsApi } = await import("google-ads-api");
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
  });
  return client.Customer({
    customer_id: CUSTOMER_ID,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "") || "",
  });
}

/**
 * Auto-2: Verifica se o orçamento diário foi esgotado antes das 18h
 * Roda a cada hora entre 8h e 18h
 */
export async function runBudgetExhaustionAlert() {
  const startTime = Date.now();
  const results: string[] = [];

  try {
    const customer = await getGoogleAdsClient();
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");

    const campaigns = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.campaign_budget,
        campaign_budget.amount_micros,
        metrics.cost_micros,
        metrics.impressions
      FROM campaign
      WHERE campaign.status = 'ENABLED'
        AND segments.date = '${today}'
    `);

    const alerts: string[] = [];
    for (const row of campaigns) {
      const budget = (row.campaign_budget?.amount_micros || 0) / 1_000_000;
      const spent = (row.metrics?.cost_micros || 0) / 1_000_000;
      const pctUsed = budget > 0 ? (spent / budget) * 100 : 0;
      const hour = new Date().getHours();

      if (pctUsed >= 95 && hour < 18) {
        alerts.push(`🔴 ${row.campaign?.name}: ${pctUsed.toFixed(0)}% do orçamento usado (R$${spent.toFixed(2)} / R$${budget.toFixed(2)}) — ainda são ${hour}h`);
      } else if (pctUsed >= 80 && hour < 14) {
        alerts.push(`⚠️ ${row.campaign?.name}: ${pctUsed.toFixed(0)}% do orçamento usado antes das 14h — risco de esgotar cedo`);
      }
    }

    if (alerts.length > 0) {
      results.push(...alerts);
      await notifyOwner({
        title: `🚨 Alerta de Orçamento — ${alerts.length} campanha(s) em risco`,
        content: alerts.join("\n") + "\n\nAcesse Google Ads para aumentar o orçamento ou aguardar o próximo dia.",
      });
    } else {
      results.push("✅ Orçamentos dentro do limite esperado para o horário atual");
    }

    const dbConn = await getDb();
    await dbConn?.insert(automationExecutionLogs).values({
      automationName: "budgetExhaustionAlert",
      automationLabel: "Alerta de Orçamento Esgotado",
      status: alerts.length > 0 ? "warning" : "success",
      summary: results.join("\n"),
      durationMs: Date.now() - startTime,
      triggeredBy: "schedule",
    }).catch(() => {});

    return { success: true, alerts: alerts.length, results };
  } catch (error: any) {
    console.error("[budgetExhaustionAlert]", error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Auto-3: Pausa automática de keywords com CPC > R$5 e zero conversão em 7 dias
 * Roda diariamente às 7h
 */
export async function runExpensiveKeywordPause() {
  const startTime = Date.now();
  const results: string[] = [];
  const paused: string[] = [];

  try {
    const customer = await getGoogleAdsClient();

    // Buscar keywords com CPC alto e zero conversão nos últimos 7 dias
    const keywords = await customer.query(`
      SELECT
        ad_group_criterion.resource_name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        ad_group.name,
        campaign.name,
        metrics.average_cpc,
        metrics.conversions,
        metrics.cost_micros,
        metrics.clicks
      FROM keyword_view
      WHERE campaign.status = 'ENABLED'
        AND ad_group.status = 'ENABLED'
        AND ad_group_criterion.status = 'ENABLED'
        AND metrics.average_cpc > 5000000
        AND metrics.conversions = 0
        AND metrics.clicks >= 10
        AND segments.date DURING LAST_7_DAYS
    `);

    for (const kw of keywords) {
      const cpc = (kw.metrics?.average_cpc || 0) / 1_000_000;
      const cost = (kw.metrics?.cost_micros || 0) / 1_000_000;
      const kwText = kw.ad_group_criterion?.keyword?.text || "";
      const adGroupName = kw.ad_group?.name || "";
      const campaignName = kw.campaign?.name || "";

      // Pausar keyword via mutate
      await customer.adGroupCriteria.update([{
        resource_name: kw.ad_group_criterion?.resource_name || "",
        status: 2, // PAUSED
      }]).catch(() => {});

      paused.push(`⏸️ "${kwText}" pausada — CPC: R$${cpc.toFixed(2)}, Custo: R$${cost.toFixed(2)}, 0 conversões (${adGroupName} / ${campaignName})`);
    }

    if (paused.length > 0) {
      results.push(...paused);
      await notifyOwner({
        title: `⏸️ ${paused.length} keyword(s) pausada(s) automaticamente`,
        content: `Keywords com CPC > R$5 e zero conversão em 7 dias foram pausadas:\n\n${paused.join("\n")}`,
      });
    } else {
      results.push("✅ Nenhuma keyword com CPC > R$5 e zero conversão encontrada nos últimos 7 dias");
    }

    const dbConn = await getDb();
    await dbConn?.insert(automationExecutionLogs).values({
      automationName: "expensiveKeywordPause",
      automationLabel: "Pausa de Keywords Caras sem Conversão",
      status: paused.length > 0 ? "warning" : "success",
      summary: results.join("\n"),
      durationMs: Date.now() - startTime,
      triggeredBy: "schedule",
    }).catch(() => {});

    return { success: true, paused: paused.length, results };
  } catch (error: any) {
    console.error("[expensiveKeywordPause]", error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Auto-4: Relatório diário de performance às 8h
 * Gasta, conversões, CTR, anomalias e sugestão de ação via IA
 */
export async function runDailyPerformanceReport() {
  const startTime = Date.now();

  try {
    const customer = await getGoogleAdsClient();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0].replace(/-/g, "");

    // Métricas do dia anterior
    const [campaignMetrics, adGroupMetrics] = await Promise.all([
      customer.query(`
        SELECT
          campaign.name,
          campaign.status,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.ctr,
          metrics.conversions,
          metrics.average_cpc
        FROM campaign
        WHERE campaign.status != 'REMOVED'
          AND segments.date = '${dateStr}'
      `),
      customer.query(`
        SELECT
          ad_group.name,
          campaign.name,
          metrics.cost_micros,
          metrics.clicks,
          metrics.ctr,
          metrics.conversions,
          metrics.average_cpc
        FROM ad_group
        WHERE ad_group.status = 'ENABLED'
          AND campaign.status = 'ENABLED'
          AND segments.date = '${dateStr}'
        ORDER BY metrics.cost_micros DESC
        LIMIT 10
      `),
    ]);

    // Calcular totais
    let totalCost = 0, totalClicks = 0, totalConversions = 0, totalImpressions = 0;
    const campaignSummaries: string[] = [];

    for (const row of campaignMetrics) {
      const cost = (row.metrics?.cost_micros || 0) / 1_000_000;
      const clicks = row.metrics?.clicks || 0;
      const conversions = row.metrics?.conversions || 0;
      const ctr = ((row.metrics?.ctr || 0) * 100).toFixed(2);
      const impressions = row.metrics?.impressions || 0;

      totalCost += cost;
      totalClicks += clicks;
      totalConversions += conversions;
      totalImpressions += impressions;

      if (cost > 0) {
        campaignSummaries.push(`• ${row.campaign?.name}: R$${cost.toFixed(2)} | ${clicks} cliques | CTR ${ctr}% | ${conversions} conv.`);
      }
    }

    // Top grupos do dia
    const topGroups = adGroupMetrics.slice(0, 5).map((row: any) => {
      const cost = (row.metrics?.cost_micros || 0) / 1_000_000;
      const ctr = ((row.metrics?.ctr || 0) * 100).toFixed(2);
      return `  - ${row.ad_group?.name}: R$${cost.toFixed(2)}, CTR ${ctr}%, ${row.metrics?.conversions || 0} conv.`;
    });

    // Gerar análise via IA
    const aiAnalysis = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Você é um especialista em Google Ads B2B. Analise os dados de performance e forneça 2-3 insights acionáveis em português, de forma concisa (máx. 3 linhas por insight).",
        },
        {
          role: "user",
          content: `Dados de ontem (${yesterday.toLocaleDateString("pt-BR")}):
Gasto total: R$${totalCost.toFixed(2)}
Cliques: ${totalClicks}
Impressões: ${totalImpressions}
Conversões: ${totalConversions}
CTR médio: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%
CPA: R$${totalConversions > 0 ? (totalCost / totalConversions).toFixed(2) : "∞"}

Por campanha:
${campaignSummaries.join("\n")}

Top grupos por gasto:
${topGroups.join("\n")}`,
        },
      ],
    }).catch(() => ({ choices: [{ message: { content: "Análise indisponível no momento." } }] }));

    const aiInsights = (aiAnalysis as any)?.choices?.[0]?.message?.content || "Análise indisponível.";

    const reportContent = `📊 **Relatório Diário — ${yesterday.toLocaleDateString("pt-BR")}**

**Resumo Geral:**
• Gasto: R$${totalCost.toFixed(2)}
• Cliques: ${totalClicks}
• Impressões: ${totalImpressions.toLocaleString("pt-BR")}
• Conversões: ${totalConversions}
• CTR médio: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%
• CPA: R$${totalConversions > 0 ? (totalCost / totalConversions).toFixed(2) : "∞"}

**Por Campanha:**
${campaignSummaries.join("\n") || "Nenhuma campanha com gasto ontem"}

**Top Grupos por Gasto:**
${topGroups.join("\n") || "Sem dados"}

**Insights IA:**
${aiInsights}`;

    await notifyOwner({
      title: `📊 Relatório Diário Google Ads — ${yesterday.toLocaleDateString("pt-BR")}`,
      content: reportContent,
    });

    const dbConn = await getDb();
    await dbConn?.insert(automationExecutionLogs).values({
      automationName: "dailyPerformanceReport",
      automationLabel: "Relatório Diário de Performance",
      status: "success",
      summary: `Gasto: R$${totalCost.toFixed(2)} | Cliques: ${totalClicks} | Conversões: ${totalConversions}`,
      durationMs: Date.now() - startTime,
      triggeredBy: "schedule",
    }).catch(() => {});

    console.log("[dailyPerformanceReport] Relatório enviado:", {
      totalCost, totalClicks, totalConversions
    });

    return { success: true, totalCost, totalClicks, totalConversions };
  } catch (error: any) {
    console.error("[dailyPerformanceReport]", error?.message);
    return { success: false, error: error?.message };
  }
}
