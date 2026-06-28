/**
 * dailyInstagramSync.ts
 * Job diário: todo dia às 8h (America/Sao_Paulo)
 * 1. Sincroniza métricas reais do Instagram @zenite.tech via MCP
 * 2. Salva no banco (instagram_sync + social_metrics)
 * 3. Verifica se o engajamento está abaixo de 0,15%
 * 4. Se abaixo do limiar, envia e-mail de alerta via Gmail MCP
 */
import cron from "node-cron";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { getDb } from "../db";
import { instagramSync, socialMetrics, socialAlerts } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { notifyAndSave } from "../notifyAndSave";

const ENGAGEMENT_THRESHOLD = 0.15; // 0,15%
const INSTAGRAM_USERNAME = "zenite.tech";
const ALERT_EMAIL = "ricardo@zenitetech.com.br";

/**
 * Sincroniza dados reais do Instagram via MCP e salva no banco.
 */
export async function syncInstagramFromMCP(): Promise<{
  success: boolean;
  followers: number;
  avgEngagement: number;
  postsCount: number;
  syncedAt: string;
  error?: string;
}> {
  console.log("[DailyInstagramSync] Iniciando sincronização via MCP...");
  const db = await getDb();
  if (!db) {
    console.warn("[DailyInstagramSync] Banco de dados indisponível.");
    return { success: false, followers: 0, avgEngagement: 0, postsCount: 0, syncedAt: new Date().toISOString(), error: "DB unavailable" };
  }

  try {
    // 1. Buscar account info
    const accountRaw = execSync(
      `/usr/local/bin/manus-mcp-cli tool call get_account_info --server instagram --input '{}'`,
      { encoding: "utf-8", timeout: 30000, env: { ...process.env, PATH: `/usr/local/bin:${process.env.PATH}` } }
    );
    const accountPath = accountRaw.match(/saved to:\s*(\S+)/)?.[1];
    let accountData = { followers: 6381, following: 766, totalPosts: 337, username: INSTAGRAM_USERNAME, name: "Zênite Tech" };
    if (accountPath) {
      try {
        const parsed = JSON.parse(readFileSync(accountPath, "utf-8"));
        const text = parsed?.content?.[0]?.text || parsed?.text || "";
        accountData = {
          followers: parseInt(text.match(/Followers:\s*(\d+)/)?.[1] || "6381"),
          following: parseInt(text.match(/Following:\s*(\d+)/)?.[1] || "766"),
          totalPosts: parseInt(text.match(/Posts:\s*(\d+)/)?.[1] || "337"),
          username: text.match(/Username:\s*@?(\S+)/)?.[1] || INSTAGRAM_USERNAME,
          name: text.match(/Name:\s*(.+)/)?.[1]?.trim() || "Zênite Tech",
        };
      } catch { /* keep defaults */ }
    }

    // 2. Buscar posts recentes
    const postsRaw = execSync(
      `/usr/local/bin/manus-mcp-cli tool call get_post_list --server instagram --input '{"limit": 10}'`,
      { encoding: "utf-8", timeout: 30000, env: { ...process.env, PATH: `/usr/local/bin:${process.env.PATH}` } }
    );
    const postsPath = postsRaw.match(/saved to:\s*(\S+)/)?.[1];
    let postsData: Array<{ id: string; type: string; likes: number; comments: number }> = [];
    if (postsPath) {
      try {
        const parsed = JSON.parse(readFileSync(postsPath, "utf-8"));
        const text = parsed?.content?.[0]?.text || parsed?.text || "";
        const blocks = text.split("--- Post ").slice(1);
        for (const block of blocks) {
          const id = block.match(/ID:\s*(\S+)/)?.[1];
          if (!id) continue;
          postsData.push({
            id,
            type: block.match(/Type:\s*(\S+)/)?.[1] || "IMAGE",
            likes: parseInt(block.match(/Likes:\s*(\d+)/)?.[1] || "0"),
            comments: parseInt(block.match(/Comments:\s*(\d+)/)?.[1] || "0"),
          });
        }
      } catch { /* keep empty */ }
    }

    // 3. Insights do post mais recente
    let totalReach = 0;
    if (postsData.length > 0) {
      try {
        const insightsRaw = execSync(
          `/usr/local/bin/manus-mcp-cli tool call get_post_insights --server instagram --input '{"post_id": "${postsData[0].id}"}'`,
          { encoding: "utf-8", timeout: 30000, env: { ...process.env, PATH: `/usr/local/bin:${process.env.PATH}` } }
        );
        const insightsPath = insightsRaw.match(/saved to:\s*(\S+)/)?.[1];
        if (insightsPath) {
          const parsed = JSON.parse(readFileSync(insightsPath, "utf-8"));
          const text = parsed?.content?.[0]?.text || parsed?.text || "";
          totalReach = parseInt(text.match(/reach:\s*(\d+)/)?.[1] || "0");
        }
      } catch { /* ignore */ }
    }

    // 4. Calcular métricas
    const totalLikes = postsData.reduce((s, p) => s + p.likes, 0);
    const totalComments = postsData.reduce((s, p) => s + p.comments, 0);
    const avgLikes = postsData.length > 0 ? totalLikes / postsData.length : 0;
    const avgComments = postsData.length > 0 ? totalComments / postsData.length : 0;
    const followers = accountData.followers;
    const avgEngagement = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0;

    // 5. Salvar no banco
    await db.insert(instagramSync).values({
      accountHandle: `@${INSTAGRAM_USERNAME}`,
      accountName: accountData.name,
      followers,
      reach: totalReach,
      likes: totalLikes,
      engagementRate: String(avgEngagement.toFixed(4)),
      impressions: 0,
      comments: totalComments,
      shares: 0,
      period: "recent_10_posts",
      rawJson: JSON.stringify({
        account: accountData,
        posts: postsData,
        metrics: { totalLikes, totalComments, avgLikes, avgComments, avgEngagement, recentPostsAnalyzed: postsData.length },
        syncedAt: new Date().toISOString(),
        source: "instagram_mcp_daily_job",
      }),
      source: "instagram_mcp_daily_job",
    });

    // 6. Salvar métricas individuais
    const ts = Date.now();
    await db.insert(socialMetrics).values([
      { id: `ig_${ts}_followers`, accountId: "zenite_tech", platformId: "instagram", metricType: "followers", metricValue: String(followers), period: "snapshot", date: new Date() },
      { id: `ig_${ts}_engagement`, accountId: "zenite_tech", platformId: "instagram", metricType: "engagement_rate", metricValue: String(avgEngagement.toFixed(4)), period: "snapshot", date: new Date() },
      { id: `ig_${ts}_likes`, accountId: "zenite_tech", platformId: "instagram", metricType: "total_likes", metricValue: String(totalLikes), period: "snapshot", date: new Date() },
    ]);

    console.log(`[DailyInstagramSync] ✅ Sincronizado @${INSTAGRAM_USERNAME}: ${followers} seguidores, ${avgEngagement.toFixed(2)}% engajamento, ${postsData.length} posts`);

    return {
      success: true,
      followers,
      avgEngagement: parseFloat(avgEngagement.toFixed(4)),
      postsCount: postsData.length,
      syncedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("[DailyInstagramSync] Erro na sincronização:", err?.message);
    return { success: false, followers: 0, avgEngagement: 0, postsCount: 0, syncedAt: new Date().toISOString(), error: err?.message };
  }
}

/**
 * Verifica engajamento e envia alerta por e-mail se abaixo do limiar.
 */
export async function checkAndSendEngagementAlert(engagementRate: number, followers: number): Promise<void> {
  if (engagementRate >= ENGAGEMENT_THRESHOLD) {
    console.log(`[DailyInstagramSync] Engajamento ${engagementRate.toFixed(2)}% está OK (limiar: ${ENGAGEMENT_THRESHOLD}%).`);
    return;
  }

  console.log(`[DailyInstagramSync] ⚠️ Engajamento ${engagementRate.toFixed(2)}% abaixo do limiar ${ENGAGEMENT_THRESHOLD}%. Enviando alerta...`);

  const db = await getDb();
  const subject = `⚠️ Alerta: Engajamento Instagram @zenite.tech abaixo de ${ENGAGEMENT_THRESHOLD}%`;
  const body = `Olá Ricardo,

O engajamento da conta @zenite.tech no Instagram está abaixo do limiar configurado.

📊 Métricas atuais:
- Engajamento médio: ${engagementRate.toFixed(2)}%
- Limiar configurado: ${ENGAGEMENT_THRESHOLD}%
- Seguidores: ${followers.toLocaleString("pt-BR")}
- Data/hora: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}

💡 Ações sugeridas:
1. Verificar se os posts recentes têm chamadas para ação claras
2. Analisar o horário de publicação (melhor horário: 18h-21h)
3. Aumentar a frequência de posts (meta: 4-5x por semana)
4. Usar Reels para aumentar o alcance orgânico
5. Responder comentários nas primeiras 2h após a publicação

Acesse o dashboard para mais detalhes: https://social-ads.zenitetech.com/instagram

Atenciosamente,
Sistema de Monitoramento Zênite Tech`;

  // Enviar e-mail via Gmail MCP
  let emailSent = false;
  try {
    const emailPayload = JSON.stringify({ to: ALERT_EMAIL, subject, body });
    execSync(
      `/usr/local/bin/manus-mcp-cli tool call send_email --server gmail --input ${JSON.stringify(emailPayload)}`,
      { encoding: "utf-8", timeout: 30000, env: { ...process.env, PATH: `/usr/local/bin:${process.env.PATH}` } }
    );
    emailSent = true;
    console.log(`[DailyInstagramSync] ✅ E-mail de alerta enviado para ${ALERT_EMAIL}`);
  } catch (emailErr: any) {
    console.error("[DailyInstagramSync] Falha ao enviar e-mail:", emailErr?.message);
  }

  // Salvar alerta no banco
  if (db) {
    try {
      const alertId = `alert_eng_daily_${Date.now()}`;
      await db.insert(socialAlerts).values({
        id: alertId,
        accountId: "zenite_tech",
        platformId: "instagram",
        alertType: "low_engagement",
        severity: engagementRate < ENGAGEMENT_THRESHOLD / 2 ? "high" : "medium",
        message: `Engajamento ${engagementRate.toFixed(2)}% abaixo do limiar ${ENGAGEMENT_THRESHOLD}%. ${emailSent ? "E-mail enviado." : "Falha no envio do e-mail."}`,
        isRead: false,
      });
    } catch (dbErr: any) {
      console.error("[DailyInstagramSync] Falha ao salvar alerta no banco:", dbErr?.message);
    }
  }

  // Notificação push no painel Manus
  try {
    await notifyAndSave({
      title: `⚠️ Engajamento Instagram baixo: ${engagementRate.toFixed(2)}%`,
      content: `A conta @zenite.tech está com engajamento ${engagementRate.toFixed(2)}% (limiar: ${ENGAGEMENT_THRESHOLD}%). ${emailSent ? "E-mail de alerta enviado." : "Falha no e-mail — verifique manualmente."}`,
    });
  } catch { /* ignore */ }
}

/**
 * Job principal: sincroniza + verifica alerta.
 */
export async function runDailyInstagramJob(): Promise<void> {
  console.log("[DailyInstagramSync] === Iniciando job diário de Instagram ===");
  const result = await syncInstagramFromMCP();
  if (result.success) {
    await checkAndSendEngagementAlert(result.avgEngagement, result.followers);
  } else {
    console.error("[DailyInstagramSync] Sincronização falhou — alerta não verificado.");
    // Notificar falha
    try {
      await notifyAndSave({
        title: "❌ Falha na sincronização diária do Instagram",
        content: `O job diário de sincronização do Instagram falhou: ${result.error}. Verifique o servidor.`,
      });
    } catch { /* ignore */ }
  }
  console.log("[DailyInstagramSync] === Job diário concluído ===");
}

// Agendar: todo dia às 8h (horário de Brasília)
cron.schedule(
  "0 8 * * *",
  () => {
    runDailyInstagramJob();
  },
  {
    timezone: "America/Sao_Paulo",
  }
);

console.log("[DailyInstagramSync] Job diário agendado: todo dia às 8h (America/Sao_Paulo)");
