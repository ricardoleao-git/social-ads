import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, DollarSign, MousePointer, Eye, Target, RefreshCw, Lightbulb, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const scoreColor: Record<string, string> = {
  "Ótimo": "bg-green-500/20 text-green-400 border-green-500/30",
  "Bom": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Atenção": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Crítico": "bg-red-500/20 text-red-400 border-red-500/30",
};

const scoreIcon: Record<string, React.ReactNode> = {
  "Ótimo": <CheckCircle className="h-4 w-4 text-green-400" />,
  "Bom": <TrendingUp className="h-4 w-4 text-blue-400" />,
  "Atenção": <AlertTriangle className="h-4 w-4 text-yellow-400" />,
  "Crítico": <AlertTriangle className="h-4 w-4 text-red-400" />,
};

export default function CampaignAnalysis() {
  const [, navigate] = useLocation();
  const { data, isLoading, refetch } = trpc.googleAds.getCampaignAnalysis30d.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const groups = data?.groups ?? [];
  const summary = data?.summary;

  type GroupType = typeof groups[0];
  const criticalGroups = groups.filter((g: GroupType) => g.performanceScore === "Crítico");
  const attentionGroups = groups.filter((g: GroupType) => g.performanceScore === "Atenção");
  const goodGroups = groups.filter((g: GroupType) => g.performanceScore === "Ótimo" || g.performanceScore === "Bom");

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Análise de Desempenho — 30 Dias</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Campanha "Pesquisa Leads" · Oportunidades de otimização identificadas automaticamente
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Carregando dados da API do Google Ads...</span>
          </div>
        )}

        {!isLoading && data && (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Gasto Total</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">R$ {summary.totalSpend.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MousePointer className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Cliques</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">{summary.totalClicks.toLocaleString("pt-BR")}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Impressões</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">{summary.totalImpressions.toLocaleString("pt-BR")}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Conversões</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">{summary.totalConversions}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">CTR Médio</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">{summary.avgCtr.toFixed(2)}%</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">CPC Médio</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">R$ {summary.avgCpc.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className={`border-border/50 ${summary.groupsWithOpportunities > 0 ? "bg-yellow-500/10" : "bg-green-500/10"}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className="h-4 w-4 text-yellow-400" />
                      <span className="text-xs text-muted-foreground">Oportunidades</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">{summary.totalOpportunities}</p>
                    <p className="text-xs text-muted-foreground">{summary.groupsWithOpportunities} grupos</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Critical Groups Alert */}
            {criticalGroups.length > 0 && (
              <Card className="border-red-500/30 bg-red-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    {criticalGroups.length} Grupo(s) Crítico(s) — Ação Imediata Necessária
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {criticalGroups.map((g: GroupType) => (
                      <div key={g.id} className="flex flex-col gap-1 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground text-sm">{g.name}</span>
                          <span className="text-xs text-muted-foreground">R$ {g.spend.toFixed(2)} gasto</span>
                        </div>
                        <ul className="space-y-0.5">
                          {g.opportunities.map((opp: string, i: number) => (
                            <li key={i} className="text-xs text-red-300 flex items-center gap-1">
                              <span className="text-red-400">•</span> {opp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Attention Groups */}
            {attentionGroups.length > 0 && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="h-5 w-5" />
                    {attentionGroups.length} Grupo(s) com Atenção
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {attentionGroups.map((g: GroupType) => (
                      <div key={g.id} className="flex flex-col gap-1 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground text-sm">{g.name}</span>
                          <span className="text-xs text-muted-foreground">R$ {g.spend.toFixed(2)} · CTR {g.ctr}%</span>
                        </div>
                        <ul className="space-y-0.5">
                          {g.opportunities.map((opp: string, i: number) => (
                            <li key={i} className="text-xs text-yellow-300 flex items-center gap-1">
                              <span className="text-yellow-400">•</span> {opp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Groups Table */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Todos os Grupos de Anúncios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Grupo</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">CTR</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">CPC</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Cliques</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Conv.</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Gasto</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Imp. Share</th>
                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g: GroupType) => (
                        <tr key={g.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                          <td className="py-2 px-3">
                            <div>
                              <p className="font-medium text-foreground">{g.name}</p>
                              {g.opportunities.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                                  ⚡ {g.opportunities[0]}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className={g.ctr >= 8 ? "text-green-400" : g.ctr >= 4 ? "text-yellow-400" : "text-red-400"}>
                              {g.ctr.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-foreground">R$ {g.cpc.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-foreground">{g.clicks}</td>
                          <td className="py-2 px-3 text-right">
                            <span className={g.conversions > 0 ? "text-green-400 font-medium" : "text-muted-foreground"}>
                              {g.conversions}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-foreground">R$ {g.spend.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">
                            <span className={g.impressionShare >= 50 ? "text-green-400" : g.impressionShare >= 20 ? "text-yellow-400" : "text-red-400"}>
                              {g.impressionShare}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${scoreColor[g.performanceScore] ?? ""}`}>
                              {scoreIcon[g.performanceScore]}
                              {g.performanceScore}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Good Groups */}
            {goodGroups.length > 0 && (
              <Card className="border-green-500/30 bg-green-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    {goodGroups.length} Grupo(s) com Bom Desempenho
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {goodGroups.map((g: typeof groups[0]) => (
                      <span key={g.id} className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 text-sm">
                        {g.name} · CTR {g.ctr}% · {g.conversions} conv.
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!isLoading && !data?.success && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-6">
              <p className="text-red-400 text-center">
                Erro ao carregar dados da API do Google Ads. Verifique as credenciais.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
