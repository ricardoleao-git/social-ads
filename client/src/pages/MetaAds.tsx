import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, MousePointer, Eye, Users, RefreshCw, BarChart3, Zap, Info } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

type Period = "7d" | "30d" | "90d";

function KPICard({
  title, value, subtitle, icon: Icon, trend, color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number;
  color: string;
}) {
  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-foreground" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}% vs período anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

// Contas com dados reais conhecidas
const ACCOUNTS_WITH_DATA = [
  { id: "140041686391058", name: "Ricardo Leão (Principal)" },
  { id: "689018166724593", name: "ZÊNITE TECH (Cartão)" },
];

// Períodos históricos com dados reais
const HISTORICAL_PERIODS = [
  { label: "Out-Dez 2025", since: "2025-10-01", until: "2025-12-31" },
  { label: "Out-Dez 2024", since: "2024-10-01", until: "2024-12-31" },
  { label: "2024 Completo", since: "2024-01-01", until: "2024-12-31" },
];

export default function MetaAds() {
  const [period, setPeriod] = useState<Period>("30d");
  const [selectedAccountId, setSelectedAccountId] = useState("140041686391058");
  const [historicalPeriod, setHistoricalPeriod] = useState<string | null>(null);

  // Determinar datas efetivas
  const effectivePeriod = historicalPeriod ? "custom" : period;
  const selectedHistorical = HISTORICAL_PERIODS.find(p => p.label === historicalPeriod);
  const startDate = selectedHistorical?.since;
  const endDate = selectedHistorical?.until;

  const { data: status } = trpc.metaAds.getStatus.useQuery();
  const { data: summaryData, isLoading: loadingSummary, refetch: refetchSummary } = trpc.metaAds.getSummary.useQuery(
    { period: effectivePeriod, startDate, endDate, accountId: selectedAccountId }
  );
  const { data: campaignsData, isLoading: loadingCampaigns } = trpc.metaAds.getCampaigns.useQuery(
    { period: effectivePeriod, startDate, endDate, accountId: selectedAccountId }
  );
  const { data: trendsData, isLoading: loadingTrends } = trpc.metaAds.getTrends.useQuery(
    { period: effectivePeriod, startDate, endDate, accountId: selectedAccountId }
  );
  const { data: comparisonData } = trpc.metaAds.getComparison.useQuery({ period });

  const isSimulated = summaryData?.isSimulated ?? true;
  const hasNoData = !isSimulated && summaryData?.totalSpend === 0 && summaryData?.totalImpressions === 0;

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const formatNumber = (v: number) => v.toLocaleString("pt-BR");

  const comparisonRadarData = comparisonData
    ? [
        { metric: "CTR (%)", Meta: comparisonData.meta.ctr, Google: comparisonData.google.ctr },
        { metric: "Conv.", Meta: comparisonData.meta.conversions, Google: comparisonData.google.conversions },
        { metric: "Cliques", Meta: Math.round(comparisonData.meta.clicks / 100), Google: Math.round(comparisonData.google.clicks / 100) },
        { metric: "Gasto", Meta: Math.round(comparisonData.meta.spend / 100), Google: Math.round(comparisonData.google.spend / 100) },
      ]
    : [];

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meta Ads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Facebook & Instagram Ads — Zênite Tech</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Account selector */}
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {ACCOUNTS_WITH_DATA.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>

          {/* Period selector */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {(["7d", "30d", "90d"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setHistoricalPeriod(null); }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  !historicalPeriod && period === p ? "bg-purple-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {p === "7d" ? "7d" : p === "30d" ? "30d" : "90d"}
              </button>
            ))}
          </div>

          {/* Historical periods */}
          <select
            value={historicalPeriod ?? ""}
            onChange={(e) => setHistoricalPeriod(e.target.value || null)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Período recente</option>
            {HISTORICAL_PERIODS.map((p) => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>

          <Button variant="outline" size="sm" onClick={() => refetchSummary()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Status banners */}
      {!isSimulated && !hasNoData && (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <p className="text-sm text-green-800">
            <strong>Dados reais conectados</strong> — Meta Graph API ativa • Conta: {ACCOUNTS_WITH_DATA.find(a => a.id === selectedAccountId)?.name}
            {historicalPeriod && <span className="ml-2 text-green-700">• Período histórico: {historicalPeriod}</span>}
          </p>
        </div>
      )}
      {!isSimulated && hasNoData && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Sem dados no período selecionado</p>
            <p className="text-xs text-blue-700 mt-0.5">
              As campanhas Meta Ads estão inativas em 2026. Use os <strong>períodos históricos</strong> no seletor acima para ver dados reais de Out-Dez 2025 ou Out-Dez 2024.
            </p>
          </div>
        </div>
      )}
      {isSimulated && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Dados simulados — Meta Ads API não configurada</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Configure os secrets <strong>META_ADS_ACCESS_TOKEN</strong> e <strong>META_ADS_ACCOUNT_ID</strong> para ver dados reais.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl animate-pulse" />
          ))}
        </div>
      ) : summaryData ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title="Gasto Total" value={formatCurrency(summaryData.totalSpend)} subtitle={`Período: ${period}`} icon={DollarSign} color="bg-purple-500" />
          <KPICard title="Impressões" value={formatNumber(summaryData.totalImpressions)} subtitle="Total de exibições" icon={Eye} color="bg-blue-500" />
          <KPICard title="Cliques" value={formatNumber(summaryData.totalClicks)} subtitle={`CTR: ${summaryData.avgCtr.toFixed(2)}%`} icon={MousePointer} color="bg-indigo-500" />
          <KPICard title="Alcance" value={formatNumber(summaryData.totalReach)} subtitle={`Freq: ${summaryData.avgFrequency.toFixed(2)}x`} icon={Users} color="bg-teal-500" />
          <KPICard title="Conversões" value={formatNumber(summaryData.totalConversions)} subtitle="Leads + Compras" icon={Zap} color="bg-green-500" />
          <KPICard title="CPM Médio" value={formatCurrency(summaryData.avgCpm)} subtitle="Custo por mil impressões" icon={BarChart3} color="bg-orange-500" />
          <KPICard title="CPC Médio" value={formatCurrency(summaryData.avgCpc)} subtitle="Custo por clique" icon={TrendingUp} color="bg-pink-500" />
          <KPICard
            title="Custo/Conversão"
            value={summaryData.totalConversions > 0 ? formatCurrency(summaryData.totalSpend / summaryData.totalConversions) : "—"}
            subtitle="CPL médio"
            icon={DollarSign}
            color="bg-red-500"
          />
        </div>
      ) : null}

      {/* Trends chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-800">Tendência Diária — Gasto e Cliques</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTrends ? (
            <div className="h-64 bg-gray-100 rounded animate-pulse" />
          ) : trendsData?.trends ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendsData.trends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => [
                  name === "spend" ? `R$ ${v.toFixed(2)}` : v.toLocaleString("pt-BR"),
                  name === "spend" ? "Gasto" : name === "clicks" ? "Cliques" : "Conversões",
                ]} />
                <Legend formatter={(v) => v === "spend" ? "Gasto (R$)" : v === "clicks" ? "Cliques" : "Conversões"} />
                <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="clicks" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </CardContent>
      </Card>

      {/* Campaigns table + Google vs Meta comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaigns */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-gray-800">Campanhas</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCampaigns ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 text-xs font-semibold text-muted-foreground uppercase">Campanha</th>
                        <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase">Gasto</th>
                        <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase">CTR</th>
                        <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase">CPC</th>
                        <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase">Conv.</th>
                        <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase">CPL</th>
                        <th className="text-center py-2 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(campaignsData?.campaigns ?? []).map((c) => (
                        <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-gray-800 text-xs leading-tight">{c.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{c.objective.replace(/_/g, " ")}</p>
                          </td>
                          <td className="py-3 text-right text-xs font-semibold text-gray-700">
                            {formatCurrency(c.spend)}
                          </td>
                          <td className="py-3 text-right text-xs">
                            <span className={c.ctr >= 4 ? "text-green-600 font-semibold" : c.ctr >= 2 ? "text-yellow-600" : "text-red-500"}>
                              {c.ctr.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 text-right text-xs text-gray-600">{formatCurrency(c.cpc)}</td>
                          <td className="py-3 text-right text-xs font-semibold text-gray-700">{c.conversions}</td>
                          <td className="py-3 text-right text-xs text-gray-600">
                            {c.costPerConversion > 0 ? formatCurrency(c.costPerConversion) : "—"}
                          </td>
                          <td className="py-3 text-center">
                            <Badge className={`text-xs ${c.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-muted-foreground"}`}>
                              {c.status === "ACTIVE" ? "Ativo" : "Pausado"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Google vs Meta comparison */}
        <div>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-gray-800">Google vs Meta</CardTitle>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {comparisonData ? (
                <div className="space-y-4">
                  {/* Radar chart */}
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={comparisonRadarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis tick={{ fontSize: 9 }} />
                      <Radar name="Meta" dataKey="Meta" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                      <Radar name="Google" dataKey="Google" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>

                  {/* Comparison table */}
                  <div className="space-y-2">
                    {[
                      { label: "Gasto", meta: formatCurrency(comparisonData.meta.spend), google: formatCurrency(comparisonData.google.spend) },
                      { label: "Cliques", meta: formatNumber(comparisonData.meta.clicks), google: formatNumber(comparisonData.google.clicks) },
                      { label: "CTR", meta: `${comparisonData.meta.ctr.toFixed(2)}%`, google: `${comparisonData.google.ctr.toFixed(2)}%` },
                      { label: "CPC", meta: formatCurrency(comparisonData.meta.cpc), google: formatCurrency(comparisonData.google.cpc) },
                      { label: "Conversões", meta: String(comparisonData.meta.conversions), google: String(comparisonData.google.conversions) },
                      { label: "CPL", meta: formatCurrency(comparisonData.meta.costPerConversion), google: formatCurrency(comparisonData.google.costPerConversion) },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50">
                        <span className="text-muted-foreground font-medium w-20">{row.label}</span>
                        <span className="text-purple-600 font-semibold w-24 text-right">{row.meta}</span>
                        <span className="text-blue-600 font-semibold w-24 text-right">{row.google}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span className="text-purple-500 font-semibold">● Meta</span>
                    <span className="text-blue-500 font-semibold">● Google</span>
                  </div>
                </div>
              ) : (
                <div className="h-48 bg-gray-100 rounded animate-pulse" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ad sets performance bar chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-800">Conjuntos de Anúncios — Gasto por Conjunto</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={(campaignsData?.campaigns ?? []).map((c) => ({
                name: c.name.length > 30 ? c.name.slice(0, 30) + "…" : c.name,
                gasto: c.spend,
                conversoes: c.conversions,
              }))}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number, name: string) => [
                name === "gasto" ? `R$ ${v.toFixed(2)}` : v,
                name === "gasto" ? "Gasto" : "Conversões",
              ]} />
              <Legend />
              <Bar dataKey="gasto" fill="#8b5cf6" name="Gasto (R$)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="conversoes" fill="#10b981" name="Conversões" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Setup instructions */}
      {!status?.isConfigured && (
        <Card className="border-0 shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-800">Como conectar o Meta Ads</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">1</span>
                <span>Acesse <strong>business.facebook.com</strong> → Configurações → Usuários do Sistema → Criar usuário do sistema (Administrador)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">2</span>
                <span>Gere um token de acesso com permissões: <code className="bg-gray-100 px-1 rounded">ads_read</code>, <code className="bg-gray-100 px-1 rounded">ads_management</code>, <code className="bg-gray-100 px-1 rounded">business_management</code></span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">3</span>
                <span>Copie o <strong>ID da conta de anúncios</strong> (formato: <code className="bg-gray-100 px-1 rounded">act_XXXXXXXX</code>)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">4</span>
                <span>Configure os secrets no painel: <strong>META_ADS_ACCESS_TOKEN</strong> e <strong>META_ADS_ACCOUNT_ID</strong></span>
              </li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
