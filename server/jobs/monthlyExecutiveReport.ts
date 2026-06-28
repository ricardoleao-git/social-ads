/**
 * Job: Relatório Executivo Mensal — Zênite Tech Google Ads
 * Agenda: todo dia 1º do mês às 8h (America/Sao_Paulo)
 *
 * Fluxo:
 *  1. Busca métricas reais do mês anterior via Google Ads API
 *  2. Compara com o mês retrasado (variação MoM)
 *  3. Gera análise executiva via LLM (resumo, destaques, alertas, próximos passos)
 *  4. Converte para PDF e faz upload para S3
 *  5. Envia por e-mail via Gmail MCP com PDF anexado (link)
 *  6. Notificação push no painel Manus
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


const DASHBOARD_URL = "https://zenite-ads.manus.space";
const JOB_NAME = "MonthlyExecutiveReport";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCustomer() {
  const client = getGoogleAdsClient();
  return buildCustomerClient(client, getCustomerId(), getRefreshToken(), getLoginCustomerId());
}

function fmtBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function fmtDelta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+∞%" : "0%";
  const delta = ((current - previous) / previous) * 100;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function getPreviousMonthRange(): { start: string; end: string; label: string } {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-based
  const lastDay = new Date(year, month, 0).getDate();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const label = `${monthNames[month - 1]} ${year}`;
  return { start, end, label };
}

function getMonthBeforeRange(): { start: string; end: string; label: string } {
  const now = new Date();
  // Two months ago
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const year = twoMonthsAgo.getFullYear();
  const month = twoMonthsAgo.getMonth() + 1; // 1-based
  const lastDay = new Date(year, month, 0).getDate();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const label = `${monthNames[month - 1]} ${year}`;
  return { start, end, label };
}

// ─── Fetch de métricas ────────────────────────────────────────────────────────

interface MonthMetrics {
  period: { start: string; end: string; label: string };
  totals: {
    impressions: number;
    clicks: number;
    costBRL: number;
    conversions: number;
    avgCtr: number;
    avgCpc: number;
    conversionRate: number;
  };
  campaigns: Array<{
    name: string;
    status: string;
    impressions: number;
    clicks: number;
    costBRL: number;
    conversions: number;
    ctr: number;
    avgCpc: number;
  }>;
  topAdGroups: Array<{
    name: string;
    campaignName: string;
    clicks: number;
    costBRL: number;
    conversions: number;
    ctr: number;
  }>;
  topKeywords: Array<{
    text: string;
    campaignName: string;
    clicks: number;
    costBRL: number;
    conversions: number;
    ctr: number;
  }>;
}

async function fetchMonthMetrics(start: string, end: string, label: string): Promise<MonthMetrics> {
  const customer = getCustomer();

  // ── Campanhas ────────────────────────────────────────────────────────────
  let campaigns: MonthMetrics["campaigns"] = [];
  try {
    const rows = await customer.query(`
      SELECT
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${start}' AND '${end}'
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `);
    campaigns = rows.map((r: any) => ({
      name: String(r.campaign?.name ?? "—"),
      status: String(r.campaign?.status ?? ""),
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks: Number(r.metrics?.clicks ?? 0),
      costBRL: Number(r.metrics?.cost_micros ?? 0) / 1_000_000,
      conversions: Number(r.metrics?.conversions ?? 0),
      ctr: Number(r.metrics?.ctr ?? 0),
      avgCpc: Number(r.metrics?.average_cpc ?? 0) / 1_000_000,
    }));
  } catch (e: any) {
    console.warn(`[${JOB_NAME}] Erro ao buscar campanhas:`, e?.message);
  }

  // ── Grupos de anúncios (top 10) ──────────────────────────────────────────
  let topAdGroups: MonthMetrics["topAdGroups"] = [];
  try {
    const rows = await customer.query(`
      SELECT
        ad_group.name,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM ad_group
      WHERE segments.date BETWEEN '${start}' AND '${end}'
        AND campaign.status != 'REMOVED'
        AND ad_group.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 10
    `);
    topAdGroups = rows.map((r: any) => ({
      name: String(r.ad_group?.name ?? "—"),
      campaignName: String(r.campaign?.name ?? "—"),
      clicks: Number(r.metrics?.clicks ?? 0),
      costBRL: Number(r.metrics?.cost_micros ?? 0) / 1_000_000,
      conversions: Number(r.metrics?.conversions ?? 0),
      ctr: Number(r.metrics?.ctr ?? 0),
    }));
  } catch (e: any) {
    console.warn(`[${JOB_NAME}] Erro ao buscar grupos:`, e?.message);
  }

  // ── Top keywords (por cliques) ───────────────────────────────────────────
  let topKeywords: MonthMetrics["topKeywords"] = [];
  try {
    const rows = await customer.query(`
      SELECT
        ad_group_criterion.keyword.text,
        campaign.name,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM keyword_view
      WHERE segments.date BETWEEN '${start}' AND '${end}'
        AND ad_group_criterion.negative = FALSE
        AND ad_group_criterion.type = KEYWORD
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.clicks DESC
      LIMIT 15
    `);
    topKeywords = rows.map((r: any) => ({
      text: String(r.ad_group_criterion?.keyword?.text ?? "—"),
      campaignName: String(r.campaign?.name ?? "—"),
      clicks: Number(r.metrics?.clicks ?? 0),
      costBRL: Number(r.metrics?.cost_micros ?? 0) / 1_000_000,
      conversions: Number(r.metrics?.conversions ?? 0),
      ctr: Number(r.metrics?.ctr ?? 0),
    }));
  } catch (e: any) {
    console.warn(`[${JOB_NAME}] Erro ao buscar keywords:`, e?.message);
  }

  // ── Totais agregados ─────────────────────────────────────────────────────
  const totals = campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      costBRL: acc.costBRL + c.costBRL,
      conversions: acc.conversions + c.conversions,
    }),
    { impressions: 0, clicks: 0, costBRL: 0, conversions: 0 }
  );
  const avgCtr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const avgCpc = totals.clicks > 0 ? totals.costBRL / totals.clicks : 0;
  const conversionRate = totals.clicks > 0 ? totals.conversions / totals.clicks : 0;

  return {
    period: { start, end, label },
    totals: { ...totals, avgCtr, avgCpc, conversionRate },
    campaigns,
    topAdGroups,
    topKeywords,
  };
}

// ─── Análise por IA ───────────────────────────────────────────────────────────

async function generateAIAnalysis(current: MonthMetrics, previous: MonthMetrics): Promise<string> {
  const prompt = `
Você é um especialista em Google Ads e marketing digital B2B. Analise os dados do mês e gere um relatório executivo conciso para Ricardo Leão, diretor da Zênite Tech.

DADOS DO MÊS ATUAL (${current.period.label}):
- Impressões: ${current.totals.impressions.toLocaleString("pt-BR")}
- Cliques: ${current.totals.clicks.toLocaleString("pt-BR")}
- Gasto Total: ${fmtBRL(current.totals.costBRL)}
- Conversões: ${current.totals.conversions}
- CTR Médio: ${fmtPct(current.totals.avgCtr)}
- CPC Médio: ${fmtBRL(current.totals.avgCpc)}
- Taxa de Conversão: ${fmtPct(current.totals.conversionRate)}

COMPARATIVO COM MÊS ANTERIOR (${previous.period.label}):
- Impressões: ${fmtDelta(current.totals.impressions, previous.totals.impressions)}
- Cliques: ${fmtDelta(current.totals.clicks, previous.totals.clicks)}
- Gasto: ${fmtDelta(current.totals.costBRL, previous.totals.costBRL)}
- Conversões: ${fmtDelta(current.totals.conversions, previous.totals.conversions)}
- CTR: ${fmtDelta(current.totals.avgCtr, previous.totals.avgCtr)}

TOP CAMPANHAS (${current.period.label}):
${current.campaigns.map((c) => `- ${c.name}: ${c.clicks} cliques, ${fmtBRL(c.costBRL)}, ${c.conversions} conversões, CTR ${fmtPct(c.ctr)}`).join("\n")}

Gere uma análise executiva com:
1. **Resumo do Mês** (2-3 frases sobre o desempenho geral)
2. **Destaques Positivos** (o que funcionou bem)
3. **Pontos de Atenção** (o que precisa de melhoria)
4. **Próximos Passos** (3 ações concretas para o próximo mês)

Seja direto, objetivo e orientado a resultados. Use linguagem executiva, não técnica.
`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Você é um especialista em Google Ads B2B. Responda em português do Brasil, de forma executiva e objetiva." },
        { role: "user", content: prompt },
      ],
    });
    const rawContent = response.choices?.[0]?.message?.content;
    return (typeof rawContent === "string" ? rawContent : null) ?? "Análise não disponível.";
  } catch (e: any) {
    console.warn(`[${JOB_NAME}] Erro na análise LLM:`, e?.message);
    return "Análise automática não disponível neste ciclo.";
  }
}

// ─── Geração do Markdown ──────────────────────────────────────────────────────

function buildMarkdown(current: MonthMetrics, previous: MonthMetrics, aiAnalysis: string): string {
  const lines: string[] = [];

  lines.push(`# Relatório Executivo Mensal — Google Ads Zênite Tech`);
  lines.push(`**Período:** ${current.period.label} (${current.period.start} a ${current.period.end})`);
  lines.push(`**Gerado em:** ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
  lines.push(`**Dashboard:** ${DASHBOARD_URL}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Análise executiva
  lines.push("## Análise Executiva");
  lines.push(aiAnalysis);
  lines.push("");
  lines.push("---");
  lines.push("");

  // KPIs principais
  lines.push("## KPIs do Mês");
  lines.push("");
  lines.push("| Métrica | Atual | Anterior | Variação |");
  lines.push("|---------|-------|----------|----------|");
  lines.push(`| Impressões | ${current.totals.impressions.toLocaleString("pt-BR")} | ${previous.totals.impressions.toLocaleString("pt-BR")} | ${fmtDelta(current.totals.impressions, previous.totals.impressions)} |`);
  lines.push(`| Cliques | ${current.totals.clicks.toLocaleString("pt-BR")} | ${previous.totals.clicks.toLocaleString("pt-BR")} | ${fmtDelta(current.totals.clicks, previous.totals.clicks)} |`);
  lines.push(`| Gasto Total | ${fmtBRL(current.totals.costBRL)} | ${fmtBRL(previous.totals.costBRL)} | ${fmtDelta(current.totals.costBRL, previous.totals.costBRL)} |`);
  lines.push(`| Conversões | ${current.totals.conversions} | ${previous.totals.conversions} | ${fmtDelta(current.totals.conversions, previous.totals.conversions)} |`);
  lines.push(`| CTR Médio | ${fmtPct(current.totals.avgCtr)} | ${fmtPct(previous.totals.avgCtr)} | ${fmtDelta(current.totals.avgCtr, previous.totals.avgCtr)} |`);
  lines.push(`| CPC Médio | ${fmtBRL(current.totals.avgCpc)} | ${fmtBRL(previous.totals.avgCpc)} | ${fmtDelta(current.totals.avgCpc, previous.totals.avgCpc)} |`);
  lines.push(`| Taxa de Conversão | ${fmtPct(current.totals.conversionRate)} | ${fmtPct(previous.totals.conversionRate)} | ${fmtDelta(current.totals.conversionRate, previous.totals.conversionRate)} |`);
  lines.push("");

  // Campanhas
  if (current.campaigns.length > 0) {
    lines.push("## Desempenho por Campanha");
    lines.push("");
    lines.push("| Campanha | Cliques | Gasto | Conversões | CTR | CPC Médio |");
    lines.push("|----------|---------|-------|------------|-----|-----------|");
    for (const c of current.campaigns) {
      lines.push(`| ${c.name} | ${c.clicks.toLocaleString("pt-BR")} | ${fmtBRL(c.costBRL)} | ${c.conversions} | ${fmtPct(c.ctr)} | ${fmtBRL(c.avgCpc)} |`);
    }
    lines.push("");
  }

  // Top grupos
  if (current.topAdGroups.length > 0) {
    lines.push("## Top 10 Grupos de Anúncios (por Gasto)");
    lines.push("");
    lines.push("| Grupo | Campanha | Cliques | Gasto | Conversões | CTR |");
    lines.push("|-------|----------|---------|-------|------------|-----|");
    for (const g of current.topAdGroups) {
      lines.push(`| ${g.name} | ${g.campaignName} | ${g.clicks.toLocaleString("pt-BR")} | ${fmtBRL(g.costBRL)} | ${g.conversions} | ${fmtPct(g.ctr)} |`);
    }
    lines.push("");
  }

  // Top keywords
  if (current.topKeywords.length > 0) {
    lines.push("## Top 15 Palavras-chave (por Cliques)");
    lines.push("");
    lines.push("| Palavra-chave | Campanha | Cliques | Gasto | Conversões | CTR |");
    lines.push("|---------------|----------|---------|-------|------------|-----|");
    for (const k of current.topKeywords) {
      lines.push(`| ${k.text} | ${k.campaignName} | ${k.clicks.toLocaleString("pt-BR")} | ${fmtBRL(k.costBRL)} | ${k.conversions} | ${fmtPct(k.ctr)} |`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`*Relatório gerado automaticamente pelo Sistema de Gestão de Tráfego Pago — Zênite Tech*`);
  lines.push(`*Dashboard completo: ${DASHBOARD_URL}*`);

  return lines.join("\n");
}

// ─── Execução principal ───────────────────────────────────────────────────────

export async function sendMonthlyExecutiveReport(): Promise<{ success: boolean; emailSent: boolean; pdfUrl: string | null }> {
  console.log(`[${JOB_NAME}] Iniciando relatório executivo mensal...`);
  const recipients = await getAlertEmails();
  try {
    const currentPeriod = getPreviousMonthRange();
    const previousPeriod = getMonthBeforeRange();

    console.log(`[${JOB_NAME}] Período atual: ${currentPeriod.label} (${currentPeriod.start} a ${currentPeriod.end})`);
    console.log(`[${JOB_NAME}] Período anterior: ${previousPeriod.label} (${previousPeriod.start} a ${previousPeriod.end})`);

    // ── 1. Buscar métricas ───────────────────────────────────────────────────
    const [currentMetrics, previousMetrics] = await Promise.all([
      fetchMonthMetrics(currentPeriod.start, currentPeriod.end, currentPeriod.label),
      fetchMonthMetrics(previousPeriod.start, previousPeriod.end, previousPeriod.label),
    ]);

    // ── 2. Análise por IA ────────────────────────────────────────────────────
    const aiAnalysis = await generateAIAnalysis(currentMetrics, previousMetrics);

    // ── 3. Gerar Markdown ────────────────────────────────────────────────────
    const markdown = buildMarkdown(currentMetrics, previousMetrics, aiAnalysis);

    // ── 4. Converter para PDF e fazer upload para S3 ─────────────────────────
    let pdfUrl: string | null = null;
    try {
      const timestamp = Date.now();
      const mdPath = `/tmp/relatorio_mensal_${timestamp}.md`;
      const pdfPath = mdPath.replace(".md", ".pdf");
      writeFileSync(mdPath, markdown, "utf-8");
      execSync(`manus-md-to-pdf "${mdPath}" "${pdfPath}"`, { timeout: 60000 });
      const pdfBuffer = readFileSync(pdfPath);
      const fileKey = `monthly-reports/relatorio_mensal_${currentPeriod.label.replace(" ", "_")}_${timestamp}.pdf`;
      const uploaded = await storagePut(fileKey, pdfBuffer, "application/pdf");
      pdfUrl = uploaded.url;
      console.log(`[${JOB_NAME}] PDF gerado e enviado para S3: ${pdfUrl}`);
    } catch (pdfErr: any) {
      console.warn(`[${JOB_NAME}] Não foi possível gerar o PDF:`, pdfErr?.message);
    }

    // ── 5. Montar e-mail ─────────────────────────────────────────────────────
    const subject = `[Relatório Mensal] Google Ads Zênite Tech — ${currentPeriod.label}`;
    const emailBody = [
      `Olá Ricardo,`,
      ``,
      `Segue o Relatório Executivo Mensal de Google Ads da Zênite Tech.`,
      ``,
      `PERÍODO: ${currentPeriod.label} (${currentPeriod.start} a ${currentPeriod.end})`,
      ``,
      `ANÁLISE EXECUTIVA`,
      `=================`,
      aiAnalysis,
      ``,
      `RESUMO DO MÊS`,
      `=============`,
      `• Impressões: ${currentMetrics.totals.impressions.toLocaleString("pt-BR")} (${fmtDelta(currentMetrics.totals.impressions, previousMetrics.totals.impressions)} vs ${previousPeriod.label})`,
      `• Cliques: ${currentMetrics.totals.clicks.toLocaleString("pt-BR")} (${fmtDelta(currentMetrics.totals.clicks, previousMetrics.totals.clicks)} vs ${previousPeriod.label})`,
      `• Gasto Total: ${fmtBRL(currentMetrics.totals.costBRL)} (${fmtDelta(currentMetrics.totals.costBRL, previousMetrics.totals.costBRL)} vs ${previousPeriod.label})`,
      `• Conversões: ${currentMetrics.totals.conversions} (${fmtDelta(currentMetrics.totals.conversions, previousMetrics.totals.conversions)} vs ${previousPeriod.label})`,
      `• CTR Médio: ${fmtPct(currentMetrics.totals.avgCtr)}`,
      `• CPC Médio: ${fmtBRL(currentMetrics.totals.avgCpc)}`,
      ``,
      `CAMPANHAS ATIVAS`,
      `================`,
      ...currentMetrics.campaigns
        .filter((c) => c.clicks > 0)
        .map((c) => `• ${c.name}: ${fmtBRL(c.costBRL)} gasto | CTR ${fmtPct(c.ctr)} | ${c.conversions} conversões`),
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
      console.log(`[${JOB_NAME}] E-mail enviado para ${recipients.join(", ")}`);
    } catch (emailErr: any) {
      console.error(`[${JOB_NAME}] Erro ao enviar e-mail:`, emailErr?.message ?? emailErr);
    }

    // ── 7. Notificação push ───────────────────────────────────────────────────
    const notifTitle = emailSent
      ? `Relatório Mensal Enviado — ${currentPeriod.label}`
      : `Relatório Mensal: Falha no E-mail — ${currentPeriod.label}`;
    const notifContent = emailSent
      ? `Relatório mensal de ${currentPeriod.label} enviado para ${recipients.join(", ")}. Gasto: ${fmtBRL(currentMetrics.totals.costBRL)} | CTR: ${fmtPct(currentMetrics.totals.avgCtr)} | Conversões: ${currentMetrics.totals.conversions}${pdfUrl ? ` | PDF disponível` : ""}`
      : `Tentativa de envio do relatório mensal falhou. Acesse o dashboard: ${DASHBOARD_URL}/log-diretoria`;
    await notifyOwner({ title: notifTitle, content: notifContent });

    console.log(`[${JOB_NAME}] Relatório mensal concluído.`);
    return { success: true, emailSent, pdfUrl };
  } catch (err: any) {
    console.error(`[${JOB_NAME}] Erro crítico:`, err?.message ?? err);
    await notifyOwner({
      title: `Erro no Relatório Mensal`,
      content: `Falha ao gerar relatório mensal: ${err?.message ?? "Erro desconhecido"}`,
    }).catch(() => {});
    return { success: false, emailSent: false, pdfUrl: null };
  }
}

// ─── Agendamento ──────────────────────────────────────────────────────────────

// Todo dia 1º do mês às 8h (America/Sao_Paulo)
cron.schedule(
  "0 8 1 * *",
  () => {
    sendMonthlyExecutiveReport();
  },
  {
    timezone: "America/Sao_Paulo",
  }
);

console.log(`[${JOB_NAME}] Job agendado: todo dia 1º do mês às 8h (America/Sao_Paulo)`);
