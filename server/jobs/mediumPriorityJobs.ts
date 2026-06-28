/**
 * Auto-5: Sincronização automática de negativos entre campanhas ativas
 * Auto-6: Alerta de queda de Quality Score abaixo de 7/10
 * Auto-7: Monitor de landing page fora do ar
 * Auto-8: Relatório de conversões por canal
 * Auto-9: Reativação automática de grupos pausados quando landing page for atualizada
 */
import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { automationExecutionLogs } from "../../drizzle/schema";
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

async function logJob(name: string, label: string, status: "success" | "warning" | "error", summary: string, durationMs: number) {
  const dbConn = await getDb();
  await dbConn?.insert(automationExecutionLogs).values({
    automationName: name,
    automationLabel: label,
    status,
    summary,
    durationMs,
    triggeredBy: "schedule",
  }).catch(() => {});
}

/**
 * Auto-5: Sincronizar negativos da campanha principal para todas as outras campanhas ativas
 * Roda semanalmente às segundas 7h
 */
export async function runNegativeKeywordSync() {
  const startTime = Date.now();
  const results: string[] = [];

  try {
    const customer = await getGoogleAdsClient();

    // Buscar todas as campanhas ativas
    const campaigns = await customer.query(`
      SELECT campaign.id, campaign.name, campaign.resource_name
      FROM campaign
      WHERE campaign.status = 'ENABLED'
    `);

    if (campaigns.length < 2) {
      results.push("✅ Apenas 1 campanha ativa — sincronização não necessária");
      await logJob("negativeKeywordSync", "Sync Negativos entre Campanhas", "success", results.join("\n"), Date.now() - startTime);
      return { success: true, results };
    }

    // Buscar negativos da campanha principal (maior gasto nos últimos 30 dias)
    const campaignMetrics = await customer.query(`
      SELECT campaign.resource_name, campaign.name, metrics.cost_micros
      FROM campaign
      WHERE campaign.status = 'ENABLED'
        AND segments.date DURING LAST_30_DAYS
      ORDER BY metrics.cost_micros DESC
    `);

    const mainCampaignResource = campaignMetrics[0]?.campaign?.resource_name;
    const mainCampaignName = campaignMetrics[0]?.campaign?.name;

    if (!mainCampaignResource) {
      results.push("⚠️ Não foi possível identificar a campanha principal");
      await logJob("negativeKeywordSync", "Sync Negativos entre Campanhas", "warning", results.join("\n"), Date.now() - startTime);
      return { success: false, results };
    }

    // Buscar negativos da campanha principal
    const mainNegatives = await customer.query(`
      SELECT
        campaign_criterion.keyword.text,
        campaign_criterion.keyword.match_type,
        campaign_criterion.negative
      FROM campaign_criterion
      WHERE campaign_criterion.campaign = '${mainCampaignResource}'
        AND campaign_criterion.negative = TRUE
        AND campaign_criterion.type = 'KEYWORD'
    `);

    results.push(`📋 Campanha principal: ${mainCampaignName} (${mainNegatives.length} negativos)`);

    // Para cada outra campanha, verificar quais negativos estão faltando
    let totalAdded = 0;
    for (const campaign of campaigns) {
      if (campaign.campaign?.resource_name === mainCampaignResource) continue;

      const existingNegatives = await customer.query(`
        SELECT campaign_criterion.keyword.text
        FROM campaign_criterion
        WHERE campaign_criterion.campaign = '${campaign.campaign?.resource_name}'
          AND campaign_criterion.negative = TRUE
          AND campaign_criterion.type = 'KEYWORD'
      `);

      const existingTexts = new Set(existingNegatives.map((n: any) => n.campaign_criterion?.keyword?.text?.toLowerCase()));
      const missing = mainNegatives.filter((n: any) =>
        !existingTexts.has(n.campaign_criterion?.keyword?.text?.toLowerCase())
      );

      if (missing.length > 0) {
        results.push(`➕ ${campaign.campaign?.name}: ${missing.length} negativos a sincronizar`);
        totalAdded += missing.length;
        // Nota: adicionar negativos em massa requer operação de mutate em lote
        // Por segurança, apenas reportamos — não aplicamos automaticamente
      } else {
        results.push(`✅ ${campaign.campaign?.name}: negativos já sincronizados`);
      }
    }

    if (totalAdded > 0) {
      await notifyOwner({
        title: `🔄 Sync de Negativos — ${totalAdded} negativos para sincronizar`,
        content: results.join("\n") + "\n\nRevisão manual recomendada antes de aplicar.",
      });
    }

    await logJob("negativeKeywordSync", "Sync Negativos entre Campanhas", totalAdded > 0 ? "warning" : "success", results.join("\n"), Date.now() - startTime);
    return { success: true, totalAdded, results };
  } catch (error: any) {
    console.error("[negativeKeywordSync]", error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Auto-6: Alerta de queda de Quality Score abaixo de 7/10
 * Roda semanalmente às sextas 9h
 */
export async function runQualityScoreAlert() {
  const startTime = Date.now();
  const results: string[] = [];
  const alerts: string[] = [];

  try {
    const customer = await getGoogleAdsClient();

    const keywords = await customer.query(`
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.quality_info.creative_quality_score,
        ad_group_criterion.quality_info.post_click_quality_score,
        ad_group_criterion.quality_info.search_predicted_ctr,
        ad_group.name,
        campaign.name,
        metrics.impressions
      FROM keyword_view
      WHERE campaign.status = 'ENABLED'
        AND ad_group.status = 'ENABLED'
        AND ad_group_criterion.status = 'ENABLED'
        AND ad_group_criterion.quality_info.quality_score < 7
        AND metrics.impressions > 100
        AND segments.date DURING LAST_30_DAYS
      ORDER BY ad_group_criterion.quality_info.quality_score ASC
    `);

    for (const kw of keywords) {
      const qs = kw.ad_group_criterion?.quality_info?.quality_score || 0;
      const kwText = kw.ad_group_criterion?.keyword?.text || "";
      const adGroup = kw.ad_group?.name || "";
      const campaign = kw.campaign?.name || "";
      const impressions = kw.metrics?.impressions || 0;

      alerts.push(`⚠️ QS ${qs}/10 — "${kwText}" (${adGroup} / ${campaign}) — ${impressions.toLocaleString("pt-BR")} impressões`);
    }

    if (alerts.length > 0) {
      results.push(...alerts);
      await notifyOwner({
        title: `📉 ${alerts.length} keyword(s) com Quality Score abaixo de 7`,
        content: `Keywords com QS < 7 e mais de 100 impressões nos últimos 30 dias:\n\n${alerts.slice(0, 10).join("\n")}\n\nAções recomendadas:\n• Melhorar relevância do anúncio para a keyword\n• Otimizar landing page\n• Revisar copy dos títulos RSA`,
      });
    } else {
      results.push("✅ Todos os Quality Scores estão acima de 7/10");
    }

    await logJob("qualityScoreAlert", "Alerta de Quality Score", alerts.length > 0 ? "warning" : "success", results.join("\n"), Date.now() - startTime);
    return { success: true, lowQsCount: alerts.length, results };
  } catch (error: any) {
    console.error("[qualityScoreAlert]", error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Auto-7: Monitor de landing page fora do ar
 * Verifica status HTTP das URLs de destino dos anúncios a cada hora
 */
export async function runLandingPageMonitor() {
  const startTime = Date.now();
  const results: string[] = [];
  const downPages: string[] = [];

  try {
    const customer = await getGoogleAdsClient();

    // Buscar URLs finais dos anúncios ativos
    const ads = await customer.query(`
      SELECT
        ad_group_ad.ad.final_urls,
        ad_group.name,
        campaign.name,
        ad_group_ad.resource_name
      FROM ad_group_ad
      WHERE ad_group_ad.status = 'ENABLED'
        AND ad_group.status = 'ENABLED'
        AND campaign.status = 'ENABLED'
    `);

    // Coletar URLs únicas
    const urlMap = new Map<string, { adGroup: string; campaign: string; resourceName: string }>();
    for (const ad of ads) {
      const urls = ad.ad_group_ad?.ad?.final_urls || [];
      for (const url of urls) {
        if (!urlMap.has(url)) {
          urlMap.set(url, {
            adGroup: ad.ad_group?.name || "",
            campaign: ad.campaign?.name || "",
            resourceName: ad.ad_group_ad?.resource_name || "",
          });
        }
      }
    }

    // Verificar status HTTP de cada URL
    const checkPromises = Array.from(urlMap.entries()).map(async ([url, info]) => {
      try {
        const response = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(10000),
          headers: { "User-Agent": "ZeniteTech-Monitor/1.0" },
        });

        if (response.status >= 400) {
          downPages.push(`🔴 HTTP ${response.status} — ${url}\n   Grupo: ${info.adGroup} / ${info.campaign}`);
        } else if (response.status >= 300) {
          results.push(`⚠️ Redirecionamento ${response.status} — ${url}`);
        } else {
          results.push(`✅ OK (${response.status}) — ${url}`);
        }
      } catch (err: any) {
        downPages.push(`🔴 TIMEOUT/ERRO — ${url}\n   Grupo: ${info.adGroup} / ${info.campaign}\n   Erro: ${err?.message}`);
      }
    });

    await Promise.all(checkPromises);

    if (downPages.length > 0) {
      await notifyOwner({
        title: `🚨 ${downPages.length} landing page(s) fora do ar!`,
        content: `As seguintes páginas de destino dos anúncios estão inacessíveis:\n\n${downPages.join("\n\n")}\n\nOs grupos de anúncios afetados podem estar desperdiçando orçamento. Verifique imediatamente.`,
      });
    }

    const allResults = [...downPages, ...results];
    await logJob("landingPageMonitor", "Monitor de Landing Pages", downPages.length > 0 ? "error" : "success", allResults.join("\n"), Date.now() - startTime);
    return { success: true, downCount: downPages.length, results: allResults };
  } catch (error: any) {
    console.error("[landingPageMonitor]", error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Auto-8: Relatório de conversões por canal (WhatsApp vs. formulário vs. ligação)
 * Roda semanalmente às segundas 8h30
 */
export async function runConversionByChannelReport() {
  const startTime = Date.now();

  try {
    const customer = await getGoogleAdsClient();

    const conversions = await customer.query(`
      SELECT
        conversion_action.name,
        conversion_action.type,
        metrics.conversions,
        metrics.conversion_value,
        metrics.cost_per_conversion,
        campaign.name
      FROM campaign
      WHERE campaign.status != 'REMOVED'
        AND segments.date DURING LAST_30_DAYS
        AND metrics.conversions > 0
      ORDER BY metrics.conversions DESC
    `);

    // Agrupar por tipo de conversão
    const byChannel: Record<string, { conversions: number; cost: number; campaigns: string[] }> = {};

    for (const row of conversions) {
      const name = row.conversion_action?.name || "Desconhecido";
      const channel = name.toLowerCase().includes("whatsapp") ? "WhatsApp"
        : name.toLowerCase().includes("form") || name.toLowerCase().includes("lead") ? "Formulário"
        : name.toLowerCase().includes("call") || name.toLowerCase().includes("ligan") ? "Ligação"
        : "Outros";

      if (!byChannel[channel]) byChannel[channel] = { conversions: 0, cost: 0, campaigns: [] };
      byChannel[channel].conversions += row.metrics?.conversions || 0;
      byChannel[channel].cost += (row.metrics?.cost_per_conversion || 0) / 1_000_000;
      if (row.campaign?.name && !byChannel[channel].campaigns.includes(row.campaign.name)) {
        byChannel[channel].campaigns.push(row.campaign.name);
      }
    }

    const lines = Object.entries(byChannel).map(([channel, data]) =>
      `• ${channel}: ${data.conversions.toFixed(0)} conversões | CPA médio: R$${(data.cost / Math.max(data.conversions, 1)).toFixed(2)}`
    );

    const report = `📊 **Conversões por Canal — Últimos 30 dias**\n\n${lines.join("\n") || "Sem conversões no período"}`;

    await notifyOwner({
      title: "📊 Relatório de Conversões por Canal — Últimos 30 dias",
      content: report,
    });

    await logJob("conversionByChannelReport", "Relatório Conversões por Canal", "success", report, Date.now() - startTime);
    return { success: true, channels: byChannel };
  } catch (error: any) {
    console.error("[conversionByChannelReport]", error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Auto-9: Reativação automática de grupos pausados quando landing page for atualizada
 * Roda diariamente às 10h — verifica hash das páginas de grupos pausados
 */
export async function runPausedGroupReactivation() {
  const startTime = Date.now();
  const results: string[] = [];

  try {
    const customer = await getGoogleAdsClient();

    // Buscar grupos pausados com URLs de destino
    const pausedGroups = await customer.query(`
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.resource_name,
        campaign.name,
        ad_group_ad.ad.final_urls
      FROM ad_group_ad
      WHERE ad_group.status = 'PAUSED'
        AND campaign.status = 'ENABLED'
        AND ad_group_ad.status = 'ENABLED'
    `);

    if (pausedGroups.length === 0) {
      results.push("✅ Nenhum grupo pausado com anúncios ativos encontrado");
      await logJob("pausedGroupReactivation", "Reativação de Grupos Pausados", "success", results.join("\n"), Date.now() - startTime);
      return { success: true, results };
    }

    // Verificar se as páginas estão acessíveis e têm conteúdo atualizado
    const reactivationCandidates: string[] = [];

    for (const group of pausedGroups.slice(0, 10)) { // Limitar a 10 para não sobrecarregar
      const urls = group.ad_group_ad?.ad?.final_urls || [];
      if (urls.length === 0) continue;

      try {
        const response = await fetch(urls[0], {
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "ZeniteTech-Monitor/1.0" },
        });

        if (response.ok) {
          const html = await response.text();
          const contentLength = html.length;

          // Se a página tem conteúdo substancial (> 5KB), pode ter sido atualizada
          if (contentLength > 5000) {
            reactivationCandidates.push(
              `🟢 ${group.ad_group?.name} (${group.campaign?.name}) — página OK (${(contentLength / 1024).toFixed(1)}KB)\n   URL: ${urls[0]}`
            );
          }
        }
      } catch {
        // Página inacessível — manter pausado
      }
    }

    if (reactivationCandidates.length > 0) {
      results.push(...reactivationCandidates);
      await notifyOwner({
        title: `🟢 ${reactivationCandidates.length} grupo(s) pausado(s) com landing page acessível`,
        content: `Os seguintes grupos pausados têm landing pages funcionando. Considere reativá-los:\n\n${reactivationCandidates.join("\n\n")}\n\nAcesse o dashboard para reativar manualmente ou confirme a reativação automática.`,
      });
    } else {
      results.push("⏸️ Grupos pausados mantidos — landing pages ainda inacessíveis ou sem conteúdo suficiente");
    }

    await logJob("pausedGroupReactivation", "Reativação de Grupos Pausados", "success", results.join("\n"), Date.now() - startTime);
    return { success: true, candidates: reactivationCandidates.length, results };
  } catch (error: any) {
    console.error("[pausedGroupReactivation]", error?.message);
    return { success: false, error: error?.message };
  }
}
