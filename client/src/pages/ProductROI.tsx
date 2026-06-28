import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell,
} from "recharts";
import {
  TrendingUp, DollarSign, Target, BarChart3, RefreshCw, Download, Info,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";

const PERIOD_OPTIONS = [
  { label: "7 dias", value: 7 },
  { label: "14 dias", value: 14 },
  { label: "30 dias", value: 30 },
  { label: "60 dias", value: 60 },
  { label: "90 dias", value: 90 },
];

const PRODUCT_COLORS: Record<string, string> = {
  "Wallbox": "#10B981",
  "GuardIA": "#8B5CF6",
  "ZIPY": "#F59E0B",
  "ConciergIA": "#3B82F6",
  "Relógio de Ponto": "#EC4899",
  "Zface": "#06B6D4",
  "Zblock": "#F97316",
  "Catraca": "#84CC16",
  "PABX": "#6B7280",
  "Outros": "#9CA3AF",
};

function ROIBadge({ roi }: { roi: number }) {
  if (roi >= 200) return <Badge className="bg-green-600 text-foreground text-xs">ROI {roi.toFixed(0)}%</Badge>;
  if (roi >= 50) return <Badge className="bg-yellow-500 text-foreground text-xs">ROI {roi.toFixed(0)}%</Badge>;
  if (roi >= 0) return <Badge className="bg-orange-500 text-foreground text-xs">ROI {roi.toFixed(0)}%</Badge>;
  return <Badge className="bg-red-600 text-foreground text-xs">ROI {roi.toFixed(0)}%</Badge>;
}

function MetricCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-muted-foreground text-xs">{title}</p>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-foreground text-xl font-bold">{value}</p>
      {subtitle && <p className="text-muted-foreground text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

export default function ProductROI() {
  const [days, setDays] = useState(30);

  const { data, isLoading, refetch, isFetching } = trpc.productROI.getByPeriod.useQuery(
    { days },
    { staleTime: 5 * 60 * 1000 }
  );

  const handleExportCSV = () => {
    if (!data?.products) return;
    const headers = ["Produto", "Investimento (R$)", "Conversões", "Ticket Médio (R$)", "Receita Estimada (R$)", "ROI (%)", "ROAS", "CPA (R$)", "CTR (%)", "Cliques", "Impressões"];
    const rows = data.products.map(p => [
      p.name,
      p.spend.toFixed(2),
      p.conversions.toFixed(1),
      p.ticket.toFixed(0),
      p.revenue.toFixed(2),
      p.roi.toFixed(1),
      p.roas.toFixed(2),
      p.cpa.toFixed(2),
      p.ctr.toFixed(2),
      p.clicks,
      p.impressions,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roi-produtos-${days}d-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const summary = data?.summary;
  const products = data?.products || [];

  // Dados para o gráfico de barras (ROI e ROAS)
  const barData = products.slice(0, 8).map(p => ({
    name: p.name.length > 10 ? p.name.substring(0, 10) + "…" : p.name,
    fullName: p.name,
    roi: p.roi,
    roas: p.roas,
    spend: p.spend,
    revenue: p.revenue,
  }));

  // Dados para o gráfico de radar (comparativo multidimensional)
  const maxSpend = Math.max(...products.map(p => p.spend), 1);
  const maxConversions = Math.max(...products.map(p => p.conversions), 1);
  const maxCTR = Math.max(...products.map(p => p.ctr), 1);
  const radarData = products.slice(0, 6).map(p => ({
    product: p.name.length > 8 ? p.name.substring(0, 8) + "…" : p.name,
    "Investimento": Math.round((p.spend / maxSpend) * 100),
    "Conversões": Math.round((p.conversions / maxConversions) * 100),
    "CTR": Math.round((p.ctr / maxCTR) * 100),
    "ROI": Math.min(Math.max(p.roi / 5, 0), 100),
  }));

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-400" />
            ROI por Produto
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Retorno sobre investimento estimado por linha de produto — baseado em conversões × ticket médio
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Seletor de período */}
          <div className="flex bg-card border border-border rounded-lg overflow-hidden">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === opt.value
                    ? "bg-green-600 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-gray-700 text-muted-foreground text-xs rounded-lg border border-border"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!data}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-foreground text-xs rounded-lg disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        </div>
      </div>

      {/* Aviso de ticket médio estimado */}
      <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-blue-300 text-xs">
          A receita estimada é calculada com base em <strong>conversões × ticket médio configurado</strong> por produto.
          Os tickets médios são estimativas e podem ser ajustados conforme os valores reais de fechamento.
          {summary && <span className="ml-1">Período: <strong>{summary.period}</strong></span>}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-green-400 animate-spin mr-3" />
          <span className="text-muted-foreground">Calculando ROI por produto...</span>
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Não foi possível carregar os dados. Verifique as credenciais do Google Ads.</p>
        </div>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard
              title="Investimento Total"
              value={`R$ ${summary!.totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              subtitle={`Últimos ${days} dias`}
              icon={DollarSign}
              color="text-red-400"
            />
            <MetricCard
              title="Receita Estimada"
              value={`R$ ${summary!.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              subtitle="Conversões × ticket médio"
              icon={TrendingUp}
              color="text-green-400"
            />
            <MetricCard
              title="ROI Geral"
              value={`${summary!.totalROI.toFixed(1)}%`}
              subtitle={summary!.totalROI >= 100 ? "Positivo" : "Abaixo do esperado"}
              icon={Target}
              color={summary!.totalROI >= 100 ? "text-green-400" : "text-yellow-400"}
            />
            <MetricCard
              title="ROAS Geral"
              value={`${summary!.totalROAS.toFixed(2)}x`}
              subtitle="Receita / Investimento"
              icon={BarChart3}
              color="text-purple-400"
            />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de barras — ROI por produto */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-green-400" />
                  ROI por Produto (%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 10 }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                      labelStyle={{ color: "#F9FAFB" }}
                      formatter={(v: number, name: string) => [
                        name === "roi" ? `${v.toFixed(1)}%` : `${v.toFixed(2)}x`,
                        name === "roi" ? "ROI" : "ROAS"
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
                    <Bar dataKey="roi" name="ROI (%)" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={PRODUCT_COLORS[entry.fullName] || "#6B7280"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de radar — comparativo multidimensional */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  Comparativo Multidimensional (top 6)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis dataKey="product" tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#6B7280", fontSize: 8 }} />
                    <Radar name="Investimento" dataKey="Investimento" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} />
                    <Radar name="Conversões" dataKey="Conversões" stroke="#10B981" fill="#10B981" fillOpacity={0.15} />
                    <Radar name="CTR" dataKey="CTR" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.15} />
                    <Radar name="ROI" dataKey="ROI" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.15} />
                    <Legend wrapperStyle={{ fontSize: 10, color: "#9CA3AF" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                      labelStyle={{ color: "#F9FAFB" }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de investimento vs receita */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                Investimento vs Receita Estimada por Produto (R$)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 10 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} tickFormatter={v => `R$${v.toLocaleString("pt-BR")}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                    labelStyle={{ color: "#F9FAFB" }}
                    formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
                  <Bar dataKey="spend" name="Investimento" fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Bar dataKey="revenue" name="Receita Estimada" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabela detalhada */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Tabela Detalhada por Produto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted-foreground py-2 pr-4">Produto</th>
                      <th className="text-right text-muted-foreground py-2 px-2">Invest. (R$)</th>
                      <th className="text-right text-muted-foreground py-2 px-2">Conv.</th>
                      <th className="text-right text-muted-foreground py-2 px-2">Ticket (R$)</th>
                      <th className="text-right text-muted-foreground py-2 px-2">Receita Est. (R$)</th>
                      <th className="text-right text-muted-foreground py-2 px-2">ROI</th>
                      <th className="text-right text-muted-foreground py-2 px-2">ROAS</th>
                      <th className="text-right text-muted-foreground py-2 px-2">CPA (R$)</th>
                      <th className="text-right text-muted-foreground py-2 pl-2">CTR (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr key={p.name} className={`border-b border-border/50 ${i === 0 ? "bg-green-500/5" : ""}`}>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: PRODUCT_COLORS[p.name] || "#6B7280" }}
                            />
                            <span className="text-foreground font-medium">{p.name}</span>
                            {i === 0 && <span className="text-green-400 text-xs">🏆</span>}
                          </div>
                        </td>
                        <td className="text-right text-muted-foreground py-2 px-2">
                          {p.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right text-muted-foreground py-2 px-2">{p.conversions.toFixed(1)}</td>
                        <td className="text-right text-muted-foreground py-2 px-2">
                          {p.ticket.toLocaleString("pt-BR")}
                        </td>
                        <td className="text-right text-green-400 py-2 px-2 font-medium">
                          {p.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right py-2 px-2">
                          <ROIBadge roi={p.roi} />
                        </td>
                        <td className="text-right py-2 px-2">
                          <span className={`font-medium ${p.roas >= 3 ? "text-green-400" : p.roas >= 1 ? "text-yellow-400" : "text-red-400"}`}>
                            {p.roas.toFixed(2)}x
                          </span>
                        </td>
                        <td className="text-right text-muted-foreground py-2 px-2">
                          {p.cpa > 0 ? p.cpa.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
                        </td>
                        <td className="text-right py-2 pl-2">
                          <span className={p.ctr >= 5 ? "text-green-400" : p.ctr >= 2 ? "text-yellow-400" : "text-red-400"}>
                            {p.ctr.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td className="py-2 pr-4 text-foreground font-bold">Total</td>
                      <td className="text-right text-foreground font-bold py-2 px-2">
                        {summary!.totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right text-foreground font-bold py-2 px-2">{summary!.totalConversions.toFixed(1)}</td>
                      <td className="text-right text-muted-foreground py-2 px-2">—</td>
                      <td className="text-right text-green-400 font-bold py-2 px-2">
                        {summary!.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-2 px-2">
                        <ROIBadge roi={summary!.totalROI} />
                      </td>
                      <td className="text-right text-foreground font-bold py-2 px-2">{summary!.totalROAS.toFixed(2)}x</td>
                      <td className="text-right text-muted-foreground py-2 px-2">—</td>
                      <td className="py-2 pl-2">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Recomendações automáticas */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-yellow-400" />
                Recomendações Automáticas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {products.filter(p => p.roi >= 200 && p.spend > 0).slice(0, 2).map(p => (
                  <div key={p.name} className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <ArrowUpRight className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-green-300 text-xs font-semibold">Aumentar orçamento — {p.name}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        ROI de {p.roi.toFixed(0)}% com ROAS {p.roas.toFixed(2)}x. Produto com melhor retorno no período.
                        Considere aumentar o orçamento em 20–30%.
                      </p>
                    </div>
                  </div>
                ))}
                {products.filter(p => p.roi < 0 && p.spend > 50).slice(0, 2).map(p => (
                  <div key={p.name} className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <ArrowDownRight className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-red-300 text-xs font-semibold">Revisar estratégia — {p.name}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        ROI negativo ({p.roi.toFixed(0)}%) com R$ {p.spend.toFixed(2)} investidos e {p.conversions.toFixed(1)} conversões.
                        Revisar palavras-chave, anúncios e landing page.
                      </p>
                    </div>
                  </div>
                ))}
                {products.filter(p => p.roi >= 0 && p.roi < 200 && p.spend > 0).slice(0, 1).map(p => (
                  <div key={p.name} className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <Minus className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-yellow-300 text-xs font-semibold">Otimizar — {p.name}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        ROI de {p.roi.toFixed(0)}% — potencial de melhoria. Testar novas variações de anúncio e ajustar lances.
                      </p>
                    </div>
                  </div>
                ))}
                {products.filter(p => p.spend === 0).length > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-muted/50 border border-border rounded-lg">
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground text-xs">
                      {products.filter(p => p.spend === 0).length} produto(s) sem investimento no período:{" "}
                      {products.filter(p => p.spend === 0).map(p => p.name).join(", ")}.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Nota metodológica */}
          <div className="bg-card/50 border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-xs font-semibold mb-2">Metodologia de Cálculo</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
              <div><span className="text-muted-foreground font-medium">ROI</span> = (Receita − Investimento) / Investimento × 100</div>
              <div><span className="text-muted-foreground font-medium">ROAS</span> = Receita Estimada / Investimento</div>
              <div><span className="text-muted-foreground font-medium">CPA</span> = Investimento / Conversões</div>
            </div>
            <p className="text-gray-600 text-xs mt-2">
              Tickets médios configurados: Wallbox R$4.500 · GuardIA R$3.200 · ZIPY R$1.800 · ConciergIA R$2.500 · Relógio R$1.200 · Zface R$2.800 · Zblock R$1.500 · Catraca R$2.200 · PABX R$900
            </p>
          </div>
        </>
      )}
    </div>
  );
}
