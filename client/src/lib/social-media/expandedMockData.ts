export interface InstagramStory {
  id: string;
  imageUrl: string;
  mediaUrl?: string;
  views: number;
  replies: number;
  shares: number;
  stickers: number;
  impressions: number;
  engagement?: number;
  date: string;
  timestamp?: string;
}

export const storiesData: InstagramStory[] = [
  {
    id: "story_1",
    imageUrl: "https://placehold.co/400x700/E040FB/FFFFFF?text=Story+1",
    views: 320,
    replies: 18,
    shares: 7,
    stickers: 2,
    impressions: 380,
    date: "2026-04-02",
  },
  {
    id: "story_2",
    imageUrl: "https://placehold.co/400x700/7C4DFF/FFFFFF?text=Story+2",
    views: 289,
    replies: 12,
    shares: 5,
    stickers: 3,
    impressions: 340,
    date: "2026-04-01",
  },
  {
    id: "story_3",
    imageUrl: "https://placehold.co/400x700/00BCD4/FFFFFF?text=Story+3",
    views: 412,
    replies: 24,
    shares: 11,
    stickers: 1,
    impressions: 490,
    date: "2026-03-31",
  },
];

export const metricsByWeek = {
  followers: 1250,
  reach: 4200,
  likes: 380,
  engagement: 5.8,
  impressions: 6100,
  saves: 142,
  comments: 67,
  shares: 28,
  growth: 4.1,
};

export const metricsByMonth = {
  followers: 1250,
  reach: 16800,
  likes: 1520,
  engagement: 5.2,
  impressions: 24400,
  saves: 568,
  comments: 268,
  shares: 112,
  growth: 12.4,
};

export const metricsByQuarter = {
  followers: 1250,
  reach: 50400,
  likes: 4560,
  engagement: 4.9,
  impressions: 73200,
  saves: 1704,
  comments: 804,
  shares: 336,
  growth: 28.7,
};
