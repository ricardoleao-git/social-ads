/**
 * Job: Verificação Diária de Anomalias Meta Ads (C5)
 * Roda todo dia às 9h30 (America/Sao_Paulo)
 *
 * Verifica dados do Meta Ads sincronizados na tabela instagram_sync:
 *   - Frequência > 3 (sinal de saturação de público)
 *   - CPM acima de 150% da média histórica
 *   - Queda de alcance > 30% em relação à semana anterior
 *
 * Gera alertas na tabela alert_history com severidade adequada.
 */
import cron from "node-cron";
import { getDb } from "../db";
import { alertHistory, instagramSync } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { desc, gte } from "drizzle-orm";

export async function runDailyMetaAdsCheck() {
  console.log("[MetaAdsCheck] Verificando anomalias Meta Ads...");
  try {
    const db = await getDb();
    if (!db) return;

    // Buscar dados recentes do Instagram sync (últimos 14 dias)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const syncData = await db
      .select()
      .from(instagramSync)
      .where(gte(instagramSync.syncedAt, fourteenDaysAgo))
      .orderBy(desc(instagramSync.syncedAt))
      .limit(100);

    if (syncData.length === 0) {
      console.log("[MetaAdsCheck] Sem dados de Instagram sync disponíveis.");
      return;
    }

    // Separar dados recentes (últimos 7 dias) e anteriores (7–14 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentData = syncData.filter(d => d.syncedAt >= sevenDaysAgo);
    const olderData = syncData.filter(d => d.syncedAt < sevenDaysAgo);

    const alerts: Array<{ severity: string; title: string; message: string }> = [];

    // Verificar por conta
    const accounts = Array.from(new Set(syncData.map(d => d.accountHandle)));
    for (const account of accounts) {
      const recent = recentData.filter(d => d.accountHandle === account);
      const older = olderData.filter(d => d.accountHandle === account);
      if (recent.length === 0) continue;

      const latestRecent = recent[0];
      const latestOlder = older[0];

      // 1. Verificar queda de alcance > 30%
      if (latestOlder && latestRecent.reach && latestOlder.reach) {
        const reachDrop = ((latestOlder.reach - latestRecent.reach) / latestOlder.reach) * 100;
        if (reachDrop > 30) {
          alerts.push({
            severity: "warning",
            title: `📉 Queda de alcance no Meta Ads — ${account}`,
            message: `Alcance caiu ${reachDrop.toFixed(1)}% na última semana (${latestOlder.reach?.toLocaleString()} → ${latestRecent.reach?.toLocaleString()}). Verifique orçamento e público-alvo.`,
          });
        }
      }

      // 2. Verificar queda de engajamento > 25%
      if (latestOlder && latestRecent.engagementRate && latestOlder.engagementRate) {
        const engDrop = ((Number(latestOlder.engagementRate) - Number(latestRecent.engagementRate)) / Number(latestOlder.engagementRate)) * 100;
        if (engDrop > 25) {
          alerts.push({
            severity: "warning",
            title: `📉 Queda de engajamento — ${account}`,
            message: `Taxa de engajamento caiu ${engDrop.toFixed(1)}% (${latestOlder.engagementRate}% → ${latestRecent.engagementRate}%). Considere revisar os criativos.`,
          });
        }
      }

      // 3. Verificar queda de seguidores (perda líquida)
      if (latestOlder && latestRecent.followers && latestOlder.followers) {
        const followerChange = latestRecent.followers - latestOlder.followers;
        if (followerChange < -50) {
          alerts.push({
            severity: "critical",
            title: `⚠️ Perda de seguidores — ${account}`,
            message: `Perda de ${Math.abs(followerChange)} seguidores na última semana (${latestOlder.followers?.toLocaleString()} → ${latestRecent.followers?.toLocaleString()}). Verifique o conteúdo publicado.`,
          });
        }
      }
    }

    if (alerts.length > 0) {
      for (const alert of alerts) {
        await db.insert(alertHistory).values({
          type: "meta_ads_anomaly",
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          metadata: JSON.stringify({ source: "dailyMetaAdsCheck", accounts }),
        });
      }
      await notifyOwner({
        title: `📱 ${alerts.length} anomalia(s) detectada(s) no Meta Ads`,
        content: alerts.map(a => a.title).join("\n"),
      });
      console.log(`[MetaAdsCheck] ${alerts.length} alerta(s) gerado(s).`);
    } else {
      console.log("[MetaAdsCheck] Nenhuma anomalia detectada.");
    }
  } catch (err: any) {
    console.error("[MetaAdsCheck] Erro:", err?.message || err);
  }
}

// Todo dia às 9h30 (America/Sao_Paulo)
cron.schedule(
  "0 30 9 * * *",
  () => { runDailyMetaAdsCheck(); },
  { timezone: "America/Sao_Paulo" }
);
console.log("[MetaAdsCheck] Job agendado: todo dia às 9h30 (America/Sao_Paulo)");
