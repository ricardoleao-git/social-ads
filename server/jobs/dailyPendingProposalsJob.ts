/**
 * dailyPendingProposalsJob — Roda todo dia às 08:00 (Brasília)
 * ================================================================
 * Verifica se há propostas de negativação pendentes de aprovação.
 * Se houver, envia e-mail de lembrete com resumo e link para o painel.
 *
 * Objetivo: garantir que propostas não expirem sem revisão do Ricardo.
 * Complementa o hourlyAutoNegative (que cria as propostas) e o
 * endpoint /api/integration/approve-negatives (que as executa).
 */
import cron from "node-cron";
import { execSync } from "child_process";
import { getDb } from "../db";
import { negativeProposals } from "../../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import { getAlertEmails } from "../helpers/getAlertEmails";

const JOB_NAME = "dailyPendingProposals";

export async function runDailyPendingProposalsJob(): Promise<void> {
  console.log(`[${JOB_NAME}] Iniciando verificação de propostas pendentes...`);
  try {
    const db = await getDb();
    if (!db) {
      console.warn(`[${JOB_NAME}] Banco de dados indisponível — pulando`);
      return;
    }

    // Buscar propostas pendentes que ainda não expiraram
    const now = new Date();
    const pending = await db
      .select()
      .from(negativeProposals)
      .where(
        and(
          eq(negativeProposals.status, "pending"),
          gt(negativeProposals.expiresAt, now)
        )
      );

    if (pending.length === 0) {
      console.log(`[${JOB_NAME}] Nenhuma proposta pendente — nenhuma ação necessária.`);
      return;
    }

    console.log(`[${JOB_NAME}] ${pending.length} proposta(s) pendente(s) encontrada(s).`);

    // Montar resumo das propostas
    const proposalLines = pending.map((p, i) => {
      let terms: string[] = [];
      try {
        const parsed = JSON.parse(p.termsJson || "[]");
        terms = Array.isArray(parsed) ? parsed.map((t: any) => t.term || t).slice(0, 5) : [];
      } catch (_) {}

      const expiresIn = p.expiresAt
        ? Math.max(0, Math.round((p.expiresAt.getTime() - now.getTime()) / 3_600_000))
        : 0;

      return [
        `${i + 1}. Proposta ${p.proposalId}`,
        `   Campanha: ${p.campaignName || "Pesquisa Leads"}`,
        `   Termos (${p.termCount}): ${terms.length > 0 ? terms.join(", ") : "ver painel"}${terms.length < p.termCount ? "..." : ""}`,
        `   Gasto estimado: R$ ${Number(p.totalSpend || 0).toFixed(2)}`,
        `   Expira em: ${expiresIn}h`,
        `   Criada em: ${p.createdAt ? new Date(p.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}`,
      ].join("\n");
    }).join("\n\n");

    const totalSpend = pending.reduce((acc, p) => acc + Number(p.totalSpend || 0), 0);
    const totalTerms = pending.reduce((acc, p) => acc + (p.termCount || 0), 0);

    const subject = `📋 Lembrete: ${pending.length} proposta(s) de negativação aguardando aprovação — Zênite Tech`;

    const body = [
      `Olá,`,
      ``,
      `Há ${pending.length} proposta(s) de negativação pendente(s) de aprovação no painel de tráfego.`,
      ``,
      `📊 RESUMO`,
      `• Propostas pendentes: ${pending.length}`,
      `• Total de termos a negativar: ${totalTerms}`,
      `• Gasto estimado nos termos: R$ ${totalSpend.toFixed(2)}`,
      ``,
      `📋 DETALHES`,
      proposalLines,
      ``,
      `⚡ AÇÃO NECESSÁRIA`,
      `Acesse o painel para aprovar ou rejeitar cada proposta:`,
      `👉 https://social-ads.zenitetech.com/optimization-panel`,
      ``,
      `⚠️ ATENÇÃO: Propostas não aprovadas expiram automaticamente em 72 horas.`,
      `Após a expiração, nenhuma ação será executada e os termos continuarão ativos.`,
      ``,
      `—`,
      `Dashboard Zênite Tech — Monitoramento Automático`,
      `Enviado automaticamente às 08:00 (Brasília)`,
    ].join("\n");

    // Enviar e-mail para todos os destinatários configurados
    const recipients = await getAlertEmails();
    let sent = 0;
    for (const to of recipients) {
      try {
        const payload = JSON.stringify({ to, subject, body });
        execSync(
          `manus-mcp-cli tool call send_email --server gmail --input '${payload.replace(/'/g, "'\\''")}'`,
          { timeout: 30_000 }
        );
        sent++;
        console.log(`[${JOB_NAME}] E-mail enviado para ${to}`);
      } catch (emailErr: any) {
        console.error(`[${JOB_NAME}] Erro ao enviar e-mail para ${to}:`, emailErr?.message?.substring(0, 100));
      }
    }

    console.log(`[${JOB_NAME}] Concluído — ${pending.length} proposta(s) notificada(s), ${sent} e-mail(s) enviado(s).`);
  } catch (err: any) {
    console.error(`[${JOB_NAME}] Erro:`, err?.message);
  }
}

export function scheduleDailyPendingProposalsJob(): void {
  // Roda todo dia às 08:00 (Brasília = UTC-3 → 11:00 UTC)
  cron.schedule("0 11 * * *", async () => {
    console.log(`[${JOB_NAME}] Executando às 08:00 BRT...`);
    await runDailyPendingProposalsJob();
  });
  console.log(`[${JOB_NAME}] Agendado para 08:00 BRT (11:00 UTC) diariamente.`);
}

// Auto-inicializar quando importado
scheduleDailyPendingProposalsJob();
