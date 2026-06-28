import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, MousePointerClick,
  Target, Eye, ExternalLink, Download, RefreshCw, AlertCircle, CheckCircle2,
  Users, ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

type Period = "7d" | "30d" | "90d" | "custom";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  "custom": "Personalizado",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ENABLED: { label: "Ativa", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    PAUSED: { label: "Pausada", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    REMOVED: { label: "Removida", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-gray-500/20 text-muted-foreground border-gray-500/30" };
  return (
    <span className={`text-xs border rounded px-2 py-0.5 font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function PerformanceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    EXCELLENT: { label: "Excelente", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    GOOD: { label: "Bom", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    AVERAGE: { label: "Médio", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    POOR: { label: "Baixo", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-gray-500/20 text-muted-foreground border-gray-500/30" };
  return (
    <span className={`text-xs border rounded px-2 py-0.5 font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// Helpers de data
function todayStr() { return new Date().toISOString().split("T")[0]; }
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export default function RelatorioAds() {
  const [period, setPeriod] = useState<Period>("7d");
  const [selectedCampaign, setSelectedCampaign] = useState<string | undefined>(undefined);
  const [showComparison, setShowComparison] = useState(false);
  const [customStart, setCustomStart] = useState(() => daysAgoStr(30));
  const [customEnd, setCustomEnd] = useState(() => todayStr());
  const [showCustomDates, setShowCustomDates] = useState(false);

  // Quando muda para custom, mostrar os campos de data
  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setShowCustomDates(p === "custom");
  };

  // Calcular datas do período anterior para comparação
  const prevPeriodDates = useMemo(() => {
    const today = new Date();
    const daysBack = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const prevEnd = new Date(today);
    prevEnd.setDate(today.getDate() - daysBack);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - daysBack + 1);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    return { startDate: fmt(prevStart), endDate: fmt(prevEnd) };
  }, [period]);

  // Parâmetros de query com suporte a datas customizadas
  const queryParams = useMemo(() => {
    if (period === "custom") {
      return { period: "custom" as Period, startDate: customStart, endDate: customEnd, campaignId: selectedCampaign };
    }
    return { period, campaignId: selectedCampaign };
  }, [period, customStart, customEnd, selectedCampaign]);

  const summaryQuery = trpc.googleAds.getSummary.useQuery(
    queryParams,
    { refetchOnWindowFocus: false }
  );

  // Query do período anterior para comparação
  const prevSummaryQuery = trpc.googleAds.getSummary.useQuery(
    { period: "custom", startDate: prevPeriodDates.startDate, endDate: prevPeriodDates.endDate, campaignId: selectedCampaign },
    { refetchOnWindowFocus: false, enabled: showComparison }
  );

  const adGroupsQuery = trpc.googleAds.getAdGroups.useQuery(
    queryParams,
    { refetchOnWindowFocus: false }
  );

  const trendsQuery = trpc.googleAds.getTrends.useQuery(
    queryParams,
    { refetchOnWindowFocus: false }
  );

  const campaignsQuery = trpc.googleAds.getCampaigns.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const summary = summaryQuery.data?.summary;
  const prevSummary = prevSummaryQuery.data?.summary;
  const adGroups = adGroupsQuery.data?.adGroups ?? [];
  const trends = trendsQuery.data?.trends ?? [];
  const campaigns = campaignsQuery.data?.campaigns ?? [];

  // CPL: Custo por Lead (gasto / conversões)
  const cpl = summary && summary.totalConversions > 0
    ? summary.totalSpend / summary.totalConversions
    : null;
  const prevCpl = prevSummary && prevSummary.totalConversions > 0
    ? prevSummary.totalSpend / prevSummary.totalConversions
    : null;

  // Função de delta %
  function delta(current: number, previous: number | null | undefined): number | null {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  }

  const isLoading = summaryQuery.isLoading || adGroupsQuery.isLoading;

  // Métricas derivadas
  const activeGroups = adGroups.filter(g => g.status === "ENABLED").length;
  const excellentGroups = adGroups.filter(g => g.performanceStatus === "EXCELLENT").length;
  const poorGroups = adGroups.filter(g => g.performanceStatus === "POOR").length;

  // Ordenar grupos por gasto desc
  const sortedGroups = useMemo(() =>
    [...adGroups].sort((a, b) => b.spend - a.spend),
    [adGroups]
  );

  // Exportar CSV
  function exportCSV() {
    const headers = ["Grupo", "Campanha", "Status", "Performance", "Cliques", "Impressões", "CTR (%)", "CPC (R$)", "Conversões", "Gasto (R$)"];
    const rows = sortedGroups.map(g => [
      g.name,
      g.campaignName,
      g.status,
      g.performanceStatus,
      g.clicks,
      g.impressions,
      (g.ctr * 100).toFixed(2),
      g.cpc.toFixed(2),
      g.conversions,
      g.spend.toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-ads-${period}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Relatório de Campanhas Google Ads
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Dados reais via Google Ads API — conta {import.meta.env.VITE_GOOGLE_ADS_CUSTOMER_ID ?? "Zênite Tech"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro de período */}
          <div className="flex flex-col gap-2">
            <div className="flex bg-card border border-border rounded-lg overflow-hidden">
              {(["7d", "30d", "90d", "custom"] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    period === p
                      ? "bg-blue-600 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            {showCustomDates && (
              <div className="flex items-center gap-2 bg-card border border-blue-500/40 rounded-lg px-3 py-2">
                <span className="text-muted-foreground text-xs">De:</span>
                <input
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={e => setCustomStart(e.target.value)}
                  className="bg-transparent text-foreground text-xs border-none outline-none"
                />
                <span className="text-muted-foreground text-xs">Até:</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  max={todayStr()}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="bg-transparent text-foreground text-xs border-none outline-none"
                />
              </div>
            )}
          </div>

          {/* Filtro de campanha */}
          <select
            value={selectedCampaign ?? ""}
            onChange={e => setSelectedCampaign(e.target.value || undefined)}
            className="bg-card border border-border text-muted-foreground text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
          >
            <option value="">Todas as campanhas</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={exportCSV}
            className="border-border text-muted-foreground hover:text-foreground text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              summaryQuery.refetch();
              adGroupsQuery.refetch();
              trendsQuery.refetch();
            }}
            className="border-border text-muted-foreground hover:text-foreground text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Atualizar
          </Button>

          <a
            href="https://ads.google.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-foreground text-xs">
              <ExternalLink className="w-3 h-3 mr-1" />
              Google Ads
            </Button>
          </a>
        </div>
      </div>

      {/* Erro de API */}
      {summaryQuery.data?.success === false && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium text-sm">Erro ao conectar com Google Ads API</p>
            <p className="text-muted-foreground text-xs mt-1">{summaryQuery.data?.error ?? "Verifique as credenciais nas configurações."}</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="h-3 bg-muted rounded w-24 mb-3" />
              <div className="h-7 bg-muted rounded w-16 mb-2" />
              <div className="h-3 bg-muted rounded w-20" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                <span className="text-muted-foreground text-xs">Gasto Total</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalSpend)}</div>
              <div className="text-muted-foreground text-xs mt-1">{summary.dateRange}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MousePointerClick className="w-4 h-4 text-blue-400" />
                <span className="text-muted-foreground text-xs">Cliques</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{summary.totalClicks.toLocaleString("pt-BR")}</div>
              <div className="text-muted-foreground text-xs mt-1">CTR: {formatPct(summary.avgCtr)}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-purple-400" />
                <span className="text-muted-foreground text-xs">Impressões</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{summary.totalImpressions.toLocaleString("pt-BR")}</div>
              <div className="text-muted-foreground text-xs mt-1">CPC médio: {formatCurrency(summary.avgCpc)}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-green-400" />
                <span className="text-muted-foreground text-xs">Conversões</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{summary.totalConversions.toLocaleString("pt-BR")}</div>
              <div className="text-muted-foreground text-xs mt-1">
                {summary.totalClicks > 0
                  ? `Taxa: ${((summary.totalConversions / summary.totalClicks) * 100).toFixed(2)}%`
                  : "Taxa: —"}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Status dos grupos */}
      {!isLoading && adGroups.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{activeGroups}</div>
            <div className="text-muted-foreground text-xs mt-1">Grupos ativos</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{excellentGroups}</div>
            <div className="text-muted-foreground text-xs mt-1">Performance excelente</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{poorGroups}</div>
            <div className="text-muted-foreground text-xs mt-1">Precisam de atenção</div>
          </div>
        </div>
      )}

      {/* Gráficos lado a lado */}
      {trends.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Tendência de Cliques e Impressões */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Cliques e Impressões — Tendência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trends} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                    labelStyle={{ color: "#F9FAFB" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line yAxisId="left" type="monotone" dataKey="clicks" name="Cliques" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impressões" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gasto diário */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                Gasto Diário (R$)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trends} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} tickFormatter={v => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                    labelStyle={{ color: "#F9FAFB" }}
                    formatter={(v: number) => [formatCurrency(v), "Gasto"]}
                  />
                  <Bar dataKey="costMicros" name="Gasto" fill="#F59E0B"
                    radius={[3, 3, 0, 0]}
                    // costMicros está em micros, converter para BRL
                  />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-gray-600 text-xs mt-1 text-center">* Valores em R$ (dividido por 1.000.000)</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de grupos de anúncios */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Grupos de Anúncios — Desempenho Detalhado
            </CardTitle>
            <span className="text-muted-foreground text-xs">{adGroups.length} grupos</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Carregando dados...</div>
          ) : sortedGroups.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nenhum dado disponível para o período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-muted-foreground text-xs font-medium px-4 py-3">Grupo</th>
                    <th className="text-left text-muted-foreground text-xs font-medium px-4 py-3 hidden md:table-cell">Campanha</th>
                    <th className="text-center text-muted-foreground text-xs font-medium px-4 py-3">Status</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-4 py-3">Cliques</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-4 py-3 hidden sm:table-cell">CTR</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-4 py-3 hidden sm:table-cell">CPC</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-4 py-3">Conv.</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-4 py-3">Gasto</th>
                    <th className="text-center text-muted-foreground text-xs font-medium px-4 py-3 hidden lg:table-cell">Perf.</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedGroups.map((group, i) => (
                    <tr
                      key={group.id}
                      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                        i % 2 === 0 ? "" : "bg-card/30"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-foreground text-xs font-medium">{group.name}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-muted-foreground text-xs">{group.campaignName}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={group.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-foreground text-xs">{group.clicks.toLocaleString("pt-BR")}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className={`text-xs font-mono ${group.ctr >= 0.1 ? "text-green-400" : group.ctr >= 0.05 ? "text-yellow-400" : "text-red-400"}`}>
                          {formatPct(group.ctr)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="text-muted-foreground text-xs font-mono">{formatCurrency(group.cpc)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-bold ${group.conversions > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                          {group.conversions}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-yellow-400 text-xs font-mono">{formatCurrency(group.spend)}</span>
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        <PerformanceBadge status={group.performanceStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/50">
                    <td colSpan={3} className="px-4 py-3 text-muted-foreground text-xs font-medium">Total</td>
                    <td className="px-4 py-3 text-right text-foreground text-xs font-bold">
                      {sortedGroups.reduce((s, g) => s + g.clicks, 0).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" />
                    <td className="px-4 py-3 hidden sm:table-cell" />
                    <td className="px-4 py-3 text-right text-green-400 text-xs font-bold">
                      {sortedGroups.reduce((s, g) => s + g.conversions, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-400 text-xs font-bold">
                      {formatCurrency(sortedGroups.reduce((s, g) => s + g.spend, 0))}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Pizza — Distribuição de Orçamento por Campanha */}
      {!isLoading && sortedGroups.length > 0 && (() => {
        // Agrupar gastos por campanha
        const campaignSpend: Record<string, number> = {};
        for (const g of sortedGroups) {
          if (g.spend > 0) {
            const name = g.campaignName || "Sem campanha";
            campaignSpend[name] = (campaignSpend[name] ?? 0) + g.spend;
          }
        }
        const pieData = Object.entries(campaignSpend)
          .sort((a, b) => b[1] - a[1])
          .map(([name, value]) => ({ name, value }));
        const totalSpend = pieData.reduce((s, d) => s + d.value, 0);
        const PIE_COLORS = ["#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#06B6D4", "#F97316", "#84CC16"];
        if (pieData.length === 0) return null;
        return (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                Distribuição de Orçamento por Campanha
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Pizza */}
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={220} height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                        formatter={(v: number) => [formatCurrency(v), "Gasto"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legenda com valores */}
                <div className="flex-1 w-full">
                  <div className="space-y-2">
                    {pieData.map((item, index) => {
                      const pct = totalSpend > 0 ? (item.value / totalSpend) * 100 : 0;
                      return (
                        <div key={item.name} className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground text-xs truncate">{item.name}</span>
                              <span className="text-foreground text-xs font-mono font-medium flex-shrink-0">{formatCurrency(item.value)}</span>
                            </div>
                            <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                              />
                            </div>
                          </div>
                          <span className="text-muted-foreground text-xs w-10 text-right flex-shrink-0">{pct.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs">
                    <span className="text-muted-foreground">Total investido</span>
                    <span className="text-yellow-400 font-bold font-mono">{formatCurrency(totalSpend)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Seção CPL — Custo por Lead */}
      {summary && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-400" />
                Custo por Lead (CPL)
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowComparison(!showComparison)}
                className="border-border text-muted-foreground hover:text-foreground text-xs"
              >
                {showComparison ? "Ocultar" : "Comparar"} período anterior
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CPL atual */}
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="text-muted-foreground text-xs mb-1">CPL Atual</div>
                <div className="text-3xl font-bold text-orange-400">
                  {cpl !== null ? formatCurrency(cpl) : "—"}
                </div>
                <div className="text-muted-foreground text-xs mt-1">
                  {summary.totalConversions} conversões / {formatCurrency(summary.totalSpend)}
                </div>
                {cpl !== null && cpl <= 30 && (
                  <div className="mt-2 text-xs text-green-400 font-medium">✅ Excelente (abaixo de R$30)</div>
                )}
                {cpl !== null && cpl > 30 && cpl <= 60 && (
                  <div className="mt-2 text-xs text-yellow-400 font-medium">⚠️ Aceitável (R$30–R$60)</div>
                )}
                {cpl !== null && cpl > 60 && (
                  <div className="mt-2 text-xs text-red-400 font-medium">🔴 Alto (acima de R$60)</div>
                )}
                {cpl === null && (
                  <div className="mt-2 text-xs text-muted-foreground">Sem conversões no período</div>
                )}
              </div>

              {/* CPL anterior (se comparação ativa) */}
              {showComparison && (
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-muted-foreground text-xs mb-1">CPL Período Anterior</div>
                  {prevSummaryQuery.isLoading ? (
                    <div className="text-muted-foreground text-sm animate-pulse">Carregando...</div>
                  ) : prevCpl !== null ? (
                    <>
                      <div className="text-3xl font-bold text-muted-foreground">{formatCurrency(prevCpl)}</div>
                      <div className="text-muted-foreground text-xs mt-1">
                        {prevSummary?.totalConversions ?? 0} conversões / {formatCurrency(prevSummary?.totalSpend ?? 0)}
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground text-sm mt-2">Sem conversões no período anterior</div>
                  )}
                </div>
              )}

              {/* Variação */}
              {showComparison && cpl !== null && prevCpl !== null && (
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-muted-foreground text-xs mb-1">Variação CPL</div>
                  {(() => {
                    const d = delta(cpl, prevCpl);
                    if (d === null) return <div className="text-muted-foreground text-sm">—</div>;
                    const isImproved = d < 0; // CPL menor = melhor
                    return (
                      <>
                        <div className={`text-3xl font-bold ${isImproved ? "text-green-400" : "text-red-400"}`}>
                          {isImproved ? <ArrowDownRight className="inline w-6 h-6" /> : <ArrowUpRight className="inline w-6 h-6" />}
                          {Math.abs(d).toFixed(1)}%
                        </div>
                        <div className={`text-xs mt-2 font-medium ${isImproved ? "text-green-400" : "text-red-400"}`}>
                          {isImproved ? "CPL melhorou vs período anterior" : "CPL piorou vs período anterior"}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Benchmarks */}
              <div className={`bg-muted/50 rounded-xl p-4 ${showComparison ? "md:col-span-3" : "md:col-span-2"}`}>
                <div className="text-muted-foreground text-xs font-medium mb-3">Benchmarks CPL B2B — Tecnologia</div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-green-400 font-bold text-sm">R$20–R$40</div>
                    <div className="text-muted-foreground text-xs">Excelente</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-400 font-bold text-sm">R$40–R$80</div>
                    <div className="text-muted-foreground text-xs">Aceitável</div>
                  </div>
                  <div className="text-center">
                    <div className="text-red-400 font-bold text-sm">&gt; R$80</div>
                    <div className="text-muted-foreground text-xs">Revisar estratégia</div>
                  </div>
                </div>
                <p className="text-gray-600 text-xs mt-3">
                  * Benchmarks para segmento B2B tecnologia/segurança eletrônica no Brasil. CPL ideal para Zênite Tech: R$30–R$50 (whatsapp_click = R$20, generate_lead = R$50).
                </p>
              </div>
            </div>

            {/* Comparação completa de períodos */}
            {showComparison && summary && prevSummary && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="text-muted-foreground text-xs font-medium mb-3">Comparação Completa de Períodos</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Gasto", curr: summary.totalSpend, prev: prevSummary.totalSpend, fmt: formatCurrency, lowerIsBetter: true },
                    { label: "Cliques", curr: summary.totalClicks, prev: prevSummary.totalClicks, fmt: (v: number) => v.toLocaleString("pt-BR"), lowerIsBetter: false },
                    { label: "CTR Médio", curr: summary.avgCtr, prev: prevSummary.avgCtr, fmt: formatPct, lowerIsBetter: false },
                    { label: "Conversões", curr: summary.totalConversions, prev: prevSummary.totalConversions, fmt: (v: number) => v.toString(), lowerIsBetter: false },
                  ].map(({ label, curr, prev, fmt, lowerIsBetter }) => {
                    const d = delta(curr, prev);
                    const isPositive = d !== null && (lowerIsBetter ? d < 0 : d > 0);
                    const isNegative = d !== null && (lowerIsBetter ? d > 0 : d < 0);
                    return (
                      <div key={label} className="bg-muted/30 rounded-lg p-3">
                        <div className="text-muted-foreground text-xs mb-1">{label}</div>
                        <div className="text-foreground font-bold text-sm">{fmt(curr)}</div>
                        <div className="text-gray-600 text-xs">ant: {fmt(prev)}</div>
                        {d !== null && (
                          <div className={`text-xs font-medium mt-1 flex items-center gap-1 ${
                            isPositive ? "text-green-400" : isNegative ? "text-red-400" : "text-muted-foreground"
                          }`}>
                            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : isNegative ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                            {Math.abs(d).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alertas de performance */}
      {!isLoading && (poorGroups > 0 || excellentGroups > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {excellentGroups > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium text-sm">Top Performers</span>
              </div>
              <div className="space-y-2">
                {adGroups
                  .filter(g => g.performanceStatus === "EXCELLENT")
                  .slice(0, 3)
                  .map(g => (
                    <div key={g.id} className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">{g.name}</span>
                      <span className="text-emerald-400 text-xs font-mono">{formatPct(g.ctr)} CTR</span>
                    </div>
                  ))}
              </div>
              <p className="text-muted-foreground text-xs mt-3">
                Recomendação: aumentar orçamento nesses grupos para maximizar conversões.
              </p>
            </div>
          )}
          {poorGroups > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 font-medium text-sm">Precisam de Atenção</span>
              </div>
              <div className="space-y-2">
                {adGroups
                  .filter(g => g.performanceStatus === "POOR")
                  .slice(0, 3)
                  .map(g => (
                    <div key={g.id} className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">{g.name}</span>
                      <span className="text-red-400 text-xs font-mono">{formatPct(g.ctr)} CTR</span>
                    </div>
                  ))}
              </div>
              <p className="text-muted-foreground text-xs mt-3">
                Recomendação: revisar palavras-chave, anúncios e negativos nesses grupos.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
