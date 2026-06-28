/**
 * HistoricoDiario — Histórico Diário de Performance Google Ads
 * Exibe dados reais da API do Google Ads: cliques, custo, CPC, CTR, conversões por dia
 * com gráfico de linha, tabela completa e breakdown por campanha.
 */
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import {
  Calendar, TrendingUp, TrendingDown, DollarSign, MousePointerClick,
  Target, Download, RefreshCw, ChevronUp, ChevronDown, Minus
} from "lucide-react";
import { useState, useMemo } from "react";

type Period = "7" | "14" | "30";

function formatDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
}

function formatCurrency(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function formatPct(v: number): string {
  return `${v.toFixed(2)}%`;
}

function DeltaBadge({ current, prev, format = "number", lowerIsBetter = false }: {
  current: number; prev: number; format?: "number" | "currency" | "pct"; lowerIsBetter?: boolean;
}) {
  if (prev === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const delta = current - prev;
  const pct = (delta / prev) * 100;
  const isPositive = lowerIsBetter ? delta < 0 : delta > 0;
  const color = isPositive ? "text-emerald-400" : delta === 0 ? "text-muted-foreground" : "text-red-400";
  const Icon = delta > 0 ? ChevronUp : delta < 0 ? ChevronDown : Minus;
  const label = format === "currency" ? formatCurrency(Math.abs(delta))
    : format === "pct" ? formatPct(Math.abs(delta))
    : Math.abs(delta).toFixed(0);
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {label} ({pct > 0 ? "+" : ""}{pct.toFixed(1)}%)
    </span>
  );
}

function MetricCard({ label, value, prev, icon: Icon, format = "number", lowerIsBetter = false }: {
  label: string; value: number; prev?: number; icon: React.ElementType;
  format?: "number" | "currency" | "pct"; lowerIsBetter?: boolean;
}) {
  const display = format === "currency" ? formatCurrency(value)
    : format === "pct" ? formatPct(value)
    : value.toLocaleString("pt-BR");
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold text-foreground">{display}</div>
      {prev !== undefined && (
        <div className="mt-1">
          <DeltaBadge current={value} prev={prev} format={format} lowerIsBetter={lowerIsBetter} />
          <span className="text-xs text-muted-foreground ml-1">vs período anterior</span>
        </div>
      )}
    </div>
  );
}

export default function HistoricoDiario() {
  const [period, setPeriod] = useState<Period>("14");
  const [tab, setTab] = useState<"geral" | "campanhas">("geral");

  const days = parseInt(period);

  const { data: dailyRaw, isLoading, refetch } = trpc.googleAds.getDailyCostEvolution.useQuery(
    { days },
    { refetchOnWindowFocus: false }
  );

  const { data: byCampaignRaw, isLoading: loadingCampaigns } = trpc.googleAds.getDailyTrendsByCampaign.useQuery(
    { period: days === 7 ? "7d" : days === 14 ? "7d" : "30d" },
    { refetchOnWindowFocus: false }
  );

  const dailyData = useMemo(() => {
    const raw = dailyRaw?.data ?? [];
    return raw.map(d => ({
      ...d,
      dateLabel: formatDate(d.date),
    }));
  }, [dailyRaw]);

  // Totais do período atual
  const totals = useMemo(() => {
    return dailyData.reduce((acc, d) => ({
      clicks: acc.clicks + d.clicks,
      cost: acc.cost + d.cost,
      conversions: acc.conversions + d.conversions,
    }), { clicks: 0, cost: 0, conversions: 0 });
  }, [dailyData]);

  // Médias do período
  const n = dailyData.length || 1;
  const avgCpc = totals.clicks > 0 ? totals.cost / totals.clicks : 0;
  const avgCtr = useMemo(() => {
    const sum = dailyData.reduce((s, d) => s + d.ctr, 0);
    return sum / n;
  }, [dailyData, n]);

  // Exportar CSV
  function exportCSV() {
    const header = "Data,Cliques,Custo (R$),CPC (R$),CTR (%),Conversões";
    const rows = dailyData.map(d =>
      `${d.date},${d.clicks},${d.cost.toFixed(2)},${d.cpc.toFixed(2)},${d.ctr.toFixed(2)},${d.conversions}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-diario-${period}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const campaignSeries = byCampaignRaw?.series ?? [];
  const CAMPAIGN_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-400" />
              Histórico Diário
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Performance real do Google Ads por dia — dados diretos da API
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as Period)}
              className="px-3 py-1.5 bg-secondary border border-border rounded text-sm focus:outline-none"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="14">Últimos 14 dias</option>
              <option value="30">Últimos 30 dias</option>
            </select>
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={exportCSV}
              disabled={dailyData.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Cards de métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total de Cliques" value={totals.clicks} icon={MousePointerClick} />
          <MetricCard label="Custo Total" value={totals.cost} icon={DollarSign} format="currency" />
          <MetricCard label="CPC Médio" value={avgCpc} icon={TrendingUp} format="currency" lowerIsBetter />
          <MetricCard label="Conversões" value={totals.conversions} icon={Target} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["geral", "campanhas"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "geral" ? "Visão Geral" : "Por Campanha"}
            </button>
          ))}
        </div>

        {tab === "geral" && (
          <>
            {/* Gráfico de área — Cliques e Custo */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Evolução Diária — Cliques e Custo
              </h2>
              {isLoading ? (
                <div className="flex items-center justify-center h-52 text-muted-foreground gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Buscando dados da API do Google Ads...</span>
                </div>
              ) : dailyData.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">
                  Sem dados disponíveis para o período selecionado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="costGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)"
                      tickFormatter={v => `R$${v.toFixed(0)}`} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                      formatter={(value: number, name: string) =>
                        name === "cost" ? [formatCurrency(value), "Custo"] : [value, "Cliques"]
                      }
                    />
                    <Legend formatter={v => v === "clicks" ? "Cliques" : "Custo (R$)"} />
                    <Area yAxisId="left" type="monotone" dataKey="clicks" stroke="#3b82f6" fill="url(#clicksGrad)" strokeWidth={2} dot={false} />
                    <Area yAxisId="right" type="monotone" dataKey="cost" stroke="#10b981" fill="url(#costGrad2)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Gráfico de barras — CPC e CTR */}
            {dailyData.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  CPC Médio por Dia (R$)
                </h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickFormatter={v => `R$${v}`} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                      formatter={(v: number) => [formatCurrency(v), "CPC"]}
                    />
                    <Bar dataKey="cpc" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabela detalhada */}
            {dailyData.length > 0 && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">Tabela Detalhada por Dia</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Data</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Cliques</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Custo</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">CPC</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">CTR</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Conversões</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">vs Dia Ant.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...dailyData].reverse().map((d, i, arr) => {
                        const prev = arr[i + 1];
                        const clicksDelta = prev ? d.clicks - prev.clicks : null;
                        return (
                          <tr key={d.date} className="border-b border-border/50 hover:bg-secondary/20">
                            <td className="px-4 py-2.5 font-medium text-foreground">{d.dateLabel}</td>
                            <td className="px-4 py-2.5 text-right text-foreground">{d.clicks.toLocaleString("pt-BR")}</td>
                            <td className="px-4 py-2.5 text-right text-foreground">{formatCurrency(d.cost)}</td>
                            <td className={`px-4 py-2.5 text-right font-medium ${d.cpc > 3 ? "text-red-400" : d.cpc > 1.5 ? "text-yellow-400" : "text-emerald-400"}`}>
                              {formatCurrency(d.cpc)}
                            </td>
                            <td className={`px-4 py-2.5 text-right ${d.ctr >= 5 ? "text-emerald-400" : d.ctr >= 2 ? "text-yellow-400" : "text-red-400"}`}>
                              {formatPct(d.ctr)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-foreground">{d.conversions}</td>
                            <td className="px-4 py-2.5 text-right">
                              {clicksDelta !== null ? (
                                <span className={`text-xs font-medium ${clicksDelta > 0 ? "text-emerald-400" : clicksDelta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                                  {clicksDelta > 0 ? "+" : ""}{clicksDelta} cliques
                                </span>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-secondary/40 border-t-2 border-border font-semibold">
                        <td className="px-4 py-2.5 text-foreground">Total / Média</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{totals.clicks.toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{formatCurrency(totals.cost)}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{formatCurrency(avgCpc)}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{formatPct(avgCtr)}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{totals.conversions}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{n} dias</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "campanhas" && (
          <div className="space-y-4">
            {loadingCampaigns ? (
              <div className="flex items-center justify-center h-52 text-muted-foreground gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Buscando dados por campanha...</span>
              </div>
            ) : campaignSeries.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">
                Sem dados de campanha disponíveis
              </div>
            ) : (
              <>
                {/* Gráfico de cliques por campanha */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Cliques por Campanha (Diário)</h2>
                  {(() => {
                    // Unificar todas as datas
                    const allDates = Array.from(new Set(
                      campaignSeries.flatMap(s => s.data.map(d => d.dateRaw))
                    )).sort();
                    const chartData = allDates.map(dateRaw => {
                      const entry: Record<string, number | string> = { dateLabel: formatDate(dateRaw) };
                      campaignSeries.forEach(s => {
                        const found = s.data.find(d => d.dateRaw === dateRaw);
                        entry[s.name] = found?.clicks ?? 0;
                      });
                      return entry;
                    });
                    return (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                          <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {campaignSeries.map((s, i) => (
                            <Bar key={s.name} dataKey={s.name} stackId="a" fill={CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]} radius={i === campaignSeries.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>

                {/* Tabela resumo por campanha */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h2 className="text-sm font-semibold text-foreground">Resumo por Campanha</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Campanha</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Total Cliques</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Total Conv.</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Dias Ativos</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Média Cliques/Dia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignSeries.map((s, i) => {
                          const totalClicks = s.data.reduce((sum, d) => sum + d.clicks, 0);
                          const totalConv = s.data.reduce((sum, d) => sum + d.conversions, 0);
                          const activeDays = s.data.filter(d => d.clicks > 0).length;
                          const avgClicks = activeDays > 0 ? (totalClicks / activeDays).toFixed(1) : "0";
                          return (
                            <tr key={s.name} className="border-b border-border/50 hover:bg-secondary/20">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length] }} />
                                  <span className="text-foreground font-medium truncate max-w-[200px]" title={s.name}>{s.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right text-foreground">{totalClicks.toLocaleString("pt-BR")}</td>
                              <td className="px-4 py-2.5 text-right text-foreground">{totalConv}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">{activeDays}</td>
                              <td className="px-4 py-2.5 text-right text-foreground">{avgClicks}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
