/**
 * notifyAndSave — wrapper que envia notificação ao dono do projeto
 * E simultaneamente salva a notificação no banco (in_app_notifications)
 * para exibição no painel Central de Notificações.
 *
 * Uso: substitua `notifyOwner({ title, content })` por
 *      `notifyAndSave({ title, content, type, source })`
 */
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { inAppNotifications } from "../drizzle/schema";

export type NotifyType = "info" | "success" | "warning" | "error";

export interface NotifyPayload {
  title: string;
  content: string;
  type?: NotifyType;
  source?: string; // ex: "instagram-sync", "auto-negative", "integration"
}

export async function notifyAndSave(payload: NotifyPayload): Promise<boolean> {
  const { title, content, type = "info", source = "system" } = payload;

  // Salvar in-app (não bloqueia se falhar)
  try {
    const db = await getDb();
    if (db) {
      await db.insert(inAppNotifications).values({
        title: title.slice(0, 255),
        content: content.slice(0, 5000),
        type,
        source,
        read: 0,
        createdAt: new Date(),
      });
    }
  } catch (err) {
    console.warn("[notifyAndSave] Falha ao salvar notificação in-app:", err);
  }

  // Enviar notificação ao dono (comportamento original)
  return notifyOwner({ title, content });
}
