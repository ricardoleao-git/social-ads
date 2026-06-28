import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, Users, BarChart2, Instagram, Facebook,
  ArrowRight, Activity, DollarSign, Target,
  Zap, RefreshCw, AlertTriangle, CheckCircle, Clock,
  Eye, MousePointer, Percent, Award, ArrowDown, ChevronDown, ChevronUp, X
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  FunnelChart, Funnel, LabelList
} from "recharts";

type Period = "7d" | "30d" | "90d";
const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
};

const TICKET_MEDIO = 2500;

const FUNNEL_COLORS = ["#3b82f6", "#8b5cf6", "#10b981"];
const CAMPAIGN_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export default function ExecutiveSummary() {
  const [, setLocation] = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("7d");
  const [drillDownStage, setDrillDownStage] = useState<string | null>(null);
  const [showDrillDown, setShowDrillDown] = useState(false);

  const { data: campaignsData, isLoading: campaignsLoading } = trpc.googleAds.getCampaigns.useQuery(
    undefined, { staleTime: 300_000 }
  );
  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = trpc.googleAds.getSummary.useQuery(
    { period }, { staleTime: 300_000 }
  );
  const { data: adGroupsData, isLoading: adGroupsLoading, refetch: refetchAdGroups } = trpc.googleAds.getAdGroups.useQuery(
    { period }, { staleTime: 300_000 }
  );
  const { data: funnelData, isLoading: funnelLoading, refetch: refetchFunnel } = trpc.googleAds.getCampaignFunnel.useQuery(
    { period }, { staleTime: 300_000 }
  );
  const { data: igAccounts, isLoading: igLoading, refetch: refetchIg } = trpc.instagram.getAccounts.useQuery(
    undefined, { staleTime: 300_000 }
  );
  const { data: metaComparison, isLoading: metaLoading, refetch: refetchMeta } = trpc.metaAds.getComparison.useQuery(
    { period }, { staleTime: 300_000 }
  );
  const { data: metaStatus } = trpc.metaAds.getStatus.useQuery(undefined, { staleTime: 600_000 });

  const campaigns = campaignsData?.campaigns ?? [];
  const activeCampaigns = campaigns.filter((c: any) => c.status === "ENABLED").length;
  const totalSpend = summaryData?.summary?.totalSpend ?? 0;
  const totalConversions = summaryData?.summary?.totalConversions ?? 0;
  const totalClicks = summaryData?.summary?.totalClicks ?? 0;
  const totalImpressions = summaryData?.summary?.totalImpressions ?? 0;
  const avgCtr = (summaryData?.summary?.avgCtr ?? 0) * 100;
  const avgCpc = summaryData?.summary?.avgCpc ?? 0;
  const metricsLoading = campaignsLoading || summaryLoading;

  // ROAS calculation
  const estimatedRevenue = totalConversions * TICKET_MEDIO;
  const roas = totalSpend > 0 ? estimatedRevenue / totalSpend : 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const convRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  // Funnel stages (global)
  const funnelStages = useMemo(() => [
    { stage: "Impressões", value: totalImpressions, color: "#3b82f6", icon: Eye, key: "impressions" },
    { stage: "Cliques", value: totalClicks, color: "#8b5cf6", icon: MousePointer, key: "clicks" },
    { stage: "Conversões", value: totalConversions, color: "#10b981", icon: Target, key: "conversions" },
  ], [totalImpressions, totalClicks, totalConversions]);

  // Campaign funnel data for drill-down
  const campaignFunnelItems = useMemo(() => {
    return (funnelData?.campaigns ?? []).filter((c: any) => c.impressions > 0);
  }, [funnelData]);

  // Drill-down data: when user clicks a funnel stage, show per-campaign breakdown
  const drillDownData = useMemo(() => {
    if (!drillDownStage || !campaignFunnelItems.length) return [];
    const metricKey = drillDownStage as "impressions" | "clicks" | "conversions";
    return campaignFunnelItems
      .map((c: any, i: number) => ({
        name: c.name.length > 25 ? c.name.substring(0, 25) + "…" : c.name,
        fullName: c.name,
        value: c[metricKey] ?? 0,
        spend: c.spend,
        color: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length],
      }))
      .filter((d: any) => d.value > 0)
      .sort((a: any, b: any) => b.value - a.value);
  }, [drillDownStage, campaignFunnelItems]);

  // Instagram
  const seenHandles = new Set<string>();
  const activeIgAccounts = (igAccounts ?? [])
    .filter((a: any) => a.isActive && Number(a.followersCount) > 0)
    .filter((a: any) => {
      const handle = (a.accountHandle ?? '').toLowerCase();
      if (seenHandles.has(handle)) return false;
      seenHandles.add(handle);
      return true;
    });
  const totalFollowers = activeIgAccounts.reduce((sum: number, a: any) => sum + (Number(a.followersCount) || 0), 0);

  // Top 3 ad groups by clicks
  const allAdGroups = adGroupsData?.adGroups ?? [];
  const top3 = [...allAdGroups]
    .filter((g: any) => Number(g.clicks) > 0)
    .sort((a: any, b: any) => Number(b.clicks) - Number(a.clicks))
    .slice(0, 3);

  // Top 5 campaign performance for bar chart
  const campaignBarData = useMemo(() => {
    const grouped: Record<string, { name: string; clicks: number; conversions: number; spend: number }> = {};
    for (const g of allAdGroups as any[]) {
      const camp = g.campaignName ?? "Outros";
      if (!grouped[camp]) grouped[camp] = { name: camp, clicks: 0, conversions: 0, spend: 0 };
      grouped[camp].clicks += Number(g.clicks) || 0;
      grouped[camp].conversions += Number(g.conversions) || 0;
      grouped[camp].spend += Number(g.cost) || 0;
    }
    return Object.values(grouped).sort((a, b) => b.clicks - a.clicks).slice(0, 5);
  }, [allAdGroups]);

  const handleRefresh = () => {
    setRefreshing(true);
    refetchSummary();
    refetchIg();
    refetchAdGroups();
    refetchFunnel();
    refetchMeta();
    setTimeout(() => setRefreshing(false), 2000);
  };

  const handleFunnelClick = (stageKey: string, stageName: string) => {
    if (drillDownStage === stageKey) {
      setDrillDownStage(null);
      setShowDrillDown(false);
    } else {
      setDrillDownStage(stageKey);
      setShowDrillDown(true);
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const stageLabels: Record<string, string> = {
    impressions: "Impressões",
    clicks: "Cliques",
    conversions: "Conversões",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Painel Executivo</h1>
          <p className="text-muted-foreground text-sm mt-1 capitalize">{dateStr} · {timeStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(["7d", "30d", "90d"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  period === p ? "bg-white text-blue-700 shadow-sm font-semibold" : "text-muted-foreground hover:text-gray-700"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Hero KPIs — 6 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-xs text-muted-foreground font-medium">Gasto Total</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {metricsLoading ? "..." : `R$ ${totalSpend.toFixed(0)}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{PERIOD_LABELS[period]}</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-1">
            <MousePointer className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-muted-foreground font-medium">Cliques</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {metricsLoading ? "..." : totalClicks.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">CTR: {avgCtr.toFixed(2)}%</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-muted-foreground font-medium">Conversões</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {metricsLoading ? "..." : totalConversions.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Taxa: {convRate.toFixed(1)}%</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-orange-500">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-orange-600" />
            <span className="text-xs text-muted-foreground font-medium">CPA Real</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {metricsLoading ? "..." : cpa > 0 ? `R$ ${cpa.toFixed(0)}` : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Custo por conversão</p>
        </Card>

        <Card className={`p-4 border-l-4 ${roas >= 5 ? "border-l-emerald-500" : roas >= 2 ? "border-l-yellow-500" : "border-l-red-500"}`}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground font-medium">ROAS Estimado</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {metricsLoading ? "..." : `${roas.toFixed(1)}x`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Ticket: R$ {TICKET_MEDIO.toLocaleString("pt-BR")}</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-pink-500">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-pink-600" />
            <span className="text-xs text-muted-foreground font-medium">Seguidores</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {igLoading ? "..." : totalFollowers.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Instagram</p>
        </Card>
      </div>

      {/* Funil de Conversão Interativo + Campanhas Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Funil de Conversão Interativo */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDown className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-800">Funil de Conversão</h3>
            <span className="text-xs text-muted-foreground">{PERIOD_LABELS[period]}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Clique em uma etapa para ver o detalhamento por campanha
          </p>
          {metricsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
              <RefreshCw className="w-3 h-3 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="space-y-3">
              {funnelStages.map((item, i) => {
                const maxVal = funnelStages[0].value || 1;
                const widthPct = Math.max((item.value / maxVal) * 100, 8);
                const convFromPrev = i > 0 && funnelStages[i - 1].value > 0
                  ? ((item.value / funnelStages[i - 1].value) * 100).toFixed(1)
                  : null;
                const Icon = item.icon;
                const isSelected = drillDownStage === item.key;
                return (
                  <div key={item.stage}>
                    <div
                      className={`cursor-pointer rounded-lg p-2 transition-all ${
                        isSelected
                          ? "bg-blue-50 ring-2 ring-blue-300"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => handleFunnelClick(item.key, item.stage)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color: item.color }} />
                          <span className="text-sm font-medium text-gray-700">{item.stage}</span>
                          {isSelected && <ChevronUp className="w-3 h-3 text-blue-500" />}
                          {!isSelected && <ChevronDown className="w-3 h-3 text-gray-400" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: item.color }}>
                            {item.value.toLocaleString("pt-BR")}
                          </span>
                          {convFromPrev && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                              {convFromPrev}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-8 overflow-hidden">
                        <div
                          className="h-8 rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                          style={{ width: `${widthPct}%`, backgroundColor: item.color }}
                        >
                          {widthPct > 20 && (
                            <span className="text-xs font-bold text-white">{widthPct.toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {i < funnelStages.length - 1 && (
                      <div className="flex justify-center my-1">
                        <ArrowDown className="w-3 h-3 text-gray-300" />
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Summary line */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Faturamento estimado</span>
                <span className="text-sm font-bold text-emerald-700">
                  R$ {estimatedRevenue.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Drill-Down por Campanha OU Campanhas Bar Chart */}
        {showDrillDown && drillDownStage ? (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-semibold text-gray-800">
                  {stageLabels[drillDownStage] ?? drillDownStage} por Campanha
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowDrillDown(false); setDrillDownStage(null); }}
                className="text-xs gap-1"
              >
                <X className="w-3 h-3" /> Fechar
              </Button>
            </div>
            {funnelLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
                <RefreshCw className="w-3 h-3 animate-spin" /> Carregando...
              </div>
            ) : drillDownData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhum dado disponível.</p>
            ) : (
              <>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={drillDownData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip
                        formatter={(value: any) => [Number(value).toLocaleString("pt-BR"), stageLabels[drillDownStage!]]}
                        labelFormatter={(label: string) => {
                          const item = drillDownData.find((d: any) => d.name === label);
                          return item?.fullName ?? label;
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {drillDownData.map((entry: any, idx: number) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Table below chart */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-medium text-gray-600">Campanha</th>
                        <th className="text-right py-2 font-medium text-gray-600">{stageLabels[drillDownStage!]}</th>
                        <th className="text-right py-2 font-medium text-gray-600">% do Total</th>
                        <th className="text-right py-2 font-medium text-gray-600">Gasto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillDownData.map((item: any, idx: number) => {
                        const totalVal = drillDownData.reduce((s: number, d: any) => s + d.value, 0);
                        const pct = totalVal > 0 ? ((item.value / totalVal) * 100).toFixed(1) : "0";
                        return (
                          <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 text-gray-800 font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                {item.fullName}
                              </div>
                            </td>
                            <td className="text-right py-2 font-semibold text-gray-900">
                              {Number(item.value).toLocaleString("pt-BR")}
                            </td>
                            <td className="text-right py-2 text-gray-600">{pct}%</td>
                            <td className="text-right py-2 text-gray-600">R$ {item.spend.toFixed(0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        ) : (
          /* Campanhas Bar Chart (default view) */
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart2 className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-800">Performance por Campanha</h3>
              <span className="text-xs text-muted-foreground">{PERIOD_LABELS[period]}</span>
            </div>
            {adGroupsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
                <RefreshCw className="w-3 h-3 animate-spin" /> Carregando...
              </div>
            ) : campaignBarData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhum dado disponível.</p>
            ) : (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => v.length > 18 ? v.substring(0, 18) + "…" : v}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        if (name === "clicks") return [value, "Cliques"];
                        if (name === "conversions") return [value, "Conversões"];
                        return [value, name];
                      }}
                    />
                    <Bar dataKey="clicks" fill="#3b82f6" radius={[0, 4, 4, 0]} name="clicks" />
                    <Bar dataKey="conversions" fill="#10b981" radius={[0, 4, 4, 0]} name="conversions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Top 3 Grupos de Anúncios — Large Cards */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-yellow-600" />
          <h3 className="text-sm font-semibold text-gray-800">Top 3 Grupos de Anúncios</h3>
          <span className="text-xs text-muted-foreground">por cliques · {PERIOD_LABELS[period]}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {adGroupsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
                <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </Card>
            ))
          ) : top3.length === 0 ? (
            <Card className="p-5 col-span-3">
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado disponível.</p>
            </Card>
          ) : (
            top3.map((group: any, index: number) => {
              const medals = ["🥇", "🥈", "🥉"];
              const borderColors = ["border-l-yellow-400", "border-l-gray-400", "border-l-amber-600"];
              const bgColors = ["bg-yellow-50", "bg-gray-50", "bg-amber-50"];
              const clicks = Number(group.clicks);
              const conversions = Number(group.conversions);
              const ctr = (Number(group.ctr) * 100).toFixed(2);
              const cost = Number(group.cost);
              const groupCpa = conversions > 0 ? cost / conversions : 0;

              return (
                <Card key={group.id ?? index} className={`p-5 border-l-4 ${borderColors[index]} ${bgColors[index]}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{medals[index]}</span>
                    <span className="text-xs text-muted-foreground">{group.campaignName}</span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 leading-tight">{group.name}</h4>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Cliques</p>
                      <p className="text-lg font-bold text-blue-700">{clicks}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Conversões</p>
                      <p className="text-lg font-bold text-emerald-700">{conversions}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CTR</p>
                      <p className="text-sm font-semibold text-gray-800">{ctr}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CPA</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {groupCpa > 0 ? `R$ ${groupCpa.toFixed(0)}` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Gasto</span>
                      <span className="text-xs font-bold text-gray-700">R$ {cost.toFixed(0)}</span>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Google vs Meta — Visão Unificada */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-gray-800">Google Ads vs Meta Ads</h3>
            <span className="text-xs text-muted-foreground">{PERIOD_LABELS[period]}</span>
            {metaComparison?.isSimulated && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Meta simulado</span>
            )}
          </div>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setLocation("/meta-ads")}>
            <Facebook className="w-3 h-3" /> Ver Meta Ads
          </Button>
        </div>
        {metaLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
            <RefreshCw className="w-3 h-3 animate-spin" /> Carregando...
          </div>
        ) : metaComparison ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Gasto", google: `R$ ${metaComparison.google.spend.toFixed(0)}`, meta: `R$ ${metaComparison.meta.spend.toFixed(0)}`, total: `R$ ${(metaComparison.google.spend + metaComparison.meta.spend).toFixed(0)}` },
              { label: "Cliques", google: metaComparison.google.clicks.toLocaleString("pt-BR"), meta: metaComparison.meta.clicks.toLocaleString("pt-BR"), total: (metaComparison.google.clicks + metaComparison.meta.clicks).toLocaleString("pt-BR") },
              { label: "Conversões", google: String(metaComparison.google.conversions), meta: String(metaComparison.meta.conversions), total: String(metaComparison.google.conversions + metaComparison.meta.conversions) },
              { label: "CPC", google: `R$ ${metaComparison.google.cpc.toFixed(2)}`, meta: `R$ ${metaComparison.meta.cpc.toFixed(2)}`, total: "—" },
              { label: "CTR", google: `${metaComparison.google.ctr.toFixed(2)}%`, meta: `${metaComparison.meta.ctr.toFixed(2)}%`, total: "—" },
              { label: "CPL", google: metaComparison.google.costPerConversion > 0 ? `R$ ${metaComparison.google.costPerConversion.toFixed(0)}` : "—", meta: metaComparison.meta.costPerConversion > 0 ? `R$ ${metaComparison.meta.costPerConversion.toFixed(0)}` : "—", total: "—" },
            ].map((row) => (
              <div key={row.label} className="text-center">
                <p className="text-xs text-muted-foreground font-medium mb-2">{row.label}</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold text-blue-700">{row.google}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-xs font-semibold text-purple-700">{row.meta}</span>
                  </div>
                  {row.total !== "—" && (
                    <div className="pt-1 border-t border-gray-100">
                      <span className="text-xs font-bold text-gray-900">{row.total}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado disponível.</p>
        )}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-blue-500" /> Google Ads
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-purple-500" /> Meta Ads {metaComparison?.isSimulated ? "(simulado)" : ""}
          </div>
          {!metaStatus?.isConfigured && (
            <span className="text-xs text-yellow-600 ml-auto">Configure META_ADS_ACCESS_TOKEN para dados reais</span>
          )}
        </div>
      </Card>

      {/* Status Row — 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-500" />
            <h3 className="text-sm font-semibold text-gray-800">Automações</h3>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ativas</span>
              <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">8/8</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full w-full" />
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => setLocation("/automacoes")}>
            Ver Automações
          </Button>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Status Google Ads</h3>
          </div>
          {campaignsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <RefreshCw className="w-3 h-3 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs text-gray-600">{activeCampaigns} campanha(s) ativa(s)</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs text-gray-600">{totalConversions} conversões</span>
              </div>
              <div className="flex items-center gap-2">
                <Percent className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs text-gray-600">CTR: {avgCtr.toFixed(2)}%</span>
              </div>
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => setLocation("/")}>
            Ver Campanhas
          </Button>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-gray-800">Ações Rápidas</h3>
          </div>
          <div className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => setLocation("/recommendations")}>
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              Recomendações Google
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => setLocation("/competitive-analysis")}>
              <BarChart2 className="w-3.5 h-3.5 text-purple-500" />
              Análise Competitiva
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => setLocation("/redes-sociais")}>
              <Instagram className="w-3.5 h-3.5 text-pink-500" />
              Instagram Analytics
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => setLocation("/meta-ads")}>
              <Facebook className="w-3.5 h-3.5 text-purple-500" />
              Meta Ads
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
