/**
 * Página: Quando e Onde os Anúncios Foram Veiculados
 * Visualiza dados reais da API Google Ads:
 *  - Heatmap de dia da semana × hora do dia (cliques)
 *  - Gráfico de barras por dispositivo (CTR, CPC, gasto)
 *  - Gráfico por rede de exibição (Search, Display, etc.)
 *  - Insights automáticos com recomendações estratégicas
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Monitor, Smartphone, Tablet, Globe, Clock, Lightbulb, RefreshCw, TrendingUp, DollarSign } from "lucide-react";

const DAYS_ORDER = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

const DEVICE_COLORS: Record<string, string> = {
  Mobile: "#3b82f6",
  Desktop: "#10b981",
  Tablet: "#f59e0b",
  Outro: "#6b7280",
};

const NETWORK_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function getHeatmapColor(value: number, max: number): string {
  if (max === 0) return "bg-muted";
  const ratio = value / max;
  if (ratio === 0) return "bg-muted text-gray-600";
  if (ratio < 0.2) return "bg-blue-950 text-blue-300";
  if (ratio < 0.4) return "bg-blue-800 text-blue-100";
  if (ratio < 0.6) return "bg-blue-600 text-foreground";
  if (ratio < 0.8) return "bg-green-600 text-foreground";
  return "bg-green-400 text-gray-900 font-bold";
}

export default function WhenWhereAds() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");
  const [heatmapMetric, setHeatmapMetric] = useState<"clicks" | "impressions" | "costBRL">("clicks");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");

  // Buscar lista de campanhas para o filtro
  const { data: campaignsData } = trpc.googleAds.getCampaigns.useQuery(
    undefined,
    { staleTime: 10 * 60 * 1000 }
  );

  const { data, isLoading, refetch } = trpc.gbZenite.getWhenWhereReport.useQuery(
    { period, campaignId: selectedCampaignId !== "all" ? selectedCampaignId : undefined },
    { staleTime: 5 * 60 * 1000 }
  );

  // Construir matriz do heatmap: day × hour
  const heatmapMatrix = useMemo(() => {
    if (!data?.hourlyData) return {};
    const matrix: Record<string, Record<number, number>> = {};
    for (const day of DAYS_ORDER) {
      matrix[day] = {};
      for (let h = 0; h < 24; h++) matrix[day][h] = 0;
    }
    for (const row of data.hourlyData) {
      if (matrix[row.dayLabel] !== undefined) {
        const val =
          heatmapMetric === "clicks"
            ? row.clicks
            : heatmapMetric === "impressions"
            ? row.impressions
            : parseFloat(row.costBRL ?? "0");
        matrix[row.dayLabel][row.hour] = (matrix[row.dayLabel][row.hour] ?? 0) + val;
      }
    }
    return matrix;
  }, [data?.hourlyData, heatmapMetric]);

  const heatmapMax = useMemo(() => {
    let max = 0;
    for (const day of DAYS_ORDER) {
      for (let h = 0; h < 24; h++) {
        const v = heatmapMatrix[day]?.[h] ?? 0;
        if (v > max) max = v;
      }
    }
    return max;
  }, [heatmapMatrix]);

  // Totais por dispositivo para gráfico
  const deviceChartData = useMemo(() => {
    if (!data?.deviceData) return [];
    return data.deviceData.map((d: any) => ({
      name: d.deviceLabel,
      Cliques: d.clicks,
      Impressões: d.impressions,
      "CTR (%)": parseFloat(d.ctr),
      "CPC (R$)": parseFloat(d.avgCpc),
      "Gasto (R$)": parseFloat(d.costBRL),
    }));
  }, [data?.deviceData]);

  // Dados de rede para gráfico de pizza
  const networkChartData = useMemo(() => {
    if (!data?.networkData) return [];
    return data.networkData.map((n: any) => ({
      name: n.networkLabel ?? n.network,
      value: n.clicks,
      impressions: n.impressions,
      costBRL: n.costBRL,
      ctr: n.ctr,
    }));
  }, [data?.networkData]);

  const metricLabel = heatmapMetric === "clicks" ? "Cliques" : heatmapMetric === "impressions" ? "Impressões" : "Gasto (R$)";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quando e Onde os Anúncios Foram Veiculados</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Análise de performance por horário, dispositivo e rede
            {selectedCampaignId !== "all" && campaignsData?.campaigns && (
              <span className="ml-2 text-blue-400">
                — {campaignsData.campaigns.find((c: any) => String(c.id) === selectedCampaignId)?.name ?? "Campanha selecionada"}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filtro de Campanha */}
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="w-52 bg-muted border-border text-foreground">
              <SelectValue placeholder="Todas as campanhas" />
            </SelectTrigger>
            <SelectContent className="bg-muted border-border">
              <SelectItem value="all">Todas as campanhas</SelectItem>
              {campaignsData?.campaigns?.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name.length > 30 ? c.name.substring(0, 30) + "..." : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Filtro de Período */}
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-32 bg-muted border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-muted border-border">
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="90d">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="border-gray-600 text-muted-foreground hover:bg-gray-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Insights */}
      {data?.insights && data.insights.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              Insights Estratégicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.insights.map((insight: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground bg-muted rounded-lg p-3">
                  <span className="text-lg leading-none">{insight.charAt(0)}</span>
                  <span>{insight.substring(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmap Dia × Hora */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Heatmap: Dia da Semana × Hora do Dia
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Métrica:</span>
              <Select value={heatmapMetric} onValueChange={(v) => setHeatmapMetric(v as any)}>
                <SelectTrigger className="w-36 bg-muted border-border text-foreground text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  <SelectItem value="clicks">Cliques</SelectItem>
                  <SelectItem value="impressions">Impressões</SelectItem>
                  <SelectItem value="costBRL">Gasto (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Verde = maior {metricLabel.toLowerCase()} | Azul = médio | Cinza = zero
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Carregando dados...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr>
                    <th className="text-left text-muted-foreground p-1 w-20">Dia / Hora</th>
                    {HOURS.map((h) => (
                      <th key={h} className="text-center text-muted-foreground p-0.5 w-8 font-normal">
                        {h.split(":")[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS_ORDER.map((day) => (
                    <tr key={day}>
                      <td className="text-muted-foreground p-1 font-medium whitespace-nowrap">{day}</td>
                      {Array.from({ length: 24 }, (_, h) => {
                        const val = heatmapMatrix[day]?.[h] ?? 0;
                        const colorClass = getHeatmapColor(val, heatmapMax);
                        return (
                          <td key={h} className={`text-center p-0.5 rounded cursor-default ${colorClass}`} title={`${day} ${String(h).padStart(2, "0")}:00 — ${metricLabel}: ${heatmapMetric === "costBRL" ? `R$ ${val.toFixed(2)}` : val}`}>
                            <div className="w-7 h-6 flex items-center justify-center text-xs">
                              {val > 0 ? (heatmapMetric === "costBRL" ? val.toFixed(1) : val) : ""}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráficos por Dispositivo e Rede */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Dispositivo */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Monitor className="w-4 h-4 text-green-400" />
              Performance por Dispositivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Carregando...
              </div>
            ) : deviceChartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Nenhum dado disponível no período
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={deviceChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                      labelStyle={{ color: "#f9fafb" }}
                      itemStyle={{ color: "#d1d5db" }}
                    />
                    <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
                    <Bar dataKey="Cliques" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Impressões" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {/* Tabela resumo */}
                <div className="mt-3 space-y-2">
                  {data?.deviceData?.map((d: any) => (
                    <div key={d.device} className="flex items-center justify-between text-sm bg-muted rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        {d.device === "MOBILE" ? <Smartphone className="w-4 h-4 text-blue-400" /> :
                         d.device === "DESKTOP" ? <Monitor className="w-4 h-4 text-green-400" /> :
                         <Tablet className="w-4 h-4 text-yellow-400" />}
                        <span className="text-foreground font-medium">{d.deviceLabel}</span>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground text-xs">
                        <span>CTR: <span className="text-foreground">{d.ctr}%</span></span>
                        <span>CPC: <span className="text-foreground">R$ {d.avgCpc}</span></span>
                        <span>Gasto: <span className="text-foreground">R$ {d.costBRL}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Por Rede */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" />
              Performance por Rede de Exibição
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Carregando...
              </div>
            ) : networkChartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Nenhum dado disponível no período
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={networkChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: "#6b7280" }}
                    >
                      {networkChartData.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={NETWORK_COLORS[index % NETWORK_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                      formatter={(value: any, name: string) => [`${value} cliques`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Tabela resumo */}
                <div className="mt-3 space-y-2">
                  {data?.networkData?.map((n: any, i: number) => (
                    <div key={n.network} className="flex items-center justify-between text-sm bg-muted rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NETWORK_COLORS[i % NETWORK_COLORS.length] }} />
                        <span className="text-foreground font-medium">{n.networkLabel ?? n.network}</span>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground text-xs">
                        <span>Cliques: <span className="text-foreground">{n.clicks}</span></span>
                        <span>CTR: <span className="text-foreground">{n.ctr}%</span></span>
                        <span>Gasto: <span className="text-foreground">R$ {n.costBRL}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top horários */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            Top 10 Combinações Dia × Hora (por Cliques)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Carregando...
            </div>
          ) : !data?.hourlyData || data.hourlyData.length === 0 ? (
            <div className="text-muted-foreground text-sm text-center py-8">
              Nenhum dado disponível no período selecionado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-3">#</th>
                    <th className="text-left py-2 px-3">Dia</th>
                    <th className="text-left py-2 px-3">Hora</th>
                    <th className="text-right py-2 px-3">Impressões</th>
                    <th className="text-right py-2 px-3">Cliques</th>
                    <th className="text-right py-2 px-3">CTR</th>
                    <th className="text-right py-2 px-3">Gasto</th>
                    <th className="text-right py-2 px-3">Conversões</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hourlyData.slice(0, 10).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-3 text-foreground font-medium">{row.dayLabel}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="border-blue-700 text-blue-300 text-xs">
                          {row.hourLabel}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{row.impressions.toLocaleString("pt-BR")}</td>
                      <td className="py-2 px-3 text-right text-foreground font-medium">{row.clicks}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`font-medium ${parseFloat(row.ctr) >= 5 ? "text-green-400" : parseFloat(row.ctr) >= 2 ? "text-yellow-400" : "text-red-400"}`}>
                          {row.ctr}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground">R$ {row.costBRL}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{row.conversions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recomendações de programação de anúncios */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Recomendações de Programação de Anúncios (B2B Paraíba)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-950 border border-green-800 rounded-lg p-4">
              <div className="text-green-400 font-semibold text-sm mb-2">✅ Horários Prioritários</div>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Segunda a Sexta: 8h–12h</li>
                <li>• Segunda a Sexta: 13h–18h</li>
                <li>• Alta intenção de compra B2B</li>
              </ul>
            </div>
            <div className="bg-yellow-950 border border-yellow-800 rounded-lg p-4">
              <div className="text-yellow-400 font-semibold text-sm mb-2">⚠️ Horários Secundários</div>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Sábado: 9h–13h</li>
                <li>• Segunda a Sexta: 18h–20h</li>
                <li>• Reduzir lances em 20–30%</li>
              </ul>
            </div>
            <div className="bg-red-950 border border-red-800 rounded-lg p-4">
              <div className="text-red-400 font-semibold text-sm mb-2">🚫 Horários a Excluir</div>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Madrugada: 0h–6h</li>
                <li>• Domingo (baixa intenção)</li>
                <li>• Economia estimada: 15–25%</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            * Recomendações baseadas em padrões B2B para a região Nordeste. Ajuste conforme os dados reais do heatmap acima.
            Para aplicar programação de anúncios, acesse Ferramentas → Programação de anúncios no Google Ads.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
