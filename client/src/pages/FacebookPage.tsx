import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Facebook,
  Users,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  Eye,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  FileText,
  BarChart2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

const PERIOD_OPTIONS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
];

export default function FacebookPage() {
  const [period, setPeriod] = useState(30);

  const { data: pageInfo, isLoading: loadingInfo, refetch } = trpc.facebookPage.getPageInfo.useQuery();
  const { data: postsData, isLoading: loadingPosts } = trpc.facebookPage.getPagePosts.useQuery({ limit: 10 });
  const { data: insightsData, isLoading: loadingInsights } = trpc.facebookPage.getInsightsTrend.useQuery({ days: period });
  const { data: summary } = trpc.facebookPage.getSummary.useQuery();

  const posts = postsData?.posts ?? [];
  const trend = insightsData?.trend ?? [];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Facebook className="w-4 h-4 text-blue-500" />
              </div>
              <h1 className="text-xl font-semibold">Página Facebook</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Métricas e publicações da página Zênite Tech no Facebook
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Atualizar
          </Button>
        </div>

        {/* Page Info Card */}
        {loadingInfo ? (
          <Card className="border-border">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
              Carregando informações da página...
            </CardContent>
          </Card>
        ) : pageInfo && (
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-4">
                {pageInfo.pictureUrl ? (
                  <img
                    src={pageInfo.pictureUrl}
                    alt={pageInfo.name}
                    className="w-14 h-14 rounded-full object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
                    <Facebook className="w-6 h-6 text-blue-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-base">{pageInfo.name}</h2>
                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                      Verificada
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{pageInfo.category}</p>
                  {pageInfo.about && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{pageInfo.about}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {pageInfo.website && (
                      <a
                        href={pageInfo.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {pageInfo.website.replace("https://", "")}
                      </a>
                    )}
                    {pageInfo.phone && (
                      <span className="text-xs text-muted-foreground">{pageInfo.phone}</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Seguidores</span>
              </div>
              <p className="text-2xl font-bold">{pageInfo?.followersCount?.toLocaleString("pt-BR") ?? "—"}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-pink-400" />
                <span className="text-xs text-muted-foreground">Curtidas</span>
              </div>
              <p className="text-2xl font-bold">{pageInfo?.fanCount?.toLocaleString("pt-BR") ?? "—"}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-muted-foreground">Formulários Lead</span>
              </div>
              <p className="text-2xl font-bold">{summary?.totalLeadForms ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{summary?.activeLeadForms ?? 0} ativos</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="w-4 h-4 text-green-400" />
                <span className="text-xs text-muted-foreground">Total Leads</span>
              </div>
              <p className="text-2xl font-bold">{summary?.totalLeads ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Insights Trend Chart */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Tendência de Alcance e Impressões
              </CardTitle>
              <div className="flex items-center gap-1">
                {PERIOD_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={period === opt.value ? "default" : "ghost"}
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setPeriod(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            {insightsData?.isSimulated && (
              <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400 text-xs mt-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Dados estimados — permissão <code className="font-mono">pages_read_engagement</code> necessária para dados reais
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loadingInsights ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Carregando...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradImpressions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    interval={Math.floor(trend.length / 6)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                  <Tooltip
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(v: any, name: string) => [v.toLocaleString("pt-BR"), name === "impressions" ? "Impressões" : "Alcance"]}
                    labelFormatter={(l) => formatShortDate(l)}
                  />
                  <Area type="monotone" dataKey="impressions" stroke="#3b82f6" fill="url(#gradImpressions)" strokeWidth={2} name="impressions" />
                  <Area type="monotone" dataKey="reach" stroke="#8b5cf6" fill="url(#gradReach)" strokeWidth={2} name="reach" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Posts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Publicações Recentes
            </h2>
            {postsData?.isSimulated && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
                <AlertCircle className="w-3 h-3 mr-1" />
                Simulado
              </Badge>
            )}
          </div>

          {loadingPosts ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
              Carregando publicações...
            </div>
          ) : (
            <div className="grid gap-3">
              {posts.map((post: any) => (
                <Card key={post.id} className="border-border hover:border-blue-500/30 transition-colors">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Facebook className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs text-muted-foreground">{formatDate(post.created_time)}</span>
                          {post.permalink_url && (
                            <a
                              href={post.permalink_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:underline flex items-center gap-1 shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Ver post
                            </a>
                          )}
                        </div>
                        <p className="text-sm text-foreground line-clamp-3 mb-3">{post.message || "(sem texto)"}</p>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Heart className="w-3.5 h-3.5 text-pink-400" />
                            {post.likes}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                            {post.comments}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Share2 className="w-3.5 h-3.5 text-green-400" />
                            {post.shares}
                          </span>
                          {post.reach > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Eye className="w-3.5 h-3.5 text-purple-400" />
                              {post.reach.toLocaleString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
