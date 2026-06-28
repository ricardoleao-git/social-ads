import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Atualizar a conta @ricardo_leao com dados reais
await conn.execute(`
  UPDATE social_accounts 
  SET followers_count = 916, engagement_rate = 3.93, total_posts = 245, is_active = 1, last_sync = NOW()
  WHERE account_handle = '@ricardo_leao' AND id = 'instagram-ricardo-leao'
`);

// Inserir snapshot para @ricardo_leao
await conn.execute(`
  INSERT INTO instagram_snapshots 
  (account_id, followers_count, following_count, posts_count, engagement_rate, avg_likes, avg_comments, synced_at)
  VALUES ('instagram-ricardo-leao', 916, 312, 245, 3.93, 33, 2, NOW())
  ON DUPLICATE KEY UPDATE
    followers_count = 916,
    following_count = 312,
    posts_count = 245,
    engagement_rate = 3.93,
    avg_likes = 33,
    avg_comments = 2,
    synced_at = NOW()
`);

console.log('✅ @ricardo_leao atualizado: 916 seguidores, 3.93% engajamento, 245 posts');

await conn.end();
