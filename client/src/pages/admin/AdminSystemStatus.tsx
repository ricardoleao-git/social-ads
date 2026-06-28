import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, AlertTriangle, CheckCircle, Clock, RefreshCw,
  XCircle, Zap, Database, Globe, Mail, Instagram, BarChart3,
  ChevronDown, ChevronUp, Filter, Bell
} from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  alertas: "Alertas",
  google_ads: "Google Ads",
  social: "Redes Sociais",
  relatorios: "Relatórios",
  ia: "Inteligência Artificial",
  monitoramento: "Monitoramento",
  seo: "SEO",
};

const CATEGORY_COLORS: Record<string, string> = {
  alertas: "bg-red-500/10 text-red-500 border-red-500/20",
  google_ads: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  social: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  relatorios: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  ia: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  monitoramento: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  seo: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "success" || status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
        <CheckCircle className="w-3 h-3" /> OK
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
        <XCircle className="w-3 h-3" /> Erro
      </span>
    );
  }
  if (status === "never") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Clock className="w-3 h-3" /> Nunca executado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-500">
      <AlertTriangle className="w-3 h-3" /> Desconhecido
    </span>
  );
}

function ApiStatusIcon({ status }: { status: string }) {
  if (status === "ok") return <CheckCircle className="w-5 h-5 text-emerald-500" />;
  if (status === "error") return <XCircle className="w-5 h-5 text-red-500" />;
  return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
}

const API_ICONS: Record<string, React.ReactNode> = {
  "Google Ads": <BarChart3 className="w-4 h-4" />,
  "GA4 Analytics": <Activity className="w-4 h-4" />,
  "Instagram MCP": <Instagram className="w-4 h-4" />,
  "Gmail MCP": <Mail className="w-4 h-4" />,
};

// Tooltip customizado para o gráfico de linha
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {val !== null && val !== undefined ? (
        <p className="text-emerald-500 font-bold">{val}% de sucesso</p>
      ) : (
        <p className="text-muted-foreground">Sem execuções</p>
      )}
      {payload[1]?.value !== undefined && (
        <p className="text-muted-foreground">{payload[1].value} execuções</p>
      )}
    </div>
  );
}

export default function AdminSystemStatus() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showOnlyFailed, setShowOnlyFailed] = useState(false);

  const { data: jobsData, isLoading: loadingJobs, refetch: refetchJobs } = trpc.systemHealth.getJobsStatus.useQuery(undefined, { refetchInterval: 30000 });
  const { data: errorsData, isLoading: loadingErrors, refetch: refetchErrors } = trpc.systemHealth.getSystemErrors.useQuery(undefined, { refetchInterval: 30000 });
  const { data: statsData, isLoading: loadingStats, refetch: refetchStats } = trpc.systemHealth.getHealthStats.useQuery(undefined, { refetchInterval: 30000 });
  const { data: apisData, isLoading: loadingApis, refetch: refetchApis } = trpc.systemHealth.checkApiStatus.useQuery(undefined, { refetchInterval: 60000 });
  const { data: historyData, isLoading: loadingHistory, refetch: refetchHistory } = trpc.systemHealth.getSuccessRateHistory.useQuery(undefined, { refetchInterval: 60000 });

  const checkFailuresMutation = trpc.systemHealth.checkConsecutiveFailures.useMutation({
    onSuccess: (data) => {
      if (data.alerted.length > 0) {
        toast.success(`🚨 ${data.alerted.length} alerta(s) enviado(s)`, { description: `Jobs com 2 falhas consecutivas: ${data.alerted.join(", ")}` });
      } else {
        toast.success("✅ Nenhuma falha consecutiva detectada", { description: "Todos os jobs estão operando normalmente." });
      }
    },
    onError: () => {
      toast.error("Erro ao verificar falhas consecutivas");
    },
  });

  const handleRefreshAll = () => {
    refetchJobs();
    refetchErrors();
    refetchStats();
    refetchApis();
    refetchHistory();
  };

  // Filtrar jobs com falha hoje
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const allJobs = jobsData?.jobs ?? [];
  const jobsToShow = showOnlyFailed
    ? allJobs.filter(j => {
        if (j.lastStatus !== "error") return false;
        if (!j.lastRun) return false;
        return new Date(j.lastRun) >= todayStart;
      })
    : allJobs;

  // Agrupar jobs por categoria
  const jobsByCategory = jobsToShow.reduce((acc, job) => {
    const cat = (job as any).category ?? "outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(job);
    return acc;
  }, {} as Record<string, any[]>);

  const isLoading = loadingJobs || loadingErrors || loadingStats || loadingApis;

  // Dados do gráfico — substituir null por undefined para recharts não plotar ponto
  const chartData = (historyData?.history ?? []).map(h => ({
    hour: h.hour,
    taxa: h.successRate ?? undefined,
    total: h.total,
  }));

  const failedTodayCount = allJobs.filter(j => {
    if (j.lastStatus !== "error") return false;
    if (!j.lastRun) return false;
    return new Date(j.lastRun) >= todayStart;
  }).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Saúde do Sistema
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Status em tempo real dos jobs automáticos e APIs externas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkFailuresMutation.mutate()}
              disabled={checkFailuresMutation.isPending}
              className="gap-2"
            >
              <Bell className={`w-4 h-4 ${checkFailuresMutation.isPending ? "animate-pulse" : ""}`} />
              Verificar Falhas Consecutivas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Zap className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Jobs Registrados</p>
                  <p className="text-2xl font-bold text-foreground">{statsData?.totalJobs ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sucesso (24h)</p>
                  <p className="text-2xl font-bold text-emerald-500">{statsData?.successLast24h ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Erros (24h)</p>
                  <p className="text-2xl font-bold text-red-500">{statsData?.errorLast24h ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Erros Totais</p>
                  <p className="text-2xl font-bold text-orange-500">{statsData?.totalErrors ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Taxa de Sucesso nas últimas 24h */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Taxa de Sucesso dos Jobs — Últimas 24 Horas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Carregando histórico...
              </div>
            ) : chartData.every(d => d.taxa === undefined) ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                <Clock className="w-4 h-4" />
                Nenhuma execução registrada nas últimas 24h. Os dados aparecerão conforme os jobs forem executados.
              </div>
            ) : (
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      interval={3}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={80} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "80%", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Line
                      type="monotone"
                      dataKey="taxa"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#10b981" }}
                      connectNulls={false}
                      name="Taxa de Sucesso"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Linha tracejada = meta mínima de 80%. Pontos sem dados indicam horas sem execuções registradas.
            </p>
          </CardContent>
        </Card>

        {/* Status das APIs */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              Status das APIs Externas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingApis ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Verificando APIs...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(apisData?.apis ?? []).map((api) => (
                  <div
                    key={api.api}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground">
                        {API_ICONS[api.api] ?? <Database className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{api.api}</p>
                        <p className="text-xs text-muted-foreground">{api.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {api.latencyMs && (
                        <span className="text-xs text-muted-foreground">{api.latencyMs}ms</span>
                      )}
                      <ApiStatusIcon status={api.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Jobs por Categoria */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Status dos Jobs Automáticos
              </CardTitle>
              <button
                onClick={() => setShowOnlyFailed(!showOnlyFailed)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  showOnlyFailed
                    ? "bg-red-500/10 text-red-500 border-red-500/30"
                    : "bg-muted text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <Filter className="w-3 h-3" />
                {showOnlyFailed ? `Falhas hoje (${failedTodayCount})` : "Mostrar só falhas de hoje"}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingJobs ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Carregando status dos jobs...
              </div>
            ) : showOnlyFailed && failedTodayCount === 0 ? (
              <div className="flex items-center gap-2 text-emerald-500 text-sm py-4">
                <CheckCircle className="w-4 h-4" />
                Nenhum job com falha hoje. Sistema operando normalmente.
              </div>
            ) : (
              Object.entries(jobsByCategory).map(([category, jobs]) => {
                const isExpanded = expandedCategory === category;
                const errorCount = jobs.filter((j: any) => j.lastStatus === "error").length;
                const neverCount = jobs.filter((j: any) => j.lastStatus === "never").length;

                return (
                  <div key={category} className="border border-border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[category] ?? "bg-muted text-muted-foreground border-border"}`}>
                          {CATEGORY_LABELS[category] ?? category}
                        </span>
                        <span className="text-sm text-muted-foreground">{jobs.length} jobs</span>
                        {errorCount > 0 && (
                          <span className="text-xs text-red-500 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> {errorCount} com erro
                          </span>
                        )}
                        {neverCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {neverCount} sem histórico
                          </span>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border divide-y divide-border">
                        {jobs.map((job: any) => (
                          <div key={job.name} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{job.label}</p>
                              <p className="text-xs text-muted-foreground">{job.schedule}</p>
                              {job.lastMessage && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-xs">{job.lastMessage}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-4 ml-4 shrink-0">
                              {job.durationMs && (
                                <span className="text-xs text-muted-foreground">{job.durationMs}ms</span>
                              )}
                              {job.lastRun ? (
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true, locale: ptBR })}
                                </span>
                              ) : null}
                              <StatusBadge status={job.lastStatus} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Últimos 10 Erros do Sistema */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Últimos 10 Erros do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingErrors ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Carregando erros...
              </div>
            ) : (errorsData?.errors ?? []).length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-500 text-sm py-4">
                <CheckCircle className="w-4 h-4" />
                Nenhum erro registrado. Sistema operando normalmente.
              </div>
            ) : (
              <div className="space-y-2">
                {(errorsData?.errors ?? []).map((err) => (
                  <div
                    key={err.id}
                    className="p-3 rounded-lg border border-red-500/20 bg-red-500/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-red-500 uppercase tracking-wide">{err.source}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs font-medium text-foreground">{err.component}</span>
                        </div>
                        <p className="text-sm text-foreground">{err.message}</p>
                        {err.stack && (
                          <details className="mt-1">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Ver stack trace
                            </summary>
                            <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                              {err.stack}
                            </pre>
                          </details>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(err.occurredAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
