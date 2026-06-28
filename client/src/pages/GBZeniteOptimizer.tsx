/**
 * GB Zênite Optimizer — Diagnóstico e otimização da campanha Smart/Performance Max
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, CheckCircle, XCircle, TrendingDown,
  Clock, Smartphone, Monitor, Tablet, Globe,
  Lightbulb, FlaskConical, FileText, RefreshCw, ChevronDown, ChevronUp,
  Target, Zap, BarChart3, Activity, Wifi
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge className="bg-green-600 text-foreground text-sm px-3 py-1">Excelente {score}%</Badge>;
  if (score >= 60) return <Badge className="bg-yellow-500 text-foreground text-sm px-3 py-1">Bom {score}%</Badge>;
  if (score >= 40) return <Badge className="bg-orange-500 text-foreground text-sm px-3 py-1">Regular {score}%</Badge>;
  return <Badge className="bg-red-600 text-foreground text-sm px-3 py-1">Crítico {score}%</Badge>;
}

function DeviceIcon({ device }: { device: string }) {
  const d = device?.toUpperCase();
  if (d === "MOBILE") return <Smartphone className="w-4 h-4 text-blue-400" />;
  if (d === "DESKTOP") return <Monitor className="w-4 h-4 text-green-400" />;
  if (d === "TABLET") return <Tablet className="w-4 h-4 text-purple-400" />;
  return <Globe className="w-4 h-4 text-muted-foreground" />;
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function GBZeniteOptimizer() {
  const [activeTab, setActiveTab] = useState("diagnosis");
  const [expandedRsa, setExpandedRsa] = useState<number | null>(null);
  const [generatingRsa, setGeneratingRsa] = useState(false);
  const [rsaResult, setRsaResult] = useState<any>(null);
  const [whenWherePeriod] = useState<"7d" | "30d" | "90d">("7d");

  // Queries
  const { data: diagData, isLoading: loadingDiagnosis, refetch: refetchDiagnosis } =
    trpc.gbZenite.getCampaignDiagnosis.useQuery({ period: "30d" });

  const { data: whenWhere, isLoading: loadingWhenWhere } =
    trpc.gbZenite.getWhenWhereReport.useQuery({ period: whenWherePeriod });

  const { data: experiments } =
    trpc.gbZenite.getExperimentsSuggestions.useQuery();

  const { data: optLog } =
    trpc.gbZenite.getOptimizationLog.useQuery({ limit: 20 });

  // Mutation para gerar sugestões de RSA
  const generateRsa = trpc.gbZenite.generateRsaSuggestions.useMutation({
    onSuccess: (data) => {
      setRsaResult(data);
      setGeneratingRsa(false);
    },
    onError: () => setGeneratingRsa(false),
  });

  const handleGenerateRsa = () => {
    setGeneratingRsa(true);
    generateRsa.mutate({ context: "Campanha GB Zênite - Smart Campaign para segurança eletrônica e controle de acesso B2B na Paraíba" });
  };

  // Extrair dados do diagnóstico
  const campaign = diagData?.campaigns?.[0];
  const diagnosis = diagData?.diagnosis;
  const assets = diagData?.assets ?? [];
  const healthScore = diagnosis?.qualityScore ?? 0;
  const issues = diagnosis?.issues ?? [];
  const recommendations = diagnosis?.recommendations ?? [];

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            GB Zênite — Optimizer
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Campanha Smart · R$ 13,60/dia · Diagnóstico automático + recomendações de IA
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchDiagnosis()}
          className="border-border text-muted-foreground hover:bg-muted"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Score Cards */}
      {loadingDiagnosis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs mb-2">Saúde da Campanha</p>
              <ScoreBadge score={healthScore} />
              <p className="text-muted-foreground text-xs mt-2">{issues.length} problema(s)</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs mb-1">CTR</p>
              <p className="text-2xl font-bold text-foreground">{campaign?.ctr ?? "—"}%</p>
              <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                <TrendingDown className="w-3 h-3" /> Meta: ≥ 2%
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs mb-1">Custo Total</p>
              <p className="text-2xl font-bold text-foreground">R$ {campaign?.costBRL ?? "0"}</p>
              <p className="text-xs text-muted-foreground mt-1">{campaign?.clicks ?? 0} cliques · {campaign?.impressions ?? 0} impr.</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs mb-1">Conversões</p>
              <p className="text-2xl font-bold text-foreground">{campaign?.conversions ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">CPC: R$ {campaign?.avgCpc ?? "—"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border flex-wrap h-auto gap-1">
          <TabsTrigger value="diagnosis" className="data-[state=active]:bg-gray-700 text-muted-foreground text-xs">
            <Activity className="w-3 h-3 mr-1" />Diagnóstico
          </TabsTrigger>
          <TabsTrigger value="rsa" className="data-[state=active]:bg-gray-700 text-muted-foreground text-xs">
            <Lightbulb className="w-3 h-3 mr-1" />RSA & Recursos
          </TabsTrigger>
          <TabsTrigger value="whenwhere" className="data-[state=active]:bg-gray-700 text-muted-foreground text-xs">
            <Clock className="w-3 h-3 mr-1" />Quando/Onde
          </TabsTrigger>
          <TabsTrigger value="experiments" className="data-[state=active]:bg-gray-700 text-muted-foreground text-xs">
            <FlaskConical className="w-3 h-3 mr-1" />Experimentos
          </TabsTrigger>
          <TabsTrigger value="log" className="data-[state=active]:bg-gray-700 text-muted-foreground text-xs">
            <FileText className="w-3 h-3 mr-1" />Log Diretoria
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Diagnóstico ─────────────────────────────────────────────── */}
        <TabsContent value="diagnosis" className="space-y-4 mt-4">
          {loadingDiagnosis ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Problemas identificados */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground text-base flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    Problemas Identificados ({issues.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {issues.length === 0 ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      <p className="text-sm">Nenhum problema crítico identificado.</p>
                    </div>
                  ) : (
                    issues.map((issue: string, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-gray-200 text-sm">{issue}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Recomendações */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground text-base flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-400" />
                    Recomendações ({recommendations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recommendations.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhuma recomendação disponível.</p>
                  ) : (
                    recommendations.map((rec: string, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <div className="w-5 h-5 rounded-full bg-blue-900 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-300 text-xs font-bold">{i + 1}</span>
                        </div>
                        <p className="text-gray-200 text-sm">{rec}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Resumo de assets */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground text-base flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                    Resumo de Recursos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-muted rounded text-center">
                      <p className="text-2xl font-bold text-foreground">{diagnosis?.assetCount ?? 0}</p>
                      <p className="text-muted-foreground text-xs">Assets totais</p>
                    </div>
                    <div className="p-3 bg-muted rounded text-center">
                      <p className="text-2xl font-bold text-foreground">{diagnosis?.keywordCount ?? 0}</p>
                      <p className="text-muted-foreground text-xs">Keywords</p>
                    </div>
                    <div className="p-3 bg-muted rounded text-center">
                      <p className="text-2xl font-bold text-foreground">{diagnosis?.negativeCount ?? 0}</p>
                      <p className="text-muted-foreground text-xs">Negativos</p>
                    </div>
                    <div className="p-3 bg-muted rounded text-center">
                      <p className={`text-2xl font-bold ${'hasImages' in (diagnosis ?? {}) ? (diagnosis as any)?.hasImages ? "text-green-400" : "text-red-400" : "text-muted-foreground"}`}>
                        {'hasImages' in (diagnosis ?? {}) ? (diagnosis as any)?.hasImages ? "✓" : "✗" : "—"}
                      </p>
                      <p className="text-muted-foreground text-xs">Imagens</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Tab: RSA & Recursos ──────────────────────────────────────────── */}
        <TabsContent value="rsa" className="space-y-4 mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                  Sugestões de RSA com IA
                </CardTitle>
                <Button
                  size="sm"
                  onClick={handleGenerateRsa}
                  disabled={generatingRsa}
                  className="bg-blue-700 hover:bg-blue-600 text-foreground"
                >
                  {generatingRsa ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Gerando...</>
                  ) : (
                    <><Zap className="w-4 h-4 mr-2" />Gerar Sugestões</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rsaResult ? (
                <div className="space-y-4">
                  {rsaResult.suggestions?.map((sug: any, i: number) => (
                    <div key={i} className="border border-border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between p-3 bg-muted hover:bg-gray-700 text-left"
                        onClick={() => setExpandedRsa(expandedRsa === i ? null : i)}
                      >
                        <span className="text-foreground text-sm font-medium">Variação {i + 1}: {sug.headline1 ?? sug.title ?? "Sugestão"}</span>
                        {expandedRsa === i ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      {expandedRsa === i && (
                        <div className="p-3 space-y-2 bg-card">
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Títulos:</p>
                            {[sug.headline1, sug.headline2, sug.headline3].filter(Boolean).map((h: string, j: number) => (
                              <p key={j} className="text-foreground text-sm bg-muted px-2 py-1 rounded mb-1">{h}</p>
                            ))}
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Descrições:</p>
                            {[sug.description1, sug.description2].filter(Boolean).map((d: string, j: number) => (
                              <p key={j} className="text-foreground text-sm bg-muted px-2 py-1 rounded mb-1">{d}</p>
                            ))}
                          </div>
                          {sug.rationale && (
                            <p className="text-blue-400 text-xs">💡 {sug.rationale}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {rsaResult.generalTips && (
                    <div className="p-3 bg-blue-950 border border-blue-800 rounded-lg">
                      <p className="text-blue-300 text-xs font-medium mb-1">Dicas Gerais:</p>
                      <p className="text-blue-200 text-xs whitespace-pre-wrap">{rsaResult.generalTips}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Lightbulb className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Clique em "Gerar Sugestões" para criar títulos e descrições otimizados para a campanha GB Zênite.</p>
                  <p className="text-muted-foreground text-xs mt-2">A IA criará variações focadas em conversão B2B para Paraíba.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recursos da campanha */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Recursos Ativos ({assets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assets.length === 0 ? (
                <div className="text-center py-6">
                  <XCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
                  <p className="text-red-400 text-sm font-medium">Nenhum recurso ativo encontrado</p>
                  <p className="text-muted-foreground text-xs mt-1 max-w-md mx-auto">A campanha GB Zênite está sem imagens, sitelinks, callouts ou snippets. Isso reduz drasticamente o alcance.</p>
                  <div className="mt-4 p-3 bg-red-950 border border-red-800 rounded-lg text-left max-w-md mx-auto">
                    <p className="text-red-300 text-xs font-medium mb-2">Ação urgente:</p>
                    <ul className="text-red-200 text-xs space-y-1">
                      <li>• Adicionar 3+ imagens (1200x628px e 1200x1200px)</li>
                      <li>• Criar 4+ sitelinks com URLs de produtos</li>
                      <li>• Adicionar 4+ callouts ("Suporte 24h", "Instalação Inclusa")</li>
                      <li>• Configurar snippets por categoria de produto</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {assets.map((asset: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-muted rounded">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm truncate">{asset.name || asset.text || "Recurso"}</p>
                        <p className="text-muted-foreground text-xs">{asset.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Quando/Onde ─────────────────────────────────────────────── */}
        <TabsContent value="whenwhere" className="space-y-4 mt-4">
          {loadingWhenWhere ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Insights automáticos */}
              {(whenWhere?.insights?.length ?? 0) > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground text-base flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-yellow-400" />
                      Insights Automáticos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {whenWhere?.insights?.map((insight: string, i: number) => (
                      <div key={i} className="p-3 bg-muted rounded-lg">
                        <p className="text-gray-200 text-sm">{insight}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Por dispositivo */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground text-base flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-blue-400" />
                    Performance por Dispositivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(whenWhere?.deviceData?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">Nenhum dado de dispositivo disponível para o período.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {whenWhere?.deviceData?.map((d: any, i: number) => (
                        <div key={i} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <DeviceIcon device={d.device} />
                            <span className="text-foreground text-sm font-medium">{d.deviceLabel}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><p className="text-muted-foreground">Cliques</p><p className="text-foreground font-medium">{d.clicks}</p></div>
                            <div><p className="text-muted-foreground">CTR</p><p className="text-foreground font-medium">{d.ctr}%</p></div>
                            <div><p className="text-muted-foreground">Custo</p><p className="text-foreground font-medium">R$ {d.costBRL}</p></div>
                            <div><p className="text-muted-foreground">Conv.</p><p className="text-foreground font-medium">{d.conversions}</p></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Por hora/dia */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground text-base flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-400" />
                    Melhores Horários e Dias (Top 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(whenWhere?.hourlyData?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">Nenhum dado de horário disponível para o período.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground text-xs border-b border-border">
                            <th className="text-left pb-2">Dia</th>
                            <th className="text-left pb-2">Hora</th>
                            <th className="text-right pb-2">Cliques</th>
                            <th className="text-right pb-2">Impr.</th>
                            <th className="text-right pb-2">CTR</th>
                            <th className="text-right pb-2">Custo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {whenWhere?.hourlyData?.slice(0, 10)?.map((h: any, i: number) => (
                            <tr key={i} className={h.clicks > 0 ? "bg-blue-950/20" : ""}>
                              <td className="py-2 text-foreground">{h.dayLabel}</td>
                              <td className="py-2 text-muted-foreground">{h.hourLabel}</td>
                              <td className="py-2 text-right text-foreground font-medium">{h.clicks}</td>
                              <td className="py-2 text-right text-muted-foreground">{h.impressions}</td>
                              <td className="py-2 text-right text-foreground">{h.ctr}%</td>
                              <td className="py-2 text-right text-muted-foreground">R$ {h.costBRL}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Por rede */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground text-base flex items-center gap-2">
                    <Wifi className="w-5 h-5 text-green-400" />
                    Onde os Anúncios Foram Exibidos (Rede)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(whenWhere?.networkData?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">Nenhum dado de rede disponível para o período.</p>
                  ) : (
                    <div className="space-y-2">
                      {whenWhere?.networkData?.map((n: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                          <Globe className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground text-sm font-medium">{n.networkLabel}</p>
                            <p className="text-muted-foreground text-xs">{n.impressions} impressões · {n.clicks} cliques · CTR {n.ctr}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-foreground text-sm">R$ {n.costBRL}</p>
                            <p className="text-muted-foreground text-xs">{n.conversions} conv.</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Tab: Experimentos ────────────────────────────────────────────── */}
        <TabsContent value="experiments" className="space-y-4 mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-purple-400" />
                Experimentos Recomendados para GB Zênite
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-purple-950 border border-purple-800 rounded-lg">
                <p className="text-purple-300 text-xs font-medium mb-1">O que são Experimentos Google Ads?</p>
                <p className="text-purple-200 text-xs">Experimentos permitem testar variações da campanha (lances, recursos, configurações) em uma fração do tráfego antes de aplicar globalmente. Ideal para campanhas Smart onde o controle manual é limitado.</p>
              </div>
              {(experiments?.suggestions?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Nenhum experimento disponível no momento.</p>
              ) : (
                experiments?.suggestions?.map((exp: any, i: number) => (
                  <div key={i} className="p-4 bg-muted rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-foreground text-sm font-medium">{exp.title}</p>
                        <p className="text-muted-foreground text-xs mt-1">{exp.description}</p>
                      </div>
                      <Badge className={
                        exp.difficulty === "easy" ? "bg-green-900 text-green-300" :
                        exp.difficulty === "medium" ? "bg-yellow-900 text-yellow-300" :
                        "bg-red-900 text-red-300"
                      }>
                        {exp.difficulty === "easy" ? "Fácil" : exp.difficulty === "medium" ? "Médio" : "Avançado"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-card rounded">
                        <p className="text-muted-foreground">Duração</p>
                        <p className="text-foreground">{exp.duration}</p>
                      </div>
                      <div className="p-2 bg-card rounded">
                        <p className="text-muted-foreground">Impacto esperado</p>
                        <p className="text-green-400">{exp.expectedImpact}</p>
                      </div>
                    </div>
                    {exp.steps && (
                      <div className="mt-2">
                        <p className="text-muted-foreground text-xs mb-1">Como criar:</p>
                        <ol className="text-muted-foreground text-xs space-y-0.5 list-decimal list-inside">
                          {exp.steps.map((step: string, j: number) => (
                            <li key={j}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Log Diretoria ───────────────────────────────────────────── */}
        <TabsContent value="log" className="space-y-4 mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-400" />
                Log de Otimizações — Para Diretoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs mb-4">Registro automático de todas as ações realizadas pelo sistema. Comprova que a gestão automatizada supera o gestor humano em velocidade e consistência.</p>
              {(optLog?.actions?.length ?? 0) === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">Nenhuma ação registrada ainda.</p>
                  <p className="text-muted-foreground text-xs mt-1">As automações registrarão ações aqui automaticamente.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {optLog?.actions?.map((log: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        log.status === "applied" ? "bg-green-400" :
                        log.status === "pending_approval" ? "bg-yellow-400" :
                        "bg-gray-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-foreground text-sm font-medium">{String(log.actionType ?? "").replace(/_/g, " ")}</p>
                          <Badge className="text-xs bg-gray-700 text-muted-foreground">{log.campaignName ?? "—"}</Badge>
                          <span className="text-muted-foreground text-xs">{new Date(log.createdAt).toLocaleString("pt-BR")}</span>
                        </div>
                        {log.reason && <p className="text-muted-foreground text-xs mt-0.5">{log.reason}</p>}
                        {log.estimatedSavings && (
                          <p className="text-green-400 text-xs mt-0.5">Economia estimada: R$ {log.estimatedSavings}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
