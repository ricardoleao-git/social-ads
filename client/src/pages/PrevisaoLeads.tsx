import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, CheckCircle, XCircle, Clock, Sparkles, BarChart3, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const probColors: Record<string, string> = {
  alta: "bg-green-500/20 text-green-400 border-green-500/30",
  media: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  baixa: "bg-red-500/20 text-red-400 border-red-500/30",
};

const probLabels: Record<string, string> = {
  alta: "Alta Probabilidade",
  media: "Média Probabilidade",
  baixa: "Baixa Probabilidade",
};

export default function PrevisaoLeads() {
  const [activeTab, setActiveTab] = useState<"alta" | "media" | "baixa">("alta");

  const { data: predictions, refetch } = trpc.leadPrediction.getPredictions.useQuery();
  const { data: stats } = trpc.leadPrediction.getAccuracyStats.useQuery();

  const generate = trpc.leadPrediction.generatePredictions.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${result.count} previsões geradas para a semana de ${result.weekOf}`);
        refetch();
      } else {
        toast.warning(result.message);
      }
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const updateStatus = trpc.leadPrediction.updateStatus.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const filtered = (predictions ?? []).filter(
    (p) => p.probability === activeTab && p.status === "pending"
  );

  const tabCounts = {
    alta: (predictions ?? []).filter((p: any) => p.probability === "alta" && p.status === "pending").length,
    media: (predictions ?? []).filter((p: any) => p.probability === "media" && p.status === "pending").length,
    baixa: (predictions ?? []).filter((p: any) => p.probability === "baixa" && p.status === "pending").length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-400" />
            Previsão de Leads com IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Análise preditiva de termos de busca — quais têm alta probabilidade de converter antes de investir
          </p>
        </div>
        <Button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {generate.isPending ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Analisando...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Gerar Previsão Agora</>
          )}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Analisados", value: stats?.total ?? 0, icon: <BarChart3 className="w-5 h-5 text-muted-foreground" />, color: "text-foreground" },
          { label: "Alta Probabilidade", value: stats?.alta ?? 0, icon: <TrendingUp className="w-5 h-5 text-green-400" />, color: "text-green-400" },
          { label: "Adicionados como Keyword", value: stats?.added ?? 0, icon: <CheckCircle className="w-5 h-5 text-blue-400" />, color: "text-blue-400" },
          { label: "Rejeitados", value: stats?.rejected ?? 0, icon: <XCircle className="w-5 h-5 text-muted-foreground" />, color: "text-muted-foreground" },
        ].map((s) => (
          <Card key={s.label} className="bg-card/50 border-border">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                {s.icon}
                <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
              </div>
              <p className="text-muted-foreground text-xs mt-2">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Como funciona */}
      <Card className="bg-purple-900/20 border-purple-500/30">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-purple-300 text-sm font-medium">Como a IA analisa os termos</p>
              <p className="text-muted-foreground text-xs mt-1">
                A IA analisa os termos que converteram nos últimos 90 dias, identifica padrões (intenção B2B, urgência, especificidade do produto) e classifica novos termos com cliques mas sem conversão. Termos com alta probabilidade são candidatos a adicionar como palavras-chave ou criar grupos específicos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs por probabilidade */}
      <div>
        <div className="flex gap-2 mb-4">
          {(["alta", "media", "baixa"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab
                  ? tab === "alta" ? "bg-green-600 text-foreground" : tab === "media" ? "bg-yellow-600 text-foreground" : "bg-red-600/70 text-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {probLabels[tab]}
              {tabCounts[tab] > 0 && (
                <span className="bg-white/20 text-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Card className="bg-card/50 border-border">
            <CardContent className="py-12 text-center">
              <Brain className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-muted-foreground">Nenhuma previsão pendente de {probLabels[activeTab].toLowerCase()}.</p>
              <p className="text-slate-500 text-sm mt-1">Clique em "Gerar Previsão Agora" para analisar os termos da semana.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((pred: any) => (
              <Card key={pred.id} className="bg-card/50 border-border hover:border-border transition-colors">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-foreground text-sm font-medium leading-snug">{pred.term}</p>
                    <Badge className={`text-xs border shrink-0 ${probColors[pred.probability]}`}>
                      {pred.probability === "alta" ? "Alta" : pred.probability === "media" ? "Média" : "Baixa"}
                    </Badge>
                  </div>

                  {(pred.clicks ?? 0) > 0 && (
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{pred.clicks} cliques</span>
                      {pred.ctr && <span>CTR {pred.ctr}%</span>}
                    </div>
                  )}

                  <p className="text-muted-foreground text-xs leading-relaxed">{pred.reason}</p>

                  {pred.suggestedAction && (
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-muted-foreground text-xs">
                        <span className="text-blue-400 font-medium">Ação sugerida: </span>
                        {pred.suggestedAction}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => updateStatus.mutate({ id: pred.id, status: "added" })}
                      disabled={updateStatus.isPending}
                      className="flex-1 bg-green-600/80 hover:bg-green-600 text-xs h-7"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Adicionar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus.mutate({ id: pred.id, status: "rejected" })}
                      disabled={updateStatus.isPending}
                      className="flex-1 border-border text-muted-foreground text-xs h-7"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Histórico de ações */}
      {(predictions ?? []).filter(p => p.status !== "pending").length > 0 && (
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Histórico de Ações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(predictions ?? []).filter(p => p.status !== "pending").map((pred: any) => (
                <div key={pred.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    {pred.status === "added" ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="text-muted-foreground text-sm">{pred.term}</span>
                    <Badge className={`text-xs border ${probColors[pred.probability]}`}>
                      {pred.probability}
                    </Badge>
                  </div>
                  <span className="text-slate-500 text-xs">
                    {pred.status === "added" ? "Adicionado" : "Rejeitado"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
