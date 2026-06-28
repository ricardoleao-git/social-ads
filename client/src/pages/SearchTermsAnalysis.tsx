/**
 * Análise de Termos de Pesquisa — Fase 1 + Fase 2
 * Fase 1: Tabela de termos mais clicados com métricas reais (CTR, CPC, gasto, conversões)
 * Fase 2: Classificação automática por IA com motivo justificado e badge de categoria
 * Permite propor negativação com motivo pré-preenchido para aprovação manual.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Eye,
  TrendingDown,
  TrendingUp,
  Filter,
  Ban,
  BarChart3,
  Target,
  DollarSign,
  MousePointerClick,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface SearchTerm {
  term: string;
  status: string;
  adGroupId: string;
  adGroupName: string;
  adGroupStatus: string;
  campaignName: string;
  campaignId: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  convRate: number;
  isAlreadyNegative: boolean;
  inferredReason: string;
  reasonLabel: string;
  intentCategory: string;
  suggestedDecision: "negative" | "keep" | "monitor";
  confidence: number;
}

// ─── Constantes de UI ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  relevancia: "Relevância",
  publico: "Público",
  concorrencia: "Concorrência",
  produto: "Produto",
  preco: "Preço",
  performance: "Performance",
  localidade: "Localidade",
  suporte: "Suporte",
  outro: "Outro",
};

const CATEGORY_COLORS: Record<string, string> = {
  relevancia: "bg-yellow-100 text-yellow-800 border-yellow-200",
  publico: "bg-blue-100 text-blue-800 border-blue-200",
  concorrencia: "bg-red-100 text-red-800 border-red-200",
  produto: "bg-orange-100 text-orange-800 border-orange-200",
  preco: "bg-pink-100 text-pink-800 border-pink-200",
  performance: "bg-purple-100 text-purple-800 border-purple-200",
  localidade: "bg-teal-100 text-teal-800 border-teal-200",
  suporte: "bg-gray-100 text-gray-800 border-gray-200",
  outro: "bg-slate-100 text-slate-800 border-slate-200",
};

const DECISION_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  negative: {
    label: "Negativar",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <Ban className="w-3 h-3" />,
  },
  keep: {
    label: "Manter",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  monitor: {
    label: "Monitorar",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: <Eye className="w-3 h-3" />,
  },
};

const PERIOD_OPTIONS = [
  { value: "LAST_7_DAYS", label: "Últimos 7 dias" },
  { value: "LAST_14_DAYS", label: "Últimos 14 dias" },
  { value: "LAST_30_DAYS", label: "Últimos 30 dias" },
];

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function SearchTermsAnalysis() {
  // Filtros
  const [period, setPeriod] = useState<"LAST_7_DAYS" | "LAST_14_DAYS" | "LAST_30_DAYS">("LAST_30_DAYS");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [adGroupFilter, setAdGroupFilter] = useState("all");
  const [minClicks, setMinClicks] = useState(0);
  const [sortBy, setSortBy] = useState<"clicks" | "spend" | "ctr" | "impressions">("clicks");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Mutation para adicionar negativo
  const addNegativeMutation = trpc.googleAds.addNegativeKeyword.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message ?? "Negativo adicionado!");
        refetch();
      } else {
        toast.error(data.error ?? "Erro ao negativar");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Query principal
  const { data, isLoading, error, refetch, isFetching } = trpc.googleAds.getSearchTermsReport.useQuery(
    { period, minClicks },
    { staleTime: 5 * 60 * 1000 }
  );

  // Filtros e ordenação no frontend
  const filteredTerms = useMemo(() => {
    if (!data?.terms) return [];
    let terms = [...data.terms] as SearchTerm[];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      terms = terms.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          t.adGroupName.toLowerCase().includes(q) ||
          t.reasonLabel.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") {
      terms = terms.filter((t) => t.intentCategory === categoryFilter);
    }
    if (decisionFilter !== "all") {
      terms = terms.filter((t) => t.suggestedDecision === decisionFilter);
    }
    if (adGroupFilter !== "all") {
      terms = terms.filter((t) => t.adGroupName === adGroupFilter);
    }

    terms.sort((a, b) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      return sortDir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });

    return terms;
  }, [data?.terms, searchQuery, categoryFilter, decisionFilter, adGroupFilter, sortBy, sortDir]);

  // Exportar CSV
  const exportCSV = () => {
    if (!filteredTerms.length) return;
    const header = [
      "Termo",
      "Grupo de Anúncio",
      "Campanha",
      "Impressões",
      "Cliques",
      "CTR (%)",
      "CPC (R$)",
      "Gasto (R$)",
      "Conversões",
      "Taxa Conv. (%)",
      "Categoria",
      "Motivo Sugerido",
      "Decisão",
      "Confiança (%)",
      "Já Negativo",
    ].join(",");
    const rows = filteredTerms.map((t) =>
      [
        `"${t.term.replace(/"/g, '""')}"`,
        `"${t.adGroupName.replace(/"/g, '""')}"`,
        `"${t.campaignName.replace(/"/g, '""')}"`,
        t.impressions,
        t.clicks,
        t.ctr.toFixed(2),
        t.cpc.toFixed(2),
        t.spend.toFixed(2),
        t.conversions,
        t.convRate.toFixed(2),
        CATEGORY_LABELS[t.intentCategory] ?? t.intentCategory,
        `"${t.reasonLabel.replace(/"/g, '""')}"`,
        t.suggestedDecision,
        t.confidence,
        t.isAlreadyNegative ? "Sim" : "Não",
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `termos-pesquisa-${period.toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredTerms.length} termos exportados como CSV.`);
  };

  // Propor negativação
  const handleProposeNegative = (term: SearchTerm) => {
    if (term.isAlreadyNegative) {
      toast.info(`"${term.term}" já é uma palavra-chave negativa.`);
      return;
    }
    addNegativeMutation.mutate({
      text: term.term,
      matchType: "PHRASE",
      level: "campaign",
      campaignId: term.campaignId,
      reason: term.reasonLabel,
    });
  };

  const stats = data?.stats;
  const adGroupNames: string[] = (data?.adGroupNames ?? []) as string[];

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col ? (
      sortDir === "desc" ? <ChevronDown className="w-3 h-3 inline ml-1" /> : <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Search className="w-6 h-6 text-blue-600" />
            Análise de Termos de Pesquisa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fase 1: Termos mais clicados · Fase 2: Classificação automática com motivo justificado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filteredTerms.length}>
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{stats.totalTerms}</p>
              <p className="text-xs text-muted-foreground">termos</p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Negativar</span>
              </div>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.toNegative}</p>
              <p className="text-xs text-muted-foreground">sugeridos</p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Manter</span>
              </div>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.toKeep}</p>
              <p className="text-xs text-muted-foreground">relevantes</p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Monitorar</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.toMonitor}</p>
              <p className="text-xs text-muted-foreground">indefinidos</p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-indigo-500" />
                <span className="text-xs text-muted-foreground">Cliques</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{stats.totalClicks.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground">total</p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Gasto</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">
                R$ {stats.totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">período</p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Conversões</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{stats.totalConversions}</p>
              <p className="text-xs text-muted-foreground">total</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Distribuição por categoria */}
      {stats?.categoryDist && Object.keys(stats.categoryDist).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-500" />
              Distribuição por Categoria de Intenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.categoryDist)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-800 border-gray-200"
                    } ${categoryFilter === cat ? "ring-2 ring-offset-1 ring-blue-500" : "hover:opacity-80"}`}
                  >
                    {CATEGORY_LABELS[cat] ?? cat}
                    <span className="font-bold">{count}</span>
                  </button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar termo, grupo ou motivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={adGroupFilter} onValueChange={setAdGroupFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Todos os grupos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {adGroupNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={decisionFilter} onValueChange={setDecisionFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Decisão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as decisões</SelectItem>
                <SelectItem value="negative">Negativar</SelectItem>
                <SelectItem value="keep">Manter</SelectItem>
                <SelectItem value="monitor">Monitorar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Mín. cliques:</span>
              <Input
                type="number"
                min={0}
                value={minClicks}
                onChange={(e) => setMinClicks(Number(e.target.value))}
                className="w-20"
              />
            </div>
            {(searchQuery || categoryFilter !== "all" || decisionFilter !== "all" || adGroupFilter !== "all" || minClicks > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setDecisionFilter("all");
                  setAdGroupFilter("all");
                  setMinClicks(0);
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de termos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              Termos de Pesquisa — {filteredTerms.length} resultado{filteredTerms.length !== 1 ? "s" : ""}
            </span>
            {data?.fetchedAt && (
              <span className="text-xs text-muted-foreground font-normal">
                Atualizado: {new Date(data.fetchedAt).toLocaleString("pt-BR")}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
              <span className="text-muted-foreground">Carregando termos de pesquisa...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 text-destructive gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Erro ao carregar: {error.message}</span>
            </div>
          ) : filteredTerms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Search className="w-8 h-8 opacity-40" />
              <span>Nenhum termo encontrado com os filtros aplicados.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Termo de Pesquisa</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Grupo</th>
                    <th
                      className="text-right px-3 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("clicks")}
                    >
                      Cliques <SortIcon col="clicks" />
                    </th>
                    <th
                      className="text-right px-3 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("impressions")}
                    >
                      Impr. <SortIcon col="impressions" />
                    </th>
                    <th
                      className="text-right px-3 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("ctr")}
                    >
                      CTR <SortIcon col="ctr" />
                    </th>
                    <th
                      className="text-right px-3 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("spend")}
                    >
                      Gasto <SortIcon col="spend" />
                    </th>
                    <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Conv.</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Categoria</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Decisão</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTerms.map((term, idx) => {
                    const isExpanded = expandedRow === term.term;
                    const decisionCfg = DECISION_CONFIG[term.suggestedDecision];
                    return (
                      <>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <tr
                          key={`${term.term}-${idx}`}
                          className={`border-b transition-colors hover:bg-muted/20 ${
                            term.isAlreadyNegative ? "opacity-50" : ""
                          } ${isExpanded ? "bg-muted/10" : ""}`}
                        >
                          {/* Termo */}
                          <td className="px-4 py-3 max-w-xs">
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() => setExpandedRow(isExpanded ? null : term.term)}
                                className="mt-0.5 text-muted-foreground hover:text-foreground"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                              <div>
                                <p className="font-medium text-foreground break-words">{term.term}</p>
                                {term.isAlreadyNegative && (
                                  <span className="text-xs text-muted-foreground italic">já negativado</span>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Grupo */}
                          <td className="px-4 py-3 max-w-[180px]">
                            <p className="text-xs text-muted-foreground truncate" title={term.adGroupName}>
                              {term.adGroupName}
                            </p>
                          </td>
                          {/* Cliques */}
                          <td className="px-3 py-3 text-right font-medium">
                            {term.clicks.toLocaleString("pt-BR")}
                          </td>
                          {/* Impressões */}
                          <td className="px-3 py-3 text-right text-muted-foreground">
                            {term.impressions.toLocaleString("pt-BR")}
                          </td>
                          {/* CTR */}
                          <td className="px-3 py-3 text-right">
                            <span
                              className={`font-medium ${
                                term.ctr >= 8
                                  ? "text-green-600"
                                  : term.ctr >= 4
                                  ? "text-yellow-600"
                                  : "text-red-500"
                              }`}
                            >
                              {term.ctr.toFixed(1)}%
                            </span>
                          </td>
                          {/* Gasto */}
                          <td className="px-3 py-3 text-right">
                            <span className={term.spend > 10 && term.conversions === 0 ? "text-red-500 font-medium" : ""}>
                              R$ {term.spend.toFixed(2)}
                            </span>
                          </td>
                          {/* Conversões */}
                          <td className="px-3 py-3 text-right">
                            <span className={term.conversions > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                              {term.conversions}
                            </span>
                          </td>
                          {/* Categoria */}
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                CATEGORY_COLORS[term.intentCategory] ?? "bg-gray-100 text-gray-800 border-gray-200"
                              }`}
                            >
                              {CATEGORY_LABELS[term.intentCategory] ?? term.intentCategory}
                            </span>
                          </td>
                          {/* Decisão */}
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${decisionCfg.color}`}
                            >
                              {decisionCfg.icon}
                              {decisionCfg.label}
                            </span>
                          </td>
                          {/* Ação */}
                          <td className="px-3 py-3 text-center">
                            {term.suggestedDecision === "negative" && !term.isAlreadyNegative ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs px-2"
                                onClick={() => handleProposeNegative(term)}
                                disabled={addNegativeMutation.isPending}
                              >
                                <Ban className="w-3 h-3 mr-1" />
                                Negativar
                              </Button>
                            ) : term.isAlreadyNegative ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2"
                                onClick={() => setExpandedRow(isExpanded ? null : term.term)}
                              >
                                <Info className="w-3 h-3 mr-1" />
                                Ver
                              </Button>
                            )}
                          </td>
                        </tr>
                        {/* Linha expandida — Fase 2: detalhes da classificação */}
                        {isExpanded && (
                          <tr key={`${term.term}-expanded`} className="bg-muted/10">
                            <td colSpan={10} className="px-6 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Motivo da classificação */}
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Motivo da Classificação (IA)
                                  </p>
                                  <div className="flex items-start gap-2">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border mt-0.5 ${
                                        CATEGORY_COLORS[term.intentCategory] ?? "bg-gray-100 text-gray-800 border-gray-200"
                                      }`}
                                    >
                                      {CATEGORY_LABELS[term.intentCategory] ?? term.intentCategory}
                                    </span>
                                    <p className="text-sm text-foreground font-medium">{term.reasonLabel}</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Código: <code className="bg-muted px-1 rounded">{term.inferredReason}</code>
                                  </p>
                                </div>
                                {/* Métricas detalhadas */}
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Métricas Detalhadas
                                  </p>
                                  <div className="grid grid-cols-2 gap-1 text-xs">
                                    <span className="text-muted-foreground">CPC médio:</span>
                                    <span className="font-medium">R$ {term.cpc.toFixed(2)}</span>
                                    <span className="text-muted-foreground">Taxa conv.:</span>
                                    <span className="font-medium">{term.convRate.toFixed(1)}%</span>
                                    <span className="text-muted-foreground">Status API:</span>
                                    <span className="font-medium">{term.status || "—"}</span>
                                    <span className="text-muted-foreground">Campanha:</span>
                                    <span className="font-medium truncate">{term.campaignName}</span>
                                  </div>
                                </div>
                                {/* Confiança e ação */}
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Confiança da Classificação
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-muted rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full ${
                                          term.confidence >= 85
                                            ? "bg-green-500"
                                            : term.confidence >= 70
                                            ? "bg-yellow-500"
                                            : "bg-orange-400"
                                        }`}
                                        style={{ width: `${term.confidence}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-bold text-foreground">{term.confidence}%</span>
                                  </div>
                                  {term.suggestedDecision === "negative" && !term.isAlreadyNegative && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="w-full text-xs"
                                      onClick={() => handleProposeNegative(term)}
                                      disabled={addNegativeMutation.isPending}
                                    >
                                      <Ban className="w-3 h-3 mr-1" />
                                      Negativar "{term.term}" (PHRASE)
                                    </Button>
                                  )}
                                  {term.suggestedDecision === "keep" && (
                                    <div className="flex items-center gap-1 text-green-600 text-xs">
                                      <TrendingUp className="w-3 h-3" />
                                      Termo relevante — manter ativo
                                    </div>
                                  )}
                                  {term.suggestedDecision === "monitor" && (
                                    <div className="flex items-center gap-1 text-yellow-600 text-xs">
                                      <TrendingDown className="w-3 h-3" />
                                      Monitorar performance nas próximas semanas
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top grupos por gasto */}
      {stats?.topGroups && stats.topGroups.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-orange-500" />
              Top Grupos por Gasto nos Termos de Pesquisa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topGroups.map((g, i) => {
                const maxSpend = stats.topGroups[0]?.spend ?? 1;
                const pct = (g.spend / maxSpend) * 100;
                return (
                  <div key={g.name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium truncate">{g.name}</span>
                        <span className="text-xs font-bold text-foreground ml-2 whitespace-nowrap">
                          R$ {g.spend.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
