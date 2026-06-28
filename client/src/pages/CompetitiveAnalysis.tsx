import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart2, RefreshCw, Trophy, Target, Eye, ArrowUpDown,
  TrendingUp, TrendingDown, Shield, AlertTriangle, ChevronDown,
  Award, Percent, Layers
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from "recharts";

type Period = "7d" | "30d" | "90d";
const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
};

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"];

type SortKey = "impressionShare" | "overlapRate" | "positionAboveRate" | "topImpressionPct" | "absTopImpressionPct" | "outrankingShare";

export default function CompetitiveAnalysis() {
  const [period, setPeriod] = useState<Period>("30d");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortKey>("impressionShare");
  const [sortAsc, setSortAsc] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: campaignsData } = trpc.googleAds.getCampaigns.useQuery(undefined, { staleTime: 300_000 });
  const {
    data: insightsData,
    isLoading,
    refetch,
  } = trpc.googleAds.getAuctionInsights.useQuery(
    { period, campaignId: selectedCampaignId },
    { staleTime: 300_000 }
  );

  const campaigns = campaignsData?.campaigns ?? [];
  const competitors = insightsData?.competitors ?? [];
  const yourDomain = insightsData?.yourDomain;
  const totalCompetitors = insightsData?.totalCompetitors ?? 0;
  const hasData = insightsData?.success && competitors.length > 0;
  const apiError = insightsData?.error;

  // Sort competitors
  const sortedCompetitors = useMemo(() => {
    return [...competitors].sort((a: any, b: any) => {
      const diff = sortAsc ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy];
      return diff;
    });
  }, [competitors, sortBy, sortAsc]);

  // Top 10 for charts
  const top10 = sortedCompetitors.slice(0, 10);

  // Radar data for top 5
  const radarData = useMemo(() => {
    const top5 = sortedCompetitors.slice(0, 5);
    if (top5.length === 0) return [];
    const metrics = [
      { key: "impressionShare", label: "Impr. Share" },
      { key: "overlapRate", label: "Overlap" },
      { key: "topImpressionPct", label: "Top Impr." },
      { key: "absTopImpressionPct", label: "Abs. Top" },
      { key: "outrankingShare", label: "Outranking" },
    ];
    return metrics.map((m) => {
      const entry: any = { metric: m.label };
      top5.forEach((c: any, i: number) => {
        const shortName = c.domain.length > 15 ? c.domain.substring(0, 15) + "…" : c.domain;
        entry[shortName] = c[m.key];
      });
      return entry;
    });
  }, [sortedCompetitors]);

  const radarDomains = useMemo(() => {
    return sortedCompetitors.slice(0, 5).map((c: any) =>
      c.domain.length > 15 ? c.domain.substring(0, 15) + "…" : c.domain
    );
  }, [sortedCompetitors]);

  // Bar chart data for impression share
  const barData = useMemo(() => {
    return top10.map((c: any, i: number) => ({
      name: c.domain.length > 20 ? c.domain.substring(0, 20) + "…" : c.domain,
      fullName: c.domain,
      value: c.impressionShare,
      color: COLORS[i % COLORS.length],
      isYou: yourDomain ? c.domain === yourDomain.domain : false,
    }));
  }, [top10, yourDomain]);

  // Summary metrics
  const avgCompetitorIS = useMemo(() => {
    const others = competitors.filter((c: any) => !yourDomain || c.domain !== yourDomain.domain);
    if (others.length === 0) return 0;
    return others.reduce((s: number, c: any) => s + c.impressionShare, 0) / others.length;
  }, [competitors, yourDomain]);

  const yourPosition = useMemo(() => {
    if (!yourDomain) return null;
    const sorted = [...competitors].sort((a: any, b: any) => b.impressionShare - a.impressionShare);
    const idx = sorted.findIndex((c: any) => c.domain === yourDomain.domain);
    return idx >= 0 ? idx + 1 : null;
  }, [competitors, yourDomain]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    refetch();
    setTimeout(() => setRefreshing(false), 2000);
  };

  const SortIcon = ({ col }: { col: SortKey }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-0.5 ${sortBy === col ? "text-blue-600" : "text-gray-400"}`} />
  );

  const metricLabel = (key: string) => {
    const labels: Record<string, string> = {
      impressionShare: "Impression Share",
      overlapRate: "Overlap Rate",
      positionAboveRate: "Position Above",
      topImpressionPct: "Top Impression %",
      absTopImpressionPct: "Abs. Top Impr. %",
      outrankingShare: "Outranking Share",
    };
    return labels[key] ?? key;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Análise Competitiva</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auction Insights — posição relativa vs. concorrentes no leilão do Google Ads
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <div className="relative">
            <select
              className="text-xs border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 pr-7 appearance-none cursor-pointer"
              value={selectedCampaignId ?? ""}
              onChange={(e) => setSelectedCampaignId(e.target.value || undefined)}
            >
              <option value="">Todas as campanhas</option>
              {campaigns.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Loading / Error / No Data */}
      {isLoading ? (
        <Card className="p-12 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando dados de Auction Insights...</p>
        </Card>
      ) : !hasData ? (
        <Card className="p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Dados não disponíveis</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {apiError
              ? `Erro: ${apiError}`
              : "Auction Insights pode não estar disponível para esta conta ou período. Tente um período mais longo ou verifique se há campanhas de Pesquisa ativas."}
          </p>
        </Card>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4 border-l-4 border-l-blue-500">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-muted-foreground font-medium">Concorrentes</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalCompetitors}</p>
              <p className="text-xs text-muted-foreground mt-0.5">domínios no leilão</p>
            </Card>

            <Card className="p-4 border-l-4 border-l-purple-500">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-muted-foreground font-medium">Sua Posição</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {yourPosition ? `#${yourPosition}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">por Impression Share</p>
            </Card>

            <Card className="p-4 border-l-4 border-l-green-500">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-4 h-4 text-green-600" />
                <span className="text-xs text-muted-foreground font-medium">Seu Impr. Share</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {yourDomain ? `${yourDomain.impressionShare}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {yourDomain && avgCompetitorIS > 0
                  ? yourDomain.impressionShare > avgCompetitorIS
                    ? `${(yourDomain.impressionShare - avgCompetitorIS).toFixed(0)}% acima da média`
                    : `${(avgCompetitorIS - yourDomain.impressionShare).toFixed(0)}% abaixo da média`
                  : "vs. concorrentes"}
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-l-orange-500">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-orange-600" />
                <span className="text-xs text-muted-foreground font-medium">Seu Outranking</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {yourDomain ? `${yourDomain.outrankingShare}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">taxa de superação</p>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Bar Chart — Impression Share */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-800">Impression Share — Top 10</h3>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, "Impression Share"]}
                      labelFormatter={(label: string) => {
                        const item = barData.find((d: any) => d.name === label);
                        return item?.fullName ?? label;
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {barData.map((entry: any, idx: number) => (
                        <Cell
                          key={idx}
                          fill={entry.isYou ? "#10b981" : entry.color}
                          stroke={entry.isYou ? "#059669" : "none"}
                          strokeWidth={entry.isYou ? 2 : 0}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {yourDomain && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
                  Verde = seu domínio ({yourDomain.domain})
                </p>
              )}
            </Card>

            {/* Radar Chart — Top 5 */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <Target className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-semibold text-gray-800">Comparativo Multidimensional — Top 5</h3>
              </div>
              {radarData.length > 0 ? (
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                      {radarDomains.map((domain: string, i: number) => (
                        <Radar
                          key={domain}
                          name={domain}
                          dataKey={domain}
                          stroke={COLORS[i % COLORS.length]}
                          fill={COLORS[i % COLORS.length]}
                          fillOpacity={0.15}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Dados insuficientes para radar.</p>
              )}
            </Card>
          </div>

          {/* Full Table */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-800">Tabela Completa de Concorrentes</h3>
              <span className="text-xs text-muted-foreground">({totalCompetitors} domínios)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-600 pr-4">#</th>
                    <th className="text-left py-2 font-medium text-gray-600 pr-4">Domínio</th>
                    <th
                      className="text-right py-2 font-medium text-gray-600 pr-4 cursor-pointer hover:text-blue-600"
                      onClick={() => handleSort("impressionShare")}
                    >
                      Impr. Share <SortIcon col="impressionShare" />
                    </th>
                    <th
                      className="text-right py-2 font-medium text-gray-600 pr-4 cursor-pointer hover:text-blue-600"
                      onClick={() => handleSort("overlapRate")}
                    >
                      Overlap <SortIcon col="overlapRate" />
                    </th>
                    <th
                      className="text-right py-2 font-medium text-gray-600 pr-4 cursor-pointer hover:text-blue-600"
                      onClick={() => handleSort("positionAboveRate")}
                    >
                      Pos. Above <SortIcon col="positionAboveRate" />
                    </th>
                    <th
                      className="text-right py-2 font-medium text-gray-600 pr-4 cursor-pointer hover:text-blue-600"
                      onClick={() => handleSort("topImpressionPct")}
                    >
                      Top Impr. <SortIcon col="topImpressionPct" />
                    </th>
                    <th
                      className="text-right py-2 font-medium text-gray-600 pr-4 cursor-pointer hover:text-blue-600"
                      onClick={() => handleSort("absTopImpressionPct")}
                    >
                      Abs. Top <SortIcon col="absTopImpressionPct" />
                    </th>
                    <th
                      className="text-right py-2 font-medium text-gray-600 cursor-pointer hover:text-blue-600"
                      onClick={() => handleSort("outrankingShare")}
                    >
                      Outranking <SortIcon col="outrankingShare" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCompetitors.map((c: any, idx: number) => {
                    const isYou = yourDomain ? c.domain === yourDomain.domain : false;
                    return (
                      <tr
                        key={c.domain}
                        className={`border-b border-gray-50 ${isYou ? "bg-emerald-50 font-semibold" : "hover:bg-gray-50"}`}
                      >
                        <td className="py-2 text-gray-500 pr-4">{idx + 1}</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            {isYou && <Trophy className="w-3 h-3 text-emerald-600" />}
                            <span className={isYou ? "text-emerald-800" : "text-gray-800"}>
                              {c.domain}
                            </span>
                            {isYou && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                                Você
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-2 pr-4">
                          <span className={c.impressionShare >= 50 ? "text-green-700" : c.impressionShare >= 20 ? "text-yellow-700" : "text-red-600"}>
                            {c.impressionShare}%
                          </span>
                        </td>
                        <td className="text-right py-2 pr-4 text-gray-600">{c.overlapRate}%</td>
                        <td className="text-right py-2 pr-4 text-gray-600">{c.positionAboveRate}%</td>
                        <td className="text-right py-2 pr-4 text-gray-600">{c.topImpressionPct}%</td>
                        <td className="text-right py-2 pr-4 text-gray-600">{c.absTopImpressionPct}%</td>
                        <td className="text-right py-2">
                          <span className={c.outrankingShare >= 50 ? "text-green-700" : "text-gray-600"}>
                            {c.outrankingShare}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Insights / Recommendations */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-800">Insights Competitivos</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Insight 1: Position */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-blue-700" />
                  <span className="text-xs font-semibold text-blue-800">Posição no Leilão</span>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                  {yourPosition
                    ? yourPosition <= 3
                      ? `Você está na ${yourPosition}ª posição entre ${totalCompetitors} concorrentes. Excelente posicionamento — mantenha a estratégia de lances e qualidade dos anúncios.`
                      : `Você está na ${yourPosition}ª posição entre ${totalCompetitors} concorrentes. Há espaço para melhorar — considere aumentar lances ou melhorar Quality Score.`
                    : "Não foi possível identificar seu domínio nos dados de Auction Insights."}
                </p>
              </div>

              {/* Insight 2: Impression Share */}
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-semibold text-purple-800">Impression Share</span>
                </div>
                <p className="text-xs text-purple-700 leading-relaxed">
                  {yourDomain
                    ? yourDomain.impressionShare >= 50
                      ? `Seu Impression Share de ${yourDomain.impressionShare}% é forte. Você aparece em mais da metade dos leilões elegíveis.`
                      : yourDomain.impressionShare >= 20
                        ? `Seu Impression Share de ${yourDomain.impressionShare}% é moderado. Aumente o orçamento ou melhore o Ad Rank para capturar mais impressões.`
                        : `Seu Impression Share de ${yourDomain.impressionShare}% é baixo. Revise orçamento, lances e Quality Score para aumentar visibilidade.`
                    : "Configure seu domínio para ver análises personalizadas."}
                </p>
              </div>

              {/* Insight 3: Top Competitors */}
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-orange-700" />
                  <span className="text-xs font-semibold text-orange-800">Principais Concorrentes</span>
                </div>
                <p className="text-xs text-orange-700 leading-relaxed">
                  {sortedCompetitors.length >= 3
                    ? `Os 3 maiores concorrentes são: ${sortedCompetitors.slice(0, 3).map((c: any) => c.domain).join(", ")}. Monitore suas estratégias de lances e criativos.`
                    : "Dados insuficientes para identificar os principais concorrentes."}
                </p>
              </div>

              {/* Insight 4: Outranking */}
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-green-700" />
                  <span className="text-xs font-semibold text-green-800">Taxa de Superação</span>
                </div>
                <p className="text-xs text-green-700 leading-relaxed">
                  {yourDomain
                    ? yourDomain.outrankingShare >= 50
                      ? `Outranking Share de ${yourDomain.outrankingShare}% — você supera a maioria dos concorrentes. Continue otimizando para manter a liderança.`
                      : `Outranking Share de ${yourDomain.outrankingShare}% — há oportunidade de superar mais concorrentes. Foque em Quality Score e extensões de anúncio.`
                    : "Dados de outranking não disponíveis para seu domínio."}
                </p>
              </div>
            </div>
          </Card>

          {/* Glossary */}
          <Card className="p-5">
            <h3 className="text-xs font-semibold text-gray-600 mb-3">Glossário de Métricas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-gray-700">Impression Share:</span> % de impressões que você recebeu vs. total elegível.
              </div>
              <div>
                <span className="font-medium text-gray-700">Overlap Rate:</span> % de vezes que o concorrente apareceu junto com você.
              </div>
              <div>
                <span className="font-medium text-gray-700">Position Above Rate:</span> % de vezes que o concorrente apareceu acima de você.
              </div>
              <div>
                <span className="font-medium text-gray-700">Top Impression %:</span> % de impressões no topo da página.
              </div>
              <div>
                <span className="font-medium text-gray-700">Abs. Top Impression %:</span> % de impressões na 1ª posição absoluta.
              </div>
              <div>
                <span className="font-medium text-gray-700">Outranking Share:</span> % de vezes que você superou o concorrente.
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
