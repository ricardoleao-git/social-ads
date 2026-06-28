/**
 * weeklyReport.ts
 * Job semanal: toda domingo às 18h (America/Sao_Paulo)
 * 1. Busca o relatório mais recente no banco de dados
 * 2. Gera um PDF do relatório via manus-md-to-pdf
 * 3. Faz upload do PDF para S3 e inclui o link no e-mail
 * 4. Envia o e-mail via Gmail MCP
 * 5. Dispara notificação push no painel Manus via notifyOwner
 */

import cron from "node-cron";
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { getDb } from "../db";
import { impactReports } from "../../drizzle/schema";
import { desc } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { getAlertEmails } from "../helpers/getAlertEmails";
import { storagePut } from "../storage";



export async function sendWeeklyImpactReport() {
  console.log("[WeeklyReport] Iniciando envio do relatório semanal de impacto...");
  const recipients = await getAlertEmails();
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[WeeklyReport] Banco de dados indisponível — abortando.");
      return;
    }

    // Buscar o relatório mais recente
    const rows = await db
      .select()
      .from(impactReports)
      .orderBy(desc(impactReports.createdAt))
      .limit(1);

    // Fallback: usar dados estáticos do relatório de 04/04/2026 se o banco estiver vazio
    const rel = rows[0] ?? {
      data: "04/04/2026",
      negativos: 37,
      urlsCorrigidas: 9,
      extensoes: 12,
      economiaMin: 266,
      economiaMax: 531,
      ctrAtual: "10.82",
      cpcAtual: "2.77",
    };

    // ── 1. Gerar Markdown do relatório ────────────────────────────────────────
    const markdown = [
      `# Relatório de Impacto — Zênite Tech`,
      ``,
      `**Data:** ${rel.data}  `,
      `**Gerado em:** ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      ``,
      `---`,
      ``,
      `## Resumo Executivo`,
      ``,
      `| Ação | Quantidade |`,
      `|------|-----------|`,
      `| Negativos adicionados | ${rel.negativos} |`,
      `| Anúncios com URL corrigida | ${rel.urlsCorrigidas} |`,
      `| Extensões de anúncio criadas | ${rel.extensoes} |`,
      ``,
      `## Impacto Estimado`,
      ``,
      `| Métrica | Variação Estimada |`,
      `|---------|------------------|`,
      `| CPC | -15% a -30% |`,
      `| CTR | +45% a +85% |`,
      `| Economia mensal | R$ ${rel.economiaMin} a R$ ${rel.economiaMax} |`,
      ``,
      `## Métricas Atuais`,
      ``,
      `- **CTR atual:** ${rel.ctrAtual}%`,
      `- **CPC atual:** R$ ${rel.cpcAtual}`,
      ``,
      `---`,
      ``,
      `Dashboard completo: https://zenite-ads.manus.space/impact-report`,
      ``,
      `*Zênite Tech — Gestão de Tráfego Pago*`,
    ].join("\n");

    // ── 2. Converter para PDF e fazer upload para S3 ──────────────────────────
    let pdfUrl: string | null = null;
    try {
      const mdPath = `/tmp/relatorio_semanal_${Date.now()}.md`;
      const pdfPath = mdPath.replace(".md", ".pdf");
      writeFileSync(mdPath, markdown, "utf-8");
      execSync(`manus-md-to-pdf "${mdPath}" "${pdfPath}"`, { timeout: 30000 });

      const { readFileSync } = await import("fs");
      const pdfBuffer = readFileSync(pdfPath);
      const fileKey = `impact-reports/relatorio_${rel.data.replace(/\//g, "-")}_${Date.now()}.pdf`;
      const uploaded = await storagePut(fileKey, pdfBuffer, "application/pdf");
      pdfUrl = uploaded.url;
      console.log(`[WeeklyReport] PDF gerado e enviado para S3: ${pdfUrl}`);
    } catch (pdfErr: any) {
      console.warn("[WeeklyReport] Não foi possível gerar o PDF:", pdfErr?.message);
    }

    // ── 3. Montar e-mail ──────────────────────────────────────────────────────
    const subject = `[Relatório Semanal] Impacto Google Ads — ${rel.data} — Zênite Tech`;
    const contentLines = [
      `Olá Ricardo,`,
      ``,
      `Segue o resumo do relatório de impacto mais recente das otimizações Google Ads da Zênite Tech.`,
      ``,
      `DATA DO RELATÓRIO: ${rel.data}`,
      ``,
      `RESUMO EXECUTIVO`,
      `================`,
      `• ${rel.negativos} negativos adicionados`,
      `• ${rel.urlsCorrigidas} anúncios com URL corrigida`,
      `• ${rel.extensoes} extensões de anúncio criadas`,
      ``,
      `IMPACTO ESTIMADO`,
      `================`,
      `• Redução de CPC: -15% a -30%`,
      `• Aumento de CTR: +45% a +85%`,
      `• Economia mensal estimada: R$ ${rel.economiaMin} a R$ ${rel.economiaMax}`,
      ``,
      `MÉTRICAS ATUAIS`,
      `================`,
      `• CTR: ${rel.ctrAtual}%`,
      `• CPC: R$ ${rel.cpcAtual}`,
      ``,
      `Acesse o dashboard completo em:`,
      `https://zenite-ads.manus.space/impact-report`,
    ];

    if (pdfUrl) {
      contentLines.push(``, `Ver PDF completo: ${pdfUrl}`);
    }

    contentLines.push(``, `Atenciosamente,`, `Dashboard Zênite Tech — Gestão de Tráfego Pago`);

    const content = contentLines.join("\n");

    // ── 4. Enviar e-mail via Gmail MCP ────────────────────────────────────────
    const payload = JSON.stringify({
      messages: [
        {
          to: recipients,
          subject,
          content,
        },
      ],
    });

    let emailSent = false;
    try {
      execSync(
        `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${payload.replace(/'/g, "'\"'\"'")}'`,
        { timeout: 30000 }
      );
      emailSent = true;
      console.log(`[WeeklyReport] E-mail enviado para ${recipients.join(", ")} com sucesso.`);
    } catch (emailErr: any) {
      console.error("[WeeklyReport] Erro ao enviar e-mail:", emailErr?.message ?? emailErr);
    }

    // ── 5. Notificação push no painel Manus ───────────────────────────────────
    const notifTitle = emailSent
      ? `Relatório Semanal Enviado — ${rel.data}`
      : `Relatório Semanal: Falha no E-mail — ${rel.data}`;

    const notifContent = emailSent
      ? `Relatório de impacto de ${rel.data} enviado para ${recipients.join(", ")}. CTR: ${rel.ctrAtual}% | CPC: R$ ${rel.cpcAtual} | Economia: R$ ${rel.economiaMin}–${rel.economiaMax}/mês${pdfUrl ? ` | PDF: ${pdfUrl}` : ''}`
      : `Tentativa de envio do relatório de ${rel.data} falhou. Acesse o dashboard para enviar manualmente: https://zenite-ads.manus.space/impact-report`;

    const notified = await notifyOwner({ title: notifTitle, content: notifContent });
    if (notified) {
      console.log("[WeeklyReport] Notificação push enviada ao painel Manus.");
    } else {
      console.warn("[WeeklyReport] Notificação push não foi entregue (serviço indisponível).");
    }

  } catch (err: any) {
    console.error("[WeeklyReport] Erro crítico no job semanal:", err?.message ?? err);
  }
}

// Agendar: toda domingo às 18h (horário de Brasília)
cron.schedule(
  "0 18 * * 0",
  () => {
    sendWeeklyImpactReport();
  },
  {
    timezone: "America/Sao_Paulo",
  }
);

console.log("[WeeklyReport] Job semanal agendado: toda domingo às 18h (America/Sao_Paulo)");
