/**
 * Instagram Service
 * =================
 * Lê dados reais do Instagram a partir de arquivos de cache JSON (dev)
 * ou do banco de dados (produção/fallback).
 *
 * Estratégia de leitura (em ordem de prioridade):
 * 1. Arquivo de cache JSON local: server/instagram-cache-{username}.json
 * 2. Banco de dados (tabela instagram_sync) — fallback para produção
 *
 * O cache é gerado pelo agente Manus via manus-mcp-cli e salvo no arquivo JSON.
 * O banco de dados é atualizado automaticamente quando o cache JSON é lido com sucesso.
 */
import * as fs from "fs";
import * as path from "path";
import { getDb } from "./db";
import { instagramSync } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const SERVER_DIR = path.join(process.cwd(), "server");

export interface InstagramCacheData {
  account: {
    id: string;
    username: string;
    name: string;
    bio: string;
    followers: number;
    following: number;
    totalPosts: number;
    website: string;
    profilePicture: string;
  };
  metrics: {
    totalLikes: number;
    totalComments: number;
    avgLikes: number;
    avgComments: number;
    avgEngagement: number;
    recentPostsAnalyzed: number;
  };
  posts: Array<{
    id: string;
    type: string;
    caption: string;
    link: string;
    likes: number;
    comments: number;
    posted: string;
    mediaUrl: string;
    thumbnailUrl: string;
  }>;
  syncedAt: string;
  source: string;
}

/**
 * Retorna o caminho do arquivo de cache para uma conta específica.
 */
function getCacheFilePath(username?: string): string {
  if (!username || username === "ricardo_leao") {
    return path.join(SERVER_DIR, "instagram-cache.json");
  }
  const sanitized = username.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(SERVER_DIR, `instagram-cache-${sanitized}.json`);
}

/**
 * Lista todos os caches disponíveis no diretório server/.
 */
export function listAvailableCaches(): string[] {
  try {
    const files = fs.readdirSync(SERVER_DIR);
    const cacheFiles = files.filter(
      (f) => f.startsWith("instagram-cache") && f.endsWith(".json")
    );
    return cacheFiles.map((f) => {
      if (f === "instagram-cache.json") return "ricardo_leao";
      return f.replace("instagram-cache-", "").replace(".json", "");
    });
  } catch {
    return [];
  }
}

/**
 * Lê o cache de dados do Instagram do arquivo JSON local.
 * Retorna null se o arquivo não existir ou estiver corrompido.
 */
export function readInstagramCache(username?: string): InstagramCacheData | null {
  try {
    const cachePath = getCacheFilePath(username);
    if (!fs.existsSync(cachePath)) {
      // Fallback: tentar o cache padrão se não encontrar o específico
      const defaultPath = path.join(SERVER_DIR, "instagram-cache.json");
      if (!fs.existsSync(defaultPath)) {
        console.warn(`[InstagramService] Cache file not found: ${cachePath}`);
        return null;
      }
      const content = fs.readFileSync(defaultPath, "utf-8");
      return JSON.parse(content) as InstagramCacheData;
    }
    const content = fs.readFileSync(cachePath, "utf-8");
    return JSON.parse(content) as InstagramCacheData;
  } catch (err) {
    console.error("[InstagramService] Failed to read cache file:", err);
    return null;
  }
}

/**
 * Salva os dados do Instagram no banco de dados para persistência entre deploys.
 */
export async function saveInstagramCacheToDb(data: InstagramCacheData): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const handle = `@${data.account.username}`;

    await db.insert(instagramSync).values({
      accountHandle: handle,
      accountName: data.account.name,
      followers: data.account.followers,
      reach: 0,
      likes: data.metrics.totalLikes,
      engagementRate: String(data.metrics.avgEngagement.toFixed(2)),
      impressions: 0,
      comments: data.metrics.totalComments,
      shares: 0,
      period: "recent",
      rawJson: JSON.stringify(data),
      source: "instagram_mcp_cache",
    });

    console.log(`[InstagramService] Saved cache to DB for ${handle}`);
  } catch (err) {
    console.error("[InstagramService] Failed to save cache to DB:", err);
  }
}

/**
 * Lê os dados do Instagram do banco de dados (fallback para produção).
 */
export async function readInstagramCacheFromDb(username?: string): Promise<InstagramCacheData | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const handle = username ? `@${username.replace("@", "")}` : "@ricardo_leao";

    const rows = await db
      .select()
      .from(instagramSync)
      .where(eq(instagramSync.accountHandle, handle))
      .orderBy(desc(instagramSync.syncedAt))
      .limit(1);

    if (rows.length === 0 || !rows[0].rawJson) {
      return null;
    }

    return JSON.parse(rows[0].rawJson) as InstagramCacheData;
  } catch (err) {
    console.error("[InstagramService] Failed to read cache from DB:", err);
    return null;
  }
}

/**
 * Verifica se o cache está desatualizado (mais de 24 horas).
 */
export function isCacheStale(cache: InstagramCacheData): boolean {
  const syncedAt = new Date(cache.syncedAt);
  const now = new Date();
  const diffHours = (now.getTime() - syncedAt.getTime()) / (1000 * 60 * 60);
  return diffHours > 24;
}

/**
 * Retorna os dados do cache com metadados de status.
 * Tenta o arquivo JSON primeiro, depois o banco de dados como fallback.
 */
export async function getInstagramData(username?: string): Promise<{
  data: InstagramCacheData | null;
  status: "fresh" | "stale" | "unavailable";
  syncedAt: string | null;
  source: "file" | "database" | "none";
}> {
  // 1. Tentar arquivo JSON local
  const fileCache = readInstagramCache(username);
  if (fileCache) {
    // Salvar no banco de dados de forma assíncrona (não bloqueia)
    saveInstagramCacheToDb(fileCache).catch(() => {});
    const stale = isCacheStale(fileCache);
    return {
      data: fileCache,
      status: stale ? "stale" : "fresh",
      syncedAt: fileCache.syncedAt,
      source: "file",
    };
  }

  // 2. Fallback: banco de dados
  const dbCache = await readInstagramCacheFromDb(username);
  if (dbCache) {
    const stale = isCacheStale(dbCache);
    return {
      data: dbCache,
      status: stale ? "stale" : "fresh",
      syncedAt: dbCache.syncedAt,
      source: "database",
    };
  }

  return { data: null, status: "unavailable", syncedAt: null, source: "none" };
}

/**
 * Versão síncrona para compatibilidade (usa apenas arquivo JSON).
 */
export function getInstagramDataSync(username?: string): {
  data: InstagramCacheData | null;
  status: "fresh" | "stale" | "unavailable";
  syncedAt: string | null;
} {
  const cache = readInstagramCache(username);
  if (!cache) {
    return { data: null, status: "unavailable", syncedAt: null };
  }
  const stale = isCacheStale(cache);
  return {
    data: cache,
    status: stale ? "stale" : "fresh",
    syncedAt: cache.syncedAt,
  };
}
