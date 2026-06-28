import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ArrowLeft,
  RefreshCw,
  Shield,
  AlertCircle,
  Download,
  PieChart as PieChartIcon,
  BarChart2,
  CheckCheck,
  Tag,
} from "lucide-react";
import { NEGATIVE_REASON_LABELS } from "@shared/negativeReasons";

// ─── Color palette for reasons ────────────────────────────────────────────────
const REASON_COLORS = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#f97316", // orange
  "#14b8a6", // teal
  "#ec4899", // pink
  "#84cc16", // lime
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#d97706", // yellow
  "#64748b", // slate
  "#78716c", // stone
];

function getReasonLabel(reason: string): string {
  if (reason === "sem_motivo") return "Sem motivo";
  return NEGATIVE_REASON_LABELS[reason] ?? reason;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const { name, value, percent } = payload[0];
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg px-4 py-3 text-sm">
        <p className="font-semibold text-foreground mb-1">{getReasonLabel(name)}</p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{value}</span> palavra{value !== 1 ? "s" : ""} negativa{value !== 1 ? "s" : ""}
        </p>
        <p className="text-muted-foreground">{(percent * 100).toFixed(1)}% do total</p>
      </div>
    );
  }
  return null;
};

// ─── Custom Bar Tooltip ───────────────────────────────────────────────────────
const BarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg px-4 py-3 text-sm">
        <p className="font-semibold text-foreground mb-1">{getReasonLabel(label)}</p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{payload[0].value}</span> negativos
        </p>
      </div>
    );
  }
  return null;
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KeywordReasonAnalytics() {
  const [, setLocation] = useLocation();
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");

  const { data, isLoading, refetch, isFetching } = trpc.googleAds.getKeywordReasonStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const stats = data?.stats ?? [];
  const total = data?.total ?? 0;

  // Top 10 for chart, rest grouped as "outros"
  const TOP_N = 10;
  const topStats = stats.slice(0, TOP_N);
  const restCount = stats.slice(TOP_N).reduce((acc, s) => acc + s.count, 0);
  const chartData = restCount > 0
    ? [...topStats, { reason: "outros", count: restCount }]
    : topStats;

  // Bar chart data — truncate label for readability
  const barData = chartData.map((s) => ({
    ...s,
    label: getReasonLabel(s.reason).length > 20
      ? getReasonLabel(s.reason).slice(0, 18) + "…"
      : getReasonLabel(s.reason),
    fullLabel: getReasonLabel(s.reason),
  }));

  const exportCSV = () => {
    const headers = ["Motivo", "Quantidade", "Percentual (%)"];
    const rows = stats.map((s) => [
      getReasonLabel(s.reason),
      s.count,
      total > 0 ? ((s.count / total) * 100).toFixed(1) : "0",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-motivos-negativos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/negative-keywords")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Palavras Negativas</span>
              <span className="sm:hidden">Voltar</span>
            </button>
            <span className="text-muted-foreground">/</span>
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-indigo-500" />
              <h1 className="text-lg sm:text-xl font-semibold">Analytics de Motivos</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            {stats.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="w-7 h-7 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Carregando estatísticas de motivos...</span>
          </div>
        )}

        {/* Error state */}
        {!isLoading && !data?.success && (
          <div className="flex items-center justify-center py-24 gap-3 text-red-500">
            <AlertCircle className="w-6 h-6" />
            <span>Erro ao carregar dados: {(data as any)?.error ?? "Verifique as credenciais do Google Ads"}</span>
          </div>
        )}

        {/* Content */}
        {!isLoading && data?.success && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-500" />
                    Total de Negativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{total}</div>
                  <p className="text-xs text-muted-foreground mt-1">Palavras-chave analisadas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-500" />
                    Motivos Distintos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.filter(s => s.reason !== "sem_motivo").length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Categorias de negativação</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCheck className="w-4 h-4 text-green-500" />
                    Com Motivo Definido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {total > 0
                      ? `${(((total - (stats.find(s => s.reason === "sem_motivo")?.count ?? 0)) / total) * 100).toFixed(0)}%`
                      : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {total - (stats.find(s => s.reason === "sem_motivo")?.count ?? 0)} de {total} negativos
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Chart + Table */}
            {stats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <PieChartIcon className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">Nenhum dado disponível</p>
                <p className="text-sm mt-1">Adicione palavras-chave negativas com motivos para ver as estatísticas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <PieChartIcon className="h-4 w-4 text-indigo-500" />
                        Distribuição por Motivo
                      </CardTitle>
                      <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                        <button
                          onClick={() => setChartType("pie")}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            chartType === "pie"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <PieChartIcon className="w-3.5 h-3.5" />
                          Pizza
                        </button>
                        <button
                          onClick={() => setChartType("bar")}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            chartType === "bar"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                          Barras
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {chartType === "pie" ? (
                      <div style={{ height: 360 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              dataKey="count"
                              nameKey="reason"
                              cx="50%"
                              cy="45%"
                              outerRadius={120}
                              innerRadius={50}
                              paddingAngle={2}
                            >
                              {chartData.map((entry, index) => (
                                <Cell
                                  key={entry.reason}
                                  fill={REASON_COLORS[index % REASON_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                              formatter={(value) => (
                                <span className="text-xs text-foreground">{getReasonLabel(value)}</span>
                              )}
                              iconSize={10}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div style={{ height: 360 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={barData}
                            layout="vertical"
                            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                            <YAxis
                              type="category"
                              dataKey="label"
                              width={140}
                              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                            />
                            <Tooltip content={<BarTooltip />} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                              {barData.map((entry, index) => (
                                <Cell
                                  key={entry.reason}
                                  fill={REASON_COLORS[index % REASON_COLORS.length]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Table Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-indigo-500" />
                      Ranking de Motivos
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({stats.length} motivo{stats.length !== 1 ? "s" : ""})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-auto max-h-[360px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                          <tr className="border-b border-border bg-secondary/80">
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">#</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Motivo</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qtd</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">%</th>
                            <th className="px-4 py-2.5 font-medium text-muted-foreground">Proporção</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.map((s, idx) => {
                            const pct = total > 0 ? (s.count / total) * 100 : 0;
                            const color = REASON_COLORS[idx % REASON_COLORS.length];
                            return (
                              <tr
                                key={s.reason}
                                className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                              >
                                <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">{idx + 1}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: color }}
                                    />
                                    <span
                                      className={`text-xs font-medium ${
                                        s.reason === "sem_motivo" ? "text-muted-foreground italic" : "text-foreground"
                                      }`}
                                    >
                                      {getReasonLabel(s.reason)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-right font-semibold text-sm">{s.count}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                                  {pct.toFixed(1)}%
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="w-full bg-secondary rounded-full h-1.5 min-w-[60px]">
                                    <div
                                      className="h-1.5 rounded-full"
                                      style={{ width: `${pct}%`, backgroundColor: color }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Insight box */}
            {stats.length > 0 && (() => {
              const topReason = stats[0];
              const withoutReason = stats.find(s => s.reason === "sem_motivo");
              const pctWithoutReason = withoutReason && total > 0
                ? ((withoutReason.count / total) * 100).toFixed(0)
                : null;
              return (
                <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 text-sm text-indigo-800 dark:text-indigo-300">
                  <p className="font-semibold mb-1">📊 Insights</p>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>
                      O motivo mais frequente é <strong>{getReasonLabel(topReason.reason)}</strong> com{" "}
                      <strong>{topReason.count} negativos</strong> ({total > 0 ? ((topReason.count / total) * 100).toFixed(1) : 0}% do total).
                    </li>
                    {pctWithoutReason && parseInt(pctWithoutReason) > 10 && (
                      <li>
                        <strong>{pctWithoutReason}%</strong> dos negativos ainda não têm motivo definido. Acesse{" "}
                        <button
                          onClick={() => setLocation("/negative-keywords")}
                          className="underline font-medium"
                        >
                          Palavras Negativas
                        </button>{" "}
                        e use o botão <strong>"Confirmar motivo"</strong> para classificar.
                      </li>
                    )}
                    <li>
                      Motivos inferidos automaticamente são marcados com <strong>~</strong> e podem ser confirmados
                      individualmente na lista de negativos.
                    </li>
                  </ul>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </>
  );
}
