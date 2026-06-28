import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, Users, MousePointerClick, Target, Globe,
  ArrowUpRight, ArrowDownRight, Download, RefreshCw, Activity, Calendar, Filter
} from "lucide-react";

const CHANNEL_COLORS: Record<string, string> = {
  "Direto": "#8b5cf6",
  "Não Atribuído": "#94a3b8",
  "Google Ads (Pago)": "#3b82f6",
  "Orgânico (SEO)": "#10b981",
  "Cross-network": "#f59e0b",
};

function exportCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(r => headers.map(h => r[h] ?? "").join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

const PERIOD_OPTIONS = [
  { value: "7d", label: "7 dias" },
  { value: "14d", label: "14 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
] as const;

export default function GA4AbrilReport() {
  const [countryFilter, setCountryFilter] = useState<"all" | "brazil" | "others">("brazil");
  const [period, setPeriod] = useState<"7d" | "14d" | "30d" | "90d">("30d");

  const { data: summary, isLoading: loadingSummary } = trpc.ga4Real.getSummary.useQuery({ period, countryFilter });
  const { data: channelsRaw } = trpc.ga4Real.getTrafficByChannel.useQuery({ period, countryFilter });
  const { data: weeklyRaw } = trpc.ga4Real.getWeeklyTrend.useQuery({ period, countryFilter });
  const { data: pagesRaw } = trpc.ga4Real.getTopPages.useQuery({ period });
  const { data: adPagesRaw } = trpc.ga4Real.getAdPagesPerformance.useQuery({ period, countryFilter });

  const channels = Array.isArray(channelsRaw) ? channelsRaw : (channelsRaw as any)?.channels ?? [];
  const weeks = Array.isArray(weeklyRaw) ? weeklyRaw : (weeklyRaw as any)?.weeks ?? [];
  const pages = Array.isArray(pagesRaw) ? pagesRaw : (pagesRaw as any)?.pages ?? [];
  const adPages = Array.isArray(adPagesRaw) ? adPagesRaw : (adPagesRaw as any)?.pages ?? [];

  const totalConvByChannel = channels.reduce((s: number, c: any) => s + (c.conversions ?? 0), 0);

  const pieData = channels
    .filter((c: any) => c.conversions > 0)
    .map((c: any) => ({ name: c.channel, value: c.conversions, color: CHANNEL_COLORS[c.channel] ?? "#94a3b8" }));

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-500" />
              Relatório GA4
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Google Analytics 4 · Property G-XN8107LBV6 (zenitetech.com) · Dados reais via API
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro Período */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className={`px-3 py-1.5 font-medium transition-colors flex items-center gap-1 ${period === opt.value ? "bg-violet-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                >
                  <Calendar className="w-3 h-3" />
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Filtro País */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {(["all", "brazil", "others"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setCountryFilter(f)}
                  className={`px-3 py-1.5 font-medium transition-colors ${countryFilter === f ? "bg-blue-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                >
                  {f === "all" ? "🌍 Global" : f === "brazil" ? "🇧🇷 Brasil" : "🌐 Outros"}
                </button>
              ))}
            </div>
            <button
              onClick={() => exportCSV(channels, `ga4-canais-abril-2026.csv`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 rounded-lg border border-border transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        {/* KPIs Principais */}
        {loadingSummary ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : summary && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Sessões", value: summary.totalSessions?.toLocaleString("pt-BR"), icon: Activity, color: "text-blue-500", border: "border-blue-500/30" },
              { label: "Usuários", value: summary.totalUsers?.toLocaleString("pt-BR"), icon: Users, color: "text-violet-500", border: "border-violet-500/30" },
              { label: "Novos Usuários", value: summary.newUsers?.toLocaleString("pt-BR"), icon: ArrowUpRight, color: "text-emerald-500", border: "border-emerald-500/30" },
              { label: "Conversões", value: summary.conversions?.toLocaleString("pt-BR"), icon: Target, color: "text-orange-500", border: "border-orange-500/30" },
              { label: "Engajamento", value: `${summary.avgEngagementRate?.toFixed(1)}%`, icon: TrendingUp, color: "text-pink-500", border: "border-pink-500/30" },
            ].map(({ label, value, icon: Icon, color, border }) => (
              <div key={label} className={`rounded-xl border ${border} bg-card p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}</p>
              </div>
            ))}
          </div>
        )}

        {/* Distribuição Brasil vs Outros */}
        {summary && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" /> Distribuição Geográfica
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>🇧🇷 Brasil</span>
                  <span className="font-semibold text-foreground">{summary.brazilUsers} usuários ({summary.brazilPct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${summary.brazilPct}%` }} />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>🌍 Outros países</span>
                  <span className="font-semibold text-foreground">{summary.otherUsers} usuários ({summary.otherPct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${summary.otherPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conversões por Canal + Pizza */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tabela de canais */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-violet-400" /> Conversões por Canal
            </h2>
            <div className="space-y-2">
              {channels.map((c: any) => (
                <div key={c.channel} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHANNEL_COLORS[c.channel] ?? "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="font-medium text-foreground truncate">{c.channel}</span>
                      <span className="text-muted-foreground ml-2 flex-shrink-0">{c.sessions} sess. · {c.conversionRate?.toFixed(1)}% CVR</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${c.pct}%`, backgroundColor: CHANNEL_COLORS[c.channel] ?? "#94a3b8" }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground w-6 text-right flex-shrink-0">{c.conversions}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              Total: <strong>{totalConvByChannel} conversões</strong> · Dados reais GA4 API
            </p>
          </div>

          {/* Pizza de conversões */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-orange-400" /> Distribuição de Conversões
            </h2>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} conv.`, "Conversões"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sem dados de conversão</div>
            )}
          </div>
        </div>

        {/* Tendência Semanal */}
        {weeks.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" /> Tendência Semanal de Sessões por Canal
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeks} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="paid" name="Google Ads (Pago)" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="organic" name="Orgânico (SEO)" fill="#10b981" stackId="a" />
                <Bar dataKey="direct" name="Direto" fill="#8b5cf6" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Páginas */}
        {pages.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" /> Top Páginas por Visualizações
              </h2>
              <button
                onClick={() => exportCSV(pages, "ga4-top-paginas-abril-2026.csv")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Página</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Visualizações</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 font-medium text-foreground">{p.page ?? p.path}</td>
                      <td className="py-2 text-right text-blue-400 font-semibold">{p.views}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.pct}%` }} />
                          </div>
                          <span className="text-muted-foreground w-8">{p.pct?.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Performance de Landing Pages (Google Ads) */}
        {adPages.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-blue-400" /> Performance das Landing Pages (Google Ads)
              </h2>
              <button
                onClick={() => exportCSV(adPages, "ga4-landing-pages-abril-2026.csv")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Página</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Sessões</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Pago</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Orgânico</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Conversões</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Rejeição</th>
                  </tr>
                </thead>
                <tbody>
                  {adPages.map((p: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 font-medium text-foreground max-w-[180px] truncate">{p.title ?? p.page}</td>
                      <td className="py-2 text-right text-muted-foreground">{p.sessions}</td>
                      <td className="py-2 text-right text-blue-400 font-semibold">{p.paidSessions}</td>
                      <td className="py-2 text-right text-emerald-400 font-semibold">{p.organicSessions}</td>
                      <td className="py-2 text-right">
                        <span className={`font-bold ${p.conversions > 0 ? "text-orange-400" : "text-muted-foreground"}`}>{p.conversions}</span>
                      </td>
                      <td className="py-2 text-right">
                        <span className={`${p.bounceRate > 50 ? "text-red-400" : p.bounceRate > 30 ? "text-yellow-400" : "text-emerald-400"}`}>
                          {p.bounceRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Funil de Conversão */}
        {summary && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Filter className="w-4 h-4 text-violet-400" /> Funil de Conversão — Etapas do Usuário
              </h2>
              <span className="text-xs text-muted-foreground">Dados GA4 · Últimos {period === "7d" ? "7 dias" : period === "30d" ? "30 dias" : "90 dias"}</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Impressões (Google Ads)", value: Math.round((summary.totalSessions ?? 0) * 18.5), color: "bg-blue-500", pct: 100, icon: "\uD83D\uDC41" },
                { label: "Cliques (CTR ~10.8%)", value: Math.round((summary.totalSessions ?? 0) * 2.0), color: "bg-violet-500", pct: 10.8, icon: "\uD83D\uDDB1" },
                { label: "Sessões GA4", value: summary.totalSessions ?? 0, color: "bg-indigo-500", pct: Math.round(((summary.totalSessions ?? 0) / Math.max(Math.round((summary.totalSessions ?? 0) * 2.0), 1)) * 100), icon: "\uD83D\uDCC5" },
                { label: "Usuários Engajados", value: Math.round((summary.totalUsers ?? 0) * ((summary.avgEngagementRate ?? 60) / 100)), color: "bg-emerald-500", pct: Math.round((summary.avgEngagementRate ?? 60)), icon: "\u2764" },
                { label: "Conversões", value: summary.conversions ?? 0, color: "bg-orange-500", pct: Math.round(((summary.conversions ?? 0) / Math.max(summary.totalSessions ?? 1, 1)) * 100), icon: "\u2705" },
              ].map((step, i, arr) => {
                const maxVal = arr[0].value;
                const barWidth = maxVal > 0 ? Math.max((step.value / maxVal) * 100, 2) : 2;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-base w-6 text-center">{step.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-foreground">{step.label}</span>
                        <span className="text-muted-foreground">{step.value.toLocaleString("pt-BR")} {i > 0 ? `· ${step.pct.toFixed(1)}% da etapa anterior` : ""}</span>
                      </div>
                      <div className="h-5 rounded-md bg-muted overflow-hidden">
                        <div
                          className={`h-full ${step.color} rounded-md flex items-center justify-end pr-2 transition-all duration-500`}
                          style={{ width: `${barWidth}%` }}
                        >
                          {barWidth > 15 && <span className="text-white text-xs font-bold">{step.value.toLocaleString("pt-BR")}</span>}
                        </div>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="text-xs text-muted-foreground w-12 text-right">
                        {arr[i + 1].value > 0 ? `${((arr[i + 1].value / Math.max(step.value, 1)) * 100).toFixed(1)}%` : "—"}
                      </div>
                    )}
                    {i === arr.length - 1 && <div className="w-12" />}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              * Impressões e Cliques estimados com base no CTR médio das campanhas Google Ads. Sessões e Conversões são dados reais do GA4.
            </p>
          </div>
        )}

        {/* Rodápé com botão exportar PDF */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Dados reais · Google Analytics 4 API · Property G-XN8107LBV6 (zenitetech.com) · Atualizado em {new Date().toLocaleDateString("pt-BR")}
          </p>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Exportar PDF
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
