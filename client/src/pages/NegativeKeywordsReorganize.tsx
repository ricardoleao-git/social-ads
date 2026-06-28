import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, XCircle, Info, PlayCircle, Eye, ArrowLeft, Zap, RefreshCw, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

export default function NegativeKeywordsReorganize() {
  const [, setLocation] = useLocation();
  const [report, setReport] = useState<{
    added: string[];
    skipped: string[];
    errors: string[];
    summary: string;
  } | null>(null);
  const [mode, setMode] = useState<"idle" | "dryrun" | "live">("idle");

  // Diagnóstico ao vivo via API
  const diagnosis = trpc.googleAds.getReorgDiagnosis.useQuery(undefined, {
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // sempre busca dados frescos da API
  });

  const reorganize = trpc.googleAds.reorganizeNegativeKeywords.useMutation({
    onSuccess: (data) => {
      setReport(data);
      // Invalidar o diagnóstico para recarregar após execução
      diagnosis.refetch();
    },
  });

  const handleDryRun = () => {
    setMode("dryrun");
    setReport(null);
    reorganize.mutate({ dryRun: true });
  };

  const handleLive = () => {
    setMode("live");
    setReport(null);
    reorganize.mutate({ dryRun: false });
  };

  const isLoading = reorganize.isPending;
  const d = diagnosis.data;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/negative-keywords")} className="w-fit">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold">Reorganização de Palavras Negativas</h1>
          <p className="text-muted-foreground text-sm">Consolidação e otimização via Google Ads API</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => diagnosis.refetch()}
          disabled={diagnosis.isFetching}
          className="flex items-center gap-2 w-fit"
        >
          {diagnosis.isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          <span className="hidden sm:inline">Atualizar diagnóstico</span>
          <span className="sm:hidden">Atualizar</span>
        </Button>
      </div>

      {/* Diagnóstico ao vivo */}
      {diagnosis.isFetching && !d && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Consultando Google Ads API para diagnóstico atual...
        </div>
      )}

      {d && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Duplicatas */}
          <Card className={d.duplicateCount > 0 ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "border-green-200 bg-green-50 dark:bg-green-950/20"}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-base flex items-center gap-2 ${d.duplicateCount > 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                {d.duplicateCount > 0 ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {d.duplicateCount > 0 ? "Duplicatas Detectadas" : "Sem Duplicatas"}
              </CardTitle>
            </CardHeader>
            <CardContent className={`text-sm ${d.duplicateCount > 0 ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}`}>
              {d.duplicateCount > 0 ? (
                <>
                  <strong>{d.duplicateCount} negativos de grupo</strong> já existem na campanha — redundantes e desnecessários.
                  <div className="mt-2 text-xs opacity-75">{d.adGroupNegCount} no grupo · {d.campaignNegCount} na campanha</div>
                </>
              ) : (
                <>
                  <strong>Estrutura limpa!</strong> Nenhum negativo de grupo duplica a campanha.
                  <div className="mt-2 text-xs opacity-75">{d.adGroupNegCount} no grupo · {d.campaignNegCount} na campanha</div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Lacunas estratégicas */}
          <Card className={d.missingStrategicCount > 0 ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20" : "border-green-200 bg-green-50 dark:bg-green-950/20"}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-base flex items-center gap-2 ${d.missingStrategicCount > 0 ? "text-yellow-700 dark:text-yellow-400" : "text-green-700 dark:text-green-400"}`}>
                {d.missingStrategicCount > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {d.missingStrategicCount > 0 ? "Lacunas Estratégicas" : "Cobertura Completa"}
              </CardTitle>
            </CardHeader>
            <CardContent className={`text-sm ${d.missingStrategicCount > 0 ? "text-yellow-700 dark:text-yellow-300" : "text-green-700 dark:text-green-300"}`}>
              {d.missingStrategicCount > 0 ? (
                <>
                  <strong>{d.missingStrategicCount} termos estratégicos faltando</strong> na campanha.
                  {d.missingStrategicTerms.length > 0 && (
                    <div className="mt-2 text-xs font-mono opacity-80 space-y-0.5">
                      {d.missingStrategicTerms.slice(0, 5).map((t, i) => <div key={i}>• {t}</div>)}
                      {d.missingStrategicTerms.length > 5 && <div>... e mais {d.missingStrategicCount - 5}</div>}
                    </div>
                  )}
                </>
              ) : (
                <strong>Todos os termos estratégicos críticos estão cobertos!</strong>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Resultado esperado / atual */}
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Info className="w-4 h-4" /> Estado Atual
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-700 dark:text-blue-300">
              <div className="space-y-1">
                <div><strong>{d.totalNegCount}</strong> negativos no total</div>
                <div><strong>{d.campaignNegCount}</strong> a nível de campanha</div>
                <div><strong>{d.adGroupNegCount}</strong> a nível de grupo</div>
                {d.toConsolidateCount > 0 && (
                  <div className="mt-2 text-xs opacity-80">
                    <strong>{d.toConsolidateCount}</strong> termos de grupo aparecem em 3+ grupos — candidatos a consolidar.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Estratégia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            Estratégia de Reorganização (como especialista em tráfego pago)
          </CardTitle>
          <CardDescription>
            Princípio fundamental: <strong>campanha = proteção universal, grupo = proteção específica</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-base">
                Ação 1 — Consolidar {d ? `(${d.toConsolidateCount} termos detectados)` : "(termos em 3+ grupos)"}
              </h3>
              <p className="text-muted-foreground">
                Termos que aparecem em 3+ grupos serão adicionados ao <strong>nível de campanha</strong>.
                Isso garante proteção em todos os grupos atuais e futuros, sem precisar repetir em cada um.
              </p>
              {d && d.toConsolidateTerms.length > 0 && (
                <div className="text-xs font-mono bg-muted/50 rounded p-2 space-y-0.5">
                  {d.toConsolidateTerms.map((t, i) => <div key={i} className="text-muted-foreground">• {t}</div>)}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-base">
                Ação 2 — Adicionar Estratégicos {d ? `(${d.missingStrategicCount} faltando)` : "(termos críticos)"}
              </h3>
              <p className="text-muted-foreground">
                Termos faltantes críticos: <strong>concorrentes diretos</strong> (Control ID, ZKTeco, Anviz),
                <strong> IAs pessoais</strong> (Gemini, Claude, Copilot, Grok), <strong>intenção de emprego</strong> (estágio, trainee, salário),
                <strong> B2C residencial</strong> e <strong>preço baixo</strong>.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-xs space-y-1">
            <p className="font-medium">⚠️ O que esta ação NÃO faz:</p>
            <p className="text-muted-foreground">
              Não remove os negativos dos grupos (a API do Google Ads exige os IDs dos critérios para remoção,
              que precisam ser buscados individualmente). Os negativos de grupo continuarão funcionando — apenas
              serão redundantes. Recomenda-se remover manualmente no painel do Google Ads após confirmar que
              os de campanha estão ativos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Executar via API
          </CardTitle>
          <CardDescription>
            Use "Pré-visualizar" primeiro para ver exatamente o que será feito, sem alterar nada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={handleDryRun}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              {isLoading && mode === "dryrun" ? "Simulando..." : "Pré-visualizar (Dry-Run)"}
            </Button>
            <Button
              onClick={handleLive}
              disabled={isLoading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <PlayCircle className="w-4 h-4" />
              {isLoading && mode === "live" ? "Executando via API..." : "Executar via API (Live)"}
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              Consultando Google Ads API...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relatório */}
      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Relatório de Execução
            </CardTitle>
            <CardDescription className="font-medium text-base">{report.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Adicionados */}
            {report.added.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {report.added.length} {mode === "dryrun" ? "seriam adicionados" : "adicionados"}
                  </Badge>
                </h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {report.added.map((item, i) => (
                    <div key={i} className="text-xs font-mono bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 px-3 py-1.5 rounded border border-green-200 dark:border-green-800">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pulados */}
            {report.skipped.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Badge variant="secondary">
                    {report.skipped.length} já existiam
                  </Badge>
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {report.skipped.map((item, i) => (
                    <div key={i} className="text-xs font-mono bg-muted/50 text-muted-foreground px-3 py-1.5 rounded">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Erros */}
            {report.errors.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    {report.errors.length} erros
                  </Badge>
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {report.errors.map((item, i) => (
                    <div key={i} className="text-xs font-mono bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 px-3 py-1.5 rounded border border-red-200 dark:border-red-800">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === "live" && report.errors.length === 0 && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm text-green-800 dark:text-green-200">
                ✅ <strong>Reorganização concluída com sucesso!</strong> Os negativos foram adicionados ao nível de campanha via Google Ads API.
                Acesse o painel do Google Ads para confirmar e, em seguida, remova manualmente os negativos redundantes dos grupos de anúncios.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
