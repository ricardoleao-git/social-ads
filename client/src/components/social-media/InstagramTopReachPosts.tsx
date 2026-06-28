import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Heart, MessageCircle, Trophy, Image, Film, LayoutGrid, ExternalLink } from "lucide-react";

interface Post {
  id: string;
  postId?: string | null;
  caption?: string | null;
  postType?: string | null;
  likes?: number | null;
  comments?: number | null;
  reach?: number | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  postedAt?: Date | null;
}

interface Props {
  posts: Post[];
  dateRange?: { start: Date | null; end: Date | null };
}

function PostTypeIcon({ type }: { type?: string | null }) {
  if (type === "VIDEO" || type === "REEL") return <Film className="w-3 h-3" />;
  if (type === "CAROUSEL_ALBUM") return <LayoutGrid className="w-3 h-3" />;
  return <Image className="w-3 h-3" />;
}

function PostTypeBadge({ type }: { type?: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    VIDEO: { label: "Vídeo", cls: "bg-blue-100 text-blue-700" },
    REEL: { label: "Reel", cls: "bg-purple-100 text-purple-700" },
    CAROUSEL_ALBUM: { label: "Carrossel", cls: "bg-orange-100 text-orange-700" },
    IMAGE: { label: "Imagem", cls: "bg-green-100 text-green-700" },
  };
  const t = (type ?? "IMAGE").toUpperCase();
  const cfg = map[t] ?? { label: t, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
      <PostTypeIcon type={type} />
      {cfg.label}
    </span>
  );
}

const MEDAL_COLORS = ["text-yellow-500", "text-muted-foreground", "text-amber-600", "text-blue-400", "text-green-400"];
const MEDAL_BG = ["bg-yellow-50", "bg-gray-50", "bg-amber-50", "bg-blue-50", "bg-green-50"];

export function InstagramTopReachPosts({ posts, dateRange }: Props) {
  const top5 = useMemo(() => {
    const sorted = [...posts]
      .filter((p) => (p.reach ?? 0) > 0 || (p.likes ?? 0) > 0)
      .sort((a, b) => {
        const scoreA = (a.reach ?? 0) * 2 + (a.likes ?? 0) + (a.comments ?? 0) * 2;
        const scoreB = (b.reach ?? 0) * 2 + (b.likes ?? 0) + (b.comments ?? 0) * 2;
        return scoreB - scoreA;
      });
    return sorted.slice(0, 5);
  }, [posts]);

  const maxReach = top5[0]?.reach ?? top5[0]?.likes ?? 1;

  const periodLabel = useMemo(() => {
    if (dateRange?.start && dateRange?.end) {
      return `${dateRange.start.toLocaleDateString("pt-BR")} – ${dateRange.end.toLocaleDateString("pt-BR")}`;
    }
    return "todos os posts sincronizados";
  }, [dateRange]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-yellow-50 text-yellow-600 flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Top 5 Posts por Alcance</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{periodLabel}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs text-muted-foreground">
          {posts.length} posts no período
        </Badge>
      </div>

      {top5.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Eye className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum post com dados de alcance no período.</p>
          <p className="text-xs mt-1">Sincronize os dados para ver os top posts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {top5.map((post, idx) => {
            const reach = post.reach ?? post.likes ?? 0;
            const barWidth = maxReach > 0 ? Math.round((reach / maxReach) * 100) : 0;
            const caption = post.caption
              ? post.caption.length > 60
                ? post.caption.slice(0, 60) + "…"
                : post.caption
              : `Post ${post.postId?.slice(-6) ?? idx + 1}`;

            return (
              <div key={post.id} className={`flex items-start gap-3 p-3 rounded-xl border border-gray-100 ${MEDAL_BG[idx]}`}>
                {/* Rank */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${MEDAL_COLORS[idx]} bg-white border border-gray-200`}>
                  {idx + 1}
                </div>

                {/* Thumbnail */}
                {(post.thumbnailUrl || post.mediaUrl) ? (
                  <img
                    src={post.thumbnailUrl ?? post.mediaUrl ?? ""}
                    alt="post"
                    className="w-10 h-10 rounded-lg object-cover shrink-0 border border-gray-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <PostTypeIcon type={post.postType} />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PostTypeBadge type={post.postType} />
                    {post.postedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(post.postedAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed mb-2">{caption}</p>

                  {/* Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-500" : "bg-blue-400"}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 shrink-0">
                      {reach.toLocaleString("pt-BR")}
                    </span>
                  </div>

                  {/* Metrics row */}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="w-3 h-3 text-purple-400" />
                      {(post.reach ?? 0).toLocaleString("pt-BR")} alcance
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Heart className="w-3 h-3 text-pink-400" />
                      {(post.likes ?? 0).toLocaleString("pt-BR")}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageCircle className="w-3 h-3 text-blue-400" />
                      {(post.comments ?? 0).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>

                {/* External link */}
                {post.mediaUrl && (
                  <a
                    href={post.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1 hover:bg-white rounded-lg transition-all text-muted-foreground hover:text-blue-500"
                    title="Ver no Instagram"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
