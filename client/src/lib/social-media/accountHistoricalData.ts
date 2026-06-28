// Historical metrics data by period for each account
export interface HistoricalMetrics {
  date: string;
  followers: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  impressions: number;
}

export interface AccountHistoricalData {
  week: HistoricalMetrics[];
  month: HistoricalMetrics[];
  quarter: HistoricalMetrics[];
}

// Ricardo Leão historical data
export const ricardoLeaoHistory: AccountHistoricalData = {
  week: [
    { date: "2026-03-28", followers: 890, reach: 3200, likes: 285, comments: 22, shares: 8, engagement: 4.0, impressions: 4500 },
    { date: "2026-03-29", followers: 895, reach: 3300, likes: 295, comments: 24, shares: 9, engagement: 4.1, impressions: 4600 },
    { date: "2026-03-30", followers: 900, reach: 3400, likes: 305, comments: 26, shares: 10, engagement: 4.15, impressions: 4700 },
    { date: "2026-03-31", followers: 905, reach: 3450, likes: 308, comments: 27, shares: 11, engagement: 4.18, impressions: 4750 },
    { date: "2026-04-01", followers: 908, reach: 3480, likes: 309, comments: 28, shares: 11, engagement: 4.2, impressions: 4780 },
    { date: "2026-04-02", followers: 909, reach: 3490, likes: 310, comments: 28, shares: 12, engagement: 4.21, impressions: 4790 },
    { date: "2026-04-03", followers: 910, reach: 3500, likes: 310, comments: 28, shares: 12, engagement: 4.2, impressions: 4800 },
  ],
  month: [
    { date: "2026-03-01", followers: 820, reach: 2800, likes: 240, comments: 18, shares: 6, engagement: 3.8, impressions: 4000 },
    { date: "2026-03-08", followers: 845, reach: 3000, likes: 260, comments: 20, shares: 7, engagement: 3.9, impressions: 4200 },
    { date: "2026-03-15", followers: 870, reach: 3150, likes: 275, comments: 21, shares: 8, engagement: 4.0, impressions: 4400 },
    { date: "2026-03-22", followers: 890, reach: 3300, likes: 295, comments: 24, shares: 9, engagement: 4.1, impressions: 4600 },
    { date: "2026-03-29", followers: 905, reach: 3450, likes: 308, comments: 27, shares: 11, engagement: 4.18, impressions: 4750 },
    { date: "2026-04-03", followers: 910, reach: 3500, likes: 310, comments: 28, shares: 12, engagement: 4.2, impressions: 4800 },
  ],
  quarter: [
    { date: "2026-01-01", followers: 650, reach: 2200, likes: 180, comments: 14, shares: 4, engagement: 3.5, impressions: 3200 },
    { date: "2026-02-01", followers: 750, reach: 2600, likes: 215, comments: 16, shares: 5, engagement: 3.7, impressions: 3800 },
    { date: "2026-03-01", followers: 820, reach: 2800, likes: 240, comments: 18, shares: 6, engagement: 3.8, impressions: 4000 },
    { date: "2026-04-03", followers: 910, reach: 3500, likes: 310, comments: 28, shares: 12, engagement: 4.2, impressions: 4800 },
  ],
};

// Zenite Tech historical data
export const zeniteHistory: AccountHistoricalData = {
  week: [
    { date: "2026-03-28", followers: 1180, reach: 3900, likes: 445, comments: 38, shares: 22, engagement: 5.4, impressions: 5700 },
    { date: "2026-03-29", followers: 1200, reach: 4000, likes: 460, comments: 40, shares: 24, engagement: 5.5, impressions: 5850 },
    { date: "2026-03-30", followers: 1215, reach: 4100, likes: 475, comments: 42, shares: 25, engagement: 5.6, impressions: 5950 },
    { date: "2026-03-31", followers: 1230, reach: 4150, likes: 480, comments: 44, shares: 27, engagement: 5.7, impressions: 6020 },
    { date: "2026-04-01", followers: 1240, reach: 4180, likes: 483, comments: 45, shares: 28, engagement: 5.75, impressions: 6080 },
    { date: "2026-04-02", followers: 1245, reach: 4190, likes: 484, comments: 45, shares: 28, engagement: 5.78, impressions: 6090 },
    { date: "2026-04-03", followers: 1250, reach: 4200, likes: 485, comments: 45, shares: 28, engagement: 5.8, impressions: 6100 },
  ],
  month: [
    { date: "2026-03-01", followers: 1050, reach: 3600, likes: 380, comments: 30, shares: 16, engagement: 5.1, impressions: 5200 },
    { date: "2026-03-08", followers: 1100, reach: 3800, likes: 410, comments: 33, shares: 19, engagement: 5.3, impressions: 5450 },
    { date: "2026-03-15", followers: 1150, reach: 3950, likes: 440, comments: 36, shares: 21, engagement: 5.4, impressions: 5650 },
    { date: "2026-03-22", followers: 1200, reach: 4050, likes: 465, comments: 40, shares: 24, engagement: 5.6, impressions: 5900 },
    { date: "2026-03-29", followers: 1230, reach: 4150, likes: 480, comments: 44, shares: 27, engagement: 5.7, impressions: 6020 },
    { date: "2026-04-03", followers: 1250, reach: 4200, likes: 485, comments: 45, shares: 28, engagement: 5.8, impressions: 6100 },
  ],
  quarter: [
    { date: "2026-01-01", followers: 850, reach: 2900, likes: 290, comments: 22, shares: 10, engagement: 4.8, impressions: 4200 },
    { date: "2026-02-01", followers: 950, reach: 3400, likes: 340, comments: 26, shares: 13, engagement: 5.0, impressions: 4900 },
    { date: "2026-03-01", followers: 1050, reach: 3600, likes: 380, comments: 30, shares: 16, engagement: 5.1, impressions: 5200 },
    { date: "2026-04-03", followers: 1250, reach: 4200, likes: 485, comments: 45, shares: 28, engagement: 5.8, impressions: 6100 },
  ],
};

// Agência Digital historical data
export const agenciaHistory: AccountHistoricalData = {
  week: [
    { date: "2026-03-28", followers: 2250, reach: 5400, likes: 680, comments: 65, shares: 35, engagement: 6.2, impressions: 7800 },
    { date: "2026-03-29", followers: 2280, reach: 5550, likes: 700, comments: 68, shares: 37, engagement: 6.3, impressions: 7950 },
    { date: "2026-03-30", followers: 2300, reach: 5650, likes: 715, comments: 72, shares: 40, engagement: 6.4, impressions: 8050 },
    { date: "2026-03-31", followers: 2320, reach: 5750, likes: 720, comments: 75, shares: 41, engagement: 6.45, impressions: 8150 },
    { date: "2026-04-01", followers: 2330, reach: 5780, likes: 723, comments: 76, shares: 42, engagement: 6.48, impressions: 8180 },
    { date: "2026-04-02", followers: 2335, reach: 5790, likes: 724, comments: 77, shares: 42, engagement: 6.49, impressions: 8190 },
    { date: "2026-04-03", followers: 2340, reach: 5800, likes: 725, comments: 78, shares: 42, engagement: 6.5, impressions: 8200 },
  ],
  month: [
    { date: "2026-03-01", followers: 2100, reach: 5200, likes: 640, comments: 58, shares: 30, engagement: 6.0, impressions: 7500 },
    { date: "2026-03-08", followers: 2150, reach: 5400, likes: 670, comments: 62, shares: 33, engagement: 6.2, impressions: 7700 },
    { date: "2026-03-15", followers: 2200, reach: 5550, likes: 700, comments: 66, shares: 36, engagement: 6.3, impressions: 7900 },
    { date: "2026-03-22", followers: 2270, reach: 5700, likes: 715, comments: 72, shares: 39, engagement: 6.4, impressions: 8050 },
    { date: "2026-03-29", followers: 2310, reach: 5780, likes: 723, comments: 76, shares: 41, engagement: 6.48, impressions: 8180 },
    { date: "2026-04-03", followers: 2340, reach: 5800, likes: 725, comments: 78, shares: 42, engagement: 6.5, impressions: 8200 },
  ],
  quarter: [
    { date: "2026-01-01", followers: 1800, reach: 4500, likes: 540, comments: 45, shares: 22, engagement: 5.8, impressions: 6800 },
    { date: "2026-02-01", followers: 1950, reach: 5000, likes: 600, comments: 50, shares: 26, engagement: 5.9, impressions: 7200 },
    { date: "2026-03-01", followers: 2100, reach: 5200, likes: 640, comments: 58, shares: 30, engagement: 6.0, impressions: 7500 },
    { date: "2026-04-03", followers: 2340, reach: 5800, likes: 725, comments: 78, shares: 42, engagement: 6.5, impressions: 8200 },
  ],
};

// Get historical data for an account
export const getAccountHistory = (accountId: string): AccountHistoricalData => {
  const historyMap: Record<string, AccountHistoricalData> = {
    ricardo_leao: ricardoLeaoHistory,
    zenite_tech: zeniteHistory,
    agencia_digital: agenciaHistory,
  };
  return historyMap[accountId] || ricardoLeaoHistory;
};
