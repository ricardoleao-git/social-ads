import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Heart, MessageCircle, Share2, Eye, TrendingUp, RefreshCw, Image,
  Film, Grid, BookOpen, Search, Download,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSocialMedia } from "@/components/social-media/SocialMediaWrapper";

const TYPE_LABELS: Record<string, string> = {
  image: "Imagem", reel: "Reel", carousel: "Carrossel", story: "Story", video: "Vídeo",
};
const TYPE_COLORS: Record<string, string> = {
  image: "bg-blue-100 text-blue-800",
  reel: "bg-purple-100 text-purple-800",
  carousel: "bg-pink-100 text-pink-800",
  story: "bg-green-100 text-green-800",
  video: "bg-orange-100 text-orange-800",
};
const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  image: Image, reel: Film, carousel: Grid, story: BookOpen, video: Film,
};

export default function InstagramPosts() {
  const { selectedAccount } = useSocialMedia();
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const { data: posts, isLoading, refetch, isFetching } = trpc.instagram.getPosts.useQuery(
    { accountId: selectedAccount.id, limit: 50 },
    { staleTime: 120_000, enabled: !!selectedAccount.id }
  );

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter((p) => {
      const matchType = filterType === "all" || p.postType === filterType;
      const matchSearch = !searchQuery || (p.caption ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchSearch;
    });
  }, [posts, filterType, searchQuery]);

  const selectedPost = useMemo(
    () => filteredPosts.find((p) => p.id === selectedPostId) ?? filteredPosts[0] ?? null,
    [filteredPosts, selectedPostId]
  );

  // Build chart data from posts
  const chartData = useMemo(() => {
    return filteredPosts.slice(0, 10).reverse().map((p) => ({
      date: p.postedAt ? new Date(p.postedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—",
      curtidas: p.likes ?? 0,
      comentarios: p.comments ?? 0,
      compartilhamentos: p.shares ?? 0,
    }));
  }, [filteredPosts]);

  const PostIcon = selectedPost ? (TYPE_ICONS[selectedPost.postType ?? "image"] ?? Image) : Image;

  const handleExportCSV = () => {
    if (!filteredPosts.length) return;
    const BOM = "\uFEFF";
    const headers = ["ID", "Tipo", "Data", "Curtidas", "Coment\u00e1rios", "Compartilhamentos", "Engajamento (%)", "Legenda"];
    const rows = filteredPosts.map((p) => [
      p.postId ?? p.id,
      p.postType ?? "image",
      p.postedAt ? new Date(p.postedAt).toLocaleDateString("pt-BR") : "",
      p.likes ?? 0,
      p.comments ?? 0,
      p.shares ?? 0,
      p.engagement ?? "0",
      `"${(p.caption ?? "").replace(/"/g, "\'\'").replace(/\n/g, " ").substring(0, 100)}"`
    ]);
    const csv = BOM + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `instagram-posts-${selectedAccount.username}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Monitoramento de Posts</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {selectedAccount.displayName} · {posts?.length ?? 0} posts sincronizados
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExportCSV}
              disabled={!filteredPosts.length}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button
              onClick={() => refetch()}
              disabled={isFetching}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground py-12 justify-center">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Carregando posts...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar: filters + post list */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="p-4">
                <h3 className="font-bold text-gray-900 mb-3">Filtros</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">Tipo de Post</label>
                    <div className="flex flex-wrap gap-1.5">
                      {["all", "image", "reel", "carousel", "story", "video"].map((type) => (
                        <button
                          key={type}
                          onClick={() => setFilterType(type)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            filterType === type
                              ? "bg-blue-600 text-foreground"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {type === "all" ? "Todos" : TYPE_LABELS[type] ?? type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Buscar</label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por legenda..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 text-sm h-8"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-bold text-gray-900 mb-3">Posts ({filteredPosts.length})</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {filteredPosts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum post encontrado</p>
                  ) : (
                    filteredPosts.map((post) => {
                      const Icon = TYPE_ICONS[post.postType ?? "image"] ?? Image;
                      return (
                        <button
                          key={post.id}
                          onClick={() => setSelectedPostId(post.id)}
                          className={`w-full p-3 rounded-lg text-left transition-all ${
                            selectedPost?.id === post.id
                              ? "bg-blue-50 border-2 border-blue-400"
                              : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[post.postType ?? "image"] ?? "bg-gray-100"}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {post.caption || "(sem legenda)"}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_COLORS[post.postType ?? "image"] ?? "bg-gray-100 text-gray-600"}`}>
                                  {TYPE_LABELS[post.postType ?? "image"] ?? post.postType}
                                </span>
                                {post.postedAt && (
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(post.postedAt).toLocaleDateString("pt-BR")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>

            {/* Main: post detail + chart */}
            <div className="lg:col-span-2 space-y-4">
              {selectedPost ? (
                <>
                  <Card className="p-6">
                    <div className="flex items-start gap-4 mb-5">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[selectedPost.postType ?? "image"] ?? "bg-gray-100"}`}>
                        <PostIcon className="w-7 h-7" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">
                          {selectedPost.caption || "(sem legenda)"}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-sm px-2.5 py-0.5 rounded ${TYPE_COLORS[selectedPost.postType ?? "image"] ?? "bg-gray-100 text-gray-600"}`}>
                            {TYPE_LABELS[selectedPost.postType ?? "image"] ?? selectedPost.postType}
                          </span>
                          {selectedPost.postedAt && (
                            <span className="text-sm text-muted-foreground">
                              {new Date(selectedPost.postedAt).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-red-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Heart className="w-4 h-4 text-red-500" />
                          <span className="text-xs font-semibold text-red-700">Curtidas</span>
                        </div>
                        <p className="text-2xl font-bold text-red-900">
                          {(selectedPost.likes ?? 0).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageCircle className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-semibold text-blue-700">Comentários</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">
                          {(selectedPost.comments ?? 0).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Share2 className="w-4 h-4 text-green-500" />
                          <span className="text-xs font-semibold text-green-700">Compartilhamentos</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900">
                          {(selectedPost.shares ?? 0).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Eye className="w-4 h-4 text-purple-500" />
                          <span className="text-xs font-semibold text-purple-700">Engajamento</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-900">
                          {selectedPost.engagement ?? "—"}
                        </p>
                      </div>
                    </div>

                    {/* Engagement rate */}
                    {selectedPost.engagement != null && (
                      <div className="mt-4 flex items-center gap-2 p-3 bg-orange-50 rounded-xl">
                        <TrendingUp className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-semibold text-orange-700">
                          Engajamento: {selectedPost.engagement}
                        </span>
                      </div>
                    )}
                  </Card>

                  {/* Chart */}
                  {chartData.length > 1 && (
                    <Card className="p-5">
                      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        Performance dos Últimos {chartData.length} Posts
                      </h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="curtidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="comentarios" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="compartilhamentos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  )}
                </>
              ) : (
                <Card className="p-12 text-center">
                  <Image className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-muted-foreground">Selecione um post para ver os detalhes</p>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
