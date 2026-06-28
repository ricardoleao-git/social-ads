/**
 * Sincronização do Instagram via Graph API
 * ==========================================
 * Busca posts reais, métricas e insights do @zenite.tech
 * usando o META_ADS_ACCESS_TOKEN com instagram_basic + instagram_manage_insights
 *
 * Uso: node scripts/sync-instagram-graphapi.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const TOKEN = process.env.META_ADS_ACCESS_TOKEN;
const IG_ID = "17841406636761935"; // @zenite.tech
const BASE_URL = "https://graph.facebook.com/v19.0";

if (!TOKEN) {
  console.error("❌ META_ADS_ACCESS_TOKEN não encontrado no .env");
  process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new Error(`API Error: ${data.error.message} (code: ${data.error.code})`);
  }
  return data;
}

async function syncInstagram() {
  console.log("🔄 Iniciando sincronização do Instagram @zenite.tech via Graph API...");
  console.log(`📅 ${new Date().toISOString()}`);
  console.log("");

  // 1. Buscar informações da conta
  console.log("1️⃣  Buscando informações da conta...");
  const accountData = await fetchJson(
    `${BASE_URL}/${IG_ID}?fields=id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website&access_token=${TOKEN}`
  );
  console.log(`   ✅ @${accountData.username} — ${accountData.followers_count} seguidores, ${accountData.media_count} posts`);

  // 2. Buscar posts recentes com métricas
  console.log("2️⃣  Buscando posts recentes...");
  const mediaData = await fetchJson(
    `${BASE_URL}/${IG_ID}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=30&access_token=${TOKEN}`
  );
  console.log(`   ✅ ${mediaData.data.length} posts obtidos`);

  // 3. Tentar buscar insights da conta (requer instagram_manage_insights)
  let accountInsights = null;
  try {
    console.log("3️⃣  Buscando insights da conta (últimos 30 dias)...");
    const since = Math.floor(Date.now() / 1000) - 30 * 86400;
    const until = Math.floor(Date.now() / 1000);
    // Métricas do tipo time_series (period=day)
    const reachData = await fetchJson(
      `${BASE_URL}/${IG_ID}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${TOKEN}`
    );
    // Métricas do tipo total_value
    const totalData = await fetchJson(
      `${BASE_URL}/${IG_ID}/insights?metric=profile_views,website_clicks,accounts_engaged,total_interactions&metric_type=total_value&period=day&since=${since}&until=${until}&access_token=${TOKEN}`
    );
    accountInsights = [...(reachData.data || []), ...(totalData.data || [])];
    console.log(`   ✅ Insights obtidos: ${accountInsights.length} métricas`);
  } catch (err) {
    console.log(`   ⚠️  Insights não disponíveis: ${err.message}`);
  }

  // 4. Tentar buscar insights por post (like_count, comments_count já vêm no media)
  const postsWithInsights = [];
  console.log("4️⃣  Processando posts...");
  for (const post of mediaData.data) {
    postsWithInsights.push({
      id: post.id,
      type: post.media_type,
      caption: post.caption || "",
      link: post.permalink,
      likes: post.like_count || 0,
      comments: post.comments_count || 0,
      posted: post.timestamp,
      mediaUrl: post.media_url || post.thumbnail_url || "",
      thumbnailUrl: post.thumbnail_url || post.media_url || "",
    });
  }

  // 5. Calcular métricas agregadas
  const totalLikes = postsWithInsights.reduce((s, p) => s + p.likes, 0);
  const totalComments = postsWithInsights.reduce((s, p) => s + p.comments, 0);
  const avgLikes = postsWithInsights.length > 0 ? Math.round(totalLikes / postsWithInsights.length) : 0;
  const avgComments = postsWithInsights.length > 0 ? Math.round(totalComments / postsWithInsights.length) : 0;
  const avgEngagement = accountData.followers_count > 0
    ? parseFloat(((totalLikes + totalComments) / postsWithInsights.length / accountData.followers_count * 100).toFixed(2))
    : 0;

  // Contagem por tipo de mídia
  const mediaTypes = postsWithInsights.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {});

  // Posts por mês
  const postsByMonth = postsWithInsights.reduce((acc, p) => {
    const month = p.posted.substring(0, 7); // YYYY-MM
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  // 6. Montar o objeto de cache
  const cacheData = {
    syncedAt: new Date().toISOString(),
    source: "graph_api_direct",
    account: {
      id: accountData.id,
      username: accountData.username,
      name: accountData.name,
      bio: accountData.biography || "",
      followers: accountData.followers_count,
      following: accountData.follows_count,
      totalPosts: accountData.media_count,
      website: accountData.website || "",
      profilePicture: accountData.profile_picture_url || "",
    },
    metrics: {
      totalLikes,
      totalComments,
      avgLikes,
      avgComments,
      avgEngagement,
      recentPostsAnalyzed: postsWithInsights.length,
      mediaTypes,
      postsByMonth,
    },
    posts: postsWithInsights,
    insights: accountInsights,
  };

  // 7. Salvar o cache
  const cachePath = path.join(__dirname, "../server/instagram-cache-zenite.tech.json");
  fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
  console.log(`   ✅ ${postsWithInsights.length} posts processados`);
  console.log("");
  console.log("✅ Cache salvo em:", cachePath);
  console.log("");
  console.log("📊 Resumo:");
  console.log(`   👥 Seguidores: ${accountData.followers_count.toLocaleString("pt-BR")}`);
  console.log(`   📸 Total de posts: ${accountData.media_count}`);
  console.log(`   ❤️  Likes médios: ${avgLikes}`);
  console.log(`   💬 Comentários médios: ${avgComments}`);
  console.log(`   📈 Engajamento médio: ${avgEngagement}%`);
  console.log(`   🎬 Tipos de mídia:`, mediaTypes);
  console.log("");
  console.log("🎉 Sincronização concluída com sucesso!");
}

syncInstagram().catch((err) => {
  console.error("❌ Erro na sincronização:", err.message);
  process.exit(1);
});
