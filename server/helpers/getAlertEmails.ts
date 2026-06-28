/**
 * Helper centralizado para obter os e-mails de alerta configurados no banco.
 * Usado por todos os jobs e routers que enviam alertas automáticos.
 * Fallback para os e-mails padrão se o banco não estiver disponível.
 */
import { getDb } from "../db";
import { alertEmailConfig } from "../../drizzle/schema";

const DEFAULT_EMAILS = ["atendimento@zenite.tech", "rjll70@gmail.com"];

/**
 * Retorna a lista de e-mails de alerta configurados no banco.
 * Sempre retorna ao menos os e-mails padrão como fallback.
 */
export async function getAlertEmails(): Promise<string[]> {
  try {
    const db = await getDb();
    if (!db) return DEFAULT_EMAILS;

    const rows = await db.select().from(alertEmailConfig).limit(1);
    if (rows.length === 0 || !rows[0].emails) return DEFAULT_EMAILS;

    const emails = rows[0].emails
      .replace(/;/g, ",")
      .split(",")
      .map((e: string) => e.trim())
      .filter((e: string) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    return emails.length > 0 ? emails : DEFAULT_EMAILS;
  } catch (err) {
    console.error("[getAlertEmails] Erro ao ler e-mails do banco, usando fallback:", err);
    return DEFAULT_EMAILS;
  }
}
