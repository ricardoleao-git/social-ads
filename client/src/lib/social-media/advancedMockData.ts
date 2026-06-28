export interface GrowthGoal {
  id: string;
  metric: string;
  name?: string;
  current: number;
  target: number;
  currentValue?: number | string;
  targetValue?: number | string;
  deadline: string;
  progress: number;
  status?: 'on_track' | 'at_risk' | 'completed';
}

export interface Hashtag {
  tag: string;
  posts: number;
  avgEngagement: number;
  reach: number;
  totalReach?: number;
  totalEngagement?: number;
  trendPercentage?: number;
  trend?: 'up' | 'down' | 'stable';
}

export const postsWithTypes = [
  {
    id: "post_1",
    type: "image" as const,
    imageUrl: "https://placehold.co/400x400/E040FB/FFFFFF?text=Post+1",
    likes: 142,
    comments: 23,
    shares: 8,
    engagement: 5.2,
    caption: "🚀 Novidades em tecnologia de acesso inteligente! #SmartBuilding",
    date: "2026-04-01",
  },
  {
    id: "post_2",
    type: "reel" as const,
    imageUrl: "https://placehold.co/400x400/7C4DFF/FFFFFF?text=Reel",
    likes: 234,
    comments: 45,
    shares: 22,
    engagement: 8.9,
    caption: "📱 Conheça o GuardIA! #GuardIA #ControleDeAcesso",
    date: "2026-03-28",
  },
  {
    id: "post_3",
    type: "carousel" as const,
    imageUrl: "https://placehold.co/400x400/00BCD4/FFFFFF?text=Carousel",
    likes: 98,
    comments: 15,
    shares: 5,
    engagement: 3.8,
    caption: "💡 5 dicas para otimizar seu Google Ads #MarketingDigital",
    date: "2026-03-25",
  },
];

export const postTypePerformance = [
  { type: "Imagem", avgEngagement: 4.2, avgLikes: 120, avgComments: 18, count: 24 },
  { type: "Reel", avgEngagement: 8.1, avgLikes: 210, avgComments: 38, count: 12 },
  { type: "Carrossel", avgEngagement: 5.6, avgLikes: 145, avgComments: 25, count: 18 },
  { type: "Story", avgEngagement: 3.2, avgLikes: 0, avgComments: 14, count: 45 },
];

export const topHashtags = [
  { tag: "#SmartBuilding", posts: 45, avgEngagement: 6.2, reach: 12500 },
  { tag: "#GoogleAds", posts: 38, avgEngagement: 5.8, reach: 9800 },
  { tag: "#MarketingDigital", posts: 52, avgEngagement: 4.9, reach: 15200 },
  { tag: "#IoT", posts: 29, avgEngagement: 7.1, reach: 8400 },
  { tag: "#GuardIA", posts: 21, avgEngagement: 8.3, reach: 6700 },
  { tag: "#ControleDeAcesso", posts: 33, avgEngagement: 6.8, reach: 11200 },
  { tag: "#TechBrasil", posts: 67, avgEngagement: 4.1, reach: 18900 },
];

export const growthGoals = [
  {
    id: "goal_1",
    metric: "Seguidores",
    current: 1250,
    target: 2000,
    deadline: "2026-06-30",
    progress: 62.5,
  },
  {
    id: "goal_2",
    metric: "Taxa de Engajamento",
    current: 5.8,
    target: 8.0,
    deadline: "2026-05-31",
    progress: 72.5,
  },
  {
    id: "goal_3",
    metric: "Alcance Mensal",
    current: 16800,
    target: 25000,
    deadline: "2026-07-31",
    progress: 67.2,
  },
];
