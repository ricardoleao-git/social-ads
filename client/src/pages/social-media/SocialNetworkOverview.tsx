import { useLocation } from "wouter";
import {
  Youtube, Linkedin, Facebook, Music2, Users, TrendingUp,
  Plus, RefreshCw, BarChart2, Globe, Wifi, WifiOff, Info,
  ArrowRight, Settings,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useSocialMedia, type SocialNetwork } from "@/components/social-media/SocialMediaWrapper";

// ─── Platform config ──────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  text: string;
  metrics: string[];
  description: string;
  apiNote: string;
}> = {
  youtube: {
    label: "YouTube",
    icon: Youtube,
    color: "from-red-500 to-red-600",
    bg: "bg-red-50",
    text: "text-red-700",
    metrics: ["Inscritos", "Visualizações", "Horas Assistidas", "CTR de Miniaturas"],
    description: "Monitore o desempenho do seu canal no YouTube: inscritos, visualizações, retenção de audiência e receita.",
    apiNote: "YouTube Data API v3 · Google Cloud Console",
  },
  tiktok: {
    label: "TikTok",
    icon: Music2,
    color: "from-gray-800 to-gray-900",
    bg: "bg-gray-50",
    text: "text-gray-700",
    metrics: ["Seguidores", "Visualizações de Vídeo", "Curtidas", "Compartilhamentos"],
    description: "Acompanhe o crescimento de seguidores, alcance de vídeos e taxa de engajamento no TikTok.",
    apiNote: "TikTok for Business API · TikTok Developer Portal",
  },
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    color: "from-blue-600 to-blue-700",
    bg: "bg-blue-50",
    text: "text-blue-700",
    metrics: ["Seguidores da Página", "Impressões", "Cliques", "Engajamento"],
    description: "Monitore o desempenho da sua página no LinkedIn: seguidores, alcance de posts e geração de leads.",
    apiNote: "LinkedIn Marketing API · LinkedIn Developer Portal",
  },
  facebook: {
    label: "Facebook",
    icon: Facebook,
    color: "from-blue-500 to-blue-600",
    bg: "bg-blue-50",
    text: "text-blue-700",
    metrics: ["Curtidas na Página", "Alcance", "Engajamento", "Cliques no Link"],
    description: "Acompanhe curtidas na página, alcance orgânico e pago, e engajamento de posts no Facebook.",
    apiNote: "Meta Business API · Meta for Developers",
  },
};

interface Props {
  network: SocialNetwork;
}

export default function SocialNetworkOverview({ network }: Props) {
  const [, setLocation] = useLocation();
  const { selectedAccount, allAccounts, setSelectedNetwork } = useSocialMedia();

  const config = PLATFORM_CONFIG[network];
  if (!config) return null;

  const Icon = config.icon;

  // Get accounts for this network
  const networkAccounts = allAccounts.filter((a) => a.platformId === network);

  // Fetch posts from DB for this network's accounts
  const firstAccountId = networkAccounts[0]?.id;
  const { data: dbPosts, isLoading: postsLoading } = trpc.instagram.getPosts.useQuery(
    { accountId: firstAccountId ?? "", limit: 10 },
    { enabled: !!firstAccountId, staleTime: 300_000 }
  );

  // Fetch metrics from DB
  const { data: dbMetrics, isLoading: metricsLoading } = trpc.instagram.getMetrics.useQuery(
    { accountId: firstAccountId ?? "", period: "30d" },
    { enabled: !!firstAccountId, staleTime: 300_000 }
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-md`}>
            <Icon className="w-6 h-6 text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{config.label}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{config.description}</p>
          </div>
        </div>
        <Button
          onClick={() => setLocation("/redes-sociais/contas")}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Settings className="w-4 h-4" />
          Gerenciar Contas
        </Button>
      </div>

      {networkAccounts.length === 0 ? (
        // No accounts — onboarding state
        <div className="space-y-4">
          <Card className="p-8 text-center">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${config.color} flex items-center justify-center mx-auto mb-4 shadow-md`}>
              <Icon className="w-8 h-8 text-foreground" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Nenhuma conta {config.label} cadastrada
            </h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
              Cadastre sua conta do {config.label} para começar a monitorar métricas, posts e engajamento diretamente neste dashboard.
            </p>
            <Button
              onClick={() => setLocation("/redes-sociais/contas")}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Cadastrar conta {config.label}
            </Button>
          </Card>

          {/* What you'll get */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-500" />
              O que você poderá monitorar
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {config.metrics.map((metric) => (
                <div key={metric} className={`flex items-center gap-2 p-3 ${config.bg} rounded-xl`}>
                  <TrendingUp className={`w-4 h-4 ${config.text} flex-shrink-0`} />
                  <span className={`text-sm font-medium ${config.text}`}>{metric}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* API info */}
          <Card className="p-4 bg-gray-50 border-gray-200">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Integração via API</p>
                <p className="text-xs text-muted-foreground mb-2">
                  A sincronização de dados do {config.label} requer configuração da API oficial.
                  Após cadastrar a conta, solicite ao agente Manus que configure a integração.
                </p>
                <p className="text-xs text-muted-foreground font-mono">{config.apiNote}</p>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        // Has accounts — show data
        <div className="space-y-6">
          {/* Account selector */}
          <div className="flex items-center gap-3 flex-wrap">
            {networkAccounts.map((acc) => (
              <div
                key={acc.id}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                  acc.id === selectedAccount.id
                    ? `border-blue-500 bg-blue-50`
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center text-foreground text-xs font-bold`}>
                  {acc.displayName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{acc.displayName}</p>
                  <p className="text-xs text-muted-foreground">{acc.username}</p>
                </div>
                {acc.lastSync ? (
                  <Wifi className="w-3 h-3 text-green-500 ml-1" />
                ) : (
                  <WifiOff className="w-3 h-3 text-muted-foreground ml-1" />
                )}
              </div>
            ))}
          </div>

          {/* Metrics from DB */}
          {metricsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Carregando métricas...
            </div>
          ) : dbMetrics && dbMetrics.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {dbMetrics.slice(0, 4).map((m) => (
                <Card key={m.id} className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{m.metricType}</p>
                  <p className="text-xl font-bold text-gray-900">
                    {Number(m.metricValue).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.period}</p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <Globe className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-2">Nenhuma métrica sincronizada ainda</p>
              <p className="text-xs text-muted-foreground mb-4">
                Solicite ao agente Manus: <em>"Sincronize os dados do {config.label} para a conta {networkAccounts[0]?.username}"</em>
              </p>
            </Card>
          )}

          {/* Posts from DB */}
          {postsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Carregando posts...
            </div>
          ) : dbPosts && dbPosts.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Posts Recentes ({dbPosts.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dbPosts.map((post) => (
                  <Card key={post.id} className="p-4">
                    <p className="text-xs text-gray-600 line-clamp-2 mb-3">{post.caption || "(sem legenda)"}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>❤️ {post.likes?.toLocaleString("pt-BR") ?? 0}</span>
                      <span>💬 {post.comments?.toLocaleString("pt-BR") ?? 0}</span>
                      <span>🔁 {post.shares?.toLocaleString("pt-BR") ?? 0}</span>
                    </div>
                    {post.postedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(post.postedAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card className="p-6 text-center">
              <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum post sincronizado ainda</p>
            </Card>
          )}

          {/* API info */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800 mb-1">Sincronização de Dados</p>
                <p className="text-xs text-blue-700">
                  Para sincronizar dados reais do {config.label}, solicite ao agente Manus:{" "}
                  <em>"Sincronize os dados do {config.label} para a conta {networkAccounts[0]?.username}"</em>.
                  O agente configurará a integração via API e salvará os dados no banco automaticamente.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
