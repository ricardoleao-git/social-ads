import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Gauge,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Globe,
  Smartphone,
  Monitor,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  History,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";

type Strategy = "mobile" | "desktop";

function ScoreBadge({ score }: { score: number }) {
  if (score >= 90) return <Badge className="bg-green-600 text-foreground">{score}</Badge>;
  if (score >= 50) return <Badge className="bg-yellow-500 text-foreground">{score}</Badge>;
  return <Badge className="bg-red-600 text-foreground">{score}</Badge>;
}

function LcpBadge({ ms }: { ms: number }) {
  if (ms <= 2500) return <span className="text-green-400 font-semibold">Bom</span>;
  if (ms <= 4000) return <span className="text-yellow-400 font-semibold">Médio</span>;
  return <span className="text-red-400 font-semibold">Ruim</span>;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 90 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${score}%` }} />
    </div>
  );
}

export default function PageSpeed() {
  const [strategy, setStrategy] = useState<Strategy>("mobile");
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [auditingUrl, setAuditingUrl] = useState<string | null>(null);
  const [liveResults, setLiveResults] = useState<Record<string, any>>({});

  const { data, isLoading } = trpc.pageSpeed.getLatestResults.useQuery();
  const { data: autoHistory } = trpc.pageSpeed.getHistory.useQuery({ limit: 48 }, {
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const triggerMeasurement = trpc.pageSpeed.triggerMeasurement.useMutation();
  const auditMutation = trpc.pageSpeed.auditPage.useMutation();

  const handleAudit = async (url: string) => {
    setAuditingUrl(url);
    try {
      const result = await auditMutation.mutateAsync({ url, strategy });
      if (result.success && result.data) {
        setLiveResults((prev) => ({ ...prev, [url]: result.data }));
      }
    } finally {
      setAuditingUrl(null);
    }
  };

  const pages = data?.pages || [];
  const summary = data?.summary;

  const auditedAt = data?.auditedAt
    ? new Date(data.auditedAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gauge className="w-6 h-6 text-blue-400" />
            Performance PageSpeed
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitoramento de velocidade das landing pages — impacto direto no Quality Score
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            <button
              onClick={() => setStrategy("mobile")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                strategy === "mobile"
                  ? "bg-blue-600 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Mobile
            </button>
            <button
              onClick={() => setStrategy("desktop")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                strategy === "desktop"
                  ? "bg-blue-600 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="w-4 h-4" />
              Desktop
            </button>
          </div>
          <span className="text-muted-foreground text-xs flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Última auditoria: {auditedAt}
          </span>
        </div>
      </div>

      {/* Resumo */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs mb-1">Score Médio Performance</p>
              <p className="text-3xl font-bold text-foreground">{summary.avgPerformanceScore}</p>
              <ScoreBar score={summary.avgPerformanceScore} />
            </CardContent>
          </Card>
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs mb-1">LCP Médio</p>
              <p className="text-3xl font-bold text-red-400">
                {(summary.avgLcpMs / 1000).toFixed(1)}s
              </p>
              <p className="text-xs text-muted-foreground mt-1">Meta: &lt; 2.5s</p>
            </CardContent>
          </Card>
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs mb-1">Páginas com LCP Ruim</p>
              <p className="text-3xl font-bold text-red-400">{summary.pagesWithPoorLcp}</p>
              <p className="text-xs text-muted-foreground mt-1">de {pages.length} páginas</p>
            </CardContent>
          </Card>
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs mb-1">Impacto Quality Score</p>
              <p className="text-sm font-semibold text-red-400 mt-1">
                {summary.estimatedQualityScoreImpact}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerta principal */}
      {summary && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-300 font-semibold text-sm">Problema crítico identificado</p>
            <p className="text-red-400 text-sm mt-0.5">{summary.topIssue}</p>
            <p className="text-muted-foreground text-xs mt-2">
              Páginas lentas aumentam o CPC e reduzem o Quality Score. Recomenda-se corrigir o
              JavaScript não utilizado e otimizar o LCP para abaixo de 2.5s.
            </p>
          </div>
        </div>
      )}

      {/* Lista de páginas */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mr-2" />
          <span className="text-muted-foreground">Carregando dados...</span>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Landing Pages Monitoradas</h2>
          {pages.map((page) => {
            const live = liveResults[page.url];
            const current = live || page;
            const isExpanded = expandedPage === page.url;
            const isAuditing = auditingUrl === page.url;

            return (
              <Card key={page.url} className="bg-muted border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-foreground font-semibold">{page.name}</span>
                        <Badge variant="outline" className="text-xs text-muted-foreground border-gray-600">
                          {page.campaign}
                        </Badge>
                        {live && (
                          <Badge className="bg-blue-700 text-foreground text-xs">Auditado agora</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs mt-0.5 truncate">{page.url}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Performance</p>
                        <ScoreBadge score={current.performanceScore} />
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">SEO</p>
                        <ScoreBadge score={current.seoScore} />
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">LCP</p>
                        <div className="text-sm font-semibold text-foreground">{current.lcp}</div>
                        <LcpBadge ms={current.lcpMs} />
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">TBT</p>
                        <div className="text-sm font-semibold text-foreground">{current.tbt}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-600 text-muted-foreground hover:text-foreground"
                          onClick={() => handleAudit(page.url)}
                          disabled={isAuditing}
                        >
                          {isAuditing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                          {isAuditing ? "Auditando..." : "Auditar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setExpandedPage(isExpanded ? null : page.url)
                          }
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border grid md:grid-cols-2 gap-4">
                      {/* Métricas Core Web Vitals */}
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">Core Web Vitals</p>
                        <div className="space-y-2">
                          {[
                            { label: "LCP (Largest Contentful Paint)", value: current.lcp, ms: current.lcpMs, good: 2500, medium: 4000 },
                            { label: "FCP (First Contentful Paint)", value: current.fcp, ms: current.fcpMs, good: 1800, medium: 3000 },
                            { label: "TBT (Total Blocking Time)", value: current.tbt, ms: current.tbtMs, good: 200, medium: 600 },
                            { label: "CLS (Cumulative Layout Shift)", value: current.cls, ms: 0, good: 0, medium: 0 },
                            { label: "Speed Index", value: current.speedIndex, ms: 0, good: 0, medium: 0 },
                          ].map((m) => (
                            <div key={m.label} className="flex items-center justify-between">
                              <span className="text-muted-foreground text-xs">{m.label}</span>
                              <span className="text-foreground text-xs font-mono">{m.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Oportunidades */}
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">
                          Principais Oportunidades
                        </p>
                        {current.opportunities && current.opportunities.length > 0 ? (
                          <div className="space-y-1.5">
                            {current.opportunities.map((opp: any, i: number) => (
                              <div key={i} className="flex items-start gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">{opp.title}</p>
                                  {opp.savingsMs > 0 && (
                                    <p className="text-xs text-yellow-400">
                                      Economia potencial: {(opp.savingsMs / 1000).toFixed(1)}s
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-xs">Nenhuma oportunidade identificada</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Guia de ação — Lovable/React */}
      <Card className="bg-muted border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            Como melhorar o PageSpeed — zenitetech.com (Lovable / React)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Impacto no Quality Score */}
          <div className="bg-card rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Impacto direto no Google Ads
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="bg-red-900/30 border border-red-800 rounded p-3">
                <p className="text-xs text-red-300 font-semibold">LCP &gt; 4s</p>
                <p className="text-xs text-red-400 mt-1">Quality Score baixo → CPC mais alto → posição inferior</p>
              </div>
              <div className="bg-yellow-900/30 border border-yellow-800 rounded p-3">
                <p className="text-xs text-yellow-300 font-semibold">LCP 2.5s – 4s</p>
                <p className="text-xs text-yellow-400 mt-1">Quality Score médio → CPC moderado</p>
              </div>
              <div className="bg-green-900/30 border border-green-800 rounded p-3">
                <p className="text-xs text-green-300 font-semibold">LCP &lt; 2.5s</p>
                <p className="text-xs text-green-400 mt-1">Quality Score alto → melhor posição com menor CPC</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              <span className="text-yellow-400 font-semibold">Estimativa:</span> reduzir LCP de 8s → 3s pode reduzir o CPC em <span className="text-green-400 font-semibold">15–25%</span> e aumentar o Quality Score em até 3 pontos.
            </p>
          </div>

          {/* Ações Lovable */}
          <div>
            <p className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Ações no Lovable (zenitetech.com — React/Vite)
            </p>
            <div className="space-y-3">
              {[
                {
                  priority: "CRÍTICO",
                  color: "text-red-400",
                  bg: "bg-red-900/20 border-red-800",
                  title: "Converter imagens para WebP com lazy loading",
                  desc: "Todas as imagens do hero, produtos e soluções devem usar formato WebP e atributo loading='lazy'. Principal causa de LCP alto.",
                  prompt: `Converta todas as imagens do site para o formato WebP e adicione loading="lazy" em todas as tags <img> que não estão no hero acima da dobra. Para o hero principal, adicione fetchpriority="high" e preload no <head>. Isso reduzirá o LCP de 8s para menos de 3s.`,
                },
                {
                  priority: "ALTO",
                  color: "text-orange-400",
                  bg: "bg-orange-900/20 border-orange-800",
                  title: "Remover animações pesadas do hero section",
                  desc: "Animações CSS/JS no hero bloqueiam o LCP. Substituir por animações simples com CSS transition ou remover completamente.",
                  prompt: `Remova ou simplifique as animações do hero section das páginas de solução (Social Ads, GuardIA, ConciergIA). Substitua animações baseadas em JavaScript por transições CSS simples (transition: opacity 0.3s ease). Isso reduz o TBT e melhora o LCP.`,
                },
                {
                  priority: "ALTO",
                  color: "text-orange-400",
                  bg: "bg-orange-900/20 border-orange-800",
                  title: "Implementar code splitting por rota",
                  desc: "Carregar todo o JS de uma vez aumenta o TBT. Usar React.lazy() e Suspense para dividir o bundle por página.",
                  prompt: `Implemente code splitting em todas as rotas do site usando React.lazy() e Suspense. Cada página deve ser carregada sob demanda, não no bundle principal. Adicione um componente de loading simples como fallback do Suspense.`,
                },
                {
                  priority: "MÉDIO",
                  color: "text-yellow-400",
                  bg: "bg-yellow-900/20 border-yellow-800",
                  title: "Pré-carregar fontes críticas",
                  desc: "Fontes do Google Fonts causam layout shift (CLS). Adicionar preconnect e preload para as fontes usadas no hero.",
                  prompt: `Adicione no <head> do index.html as tags de preconnect para fonts.googleapis.com e fonts.gstatic.com, e preload para a fonte principal usada nos títulos. Isso elimina o FOUT (Flash of Unstyled Text) e reduz o CLS.`,
                },
                {
                  priority: "MÉDIO",
                  color: "text-yellow-400",
                  bg: "bg-yellow-900/20 border-yellow-800",
                  title: "Adicionar meta viewport e otimizar CSS crítico",
                  desc: "CSS não crítico deve ser carregado de forma assíncrona. O CSS acima da dobra deve ser inline para evitar render-blocking.",
                  prompt: `Identifique o CSS crítico (acima da dobra) e mova-o para inline no <head>. Carregue o restante do CSS de forma assíncrona usando media='print' onload='this.media=\'all\''. Isso elimina o render-blocking CSS e melhora o FCP.`,
                },
                {
                  priority: "BAIXO",
                  color: "text-blue-400",
                  bg: "bg-blue-900/20 border-blue-800",
                  title: "Configurar cache de assets no Vite",
                  desc: "Assets estáticos (imagens, fontes, JS) devem ter cache de longa duração com hash no nome do arquivo.",
                  prompt: `No vite.config.ts, configure o output para incluir hash nos nomes dos arquivos (já padrão no Vite) e adicione headers de cache no servidor: Cache-Control: public, max-age=31536000, immutable para assets com hash. Isso melhora o LCP em visitas recorrentes.`,
                },
              ].map((action, i) => (
                <div key={i} className={`border rounded-lg p-4 ${action.bg}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold ${action.color}`}>[{action.priority}]</span>
                        <span className="text-sm font-semibold text-foreground">{action.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Prompt para o chat do Lovable:</p>
                    <div className="bg-background rounded p-2.5 text-xs text-green-300 font-mono leading-relaxed">
                      {action.prompt}
                    </div>
                    <button
                      className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      onClick={() => navigator.clipboard.writeText(action.prompt)}
                    >
                      📋 Copiar prompt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prioridade de execução */}
          <div className="bg-card rounded-lg p-4">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Ordem de execução recomendada</p>
            <div className="grid md:grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-red-400 font-bold shrink-0">1°</span>
                <span>Converter imagens para WebP + lazy loading → maior ganho de LCP</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-400 font-bold shrink-0">2°</span>
                <span>Remover animações pesadas do hero → reduz TBT imediatamente</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-400 font-bold shrink-0">3°</span>
                <span>Code splitting por rota → reduz bundle inicial e melhora FCP</span>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Histórico Core Web Vitals */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            Histórico Core Web Vitals — Evolução ao Longo do Tempo
            <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded px-2 py-0.5 ml-1">Dados acumulados por auditoria</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Explicativo */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-xs">
              Cada ponto no gráfico representa uma auditoria realizada via botão "Auditar agora" na tabela acima.
              Acompanhe a evolução do LCP, FID/TBT e CLS ao longo do tempo para medir o impacto das otimizações no Lovable.
            </p>
          </div>

          {/* Gráfico LCP */}
          {(() => {
            const pages = (data?.pages ?? []) as any[];
            const historyData = pages
              .filter((p: any) => p.history && p.history.length > 0)
              .flatMap((p: any) =>
                (p.history ?? []).map((h: any) => ({
                  date: new Date(h.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
                  timestamp: h.timestamp,
                  lcp: h.lcp ? Math.round(h.lcp / 100) / 10 : null,
                  tbt: h.tbt ? Math.round(h.tbt) : null,
                  cls: h.cls ? Math.round(h.cls * 1000) / 1000 : null,
                  score: h.score ?? null,
                  page: p.url?.replace("https://zenitetech.com", "") || p.url,
                }))
              )
              .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            if (historyData.length === 0) {
              return (
                <div className="text-center py-10 border border-dashed border-border rounded-xl">
                  <History className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm font-medium">Nenhum histórico ainda</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Clique em "Auditar agora" nas páginas acima para começar a acumular dados históricos.
                  </p>
                  <p className="text-gray-600 text-xs mt-2">
                    Após cada otimização no Lovable, realize uma nova auditoria para medir o impacto.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {/* LCP */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-foreground">LCP — Largest Contentful Paint (segundos)</span>
                    <span className="text-xs text-muted-foreground">Meta: &lt; 2.5s</span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={historyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} tickFormatter={v => `${v}s`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                        labelStyle={{ color: "#F9FAFB" }}
                        formatter={(v: number) => [`${v}s`, "LCP"]}
                      />
                      <ReferenceLine y={2.5} stroke="#10B981" strokeDasharray="4 4" label={{ value: "Meta 2.5s", fill: "#10B981", fontSize: 10 }} />
                      <ReferenceLine y={4.0} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: "Limite 4s", fill: "#F59E0B", fontSize: 10 }} />
                      <Line type="monotone" dataKey="lcp" name="LCP" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4, fill: "#8B5CF6" }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Score */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-foreground">Score de Performance (0-100)</span>
                    <span className="text-xs text-muted-foreground">Meta: &gt; 90</span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={historyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                        labelStyle={{ color: "#F9FAFB" }}
                      />
                      <ReferenceLine y={90} stroke="#10B981" strokeDasharray="4 4" label={{ value: "Meta 90", fill: "#10B981", fontSize: 10 }} />
                      <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: "Limite 50", fill: "#F59E0B", fontSize: 10 }} />
                      <Line type="monotone" dataKey="score" name="Score" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4, fill: "#3B82F6" }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Tabela de auditoria */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-3">Detalhamento por Auditoria</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-muted-foreground font-medium px-3 py-2">Data</th>
                          <th className="text-left text-muted-foreground font-medium px-3 py-2">Página</th>
                          <th className="text-right text-muted-foreground font-medium px-3 py-2">Score</th>
                          <th className="text-right text-muted-foreground font-medium px-3 py-2">LCP</th>
                          <th className="text-right text-muted-foreground font-medium px-3 py-2">TBT</th>
                          <th className="text-right text-muted-foreground font-medium px-3 py-2">CLS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.slice(-20).reverse().map((h: any, i: number) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="px-3 py-2 text-muted-foreground">{h.date}</td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{h.page || "/"}</td>
                            <td className="px-3 py-2 text-right">
                              {h.score !== null ? (
                                <span className={`font-bold ${
                                  h.score >= 90 ? "text-green-400" : h.score >= 50 ? "text-yellow-400" : "text-red-400"
                                }`}>{h.score}</span>
                              ) : <span className="text-gray-600">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {h.lcp !== null ? (
                                <span className={h.lcp <= 2.5 ? "text-green-400" : h.lcp <= 4 ? "text-yellow-400" : "text-red-400"}>
                                  {h.lcp}s
                                </span>
                              ) : <span className="text-gray-600">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {h.tbt !== null ? (
                                <span className={h.tbt <= 200 ? "text-green-400" : h.tbt <= 600 ? "text-yellow-400" : "text-red-400"}>
                                  {h.tbt}ms
                                </span>
                              ) : <span className="text-gray-600">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {h.cls !== null ? (
                                <span className={h.cls <= 0.1 ? "text-green-400" : h.cls <= 0.25 ? "text-yellow-400" : "text-red-400"}>
                                  {h.cls}
                                </span>
                              ) : <span className="text-gray-600">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Monitoramento Automático - dados do job a cada 1h */}
          {autoHistory && autoHistory.length > 0 && (() => {
            const urls: string[] = Array.from(new Set(autoHistory.map((h: any) => h.url as string)));
            const chartData = autoHistory
              .filter((h: any) => h.device === strategy)
              .reduce((acc: any[], h: any) => {
                const label = new Date(h.measuredAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
                const existing = acc.find((a: any) => a.label === label);
                const key = h.url.replace("https://zenitetech.com", "") || "/";
                if (existing) { existing[key] = h.performanceScore; }
                else { acc.push({ label, [key]: h.performanceScore, ts: h.measuredAt }); }
                return acc;
              }, [])
              .sort((a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
              .slice(-24);
            const pageKeys: string[] = Array.from(new Set(autoHistory.filter((h: any) => h.device === strategy).map((h: any) => (h.url.replace("https://zenitetech.com", "") || "/") as string)));
            const COLORS = ["#8B5CF6", "#10B981", "#F59E0B", "#3B82F6", "#EF4444"];
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground text-xs font-semibold flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      Monitoramento Automatico - Score {strategy === "mobile" ? "Mobile" : "Desktop"} (ultimas 48h)
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">Job automático a cada 1h - {autoHistory.filter((h: any) => h.device === strategy).length} medicoes</p>
                  </div>
                  <button
                    onClick={() => triggerMeasurement.mutate()}
                    disabled={triggerMeasurement.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-foreground text-xs rounded-lg disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${triggerMeasurement.isPending ? "animate-spin" : ""}`} />
                    Medir agora
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                      labelStyle={{ color: "#F9FAFB", fontSize: 11 }}
                    />
                    <ReferenceLine y={90} stroke="#10B981" strokeDasharray="4 4" />
                    <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="4 4" />
                    {(pageKeys as string[]).map((key: string, i: number) => (
                      <Line key={key} type="monotone" dataKey={key} name={key || "/"} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 10, color: "#9CA3AF" }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(urls as string[]).map((url: string) => {
                    const latest = autoHistory.filter((h: any) => h.url === url && h.device === strategy).sort((a: any, b: any) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())[0];
                    if (!latest) return null;
                    const label = url.replace("https://zenitetech.com", "") || "/";
                    return (
                      <div key={url} className="bg-muted/60 border border-border rounded-lg p-3">
                        <p className="text-muted-foreground text-xs truncate">{label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-lg font-bold ${latest.performanceScore >= 90 ? "text-green-400" : latest.performanceScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>{latest.performanceScore}</span>
                          {latest.lcpMs && <span className="text-muted-foreground text-xs">LCP {(latest.lcpMs/1000).toFixed(1)}s</span>}
                        </div>
                        <p className="text-gray-600 text-xs mt-0.5">{new Date(latest.measuredAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {/* Como usar */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <p className="text-blue-400 text-xs font-semibold mb-2">Como acompanhar a evolução</p>
            <ol className="text-muted-foreground text-xs space-y-1 list-decimal list-inside">
              <li>Implemente uma melhoria no Lovable (ex: converter imagens para WebP)</li>
              <li>Aguarde o deploy ser concluído (2-5 minutos)</li>
              <li>Clique em "Auditar agora" na página que foi otimizada</li>
              <li>O novo resultado aparecerá no gráfico acima como um novo ponto</li>
              <li>Compare o antes/depois para medir o impacto real da otimização</li>
            </ol>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
