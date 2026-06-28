import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Users, TrendingUp, DollarSign, Target, Download, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";

const COLORS_AGE = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e"];
const COLORS_GENDER = ["#3b82f6", "#ec4899", "#94a3b8"];

export default function DemographicAnalysis() {
  const [period, setPeriod] = useState("30");

  const { data, isLoading, refetch, error: queryError } = trpc.googleAds.getDemographicData.useQuery(
    { days: parseInt(period) },
    { retry: 1 }
  );
  useEffect(() => {
    if (queryError) {
      toast.error("Erro ao carregar dados demográficos: " + queryError.message);
    }
  }, [queryError]);

  const handleExportPDF = () => {
    window.print();
    toast.success("Abrindo diálogo de impressão/PDF...");
  };

  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ["Segmento", "Tipo", "Impressões", "Cliques", "CTR (%)", "Custo (R$)", "Conversões"],
      ...(data.ageData || []).map((d: any) => [d.segment, "Faixa Etária", d.impressions, d.clicks, d.ctr, d.cost, d.conversions]),
      ...(data.genderData || []).map((d: any) => [d.segment, "Gênero", d.impressions, d.clicks, d.ctr, d.cost, d.conversions]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demografico-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("CSV exportado com sucesso!");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-500" />
            Análise Demográfica
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Desempenho por faixa etária e gênero — Google Ads
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={!data}>
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            <p className="text-muted-foreground">Carregando dados demográficos...</p>
          </div>
        </div>
      )}

      {!isLoading && !data && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <Users className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Nenhum dado demográfico disponível para o período selecionado.</p>
            <p className="text-sm text-muted-foreground">Verifique se as campanhas estão ativas e se há dados suficientes.</p>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* KPIs resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Segmentos Ativos</p>
                    <p className="text-xl font-bold">{(data.ageData?.length || 0) + (data.genderData?.length || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Melhor Faixa Etária</p>
                    <p className="text-lg font-bold">{data.bestAgeGroup || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Target className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Melhor Gênero</p>
                    <p className="text-lg font-bold">{data.bestGender || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <DollarSign className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Custo Total</p>
                    <p className="text-lg font-bold">R${data.totalCost?.toFixed(2) || "0,00"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Faixa Etária - CTR */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  CTR por Faixa Etária (%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.ageData && data.ageData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.ageData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="segment" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: any) => [`${Number(value).toFixed(2)}%`, "CTR"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      />
                      <Bar dataKey="ctr" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                        {data.ageData.map((_: any, index: number) => (
                          <Cell key={index} fill={COLORS_AGE[index % COLORS_AGE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                    Sem dados de faixa etária disponíveis
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gênero - Distribuição de Cliques */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  Distribuição de Cliques por Gênero
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.genderData && data.genderData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.genderData}
                        dataKey="clicks"
                        nameKey="segment"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ segment, percent }) => `${segment}: ${(percent * 100).toFixed(1)}%`}
                      >
                        {data.genderData.map((_: any, index: number) => (
                          <Cell key={index} fill={COLORS_GENDER[index % COLORS_GENDER.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip
                        formatter={(value: any) => [value, "Cliques"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                    Sem dados de gênero disponíveis
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabela detalhada - Faixa Etária */}
          {data.ageData && data.ageData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detalhamento por Faixa Etária</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Faixa Etária</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Impressões</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Cliques</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">CTR</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Custo</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Conv.</th>
                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ageData.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 font-medium">{row.segment}</td>
                          <td className="py-2 px-3 text-right">{row.impressions?.toLocaleString("pt-BR")}</td>
                          <td className="py-2 px-3 text-right">{row.clicks?.toLocaleString("pt-BR")}</td>
                          <td className="py-2 px-3 text-right">{Number(row.ctr).toFixed(2)}%</td>
                          <td className="py-2 px-3 text-right">R${Number(row.cost).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">{row.conversions}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge
                              variant="outline"
                              className={
                                row.ctr >= 10
                                  ? "border-green-500 text-green-600"
                                  : row.ctr >= 5
                                  ? "border-yellow-500 text-yellow-600"
                                  : "border-red-500 text-red-600"
                              }
                            >
                              {row.ctr >= 10 ? "Excelente" : row.ctr >= 5 ? "Regular" : "Baixo"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Insights automáticos */}
          {data.insights && data.insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-500" />
                  Insights e Recomendações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.insights.map((insight: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      <p className="text-sm">{insight}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
