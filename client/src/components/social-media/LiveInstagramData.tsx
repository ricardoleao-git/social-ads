import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Users, Heart, MessageCircle, ExternalLink,
  CheckCircle, AlertCircle, Clock, Instagram,
} from "lucide-react";

interface LivePostCardProps {
  post: {
    id: string;
    type: string;
    caption: string;
    link: string;
    likes: number;
    comments: number;
    posted: string;
  };
}

function LivePostCard({ post }: LivePostCardProps) {
  const typeEmoji = post.type === "VIDEO" ? "🎬" : post.type === "CAROUSEL_ALBUM" ? "🖼️" : "📷";
  const date = post.posted ? new Date(post.posted).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  }) : "—";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">
          {typeEmoji} {post.type}
        </span>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>
      <p className="text-sm text-gray-700 line-clamp-3 mb-3">
        {post.caption || "(Sem legenda)"}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-red-500 font-semibold">
            <Heart className="w-3.5 h-3.5" /> {post.likes}
          </span>
          <span className="flex items-center gap-1 text-blue-500 font-semibold">
            <MessageCircle className="w-3.5 h-3.5" /> {post.comments}
          </span>
        </div>
        <a
          href={post.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Ver post <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default function LiveInstagramData({ username }: { username?: string } = {}) {
  const [enabled, setEnabled] = useState(true); // Carrega automaticamente
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data, isLoading, refetch, dataUpdatedAt } = trpc.instagram.getLiveData.useQuery(
    username ? { username } : undefined,
    {
      enabled,
      staleTime: 5 * 60 * 1000, // 5 minutos
      retry: 1,
    }
  );

  const syncMutation = trpc.instagram.syncFromMCP.useMutation({
    onSuccess: (result) => {
      setSyncResult({ success: true, message: `Sincronizado: ${result.metrics.followers.toLocaleString("pt-BR")} seguidores, ${result.metrics.avgEngagement.toFixed(2)}% engajamento, ${result.postsCount} posts.` });
      refetch();
      setTimeout(() => setSyncResult(null), 8000);
    },
    onError: (err) => {
      setSyncResult({ success: false, message: `Erro: ${err.message}` });
      setTimeout(() => setSyncResult(null), 8000);
    },
  });

  const handleFetch = () => {
    if (!enabled) {
      setEnabled(true);
    } else {
      refetch();
    }
  };

  const handleSyncToDb = () => {
    syncMutation.mutate({ username: username ?? "zenite.tech" });
  };

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <Instagram className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Dados ao Vivo — Instagram</h3>
            <p className="text-xs text-muted-foreground">@{username ?? "ricardo_leao"} · Conta conectada via MCP</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" /> Atualizado às {lastUpdated}
            </span>
          )}
          <Button
            onClick={handleFetch}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1.5" />
            )}
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button
            onClick={handleSyncToDb}
            disabled={syncMutation.isPending}
            size="sm"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-foreground"
          >
            {syncMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-1.5" />
            )}
            <span className="hidden sm:inline">Sincronizar no Banco</span>
            <span className="sm:hidden">Sync</span>
          </Button>
        </div>
      </div>

      {/* Sync Result Feedback */}
      {syncResult && (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
          syncResult.success
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          {syncResult.success ? (
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
          )}
          <span>{syncResult.message}</span>
        </div>
      )}



      {/* Loading */}
      {isLoading && (
        <Card className="p-6 border border-gray-200 text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">Buscando dados ao vivo do Instagram...</p>
          <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</p>
        </Card>
      )}

      {/* Error */}
      {data && !data.success && (
        <Card className="p-4 border border-red-200 bg-red-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-red-700">Erro ao buscar dados</p>
              <p className="text-xs text-red-600">{(data as { error?: string }).error ?? "Tente novamente"}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Success */}
      {data && data.success && (
        <>
          {/* Account Info */}
          {data.accountInfo && (
            <Card className="p-5 border border-green-200 bg-green-50">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-bold text-green-800">Conta conectada com sucesso</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{data.accountInfo.followers.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                    <Users className="w-3 h-3" /> Seguidores
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{data.accountInfo.following.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-muted-foreground mt-1">Seguindo</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{data.accountInfo.totalPosts?.toLocaleString("pt-BR") ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {data.metrics ? `${data.metrics.avgEngagement}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Engajamento Médio</p>
                </div>
              </div>
              {data.accountInfo.bio && (
                <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-green-200 italic">
                  "{data.accountInfo.bio}"
                </p>
              )}
            </Card>
          )}

          {/* Metrics Summary */}
          {data.metrics && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 border border-gray-200">
                <p className="text-xs text-muted-foreground mb-1">Total de Curtidas (últimos posts)</p>
                <p className="text-2xl font-bold text-red-500">{data.metrics.totalLikes.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">Média: {data.metrics.avgLikes} por post</p>
              </Card>
              <Card className="p-4 border border-gray-200">
                <p className="text-xs text-muted-foreground mb-1">Total de Comentários</p>
                <p className="text-2xl font-bold text-blue-500">{data.metrics.totalComments.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">Média: {data.metrics.avgComments} por post</p>
              </Card>
              <Card className="p-4 border border-gray-200">
                <p className="text-xs text-muted-foreground mb-1">Posts Analisados</p>
                <p className="text-2xl font-bold text-purple-500">{data.metrics.recentPostsAnalyzed ?? 0}</p>
                <p className="text-xs text-muted-foreground">Dos últimos 20 posts</p>
              </Card>
            </div>
          )}

          {/* Recent Posts */}
          {data.posts && data.posts.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">
                Posts Recentes ({data.posts.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.posts.map((post) => (
                  <LivePostCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
