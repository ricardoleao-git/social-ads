/**
 * Comparativo Executivo: Google Ads vs Meta Ads
 * Exibe métricas lado a lado com análise de eficiência e recomendações.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, MousePointer, Eye, Zap, Target,
  RefreshCw, AlertCircle, CheckCircle2, Info, ArrowRight, BarChart3,
} from "lucide-react";

type Period = "7d" | "30d" | "90d";

const GOOGLE_COLOR = "#4285F4";
const META_COLOR = "#1877F2";
const GOOGLE_BG = "bg-blue-50";
const META_BG = "bg-indigo-50";

function MetricRow({
  label,
  googleVal,
  metaVal,
  format = "number",
  lowerIsBetter = false,
}: {
  label: string;
  googleVal: number;
  metaVal: number;
  format?: "number" | "currency" | "percent" | "percent4";
  lowerIsBetter?: boolean;
}) {
  const fmt = (v: number) => {
    if (format === "currency") return `R$ ${v.toFixed(2)}`;
    if (format === "percent") return `${v.toFixed(2)}%`;
    if (format === "percent4") return `${(v * 100).toFixed(2)}%`;
    return v.toLocaleString("pt-BR");
  };

  const googleWins = lowerIsBetter ? googleVal <= metaVal : googleVal >= metaVal;
  const metaWins = lowerIsBetter ? metaVal <= googleVal : metaVal >= googleVal;
  const tied = googleVal === metaVal;

  return (
    <div className="grid grid-cols-3 items-center gap-2 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className={`text-center rounded-md py-1 px-2 ${!tied && googleWins ? "bg-green-50 text-green-700 font-semibold" : "text-foreground"}`}>
        <span className="text-sm">{fmt(googleVal)}</span>
        {!tied && googleWins && <CheckCircle2 className="w-3 h-3 inline ml-1 text-green-500" />}
      </div>
      <div className={`text-center rounded-md py-1 px-2 ${!tied && metaWins ? "bg-green-50 text-green-700 font-semibold" : "text-foreground"}`}>
        <span className="text-sm">{fmt(metaVal)}</span>
        {!tied && metaWins && <CheckCircle2 className="w-3 h-3 inline ml-1 text-green-500" />}
      </div>
    </div>
  );
}

export default function ComparativoAds() {
  const [period, setPeriod] = useState<Period>("7d");

  // Google Ads data
  const { data: googleData, isLoading: loadingGoogle } = trpc.googleAds.getSummary.useQuery(
    { period },
    { staleTime: 5 * 60 * 1000 }
  );
  const googleSummary = googleData?.summary;

  // Meta Ads data
  const { data: metaSummary, isLoading: loadingMeta } = trpc.metaAds.getSummary.useQuery(
    { period },
    { staleTime: 5 * 60 * 1000 }
  );

  const isLoading = loadingGoogle || loadingMeta;

  // Dados derivados
  const google = {
    spend: googleSummary?.totalSpend ?? 0,
    impressions: googleSummary?.totalImpressions ?? 0,
    clicks: googleSummary?.totalClicks ?? 0,
    conversions: googleSummary?.totalConversions ?? 0,
    ctr: googleSummary?.avgCtr ?? 0,
    cpc: googleSummary?.avgCpc ?? 0,
    cpm: (googleSummary?.totalImpressions && googleSummary.totalImpressions > 0)
      ? ((googleSummary.totalSpend / googleSummary.totalImpressions) * 1000)
      : 0,
    cpa: (googleSummary?.totalConversions && googleSummary.totalConversions > 0)
      ? (googleSummary.totalSpend / googleSummary.totalConversions)
      : 0,
    isSimulated: !googleData?.success,
  };

  const meta = {
    spend: metaSummary?.totalSpend ?? 0,
    impressions: metaSummary?.totalImpressions ?? 0,
    clicks: metaSummary?.totalClicks ?? 0,
    conversions: metaSummary?.totalConversions ?? 0,
    ctr: metaSummary?.avgCtr ?? 0,
    cpc: metaSummary?.avgCpc ?? 0,
    cpm: metaSummary?.avgCpm ?? 0,
    cpa: metaSummary?.totalConversions
      ? (metaSummary.totalSpend / metaSummary.totalConversions)
      : 0,
    isSimulated: metaSummary?.isSimulated ?? true,
  };

  const totalSpend = google.spend + meta.spend;
  const googleShare = totalSpend > 0 ? (google.spend / totalSpend) * 100 : 0;
  const metaShare = totalSpend > 0 ? (meta.spend / totalSpend) * 100 : 0;

  // Dados para gráfico de barras comparativo
  const barData = [
    { metric: "CTR (%)", Google: +(google.ctr * 100).toFixed(2), Meta: +(meta.ctr * 100).toFixed(2) },
    { metric: "CPC (R$)", Google: +google.cpc.toFixed(2), Meta: +meta.cpc.toFixed(2) },
    { metric: "CPM (R$)", Google: +google.cpm.toFixed(2), Meta: +meta.cpm.toFixed(2) },
  ];

  // Dados para radar
  const radarMax = {
    ctr: Math.max(google.ctr * 100, meta.ctr * 100, 0.01),
    clicks: Math.max(google.clicks, meta.clicks, 1),
    conversions: Math.max(google.conversions, meta.conversions, 1),
    impressions: Math.max(google.impressions, meta.impressions, 1),
  };

  const radarData = [
    {
      subject: "CTR",
      Google: radarMax.ctr > 0 ? ((google.ctr * 100) / radarMax.ctr) * 100 : 0,
      Meta: radarMax.ctr > 0 ? ((meta.ctr * 100) / radarMax.ctr) * 100 : 0,
    },
    {
      subject: "Cliques",
      Google: radarMax.clicks > 0 ? (google.clicks / radarMax.clicks) * 100 : 0,
      Meta: radarMax.clicks > 0 ? (meta.clicks / radarMax.clicks) * 100 : 0,
    },
    {
      subject: "Conversões",
      Google: radarMax.conversions > 0 ? (google.conversions / radarMax.conversions) * 100 : 0,
      Meta: radarMax.conversions > 0 ? (meta.conversions / radarMax.conversions) * 100 : 0,
    },
    {
      subject: "Alcance",
      Google: radarMax.impressions > 0 ? (google.impressions / radarMax.impressions) * 100 : 0,
      Meta: radarMax.impressions > 0 ? (meta.impressions / radarMax.impressions) * 100 : 0,
    },
  ];

  // Recomendações automáticas
  const recommendations: { type: "success" | "warning" | "info"; text: string }[] = [];
  if (google.ctr > meta.ctr) {
    recommendations.push({ type: "success", text: `Google Ads tem CTR ${((google.ctr - meta.ctr) * 100).toFixed(2)}pp maior — intenção de compra mais alta.` });
  } else if (meta.ctr > google.ctr) {
    recommendations.push({ type: "info", text: `Meta Ads tem CTR mais alto — considere testar criativos do Meta no Google.` });
  }
  if (google.cpc < meta.cpc && google.cpc > 0) {
    recommendations.push({ type: "success", text: `Google Ads tem CPC ${((1 - google.cpc / meta.cpc) * 100).toFixed(0)}% menor — melhor eficiência por clique.` });
  }
  if (meta.isSimulated) {
    recommendations.push({ type: "warning", text: "Meta Ads usando dados simulados. Conecte o token de acesso para dados reais." });
  }
  if (google.conversions > 0 && meta.conversions > 0) {
    if (google.cpa < meta.cpa) {
      recommendations.push({ type: "success", text: `Google Ads tem CPA R$ ${(meta.cpa - google.cpa).toFixed(2)} menor — priorize orçamento no Google.` });
    } else {
      recommendations.push({ type: "info", text: `Meta Ads tem CPA menor — considere aumentar orçamento no Meta.` });
    }
  }
  if (recommendations.length === 0) {
    recommendations.push({ type: "info", text: "Dados insuficientes para gerar recomendações. Aguarde mais dados de conversão." });
  }

  const periodLabels: Record<Period, string> = { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias" };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Comparativo Executivo
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Google Ads vs Meta Ads — desempenho lado a lado
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["7d", "30d", "90d"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                period === p
                  ? "bg-blue-600 text-foreground border-blue-600"
                  : "bg-white text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Badges de status */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
          Google Ads — {google.isSimulated ? "Simulado" : "Dados Reais"}
        </Badge>
        <Badge className={`text-xs ${meta.isSimulated ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-green-100 text-green-800 border-green-200"}`}>
          Meta Ads — {meta.isSimulated ? "Simulado" : "Dados Reais"}
        </Badge>
        <Badge variant="outline" className="text-xs">
          Período: últimos {periodLabels[period]}
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Carregando dados...
        </div>
      ) : (
        <>
          {/* Cards de gasto e distribuição */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-blue-700">Google Ads</span>
                  <DollarSign className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-blue-800">R$ {google.spend.toFixed(2)}</p>
                <p className="text-xs text-blue-600 mt-0.5">{googleShare.toFixed(1)}% do total</p>
              </CardContent>
            </Card>
            <Card className="border-indigo-200 bg-indigo-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-indigo-700">Meta Ads</span>
                  <DollarSign className="w-4 h-4 text-indigo-500" />
                </div>
                <p className="text-2xl font-bold text-indigo-800">R$ {meta.spend.toFixed(2)}</p>
                <p className="text-xs text-indigo-600 mt-0.5">{metaShare.toFixed(1)}% do total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Total Investido</span>
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-foreground">R$ {totalSpend.toFixed(2)}</p>
                <div className="flex gap-1 mt-1.5 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 rounded-l-full" style={{ width: `${googleShare}%` }} />
                  <div className="bg-indigo-500 rounded-r-full" style={{ width: `${metaShare}%` }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela comparativa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Métricas Comparativas</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 mb-2">
                  <span className="text-xs text-muted-foreground">Métrica</span>
                  <span className="text-xs font-semibold text-blue-600 text-center">Google</span>
                  <span className="text-xs font-semibold text-indigo-600 text-center">Meta</span>
                </div>
                <MetricRow label="Impressões" googleVal={google.impressions} metaVal={meta.impressions} />
                <MetricRow label="Cliques" googleVal={google.clicks} metaVal={meta.clicks} />
                <MetricRow label="CTR" googleVal={google.ctr * 100} metaVal={meta.ctr * 100} format="percent" />
                <MetricRow label="CPC (R$)" googleVal={google.cpc} metaVal={meta.cpc} format="currency" lowerIsBetter />
                <MetricRow label="CPM (R$)" googleVal={google.cpm} metaVal={meta.cpm} format="currency" lowerIsBetter />
                <MetricRow label="Conversões" googleVal={google.conversions} metaVal={meta.conversions} />
                <MetricRow label="CPA (R$)" googleVal={google.cpa} metaVal={meta.cpa} format="currency" lowerIsBetter />
              </CardContent>
            </Card>

            {/* Radar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Radar de Performance</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Google" dataKey="Google" stroke={GOOGLE_COLOR} fill={GOOGLE_COLOR} fillOpacity={0.2} />
                      <Radar name="Meta" dataKey="Meta" stroke={META_COLOR} fill={META_COLOR} fillOpacity={0.2} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de barras */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">CTR, CPC e CPM — Comparativo Direto</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value}`, name]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Google" fill={GOOGLE_COLOR} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Meta" fill={META_COLOR} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recomendações */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                Recomendações Automáticas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 p-3 rounded-lg text-sm ${
                      rec.type === "success"
                        ? "bg-green-50 text-green-800"
                        : rec.type === "warning"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-blue-50 text-blue-800"
                    }`}
                  >
                    {rec.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : rec.type === "warning" ? (
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    )}
                    <span>{rec.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
