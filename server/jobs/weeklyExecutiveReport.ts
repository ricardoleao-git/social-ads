/**
 * Job: Relatório Executivo Semanal para Diretoria
 * Agenda: toda segunda-feira às 8h (America/Sao_Paulo)
 *
 * Fluxo:
 *  1. Busca métricas reais da API Google Ads (últimos 7 dias)
 *  2. Gera relatório executivo em Markdown com análise estratégica via LLM
 *  3. Converte para PDF e faz upload para S3
 *  4. Envia por e-mail via Gmail MCP
 *  5. Notificação push no painel Manus
 */
import cron from "node-cron";
import { execSync } from "child_process";
import { writeFileSync, readFileSync } from "fs";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "../googleAdsClient";
import { buildCustomerClient } from "../routers/googleAds";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { notifyOwner } from "../_core/notification";
import { getAlertEmails } from "../helpers/getAlertEmails";
import { getDb } from "../db";
import { optimizationActions } from "../../drizzle/schema";
import { desc, gte } from "drizzle-orm";


const DASHBOARD_URL = "https://zenite-ads.manus.space";

function getCustomer() {
  const client = getGoogleAdsClient();
  return buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
}

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function fmtBRL(micros: number) {
  return `R$ ${(micros / 1_000_000).toFixed(2).replace(".", ",")}`;
}

function fmtPct(val: number) {
  return `${(val * 100).toFixed(2)}%`;
}

async function fetchWeeklyMetrics() {
  const customer = getCustomer();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);
  const start = fmtDate(startDate);
  const end = fmtDate(endDate);

  // ── Métricas por campanha ────────────────────────────────────────────────
  const campaignQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversion_rate
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `;

  let campaigns: any[] = [];
  try {
    const rows = await customer.query(campaignQuery);
    campaigns = rows.map((r: any) => ({
      id: String(r.campaign?.id ?? ""),
      name: r.campaign?.name ?? "—",
      status: r.campaign?.status ?? "",
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks: Number(r.metrics?.clicks ?? 0),
      costMicros: Number(r.metrics?.cost_micros ?? 0),
      costBRL: (Number(r.metrics?.cost_micros ?? 0) / 1_000_000).toFixed(2),
      conversions: Number(r.metrics?.conversions ?? 0),
      ctr: (Number(r.metrics?.ctr ?? 0) * 100).toFixed(2),
      avgCpc: (Number(r.metrics?.average_cpc ?? 0) / 1_000_000).toFixed(2),
      convRate: (Number(r.metrics?.conversion_rate ?? 0) * 100).toFixed(2),
    }));
  } catch (e: any) {
    console.warn("[ExecutiveReport] Erro ao buscar campanhas:", e?.message);
  }

  // ── Métricas por grupo de anúncios (top 10 por gasto) ───────────────────
  const adGroupQuery = `
    SELECT
      ad_group.name,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM ad_group
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND ad_group.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 10
  `;

  let adGroups: any[] = [];
  try {
    const rows = await customer.query(adGroupQuery);
    adGroups = rows.map((r: any) => ({
      name: r.ad_group?.name ?? "—",
      campaign: r.campaign?.name ?? "—",
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks: Number(r.metrics?.clicks ?? 0),
      costBRL: (Number(r.metrics?.cost_micros ?? 0) / 1_000_000).toFixed(2),
      conversions: Number(r.metrics?.conversions ?? 0),
      ctr: (Number(r.metrics?.ctr ?? 0) * 100).toFixed(2),
      avgCpc: (Number(r.metrics?.average_cpc ?? 0) / 1_000_000).toFixed(2),
    }));
  } catch (e: any) {
    console.warn("[ExecutiveReport] Erro ao buscar grupos:", e?.message);
  }

  // ── Totais agregados ─────────────────────────────────────────────────────
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalCostMicros = campaigns.reduce((s, c) => s + c.costMicros, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";
  const avgCpc = totalClicks > 0 ? (totalCostMicros / totalClicks / 1_000_000).toFixed(2) : "0.00";

  return {
    period: { start, end },
    totals: {
      impressions: totalImpressions,
      clicks: totalClicks,
      costBRL: (totalCostMicros / 1_000_000).toFixed(2),
      conversions: totalConversions,
      avgCtr,
      avgCpc,
    },
    campaigns,
    adGroups,
  };
}

async function fetchPreviousWeekMetrics() {
  const customer = getCustomer();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 7);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 7);
  const start = fmtDate(startDate);
  const end = fmtDate(endDate);
  const query = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
  `;
  try {
    const rows = await customer.query(query);
    const totalImpressions = rows.reduce((s: number, r: any) => s + Number(r.metrics?.impressions ?? 0), 0);
    const totalClicks = rows.reduce((s: number, r: any) => s + Number(r.metrics?.clicks ?? 0), 0);
    const totalCostMicros = rows.reduce((s: number, r: any) => s + Number(r.metrics?.cost_micros ?? 0), 0);
    const totalConversions = rows.reduce((s: number, r: any) => s + Number(r.metrics?.conversions ?? 0), 0);
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";
    const avgCpc = totalClicks > 0 ? (totalCostMicros / totalClicks / 1_000_000).toFixed(2) : "0.00";
    return { period: { start, end }, totals: { impressions: totalImpressions, clicks: totalClicks, costBRL: (totalCostMicros / 1_000_000).toFixed(2), conversions: totalConversions, avgCtr, avgCpc } };
  } catch (e: any) {
    console.warn("[ExecutiveReport] Erro ao buscar semana anterior:", e?.message);
    return null;
  }
}
async function fetchRecentActions() {
  try {
    const db = await getDb();
    if (!db) return [];
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const actions = await db
      .select()
      .from(optimizationActions)
      .where(gte(optimizationActions.createdAt, since))
      .orderBy(desc(optimizationActions.createdAt))
      .limit(20);
    return actions;
  } catch (e: any) {
    console.warn("[ExecutiveReport] Erro ao buscar ações:", e?.message);
    return [];
  }
}

async function generateAIAnalysis(metrics: any, actions: any[], prevMetrics?: any) {
  try {
    const prompt = `Você é um gestor de tráfego pago especialista em B2B para a Zênite Tech.
Analise os dados abaixo e gere um parágrafo executivo de 3-4 linhas com:
1. Avaliação geral da semana (positivo/negativo)
2. Principal ponto de atenção
3. Recomendação prioritária para a próxima semana

Dados da semana (${metrics.period.start} a ${metrics.period.end}):
${prevMetrics ? `Comparação com semana anterior: CTR ${prevMetrics.totals.avgCtr}% → ${metrics.totals.avgCtr}% | CPC R$ ${prevMetrics.totals.avgCpc} → R$ ${metrics.totals.avgCpc} | Gasto R$ ${prevMetrics.totals.costBRL} → R$ ${metrics.totals.costBRL}` : ''}
- Impressões: ${metrics.totals.impressions.toLocaleString("pt-BR")}
- Cliques: ${metrics.totals.clicks.toLocaleString("pt-BR")}
- Gasto total: R$ ${metrics.totals.costBRL}
- Conversões: ${metrics.totals.conversions}
- CTR médio: ${metrics.totals.avgCtr}%
- CPC médio: R$ ${metrics.totals.avgCpc}
- Ações automáticas realizadas: ${actions.length}

Campanhas ativas: ${metrics.campaigns.map((c: any) => `${c.name} (R$ ${c.costBRL})`).join(", ")}

Responda em português, tom profissional e direto, sem markdown.`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
    });
    const content = response?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    return "Análise automática indisponível neste ciclo.";
  } catch (e: any) {
    return "Análise automática indisponível neste ciclo.";
  }
}

function calcDelta(current: string | number, previous: string | number): string {
  const curr = parseFloat(String(current));
  const prev = parseFloat(String(previous));
  if (!prev || isNaN(curr) || isNaN(prev)) return "—";
  const delta = ((curr - prev) / prev) * 100;
  const sign = delta >= 0 ? "+" : "";
  const arrow = delta >= 0 ? "▲" : "▼";
  return `${arrow} ${sign}${delta.toFixed(1)}%`;
}
function buildMarkdown(metrics: any, actions: any[], aiAnalysis: string, weekLabel: string, prevMetrics?: any): string {
  const lines: string[] = [];

  lines.push(`# Relatório Executivo — Google Ads`);
  lines.push(`**Zênite Tech | Gestão de Tráfego Pago**`);
  lines.push(`**Período:** ${metrics.period.start} a ${metrics.period.end}`);
  lines.push(`**Gerado em:** ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Análise Executiva`);
  lines.push(``);
  lines.push(aiAnalysis);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Resumo da Semana`);
  lines.push(``);
  if (prevMetrics) {
    lines.push(`| Métrica | Semana Atual | Semana Anterior | Variação |`);
    lines.push(`|---------|-------------|-----------------|---------|`);
    lines.push(`| Impressões | ${metrics.totals.impressions.toLocaleString("pt-BR")} | ${prevMetrics.totals.impressions.toLocaleString("pt-BR")} | ${calcDelta(metrics.totals.impressions, prevMetrics.totals.impressions)} |`);
    lines.push(`| Cliques | ${metrics.totals.clicks.toLocaleString("pt-BR")} | ${prevMetrics.totals.clicks.toLocaleString("pt-BR")} | ${calcDelta(metrics.totals.clicks, prevMetrics.totals.clicks)} |`);
    lines.push(`| Gasto Total | R$ ${metrics.totals.costBRL} | R$ ${prevMetrics.totals.costBRL} | ${calcDelta(metrics.totals.costBRL, prevMetrics.totals.costBRL)} |`);
    lines.push(`| Conversões | ${metrics.totals.conversions} | ${prevMetrics.totals.conversions} | ${calcDelta(metrics.totals.conversions, prevMetrics.totals.conversions)} |`);
    lines.push(`| CTR Médio | ${metrics.totals.avgCtr}% | ${prevMetrics.totals.avgCtr}% | ${calcDelta(metrics.totals.avgCtr, prevMetrics.totals.avgCtr)} |`);
    lines.push(`| CPC Médio | R$ ${metrics.totals.avgCpc} | R$ ${prevMetrics.totals.avgCpc} | ${calcDelta(metrics.totals.avgCpc, prevMetrics.totals.avgCpc)} |`);
  } else {
    lines.push(`| Métrica | Valor |`);
    lines.push(`|---------|-------|`);
    lines.push(`| Impressões | ${metrics.totals.impressions.toLocaleString("pt-BR")} |`);
    lines.push(`| Cliques | ${metrics.totals.clicks.toLocaleString("pt-BR")} |`);
    lines.push(`| Gasto Total | R$ ${metrics.totals.costBRL} |`);
    lines.push(`| Conversões | ${metrics.totals.conversions} |`);
    lines.push(`| CTR Médio | ${metrics.totals.avgCtr}% |`);
    lines.push(`| CPC Médio | R$ ${metrics.totals.avgCpc} |`);
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Performance por Campanha`);
  lines.push(``);
  if (metrics.campaigns.length > 0) {
    lines.push(`| Campanha | Status | Impressões | Cliques | CTR | CPC Médio | Gasto | Conversões |`);
    lines.push(`|----------|--------|-----------|---------|-----|-----------|-------|-----------|`);
    for (const c of metrics.campaigns) {
      const statusLabel = c.status === "ENABLED" ? "Ativa" : c.status === "PAUSED" ? "Pausada" : c.status;
      lines.push(`| ${c.name} | ${statusLabel} | ${c.impressions.toLocaleString("pt-BR")} | ${c.clicks} | ${c.ctr}% | R$ ${c.avgCpc} | R$ ${c.costBRL} | ${c.conversions} |`);
    }
  } else {
    lines.push(`*Nenhuma campanha com dados no período.*`);
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Top 10 Grupos de Anúncios (por Gasto)`);
  lines.push(``);
  if (metrics.adGroups.length > 0) {
    lines.push(`| Grupo | Campanha | Cliques | CTR | CPC Médio | Gasto | Conversões |`);
    lines.push(`|-------|----------|---------|-----|-----------|-------|-----------|`);
    for (const g of metrics.adGroups) {
      lines.push(`| ${g.name} | ${g.campaign} | ${g.clicks} | ${g.ctr}% | R$ ${g.avgCpc} | R$ ${g.costBRL} | ${g.conversions} |`);
    }
  } else {
    lines.push(`*Nenhum grupo com dados no período.*`);
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Ações Automáticas Realizadas (últimos 7 dias)`);
  lines.push(``);
  if (actions.length > 0) {
    lines.push(`| Data | Tipo | Descrição | Status |`);
    lines.push(`|------|------|-----------|--------|`);
    for (const a of actions.slice(0, 15)) {
      const date = new Date(a.createdAt).toLocaleDateString("pt-BR");
      const typeLabel = (a.actionType ?? "").replace(/_/g, " ");
      const desc = (a.description ?? "").substring(0, 80);
      const status = a.status === "success" ? "✅ Sucesso" : a.status === "error" ? "❌ Erro" : "⏳ Pendente";
      lines.push(`| ${date} | ${typeLabel} | ${desc} | ${status} |`);
    }
    if (actions.length > 15) {
      lines.push(``, `*... e mais ${actions.length - 15} ações. Veja o log completo no dashboard.*`);
    }
  } else {
    lines.push(`*Nenhuma ação registrada no período.*`);
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Acesso ao Dashboard`);
  lines.push(``);
  lines.push(`- **Dashboard principal:** ${DASHBOARD_URL}`);
  lines.push(`- **Log para diretoria:** ${DASHBOARD_URL}/log-diretoria`);
  lines.push(`- **GB Zênite Optimizer:** ${DASHBOARD_URL}/gb-zenite`);
  lines.push(`- **Termos de pesquisa:** ${DASHBOARD_URL}/termos-pesquisa`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`*Relatório gerado automaticamente pelo Sistema de Gestão de Tráfego Pago da Zênite Tech.*`);
  lines.push(`*Para dúvidas ou ajustes, acesse o Chat com IA em ${DASHBOARD_URL}/chat-ia*`);

  return lines.join("\n");
}

export async function sendWeeklyExecutiveReport() {
  console.log("[ExecutiveReport] Iniciando geração do relatório executivo semanal...");
  const recipients = await getAlertEmails();
  try {
    // ── 1. Buscar dados ──────────────────────────────────────────────────────
    const [metrics, actions, prevMetrics] = await Promise.all([
      fetchWeeklyMetrics(),
      fetchRecentActions(),
      fetchPreviousWeekMetrics(),
    ]);

    const weekLabel = `${metrics.period.start}_${metrics.period.end}`;

    // ── 2. Análise por IA ────────────────────────────────────────────────────
    const aiAnalysis = await generateAIAnalysis(metrics, actions, prevMetrics ?? undefined);

    // ── 3. Gerar Markdown ────────────────────────────────────────────────────
    const markdown = buildMarkdown(metrics, actions, aiAnalysis, weekLabel, prevMetrics ?? undefined);

    // ── 4. Converter para PDF e fazer upload para S3 ─────────────────────────
    let pdfUrl: string | null = null;
    try {
      const mdPath = `/tmp/relatorio_executivo_${Date.now()}.md`;
      const pdfPath = mdPath.replace(".md", ".pdf");
      writeFileSync(mdPath, markdown, "utf-8");
      execSync(`manus-md-to-pdf "${mdPath}" "${pdfPath}"`, { timeout: 45000 });
      const pdfBuffer = readFileSync(pdfPath);
      const fileKey = `executive-reports/relatorio_executivo_${weekLabel}_${Date.now()}.pdf`;
      const uploaded = await storagePut(fileKey, pdfBuffer, "application/pdf");
      pdfUrl = uploaded.url;
      console.log(`[ExecutiveReport] PDF gerado e enviado para S3: ${pdfUrl}`);
    } catch (pdfErr: any) {
      console.warn("[ExecutiveReport] Não foi possível gerar o PDF:", pdfErr?.message);
    }

    // ── 5. Montar e-mail ─────────────────────────────────────────────────────
    const subject = `[Relatório Executivo] Google Ads Zênite Tech — Semana ${metrics.period.start} a ${metrics.period.end}`;
    const emailBody = [
      `Olá Ricardo,`,
      ``,
      `Segue o Relatório Executivo Semanal de Google Ads da Zênite Tech.`,
      ``,
      `PERÍODO: ${metrics.period.start} a ${metrics.period.end}`,
      ``,
      `ANÁLISE EXECUTIVA`,
      `=================`,
      aiAnalysis,
      ``,
      `RESUMO DA SEMANA`,
      `================`,
      `• Impressões: ${metrics.totals.impressions.toLocaleString("pt-BR")}`,
      `• Cliques: ${metrics.totals.clicks.toLocaleString("pt-BR")}`,
      `• Gasto Total: R$ ${metrics.totals.costBRL}`,
      `• Conversões: ${metrics.totals.conversions}`,
      `• CTR Médio: ${metrics.totals.avgCtr}%`,
      `• CPC Médio: R$ ${metrics.totals.avgCpc}`,
      ``,
      `AÇÕES AUTOMÁTICAS`,
      `=================`,
      `• ${actions.length} ações realizadas nos últimos 7 dias`,
      ``,
      `CAMPANHAS ATIVAS`,
      `================`,
      ...metrics.campaigns
        .filter((c: any) => c.status === "ENABLED")
        .map((c: any) => `• ${c.name}: R$ ${c.costBRL} gasto | CTR ${c.ctr}% | ${c.conversions} conversões`),
      ``,
      `Acesse o dashboard completo em:`,
      `${DASHBOARD_URL}`,
      ``,
      ...(pdfUrl ? [`Relatório completo em PDF:`, pdfUrl, ``] : []),
      `Atenciosamente,`,
      `Sistema de Gestão de Tráfego Pago — Zênite Tech`,
    ].join("\n");

    // ── 6. Enviar via Gmail MCP ───────────────────────────────────────────────
    const payload = JSON.stringify({
      messages: [{ to: recipients, subject, content: emailBody }],
    });
    let emailSent = false;
    try {
      execSync(
        `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${payload.replace(/'/g, "'\"'\"'")}'`,
        { timeout: 30000 }
      );
      emailSent = true;
      console.log(`[ExecutiveReport] E-mail enviado para ${recipients.join(", ")}`);
    } catch (emailErr: any) {
      console.error("[ExecutiveReport] Erro ao enviar e-mail:", emailErr?.message ?? emailErr);
    }

    // ── 7. Notificação push ───────────────────────────────────────────────────
    const notifTitle = emailSent
      ? `Relatório Executivo Enviado — ${metrics.period.start} a ${metrics.period.end}`
      : `Relatório Executivo: Falha no E-mail — ${metrics.period.start}`;
    const notifContent = emailSent
      ? `Relatório executivo semanal enviado para ${recipients.join(", ")}. Gasto: R$ ${metrics.totals.costBRL} | CTR: ${metrics.totals.avgCtr}% | Conversões: ${metrics.totals.conversions} | Ações automáticas: ${actions.length}${pdfUrl ? ` | PDF disponível` : ""}`
      : `Tentativa de envio do relatório executivo falhou. Acesse o dashboard: ${DASHBOARD_URL}/log-diretoria`;

    await notifyOwner({ title: notifTitle, content: notifContent });
    console.log("[ExecutiveReport] Relatório executivo concluído.");

    return { success: true, emailSent, pdfUrl, metrics: metrics.totals };
  } catch (err: any) {
    console.error("[ExecutiveReport] Erro crítico:", err?.message ?? err);
    return { success: false, error: err?.message };
  }
}

// Agendar: toda segunda-feira às 8h (horário de Brasília)
cron.schedule(
  "0 8 * * 1",
  () => {
    sendWeeklyExecutiveReport();
  },
  {
    timezone: "America/Sao_Paulo",
  }
);

console.log("[ExecutiveReport] Job agendado: toda segunda-feira às 8h (America/Sao_Paulo)");
