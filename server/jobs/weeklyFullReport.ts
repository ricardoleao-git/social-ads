/**
 * weeklyFullReport.ts
 * Job semanal: toda segunda às 08:00 BRT (11:00 UTC)
 * Relatório completo com:
 * - Métricas gerais (cliques, impressões, conversões, gasto)
 * - Pontuação de otimização do Google
 * - Parcela de impressões perdidas (orçamento + ranking)
 * - Recomendações oficiais do Google Ads
 * - Negativos aplicados na semana
 * - Alertas e ações sugeridas
 */
import cron from "node-cron";
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { notifyOwner } from "../_core/notification";
import { getAlertEmails } from "../helpers/getAlertEmails";
import { storagePut } from "../storage";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { buildCustomerClient, buildDateFilter } from "../routers/googleAds";
import { getDb } from "../db";
import { negativeKeywordHistory } from "../../drizzle/schema";
import { desc, gte } from "drizzle-orm";

interface WeeklyMetrics {
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  totalSpend: number;
  avgCtr: number;
  avgCpc: number;
  searchImpressionShare: number | null;
  budgetLostShare: number | null;
  rankLostShare: number | null;
  optimizationScore: number | null;
  campaigns: {
    name: string;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    ctr: number;
    imprShare: number | null;
    budgetLost: number | null;
    rankLost: number | null;
  }[];
  recommendations: {
    label: string;
    count: number;
    avgImpact: number;
  }[];
  negativosAdicionados: number;
}

async function collectWeeklyMetrics(): Promise<WeeklyMetrics> {
  const client = getGoogleAdsClient();
  const customer = buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
  const dateFilter = buildDateFilter("7d");

  // 1. Métricas de campanha de pesquisa (com impression share)
  const searchQuery = `
    SELECT
      campaign.id, campaign.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr,
      metrics.search_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.search_rank_lost_impression_share
    FROM campaign
    WHERE ${dateFilter}
    AND campaign.status = 'ENABLED'
    AND campaign.advertising_channel_type = 'SEARCH'
    ORDER BY metrics.impressions DESC
  `;
  const searchRows = await customer.query(searchQuery);

  // 2. Métricas de outras campanhas (Performance Max, etc.)
  const otherQuery = `
    SELECT
      campaign.id, campaign.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr
    FROM campaign
    WHERE ${dateFilter}
    AND campaign.status = 'ENABLED'
    AND campaign.advertising_channel_type != 'SEARCH'
    ORDER BY metrics.impressions DESC
  `;
  const otherRows = await customer.query(otherQuery);

  let totalClicks = 0, totalImpressions = 0, totalConversions = 0, totalCostMicros = 0;
  let sumImprShare = 0, sumBudgetLost = 0, sumRankLost = 0, shareCount = 0;
  const campaigns: WeeklyMetrics["campaigns"] = [];

  for (const row of searchRows) {
    const impr = Number(row.metrics?.impressions ?? 0);
    const clicks = Number(row.metrics?.clicks ?? 0);
    const cost = Number(row.metrics?.cost_micros ?? 0);
    const conv = Number(row.metrics?.conversions ?? 0);
    const is = Number(row.metrics?.search_impression_share ?? 0);
    const bl = Number(row.metrics?.search_budget_lost_impression_share ?? 0);
    const rl = Number(row.metrics?.search_rank_lost_impression_share ?? 0);

    totalClicks += clicks;
    totalImpressions += impr;
    totalConversions += conv;
    totalCostMicros += cost;

    if (is > 0) {
      sumImprShare += is;
      sumBudgetLost += bl;
      sumRankLost += rl;
      shareCount++;
    }

    campaigns.push({
      name: String(row.campaign?.name ?? ""),
      impressions: impr,
      clicks,
      spend: cost / 1e6,
      conversions: conv,
      ctr: impr > 0 ? (clicks / impr) * 100 : 0,
      imprShare: Math.round(is * 100),
      budgetLost: Math.round(bl * 100),
      rankLost: Math.round(rl * 100),
    });
  }

  for (const row of otherRows) {
    const impr = Number(row.metrics?.impressions ?? 0);
    const clicks = Number(row.metrics?.clicks ?? 0);
    const cost = Number(row.metrics?.cost_micros ?? 0);
    const conv = Number(row.metrics?.conversions ?? 0);

    totalClicks += clicks;
    totalImpressions += impr;
    totalConversions += conv;
    totalCostMicros += cost;

    campaigns.push({
      name: String(row.campaign?.name ?? "") + " (PMax)",
      impressions: impr,
      clicks,
      spend: cost / 1e6,
      conversions: conv,
      ctr: impr > 0 ? (clicks / impr) * 100 : 0,
      imprShare: null,
      budgetLost: null,
      rankLost: null,
    });
  }

  // 3. Optimization score
  let optimizationScore: number | null = null;
  try {
    const optRows = await customer.query(`SELECT customer.optimization_score FROM customer LIMIT 1`);
    if (optRows.length > 0 && optRows[0].customer?.optimization_score != null) {
      optimizationScore = Math.round(Number(optRows[0].customer.optimization_score) * 100);
    }
  } catch (e) { /* ignore */ }

  // 4. Recomendações
  const recommendations: WeeklyMetrics["recommendations"] = [];
  try {
    const recQuery = `
      SELECT
        recommendation.type,
        recommendation.impact.base_metrics.clicks,
        recommendation.impact.potential_metrics.clicks
      FROM recommendation
      LIMIT 50
    `;
    const recRows = await customer.query(recQuery);
    const grouped: Record<string, { count: number; totalLift: number }> = {};
    for (const row of recRows) {
      const type = String(row.recommendation?.type ?? "UNKNOWN");
      const baseClicks = Number(row.recommendation?.impact?.base_metrics?.clicks ?? 0);
      const potClicks = Number(row.recommendation?.impact?.potential_metrics?.clicks ?? 0);
      const lift = baseClicks > 0 ? ((potClicks - baseClicks) / baseClicks) * 100 : 0;
      if (!grouped[type]) grouped[type] = { count: 0, totalLift: 0 };
      grouped[type].count++;
      grouped[type].totalLift += lift;
    }
    for (const [type, g] of Object.entries(grouped)) {
      recommendations.push({
        label: type.replace(/_/g, " ").toLowerCase(),
        count: g.count,
        avgImpact: g.count > 0 ? Math.round(g.totalLift / g.count) : 0,
      });
    }
    recommendations.sort((a, b) => b.avgImpact - a.avgImpact);
  } catch (e) { /* ignore */ }

  // 5. Negativos adicionados na semana
  let negativosAdicionados = 0;
  try {
    const db = await getDb();
    if (db) {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const negRows = await db
        .select()
        .from(negativeKeywordHistory)
        .where(gte(negativeKeywordHistory.createdAt, weekAgo));
      negativosAdicionados = negRows.length;
    }
  } catch (e) { /* ignore */ }

  const totalSpend = totalCostMicros / 1e6;
  return {
    totalClicks,
    totalImpressions,
    totalConversions,
    totalSpend,
    avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    searchImpressionShare: shareCount > 0 ? Math.round((sumImprShare / shareCount) * 100) : null,
    budgetLostShare: shareCount > 0 ? Math.round((sumBudgetLost / shareCount) * 100) : null,
    rankLostShare: shareCount > 0 ? Math.round((sumRankLost / shareCount) * 100) : null,
    optimizationScore,
    campaigns,
    recommendations,
    negativosAdicionados,
  };
}

export async function sendWeeklyFullReport() {
  console.log("[WeeklyFullReport] Iniciando relatório semanal completo...");
  const recipients = await getAlertEmails();

  try {
    const m = await collectWeeklyMetrics();
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const timeStr = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // Gerar Markdown
    const lines: string[] = [
      `# Relatório Semanal Completo — Zênite Tech`,
      ``,
      `**Período:** Últimos 7 dias  `,
      `**Gerado em:** ${timeStr}`,
      ``,
      `---`,
      ``,
      `## Resumo Executivo`,
      ``,
      `| Métrica | Valor |`,
      `|---------|-------|`,
      `| Impressões | ${m.totalImpressions.toLocaleString("pt-BR")} |`,
      `| Cliques | ${m.totalClicks.toLocaleString("pt-BR")} |`,
      `| Conversões | ${m.totalConversions.toFixed(1)} |`,
      `| Gasto Total | R$ ${m.totalSpend.toFixed(2)} |`,
      `| CTR Médio | ${m.avgCtr.toFixed(2)}% |`,
      `| CPC Médio | R$ ${m.avgCpc.toFixed(2)} |`,
      `| Pontuação de Otimização | ${m.optimizationScore != null ? m.optimizationScore + "%" : "N/D"} |`,
      ``,
    ];

    // Impression share
    if (m.searchImpressionShare != null) {
      lines.push(
        `## Parcela de Impressões (Pesquisa)`,
        ``,
        `| Métrica | Valor |`,
        `|---------|-------|`,
        `| Parcela de Impressões | ${m.searchImpressionShare}% |`,
        `| Perdidas por Orçamento | ${m.budgetLostShare}% |`,
        `| Perdidas por Ranking | ${m.rankLostShare}% |`,
        ``,
      );

      if ((m.budgetLostShare ?? 0) > 20) {
        lines.push(`> ⚠️ **ALERTA:** Perdendo ${m.budgetLostShare}% das impressões por orçamento insuficiente.`, ``);
      }
      if ((m.rankLostShare ?? 0) > 30) {
        lines.push(`> ⚠️ **ALERTA:** Perdendo ${m.rankLostShare}% das impressões por ranking baixo. Revisar Quality Score e lances.`, ``);
      }
    }

    // Campanhas
    lines.push(
      `## Performance por Campanha`,
      ``,
      `| Campanha | Impressões | Cliques | CTR | CPC | Conv. | Gasto | IS | Budget Lost | Rank Lost |`,
      `|----------|-----------|---------|-----|-----|-------|-------|----|-----------|-----------| `,
    );
    for (const c of m.campaigns) {
      lines.push(
        `| ${c.name} | ${c.impressions.toLocaleString("pt-BR")} | ${c.clicks} | ${c.ctr.toFixed(1)}% | R$ ${c.spend > 0 && c.clicks > 0 ? (c.spend / c.clicks).toFixed(2) : "0.00"} | ${c.conversions.toFixed(0)} | R$ ${c.spend.toFixed(2)} | ${c.imprShare != null ? c.imprShare + "%" : "—"} | ${c.budgetLost != null ? c.budgetLost + "%" : "—"} | ${c.rankLost != null ? c.rankLost + "%" : "—"} |`
      );
    }
    lines.push(``);

    // Recomendações
    if (m.recommendations.length > 0) {
      lines.push(
        `## Recomendações do Google Ads`,
        ``,
        `| Tipo | Quantidade | Impacto Médio (Cliques) |`,
        `|------|-----------|------------------------|`,
      );
      for (const r of m.recommendations.slice(0, 10)) {
        lines.push(`| ${r.label} | ${r.count} | +${r.avgImpact}% |`);
      }
      lines.push(``);
    }

    // Negativos
    lines.push(
      `## Automação de Negativos`,
      ``,
      `- **Negativos adicionados na semana:** ${m.negativosAdicionados}`,
      ``,
    );

    // Ações sugeridas
    lines.push(
      `## Ações Sugeridas`,
      ``,
    );
    if ((m.budgetLostShare ?? 0) > 20) {
      lines.push(`1. **Aumentar orçamento** das campanhas de pesquisa (perdendo ${m.budgetLostShare}% por orçamento)`);
    }
    if ((m.rankLostShare ?? 0) > 30) {
      lines.push(`2. **Melhorar Quality Score** — revisar relevância dos anúncios e landing pages`);
    }
    if ((m.optimizationScore ?? 100) < 80) {
      lines.push(`3. **Aplicar recomendações do Google** — pontuação atual: ${m.optimizationScore}%`);
    }
    if (m.negativosAdicionados < 5) {
      lines.push(`4. **Revisar termos de pesquisa** — poucos negativos adicionados esta semana`);
    }
    lines.push(
      ``,
      `---`,
      ``,
      `Dashboard completo: https://social-ads.zenitetech.com`,
      ``,
      `*Zênite Tech — Gestão de Tráfego Pago*`,
    );

    const markdown = lines.join("\n");

    // Gerar PDF
    let pdfUrl: string | null = null;
    try {
      const mdPath = `/tmp/relatorio_semanal_completo_${Date.now()}.md`;
      const pdfPath = mdPath.replace(".md", ".pdf");
      writeFileSync(mdPath, markdown, "utf-8");
      execSync(`manus-md-to-pdf "${mdPath}" "${pdfPath}"`, { timeout: 30000 });
      const { readFileSync } = await import("fs");
      const pdfBuffer = readFileSync(pdfPath);
      const fileKey = `weekly-reports/relatorio_completo_${dateStr.replace(/\//g, "-")}_${Date.now()}.pdf`;
      const uploaded = await storagePut(fileKey, pdfBuffer, "application/pdf");
      pdfUrl = uploaded.url;
      console.log(`[WeeklyFullReport] PDF gerado: ${pdfUrl}`);
    } catch (pdfErr: any) {
      console.warn("[WeeklyFullReport] Erro ao gerar PDF:", pdfErr?.message);
    }

    // Montar e-mail HTML
    const subject = `[Relatório Semanal Completo] Google Ads — ${dateStr} — Zênite Tech`;
    const body = buildEmailHtml(m, dateStr, pdfUrl);

    // Enviar e-mail
    for (const email of recipients) {
      try {
        const payload = JSON.stringify({ to: email, subject, body });
        execSync(
          `manus-mcp-cli tool call send_email --server gmail --input '${payload.replace(/'/g, "'\\''")}'`,
          { timeout: 30000 }
        );
        console.log(`[WeeklyFullReport] E-mail enviado para ${email}`);
      } catch (err) {
        console.error(`[WeeklyFullReport] Erro ao enviar para ${email}:`, err);
      }
    }

    // Notificação in-app
    await notifyOwner({
      title: `Relatório Semanal Completo — ${dateStr}`,
      content: `CTR: ${m.avgCtr.toFixed(2)}% | CPC: R$ ${m.avgCpc.toFixed(2)} | Otimização: ${m.optimizationScore ?? "N/D"}% | IS: ${m.searchImpressionShare ?? "N/D"}% | Budget Lost: ${m.budgetLostShare ?? "N/D"}%${pdfUrl ? ` | PDF: ${pdfUrl}` : ""}`,
    });

    console.log("[WeeklyFullReport] Relatório semanal completo enviado com sucesso.");
  } catch (err: any) {
    console.error("[WeeklyFullReport] Erro crítico:", err?.message ?? err);
  }
}

function buildEmailHtml(m: WeeklyMetrics, dateStr: string, pdfUrl: string | null): string {
  const budgetAlert = (m.budgetLostShare ?? 0) > 20;
  const rankAlert = (m.rankLostShare ?? 0) > 30;
  const optAlert = (m.optimizationScore ?? 100) < 80;

  let html = `
  <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;">
    <h1 style="color:#1a1a2e;border-bottom:3px solid #0f3460;padding-bottom:10px;">
      Relatório Semanal Completo — ${dateStr}
    </h1>
    
    <h2 style="color:#0f3460;">Resumo Executivo</h2>
    <table border="0" cellpadding="12" cellspacing="0" style="border-collapse:collapse;width:100%;background:#f8f9fa;border-radius:8px;">
      <tr>
        <td style="text-align:center;border-right:1px solid #dee2e6;">
          <div style="font-size:24px;font-weight:bold;color:#0f3460;">${m.totalImpressions.toLocaleString("pt-BR")}</div>
          <div style="color:#6c757d;font-size:12px;">Impressões</div>
        </td>
        <td style="text-align:center;border-right:1px solid #dee2e6;">
          <div style="font-size:24px;font-weight:bold;color:#0f3460;">${m.totalClicks.toLocaleString("pt-BR")}</div>
          <div style="color:#6c757d;font-size:12px;">Cliques</div>
        </td>
        <td style="text-align:center;border-right:1px solid #dee2e6;">
          <div style="font-size:24px;font-weight:bold;color:#16a34a;">${m.totalConversions.toFixed(0)}</div>
          <div style="color:#6c757d;font-size:12px;">Conversões</div>
        </td>
        <td style="text-align:center;">
          <div style="font-size:24px;font-weight:bold;color:#dc2626;">R$ ${m.totalSpend.toFixed(2)}</div>
          <div style="color:#6c757d;font-size:12px;">Gasto Total</div>
        </td>
      </tr>
    </table>

    <table border="0" cellpadding="12" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:10px;background:#f8f9fa;">
      <tr>
        <td style="text-align:center;border-right:1px solid #dee2e6;">
          <div style="font-size:20px;font-weight:bold;">${m.avgCtr.toFixed(2)}%</div>
          <div style="color:#6c757d;font-size:12px;">CTR Médio</div>
        </td>
        <td style="text-align:center;border-right:1px solid #dee2e6;">
          <div style="font-size:20px;font-weight:bold;">R$ ${m.avgCpc.toFixed(2)}</div>
          <div style="color:#6c757d;font-size:12px;">CPC Médio</div>
        </td>
        <td style="text-align:center;border-right:1px solid #dee2e6;">
          <div style="font-size:20px;font-weight:bold;color:${(m.optimizationScore ?? 0) >= 80 ? '#16a34a' : '#f59e0b'};">${m.optimizationScore != null ? m.optimizationScore + "%" : "N/D"}</div>
          <div style="color:#6c757d;font-size:12px;">Otimização Google</div>
        </td>
        <td style="text-align:center;">
          <div style="font-size:20px;font-weight:bold;">${m.searchImpressionShare != null ? m.searchImpressionShare + "%" : "N/D"}</div>
          <div style="color:#6c757d;font-size:12px;">Parcela de Impressões</div>
        </td>
      </tr>
    </table>`;

  // Alertas
  if (budgetAlert || rankAlert || optAlert) {
    html += `<div style="margin-top:20px;padding:15px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;">
      <h3 style="color:#dc2626;margin:0 0 10px 0;">⚠️ Alertas</h3>`;
    if (budgetAlert) {
      html += `<p style="margin:5px 0;">• Perdendo <strong>${m.budgetLostShare}%</strong> das impressões por orçamento insuficiente</p>`;
    }
    if (rankAlert) {
      html += `<p style="margin:5px 0;">• Perdendo <strong>${m.rankLostShare}%</strong> das impressões por ranking baixo</p>`;
    }
    if (optAlert) {
      html += `<p style="margin:5px 0;">• Pontuação de otimização em <strong>${m.optimizationScore}%</strong> — abaixo do recomendado (80%+)</p>`;
    }
    html += `</div>`;
  }

  // Campanhas
  html += `<h2 style="color:#0f3460;margin-top:25px;">Performance por Campanha</h2>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
      <tr style="background:#0f3460;color:white;">
        <th>Campanha</th><th>Impr.</th><th>Cliques</th><th>CTR</th><th>CPC</th><th>Conv.</th><th>Gasto</th><th>IS</th><th>Budget Lost</th>
      </tr>`;
  for (const c of m.campaigns) {
    const budgetColor = (c.budgetLost ?? 0) > 20 ? "color:#dc2626;font-weight:bold;" : "";
    html += `<tr>
      <td>${c.name}</td>
      <td style="text-align:right;">${c.impressions.toLocaleString("pt-BR")}</td>
      <td style="text-align:right;">${c.clicks}</td>
      <td style="text-align:right;">${c.ctr.toFixed(1)}%</td>
      <td style="text-align:right;">R$ ${c.clicks > 0 ? (c.spend / c.clicks).toFixed(2) : "0.00"}</td>
      <td style="text-align:right;">${c.conversions.toFixed(0)}</td>
      <td style="text-align:right;">R$ ${c.spend.toFixed(2)}</td>
      <td style="text-align:right;">${c.imprShare != null ? c.imprShare + "%" : "—"}</td>
      <td style="text-align:right;${budgetColor}">${c.budgetLost != null ? c.budgetLost + "%" : "—"}</td>
    </tr>`;
  }
  html += `</table>`;

  // Recomendações
  if (m.recommendations.length > 0) {
    html += `<h2 style="color:#0f3460;margin-top:25px;">Recomendações do Google Ads</h2>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
        <tr style="background:#0f3460;color:white;">
          <th>Tipo</th><th>Qtd.</th><th>Impacto Médio</th>
        </tr>`;
    for (const r of m.recommendations.slice(0, 8)) {
      html += `<tr><td>${r.label}</td><td style="text-align:center;">${r.count}</td><td style="text-align:center;">+${r.avgImpact}%</td></tr>`;
    }
    html += `</table>`;
  }

  // Automação
  html += `<h2 style="color:#0f3460;margin-top:25px;">Automação</h2>
    <p>• <strong>${m.negativosAdicionados}</strong> negativos adicionados automaticamente esta semana</p>`;

  // Link
  if (pdfUrl) {
    html += `<p style="margin-top:20px;"><a href="${pdfUrl}" style="background:#0f3460;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">📄 Baixar PDF Completo</a></p>`;
  }
  html += `<p style="margin-top:20px;"><a href="https://social-ads.zenitetech.com" style="background:#16a34a;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">🔗 Ver Dashboard Completo</a></p>`;
  html += `<p style="color:#6c757d;font-size:12px;margin-top:30px;">Zênite Tech — Gestão de Tráfego Pago | Relatório automático</p>`;
  html += `</div>`;

  return html;
}

export function scheduleWeeklyFullReport() {
  // Toda segunda-feira às 08:00 BRT
  cron.schedule("0 8 * * 1", async () => {
    await sendWeeklyFullReport();
  }, { timezone: "America/Sao_Paulo" });
  console.log("[WeeklyFullReport] Agendado para toda segunda-feira às 08:00 BRT.");
}
