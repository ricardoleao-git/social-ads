/**
 * weeklySearchTermsAlert.ts
 * Job semanal: toda segunda-feira às 8h (America/Sao_Paulo)
 * 1. Busca termos de pesquisa dos últimos 7 dias via Google Ads API
 * 2. Filtra candidatos a negativar (sem conversão, com gasto)
 * 3. Envia e-mail de alerta com lista de termos recomendados para negativar
 * 4. Dispara notificação push no painel Manus
 */

import cron from "node-cron";
import { execSync } from "child_process";
import { notifyOwner } from "../_core/notification";
import { getAlertEmails } from "../helpers/getAlertEmails";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { buildCustomerClient } from "../routers/googleAds";



export async function sendWeeklySearchTermsAlert() {
  console.log("[SearchTermsAlert] Iniciando análise semanal de termos de pesquisa...");
  const recipients = await getAlertEmails();
  try {
    const client = getGoogleAdsClient();
    const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());

    // Buscar termos dos últimos 7 dias
    const rows = await customer.query(`
      SELECT
        search_term_view.search_term,
        search_term_view.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        campaign.name
      FROM search_term_view
      WHERE segments.date DURING LAST_7_DAYS
        AND metrics.impressions > 0
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 200
    `);

    // Buscar negativos existentes
    const negRows = await customer.query(`
      SELECT campaign_criterion.keyword.text
      FROM campaign_criterion
      WHERE campaign_criterion.negative = TRUE
        AND campaign_criterion.type = 'KEYWORD'
        AND campaign.status != 'REMOVED'
      LIMIT 500
    `);
    const existingNeg = new Set(negRows.map((r: any) =>
      String(r.campaign_criterion?.keyword?.text ?? "").toLowerCase()
    ));

    const terms = rows.map((row: any) => ({
      term: String(row.search_term_view?.search_term ?? ""),
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      spend: Number(row.metrics?.cost_micros ?? 0) / 1e6,
      conversions: Number(row.metrics?.conversions ?? 0),
      campaignName: String(row.campaign?.name ?? ""),
      isAlreadyNegative: existingNeg.has(String(row.search_term_view?.search_term ?? "").toLowerCase()),
    }));

    // Candidatos: sem conversão, com gasto, não negativados
    const candidates = terms.filter((t: typeof terms[0]) =>
      !t.isAlreadyNegative && t.conversions === 0 && t.spend > 0
    );

    const totalWasted = candidates.reduce((s: number, t: typeof candidates[0]) => s + t.spend, 0);
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    if (candidates.length === 0) {
      console.log("[SearchTermsAlert] Nenhum candidato a negativar encontrado esta semana.");
      await notifyOwner({
        title: "Termos de Pesquisa — Nenhum Candidato",
        content: `Análise de ${now}: Nenhum termo novo para negativar nos últimos 7 dias. Conta saudável!`,
      });
      return;
    }

    // Montar e-mail
    const subject = `[Alerta Semanal] ${candidates.length} termos para negativar — R$ ${totalWasted.toFixed(2)} desperdiçados`;

    const topCandidates = candidates.slice(0, 20);
    const rows_table = topCandidates.map((t: typeof candidates[0], i: number) =>
      `${i + 1}. "${t.term}" | ${t.impressions} imp | ${t.clicks} cliques | R$ ${t.spend.toFixed(2)} gasto | 0 conversões`
    ).join("\n");

    const content = [
      `Olá Ricardo,`,
      ``,
      `Análise semanal de termos de pesquisa — ${now}`,
      ``,
      `RESUMO`,
      `======`,
      `• Total de termos analisados: ${terms.length}`,
      `• Candidatos a negativar: ${candidates.length}`,
      `• Gasto estimado desperdiçado: R$ ${totalWasted.toFixed(2)}`,
      ``,
      `TOP ${topCandidates.length} TERMOS PARA NEGATIVAR`,
      `${"=".repeat(40)}`,
      rows_table,
      ``,
      candidates.length > 20 ? `... e mais ${candidates.length - 20} termos. Acesse o dashboard para ver todos.` : ``,
      ``,
      `AÇÃO RECOMENDADA`,
      `================`,
      `Acesse o dashboard e use a ferramenta "Reorganizar Negativos" para adicionar esses termos:`,
      `https://zenite-ads.manus.space/negative-keywords`,
      ``,
      `Atenciosamente,`,
      `Dashboard Zênite Tech — Gestão de Tráfego Pago`,
    ].join("\n");

    // Enviar e-mail
    let emailSent = false;
    try {
      const payload = JSON.stringify({
        messages: [{ to: recipients, subject, content }],
      });
      execSync(
        `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${payload.replace(/'/g, "'\"'\"'")}'`,
        { timeout: 30000 }
      );
      emailSent = true;
      console.log(`[SearchTermsAlert] E-mail enviado para ${recipients.join(", ")}: ${candidates.length} candidatos, R$ ${totalWasted.toFixed(2)} desperdiçados.`);
    } catch (emailErr: any) {
      console.error("[SearchTermsAlert] Erro ao enviar e-mail:", emailErr?.message ?? emailErr);
    }

    // Notificação push
    await notifyOwner({
      title: emailSent
        ? `⚠️ ${candidates.length} termos para negativar — R$ ${totalWasted.toFixed(2)} desperdiçados`
        : `Alerta de termos: falha no e-mail`,
      content: emailSent
        ? `Análise semanal: ${candidates.length} novos termos sem conversão gastaram R$ ${totalWasted.toFixed(2)} nos últimos 7 dias. Acesse: https://zenite-ads.manus.space/negative-keywords`
        : `Análise concluída mas e-mail falhou. ${candidates.length} candidatos encontrados.`,
    });

  } catch (err: any) {
    console.error("[SearchTermsAlert] Erro crítico:", err?.message ?? err);
  }
}

// Agendar: toda segunda-feira às 8h (horário de Brasília)
cron.schedule(
  "0 8 * * 1",
  () => { sendWeeklySearchTermsAlert(); },
  { timezone: "America/Sao_Paulo" }
);

console.log("[SearchTermsAlert] Job semanal agendado: toda segunda-feira às 8h (America/Sao_Paulo)");
