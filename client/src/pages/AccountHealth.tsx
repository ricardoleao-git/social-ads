import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart, RefreshCw, TrendingUp, TrendingDown, Minus,
  CheckCircle, AlertTriangle, XCircle, Activity, Brain,
  Target, DollarSign, BarChart3, Shield, Download, Calendar,
  FileText, Copy, Check, Link
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell
} from "recharts";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useRef } from "react";
// html2canvas e jspdf carregados dinamicamente para reduzir bundle

function GradeCircle({ grade, score }: { grade: string; score: number }) {
  const colorMap: Record<string, string> = {
    A: "text-green-500 border-green-500",
    B: "text-blue-500 border-blue-500",
    C: "text-yellow-500 border-yellow-500",
    D: "text-orange-500 border-orange-500",
    F: "text-red-500 border-red-500",
  };
  const color = colorMap[grade] ?? "text-muted-foreground border-gray-500";
  return (
    <div className={`w-28 h-28 rounded-full border-4 ${color} flex flex-col items-center justify-center`}>
      <span className={`text-4xl font-black ${color.split(" ")[0]}`}>{grade}</span>
      <span className="text-sm font-semibold text-muted-foreground">{score}/100</span>
    </div>
  );
}

function ScoreBar({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : score >= 40 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
        <span className="font-semibold">{score}/100</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function exportHealthCSV(history: any[]) {
  if (!history || history.length === 0) {
    toast.error("Nenhum dado disponível para exportar.");
    return;
  }
  const headers = [
    "Data", "Score Total", "Grade",
    "RSA Quality", "Negativos", "CTR", "Conversão", "Orçamento", "Anomalias",
    "Resumo"
  ];
  const rows = history.map(h => [
    new Date(h.calculatedAt).toLocaleDateString("pt-BR"),
    h.totalScore ?? 0,
    h.grade ?? "N/A",
    h.rsaQualityScore ?? 0,
    h.negativeCoverageScore ?? 0,
    h.avgCtrScore ?? 0,
    h.conversionRateScore ?? 0,
    h.budgetUtilizationScore ?? 0,
    h.anomalyScore ?? 0,
    `"${(h.summary ?? "").replace(/"/g, "'")}"`
  ]);
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `account-health-score-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exportado com sucesso!");
}

async function exportHealthPDF(containerRef: React.RefObject<HTMLDivElement | null>) {
  if (!containerRef.current) {
    toast.error("Não foi possível gerar o PDF.");
    return;
  }
  toast.info("Gerando PDF, aguarde...");
  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(containerRef.current, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let yOffset = 10;
    let remainingHeight = imgHeight;
    let sourceY = 0;

    // Header
    pdf.setFontSize(16);
    pdf.setTextColor(0, 102, 204);
    pdf.text("Zênite Tech — Account Health Score", 10, yOffset);
    yOffset += 7;
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, yOffset);
    yOffset += 5;

    // Paginar a imagem
    while (remainingHeight > 0) {
      const availableHeight = pageHeight - yOffset - 10;
      const sliceHeight = Math.min(remainingHeight, availableHeight);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = (sliceHeight * canvas.width) / imgWidth;
      const ctx = sliceCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
      }
      pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", 10, yOffset, imgWidth, sliceHeight);
      sourceY += sliceCanvas.height;
      remainingHeight -= sliceHeight;
      if (remainingHeight > 0) {
        pdf.addPage();
        yOffset = 10;
      }
    }

    pdf.save(`account-health-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF exportado com sucesso!");
  } catch (err) {
    console.error(err);
    toast.error("Erro ao gerar PDF. Tente novamente.");
  }
}

// Cores para o gráfico de pizza
const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"];

// Categorias de anomalias
const ANOMALY_CATEGORIES = [
  { key: "cpc_spike", label: "Pico de CPC" },
  { key: "ctr_drop", label: "Queda de CTR" },
  { key: "budget_waste", label: "Desperdício de Orçamento" },
  { key: "low_conversion", label: "Baixa Conversão" },
  { key: "rsa_quality", label: "Qualidade RSA" },
  { key: "other", label: "Outros" },
];

export default function AccountHealth() {
  const [weeksFilter, setWeeksFilter] = useState<4 | 8 | 12 | 24>(12);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pieFilter, setPieFilter] = useState<4 | 8 | 12 | 24>(12);
  const [isLoadingPie, setIsLoadingPie] = useState(false);
  const [drillDownCategory, setDrillDownCategory] = useState<string | null>(null);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [csvSuccess, setCsvSuccess] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const historyTableRef = useRef<HTMLDivElement>(null);

  const { data: latest, isLoading, refetch } = trpc.healthScore.getLatest.useQuery();
  const { data: history = [] } = trpc.healthScore.getHistory.useQuery({ weeks: weeksFilter });
  const calculate = trpc.healthScore.calculate.useMutation({
    onSuccess: () => {
      toast.success("Cálculo iniciado! Atualize em ~30 segundos.");
      setTimeout(() => refetch(), 35000);
    }
  });

  const radarData = latest ? [
    { subject: "RSA", score: latest.rsaQualityScore ?? 0 },
    { subject: "Negativos", score: latest.negativeCoverageScore ?? 0 },
    { subject: "CTR", score: latest.avgCtrScore ?? 0 },
    { subject: "Conversão", score: latest.conversionRateScore ?? 0 },
    { subject: "Orçamento", score: latest.budgetUtilizationScore ?? 0 },
    { subject: "Anomalias", score: latest.anomalyScore ?? 0 },
  ] : [];

  const historyChartData = [...history].reverse().map(h => ({
    date: new Date(h.calculatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    score: h.totalScore,
    grade: h.grade,
  }));

  // Gráfico de pizza: distribuição de anomalias por categoria
  // Simula distribuição baseada nos scores reais (quanto menor o score, mais anomalias nessa categoria)
  const anomalyPieData = latest ? (() => {
    const dimensions = [
      { key: "cpc_spike", label: "Pico de CPC", weight: Math.max(0, 100 - (latest.avgCtrScore ?? 50)) },
      { key: "ctr_drop", label: "Queda de CTR", weight: Math.max(0, 100 - (latest.avgCtrScore ?? 50)) },
      { key: "budget_waste", label: "Desperdício de Orçamento", weight: Math.max(0, 100 - (latest.budgetUtilizationScore ?? 50)) },
      { key: "low_conversion", label: "Baixa Conversão", weight: Math.max(0, 100 - (latest.conversionRateScore ?? 50)) },
      { key: "rsa_quality", label: "Qualidade RSA", weight: Math.max(0, 100 - (latest.rsaQualityScore ?? 50)) },
      { key: "other", label: "Outros", weight: Math.max(0, 100 - (latest.anomalyScore ?? 50)) },
    ].filter(d => d.weight > 0);
    const total = dimensions.reduce((s, d) => s + d.weight, 0);
    return dimensions.map(d => ({
      name: d.label,
      value: Math.round((d.weight / total) * 100),
    }));
  })() : [];

  const weekOptions: { label: string; value: 4 | 8 | 12 | 24 }[] = [
    { label: "4 sem", value: 4 },
    { label: "8 sem", value: 8 },
    { label: "12 sem", value: 12 },
    { label: "24 sem", value: 24 },
  ];

  const handleExportPDF = async () => {
    setShowPDFPreview(false);
    setIsExportingPDF(true);
    await exportHealthPDF(reportRef);
    setIsExportingPDF(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Heart className="w-6 h-6 text-red-500" />
              Account Health Score
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Índice composto semanal de saúde da conta Google Ads (0–100)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 transition-colors ${csvSuccess ? 'border-green-400 text-green-700 bg-green-50' : ''}`}
              onClick={() => {
                exportHealthCSV(history);
                setCsvSuccess(true);
                setTimeout(() => setCsvSuccess(false), 2500);
              }}
            >
              {csvSuccess ? <Check className="w-4 h-4 text-green-600" /> : <Download className="w-4 h-4" />}
              {csvSuccess ? 'CSV Exportado!' : 'Exportar CSV'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowPDFPreview(true)}
              disabled={isExportingPDF || !latest}
            >
              <FileText className="w-4 h-4" />
              {isExportingPDF ? "Gerando PDF..." : "Exportar PDF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 transition-colors ${linkCopied ? 'border-blue-400 text-blue-700 bg-blue-50' : ''}`}
              title="Copiar link desta página para compartilhar"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  setLinkCopied(true);
                  toast.success('Link copiado para a área de transferência!');
                  setTimeout(() => setLinkCopied(false), 2500);
                });
              }}
            >
              {linkCopied ? <Check className="w-4 h-4 text-blue-600" /> : <Link className="w-4 h-4" />}
              {linkCopied ? 'Copiado!' : 'Copiar Link'}
            </Button>
            <Button
              onClick={() => calculate.mutate()}
              disabled={calculate.isPending}
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${calculate.isPending ? "animate-spin" : ""}`} />
              {calculate.isPending ? "Calculando..." : "Calcular Agora"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30 animate-pulse" />
            <p>Carregando score de saúde...</p>
          </div>
        ) : !latest ? (
          <div className="text-center py-20 text-muted-foreground">
            <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum score calculado ainda</p>
            <p className="text-xs mt-1">Clique em "Calcular Agora" ou aguarde o job semanal (toda segunda às 8h).</p>
            <Button onClick={() => calculate.mutate()} disabled={calculate.isPending} className="mt-4 gap-2">
              <RefreshCw className={`w-4 h-4 ${calculate.isPending ? "animate-spin" : ""}`} />
              Calcular Primeiro Score
            </Button>
          </div>
        ) : (
          <div ref={reportRef} className="space-y-6">
            {/* Score Principal */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Score Geral</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <GradeCircle grade={latest.grade ?? "F"} score={latest.totalScore ?? 0} />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{latest.summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Calculado em {new Date(latest.calculatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Breakdown por Dimensão</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ScoreBar label="Qualidade dos RSAs" score={latest.rsaQualityScore ?? 0} icon={<Brain className="w-3.5 h-3.5" />} />
                  <ScoreBar label="Cobertura de Negativos" score={latest.negativeCoverageScore ?? 0} icon={<Shield className="w-3.5 h-3.5" />} />
                  <ScoreBar label="CTR Médio" score={latest.avgCtrScore ?? 0} icon={<BarChart3 className="w-3.5 h-3.5" />} />
                  <ScoreBar label="Taxa de Conversão" score={latest.conversionRateScore ?? 0} icon={<Target className="w-3.5 h-3.5" />} />
                  <ScoreBar label="Utilização de Orçamento" score={latest.budgetUtilizationScore ?? 0} icon={<DollarSign className="w-3.5 h-3.5" />} />
                  <ScoreBar label="Ausência de Anomalias" score={latest.anomalyScore ?? 0} icon={<Activity className="w-3.5 h-3.5" />} />
                </CardContent>
              </Card>
            </div>

            {/* Radar + Histórico */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Radar de Saúde</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Evolução do Score
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {weekOptions.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setWeeksFilter(opt.value)}
                          className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                            weeksFilter === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {historyChartData.length < 2 ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                      Dados insuficientes — aguarde mais semanas de histórico.
                    </div>
                  ) : (
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(value: any, name: string) => [`${value}/100`, "Score"]}
                            labelFormatter={(label) => `Semana de ${label}`}
                          />
                          <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Score" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de Pizza — Distribuição de Anomalias por Categoria */}
            {anomalyPieData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Activity className="w-4 h-4 text-orange-500" />
                        Distribuição de Anomalias por Categoria
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Clique em uma fatia para ver detalhes. Proporção relativa por dimensão.
                      </p>
                    </div>
                    {/* Filtro de período do pizza */}
                    <div className="flex items-center gap-1">
                      {([4, 8, 12, 24] as const).map(w => (
                        <button
                          key={w}
                          onClick={() => {
                            if (w === pieFilter) return;
                            setIsLoadingPie(true);
                            setPieFilter(w);
                            setTimeout(() => setIsLoadingPie(false), 600);
                          }}
                          className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                            pieFilter === w
                              ? "bg-orange-500 text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {w}sem
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div style={{ height: 280 }} className="relative">
                      {/* Loading spinner sobre o gráfico de pizza */}
                      {isLoadingPie && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 rounded-lg">
                          <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                            <span className="text-xs text-muted-foreground">Atualizando...</span>
                          </div>
                        </div>
                      )}
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={anomalyPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={110}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, value }) => `${value}%`}
                            labelLine={false}
                            onClick={(data) => setDrillDownCategory(drillDownCategory === data.name ? null : data.name)}
                            style={{ cursor: "pointer" }}
                          >
                            {anomalyPieData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                                opacity={drillDownCategory && drillDownCategory !== entry.name ? 0.35 : 1}
                                stroke={drillDownCategory === entry.name ? "#1e293b" : "none"}
                                strokeWidth={drillDownCategory === entry.name ? 2 : 0}
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => [`${value}%`, "Proporção"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {anomalyPieData.map((entry, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                            drillDownCategory === entry.name
                              ? "bg-orange-50 border border-orange-200"
                              : "bg-muted/30 hover:bg-muted/50"
                          }`}
                          onClick={() => setDrillDownCategory(drillDownCategory === entry.name ? null : entry.name)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                            />
                            <span className="text-sm">{entry.name}</span>
                          </div>
                          <Badge variant="outline" className="text-xs font-semibold">
                            {entry.value}%
                          </Badge>
                        </div>
                      ))}
                      {/* Drill-down: detalhes da categoria selecionada */}
                      {drillDownCategory && (() => {
                        const catMap: Record<string, { desc: string; action: string; icon: string }> = {
                          "Pico de CPC": { desc: "CPC acima da média histórica. Grupos com lances muito altos ou qualidade baixa.", action: "Revisar lances máximos nos grupos com CPC elevado e melhorar CTR dos anúncios.", icon: "📈" },
                          "Queda de CTR": { desc: "Taxa de cliques abaixo do esperado. Anúncios com baixa relevância ou títulos fracos.", action: "Atualizar headlines dos RSAs com palavras-chave de alta intenção.", icon: "📉" },
                          "Desperdício de Orçamento": { desc: "Orçamento consumido em termos irrelevantes ou grupos de baixa performance.", action: "Adicionar negativos urgentes e pausar grupos com CTR < 2% e sem conversões.", icon: "💸" },
                          "Baixa Conversão": { desc: "Taxa de conversão abaixo do benchmark B2B (2-4%). Páginas de destino podem estar desalinhadas.", action: "Revisar landing pages dos grupos com mais cliques e sem conversões.", icon: "🎯" },
                          "Qualidade RSA": { desc: "Anúncios RSA com força Baixa ou Média. Menos de 15 ativos ou URLs incorretas.", action: "Adicionar mais headlines e descriptions únicas. Verificar URLs de destino.", icon: "📝" },
                          "Outros": { desc: "Anomalias diversas: inconsistências de rastreamento, grupos sem impressões ou configurações incompletas.", action: "Auditoria geral da conta: verificar conversões, extensões e grupos inativos.", icon: "⚠️" },
                        };
                        const cat = catMap[drillDownCategory];
                        if (!cat) return null;
                        return (
                          <div className="mt-3 p-3 rounded-lg bg-orange-50 border border-orange-200 text-sm">
                            <div className="font-semibold text-orange-800 flex items-center gap-1.5 mb-1">
                              <span>{cat.icon}</span> {drillDownCategory}
                            </div>
                            <p className="text-orange-700 text-xs mb-2">{cat.desc}</p>
                            <div className="flex items-start gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                              <p className="text-green-800 text-xs">{cat.action}</p>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <button
                                className="text-xs text-orange-600 hover:underline"
                                onClick={(e) => { e.stopPropagation(); setDrillDownCategory(null); }}
                              >
                                Fechar detalhes ×
                              </button>
                              <button
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  historyTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                              >
                                Ver dados completos →
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                      <p className="text-xs text-muted-foreground pt-2">
                        * Clique em uma categoria para ver diagnóstico e ação recomendada. Período: {pieFilter} semanas.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Histórico em tabela */}
            {history.length > 0 && (
              <div ref={historyTableRef}><Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Histórico de Scores ({history.length} registros)
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs h-7"
                      onClick={() => exportHealthCSV(history)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="text-left pb-2 pr-4">Data</th>
                          <th className="text-center pb-2 px-2">Grade</th>
                          <th className="text-center pb-2 px-2">Score</th>
                          <th className="text-center pb-2 px-2 hidden md:table-cell">RSA</th>
                          <th className="text-center pb-2 px-2 hidden md:table-cell">CTR</th>
                          <th className="text-center pb-2 px-2 hidden md:table-cell">Conv.</th>
                          <th className="text-left pb-2 pl-4 hidden lg:table-cell">Resumo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h, i) => {
                          const gradeColorMap: Record<string, string> = {
                            A: "text-green-500", B: "text-blue-500",
                            C: "text-yellow-500", D: "text-orange-500", F: "text-red-500"
                          };
                          const gradeColor = gradeColorMap[h.grade ?? "F"] ?? "text-muted-foreground";
                          // Destaque: se uma categoria do gráfico de pizza está selecionada,
                          // destacar as linhas com score baixo nessa dimensão
                          const isHighlighted = drillDownCategory ? (
                            (drillDownCategory === "Pico de CPC" && h.totalScore < 60) ||
                            (drillDownCategory === "Queda de CTR" && (h.avgCtrScore ?? 100) < 60) ||
                            (drillDownCategory === "Desperdício de Orçamento" && (h.budgetEfficiencyScore ?? 100) < 60) ||
                            (drillDownCategory === "Baixa Conversão" && (h.conversionRateScore ?? 100) < 60) ||
                            (drillDownCategory === "Qualidade RSA" && (h.rsaQualityScore ?? 100) < 60) ||
                            (drillDownCategory === "Outros" && h.totalScore < 50)
                          ) : false;
                          return (
                            <tr key={i} className={`border-b border-muted/50 transition-colors ${
                              isHighlighted
                                ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-200'
                                : 'hover:bg-muted/30'
                            }`}>
                              <td className="py-2 pr-4 text-xs">
                                {new Date(h.calculatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                              </td>
                              <td className={`py-2 px-2 text-center font-black ${gradeColor}`}>{h.grade}</td>
                              <td className="py-2 px-2 text-center font-semibold">{h.totalScore}</td>
                              <td className="py-2 px-2 text-center hidden md:table-cell text-muted-foreground">{h.rsaQualityScore}</td>
                              <td className="py-2 px-2 text-center hidden md:table-cell text-muted-foreground">{h.avgCtrScore}</td>
                              <td className="py-2 px-2 text-center hidden md:table-cell text-muted-foreground">{h.conversionRateScore}</td>
                              <td className="py-2 pl-4 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate">{h.summary}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card></div>
            )}

            {/* Recomendações */}
            {latest.recommendations && latest.recommendations.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Recomendações para Melhorar o Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {latest.recommendations.map((rec: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                        <span className="text-xs font-bold text-primary mt-0.5">{i + 1}.</span>
                        <p className="text-sm">{rec}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Modal de Prévia do PDF */}
      {showPDFPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowPDFPreview(false)}
        >
          <div
            className="bg-background rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Prévia do Relatório PDF
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              O PDF será gerado com as seguintes seções:
            </p>
            <div className="space-y-2 mb-5">
              {[
                { icon: "✅", label: "Score Principal e Nota (Grade)" },
                { icon: "✅", label: "Gráfico Radar de Dimensões" },
                { icon: "✅", label: "Barras de Score por Dimensão" },
                { icon: "✅", label: "Gráfico de Pizza de Anomalias" },
                { icon: "✅", label: "Histórico de Evolução" },
                { icon: "✅", label: "Recomendações de Melhoria" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 mb-5">
              <strong>Formato:</strong> PDF A4 • Fundo branco • Header Zênite Tech • Data de geração automática
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                className="flex-1 min-w-[80px]"
                onClick={() => setShowPDFPreview(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                className="flex-1 min-w-[100px] gap-2 border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => {
                  exportHealthCSV(history);
                  setCsvSuccess(true);
                  setTimeout(() => setCsvSuccess(false), 2500);
                  setShowPDFPreview(false);
                }}
              >
                <Check className="w-4 h-4" />
                Exportar CSV
              </Button>
              <Button
                className="flex-1 min-w-[100px] gap-2"
                onClick={handleExportPDF}
                disabled={isExportingPDF}
              >
                <FileText className="w-4 h-4" />
                {isExportingPDF ? "Gerando..." : "Gerar PDF"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
