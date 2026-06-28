/**
 * Página: Gestão Semanal de Tráfego Pago
 * Visão holística de todas as campanhas como gestor de tráfego.
 * Inclui: relatório executivo, análise de landing pages, prompts para Lovable,
 * monitoramento de URLs e ações prioritárias da semana.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, CheckCircle, Clock, Copy, ExternalLink, Globe,
  RefreshCw, TrendingDown, TrendingUp, Zap, BarChart3, FileText,
  ArrowUpRight, ArrowDownRight, Play, CalendarCheck, Target,
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPriorityBadge(priority: string) {
  const map: Record<string, { label: string; className: string }> = {
    critical: { label: "Crítico", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    high: { label: "Alta", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    medium: { label: "Média", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    low: { label: "Baixa", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  };
  const item = map[priority] || map.medium;
  return <Badge variant="outline" className={item.className}>{item.label}</Badge>;
}

function getScoreColor(score: number) {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 25) return "text-orange-400";
  return "text-red-400";
}

function getScoreBarColor(score: number) {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-red-500";
}

// ─── Componente: Card de Análise de LP ───────────────────────────────────────

function LandingPageCard({ analysis }: { analysis: any }) {
  const [copied, setCopied] = useState(false);
  const copyPrompt = () => {
    if (!analysis.lovablePrompt) return;
    navigator.clipboard.writeText(analysis.lovablePrompt);
    setCopied(true);
    toast.success("Prompt copiado! Cole no chat do Lovable.");
    setTimeout(() => setCopied(false), 2500);
  };

  const issues: string[] = Array.isArray(analysis.mainIssues) ? analysis.mainIssues : [];

  return (
    <Card className="bg-slate-800/60 border-slate-700/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-sm font-semibold text-white truncate">
                {analysis.adGroupName}
              </CardTitle>
              {getPriorityBadge(analysis.priority || "medium")}
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">{analysis.url}</p>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className={`text-2xl font-bold ${getScoreColor(analysis.diagnosisScore || 0)}`}>
              {analysis.diagnosisScore || 0}
            </span>
            <span className="text-xs text-slate-500">/100</span>
          </div>
        </div>
        <div className="mt-2">
          <Progress value={analysis.diagnosisScore || 0} className="h-1.5 bg-slate-700" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Métricas do grupo */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "CTR", value: `${analysis.groupCtr || "0"}%` },
            { label: "CPC", value: `R$${analysis.groupCpc || "0"}` },
            { label: "Conv.", value: analysis.groupConversions || 0 },
            { label: "Cliques", value: analysis.groupClicks || 0 },
          ].map(m => (
            <div key={m.label} className="bg-slate-900/50 rounded p-2 text-center">
              <div className="text-xs text-slate-400">{m.label}</div>
              <div className="text-sm font-semibold text-white">{m.value}</div>
            </div>
          ))}
        </div>

        {/* PageSpeed */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 bg-slate-900/50 rounded p-2">
            <span className="text-xs text-slate-400">Mobile</span>
            <span className={`text-sm font-bold ${getScoreColor(analysis.pagespeedMobile || 0)}`}>
              {analysis.pagespeedMobile || "—"}/100
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/50 rounded p-2">
            <span className="text-xs text-slate-400">Desktop</span>
            <span className={`text-sm font-bold ${getScoreColor(analysis.pagespeedDesktop || 0)}`}>
              {analysis.pagespeedDesktop || "—"}/100
            </span>
          </div>
        </div>

        {/* Diagnóstico */}
        {analysis.diagnosisSummary && (
          <p className="text-xs text-slate-300 leading-relaxed">{analysis.diagnosisSummary}</p>
        )}

        {/* Problemas identificados */}
        {issues.length > 0 && (
          <div className="space-y-1">
            {issues.map((issue: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 text-orange-400 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-300">{issue}</span>
              </div>
            ))}
          </div>
        )}

        {/* Botão copiar prompt Lovable */}
        {analysis.lovablePrompt && (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-blue-500/40 text-blue-400 hover:bg-blue-500/10 text-xs"
            onClick={copyPrompt}
          >
            {copied ? (
              <><CheckCircle className="w-3 h-3 mr-1" /> Copiado!</>
            ) : (
              <><Copy className="w-3 h-3 mr-1" /> Copiar Prompt para o Lovable</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function GestaoSemanal() {
  const [activeTab, setActiveTab] = useState("relatorio");

  // Queries
  const { data: reviewData, isLoading: reviewLoading, refetch: refetchReview } =
    trpc.gestaoSemanal.getWeeklyReview.useQuery();

  const { data: lpData, isLoading: lpLoading, refetch: refetchLp } =
    trpc.gestaoSemanal.getLandingPageAnalyses.useQuery();

  // Mutations
  const generateReview = trpc.gestaoSemanal.generateWeeklyReview.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`✅ Relatório gerado! Semana ${data.weekLabel} analisada.`);
        refetchReview();
      } else {
        toast.error(data.error || "Falha ao gerar relatório");
      }
    },
  });

  const triggerLpAnalysis = trpc.gestaoSemanal.triggerLandingPageAnalysis.useMutation({
    onSuccess: (data) => {
      toast.info(`🔍 ${data.message}`);
      setTimeout(() => refetchLp(), 10000);
    },
  });

  const triggerUrlMonitor = trpc.gestaoSemanal.triggerUrlMonitor.useMutation({
    onSuccess: (data) => {
       toast.info(`🔗 ${data.message}`);
    },
  });

  // Processar dados
  const analyses = lpData?.analyses || [];
  const weekLabel = lpData?.weekLabel || reviewData?.weekLabel || "";
  const review = reviewData;

  const topPerformers: any[] = Array.isArray(review?.topPerformers) ? review.topPerformers : [];
  const underperformers: any[] = Array.isArray(review?.underperformers) ? review.underperformers : [];
  const urgentActions: string[] = Array.isArray(review?.urgentActions) ? review.urgentActions : [];
  const weeklyActions: string[] = Array.isArray(review?.weeklyActions) ? review.weeklyActions : [];

  const criticalLps = analyses.filter(a => a.priority === "critical");
  const highLps = analyses.filter(a => a.priority === "high");
  const avgLpScore = analyses.length
    ? Math.round(analyses.reduce((s, a) => s + (a.diagnosisScore || 0), 0) / analyses.length)
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Gestão Semanal de Tráfego</h1>
            {weekLabel && (
              <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">{weekLabel}</Badge>
            )}
          </div>
          <p className="text-sm text-slate-400">
            Visão holística das campanhas · Análise de landing pages · Prompts prontos para o Lovable
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
            onClick={() => triggerUrlMonitor.mutate()}
            disabled={triggerUrlMonitor.isPending}
          >
            <Globe className="w-3 h-3 mr-1" />
            Verificar URLs
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-purple-500/40 text-purple-400 hover:bg-purple-500/10 text-xs"
            onClick={() => triggerLpAnalysis.mutate()}
            disabled={triggerLpAnalysis.isPending}
          >
            <Play className="w-3 h-3 mr-1" />
            Analisar LPs
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
            onClick={() => generateReview.mutate()}
            disabled={generateReview.isPending}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${generateReview.isPending ? "animate-spin" : ""}`} />
            {generateReview.isPending ? "Gerando..." : "Gerar Relatório"}
          </Button>
        </div>
      </div>

      {/* KPIs rápidos */}
      {review && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Gasto Total", value: `R$ ${review.totalSpend || "0"}`, icon: BarChart3, color: "text-blue-400" },
            { label: "Cliques", value: (review.totalClicks || 0).toLocaleString(), icon: Target, color: "text-green-400" },
            { label: "Conversões", value: review.totalConversions || 0, icon: CheckCircle, color: "text-emerald-400" },
            { label: "CTR Médio", value: `${review.avgCtr || "0"}%`, icon: TrendingUp, color: "text-yellow-400" },
            { label: "CPC Médio", value: `R$ ${review.avgCpc || "0"}`, icon: Zap, color: "text-orange-400" },
          ].map(kpi => (
            <Card key={kpi.label} className="bg-slate-800/60 border-slate-700/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                  <span className="text-xs text-slate-400">{kpi.label}</span>
                </div>
                <div className="text-lg font-bold text-white">{kpi.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Alertas de urgência */}
      {urgentActions.length > 0 && (
        <Card className="bg-red-900/20 border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Ações Urgentes ({urgentActions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {urgentActions.map((action, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-red-400 text-xs font-bold mt-0.5">{i + 1}.</span>
                  <span className="text-sm text-red-200">{action}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="relatorio" className="text-xs text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">📊 Relatório Executivo</TabsTrigger>
          <TabsTrigger value="landing-pages" className="text-xs text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            🎯 Landing Pages
            {(criticalLps.length + highLps.length) > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {criticalLps.length + highLps.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="acoes" className="text-xs text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">✅ Ações da Semana</TabsTrigger>
        </TabsList>

        {/* Tab: Relatório Executivo */}
        <TabsContent value="relatorio" className="mt-4 space-y-4">
          {reviewLoading ? (
            <div className="text-center py-12 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Carregando relatório...
            </div>
          ) : !review ? (
            <Card className="bg-slate-800/60 border-slate-700/50">
              <CardContent className="py-12 text-center">
                <CalendarCheck className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 mb-4">Nenhum relatório gerado ainda esta semana.</p>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => generateReview.mutate()}
                  disabled={generateReview.isPending}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${generateReview.isPending ? "animate-spin" : ""}`} />
                  Gerar Relatório Agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Resumo executivo */}
              {review.executiveSummary && (
                <Card className="bg-slate-800/60 border-slate-700/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      Resumo Executivo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-slate-200 leading-relaxed">{review.executiveSummary}</p>
                  </CardContent>
                </Card>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {/* Top performers */}
                {topPerformers.length > 0 && (
                  <Card className="bg-slate-800/60 border-slate-700/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-400 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Top Performers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {topPerformers.map((p: any, i: number) => (
                        <div key={i} className="border-l-2 border-green-500/50 pl-3">
                          <div className="flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3 text-green-400" />
                            <span className="text-sm font-medium text-white">{p.name}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{p.reason}</p>
                          <p className="text-xs text-green-400 mt-0.5">→ {p.action}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Underperformers */}
                {underperformers.length > 0 && (
                  <Card className="bg-slate-800/60 border-slate-700/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-orange-400 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        Precisam de Atenção
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {underperformers.map((p: any, i: number) => (
                        <div key={i} className="border-l-2 border-orange-500/50 pl-3">
                          <div className="flex items-center gap-1">
                            <ArrowDownRight className="w-3 h-3 text-orange-400" />
                            <span className="text-sm font-medium text-white">{p.name}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{p.problem}</p>
                          <p className="text-xs text-orange-400 mt-0.5">→ {p.action}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Performance Max */}
              {review.pmaxDiagnosis && (
                <Card className="bg-slate-800/60 border-slate-700/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-purple-400 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Performance Max — Diagnóstico
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-slate-200 leading-relaxed">{review.pmaxDiagnosis}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab: Landing Pages */}
        <TabsContent value="landing-pages" className="mt-4 space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-slate-800/60 border-slate-700/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-white">{analyses.length}</div>
                <div className="text-xs text-slate-400">LPs Analisadas</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700/50">
              <CardContent className="p-3 text-center">
                <div className={`text-2xl font-bold ${getScoreColor(avgLpScore)}`}>{avgLpScore}</div>
                <div className="text-xs text-slate-400">Score Médio</div>
              </CardContent>
            </Card>
            <Card className="bg-red-900/20 border-red-500/30">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{criticalLps.length + highLps.length}</div>
                <div className="text-xs text-red-400">Críticas + Alta Prioridade</div>
              </CardContent>
            </Card>
          </div>

          {lpLoading ? (
            <div className="text-center py-12 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Carregando análises...
            </div>
          ) : analyses.length === 0 ? (
            <Card className="bg-slate-800/60 border-slate-700/50">
              <CardContent className="py-12 text-center">
                <Globe className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 mb-2">Nenhuma análise de landing page disponível.</p>
                <p className="text-xs text-slate-500 mb-4">
                  O job automático roda toda segunda às 9h30. Você pode disparar manualmente agora.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-purple-500/40 text-purple-400 hover:bg-purple-500/10"
                  onClick={() => triggerLpAnalysis.mutate()}
                  disabled={triggerLpAnalysis.isPending}
                >
                  <Play className="w-3 h-3 mr-1" />
                  Analisar Landing Pages Agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Críticas primeiro */}
              {criticalLps.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Críticas — Ação Imediata
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {criticalLps.map(a => <LandingPageCard key={a.id} analysis={a} />)}
                  </div>
                </div>
              )}

              {/* Alta prioridade */}
              {highLps.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Alta Prioridade — Esta Semana
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {highLps.map(a => <LandingPageCard key={a.id} analysis={a} />)}
                  </div>
                </div>
              )}

              {/* Demais */}
              {analyses.filter(a => a.priority !== "critical" && a.priority !== "high").length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 mb-3">Demais Landing Pages</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analyses
                      .filter(a => a.priority !== "critical" && a.priority !== "high")
                      .map(a => <LandingPageCard key={a.id} analysis={a} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Tab: Ações da Semana */}
        <TabsContent value="acoes" className="mt-4 space-y-4">
          {weeklyActions.length === 0 && urgentActions.length === 0 ? (
            <Card className="bg-slate-800/60 border-slate-700/50">
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 mb-4">Gere o relatório semanal para ver as ações recomendadas.</p>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => { generateReview.mutate(); setActiveTab("relatorio"); }}
                  disabled={generateReview.isPending}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${generateReview.isPending ? "animate-spin" : ""}`} />
                  Gerar Relatório
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {urgentActions.length > 0 && (
                <Card className="bg-red-900/20 border-red-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Urgente — Fazer Hoje
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {urgentActions.map((action, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 bg-red-900/20 rounded">
                        <span className="text-red-400 font-bold text-sm shrink-0">{i + 1}.</span>
                        <span className="text-sm text-red-200">{action}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {weeklyActions.length > 0 && (
                <Card className="bg-slate-800/60 border-slate-700/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-400 flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4" />
                      Ações da Semana
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {weeklyActions.map((action, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 bg-slate-900/40 rounded">
                        <CheckCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-200">{action}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Instruções para o Lovable */}
              {analyses.filter(a => a.lovablePrompt).length > 0 && (
                <Card className="bg-purple-900/20 border-purple-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-purple-400 flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Como Aplicar no Lovable
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ol className="space-y-2 text-sm text-slate-300">
                      <li className="flex gap-2"><span className="text-purple-400 font-bold">1.</span>Acesse a aba "Landing Pages" acima</li>
                      <li className="flex gap-2"><span className="text-purple-400 font-bold">2.</span>Clique em "Copiar Prompt para o Lovable" na LP desejada</li>
                      <li className="flex gap-2"><span className="text-purple-400 font-bold">3.</span>Abra o Lovable e cole o prompt no chat</li>
                      <li className="flex gap-2"><span className="text-purple-400 font-bold">4.</span>O Lovable aplicará as melhorias automaticamente</li>
                      <li className="flex gap-2"><span className="text-purple-400 font-bold">5.</span>Publique e aguarde o PageSpeed ser atualizado</li>
                    </ol>
                    <p className="text-xs text-purple-300 mt-3">
                      {analyses.filter(a => a.lovablePrompt).length} prompt(s) disponíveis esta semana
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
