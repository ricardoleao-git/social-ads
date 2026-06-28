/**
 * Página de Palavras-chave — Keywords ativas com métricas reais da Google Ads API
 * Rota: /palavras-chave
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Download,
  RefreshCw,
  TrendingUp,
  MousePointerClick,
  DollarSign,
  Target,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  CheckCircle,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MATCH_TYPE_LABELS: Record<string, string> = {
  "2": "Ampla",
  "3": "Frase",
  "4": "Exata",
  BROAD: "Ampla",
  PHRASE: "Frase",
  EXACT: "Exata",
  UNSPECIFIED: "—",
  UNKNOWN: "—",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  "2": { label: "Ativa", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  "3": { label: "Pausada", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  "4": { label: "Removida", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  ENABLED: { label: "Ativa", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  PAUSED: { label: "Pausada", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  REMOVED: { label: "Removida", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

function getMatchLabel(matchType: string): string {
  return MATCH_TYPE_LABELS[matchType] ?? matchType;
}

function getStatusInfo(status: string) {
  return STATUS_LABELS[status] ?? { label: status, color: "bg-muted text-muted-foreground" };
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + "%";
}

type SortField = "text" | "impressions" | "clicks" | "ctr" | "cpc" | "conversions" | "spend" | "conversionRate";
type SortDir = "asc" | "desc";

// ─── Component ────────────────────────────────────────────────────────────────

export default function PalavrasChave() {
  const [period, setPeriod] = useState("7d");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [adGroupFilter, setAdGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [matchTypeFilter, setMatchTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [csvFeedback, setCsvFeedback] = useState(false);

  const { data, isLoading, refetch, isFetching } = trpc.googleAds.getKeywordsWithMetrics.useQuery(
    { period },
    { staleTime: 5 * 60 * 1000 }
  );

  type KeywordItem = { text: string; matchType: string; status: string; qualityScore: number | null; adGroupId: string; adGroupName: string; campaignId: string; campaignName: string; impressions: number; clicks: number; costMicros: number; spend: number; conversions: number; ctr: number; cpc: number; conversionRate: number; };
  const keywords: KeywordItem[] = (data?.keywords ?? []) as KeywordItem[];
  const campaigns: string[] = (data?.campaigns ?? []) as string[];
  const adGroups: string[] = (data?.adGroups ?? []) as string[];

  // ─── Filtros e ordenação ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = keywords;

    if (campaignFilter !== "all") {
      list = list.filter((k) => k.campaignName === campaignFilter);
    }
    if (adGroupFilter !== "all") {
      list = list.filter((k) => k.adGroupName === adGroupFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((k) => {
        const s = getStatusInfo(k.status).label;
        return s === statusFilter;
      });
    }
    if (matchTypeFilter !== "all") {
      list = list.filter((k) => getMatchLabel(k.matchType) === matchTypeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((k) =>
        k.text.toLowerCase().includes(q) ||
        k.adGroupName.toLowerCase().includes(q) ||
        k.campaignName.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      const av = a[sortField] as number | string;
      const bv = b[sortField] as number | string;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av as number;
      const bn = bv as number;
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [keywords, campaignFilter, adGroupFilter, statusFilter, matchTypeFilter, search, sortField, sortDir]);

  // ─── KPIs agregados ──────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total = filtered.length;
    const totalImpressions = filtered.reduce((s, k) => s + k.impressions, 0);
    const totalClicks = filtered.reduce((s, k) => s + k.clicks, 0);
    const totalConversions = filtered.reduce((s, k) => s + k.conversions, 0);
    const totalSpend = filtered.reduce((s, k) => s + k.spend, 0);
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const activeCount = filtered.filter((k) => getStatusInfo(k.status).label === "Ativa").length;
    return { total, totalImpressions, totalClicks, totalConversions, totalSpend, avgCtr, avgCpc, activeCount };
  }, [filtered]);

  // ─── Ordenação ───────────────────────────────────────────────────────────

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1 text-blue-500" />
      : <ChevronDown className="w-3 h-3 ml-1 text-blue-500" />;
  }

  // ─── Exportar CSV ─────────────────────────────────────────────────────────

  function exportCSV() {
    const BOM = "\uFEFF";
    const headers = [
      "Palavra-chave", "Tipo de Correspondência", "Status", "Campanha", "Grupo de Anúncios",
      "Impressões", "Cliques", "CTR (%)", "CPC (R$)", "Conversões", "Taxa Conv. (%)", "Gasto (R$)",
    ];
    const rows = filtered.map((k) => [
      `"${k.text}"`,
      getMatchLabel(k.matchType),
      getStatusInfo(k.status).label,
      `"${k.campaignName}"`,
      `"${k.adGroupName}"`,
      k.impressions,
      k.clicks,
      (k.ctr * 100).toFixed(2),
      k.cpc.toFixed(2),
      k.conversions,
      (k.conversionRate * 100).toFixed(2),
      k.spend.toFixed(2),
    ]);
    const csv = BOM + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palavras-chave-zenite-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setCsvFeedback(true);
    setTimeout(() => setCsvFeedback(false), 2500);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Palavras-chave</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Keywords ativas com métricas reais da Google Ads API
            {data?.fetchedAt && (
              <span className="ml-2 text-xs opacity-60">
                · Atualizado: {new Date(data.fetchedAt).toLocaleString("pt-BR")}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            variant={csvFeedback ? "default" : "outline"}
            size="sm"
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className={`gap-2 transition-colors ${csvFeedback ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : ""}`}
          >
            {csvFeedback ? (
              <><CheckCircle className="w-4 h-4" /> CSV Exportado!</>
            ) : (
              <><Download className="w-4 h-4" /> Exportar CSV</>
            )}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground font-medium">Keywords</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpis.total.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">{kpis.activeCount} ativas</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground font-medium">CTR Médio</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatPercent(kpis.avgCtr)}</p>
            <p className="text-xs text-muted-foreground">{kpis.totalImpressions.toLocaleString("pt-BR")} impressões</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <MousePointerClick className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground font-medium">Cliques</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpis.totalClicks.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">{kpis.totalConversions} conversões</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground font-medium">Gasto Total</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.totalSpend)}</p>
            <p className="text-xs text-muted-foreground">CPC médio: {formatCurrency(kpis.avgCpc)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Período */}
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>

            {/* Campanha */}
            <Select value={campaignFilter} onValueChange={(v) => { setCampaignFilter(v); setAdGroupFilter("all"); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Grupo de anúncios */}
            <Select value={adGroupFilter} onValueChange={setAdGroupFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {adGroups
                  .filter((g) => campaignFilter === "all" || keywords.some((k) => k.adGroupName === g && k.campaignName === campaignFilter))
                  .map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Ativa">Ativa</SelectItem>
                <SelectItem value="Pausada">Pausada</SelectItem>
                <SelectItem value="Removida">Removida</SelectItem>
              </SelectContent>
            </Select>

            {/* Tipo de correspondência */}
            <Select value={matchTypeFilter} onValueChange={setMatchTypeFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Correspondência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="Ampla">Ampla</SelectItem>
                <SelectItem value="Frase">Frase</SelectItem>
                <SelectItem value="Exata">Exata</SelectItem>
              </SelectContent>
            </Select>

            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
          {/* Contador de resultados */}
          <p className="text-xs text-muted-foreground mt-3">
            Exibindo <strong>{filtered.length}</strong> de <strong>{keywords.length}</strong> keywords
            {(campaignFilter !== "all" || adGroupFilter !== "all" || statusFilter !== "all" || matchTypeFilter !== "all" || search) && (
              <button
                onClick={() => { setCampaignFilter("all"); setAdGroupFilter("all"); setStatusFilter("all"); setMatchTypeFilter("all"); setSearch(""); }}
                className="ml-2 text-blue-500 hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando keywords da API...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="w-8 h-8 mb-2 opacity-40" />
              <p>Nenhuma keyword encontrada com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead
                      className="cursor-pointer select-none whitespace-nowrap"
                      onClick={() => handleSort("text")}
                    >
                      <span className="flex items-center">Palavra-chave <SortIcon field="text" /></span>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Tipo</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Campanha</TableHead>
                    <TableHead className="whitespace-nowrap">Grupo</TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right whitespace-nowrap"
                      onClick={() => handleSort("impressions")}
                    >
                      <span className="flex items-center justify-end">Impressões <SortIcon field="impressions" /></span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right whitespace-nowrap"
                      onClick={() => handleSort("clicks")}
                    >
                      <span className="flex items-center justify-end">Cliques <SortIcon field="clicks" /></span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right whitespace-nowrap"
                      onClick={() => handleSort("ctr")}
                    >
                      <span className="flex items-center justify-end">CTR <SortIcon field="ctr" /></span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right whitespace-nowrap"
                      onClick={() => handleSort("cpc")}
                    >
                      <span className="flex items-center justify-end">CPC <SortIcon field="cpc" /></span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right whitespace-nowrap"
                      onClick={() => handleSort("conversions")}
                    >
                      <span className="flex items-center justify-end">Conv. <SortIcon field="conversions" /></span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right whitespace-nowrap"
                      onClick={() => handleSort("conversionRate")}
                    >
                      <span className="flex items-center justify-end">Taxa Conv. <SortIcon field="conversionRate" /></span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right whitespace-nowrap"
                      onClick={() => handleSort("spend")}
                    >
                      <span className="flex items-center justify-end">Gasto <SortIcon field="spend" /></span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((kw, idx) => {
                    const statusInfo = getStatusInfo(kw.status);
                    return (
                      <TableRow
                        key={`${kw.text}-${kw.adGroupId}-${idx}`}
                        className="border-border hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-medium text-foreground max-w-[200px]">
                          <span className="block truncate" title={kw.text}>{kw.text}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {getMatchLabel(kw.matchType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[140px]">
                          <span className="block truncate" title={kw.campaignName}>{kw.campaignName}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[140px]">
                          <span className="block truncate" title={kw.adGroupName}>{kw.adGroupName}</span>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {kw.impressions.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {kw.clicks.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          <span className={kw.ctr >= 0.1 ? "text-green-600 dark:text-green-400 font-medium" : kw.ctr >= 0.05 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}>
                            {formatPercent(kw.ctr)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatCurrency(kw.cpc)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          <span className={kw.conversions > 0 ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                            {kw.conversions}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatPercent(kw.conversionRate)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-medium">
                          {formatCurrency(kw.spend)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legenda */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border">
        <strong>Legenda:</strong>{" "}
        <span className="text-green-600 dark:text-green-400 font-medium">CTR ≥ 10%</span> = Excelente •{" "}
        <span className="text-yellow-600 dark:text-yellow-400">CTR 5–10%</span> = Bom •{" "}
        <span className="text-red-600 dark:text-red-400">CTR &lt; 5%</span> = Atenção •{" "}
        Dados referentes ao período selecionado. Keywords sem impressões no período não são exibidas.
      </div>
    </div>
  );
}
