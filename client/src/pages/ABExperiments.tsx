import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FlaskConical,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Bot,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Lightbulb,
  Target,
  BarChart3,
  Clock,
} from "lucide-react";

type ExperimentStatus = "draft" | "running" | "paused" | "completed" | "archived";
type ExperimentType = "rsa_variant" | "bid_strategy" | "keyword_match" | "landing_page";

const statusConfig: Record<ExperimentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-700", icon: <Clock className="h-3 w-3" /> },
  running: { label: "Em Execução", color: "bg-green-100 text-green-700", icon: <Play className="h-3 w-3" /> },
  paused: { label: "Pausado", color: "bg-yellow-100 text-yellow-700", icon: <Pause className="h-3 w-3" /> },
  completed: { label: "Concluído", color: "bg-blue-100 text-blue-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  archived: { label: "Arquivado", color: "bg-gray-100 text-muted-foreground", icon: <XCircle className="h-3 w-3" /> },
};

const typeLabels: Record<ExperimentType, string> = {
  rsa_variant: "Variante de RSA",
  bid_strategy: "Estratégia de Lance",
  keyword_match: "Correspondência de Keyword",
  landing_page: "Página de Destino",
};

const metricLabels: Record<string, string> = {
  ctr: "CTR",
  cpc: "CPC",
  conversions: "Conversões",
  cost_per_conversion: "Custo/Conversão",
};

function ResultBadge({ result }: { result: string | null }) {
  if (!result) return null;
  if (result === "variant_wins") return (
    <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
      <TrendingUp className="h-3 w-3" /> Variante Venceu
    </span>
  );
  if (result === "control_wins") return (
    <span className="flex items-center gap-1 text-blue-600 text-xs font-medium">
      <TrendingDown className="h-3 w-3" /> Controle Venceu
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-muted-foreground text-xs font-medium">
      <Minus className="h-3 w-3" /> Inconclusivo
    </span>
  );
}

export default function ABExperiments() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedExp, setSelectedExp] = useState<number | null>(null);
  const [showAIAnalysis, setShowAIAnalysis] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);
  const [suggestCampaign, setSuggestCampaign] = useState("Social Ads - Wallbox Veículo Elétrico");

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    campaignName: "",
    adGroupName: "",
    experimentType: "rsa_variant" as ExperimentType,
    hypothesis: "",
    primaryMetric: "ctr",
    metricGoal: "",
    controlName: "Controle (Atual)",
    controlDescription: "",
    controlContent: "",
    variantAName: "Variante A",
    variantADescription: "",
    variantAContent: "",
    variantBName: "Variante B",
    variantBDescription: "",
    variantBContent: "",
  });
  const [useThreeVariants, setUseThreeVariants] = useState(false);

  const utils = trpc.useUtils();

  const { data: experiments = [], isLoading } = trpc.abExperiments.list.useQuery(
    { status: statusFilter },
    { refetchInterval: 30000 }
  );

  const createMutation = trpc.abExperiments.create.useMutation({
    onSuccess: () => {
      utils.abExperiments.list.invalidate();
      setShowCreateDialog(false);
      setUseThreeVariants(false);
      setForm({
        name: "", description: "", campaignName: "", adGroupName: "",
        experimentType: "rsa_variant", hypothesis: "", primaryMetric: "ctr",
        metricGoal: "", controlName: "Controle (Atual)", controlDescription: "",
        controlContent: "", variantAName: "Variante A", variantADescription: "",
        variantAContent: "", variantBName: "Variante B", variantBDescription: "", variantBContent: "",
      });
    },
  });

  const updateStatusMutation = trpc.abExperiments.updateStatus.useMutation({
    onSuccess: () => utils.abExperiments.list.invalidate(),
  });

  const analyzeAIMutation = trpc.abExperiments.analyzeWithAI.useMutation({
    onSuccess: (data, variables) => {
      utils.abExperiments.list.invalidate();
      setShowAIAnalysis(variables.experimentId);
    },
  });

  const deleteMutation = trpc.abExperiments.delete.useMutation({
    onSuccess: () => utils.abExperiments.list.invalidate(),
  });

  const suggestMutation = trpc.abExperiments.suggestExperiment.useMutation({
    onSuccess: (data) => {
      setAiSuggestions(data.suggestions);
    },
  });

  const handleCreate = () => {
    const variants: any[] = [
      {
        variantType: "control",
        name: form.controlName,
        description: form.controlDescription,
        content: form.controlContent,
      },
      {
        variantType: "variant_a",
        name: form.variantAName,
        description: form.variantADescription,
        content: form.variantAContent,
      },
    ];
    if (useThreeVariants && form.variantBName.trim()) {
      variants.push({
        variantType: "variant_b",
        name: form.variantBName,
        description: form.variantBDescription,
        content: form.variantBContent,
      });
    }
    createMutation.mutate({
      name: form.name,
      description: form.description,
      campaignName: form.campaignName,
      adGroupName: form.adGroupName,
      experimentType: form.experimentType,
      hypothesis: form.hypothesis,
      primaryMetric: form.primaryMetric as any,
      metricGoal: form.metricGoal,
      variants,
    });
  };

  const stats = {
    total: experiments.length,
    running: experiments.filter(e => e.status === "running").length,
    completed: experiments.filter(e => e.status === "completed").length,
    variantWins: experiments.filter(e => e.result === "variant_wins").length,
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-primary" />
              Experimentos A/B
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Teste variações de RSA, lances e estratégias para otimizar performance B2B
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSuggestDialog(true)}
              className="gap-2"
            >
              <Lightbulb className="h-4 w-4" />
              Sugerir com IA
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Experimento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Experimento A/B</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Nome do Experimento *</label>
                      <Input
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Ex: Teste de Headline Wallbox vs Social Ads"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Campanha</label>
                      <Input
                        value={form.campaignName}
                        onChange={e => setForm(f => ({ ...f, campaignName: e.target.value }))}
                        placeholder="Nome da campanha"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Grupo de Anúncios</label>
                      <Input
                        value={form.adGroupName}
                        onChange={e => setForm(f => ({ ...f, adGroupName: e.target.value }))}
                        placeholder="Nome do grupo"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Tipo de Experimento</label>
                      <Select value={form.experimentType} onValueChange={v => setForm(f => ({ ...f, experimentType: v as ExperimentType }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rsa_variant">Variante de RSA</SelectItem>
                          <SelectItem value="bid_strategy">Estratégia de Lance</SelectItem>
                          <SelectItem value="keyword_match">Correspondência de Keyword</SelectItem>
                          <SelectItem value="landing_page">Página de Destino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Métrica Principal</label>
                      <Select value={form.primaryMetric} onValueChange={v => setForm(f => ({ ...f, primaryMetric: v }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ctr">CTR</SelectItem>
                          <SelectItem value="cpc">CPC</SelectItem>
                          <SelectItem value="conversions">Conversões</SelectItem>
                          <SelectItem value="cost_per_conversion">Custo/Conversão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Hipótese</label>
                      <Textarea
                        value={form.hypothesis}
                        onChange={e => setForm(f => ({ ...f, hypothesis: e.target.value }))}
                        placeholder="Ex: Usar 'Wallbox para Empresas' como headline principal aumentará o CTR em 20% pois é mais específico para B2B"
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Meta</label>
                      <Input
                        value={form.metricGoal}
                        onChange={e => setForm(f => ({ ...f, metricGoal: e.target.value }))}
                        placeholder="Ex: CTR > 12%"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Variantes</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        onClick={() => setUseThreeVariants(v => !v)}
                      >
                        <Plus className="h-3 w-3" />
                        {useThreeVariants ? "Remover Variante B" : "Adicionar Variante B"}
                      </Button>
                    </div>
                    <div className={`grid gap-4 ${useThreeVariants ? "grid-cols-3" : "grid-cols-2"}`}>
                      {/* Controle */}
                      <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-gray-400" />
                          <span className="text-xs font-semibold text-muted-foreground">CONTROLE</span>
                        </div>
                        <Input
                          value={form.controlName}
                          onChange={e => setForm(f => ({ ...f, controlName: e.target.value }))}
                          placeholder="Nome do controle"
                          className="text-sm"
                        />
                        <Textarea
                          value={form.controlDescription}
                          onChange={e => setForm(f => ({ ...f, controlDescription: e.target.value }))}
                          placeholder="Descreva o anúncio atual (headlines, descriptions)"
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                      {/* Variante A */}
                      <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <span className="text-xs font-semibold text-primary">VARIANTE A</span>
                        </div>
                        <Input
                          value={form.variantAName}
                          onChange={e => setForm(f => ({ ...f, variantAName: e.target.value }))}
                          placeholder="Nome da variante A"
                          className="text-sm"
                        />
                        <Textarea
                          value={form.variantADescription}
                          onChange={e => setForm(f => ({ ...f, variantADescription: e.target.value }))}
                          placeholder="Descreva as mudanças testadas"
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                      {/* Variante B (opcional) */}
                      {useThreeVariants && (
                        <div className="space-y-2 p-3 bg-orange-500/5 rounded-lg border border-orange-500/20">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-orange-500" />
                            <span className="text-xs font-semibold text-orange-500">VARIANTE B</span>
                          </div>
                          <Input
                            value={form.variantBName}
                            onChange={e => setForm(f => ({ ...f, variantBName: e.target.value }))}
                            placeholder="Nome da variante B"
                            className="text-sm"
                          />
                          <Textarea
                            value={form.variantBDescription}
                            onChange={e => setForm(f => ({ ...f, variantBDescription: e.target.value }))}
                            placeholder="Descreva as mudanças testadas"
                            rows={3}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={!form.name || createMutation.isPending}
                    >
                      {createMutation.isPending ? "Criando..." : "Criar Experimento"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total, icon: <FlaskConical className="h-4 w-4" />, color: "text-foreground" },
            { label: "Em Execução", value: stats.running, icon: <Play className="h-4 w-4" />, color: "text-green-600" },
            { label: "Concluídos", value: stats.completed, icon: <CheckCircle2 className="h-4 w-4" />, color: "text-blue-600" },
            { label: "Variante Venceu", value: stats.variantWins, icon: <TrendingUp className="h-4 w-4" />, color: "text-primary" },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                  <div className={stat.color}>{stat.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrar:</span>
          {["all", "draft", "running", "paused", "completed", "archived"].map(s => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="text-xs"
            >
              {s === "all" ? "Todos" : statusConfig[s as ExperimentStatus]?.label || s}
            </Button>
          ))}
        </div>

        {/* Experiments List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando experimentos...</div>
        ) : experiments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FlaskConical className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum experimento encontrado.</p>
              <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro teste A/B para otimizar suas campanhas.</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Criar Experimento
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {experiments.map(exp => {
              const status = exp.status as ExperimentStatus;
              const sConfig = statusConfig[status];
              const control = exp.variants?.find(v => v.variantType === "control");
              const variant = exp.variants?.find(v => v.variantType !== "control");

              return (
                <Card key={exp.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{exp.name}</CardTitle>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sConfig.color}`}>
                            {sConfig.icon}
                            {sConfig.label}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {typeLabels[exp.experimentType as ExperimentType] || exp.experimentType}
                          </Badge>
                        </div>
                        {exp.campaignName && (
                          <p className="text-xs text-muted-foreground mt-1">
                            📢 {exp.campaignName}{exp.adGroupName ? ` › ${exp.adGroupName}` : ""}
                          </p>
                        )}
                        {exp.hypothesis && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{exp.hypothesis}"</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {exp.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => updateStatusMutation.mutate({ id: exp.id, status: "running", startDate: new Date() })}
                          >
                            <Play className="h-3 w-3" /> Iniciar
                          </Button>
                        )}
                        {exp.status === "running" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => updateStatusMutation.mutate({ id: exp.id, status: "paused" })}
                            >
                              <Pause className="h-3 w-3" /> Pausar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => updateStatusMutation.mutate({ id: exp.id, status: "completed", endDate: new Date() })}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Concluir
                            </Button>
                          </>
                        )}
                        {exp.status === "paused" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => updateStatusMutation.mutate({ id: exp.id, status: "running" })}
                          >
                            <Play className="h-3 w-3" /> Retomar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => analyzeAIMutation.mutate({ experimentId: exp.id })}
                          disabled={analyzeAIMutation.isPending}
                        >
                          <Bot className="h-3 w-3" />
                          {analyzeAIMutation.isPending ? "..." : "Analisar IA"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Deletar este experimento?")) {
                              deleteMutation.mutate({ id: exp.id });
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {/* Variantes comparação — suporta 2 ou 3 variantes */}
                    {exp.variants && exp.variants.length >= 2 && (() => {
                      const variantColors = [
                        { bg: "bg-muted/30", dot: "bg-gray-400", text: "text-muted-foreground", label: "CONTROLE" },
                        { bg: "bg-primary/5 border border-primary/20", dot: "bg-primary", text: "text-primary", label: "VARIANTE A" },
                        { bg: "bg-orange-500/5 border border-orange-500/20", dot: "bg-orange-500", text: "text-orange-500", label: "VARIANTE B" },
                      ];
                      const sortedVariants = [
                        exp.variants.find(v => v.variantType === "control"),
                        exp.variants.find(v => v.variantType === "variant_a" || (v.variantType !== "control" && v.variantType !== "variant_b")),
                        exp.variants.find(v => v.variantType === "variant_b"),
                      ].filter(Boolean);
                      const cols = sortedVariants.length === 3 ? "grid-cols-3" : "grid-cols-2";
                      return (
                        <div className={`grid ${cols} gap-3 mb-3`}>
                          {sortedVariants.map((v, idx) => {
                            const cfg = variantColors[idx] || variantColors[1];
                            return (
                              <div key={v!.id} className={`p-3 rounded-lg ${cfg.bg}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                                  <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                                  <span className="text-xs text-muted-foreground truncate">{v!.name}</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-center">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Impr.</p>
                                    <p className="text-sm font-bold">{(v!.impressions || 0).toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Cliques</p>
                                    <p className="text-sm font-bold">{(v!.clicks || 0).toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">CTR</p>
                                    <p className="text-sm font-bold">{v!.ctr || "0.00"}%</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">CPC</p>
                                    <p className="text-sm font-bold">R$ {v!.cpc || "0.00"}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Info row */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        {exp.primaryMetric && (
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Métrica: {metricLabels[exp.primaryMetric] || exp.primaryMetric}
                            {exp.metricGoal && ` (meta: ${exp.metricGoal})`}
                          </span>
                        )}
                        {exp.startDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Início: {new Date(exp.startDate).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                      <ResultBadge result={exp.result || null} />
                    </div>

                    {/* AI Analysis */}
                    {showAIAnalysis === exp.id && exp.aiAnalysis && (
                      <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-primary" />
                          <span className="text-xs font-semibold text-primary">Análise da IA</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-5 text-xs"
                            onClick={() => setShowAIAnalysis(null)}
                          >
                            Fechar
                          </Button>
                        </div>
                        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{exp.aiAnalysis}</p>
                      </div>
                    )}
                    {exp.aiAnalysis && showAIAnalysis !== exp.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs text-primary"
                        onClick={() => setShowAIAnalysis(exp.id)}
                      >
                        <Bot className="h-3 w-3 mr-1" /> Ver análise da IA
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Suggest Dialog */}
        <Dialog open={showSuggestDialog} onOpenChange={setShowSuggestDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Sugestões de Experimentos por IA
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Campanha</label>
                <Input
                  value={suggestCampaign}
                  onChange={e => setSuggestCampaign(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={() => suggestMutation.mutate({ campaignName: suggestCampaign })}
                disabled={suggestMutation.isPending}
                className="w-full gap-2"
              >
                <Bot className="h-4 w-4" />
                {suggestMutation.isPending ? "Gerando sugestões..." : "Gerar Sugestões com IA"}
              </Button>
              {aiSuggestions && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiSuggestions}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
