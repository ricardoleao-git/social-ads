export interface AccountProfile {
  id: string;
  username: string;
  displayName: string;
  followers: number;
  engagement: number;
  reach: number;
  impressions: number;
  bio: string;
  avatar?: string;
  category: string;
  verified: boolean;
}

export interface AccountMetrics {
  followers: number;
  reach: number;
  likes: number;
  engagement: number;
  impressions: number;
  saves: number;
  comments: number;
  shares: number;
  growth: number;
}

export const accountProfiles: AccountProfile[] = [
  {
    id: "ricardo_leao",
    username: "@ricardo_leao",
    displayName: "Ricardo Leão",
    followers: 910,
    engagement: 4.2,
    reach: 3500,
    impressions: 4800,
    bio: "Empresário | Estratégia Digital | Inovação",
    category: "Negócios",
    verified: false,
  },
  {
    id: "zenite_tech",
    username: "@zenite.tech",
    displayName: "Zênite Tech",
    followers: 1250,
    engagement: 5.8,
    reach: 4200,
    impressions: 6100,
    bio: "Soluções em Tráfego Pago | Google Ads | Performance Marketing",
    category: "Tecnologia",
    verified: false,
  },
];

export const getAccountMetrics = (accountId: string): AccountMetrics => {
  const metricsMap: Record<string, AccountMetrics> = {
    ricardo_leao: {
      followers: 910,
      reach: 3500,
      likes: 245,
      engagement: 4.2,
      impressions: 4800,
      saves: 89,
      comments: 34,
      shares: 12,
      growth: 2.8,
    },
    zenite_tech: {
      followers: 1250,
      reach: 4200,
      likes: 380,
      engagement: 5.8,
      impressions: 6100,
      saves: 142,
      comments: 67,
      shares: 28,
      growth: 4.1,
    },
  };
  return metricsMap[accountId] ?? metricsMap["zenite_tech"];
};

export const getAccountPosts = (accountId: string) => {
  return [
    {
      id: `${accountId}_post_1`,
      imageUrl: "https://placehold.co/400x400/E040FB/FFFFFF?text=Post+1",
      likes: 142,
      comments: 23,
      shares: 8,
      engagement: 5.2,
      caption: "🚀 Novidades em tecnologia de acesso inteligente! #SmartBuilding #IoT",
      date: "2026-04-01",
      type: "image" as const,
    },
    {
      id: `${accountId}_post_2`,
      imageUrl: "https://placehold.co/400x400/7C4DFF/FFFFFF?text=Post+2",
      likes: 98,
      comments: 15,
      shares: 5,
      engagement: 3.8,
      caption: "💡 Dica do dia: Como otimizar seu Google Ads #MarketingDigital",
      date: "2026-03-30",
      type: "image" as const,
    },
    {
      id: `${accountId}_post_3`,
      imageUrl: "https://placehold.co/400x400/00BCD4/FFFFFF?text=Reel",
      likes: 234,
      comments: 45,
      shares: 22,
      engagement: 8.9,
      caption: "📱 Conheça nossa solução de controle de acesso facial! #GuardIA",
      date: "2026-03-28",
      type: "reel" as const,
    },
  ];
};

export const getAccountHashtags = (_accountId: string) => {
  return [
    { tag: "#SmartBuilding", posts: 45, avgEngagement: 6.2, reach: 12500 },
    { tag: "#GoogleAds", posts: 38, avgEngagement: 5.8, reach: 9800 },
    { tag: "#MarketingDigital", posts: 52, avgEngagement: 4.9, reach: 15200 },
    { tag: "#IoT", posts: 29, avgEngagement: 7.1, reach: 8400 },
    { tag: "#GuardIA", posts: 21, avgEngagement: 8.3, reach: 6700 },
  ];
};

export const getAccountStories = (_accountId: string) => {
  return [
    {
      id: "story_1",
      imageUrl: "https://placehold.co/400x700/E040FB/FFFFFF?text=Story+1",
      views: 320,
      replies: 18,
      shares: 7,
      date: "2026-04-02",
    },
    {
      id: "story_2",
      imageUrl: "https://placehold.co/400x700/7C4DFF/FFFFFF?text=Story+2",
      views: 289,
      replies: 12,
      shares: 5,
      date: "2026-04-01",
    },
  ];
};
