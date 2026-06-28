import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle,
  Send, Calendar, BarChart3, ExternalLink, Info, Zap, FileSearch, TrendingUp, Wifi, WifiOff,
  MousePointerClick, Eye, Search, MapPin
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, BarChart, Bar
} from "recharts";

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatRelative(d: Date | string | null) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

function fmtCtr(v: number) {
  return (v * 100).toFixed(1) + "%";
}

function fmtPos(v: number) {
  return v.toFixed(1);
}

export default function IndexingMonitor() {
  const [isPinging, setIsPinging] = useState(false);
  const [scDays, setScDays] = useState(28);
  const [scDevice, setScDevice] = useState<"ALL" | "DESKTOP" | "MOBILE" | "TABLET">("ALL");
  const [showComparison, setShowComparison] = useState(false);

  // Existing indexing queries
  const { data: history, refetch: refetchHistory } = trpc.indexing.getPingHistory.useQuery({ limit: 30 });
  const { data: snapshot } = trpc.indexing.getSearchConsoleSnapshot.useQuery();
  const { data: urlStatus, refetch: refetchUrls, isLoading: loadingUrls } = trpc.indexing.getUrlStatus.useQuery();
  const { data: scheduleConfig } = trpc.indexing.getScheduleConfig.useQuery();
  const { data: trendData } = trpc.indexing.getIndexingTrend.useQuery();

  // NEW: Real Search Console API queries
  const { data: scSummary, isLoading: loadingSummary, refetch: refetchSummary } =
    trpc.searchConsole.getPerformanceSummary.useQuery({ days: scDays, device: scDevice });
  const { data: scTrend, isLoading: loadingTrend, refetch: refetchTrend } =
    trpc.searchConsole.getClickTrend.useQuery({ days: scDays, device: scDevice });
  const { data: scQueries, isLoading: loadingQueries, refetch: refetchQueries } =
    trpc.searchConsole.getTopQueries.useQuery({ days: scDays, limit: 10, device: scDevice });
  const { data: scPages, isLoading: loadingPages, refetch: refetchPages } =
    trpc.searchConsole.getTopPages.useQuery({ days: scDays, limit: 8, device: scDevice });
  const { data: scComparison, isLoading: loadingComparison } =
    trpc.searchConsole.getPeriodComparison.useQuery(
      { days: scDays, device: scDevice },
      { enabled: showComparison }
    );

  const pingSitemap = trpc.indexing.pingSitemap.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("✅ Ping enviado com sucesso!", { description: data.results.map(r => r.message).join(" | ") });
      } else {
        toast.error("⚠️ Ping com erros", { description: data.results.map(r => r.message).join(" | ") });
      }
      refetchHistory();
      setIsPinging(false);
    },
    onError: (err) => {
      toast.error("Erro ao enviar ping", { description: err.message });
      setIsPinging(false);
    },
  });

  const handlePing = () => {
    setIsPinging(true);
    pingSitemap.mutate({ engines: ["google", "bing"], triggeredBy: "manual" });
  };

  const handleRefreshSC = () => {
    refetchSummary();
    refetchTrend();
    refetchQueries();
    refetchPages();
  };

  // CSV export helpers
  const exportQueriesCSV = useCallback(() => {
    if (!scQueries?.data?.length) return;
    const header = "Termo,Cliques,Impressões,CTR (%),Posição Média";
    const rows = scQueries.data.map(q =>
      `"${q.query}",${q.clicks},${q.impressions},${(q.ctr * 100).toFixed(2)},${q.position.toFixed(1)}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `search-console-queries-${scDays}d-${scDevice.toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [scQueries, scDays, scDevice]);

  const exportPagesCSV = useCallback(() => {
    if (!scPages?.data?.length) return;
    const header = "Página,Cliques,Impressões,CTR (%),Posição Média";
    const rows = scPages.data.map(p =>
      `"${p.page}",${p.clicks},${p.impressions},${(p.ctr * 100).toFixed(2)},${p.position.toFixed(1)}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `search-console-pages-${scDays}d-${scDevice.toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [scPages, scDays, scDevice]);

  const severityColor = {
    high: "bg-red-500/10 text-red-400 border-red-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };

  const indexRate = snapshot ? Math.round((snapshot.indexedPages / snapshot.totalPages) * 100) : 0;

  const dayOptions = [7, 14, 28, 90];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSearch className="w-6 h-6 text-blue-400" />
            Monitoramento de Indexação
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            zenitetech.com — Google Search Console + Ping automático do sitemap
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchUrls(); refetchHistory(); }}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={handlePing}
            disabled={isPinging}
            className="bg-blue-600 hover:bg-blue-700 text-foreground"
          >
            {isPinging ? (
              <><RefreshCw className="w-4 h-4 mr-1 animate-spin" />Enviando...</>
            ) : (
              <><Send className="w-4 h-4 mr-1" />Ping Agora</>
            )}
          </Button>
        </div>
      </div>

      {/* Cards de resumo de indexação */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">Páginas Indexadas</div>
            <div className="text-2xl font-bold text-green-400">{snapshot?.indexedPages ?? "—"}</div>
            <div className="text-muted-foreground text-xs">de {snapshot?.totalPages ?? "—"} total ({indexRate}%)</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">Não Indexadas</div>
            <div className="text-2xl font-bold text-red-400">{snapshot?.notIndexedPages ?? "—"}</div>
            <div className="text-muted-foreground text-xs">aguardando correção</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">Último Ping</div>
            <div className="text-lg font-bold text-blue-400">
              {history?.lastPing ? formatRelative(history.lastPing.timestamp) : "Nunca"}
            </div>
            <div className="text-muted-foreground text-xs">
              {history?.lastPing?.status === "success" ? "✅ Sucesso" : history?.lastPing ? "❌ Erro" : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">Próximo Ping Auto</div>
            <div className="text-lg font-bold text-purple-400">
              {scheduleConfig ? formatDate(scheduleConfig.nextRun) : "—"}
            </div>
            <div className="text-muted-foreground text-xs">diário às 08:00 BRT</div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SEÇÃO: PERFORMANCE ORGÂNICA — SEARCH CONSOLE API (DADOS REAIS)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="border border-blue-500/20 rounded-xl p-1">
        <div className="bg-blue-500/5 rounded-xl p-4 space-y-4">
          {/* Header da seção */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-400" />
                <h2 className="text-foreground font-semibold text-base">Performance Orgânica — Google Search Console</h2>
                {scSummary?.isReal ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> Dados reais
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> Sem dados
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshSC}
                className="border-border text-muted-foreground hover:bg-muted h-7 text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Atualizar
              </Button>
            </div>

            {/* Filtros: período + dispositivo + comparação */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Período */}
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-xs mr-1">Período:</span>
                {dayOptions.map(d => (
                  <button
                    key={d}
                    onClick={() => setScDays(d)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      scDays === d
                        ? "bg-blue-600 text-foreground"
                        : "bg-muted text-muted-foreground hover:bg-gray-700"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>

              {/* Dispositivo */}
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-xs mr-1">Dispositivo:</span>
                {(["ALL", "DESKTOP", "MOBILE", "TABLET"] as const).map(dev => (
                  <button
                    key={dev}
                    onClick={() => setScDevice(dev)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      scDevice === dev
                        ? "bg-purple-600 text-foreground"
                        : "bg-muted text-muted-foreground hover:bg-gray-700"
                    }`}
                  >
                    {dev === "ALL" ? "Todos" : dev === "DESKTOP" ? "Desktop" : dev === "MOBILE" ? "Mobile" : "Tablet"}
                  </button>
                ))}
              </div>

              {/* Comparação de períodos */}
              <button
                onClick={() => setShowComparison(v => !v)}
                className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                  showComparison
                    ? "bg-green-600 text-foreground"
                    : "bg-muted text-muted-foreground hover:bg-gray-700"
                }`}
              >
                <BarChart3 className="w-3 h-3" />
                {showComparison ? "Ocultar comparação" : "Comparar períodos"}
              </button>
            </div>
          </div>

          {/* KPIs do Search Console */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <MousePointerClick className="w-3 h-3" /> Cliques Orgânicos
              </div>
              {loadingSummary ? (
                <div className="h-7 w-16 bg-muted rounded animate-pulse" />
              ) : (
                <div className="text-2xl font-bold text-green-400">
                  {scSummary?.totalClicks?.toLocaleString("pt-BR") ?? "—"}
                </div>
              )}
              <div className="text-muted-foreground text-xs">últimos {scDays} dias</div>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <Eye className="w-3 h-3" /> Impressões
              </div>
              {loadingSummary ? (
                <div className="h-7 w-16 bg-muted rounded animate-pulse" />
              ) : (
                <div className="text-2xl font-bold text-blue-400">
                  {scSummary?.totalImpressions?.toLocaleString("pt-BR") ?? "—"}
                </div>
              )}
              <div className="text-muted-foreground text-xs">últimos {scDays} dias</div>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <TrendingUp className="w-3 h-3" /> CTR Médio
              </div>
              {loadingSummary ? (
                <div className="h-7 w-16 bg-muted rounded animate-pulse" />
              ) : (
                <div className="text-2xl font-bold text-yellow-400">
                  {scSummary?.avgCtr != null ? fmtCtr(scSummary.avgCtr) : "—"}
                </div>
              )}
              <div className="text-muted-foreground text-xs">taxa de clique</div>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <MapPin className="w-3 h-3" /> Posição Média
              </div>
              {loadingSummary ? (
                <div className="h-7 w-16 bg-muted rounded animate-pulse" />
              ) : (
                <div className={`text-2xl font-bold ${
                  (scSummary?.avgPosition ?? 99) <= 10 ? "text-green-400" :
                  (scSummary?.avgPosition ?? 99) <= 20 ? "text-yellow-400" : "text-red-400"
                }`}>
                  {scSummary?.avgPosition != null ? fmtPos(scSummary.avgPosition) : "—"}
                </div>
              )}
              <div className="text-muted-foreground text-xs">ranking orgânico</div>
            </div>
          </div>

          {/* Gráfico de tendência de cliques */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                Tendência de Cliques e Impressões Orgânicas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTrend ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Carregando dados...
                </div>
              ) : (scTrend?.data && scTrend.data.length > 0) ? (
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scTrend.data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} interval={Math.floor((scTrend.data.length - 1) / 6)} />
                      <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                        labelStyle={{ color: "#f3f4f6" }}
                        itemStyle={{ color: "#d1d5db" }}
                      />
                      <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
                      <Line yAxisId="left" type="monotone" dataKey="clicks" name="Cliques" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impressões" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                  <WifiOff className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">Sem dados de tendência disponíveis</p>
                  <p className="text-xs mt-1 text-gray-600">Verifique se a Service Account tem acesso ao Search Console</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico comparativo de períodos */}
          {showComparison && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-green-400" />
                  Comparação de Períodos — Cliques Orgânicos
                  <span className="text-muted-foreground text-xs font-normal">
                    Período atual vs. período anterior ({scDays} dias cada)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingComparison ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Carregando comparação...
                  </div>
                ) : (scComparison?.current && scComparison.current.length > 0) ? (
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="date"
                          type="category"
                          allowDuplicatedCategory={false}
                          tick={{ fill: "#9ca3af", fontSize: 10 }}
                        />
                        <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                          labelStyle={{ color: "#f3f4f6" }}
                          itemStyle={{ color: "#d1d5db" }}
                        />
                        <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
                        <Line
                          data={scComparison.current}
                          type="monotone"
                          dataKey="clicks"
                          name={`Período atual (${scDays}d)`}
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          data={scComparison.previous}
                          type="monotone"
                          dataKey="clicks"
                          name={`Período anterior (${scDays}d)`}
                          stroke="#6b7280"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                    <BarChart3 className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">Sem dados de comparação disponíveis</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Top Queries e Top Pages lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Queries */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm flex items-center gap-2">
                    <Search className="w-4 h-4 text-purple-400" />
                    Top Termos de Busca
                  </CardTitle>
                  <button
                    onClick={exportQueriesCSV}
                    disabled={!scQueries?.data?.length}
                    className="text-xs text-muted-foreground hover:text-green-400 transition-colors flex items-center gap-1 disabled:opacity-40"
                    title="Exportar CSV"
                  >
                    ↓ CSV
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingQueries ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-8 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : (scQueries?.data && scQueries.data.length > 0) ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left py-1.5 pr-2">Termo</th>
                          <th className="text-center py-1.5 pr-2">Cliques</th>
                          <th className="text-center py-1.5 pr-2">CTR</th>
                          <th className="text-center py-1.5">Pos.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scQueries.data.map((q, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-1.5 pr-2 text-muted-foreground max-w-[140px] truncate" title={q.query}>
                              {q.query}
                            </td>
                            <td className="py-1.5 pr-2 text-center text-green-400 font-medium">{q.clicks}</td>
                            <td className="py-1.5 pr-2 text-center text-yellow-400">{fmtCtr(q.ctr)}</td>
                            <td className="py-1.5 text-center">
                              <span className={`font-medium ${
                                q.position <= 10 ? "text-green-400" :
                                q.position <= 20 ? "text-yellow-400" : "text-red-400"
                              }`}>
                                #{fmtPos(q.position)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <Search className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">Sem dados de queries disponíveis</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Pages */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    Top Páginas por Cliques
                  </CardTitle>
                  <button
                    onClick={exportPagesCSV}
                    disabled={!scPages?.data?.length}
                    className="text-xs text-muted-foreground hover:text-green-400 transition-colors flex items-center gap-1 disabled:opacity-40"
                    title="Exportar CSV"
                  >
                    ↓ CSV
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPages ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-8 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : (scPages?.data && scPages.data.length > 0) ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left py-1.5 pr-2">Página</th>
                          <th className="text-center py-1.5 pr-2">Cliques</th>
                          <th className="text-center py-1.5 pr-2">CTR</th>
                          <th className="text-center py-1.5">Pos.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scPages.data.map((p, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-1.5 pr-2">
                              <a
                                href={p.page}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline flex items-center gap-1 max-w-[140px] truncate"
                                title={p.page}
                              >
                                {p.page.replace("https://zenitetech.com", "") || "/"}
                                <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                              </a>
                            </td>
                            <td className="py-1.5 pr-2 text-center text-green-400 font-medium">{p.clicks}</td>
                            <td className="py-1.5 pr-2 text-center text-yellow-400">{fmtCtr(p.ctr)}</td>
                            <td className="py-1.5 text-center">
                              <span className={`font-medium ${
                                p.position <= 10 ? "text-green-400" :
                                p.position <= 20 ? "text-yellow-400" : "text-red-400"
                              }`}>
                                #{fmtPos(p.position)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <Globe className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">Sem dados de páginas disponíveis</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Nota de fonte de dados */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-blue-400" />
            <span>
              Dados coletados via <strong className="text-muted-foreground">Google Search Console API</strong> em tempo real.
              Service Account: <code className="text-blue-400">ga4-analytics-reader@manus-g-ads.iam.gserviceaccount.com</code>.
              {!scSummary?.isReal && " Verifique se a Service Account tem permissão de leitura no Search Console."}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SEÇÃO: INDEXAÇÃO (DADOS DO SNAPSHOT / STATIC)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Motivos de não indexação */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              Motivos de Não Indexação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot?.reasons.map((r, i) => (
              <div key={i} className={`rounded-lg border p-3 ${severityColor[r.severity]}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{r.reason}</span>
                  <Badge variant="outline" className="text-xs border-current">
                    {r.count} páginas
                  </Badge>
                </div>
                <p className="text-xs opacity-80 mb-1">{r.description}</p>
                <p className="text-xs font-medium">🔧 {r.fix}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Status do sitemap + automação */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                Automação Agendada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Status</span>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  ✅ Ativo — Diário 08:00 BRT
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Motores</span>
                <span className="text-foreground text-sm">Google + Bing</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Sitemap</span>
                <a
                  href="https://zenitetech.com/sitemap.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 text-xs flex items-center gap-1 hover:underline"
                >
                  /sitemap.xml <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Próxima execução</span>
                <span className="text-purple-400 text-sm">{scheduleConfig ? formatDate(scheduleConfig.nextRun) : "—"}</span>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 mt-2">
                <p className="text-blue-300 text-xs flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  O ping notifica o Google que o sitemap foi atualizado. Não garante indexação imediata, mas acelera o rastreamento de novas páginas.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-green-400" />
                Sitemap no Search Console
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">URLs no sitemap</span>
                <span className="text-foreground text-sm">{snapshot?.sitemapStatus.urlsInSitemap ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">URLs indexadas</span>
                <span className="text-green-400 text-sm">{snapshot?.sitemapStatus.urlsIndexed ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Último envio</span>
                <span className="text-muted-foreground text-sm">{snapshot ? formatDate(snapshot.sitemapStatus.lastSubmitted) : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Snapshot</span>
                <span className="text-muted-foreground text-xs">{snapshot ? formatDate(snapshot.snapshotDate) : "—"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gráfico de evolução de indexação */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            Evolução de Indexação — Últimos 30 dias
            {snapshot?.isLiveData ? (
              <Badge className="ml-auto bg-green-500/20 text-green-400 border-green-500/30 text-xs flex items-center gap-1">
                <Wifi className="w-3 h-3" /> Dados ao vivo
              </Badge>
            ) : (
              <Badge className="ml-auto bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> Snapshot estático
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData?.trend ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIndexed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNotIndexed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} interval={4} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  labelStyle={{ color: "#f3f4f6" }}
                  itemStyle={{ color: "#d1d5db" }}
                />
                <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
                <Area type="monotone" dataKey="indexed" name="Indexadas" stroke="#22c55e" fill="url(#colorIndexed)" strokeWidth={2} />
                <Area type="monotone" dataKey="notIndexed" name="Não indexadas" stroke="#ef4444" fill="url(#colorNotIndexed)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            {snapshot?.isLiveData
              ? "Dados coletados via Google Search Console API em tempo real."
              : "Dados baseados em snapshot manual de 07/04/2026. Conecte a Service Account para dados ao vivo."}
          </p>
        </CardContent>
      </Card>

      {/* Status das URLs prioritárias */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            Status das Landing Pages (Verificação em Tempo Real)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUrls ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Verificando acessibilidade das URLs...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 pr-4">Página</th>
                    <th className="text-left py-2 pr-4">URL</th>
                    <th className="text-center py-2 pr-4">Prioridade</th>
                    <th className="text-center py-2">Acessível</th>
                  </tr>
                </thead>
                <tbody>
                  {urlStatus?.pages.map((page, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-4 text-foreground font-medium">{page.name}</td>
                      <td className="py-2 pr-4">
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 text-xs hover:underline flex items-center gap-1"
                        >
                          {page.url.replace("https://zenitetech.com", "")}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-2 pr-4 text-center">
                        <Badge
                          variant="outline"
                          className={page.priority === "alta"
                            ? "border-red-500/30 text-red-400 text-xs"
                            : "border-yellow-500/30 text-yellow-400 text-xs"}
                        >
                          {page.priority}
                        </Badge>
                      </td>
                      <td className="py-2 text-center">
                        {page.accessible
                          ? <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />
                          : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {urlStatus && (
                <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Verificado em: {formatDate(urlStatus.checkedAt)} —
                  {urlStatus.summary.accessible}/{urlStatus.summary.total} páginas acessíveis
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de pings */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Histórico de Pings do Sitemap
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!history?.history.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p>Nenhum ping enviado ainda.</p>
              <p className="text-xs mt-1">Clique em "Ping Agora" para enviar o primeiro ping manualmente.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.history.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between rounded p-2 text-sm ${
                    entry.status === "success"
                      ? "bg-green-500/5 border border-green-500/20"
                      : "bg-red-500/5 border border-red-500/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {entry.status === "success"
                      ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                    <div>
                      <span className="text-muted-foreground">{entry.message}</span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {entry.triggeredBy === "scheduled" ? "🕐 Automático" : "👆 Manual"} —{" "}
                        {formatDate(entry.timestamp)}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={entry.type === "both"
                      ? "border-blue-500/30 text-blue-400 text-xs"
                      : "border-gray-600 text-muted-foreground text-xs"}
                  >
                    {entry.type === "both" ? "Google + Bing" : entry.type}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prompt para Lovable */}
      <Card className="bg-card border-yellow-500/20 border">
        <CardHeader className="pb-3">
          <CardTitle className="text-yellow-400 text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Ação Pendente — Corrigir Canonical no Lovable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm mb-3">
            A principal causa das 102 páginas não indexadas é o <strong>canonical estático</strong> apontando para a homepage em todas as páginas.
            Cole o prompt abaixo no chat do Lovable para corrigir:
          </p>
          <div className="bg-muted rounded p-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
{`Preciso corrigir um problema crítico de SEO no site.

O problema: todas as páginas têm canonical apontando para 
https://www.zenitetech.com/ (homepage) em vez da URL específica.
Isso está impedindo a indexação de 102 páginas no Google.

Solução: criar canonical dinâmico com react-helmet-async:
  <link rel="canonical" href={\`https://zenitetech.com\${location.pathname}\`} />
  <meta property="og:url" content={\`https://zenitetech.com\${location.pathname}\`} />
  <meta name="robots" content="index, follow" />

Aplique em TODAS as páginas do site usando useLocation() do React Router.`}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
