import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";
import { AlertTriangle, Globe, TrendingUp, Users, MousePointerClick, Target, ExternalLink, Info, ShieldCheck, Download, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CountryFilter = "all" | "brazil" | "others";

const CHANNEL_COLORS: Record<string, string> = {
  "Direto": "#94a3b8",
  "Direct": "#94a3b8",
  "Orgânico (SEO)": "#22c55e",
  "Organic Search": "#22c55e",
  "Google Ads (Pago)": "#3b82f6",
  "Paid Search": "#3b82f6",
  "Redes Sociais": "#f59e0b",
  "Referência": "#ef4444",
};

function KpiCard({
  label, value, sub, icon: Icon, accent = "bg-blue-500",
}: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
            <span className="text-2xl font-bold">{value}</span>
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </div>
          <div className={`p-2 rounded-lg ${accent}`}>
            <Icon className="w-5 h-5 text-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WarningBanner({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="flex-1">
          <span>{message}</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-2 text-xs text-amber-600 underline hover:text-amber-800"
          >
            {expanded ? 'Ocultar guia' : 'Ver guia passo a passo →'}
          </button>
          {expanded && (
            <div className="mt-3 space-y-2">
              <div className="bg-white border border-amber-200 rounded-lg p-3">
                <p className="font-semibold text-amber-800 mb-2">📋 Passo a passo para vincular Google Ads ao GA4:</p>
                <ol className="space-y-1.5 text-amber-700 list-decimal list-inside">
                  <li>Acesse <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">analytics.google.com</a></li>
                  <li>Clique no ⚙️ <strong>Administrador</strong> (canto inferior esquerdo)</li>
                  <li>Na coluna <strong>Propriedade</strong>, clique em <strong>Vinculações de produtos</strong></li>
                  <li>Clique em <strong>Google Ads</strong></li>
                  <li>Clique em <strong>Vincular</strong> e selecione a conta <strong>ZÊNITE TECH</strong></li>
                  <li>Confirme e aguarde até 24h para os dados aparecerem</li>
                </ol>
              </div>
              <div className="bg-white border border-amber-200 rounded-lg p-3">
                <p className="font-semibold text-amber-800 mb-1">💡 Por que isso importa?</p>
                <p className="text-amber-700">Sem a vinculação, o GA4 não consegue atribuir sessões e conversões aos anuncios do Google Ads. Os dados de <strong>Paid Search</strong> ficam subestimados e as conversões não são registradas corretamente.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GA4Analytics() {
  // Padrão: "brazil" — exclui bots internacionais automaticamente
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("brazil");
  // Padrão: "7d" — últimos 7 dias (Semanal)
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");
  const [intlAlertSent, setIntlAlertSent] = useState(false);

  const PERIOD_LABELS: Record<string, string> = { "7d": "Semanal", "30d": "Mensal", "90d": "Trimestral" };

  const { data: ga4Status } = trpc.ga4Real.getStatus.useQuery();

  // Todos os endpoints recebem o countryFilter e period para filtrar na API real
  const { data: summary, isLoading: loadingSummary } = trpc.ga4Real.getSummary.useQuery({ countryFilter, period });
  const { data: channels } = trpc.ga4Real.getTrafficByChannel.useQuery({ countryFilter, period });
  const { data: countries } = trpc.ga4Real.getCountryBreakdown.useQuery();
  const { data: adPages } = trpc.ga4Real.getAdPagesPerformance.useQuery({ countryFilter, period });
  const { data: weeklyTrend } = trpc.ga4Real.getWeeklyTrend.useQuery({ countryFilter, period });
  const { data: topPages } = trpc.ga4Real.getTopPages.useQuery({ countryFilter, period });

  const sendIntlAlert = trpc.ga4Real.sendInternationalTrafficAlert.useMutation({
    onSuccess: () => setIntlAlertSent(true),
  });

  // Exportação CSV dos dados filtrados
  function exportFilteredCSV() {
    const rows: string[] = [];
    rows.push(`"Relatório GA4 Analytics","Período: ${PERIOD_LABELS[period] ?? period}","Filtro: ${countryFilter === "brazil" ? "Brasil" : countryFilter === "others" ? "Outros Países" : "Global"}"`); 
    rows.push("");
    rows.push("=== KPIs ===");
    rows.push(`"Sessões","Usuários","Conversões","Taxa de Engajamento"`);
    rows.push(`"${summary?.totalSessions ?? 0}","${summary?.totalUsers ?? 0}","${summary?.conversions ?? 0}","${summary?.avgEngagementRate?.toFixed(1) ?? 0}%"`);
    rows.push("");
    rows.push("=== Canais ===");
    rows.push(`"Canal","Sessões","% do Total","Conversões","Taxa de Conversão"`);
    (channels ?? []).forEach(ch => {
      rows.push(`"${ch.channel}","${ch.sessions}","${ch.pct?.toFixed(1) ?? 0}%","${ch.conversions ?? 0}","${ch.conversionRate?.toFixed(1) ?? 0}%"`);
    });
    rows.push("");
    rows.push("=== Top Páginas ===");
    rows.push(`"Página","Visualizações","% do Total"`);
    (topPages ?? []).forEach((p: any) => {
      rows.push(`"${p.page}","${p.views}","${p.pct?.toFixed(1) ?? 0}%"`);
    });
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ga4-analytics-${period}-${countryFilter}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loadingSummary) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando dados do GA4...
      </div>
    );
  }

  const brazilUsers = countries?.brazilTotal ?? 0;
  const othersUsers = countries?.othersTotal ?? 0;

  const countryPieData = [
    { name: "🇧🇷 Brasil", value: brazilUsers, fill: "#22c55e" },
    { name: "🌍 Outros países", value: othersUsers, fill: "#64748b" },
  ];

  const channelPieData = (channels ?? []).map(ch => ({
    name: ch.channel,
    value: ch.sessions,
    fill: CHANNEL_COLORS[ch.channel] ?? "#6366f1",
  }));

  const filterLabel = countryFilter === "brazil"
    ? "🇧🇷 Somente Brasil"
    : countryFilter === "others"
      ? "🌍 Excluindo Brasil"
      : "🌐 Todos os países";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe size={24} className="text-blue-500" />
            Google Analytics 4
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {summary?.period} · {ga4Status?.propertyLabel ?? "G-XN8107LBV6 · zenitetech.com"}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {ga4Status && (
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                ga4Status.configured
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ga4Status.configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {ga4Status.configured ? 'Dados em tempo real' : 'Dados estáticos — configure GA4 API'}
              </div>
            )}
            {countryFilter === "brazil" && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <ShieldCheck size={11} />
                Filtro anti-bot ativo — somente Brasil
              </div>
            )}
          </div>
        </div>

        {/* Filtros: Período + País */}
        <div className="flex flex-col items-end gap-3">
          {/* Seletor de período */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">Período</span>
            <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-border">
                      {(["7d", "30d", "90d"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    period === p
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          {/* Filtro Brasil / Outros / Todos */}
          <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground">Filtro de país</span>
          <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-border">
            {(["brazil", "all", "others"] as CountryFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setCountryFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  countryFilter === f
                    ? f === "brazil"
                      ? "bg-green-600 text-white shadow-sm"
                      : "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "🌐 Todos" : f === "brazil" ? "🇧🇷 Brasil" : "🌍 Outros"}
              </button>
            ))}
          </div>
          {countryFilter === "all" && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={10} />
              Inclui bots internacionais — dados inflados
            </p>
          )}
          {countryFilter === "brazil" && (
            <p className="text-xs text-green-600">
              Exibindo apenas usuários reais do Brasil
            </p>
          )}
          </div>
          {/* Botão Exportar CSV */}
          <button
            onClick={exportFilteredCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          >
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Banner de alerta de tráfego internacional */}
      {(() => {
        const totalSess = countries ? (countries.brazilTotal + countries.othersTotal) : 0;
        const othersPct = totalSess > 0 ? (countries!.othersTotal / totalSess) * 100 : 0;
        if (othersPct <= 15) return null;
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm flex items-start gap-3">
            <Bell size={18} className="shrink-0 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <strong>⚠️ Tráfego Internacional elevado:</strong> {othersPct.toFixed(1)}% das sessões são de outros países (limite: 15%). Isso pode indicar bots, crawlers ou campanha ativa fora do Brasil.
            </div>
            <button
              onClick={() => sendIntlAlert.mutate({
                period: period as "7d" | "30d" | "90d",
                brazilSessions: countries?.brazilTotal ?? 0,
                othersSessions: countries?.othersTotal ?? 0,
                totalSessions: totalSess,
                othersPct,
                threshold: 15,
              })}
              disabled={sendIntlAlert.isPending || intlAlertSent}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <Bell size={12} />
              {intlAlertSent ? "Alerta enviado" : sendIntlAlert.isPending ? "Enviando..." : "Enviar alerta"}
            </button>
          </div>
        );
      })()}

      {/* Alerta de vinculação */}
      {!summary?.googleAdsLinked && (
        <WarningBanner message={`⚠️ ${summary?.googleAdsLinkWarning ?? "Conta Google Ads não vinculada ao GA4"} — Para corrigir: GA4 → Administrador → Vinculações de produtos → Google Ads`} />
      )}

      {/* Banner informativo quando filtro Brasil está ativo */}
      {countryFilter === "brazil" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-800 text-sm flex items-center gap-3">
          <ShieldCheck size={18} className="shrink-0 text-green-600" />
          <div>
            <strong>Filtro anti-bot ativo:</strong> Exibindo apenas sessões e usuários do Brasil. Tráfego internacional (EUA, UK, FR, NL, HK) foi excluído — esses acessos são majoritariamente bots e crawlers que inflam os números.
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Sessões Totais"
          value={summary?.totalSessions ?? 0}
          sub={filterLabel}
          icon={TrendingUp}
          accent="bg-blue-500"
        />
        <KpiCard
          label="Usuários Ativos"
          value={summary?.totalUsers ?? 0}
          sub={`${summary?.newUsers ?? 0} novos usuários`}
          icon={Users}
          accent="bg-emerald-500"
        />
        <KpiCard
          label={countryFilter === "brazil" ? "🇧🇷 Usuários Brasil" : countryFilter === "others" ? "🌍 Usuários Outros" : "🌐 Usuários Totais"}
          value={countryFilter === "brazil" ? (summary?.totalUsers ?? 0) : countryFilter === "others" ? (summary?.totalUsers ?? 0) : (summary?.totalUsers ?? 0)}
          sub={countryFilter === "all" ? `${summary?.brazilPct ?? 0}% são do Brasil` : countryFilter === "brazil" ? "público-alvo real" : "bots/crawlers estimados"}
          icon={Target}
          accent={countryFilter === "brazil" ? "bg-green-500" : "bg-slate-500"}
        />
        <KpiCard
          label="Conversões"
          value={summary?.conversions ?? 0}
          sub="ads_conversion_Contato_1"
          icon={MousePointerClick}
          accent="bg-amber-500"
        />
      </div>

      {/* Linha 1: Distribuição por País + Canal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* País — sempre mostra todos os países para contexto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usuários por País (todos)</CardTitle>
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <Info size={12} />
              {countries?.insight ?? "Distribuição real de usuários por país"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={countryPieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {countryPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} usuários`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {(countries?.countries ?? []).slice(0, 6).map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className={`text-foreground ${c.isBrazil ? "font-semibold" : ""}`}>{c.flag} {c.country}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.isBrazil ? "#22c55e" : "#64748b" }} />
                      </div>
                      <span className={`text-xs font-bold ${c.isBrazil ? "text-emerald-600" : "text-muted-foreground"}`}>{c.users}</span>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                  Tráfego internacional = bots/crawlers. Use o filtro 🇧🇷 Brasil para dados reais.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Canal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sessões por Canal · {filterLabel}</CardTitle>
              {!summary?.googleAdsLinked && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Info size={12} />
                "Direto" inflado — cliques pagos aparecem como Direto sem vinculação GA4↔Ads
              </p>
              )}
              {summary?.googleAdsLinked && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <ShieldCheck size={12} />
                GA4 ↔ Google Ads vinculados desde {summary?.googleAdsLinkedAt ? new Date(summary.googleAdsLinkedAt).toLocaleDateString("pt-BR") : "07/04/2026"} — atribuição ativa
              </p>
              )}
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={channelPieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {channelPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} sessões`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {(channels ?? []).map((ch: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{ch.channel}</span>
                      <span className="font-bold" style={{ color: CHANNEL_COLORS[ch.channel] ?? "#6366f1" }}>{ch.sessions} sess.</span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Engaj: {ch.engagementRate?.toFixed(0) ?? 0}%</span>
                      <span>Conv: {ch.conversions}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tendência Semanal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tendência Semanal de Sessões por Canal · {filterLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyTrend ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="direct" name="Direto" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="organic" name="Orgânico" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="paid" name="Google Ads" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance das Páginas dos Anúncios */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Performance das Páginas dos Anúncios · {filterLabel}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Correlação entre cliques no Google Ads e sessões registradas no GA4 por página de destino
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs uppercase border-b border-border">
                  <th className="text-left pb-3 pr-4">Página / Grupo de Anúncio</th>
                  <th className="text-center pb-3 px-3">Views GA4</th>
                  <th className="text-center pb-3 px-3">Pago</th>
                  <th className="text-center pb-3 px-3">Orgânico</th>
                  <th className="text-center pb-3 px-3">Direto</th>
                  <th className="text-center pb-3 px-3">Cliques Ads</th>
                  <th className="text-center pb-3 px-3">CTR Ads</th>
                  <th className="text-center pb-3 px-3">Rastreamento</th>
                  <th className="text-center pb-3 px-3">Conversões</th>
                </tr>
              </thead>
              <tbody>
                {(adPages ?? []).map((p: any, i: number) => {
                  const trackingPct = p.trackingEfficiency ?? 0;
                  const trackingColor = trackingPct >= 50 ? "text-emerald-600" : trackingPct >= 20 ? "text-amber-600" : "text-red-600";
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-medium">
                          <a href={`https://zenitetech.com${p.page}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1">
                            {p.page} <ExternalLink size={10} />
                          </a>
                        </div>
                        <div className="text-xs text-blue-600 mt-0.5">{p.adGroup}</div>
                      </td>
                      <td className="text-center py-3 px-3 font-bold">{p.views}</td>
                      <td className="text-center py-3 px-3 text-blue-600 font-medium">{p.paidSessions}</td>
                      <td className="text-center py-3 px-3 text-emerald-600">{p.organicSessions}</td>
                      <td className="text-center py-3 px-3 text-muted-foreground">{p.directSessions}</td>
                      <td className="text-center py-3 px-3">{p.adsClicks}</td>
                      <td className="text-center py-3 px-3">
                        <span className={`font-bold ${p.adsCtr >= 10 ? "text-emerald-600" : p.adsCtr >= 6 ? "text-amber-600" : "text-red-600"}`}>
                          {p.adsCtr?.toFixed(2) ?? "0.00"}%
                        </span>
                      </td>
                      <td className="text-center py-3 px-3">
                        <div className={`font-bold ${trackingColor}`}>{trackingPct}%</div>
                        <div className="text-xs text-muted-foreground">{p.paidSessions}/{p.adsClicks} sess/cliques</div>
                      </td>
                      <td className="text-center py-3 px-3">
                        <span className={`font-bold ${p.conversions > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{p.conversions}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            {summary?.googleAdsLinked ? (
              <><strong>ℹ️ Rastreamento em normalização:</strong> GA4 ↔ Google Ads vinculados em 07/04/2026. Os dados de rastreamento devem subir para 80–100% nas próximas semanas à medida que o GA4 processa os cliques pagos corretamente.</>
            ) : (
              <><strong>⚠️ Rastreamento baixo:</strong> A coluna "Rastreamento" mostra quantos cliques pagos geraram sessões rastreadas no GA4. Valores abaixo de 50% indicam perda de dados — causada pela falta de vinculação GA4↔Google Ads. Após vincular as contas, esses números devem subir para 80–100%.</>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Páginas Mais Vistas + Ações Necessárias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Páginas Mais Vistas · {filterLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topPages ?? []} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis type="category" dataKey="page" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={110} />
                <Tooltip formatter={(v: number) => [`${v} views`]} />
                <Bar dataKey="views" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resumo de Ações Necessárias */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ações Necessárias para Corrigir os Dados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                summary?.googleAdsLinked
                  ? {
                      priority: "✅",
                      label: "GA4 ↔ Google Ads vinculados",
                      detail: `Conta ${summary?.googleAdsLinkCustomerId ?? "3003291643"} vinculada em ${summary?.googleAdsLinkedAt ? new Date(summary.googleAdsLinkedAt).toLocaleDateString("pt-BR") : "07/04/2026"}`,
                      impact: "Atribuição de sessões pagas ativa — dados em tempo real",
                    }
                  : {
                      priority: "🔴",
                      label: "Vincular GA4 ↔ Google Ads",
                      detail: "GA4 → Administrador → Vinculações de produtos → Google Ads → Vincular conta 300-329-1643",
                      impact: "Corrige 97% das sessões pagas classificadas como Direct",
                    },
                {
                  priority: "🔴",
                  label: "Corrigir tag ads_conversion_Contato_1 no GTM",
                  detail: "GTM → Tags → ads_conversion_Contato_1 → Acionadores: remover acionador de clique no botão. Criar acionador 'Envio de formulário' com filtro Page URL contém /contato. No site zenitetech.com: mover window.gtag('event','generate_lead') para dentro do callback de sucesso do fetch (após status 200), não no onClick do botão.",
                  impact: "Corrige taxa de conversão inflada de 31,6% — conversão deve disparar 1x por lead enviado, não por clique",
                },
                {
                  priority: "🟡",
                  label: "Criar filtro de IP interno",
                  detail: "GA4 → Administrador → Fluxos de dados → Filtros de IP → Adicionar IP do escritório",
                  impact: "Remove acessos internos dos dados de usuários",
                },
                {
                  priority: "🟡",
                  label: "Criar audiências de remarketing",
                  detail: "GA4 → Configurar → Audiências → Criar audiência de visitantes do site",
                  impact: "Habilita campanhas de Display para remarketing",
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-3 bg-secondary/50 rounded-lg border border-border">
                  <span className="text-lg">{item.priority}</span>
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item.detail}</div>
                    <div className="text-xs text-emerald-600 mt-1">Impacto: {item.impact}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
