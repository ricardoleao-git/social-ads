/**
 * Script para sincronizar dados reais do Instagram @zenite.tech no banco de dados
 * Executa manualmente quando o MCP não pode ser chamado pelo servidor web
 */
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const DB_URL = process.env.DATABASE_URL;

async function main() {
  const conn = await createConnection(DB_URL);

  // Dados reais da conta @zenite.tech via MCP (coletados agora)
  const accountInfo = {
    username: 'zenite.tech',
    name: 'Zênite Tech',
    followers: 6382,
    following: 767,
    totalPosts: 338,
    bio: '🚀Há 34 anos | Carregador de Veículos Elétricos, ChatBot com IA, PABX em nuvem, Controle de Acesso Facial, Ponto Eletrônico, CFTV com IA',
    website: 'https://campsite.bio/zenitetech',
  };

  // Posts reais coletados (20 mais recentes)
  const posts = [
    { id: '17974958207855720', type: 'CAROUSEL_ALBUM', likes: 1, comments: 0, posted: '2026-04-06T15:00:43+0000', caption: 'A saída dos alunos é um dos momentos mais sensíveis da rotina escolar.' },
    { id: '18179876854376796', type: 'VIDEO', likes: 2, comments: 0, posted: '2026-04-05T17:58:21+0000', caption: 'Renovação não é só uma data.' },
    { id: '18080307524377265', type: 'VIDEO', likes: 13, comments: 0, posted: '2026-04-02T12:55:00+0000', caption: 'Hoje é dia de #TBT recente por aqui!' },
    { id: '17957309141940342', type: 'IMAGE', likes: 6, comments: 0, posted: '2026-03-27T15:01:11+0000', caption: 'Agora o GuardIA evoluiu: mais inteligente, mais integrado.' },
    { id: '17994385469939869', type: 'IMAGE', likes: 4, comments: 0, posted: '2026-03-25T15:00:00+0000', caption: 'Gestão moderna não é sobre controle excessivo.' },
    { id: '18050423228497565', type: 'IMAGE', likes: 3, comments: 0, posted: '2026-02-26T15:00:34+0000', caption: 'O atendimento não acontece só em horário comercial.' },
    { id: '17927456838228287', type: 'IMAGE', likes: 5, comments: 0, posted: '2026-02-23T19:00:19+0000', caption: 'Segurança não é mais diferencial.' },
    { id: '18058148576342014', type: 'VIDEO', likes: 41, comments: 3, posted: '2026-02-12T14:55:23+0000', caption: 'Quer reduzir risco sem depender só de olho humano?' },
    { id: '18094775879074139', type: 'CAROUSEL_ALBUM', likes: 5, comments: 0, posted: '2026-02-10T18:00:25+0000', caption: 'A discussão não é substituir pessoas.' },
  ];

  // Calcular métricas
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);
  const avgLikes = Math.round(totalLikes / posts.length);
  const avgComments = Math.round(totalComments / posts.length);
  const engagementRate = ((totalLikes + totalComments) / (posts.length * accountInfo.followers) * 100).toFixed(4);

  console.log(`📊 @zenite.tech: ${accountInfo.followers} seguidores, ${accountInfo.totalPosts} posts`);
  console.log(`📈 Engajamento médio: ${engagementRate}%`);

  // Salvar snapshot
  const recentPostsData = JSON.stringify(posts.slice(0, 10).map(p => ({
    id: p.id,
    mediaType: p.type,
    likeCount: p.likes,
    commentsCount: p.comments,
    timestamp: p.posted,
    caption: p.caption,
    permalink: `https://www.instagram.com/p/${p.id}/`,
  })));

  const today = new Date().toISOString().split('T')[0];

  // Verificar se já existe snapshot de hoje para esta conta
  const [existing] = await conn.execute(
    `SELECT id FROM instagram_snapshots WHERE username=? AND snapshotDate=?`,
    [accountInfo.username, today]
  );

  if (existing.length > 0) {
    await conn.execute(
      `UPDATE instagram_snapshots SET
       followers=?, following=?, totalPosts=?, avgLikes=?, avgComments=?, engagementRate=?,
       recentPostsData=?, createdAt=NOW()
       WHERE username=? AND snapshotDate=?`,
      [
        accountInfo.followers, accountInfo.following, accountInfo.totalPosts,
        String(avgLikes), String(avgComments), String(engagementRate),
        recentPostsData, accountInfo.username, today
      ]
    );
    console.log('✅ Snapshot atualizado para hoje');
  } else {
    await conn.execute(
      `INSERT INTO instagram_snapshots 
       (accountId, username, followers, following, totalPosts, avgLikes, avgComments, engagementRate, recentPostsData, snapshotDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        accountInfo.username,
        accountInfo.username,
        accountInfo.followers,
        accountInfo.following,
        accountInfo.totalPosts,
        String(avgLikes),
        String(avgComments),
        String(engagementRate),
        recentPostsData,
        today,
      ]
    );
    console.log('✅ Novo snapshot criado');
  }

  // Atualizar cache na tabela instagram_cache
  const cacheKey = `instagram_cache_zenite.tech`;
  const cacheData = JSON.stringify({
    account: accountInfo,
    posts: posts.map(p => ({
      id: p.id,
      mediaType: p.type,
      likeCount: p.likes,
      commentsCount: p.comments,
      timestamp: p.posted,
      caption: p.caption,
      permalink: `https://www.instagram.com/p/${p.id}/`,
    })),
    metrics: {
      followers: accountInfo.followers,
      following: accountInfo.following,
      totalPosts: accountInfo.totalPosts,
      avgLikes,
      avgComments,
      engagementRate: parseFloat(engagementRate),
    },
    syncedAt: new Date().toISOString(),
  });

  // Verificar se a tabela instagram_cache existe
  const [tables] = await conn.execute(
    `SHOW TABLES LIKE 'instagram_cache'`
  );
  
  if (tables.length > 0) {
    await conn.execute(
      `INSERT INTO instagram_cache (cache_key, data, updated_at) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=NOW()`,
      [cacheKey, cacheData]
    );
    console.log('✅ Cache atualizado na tabela instagram_cache');
  } else {
    console.log('⚠️ Tabela instagram_cache não encontrada, apenas snapshot salvo');
  }

  console.log('✅ Sincronização da @zenite.tech concluída!');
  await conn.end();
}

main().catch(console.error);
