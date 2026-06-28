import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Users, Heart, Eye, MessageCircle, Share2,
  RefreshCw, ExternalLink, BarChart3, MousePointerClick, Globe,
  Instagram, Film, Image, Grid3X3
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = ["#2D7DD2", "#4A9EDB", "#1A3A6B", "#6BB8F5", "#0A5FAD"];

function KpiCard({
  title, value, subtitle, icon: Icon, accent = false
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card className={`border ${accent ? "bg-blue-900/30 border-blue-600/50" : "bg-[#0F1E35] border-[#1A3A6B]"}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{title}</p>
            <p className={`text-2xl font-bold ${accent ? "text-blue-300" : "text-white"} truncate`}>{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-lg bg-blue-900/40 ml-3 shrink-0">
            <Icon className="w-5 h-5 text-blue-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PostCard({ post, rank }: {
  post: {
    id: string; type: string; caption: string; link: string;
    likes: number; comments: number; posted: string; mediaUrl: string;
  };
  rank: number;
}) {
  const engagement = post.likes + post.comments;
  const date = new Date(post.posted).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const TypeIcon = post.type === "VIDEO" ? Film : post.type === "CAROUSEL_ALBUM" ? Grid3X3 : Image;
  const typeLabel = post.type === "VIDEO" ? "Vídeo" : post.type === "CAROUSEL_ALBUM" ? "Carrossel" : "Imagem";

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-[#0A1628] border border-[#1A3A6B]/50 hover:border-blue-500/40 transition-colors group">
      <div className="w-12 h-12 rounded-lg bg-[#1A3A6B] shrink-0 overflow-hidden relative">
        {post.mediaUrl ? (
          <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TypeIcon className="w-4 h-4 text-blue-400" />
          </div>
        )}
        <div className="absolute top-0 left-0 bg-blue-600/80 text-white text-[9px] font-bold px-1 rounded-br">
          #{rank}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 line-clamp-2 mb-1.5 leading-relaxed">
          {post.caption?.slice(0, 90) || "(sem legenda)"}
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-red-400" />
            <span className="text-slate-300">{post.likes}</span>
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-blue-400" />
            <span className="text-slate-300">{post.comments}</span>
          </span>
          <span className="text-slate-600">{date}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-800/60 text-blue-400 flex items-center gap-0.5">
            <TypeIcon className="w-2.5 h-2.5" />
            {typeLabel}
          </Badge>
        </div>
      </div>
      <a href={post.link} target="_blank" rel="noopener noreferrer" className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
        <ExternalLink className="w-4 h-4 text-slate-400 hover:text-blue-400 transition-colors" />
      </a>
    </div>
  );
}

export default function InstagramDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, refetch } = trpc.instagram.getGraphAPIData.useQuery(
    { igId: "17841406636761935" },
    { staleTime: 5 * 60 * 1000 }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const account = data?.account;
  const posts = data?.posts ?? [];
  const insights = data?.insights ?? {};
  const metrics = (data?.metrics ?? {}) as { avgEngagement?: number; avgLikes?: number; totalLikes?: number; totalComments?: number; avgComments?: number; recentPostsAnalyzed?: number };

  // Tipo de mídia
  const typeCount = posts.reduce((acc: Record<string, number>, p) => {
    const t = p.type === "CAROUSEL_ALBUM" ? "Carrossel" : p.type === "VIDEO" ? "Vídeo" : "Imagem";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(typeCount).map(([name, value]) => ({ name, value }));

  // Top posts por engajamento
  const topPosts = [...posts]
    .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
    .slice(0, 12);

  // Gráfico de barras — top 8
  const barData = topPosts.slice(0, 8).map(p => ({
    data: new Date(p.posted).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    Curtidas: p.likes,
    Comentários: p.comments,
  }));

  // Engajamento médio por tipo
  const typeEngMap = posts.reduce((acc: Record<string, { total: number; count: number }>, p) => {
    const t = p.type === "CAROUSEL_ALBUM" ? "Carrossel" : p.type === "VIDEO" ? "Vídeo" : "Imagem";
    if (!acc[t]) acc[t] = { total: 0, count: 0 };
    acc[t].total += p.likes + p.comments;
    acc[t].count += 1;
    return acc;
  }, {});
  const typeEngData = Object.entries(typeEngMap).map(([name, v]) => ({
    name,
    "Eng. Médio": Math.round(v.total / v.count),
  }));

  const fetchedAt = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleString("pt-BR")
    : null;

  return (
    <div className="min-h-screen bg-[#060E1A] text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500">
            <Instagram className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Instagram Analytics</h1>
            <p className="text-slate-400 text-xs">
              @{account?.username ?? "zenite.tech"}
              {fetchedAt && <span className="ml-2 text-slate-600">· {fetchedAt}</span>}
            </p>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          variant="outline"
          size="sm"
          className="border-blue-700 text-blue-400 hover:bg-blue-900/30"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${(isLoading || isRefreshing) ? "animate-spin" : ""}`} />
          Atualizar dados
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-400">Carregando dados ao vivo do Instagram...</p>
            <p className="text-slate-600 text-xs mt-1">Conectando com a Meta Graph API</p>
          </div>
        </div>
      ) : !data?.success ? (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6">
            <p className="text-red-400 font-medium">Erro ao carregar dados</p>
            <p className="text-red-300/70 text-sm mt-1">{data?.error ?? "Token inválido ou expirado"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KpiCard title="Seguidores" value={account?.followers?.toLocaleString("pt-BR") ?? "—"} subtitle={`${account?.following ?? 0} seguindo`} icon={Users} accent />
            <KpiCard title="Total de Posts" value={account?.totalPosts?.toLocaleString("pt-BR") ?? "—"} subtitle="publicações" icon={BarChart3} />
            <KpiCard title="Alcance (30d)" value={(insights.totalReach ?? 0).toLocaleString("pt-BR")} subtitle="contas alcançadas" icon={Eye} />
            <KpiCard title="Eng. Médio" value={`${metrics.avgEngagement ?? 0}%`} subtitle={`${metrics.avgLikes ?? 0} curtidas/post`} icon={Heart} />
          </div>

          {/* KPIs secundários */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KpiCard title="Interações (30d)" value={(insights.total_interactions ?? 0).toLocaleString("pt-BR")} subtitle="curtidas + comentários" icon={TrendingUp} />
            <KpiCard title="Contas Engajadas" value={(insights.accounts_engaged ?? 0).toLocaleString("pt-BR")} subtitle="últimos 30 dias" icon={Share2} />
            <KpiCard title="Visitas ao Perfil" value={(insights.profile_views ?? 0).toLocaleString("pt-BR")} subtitle="últimos 30 dias" icon={MousePointerClick} />
            <KpiCard title="Cliques no Site" value={(insights.website_clicks ?? 0).toLocaleString("pt-BR")} subtitle="últimos 30 dias" icon={Globe} />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <Card className="bg-[#0F1E35] border-[#1A3A6B]">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm text-slate-300">Top Posts — Curtidas e Comentários</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1A3A6B" />
                        <XAxis dataKey="data" tick={{ fill: "#64748b", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#0F1E35", border: "1px solid #1A3A6B", borderRadius: 8 }} labelStyle={{ color: "#94a3b8" }} />
                        <Bar dataKey="Curtidas" fill="#2D7DD2" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Comentários" fill="#4A9EDB" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-[#0F1E35] border-[#1A3A6B]">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm text-slate-300">Mix de Conteúdo</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#0F1E35", border: "1px solid #1A3A6B", borderRadius: 8 }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Engajamento por tipo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="bg-[#0F1E35] border-[#1A3A6B]">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm text-slate-300">Eng. Médio por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeEngData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A3A6B" />
                      <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#0F1E35", border: "1px solid #1A3A6B", borderRadius: 8 }} />
                      <Bar dataKey="Eng. Médio" fill="#2D7DD2" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Perfil resumo */}
            <Card className="bg-[#0F1E35] border-[#1A3A6B] md:col-span-2">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm text-slate-300">Perfil @{account?.username}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-start">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white mb-1">{account?.name}</p>
                    {account?.bio && (
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{account.bio}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-xl font-bold text-blue-400">{account?.followers?.toLocaleString("pt-BR")}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Seguidores</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-blue-400">{account?.following?.toLocaleString("pt-BR")}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Seguindo</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-blue-400">{account?.totalPosts?.toLocaleString("pt-BR")}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Posts</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de top posts */}
          <Card className="bg-[#0F1E35] border-[#1A3A6B]">
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-slate-300">
                  Top {topPosts.length} Posts por Engajamento
                </CardTitle>
                <Badge variant="outline" className="border-blue-800 text-blue-400 text-xs">
                  {posts.length} posts analisados
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {topPosts.map((post, i) => (
                  <PostCard key={post.id} post={post} rank={i + 1} />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
