import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle, TrendingUp, Target, ArrowUpDown, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

// Fetch data via API
const useQualityScoreData = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    fetch("/api/trpc/googleAds.getQualityScoreAnalysis")
      .then(res => res.json())
      .then(d => {
        const result = d?.result?.data?.json ?? d?.result?.data;
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  });

  return { data, loading, error };
};

function QSBadge({ score }: { score: number }) {
  if (score === 0) return <Badge variant="outline" className="text-gray-400">N/A</Badge>;
  if (score >= 7) return <Badge className="bg-green-600 text-white">{score}/10</Badge>;
  if (score >= 5) return <Badge className="bg-yellow-500 text-white">{score}/10</Badge>;
  return <Badge className="bg-red-600 text-white">{score}/10</Badge>;
}

function QualityBadge({ label }: { label: string }) {
  if (label === "Acima da Média") return <Badge className="bg-green-100 text-green-800 border-green-200">{label}</Badge>;
  if (label === "Na Média") return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">{label}</Badge>;
  if (label === "Abaixo da Média") return <Badge className="bg-red-100 text-red-800 border-red-200">{label}</Badge>;
  return <Badge variant="outline" className="text-gray-400">N/A</Badge>;
}

export default function QualityScore() {
  const { data, loading, error } = useQualityScoreData();
  const [sortBy, setSortBy] = useState<string>("qualityScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filterQS, setFilterQS] = useState<"all" | "critical" | "good">("all");

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-gray-400">Carregando Quality Score...</span>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="p-6">
        <Card className="border-red-500/30 bg-red-950/20">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400">Erro ao carregar Quality Score: {error || data?.error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data.stats;
  const keywords = data.keywords || [];

  // Filter
  let filtered = keywords;
  if (filterQS === "critical") filtered = keywords.filter((k: any) => k.qualityScore > 0 && k.qualityScore < 5);
  if (filterQS === "good") filtered = keywords.filter((k: any) => k.qualityScore >= 7);

  // Sort
  const sorted = [...filtered].sort((a: any, b: any) => {
    const aVal = a[sortBy] ?? 0;
    const bVal = b[sortBy] ?? 0;
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const toggleExpand = (idx: number) => {
    const next = new Set(expandedRows);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setExpandedRows(next);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Target className="w-7 h-7 text-blue-400" />
          Análise de Quality Score
        </h1>
        <p className="text-gray-400 mt-1">
          Quality Score por keyword com diagnóstico de relevância, landing page e CTR esperado — dados dos últimos 30 dias
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400 uppercase">Keywords Ativas</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400 uppercase">Com QS</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.withQualityScore}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400 uppercase">QS Médio</p>
            <p className={`text-2xl font-bold mt-1 ${stats.avgQualityScore >= 7 ? "text-green-400" : stats.avgQualityScore >= 5 ? "text-yellow-400" : "text-red-400"}`}>
              {stats.avgQualityScore}/10
            </p>
          </CardContent>
        </Card>
        <Card className="bg-red-950/30 border-red-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-red-400 uppercase">Abaixo de 5</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{stats.belowAverage}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-950/30 border-green-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-green-400 uppercase">Acima de 7</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{stats.aboveAverage}</p>
          </CardContent>
        </Card>
      </div>

      {/* Impacto no Rank Lost */}
      <Card className="bg-amber-950/20 border-amber-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-amber-400 flex items-center gap-2 text-base">
            <AlertTriangle className="w-5 h-5" />
            Impacto no Rank Lost (56% de impressões perdidas por ranking)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-300 space-y-2">
          <p>
            O <strong>Quality Score médio de {stats.avgQualityScore}/10</strong> com <strong>{stats.belowAverage} keywords abaixo de 5</strong> é 
            a principal causa dos 56% de impressões perdidas por ranking. Para reduzir esse percentual:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Prioridade 1:</strong> Melhorar landing pages das keywords com "Abaixo da Média" em experiência pós-clique</li>
            <li><strong>Prioridade 2:</strong> Revisar títulos RSA para incluir as keywords exatas nos headlines</li>
            <li><strong>Prioridade 3:</strong> Pausar keywords com QS ≤ 2 e recriar com melhor segmentação</li>
          </ul>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filterQS === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterQS("all")}
        >
          Todas ({keywords.length})
        </Button>
        <Button
          variant={filterQS === "critical" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterQS("critical")}
          className={filterQS === "critical" ? "bg-red-600" : ""}
        >
          Críticas QS&lt;5 ({stats.belowAverage})
        </Button>
        <Button
          variant={filterQS === "good" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterQS("good")}
          className={filterQS === "good" ? "bg-green-600" : ""}
        >
          Boas QS≥7 ({stats.aboveAverage})
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-gray-400 text-xs uppercase">
                <th className="p-3 text-left">Grupo / Keyword</th>
                <th className="p-3 text-center cursor-pointer hover:text-white" onClick={() => toggleSort("qualityScore")}>
                  <span className="flex items-center justify-center gap-1">QS <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="p-3 text-center">Relevância Anúncio</th>
                <th className="p-3 text-center">Landing Page</th>
                <th className="p-3 text-center">CTR Esperado</th>
                <th className="p-3 text-right cursor-pointer hover:text-white" onClick={() => toggleSort("impressions")}>
                  <span className="flex items-center justify-end gap-1">Impr. <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="p-3 text-right cursor-pointer hover:text-white" onClick={() => toggleSort("ctr")}>
                  <span className="flex items-center justify-end gap-1">CTR <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((kw: any, idx: number) => (
                <>
                  <tr key={idx} className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${kw.qualityScore > 0 && kw.qualityScore < 5 ? "bg-red-950/10" : ""}`}>
                    <td className="p-3">
                      <div className="font-medium text-white">{kw.keyword}</div>
                      <div className="text-xs text-gray-500">{kw.adGroup} · {kw.matchType === "2" || kw.matchType === "EXACT" ? "Exata" : kw.matchType === "3" || kw.matchType === "PHRASE" ? "Frase" : "Ampla"}</div>
                    </td>
                    <td className="p-3 text-center"><QSBadge score={kw.qualityScore} /></td>
                    <td className="p-3 text-center"><QualityBadge label={kw.creativeQuality} /></td>
                    <td className="p-3 text-center"><QualityBadge label={kw.landingPageExperience} /></td>
                    <td className="p-3 text-center"><QualityBadge label={kw.expectedCtr} /></td>
                    <td className="p-3 text-right text-gray-300">{kw.impressions.toLocaleString("pt-BR")}</td>
                    <td className="p-3 text-right text-gray-300">{kw.ctr.toFixed(1)}%</td>
                    <td className="p-3 text-center">
                      {kw.suggestions.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => toggleExpand(idx)}>
                          <Lightbulb className="w-4 h-4 text-yellow-400" />
                          {expandedRows.has(idx) ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expandedRows.has(idx) && kw.suggestions.length > 0 && (
                    <tr key={`${idx}-suggestions`} className="bg-slate-900/50">
                      <td colSpan={8} className="p-3 pl-6">
                        <div className="space-y-1">
                          {kw.suggestions.map((s: string, si: number) => (
                            <div key={si} className="flex items-start gap-2 text-sm">
                              <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                              <span className="text-gray-300">{s}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
