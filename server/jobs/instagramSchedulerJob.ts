/**
 * instagramSchedulerJob.ts
 * Job que roda a cada 5 minutos e publica rascunhos agendados com horário vencido.
 * Usa a função publishInstagramDraft() do router instagramCreator.
 */
import cron from "node-cron";
import { getDb } from "../db";
import { instagramDrafts } from "../../drizzle/schema";
import { and, eq, lte, isNotNull } from "drizzle-orm";
import { publishInstagramDraft } from "../routers/instagramCreator";
import { notifyOwner } from "../_core/notification";

let isRunning = false;

async function processScheduledPosts(): Promise<void> {
  if (isRunning) return; // evita sobreposição de execuções
  isRunning = true;

  try {
    const db = await getDb();
    if (!db) return;

    const nowIso = new Date().toISOString();

    // Busca rascunhos com status "scheduled" e scheduledFor <= agora
    const due = await db
      .select()
      .from(instagramDrafts)
      .where(
        and(
          eq(instagramDrafts.status, "scheduled"),
          isNotNull(instagramDrafts.scheduledFor),
          lte(instagramDrafts.scheduledFor, nowIso)
        )
      );

    if (due.length === 0) return;

    console.log(`[InstagramScheduler] ${due.length} post(s) agendado(s) para publicar`);

    for (const draft of due) {
      try {
        const result = await publishInstagramDraft(draft.id);
        console.log(`[InstagramScheduler] ✅ Draft ${draft.id} publicado: ${result.igMediaId}`);
        // Notifica o owner com link direto para o post publicado
        const account = draft.account === "avantclube" ? "@avantclube" : "@zenite.tech";
        const postLink = `https://www.instagram.com/p/${result.igMediaId}/`;
        const caption = draft.caption
          ? draft.caption.slice(0, 80) + (draft.caption.length > 80 ? "..." : "")
          : "(sem legenda)";
        notifyOwner({
          title: `✅ Post publicado no Instagram ${account}`,
          content: `O rascunho #${draft.id} foi publicado automaticamente.\n\n📝 Legenda: ${caption}\n\n🔗 Ver post: ${postLink}`,
        }).catch((e: any) => console.warn("[InstagramScheduler] Notificação falhou:", e.message));
      } catch (err: any) {
        console.error(`[InstagramScheduler] ❌ Draft ${draft.id} falhou: ${err.message}`);
        // O erro já é salvo no campo publishError pelo publishInstagramDraft
      }
    }
  } catch (err: any) {
    console.error("[InstagramScheduler] Erro geral:", err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o job de agendamento do Instagram.
 * Executa a cada 5 minutos no fuso America/Sao_Paulo.
 */
export function startInstagramScheduler(): void {
  console.log("[InstagramScheduler] Job iniciado — verificação a cada 5 minutos");

  cron.schedule("*/5 * * * *", processScheduledPosts, {
    timezone: "America/Sao_Paulo",
  });
}
