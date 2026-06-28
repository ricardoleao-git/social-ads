import { getDb } from "../db.js";
import { jobRunLogs, systemErrors } from "../../drizzle/schema.js";

/**
 * Registra a execução de um job no banco de dados.
 * Use no início e fim de cada job para rastrear status e duração.
 */
export async function logJobRun(
  jobName: string,
  status: "success" | "error" | "skipped",
  message?: string,
  durationMs?: number
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(jobRunLogs).values({
      jobName,
      status,
      message: message ?? null,
      durationMs: durationMs ?? null,
    });
  } catch (err) {
    // Não propagar erro de log para não quebrar o job principal
    console.error("[logJobRun] Falha ao registrar log:", err);
  }
}

/**
 * Registra um erro do sistema no banco de dados.
 * Use em blocos catch de jobs, routers e schedulers.
 */
export async function logSystemError(
  component: string,
  message: string,
  source: "job" | "api" | "router" | "scheduler" = "job",
  stack?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(systemErrors).values({
      source,
      component,
      message,
      stack: stack ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (err) {
    console.error("[logSystemError] Falha ao registrar erro:", err);
  }
}
