import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Calendar, TrendingUp, TrendingDown, Users, Heart, Eye, MessageCircle, Bookmark, Share2 } from "lucide-react";
import { useLocation } from "wouter";
import InsightsPanel from "@/components/social-media/InsightsPanel";
import AdvancedFilters from "@/components/AdvancedFilters";
import InsightsSuggestions from "@/components/InsightsSuggestions";
import { AIInsightsService } from "@/lib/aiInsights";
import { exportMetricsToXLSX as exportMetricsToCSV, exportMetricsToPDF } from "@/lib/social-media/dataExporter";
import { trpc } from "@/lib/trpc";
import { useSocialMedia } from "@/components/social-media/SocialMediaWrapper";
import { InstagramPostsLineChart } from "@/components/social-media/InstagramPostsLineChart";
import { InstagramContentTypeComparison } from "@/components/social-media/InstagramContentTypeComparison";
import AdvancedDateFilter from "@/components/social-media/AdvancedDateFilter";
import { InstagramTopReachPosts } from "@/components/social-media/InstagramTopReachPosts";
import { InstagramEngagementAlertConfig } from "@/components/social-media/InstagramEngagementAlertConfig";

type Period = "day" | "week" | "month";

interface PeriodMetrics {
  followers: number;
  reach: number;
  likes: number;
  engagement: number;
  impressions: number;
  saves: number;
  comments: number;
  shares: number;
  followerGrowth: number;
  reachGrowth: number;
  engagementGrowth: number;
}

const metricsData: Record<Period, PeriodMetrics> = {
  day: {
    followers: 12480,
    reach: 520,
    likes: 48,
    engagement: 3.8,
    impressions: 710,
    saves: 9,
    comments: 4,
    shares: 2,
    followerGrowth: 0.2,
    reachGrowth: 5.1,
    engagementGrowth: -1.2,
  },
  week: {
    followers: 12480,
    reach: 3500,
    likes: 310,
    engagement: 4.2,
    impressions: 4800,
    saves: 58,
    comments: 28,
    shares: 12,
    followerGrowth: 1.4,
    reachGrowth: 12.3,
    engagementGrowth: 10.5,
  },
  month: {
    followers: 12480,
    reach: 14200,
    likes: 1240,
    engagement: 4.5,
    impressions: 19500,
    saves: 230,
    comments: 112,
    shares: 48,
    followerGrowth: 5.8,
    reachGrowth: 28.7,
    engagementGrowth: 18.2,
  },
};

const hashtagsByPeriod: Record<Period, { name: string; reach: number; trend: number }[]> = {
  day: [
    { name: "#instagram", reach: 820, trend: 12 },
    { name: "#socialmedia", reach: 740, trend: 8 },
    { name: "#marketing", reach: 510, trend: 5 },
    { name: "#digital", reach: 390, trend: 3 },
  ],
  week: [
    { name: "#instagram", reach: 5200, trend: 45 },
    { name: "#socialmedia", reach: 4800, trend: 38 },
    { name: "#marketing", reach: 3500, trend: 25 },
    { name: "#digital", reach: 2900, trend: 18 },
    { name: "#conteudo", reach: 2100, trend: 12 },
    { name: "#engagement", reach: 1800, trend: 8 },
    { name: "#crescimento", reach: 1200, trend: 5 },
    { name: "#estrategia", reach: 900, trend: 2 },
  ],
  month: [
    { name: "#instagram", reach: 21000, trend: 62 },
    { name: "#socialmedia", reach: 19500, trend: 54 },
    { name: "#marketing", reach: 14200, trend: 41 },
    { name: "#digital", reach: 11800, trend: 32 },
    { name: "#conteudo", reach: 8500, trend: 24 },
    { name: "#engagement", reach: 7200, trend: 18 },
    { name: "#crescimento", reach: 4800, trend: 11 },
    { name: "#estrategia", reach: 3600, trend: 7 },
  ],
};

const periodLabels: Record<Period, string> = {
  day: "Hoje",
  week: "Últimos 7 dias",
  month: "Últimos 30 dias",
};

function GrowthBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${positive ? "text-green-600" : "text-red-500"}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  growth?: number;
  color?: string;
}

function MetricCard({ icon, label, value, growth, color = "blue" }: MetricCardProps) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    pink: "bg-pink-50 text-pink-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    teal: "bg-teal-50 text-teal-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-2 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color] ?? colorMap.blue}`}>
        {icon}
      </div>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
      {growth !== undefined && <GrowthBadge value={growth} />}
    </div>
  );
}

export default function DetailedAnalysis() {
  const [, setLocation] = useLocation();
  const { selectedAccount: ctxAccount } = useSocialMedia();
  const [filters, setFilters] = useState({});
  const [period, setPeriod] = useState<Period>("week");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });

  const { data: liveData } = trpc.instagram.getLiveData.useQuery(
    { accountId: ctxAccount.id },
    { staleTime: 120_000, enabled: !!ctxAccount.id }
  );
  const { data: dbPosts } = trpc.instagram.getPosts.useQuery(
    {
      accountId: ctxAccount.id,
      limit: 100,
      ...(dateRange.start ? { startDate: dateRange.start } : {}),
      ...(dateRange.end ? { endDate: dateRange.end } : {}),
    },
    { staleTime: 60_000, enabled: !!ctxAccount.id }
  );

  // Build metrics from real data
  const followers = (liveData as any)?.followers ?? (liveData as any)?.accountInfo?.followers ?? 0;
  const totalLikes = (dbPosts ?? []).reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalComments = (dbPosts ?? []).reduce((s, p) => s + (p.comments ?? 0), 0);
  const totalShares = (dbPosts ?? []).reduce((s, p) => s + (p.shares ?? 0), 0);
  const avgEng = dbPosts && dbPosts.length > 0
    ? ((totalLikes + totalComments + totalShares) / dbPosts.length / Math.max(followers, 1) * 100)
    : 0;

  // Comparativo com período anterior: divide os posts em duas metades (mais recentes vs. mais antigos)
  const prevComparison = useMemo(() => {
    const posts = dbPosts ?? [];
    if (posts.length < 2) return { likes: 0, comments: 0, shares: 0, engagement: 0 };
    const half = Math.floor(posts.length / 2);
    // Ordenar por data (mais recente primeiro)
    const sorted = [...posts].sort((a, b) => {
      const da = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      const db2 = b.postedAt ? new Date(b.postedAt).getTime() : 0;
      return db2 - da;
    });
    const recent = sorted.slice(0, half);
    const older = sorted.slice(half);
    const calcEng = (arr: typeof posts) => {
      const l = arr.reduce((s, p) => s + (p.likes ?? 0), 0);
      const c = arr.reduce((s, p) => s + (p.comments ?? 0), 0);
      const sh = arr.reduce((s, p) => s + (p.shares ?? 0), 0);
      return arr.length > 0 ? ((l + c + sh) / arr.length / Math.max(followers, 1) * 100) : 0;
    };
    const pct = (curr: number, prev: number) => prev === 0 ? 0 : parseFloat(((curr - prev) / prev * 100).toFixed(1));
    const rLikes = recent.reduce((s, p) => s + (p.likes ?? 0), 0);
    const oLikes = older.reduce((s, p) => s + (p.likes ?? 0), 0);
    const rComments = recent.reduce((s, p) => s + (p.comments ?? 0), 0);
    const oComments = older.reduce((s, p) => s + (p.comments ?? 0), 0);
    const rShares = recent.reduce((s, p) => s + (p.shares ?? 0), 0);
    const oShares = older.reduce((s, p) => s + (p.shares ?? 0), 0);
    const rEng = calcEng(recent);
    const oEng = calcEng(older);
    return {
      likes: pct(rLikes, oLikes),
      comments: pct(rComments, oComments),
      shares: pct(rShares, oShares),
      engagement: pct(rEng, oEng),
    };
  }, [dbPosts, followers]);

  const metrics = {
    followers,
    reach: (liveData as any)?.reach ?? 0,
    likes: totalLikes,
    engagement: parseFloat(avgEng.toFixed(2)),
    impressions: (liveData as any)?.impressions ?? 0,
    saves: 0,
    comments: totalComments,
    shares: totalShares,
    followerGrowth: 0,
    reachGrowth: 0,
    engagementGrowth: prevComparison.engagement,
  };

  // Hashtags from live data
  const hashtags: { name: string; reach: number; trend: number }[] = ((liveData as any)?.topHashtags ?? []).map((h: string, i: number) => ({
    name: h,
    reach: Math.max(100, followers - i * 200),
    trend: Math.max(1, 20 - i * 3),
  }));

  const selectedAccount = {
    username: ctxAccount.username,
    followers,
  };

  const insights = useMemo(() => AIInsightsService.generateAccountInsights({
    username: ctxAccount.username,
    posts: (dbPosts ?? []).map((p) => ({
      id: p.id,
      type: (p.postType ?? "image") as any,
      likes: p.likes ?? 0,
      comments: p.comments ?? 0,
      shares: p.shares ?? 0,
      engagement: parseFloat(p.engagement ?? "0"),
      caption: p.caption ?? "",
      postedAt: p.postedAt?.toISOString() ?? "",
      hashtags: [],
    })),
    hashtags,
    engagement: metrics.engagement,
    previousEngagement: metrics.engagement * 0.9,
    followers,
    reach: metrics.reach,
  }), [dbPosts, liveData, ctxAccount]);

  const handleExportCSV = () => {
    // Calcular top 5 posts por alcance para incluir no CSV
    const posts = dbPosts ?? [];
    const sorted = [...posts].sort((a, b) => {
      const scoreA = ((a.likes ?? 0) * 2) + (a.comments ?? 0) * 2 + (a.shares ?? 0);
      const scoreB = ((b.likes ?? 0) * 2) + (b.comments ?? 0) * 2 + (b.shares ?? 0);
      return scoreB - scoreA;
    });
    const top5 = sorted.slice(0, 5).map((p) => ({
      tipo: p.postType ?? 'image',
      data: p.postedAt ? new Date(p.postedAt).toLocaleDateString('pt-BR') : '',
      curtidas: p.likes ?? 0,
      comentarios: p.comments ?? 0,
      compartilhamentos: p.shares ?? 0,
      alcance: 0, // DB não armazena reach por post ainda
      legenda: (p.caption ?? '').substring(0, 80),
    }));
    exportMetricsToCSV(
      {
        followers: metrics.followers,
        reach: metrics.reach,
        likes: metrics.likes,
        engagement: metrics.engagement,
        impressions: metrics.impressions,
        saves: metrics.saves,
        comments: metrics.comments,
        shares: metrics.shares,
        periodo: periodLabels[period],
        var_curtidas_pct: prevComparison.likes,
        var_comentarios_pct: prevComparison.comments,
        var_engajamento_pct: prevComparison.engagement,
      },
      selectedAccount.username,
      periodLabels[period],
      top5.length > 0 ? top5 : undefined
    );
  };

  const handleExportPDF = () => {
    exportMetricsToPDF(
      {
        followers: metrics.followers,
        reach: metrics.reach,
        likes: metrics.likes,
        engagement: metrics.engagement,
        impressions: metrics.impressions,
        saves: metrics.saves,
        comments: metrics.comments,
        shares: metrics.shares,
        periodo: periodLabels[period],
      },
      selectedAccount.username,
      periodLabels[period]
    );
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setLocation("/redes-sociais")}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Análise Detalhada</h1>
              <p className="text-gray-600">{selectedAccount.username}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowDateFilter(!showDateFilter)}
              variant={dateRange.start ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              {dateRange.start
                ? `${dateRange.start.toLocaleDateString("pt-BR")} – ${dateRange.end?.toLocaleDateString("pt-BR") ?? "hoje"}`
                : "Filtrar Período"}
            </Button>
            {dateRange.start && (
              <Button
                onClick={() => { setDateRange({ start: null, end: null }); setShowDateFilter(false); }}
                variant="outline"
                size="sm"
                className="gap-1 text-red-500 border-red-200 hover:bg-red-50"
              >
                ✕ Limpar
              </Button>
            )}
            <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>

        {/* Date Filter Panel */}
        {showDateFilter && (
          <AdvancedDateFilter
            onDateRangeChange={(start, end) => {
              setDateRange({ start, end });
              setShowDateFilter(false);
            }}
            onClose={() => setShowDateFilter(false)}
          />
        )}

        {/* Period Selector */}
        <Card className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Período de análise:</span>
            </div>
            <div className="flex gap-2">
              {(["day", "week", "month"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    period === p
                      ? "bg-blue-600 text-foreground border-blue-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
            <Badge variant="outline" className="ml-auto text-xs text-muted-foreground">
              Dados de {periodLabels[period].toLowerCase()}
            </Badge>
          </div>
        </Card>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            icon={<Users className="w-5 h-5" />}
            label="Seguidores"
            value={metrics.followers}
            growth={metrics.followerGrowth}
            color="blue"
          />
          <MetricCard
            icon={<Eye className="w-5 h-5" />}
            label="Alcance"
            value={metrics.reach}
            growth={metrics.reachGrowth}
            color="purple"
          />
          <MetricCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Engajamento"
            value={`${metrics.engagement}%`}
            growth={metrics.engagementGrowth}
            color="green"
          />
          <MetricCard
            icon={<Eye className="w-5 h-5" />}
            label="Impressões"
            value={metrics.impressions}
            color="teal"
          />
          <MetricCard
            icon={<Heart className="w-5 h-5" />}
            label="Curtidas"
            value={metrics.likes}
            growth={prevComparison.likes}
            color="pink"
          />
          <MetricCard
            icon={<MessageCircle className="w-5 h-5" />}
            label="Comentários"
            value={metrics.comments}
            growth={prevComparison.comments}
            color="orange"
          />
          <MetricCard
            icon={<Bookmark className="w-5 h-5" />}
            label="Salvamentos"
            value={metrics.saves}
            color="blue"
          />
          <MetricCard
            icon={<Share2 className="w-5 h-5" />}
            label="Compartilhamentos"
            value={metrics.shares}
            growth={prevComparison.shares}
            color="purple"
          />
        </div>

        {/* Filters */}
        <AdvancedFilters
          onFilterChange={setFilters}
          onReset={() => setFilters({})}
        />

        <InsightsSuggestions />

        {/* Hashtags Analysis */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Análise de Hashtags</h2>
            <span className="text-sm text-muted-foreground">{periodLabels[period]}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hashtags.map((tag) => (
              <div
                key={tag.name}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">{tag.name}</span>
                  <span className="text-sm text-green-600 font-medium">
                    +{tag.trend}% trend
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Alcance: {tag.reach.toLocaleString("pt-BR")}
                  </p>
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(100, (tag.reach / hashtags[0].reach) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Posts Line Chart + Content Type Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InstagramPostsLineChart />
          <InstagramContentTypeComparison />
        </div>

        {/* Top 5 Posts + Engagement Alert Config */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InstagramTopReachPosts posts={dbPosts ?? []} dateRange={dateRange} />
          <InstagramEngagementAlertConfig currentEngagement={metrics.engagement} />
        </div>

        {/* AI Insights */}
        {insights && (
          <InsightsPanel
            recommendations={insights.map((i) => ({
              id: i.id,
              type: i.type === "warning" ? "engagement" : i.type === "opportunity" ? "growth" : "content",
              title: i.title,
              description: i.description,
              priority: i.impact as "low" | "medium" | "high",
              impact: i.impact,
              actionItems: [],
            }))}
            strengths={[]}
            opportunities={insights.filter((i) => i.type === "opportunity").map((i) => i.title)}
            trends={[]}
          />
        )}
      </div>
    </div>
  );
}
