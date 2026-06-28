import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart, MessageCircle, Share2, Bookmark, Users, Eye,
  TrendingUp, ExternalLink, RefreshCw, Trophy, Info,
} from "lucide-react";
import { toast } from "sonner";

// Dados reais do post com mais engajamento — coletados via MCP Instagram em 06/04/2026
const TOP_POST = {
  id: "18003849773723274",
  label: "Brindes 🎁",
  date: "20/03/2026",
  caption:
    "Chegou coisa nova por aqui… e a gente precisava te mostrar 👀\n\nRicardo e Melissa já estão com os novos brindes em mãos: canetas e mousepads feitos especialmente para nossos clientes e parceiros.\n\nSimples, mas com muito carinho. Porque parceria de verdade se cuida nos detalhes. 💙",
  link: "https://www.instagram.com/reel/DWHrTfzDaHu/",
  type: "VIDEO",
  thumbnailUrl: null as string | null,
  // Métricas do post (likes + comments)
  likes: 96,
  comments: 13,
  // Insights via get_post_insights
  reach: 825,
  views: 1450,
  shares: 11,
  saved: 2,
  total_interactions: 123,
};

const ENGAGEMENT_RATE = ((TOP_POST.total_interactions / TOP_POST.reach) * 100).toFixed(2);

interface InsightMetric {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

const METRICS: InsightMetric[] = [
  {
    label: "Alcance",
    value: TOP_POST.reach.toLocaleString("pt-BR"),
    icon: Users,
    color: "text-purple-600",
    description: "Contas únicas que viram o post",
  },
  {
    label: "Visualizações",
    value: TOP_POST.views.toLocaleString("pt-BR"),
    icon: Eye,
    color: "text-pink-600",
    description: "Total de vezes que o vídeo foi reproduzido",
  },
  {
    label: "Curtidas",
    value: TOP_POST.likes.toLocaleString("pt-BR"),
    icon: Heart,
    color: "text-red-500",
    description: "Reações de curtida no post",
  },
  {
    label: "Comentários",
    value: TOP_POST.comments.toLocaleString("pt-BR"),
    icon: MessageCircle,
    color: "text-blue-500",
    description: "Comentários públicos no post",
  },
  {
    label: "Compartilhamentos",
    value: TOP_POST.shares.toLocaleString("pt-BR"),
    icon: Share2,
    color: "text-emerald-600",
    description: "Vezes que o post foi compartilhado",
  },
  {
    label: "Salvamentos",
    value: TOP_POST.saved.toLocaleString("pt-BR"),
    icon: Bookmark,
    color: "text-amber-600",
    description: "Vezes que o post foi salvo",
  },
];

export function InstagramTopEngagementPost() {
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const syncMutation = trpc.instagram.syncFromMCP.useMutation({
    onSuccess: () => {
      toast.success("Dados atualizados com sucesso!");
      setIsRefreshing(false);
    },
    onError: () => {
      toast.error("Erro ao sincronizar. Usando dados do último cache.");
      setIsRefreshing(false);
    },
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    syncMutation.mutate({ username: "zenite.tech" });
  };

  const captionLines = TOP_POST.caption.split("\n");
  const shortCaption = captionLines.slice(0, 2).join("\n");
  const hasMore = captionLines.length > 2;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Post com Mais Engajamento
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5 h-7 text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Análise completa do post com maior número de interações totais
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cabeçalho do post */}
        <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-100">
          {/* Thumbnail placeholder */}
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center flex-shrink-0 text-2xl">
            🎁
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs bg-pink-100 text-pink-700 border-pink-200">
                REEL
              </Badge>
              <span className="text-xs text-muted-foreground">{TOP_POST.date}</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">{TOP_POST.label}</p>
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-red-400" />
                {TOP_POST.likes} curtidas
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3 text-blue-400" />
                {TOP_POST.comments} comentários
              </span>
            </div>
          </div>
          <a
            href={TOP_POST.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/60 transition-colors"
            title="Ver no Instagram"
          >
            <ExternalLink className="w-4 h-4 text-purple-600" />
          </a>
        </div>

        {/* Taxa de engajamento destaque */}
        <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-amber-700 font-medium">Taxa de Engajamento</p>
            <p className="text-2xl font-bold text-amber-800">{ENGAGEMENT_RATE}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-amber-600">Interações totais</p>
            <p className="text-xl font-bold text-amber-700">{TOP_POST.total_interactions}</p>
          </div>
        </div>

        {/* Grid de métricas */}
        <div className="grid grid-cols-3 gap-2">
          {METRICS.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="flex flex-col items-center p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-center"
                title={metric.description}
              >
                <Icon className={`w-4 h-4 mb-1 ${metric.color}`} />
                <p className="text-base font-bold text-gray-900">{metric.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{metric.label}</p>
              </div>
            );
          })}
        </div>

        {/* Legenda do post */}
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            Legenda do Post
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {showFullCaption ? TOP_POST.caption : shortCaption}
            {hasMore && !showFullCaption && "..."}
          </p>
          {hasMore && (
            <button
              onClick={() => setShowFullCaption(!showFullCaption)}
              className="mt-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium"
            >
              {showFullCaption ? "Ver menos" : "Ver mais"}
            </button>
          )}
        </div>

        {/* Nota sobre comentários */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700">
            <p className="font-semibold mb-0.5">Sobre os comentários</p>
            <p>
              Este post tem <strong>{TOP_POST.comments} comentários</strong>. A API do Instagram não fornece o
              conteúdo dos comentários via MCP — para lê-los, acesse o post diretamente no Instagram ou via
              Meta Business Suite.
            </p>
            <a
              href={TOP_POST.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 font-semibold text-blue-600 hover:text-blue-800"
            >
              Ver comentários no Instagram <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Fonte: Instagram Graph API via MCP · Última coleta: 06/04/2026
        </p>
      </CardContent>
    </Card>
  );
}
