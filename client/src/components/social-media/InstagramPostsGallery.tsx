import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Grid3X3, RefreshCw, Heart, MessageCircle, TrendingUp, ExternalLink,
  Film, Image, Layers, X, Eye, Share2, Bookmark, BarChart2,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  CAROUSEL_ALBUM: "Carrossel",
  REEL: "Reel",
};

const TYPE_COLORS: Record<string, string> = {
  IMAGE: "bg-blue-100 text-blue-700",
  VIDEO: "bg-purple-100 text-purple-700",
  CAROUSEL_ALBUM: "bg-pink-100 text-pink-700",
  REEL: "bg-orange-100 text-orange-700",
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  IMAGE: Image,
  VIDEO: Film,
  CAROUSEL_ALBUM: Layers,
  REEL: Film,
};

interface PostCardProps {
  post: {
    id: string;
    postId: string;
    caption: string | null;
    mediaUrl: string | null;
    postType: string | null;
    likes: number;
    comments: number;
    shares: number;
    engagement: number;
    postedAt: Date | null;
  };
  onClick: () => void;
}

function PostCard({ post, onClick }: PostCardProps) {
  const type = post.postType ?? "IMAGE";
  const TypeIcon = TYPE_ICONS[type] ?? Image;
  const colorClass = TYPE_COLORS[type] ?? "bg-gray-100 text-gray-700";
  const engagementPct = post.engagement ?? 0;

  return (
    <button
      onClick={onClick}
      className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-square border border-gray-200 hover:border-purple-400 hover:shadow-md transition-all"
    >
      {/* Thumbnail */}
      {post.mediaUrl ? (
        <img
          src={post.mediaUrl}
          alt={post.caption?.slice(0, 50) ?? "Post"}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
          <TypeIcon className="w-8 h-8 text-purple-300" />
        </div>
      )}

      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
        <div className="flex items-center gap-3 text-foreground text-sm font-semibold">
          <span className="flex items-center gap-1">
            <Heart className="w-4 h-4 fill-white" />
            {post.likes}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4 fill-white" />
            {post.comments}
          </span>
        </div>
        <span className="text-foreground/80 text-xs">
          {engagementPct.toFixed(2)}% eng.
        </span>
      </div>

      {/* Type badge */}
      <div className="absolute top-2 left-2">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colorClass} opacity-90`}>
          {TYPE_LABELS[type] ?? type}
        </span>
      </div>

      {/* Date badge */}
      {post.postedAt && (
        <div className="absolute bottom-2 right-2">
          <span className="text-xs bg-black/50 text-foreground px-1.5 py-0.5 rounded">
            {new Date(post.postedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </span>
        </div>
      )}
    </button>
  );
}

interface PostDetailModalProps {
  post: {
    id: string;
    postId: string;
    caption: string | null;
    mediaUrl: string | null;
    postType: string | null;
    likes: number;
    comments: number;
    shares: number;
    engagement: number;
    postedAt: Date | null;
  };
  onClose: () => void;
}

function PostDetailModal({ post, onClose }: PostDetailModalProps) {
  const type = post.postType ?? "IMAGE";
  const TypeIcon = TYPE_ICONS[type] ?? Image;
  const colorClass = TYPE_COLORS[type] ?? "bg-gray-100 text-gray-700";
  const engagementPct = post.engagement ?? 0;

  // Fetch insights ao vivo para o post selecionado
  const { data: insightsData, isLoading: insightsLoading } = trpc.instagram.getPostInsightsLive.useQuery(
    { postId: post.postId },
    { enabled: !!post.postId, staleTime: 300_000 }
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <TypeIcon className="w-5 h-5 text-purple-600" />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
              {TYPE_LABELS[type] ?? type}
            </span>
            {post.postedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(post.postedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media */}
        {post.mediaUrl && (
          <div className="relative bg-gray-100">
            <img
              src={post.mediaUrl}
              alt="Post"
              className="w-full max-h-64 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        {/* Metrics */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <Heart className="w-5 h-5 text-red-500 mx-auto mb-1" />
              <div className="text-xl font-bold text-gray-900">{post.likes.toLocaleString("pt-BR")}</div>
              <div className="text-xs text-muted-foreground">Curtidas</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <MessageCircle className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <div className="text-xl font-bold text-gray-900">{post.comments.toLocaleString("pt-BR")}</div>
              <div className="text-xs text-muted-foreground">Comentários</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <TrendingUp className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <div className="text-xl font-bold text-gray-900">{engagementPct.toFixed(2)}%</div>
              <div className="text-xs text-muted-foreground">Engajamento</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <Share2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <div className="text-xl font-bold text-gray-900">{post.shares.toLocaleString("pt-BR")}</div>
              <div className="text-xs text-muted-foreground">Compartilhamentos</div>
            </div>
          </div>

          {/* Insights ao vivo */}
          {insightsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Carregando insights ao vivo...
            </div>
          ) : insightsData?.success && (
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart2 className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-semibold text-gray-700">Insights ao Vivo (MCP)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <Eye className="w-4 h-4 text-indigo-500 mx-auto mb-0.5" />
                  <div className="text-sm font-bold text-gray-900">{(insightsData.reach ?? 0).toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground">Alcance</div>
                </div>
                <div className="text-center">
                  <Eye className="w-4 h-4 text-teal-500 mx-auto mb-0.5" />
                  <div className="text-sm font-bold text-gray-900">{(insightsData.views ?? 0).toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground">Visualizações</div>
                </div>
                <div className="text-center">
                  <Bookmark className="w-4 h-4 text-amber-500 mx-auto mb-0.5" />
                  <div className="text-sm font-bold text-gray-900">{(insightsData.saved ?? 0).toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground">Salvos</div>
                </div>
              </div>
            </div>
          )}

          {/* Caption */}
          {post.caption && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-600 mb-1">Legenda</p>
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">{post.caption}</p>
            </div>
          )}

          {/* Link */}
          <a
            href={`https://www.instagram.com/p/${post.postId}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Ver no Instagram
          </a>
        </div>
      </div>
    </div>
  );
}

export function InstagramPostsGallery() {
  const { data, isLoading, refetch, isFetching } = trpc.instagram.getSavedPosts.useQuery(
    { limit: 20, accountId: "zenite_tech" },
    { staleTime: 120_000 }
  );
  const [selectedPost, setSelectedPost] = useState<(typeof posts)[0] | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");

  const posts = data?.posts ?? [];

  const filteredPosts = filterType === "ALL"
    ? posts
    : posts.filter((p) => p.postType === filterType);

  const typeOptions = ["ALL", "IMAGE", "VIDEO", "CAROUSEL_ALBUM"];

  // Stats
  const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments ?? 0), 0);
  const avgEngagement = posts.length > 0
    ? posts.reduce((s, p) => s + (p.engagement ?? 0), 0) / posts.length
    : 0;
  const topPost = [...posts].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))[0];

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-pink-600" />
              Galeria de Posts Sincronizados
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {posts.length} posts salvos no banco · clique para ver insights individuais
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Carregando galeria...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Grid3X3 className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum post sincronizado ainda.</p>
              <p className="text-xs mt-1">Execute "Sincronizar via MCP" para popular a galeria.</p>
            </div>
          ) : (
            <>
              {/* Stats rápidas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <Heart className="w-4 h-4 text-red-500 mx-auto mb-1" />
                  <div className="text-lg font-bold text-gray-900">{totalLikes.toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground">Total Curtidas</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <MessageCircle className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <div className="text-lg font-bold text-gray-900">{totalComments.toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground">Total Coments.</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <TrendingUp className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                  <div className="text-lg font-bold text-gray-900">{avgEngagement.toFixed(2)}%</div>
                  <div className="text-xs text-muted-foreground">Eng. Médio</div>
                </div>
                <div className="bg-pink-50 rounded-lg p-3 text-center">
                  <Heart className="w-4 h-4 text-pink-500 mx-auto mb-1 fill-pink-500" />
                  <div className="text-lg font-bold text-gray-900">{topPost?.likes ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Melhor Post</div>
                </div>
              </div>

              {/* Filtro por tipo */}
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                {typeOptions.map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterType === t
                        ? "bg-pink-600 text-foreground"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t === "ALL" ? `Todos (${posts.length})` : `${TYPE_LABELS[t] ?? t} (${posts.filter((p) => p.postType === t).length})`}
                  </button>
                ))}
              </div>

              {/* Grid de galeria */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {filteredPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onClick={() => setSelectedPost(post)}
                  />
                ))}
              </div>

              {filteredPosts.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Nenhum post do tipo "{TYPE_LABELS[filterType] ?? filterType}" encontrado.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhe */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </>
  );
}
