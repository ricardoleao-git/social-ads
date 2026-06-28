import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot, RefreshCw, Zap, TrendingUp, AlertTriangle, CheckCircle,
  Lightbulb, Download, Share2, Mail, Link, Tag, X, Filter,
  History, Bell, BellOff, Trash2, ChevronDown, ChevronUp, Clock, Plus
} from "lucide-react";
import { Streamdown } from "streamdown";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatDateBR = (dateStr: string) => {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
};

const getDateRange = (period: string, customStart?: string, customEnd?: string) => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (period === "custom") return { start: customStart ?? fmt(now), end: customEnd ?? fmt(now) };
  if (period === "14d") { const s = new Date(now); s.setDate(s.getDate() - 13); return { start: fmt(s), end: fmt(now) }; }
  if (period === "this_month") return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end: fmt(now) };
  if (period === "last_month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: fmt(first), end: fmt(last) };
  }
  const days = period === "30d" ? 29 : period === "90d" ? 89 : 6;
  const s = new Date(now); s.setDate(s.getDate() - days);
  return { start: fmt(s), end: fmt(now) };
};

type PeriodType = "7d" | "14d" | "30d" | "90d" | "this_month" | "last_month" | "custom";

const PERIOD_LABELS: Record<PeriodType, string> = {
  "7d": "7 dias", "14d": "14 dias", "30d": "30 dias", "90d": "90 dias",
  "this_month": "Este Mês", "last_month": "Mês Passado", "custom": "Customizado",
};

// Tags predefinidas para categorizar insights
const AVAILABLE_TAGS = [
  { id: "urgente", label: "Urgente", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { id: "otimizacao", label: "Otimização", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "oportunidade", label: "Oportunidade", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { id: "ctr", label: "CTR", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { id: "cpc", label: "CPC", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { id: "conversoes", label: "Conversões", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  { id: "keywords", label: "Keywords", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { id: "grupos", label: "Grupos", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
];

// Tooltip personalizado para o gráfico CTR
const CTRTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.dataKey === "ctr"
            ? `${(entry.value * 100).toFixed(2)}%`
            : entry.dataKey === "cpc"
            ? `R$ ${entry.value.toFixed(2)}`
            : entry.value.toLocaleString("pt-BR")}
        </p>
      ))}
    </div>
  );
};

export default function InsightsAI() {
  const [period, setPeriod] = useState<PeriodType>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [insightsText, setInsightsText] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showTagPanel, setShowTagPanel] = useState(false);

  // Compartilhamento
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Histórico de insights
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [savedInsightId, setSavedInsightId] = useState<number | null>(null);

  // Gráfico comparativo
  const [comparePeriod, setComparePeriod] = useState<PeriodType>("7d");
  const [showComparison, setShowComparison] = useState(false);

  // Alertas de CTR
  const [showAlerts, setShowAlerts] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertThreshold, setAlertThreshold] = useState(5);
  const [alertGroup, setAlertGroup] = useState("all");

  const dateRange = getDateRange(period, customStart, customEnd);

  const queryPeriod = (period === "14d" || period === "this_month" || period === "last_month")
    ? "custom" : period as any;

  // Dados Google Ads
  const { data: summaryRaw, isLoading: summaryLoading } = trpc.googleAds.getSummary.useQuery({
    period: queryPeriod, startDate: dateRange.start, endDate: dateRange.end,
  });
  const summaryData = summaryRaw?.summary ?? null;

  const { data: adGroupsRaw, isLoading: adGroupsLoading } = trpc.googleAds.getAdGroups.useQuery({
    period: queryPeriod, startDate: dateRange.start, endDate: dateRange.end,
  });
  const adGroupsData = adGroupsRaw?.adGroups ?? null;

  // Dados de tendência para o gráfico CTR
  const { data: trendsRaw, isLoading: trendsLoading } = trpc.googleAds.getTrends.useQuery({
    period: queryPeriod, startDate: dateRange.start, endDate: dateRange.end,
  });

  const chartData = useMemo(() => {
    if (!trendsRaw?.trends?.length) return [];
    return trendsRaw.trends.map((t: any) => ({
      date: formatDateBR(t.date ?? ""),
      ctr: t.ctr ?? 0,
      cpc: t.cpc ?? 0,
      cliques: t.clicks ?? 0,
      conversoes: t.conversions ?? 0,
    }));
  }, [trendsRaw]);

  // Período de comparação
  const compareDateRange = getDateRange(comparePeriod);
  const compareQueryPeriod = (comparePeriod === "14d" || comparePeriod === "this_month" || comparePeriod === "last_month")
    ? "custom" : comparePeriod as any;

  // Dados de tendência do período de comparação
  const { data: compareTrendsRaw } = trpc.googleAds.getTrends.useQuery(
    { period: compareQueryPeriod, startDate: compareDateRange.start, endDate: compareDateRange.end },
    { enabled: showComparison }
  );
  const compareChartData = useMemo(() => {
    if (!compareTrendsRaw?.trends?.length) return [];
    return compareTrendsRaw.trends.map((t: any) => ({
      date: formatDateBR(t.date ?? ""),
      ctr: t.ctr ?? 0,
      cpc: t.cpc ?? 0,
    }));
  }, [compareTrendsRaw]);

  // Histórico de insights
  const { data: historyData, refetch: refetchHistory } = trpc.insightsHistory.list.useQuery(
    { limit: 10 },
    { enabled: showHistory }
  );
  const saveInsightMutation = trpc.insightsHistory.save.useMutation({
    onSuccess: (data) => { setSavedInsightId(data.id); refetchHistory(); },
  });
  const deleteInsightMutation = trpc.insightsHistory.delete.useMutation({
    onSuccess: () => refetchHistory(),
  });

  // Alertas de CTR
  const { data: alertRules, refetch: refetchAlerts } = trpc.insightsHistory.listAlertRules.useQuery(
    undefined,
    { enabled: showAlerts }
  );
  const upsertAlertMutation = trpc.insightsHistory.upsertAlertRule.useMutation({
    onSuccess: () => { refetchAlerts(); setAlertEmail(""); setAlertThreshold(5); setAlertGroup("all"); },
  });
  const deleteAlertMutation = trpc.insightsHistory.deleteAlertRule.useMutation({
    onSuccess: () => refetchAlerts(),
  });

  const handleSaveToHistory = () => {
    if (!insightsText || !summaryData) return;
    saveInsightMutation.mutate({
      period: PERIOD_LABELS[period],
      startDate: dateRange.start,
      endDate: dateRange.end,
      content: insightsText,
      tags: selectedTags,
      metrics: {
        totalImpressions: summaryData.totalImpressions ?? 0,
        totalClicks: summaryData.totalClicks ?? 0,
        avgCTR: summaryData.avgCtr ?? 0,
        avgCPC: summaryData.avgCpc ?? 0,
        totalConversions: summaryData.totalConversions ?? 0,
        totalSpend: summaryData.totalSpend ?? 0,
      },
    });
  };

  const handleCreateAlert = () => {
    if (!alertEmail) return;
    upsertAlertMutation.mutate({
      adGroupName: alertGroup,
      thresholdPercent: alertThreshold,
      email: alertEmail,
      active: true,
    });
  };

  // Mutação para gerar insights
  const generateMutation = trpc.insights.generateInsights.useMutation({
    onMutate: () => { setIsGenerating(true); setError(null); },
    onSuccess: (data) => {
      const content = typeof data.insights === "string" ? data.insights : String(data.insights ?? "");
      setInsightsText(content);
      setGeneratedAt(data.generatedAt);
      setIsGenerating(false);
      setSelectedTags([]); // reset tags ao gerar novo
    },
    onError: (err) => {
      setError(err.message ?? "Erro ao gerar insights. Tente novamente.");
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    if (!summaryData || !adGroupsData) return;
    const summary = {
      totalImpressions: summaryData.totalImpressions ?? 0,
      totalClicks: summaryData.totalClicks ?? 0,
      avgCTR: summaryData.avgCtr ?? 0,
      avgCPC: summaryData.avgCpc ?? 0,
      totalConversions: summaryData.totalConversions ?? 0,
      totalSpend: summaryData.totalSpend ?? 0,
      dateRange: summaryData.dateRange,
    };
    const groups = (adGroupsData as any[]).slice(0, 13).map((g: any) => ({
      name: g.name ?? "N/A", ctr: g.ctr ?? 0, cpc: g.cpc ?? 0,
      conversions: g.conversions ?? 0, clicks: g.clicks ?? 0,
      spend: g.spend ?? 0, status: g.performanceStatus ?? g.status ?? "AVERAGE",
    }));
    generateMutation.mutate({ summary, topGroups: groups, period: PERIOD_LABELS[period] });
  };

  const handleExportTxt = () => {
    if (!insightsText) return;
    const tagsLine = selectedTags.length > 0
      ? `Tags: ${selectedTags.map(t => AVAILABLE_TAGS.find(a => a.id === t)?.label ?? t).join(", ")}\n\n`
      : "";
    const blob = new Blob([tagsLine + insightsText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zenite-insights-ia-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
    setShowShareMenu(false);
  };

  const handleShareEmail = () => {
    if (!insightsText) return;
    const subject = encodeURIComponent(`Insights com IA — Zênite Tech (${PERIOD_LABELS[period]})`);
    const tagsLine = selectedTags.length > 0
      ? `Tags: ${selectedTags.map(t => AVAILABLE_TAGS.find(a => a.id === t)?.label ?? t).join(", ")}\n\n`
      : "";
    const body = encodeURIComponent(tagsLine + insightsText.slice(0, 2000) + (insightsText.length > 2000 ? "\n\n[... ver completo no dashboard]" : ""));
    window.open(`mailto:?subject=${subject}&body=${body}`);
    setShowShareMenu(false);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const isDataLoading = summaryLoading || adGroupsLoading;
  const hasData = !!summaryData && !!adGroupsData;

  // Filtragem de insights por tag (simples: se tag selecionada, mostra/oculta o bloco)
  const filteredInsights = useMemo(() => {
    if (!insightsText || !filterTag) return insightsText;
    const tag = AVAILABLE_TAGS.find(t => t.id === filterTag);
    if (!tag) return insightsText;
    // Filtra parágrafos/seções que mencionam a tag
    const keyword = tag.label.toLowerCase();
    const lines = insightsText.split("\n");
    const filtered = lines.filter(line =>
      line.toLowerCase().includes(keyword) ||
      line.startsWith("#") || line.startsWith("*") || line.trim() === ""
    );
    return filtered.length > 5 ? filtered.join("\n") : insightsText;
  }, [insightsText, filterTag]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Bot className="w-8 h-8 text-violet-500" />
            Insights com IA
          </h1>
          <p className="text-muted-foreground mt-1">
            Recomendações estratégicas geradas por inteligência artificial com base nos dados reais do Google Ads
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Histórico */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showHistory ? "bg-blue-600 text-foreground border-blue-600" : "bg-secondary text-foreground border-border hover:bg-secondary/80"
            }`}
          >
            <History className="w-4 h-4" />
            Histórico
          </button>
          {/* Botão Alertas */}
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showAlerts ? "bg-orange-600 text-foreground border-orange-600" : "bg-secondary text-foreground border-border hover:bg-secondary/80"
            }`}
          >
            <Bell className="w-4 h-4" />
            Alertas CTR
          </button>
        </div>
        {insightsText && (
          <div className="flex items-center gap-2">
            {/* Botão Salvar no Histórico */}
            <button
              onClick={handleSaveToHistory}
              disabled={saveInsightMutation.isPending || !!savedInsightId}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                savedInsightId ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-secondary text-foreground border-border hover:bg-secondary/80"
              } disabled:opacity-50`}
            >
              {savedInsightId ? <><CheckCircle className="w-4 h-4" />Salvo</> : <><History className="w-4 h-4" />Salvar</>}
            </button>
            {/* Botão Tags */}
            <button
              onClick={() => setShowTagPanel(!showTagPanel)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                selectedTags.length > 0
                  ? "bg-violet-600 text-foreground border-violet-600"
                  : "bg-secondary text-foreground border-border hover:bg-secondary/80"
              }`}
            >
              <Tag className="w-4 h-4" />
              Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
            </button>

            {/* Botão Compartilhar */}
            <div className="relative">
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-secondary text-foreground rounded-lg hover:bg-secondary/80 border border-border transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar
              </button>
              {showShareMenu && (
                <div className="absolute right-0 top-10 z-50 bg-background border border-border rounded-lg shadow-lg w-48 overflow-hidden">
                  <button
                    onClick={handleShareEmail}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-secondary transition-colors"
                  >
                    <Mail className="w-4 h-4 text-blue-400" />
                    Enviar por e-mail
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-secondary transition-colors"
                  >
                    <Link className="w-4 h-4 text-green-400" />
                    {shareCopied ? "Link copiado!" : "Copiar link"}
                  </button>
                </div>
              )}
            </div>

            {/* Botão Exportar TXT */}
            <button
              onClick={handleExportTxt}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-secondary text-foreground rounded-lg hover:bg-secondary/80 border border-border transition-colors"
            >
              <Download className="w-4 h-4" />
              TXT
            </button>
          </div>
        )}
      </div>

      {/* Painel de Tags */}
      {showTagPanel && insightsText && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Tag className="w-4 h-4 text-violet-400" />
                Categorizar este insight
              </p>
              <button onClick={() => setShowTagPanel(false)}>
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {AVAILABLE_TAGS.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${tag.color} ${
                    selectedTags.includes(tag.id) ? "ring-2 ring-offset-1 ring-offset-background ring-current" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
            {selectedTags.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Filtrar por:</span>
                <div className="flex flex-wrap gap-1">
                  {AVAILABLE_TAGS.map(tag => (
                    selectedTags.includes(tag.id) && (
                      <button
                        key={tag.id}
                        onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
                        className={`px-2 py-0.5 rounded-full text-xs border transition-all ${tag.color} ${
                          filterTag === tag.id ? "ring-1 ring-current" : "opacity-60 hover:opacity-100"
                        }`}
                      >
                        <Filter className="w-3 h-3 inline mr-1" />
                        {tag.label}
                      </button>
                    )
                  ))}
                </div>
                {filterTag && (
                  <button
                    onClick={() => setFilterTag(null)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seção Histórico de Insights */}
      {showHistory && (
        <Card className="border-blue-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              Histórico de Insights
              <span className="text-xs text-muted-foreground font-normal">Últimas 10 análises</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!historyData?.entries?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                <Clock className="w-8 h-8 opacity-40" />
                <p>Nenhum insight salvo ainda. Gere e salve um insight para ver o histórico.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(historyData.entries as unknown as any[]).map((entry: any) => (
                  <div key={entry.id} className="border border-border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                      onClick={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : entry.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-medium">{entry.period}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString("pt-BR")} • {entry.startDate} – {entry.endDate}
                          </p>
                        </div>
                        {entry.tags && Array.isArray(entry.tags) && entry.tags.length > 0 && (
                          <div className="flex gap-1">
                            {(entry.tags as string[]).slice(0, 3).map((tagId: string) => {
                              const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                              return tag ? (
                                <span key={tagId} className={`px-2 py-0.5 rounded-full text-xs border ${tag.color}`}>{tag.label}</span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteInsightMutation.mutate({ id: entry.id }); }}
                          className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {expandedHistoryId === entry.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {expandedHistoryId === entry.id && (
                      <div className="p-4 border-t border-border bg-secondary/20">
                        {entry.metrics && (
                          <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-background rounded-lg">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">CTR Médio</p>
                              <p className="font-bold text-sm">{((entry.metrics as any).avgCTR ?? 0).toFixed(2)}%</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Cliques</p>
                              <p className="font-bold text-sm">{((entry.metrics as any).totalClicks ?? 0).toLocaleString("pt-BR")}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Gasto</p>
                              <p className="font-bold text-sm">R$ {((entry.metrics as any).totalSpend ?? 0).toFixed(2)}</p>
                            </div>
                          </div>
                        )}
                        <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                          <Streamdown>{entry.content}</Streamdown>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seção Alertas de CTR */}
      {showAlerts && (
        <Card className="border-orange-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-orange-400" />
              Alertas Automáticos de CTR
              <span className="text-xs text-muted-foreground font-normal">Receba e-mail quando o CTR cair abaixo do limite</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Formulário para criar alerta */}
            <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Plus className="w-4 h-4" /> Criar novo alerta
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">E-mail para notificação</label>
                  <input
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Limite de CTR (%)</label>
                  <input
                    type="number"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(Number(e.target.value))}
                    min={1} max={100} step={0.5}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Grupo de anúncios</label>
                  <input
                    type="text"
                    value={alertGroup}
                    onChange={(e) => setAlertGroup(e.target.value)}
                    placeholder="all (todos os grupos)"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateAlert}
                disabled={!alertEmail || upsertAlertMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-foreground rounded-lg text-sm font-medium hover:bg-orange-700 transition disabled:opacity-50"
              >
                {upsertAlertMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                Criar Alerta
              </button>
            </div>

            {/* Lista de alertas existentes */}
            {(alertRules as any[])?.length ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Alertas ativos</p>
                {(alertRules as any[]).map((rule: any) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      {rule.active ? <Bell className="w-4 h-4 text-orange-400" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                      <div>
                        <p className="text-sm font-medium">{rule.email}</p>
                        <p className="text-xs text-muted-foreground">
                          CTR &lt; {rule.thresholdPercent}% • Grupo: {rule.adGroupName === "all" ? "Todos" : rule.adGroupName}
                          {rule.lastTriggeredAt && ` • Último disparo: ${new Date(rule.lastTriggeredAt).toLocaleDateString("pt-BR")}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAlertMutation.mutate({ id: rule.id })}
                      className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta configurado ainda.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gráfico de Linhas — Evolução do CTR */}
      {(chartData.length > 0 || trendsLoading) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                Evolução do CTR ao Longo do Tempo
                <span className="text-xs text-muted-foreground font-normal ml-1">— {PERIOD_LABELS[period]}</span>
              </CardTitle>
              <button
                onClick={() => setShowComparison(!showComparison)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  showComparison ? "bg-indigo-600 text-foreground border-indigo-600" : "bg-secondary text-foreground border-border hover:bg-secondary/80"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                {showComparison ? "Ocultar comparação" : "Comparar períodos"}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground h-48 justify-center">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Carregando dados de tendência...
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Sem dados de tendência para o período selecionado.
              </div>
            ) : (
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="ctr"
                      orientation="left"
                      tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                    />
                    <YAxis
                      yAxisId="cpc"
                      orientation="right"
                      tickFormatter={(v) => `R$${v.toFixed(2)}`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip content={<CTRTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      formatter={(value) => value === "ctr" ? "CTR (%)" : value === "cpc" ? "CPC (R$)" : value}
                    />
                    <Line
                      yAxisId="ctr"
                      type="monotone"
                      dataKey="ctr"
                      name="CTR (%)"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      yAxisId="cpc"
                      type="monotone"
                      dataKey="cpc"
                      name="CPC (R$)"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {chartData.length > 0 && (
              <div className="flex gap-6 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                <span>
                  CTR médio:{" "}
                  <strong className="text-foreground">
                    {chartData.length > 0
                      ? `${(chartData.reduce((s, d) => s + d.ctr, 0) / chartData.length * 100).toFixed(2)}%`
                      : "—"}
                  </strong>
                </span>
                <span>
                  CTR máx:{" "}
                  <strong className="text-green-400">
                    {chartData.length > 0
                      ? `${(Math.max(...chartData.map(d => d.ctr)) * 100).toFixed(2)}%`
                      : "—"}
                  </strong>
                </span>
                <span>
                  CTR mín:{" "}
                  <strong className="text-red-400">
                    {chartData.length > 0
                      ? `${(Math.min(...chartData.map(d => d.ctr)) * 100).toFixed(2)}%`
                      : "—"}
                  </strong>
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gráfico Comparativo de CTR */}
      {showComparison && (
        <Card className="border-indigo-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                Comparação de CTR entre Períodos
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Comparar com:</span>
                <div className="flex flex-wrap gap-1">
                  {(["7d", "14d", "30d", "90d", "this_month", "last_month"] as PeriodType[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setComparePeriod(p)}
                      disabled={p === period}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                        comparePeriod === p && p !== period
                          ? "bg-indigo-600 text-foreground"
                          : p === period
                          ? "opacity-30 cursor-not-allowed bg-secondary text-foreground"
                          : "bg-secondary text-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 && compareChartData.length > 0 ? (
              <>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        allowDuplicatedCategory={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        width={50}
                      />
                      <Tooltip content={<CTRTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Line
                        data={chartData}
                        type="monotone"
                        dataKey="ctr"
                        name={`CTR — ${PERIOD_LABELS[period]}`}
                        stroke="#8b5cf6"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        data={compareChartData}
                        type="monotone"
                        dataKey="ctr"
                        name={`CTR — ${PERIOD_LABELS[comparePeriod]}`}
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border">
                  <div className="text-center p-3 bg-violet-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">{PERIOD_LABELS[period]}</p>
                    <p className="text-lg font-bold text-violet-400">
                      {(chartData.reduce((s, d) => s + d.ctr, 0) / chartData.length * 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">CTR médio</p>
                  </div>
                  <div className="text-center p-3 bg-amber-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">{PERIOD_LABELS[comparePeriod]}</p>
                    <p className="text-lg font-bold text-amber-400">
                      {(compareChartData.reduce((s, d) => s + d.ctr, 0) / compareChartData.length * 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">CTR médio</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Selecione um período de comparação diferente do período atual.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuração */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Configurar Análise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Período de análise</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PERIOD_LABELS) as PeriodType[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    period === p ? "bg-violet-600 text-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {period === "custom" && (
            <div className="flex gap-4 items-center">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data inicial</label>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data final</label>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm" />
              </div>
            </div>
          )}

          {hasData && summaryData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-secondary/30 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Impressões</p>
                <p className="font-bold">{(summaryData.totalImpressions ?? 0).toLocaleString("pt-BR")}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Cliques</p>
                <p className="font-bold">{(summaryData.totalClicks ?? 0).toLocaleString("pt-BR")}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">CTR Médio</p>
                <p className="font-bold">{(summaryData.avgCtr ?? 0).toFixed(2)}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Gasto Total</p>
                <p className="font-bold">R$ {(summaryData.totalSpend ?? 0).toFixed(2)}</p>
              </div>
            </div>
          )}

          {isDataLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Carregando dados do Google Ads...
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!hasData || isGenerating || isDataLoading}
            className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-foreground rounded-lg font-medium hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <><RefreshCw className="w-5 h-5 animate-spin" />Gerando insights com IA...</>
            ) : (
              <><Bot className="w-5 h-5" />Gerar Insights com IA</>
            )}
          </button>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultado dos Insights */}
      {insightsText && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  Recomendações Estratégicas
                </CardTitle>
                {/* Tags aplicadas */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedTags.map(tagId => {
                      const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <span key={tagId} className={`px-2 py-0.5 rounded-full text-xs font-medium border ${tag.color}`}>
                          {tag.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {generatedAt && (
                  <span className="text-xs text-muted-foreground">
                    Gerado em {new Date(generatedAt).toLocaleString("pt-BR")}
                  </span>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary text-foreground rounded-lg hover:bg-secondary/80 border border-border transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                  Regenerar
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <Streamdown>{filteredInsights ?? insightsText}</Streamdown>
            </div>
            {filterTag && (
              <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="w-3.5 h-3.5" />
                Filtrando por tag: <strong>{AVAILABLE_TAGS.find(t => t.id === filterTag)?.label}</strong>
                <button onClick={() => setFilterTag(null)} className="underline hover:text-foreground">Remover filtro</button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estado inicial */}
      {!insightsText && !isGenerating && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center">
              <Bot className="w-8 h-8 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Pronto para analisar suas campanhas</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-md">
                Selecione o período desejado e clique em "Gerar Insights com IA" para receber
                recomendações estratégicas baseadas nos dados reais do Google Ads.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span>Identifica oportunidades</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <span>Detecta problemas</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-500" />
                <span>Sugere ações práticas</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
