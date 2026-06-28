// Mock data for Instagram Dashboard
// This data represents real metrics from @ricardo_leao account

export interface InstagramAccount {
  id: string;
  username: string;
  name: string;
  bio: string;
  followers: number;
  following: number;
  posts: number;
  website?: string;
  profilePicture?: string;
}

export interface InstagramPost {
  id: string;
  caption: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
  mediaUrl: string;
  thumbnailUrl?: string;
  likes: number;
  comments: number;
  timestamp: string;
  permalink: string;
  engagement: number; // calculated as (likes + comments) / followers * 100
}

export interface MetricPoint {
  date: string;
  followers: number;
  reach: number;
  impressions: number;
  engagement: number;
}

// Account data
export const accounts: InstagramAccount[] = [
  {
    id: '26647496431547084',
    username: '@ricardo_leao',
    name: 'Ricardo Leão',
    bio: 'Casado, pai orgulhoso de 2, apaixonado por tecnologia. Fundador da @zenite.tech, com 34 anos de expertise em soluções inovadoras e IA.',
    followers: 910,
    following: 2402,
    posts: 185,
    website: 'https://www.zenite.tech',
    profilePicture: 'https://scontent-iad3-1.cdninstagram.com/v/t51.2885-19/27878672_148860709133110_5477918962832375808_n.jpg?stp=dst-jpg_s206x206_tt6&_nc_cat=101&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=kPCKZQGJRKYQ7kNvwGdxe_P&_nc_oc=AdrL4QiQDk4lH6oemJtepKO8-HThPdg6iOz69YvWk_Skp90JFmvZ7yP2WeX5EYVJTjY&_nc_zt=24&_nc_ht=scontent-iad3-1.cdninstagram.com&edm=AP4hL3IEAAAA&_nc_tpa=Q5bMBQFmgbX69JW1zZS3SIIqtcE3f0r3Z7T6v_WrOcjOsfYeRiu_pruQ_QU9RZccQ3eNtXq7nMTb1eREWQ&oh=00_Af3xFfQFYdpPFlhkNoWMxiAkjvhHARJm2WCIyMrROCe9Jg&oe=69D4E5EC',
  },
  {
    id: 'zenite_tech_id',
    username: '@zenite.tech',
    name: 'Zênite Tech',
    bio: 'Soluções em Tecnologia | Controle de Acesso | Reconhecimento Facial | Mobilidade Elétrica | Paraíba 🚀',
    followers: 1250,
    following: 450,
    posts: 156,
    website: 'https://www.zenite.tech',
    profilePicture: '',
  },
];

// Top performing posts from @ricardo_leao
export const topPosts: InstagramPost[] = [
  {
    id: '17859030705576610',
    caption: '🏫 Escola segura é escola inteligente! Implementamos reconhecimento facial em mais uma escola aqui na Paraíba',
    mediaType: 'IMAGE',
    mediaUrl: 'https://scontent-iad6-1.cdninstagram.com/v/t51.82787-15/657676936_18579019558022766_3348493801310848456_n.jpg',
    likes: 45,
    comments: 8,
    timestamp: '2026-04-03T01:11:55+0000',
    permalink: 'https://www.instagram.com/p/DWpo363kSE9/',
    engagement: 5.8,
  },
  {
    id: '17881641039516055',
    caption: 'Segurança e design caminhando juntos! Mais um projeto de controle de acesso entregue com excelência.',
    mediaType: 'VIDEO',
    mediaUrl: 'https://scontent-iad6-1.cdninstagram.com/o1/v/t2/f2/m86/AQMKpEy7EgyXVjsyXaKEY5mWTi0uquUTFvFfblvdaWzoEw9dTeZuj69ltbuPXwutD5B4jSAyIoR2SD09KHWF--r72ap2Bza_tdp-54o.mp4',
    thumbnailUrl: 'https://scontent-iad3-1.cdninstagram.com/v/t51.71878-15/659008509_783287127924858_5466323693412517539_n.jpg',
    likes: 2,
    comments: 0,
    timestamp: '2026-04-03T00:38:44+0000',
    permalink: 'https://www.instagram.com/reel/DWplF4Kjphj/',
    engagement: 0.22,
  },
  {
    id: '18096618950095987',
    caption: '⚡ Falei ao vivo no @bomdiapb sobre as novas regras para instalação de carregadores de veículos elétricos',
    mediaType: 'IMAGE',
    mediaUrl: 'https://scontent-iad3-1.cdninstagram.com/v/t51.82787-15/658249156_18579007795022766_8418271884400712470_n.jpg',
    likes: 20,
    comments: 3,
    timestamp: '2026-04-02T23:44:25+0000',
    permalink: 'https://www.instagram.com/p/DWpdb1MlPCf/',
    engagement: 2.53,
  },
  {
    id: '18078761174066681',
    caption: 'Um almoço especial promovido pela TLD, Fortinet e TD Synnex, reunindo grandes nomes do setor de tecnologia.',
    mediaType: 'VIDEO',
    mediaUrl: 'https://scontent-iad6-1.cdninstagram.com/o1/v/t2/f2/m86/AQMCISOlgBq217QtPZpJnmwPeJBo77R8ZTTee5f1RAak4F8m86lo00-zVlwLoFVxtPNW1PO-H0O2U9cWw6V5HNLl2soFFLqDwp94wm0.mp4',
    thumbnailUrl: 'https://scontent-iad6-1.cdninstagram.com/v/t51.71878-15/550538123_1099109815671740_1833973987396239477_n.jpg',
    likes: 35,
    comments: 3,
    timestamp: '2025-09-19T16:44:57+0000',
    permalink: 'https://www.instagram.com/reel/DOyl30Tkbyg/',
    engagement: 4.18,
  },
];

// Simulated metrics over time
export const metricsHistory: MetricPoint[] = [
  { date: '2026-03-01', followers: 850, reach: 2400, impressions: 3200, engagement: 2.8 },
  { date: '2026-03-08', followers: 870, reach: 2600, impressions: 3500, engagement: 3.1 },
  { date: '2026-03-15', followers: 885, reach: 2800, impressions: 3800, engagement: 3.4 },
  { date: '2026-03-22', followers: 895, reach: 3100, impressions: 4200, engagement: 3.7 },
  { date: '2026-03-29', followers: 905, reach: 3300, impressions: 4500, engagement: 3.9 },
  { date: '2026-04-03', followers: 910, reach: 3500, impressions: 4800, engagement: 4.2 },
];

// Content pillars and performance by category
export const contentCategories = [
  { name: 'Tecnologia/Inovação', posts: 65, avgEngagement: 3.8, color: '#2563eb' },
  { name: 'Empreendedorismo', posts: 45, avgEngagement: 3.2, color: '#7c3aed' },
  { name: 'Pessoal/Família', posts: 35, avgEngagement: 2.9, color: '#ec4899' },
  { name: 'Eventos', posts: 25, avgEngagement: 4.1, color: '#f59e0b' },
  { name: 'Educação', posts: 15, avgEngagement: 3.5, color: '#10b981' },
];

// Engagement metrics
export const engagementMetrics = {
  totalReach: 3500,
  totalImpressions: 4800,
  avgEngagementRate: 4.2,
  totalLikes: 1250,
  totalComments: 180,
  totalShares: 45,
  savesRate: 12,
};
