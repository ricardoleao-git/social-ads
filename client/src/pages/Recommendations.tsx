import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb, RefreshCw, CheckCircle, AlertTriangle, XCircle,
  Target, DollarSign, BarChart3, Zap, ArrowRight, ExternalLink,
  Filter, ChevronDown, ChevronUp, Copy, Check, Info
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Mapeamento de tipos para categorias e ícones
const categoryMap: Record<string, { category: string; icon: string; priority: 'high' | 'medium' | 'low'; description: string }> = {
  '2': { category: 'Palavras-chave', icon: '🔑', priority: 'high', description: 'Adicionar novas palavras-chave para ampliar alcance' },
  '3': { category: 'Extensões', icon: '🔗', priority: 'medium', description: 'Adicionar sitelinks para melhorar CTR' },
  '4': { category: 'Extensões', icon: '📝', priority: 'medium', description: 'Adicionar frases de destaque aos anúncios' },
  '5': { category: 'Extensões', icon: '📋', priority: 'low', description: 'Adicionar snippets estruturados' },
  '7': { category: 'Orçamento', icon: '💰', priority: 'high', description: 'Otimizar distribuição de orçamento entre campanhas' },
  '8': { category: 'Palavras-chave', icon: '🔍', priority: 'high', description: 'Usar correspondência ampla para captar mais tráfego relevante' },
  '9': { category: 'Anúncios', icon: '📰', priority: 'high', description: 'Criar anúncio responsivo de pesquisa (RSA)' },
  '10': { category: 'Extensões', icon: '📞', priority: 'medium', description: 'Adicionar extensão de chamada telefônica' },
  '13': { category: 'Palavras-chave', icon: '🗑️', priority: 'medium', description: 'Remover palavras-chave redundantes que competem entre si' },
  '14': { category: 'Anúncios', icon: '🖼️', priority: 'low', description: 'Adicionar imagens aos anúncios para maior destaque' },
  '15': { category: 'Segmentação', icon: '🎯', priority: 'medium', description: 'Usar segmentação otimizada para alcançar mais conversões' },
  '18': { category: 'Lances', icon: '⚡', priority: 'high', description: 'Migrar para estratégia de lances inteligentes' },
  '22': { category: 'Anúncios', icon: '💪', priority: 'high', description: 'Melhorar a força do anúncio (Ad Strength)' },
  '24': { category: 'Extensões', icon: '📋', priority: 'high', description: 'Adicionar formulário de lead para captar contatos' },
  'KEYWORD': { category: 'Palavras-chave', icon: '🔑', priority: 'high', description: 'Adicionar novas palavras-chave sugeridas' },
  'USE_BROAD_MATCH_KEYWORD': { category: 'Palavras-chave', icon: '🔍', priority: 'high', description: 'Converter para correspondência ampla' },
  'KEYWORD_MATCH_TYPE': { category: 'Palavras-chave', icon: '🔄', priority: 'medium', description: 'Alterar tipo de correspondência' },
  'RESPONSIVE_SEARCH_AD_IMPROVE_AD_STRENGTH': { category: 'Anúncios', icon: '💪', priority: 'high', description: 'Melhorar força do anúncio RSA' },
  'CAMPAIGN_BUDGET': { category: 'Orçamento', icon: '💰', priority: 'high', description: 'Otimizar orçamento da campanha' },
  'SET_TARGET_CPA': { category: 'Lances', icon: '🎯', priority: 'high', description: 'Definir CPA desejado' },
  'SET_TARGET_ROAS': { category: 'Lances', icon: '📈', priority: 'high', description: 'Definir ROAS desejado' },
  'IMPROVE_GOOGLE_TAG': { category: 'Rastreamento', icon: '🏷️', priority: 'medium', description: 'Melhorar tag do Google para rastreamento' },
  'LEAD_FORM_ASSET': { category: 'Extensões', icon: '📋', priority: 'high', description: 'Adicionar formulário de lead' },
};

const priorityConfig = {
  high: { label: 'Alta', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', order: 0 },
  medium: { label: 'Média', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', order: 1 },
  low: { label: 'Baixa', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', order: 2 },
};

export default function Recommendations() {
  const { data, isLoading, refetch } = trpc.googleAds.getRecommendations.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const applyMutation = trpc.googleAds.applyRecommendation.useMutation({
    onSuccess: (result, variables) => {
      if (result.success) {
        toast.success('Recomendação aplicada com sucesso!');
        setAppliedIds(prev => new Set([...prev, applyingId ?? '']));
        refetch();
      } else {
        toast.error(`Erro: ${result.error}`);
      }
      setApplyingId(null);
    },
    onError: (error) => {
      toast.error(`Erro ao aplicar: ${error.message}`);
      setApplyingId(null);
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyResourceName = (resourceName: string, id: string) => {
    navigator.clipboard.writeText(resourceName);
    setCopiedId(id);
    toast.success('Resource name copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const recommendations = data?.recommendations ?? [];
  const summary = data?.summary ?? [];

  // Enriquecer com categoria e prioridade
  const enriched = recommendations.map((rec: any, idx: number) => {
    const meta = categoryMap[rec.type] ?? { category: 'Outros', icon: '📌', priority: 'low' as const, description: rec.label };
    return { ...rec, ...meta, id: `${rec.type}-${idx}` };
  });

  // Filtrar
  const filtered = enriched.filter((rec: any) => {
    if (categoryFilter !== 'all' && rec.category !== categoryFilter) return false;
    if (priorityFilter !== 'all' && rec.priority !== priorityFilter) return false;
    return true;
  });

  // Ordenar por prioridade
  filtered.sort((a: any, b: any) => priorityConfig[a.priority as keyof typeof priorityConfig].order - priorityConfig[b.priority as keyof typeof priorityConfig].order);

  // Categorias únicas
  const categories: string[] = [...new Set<string>(enriched.map((r: any) => r.category as string))].sort();

  // Stats
  const highCount = enriched.filter((r: any) => r.priority === 'high').length;
  const mediumCount = enriched.filter((r: any) => r.priority === 'medium').length;
  const lowCount = enriched.filter((r: any) => r.priority === 'low').length;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Lightbulb className="w-8 h-8 text-yellow-500" />
              Recomendações do Google
            </h1>
            <p className="text-muted-foreground mt-1">
              Recomendações oficiais da API do Google Ads para otimizar suas campanhas
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data?.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{highCount}</p>
                  <p className="text-xs text-muted-foreground">Alta Prioridade</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Target className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{mediumCount}</p>
                  <p className="text-xs text-muted-foreground">Média Prioridade</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{lowCount}</p>
                  <p className="text-xs text-muted-foreground">Baixa Prioridade</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary by Type */}
        {summary.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumo por Tipo</CardTitle>
              <CardDescription>Quantidade de recomendações agrupadas por tipo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {summary.map((s: any) => {
                  const meta = categoryMap[s.type];
                  return (
                    <div key={s.type} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
                      <span className="text-lg">{meta?.icon ?? '📌'}</span>
                      <span className="text-sm font-medium">{s.label}</span>
                      <Badge variant="secondary" className="text-xs">{s.count}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtros:</span>
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-background"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((c: string) => (
              <option key={String(c)} value={String(c)}>{String(c)}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-background"
          >
            <option value="all">Todas as prioridades</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} de {enriched.length} recomendações
          </span>
        </div>

        {/* Recommendations List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Carregando recomendações...</span>
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <h3 className="text-lg font-semibold">Nenhuma recomendação encontrada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {enriched.length === 0
                  ? 'Sua conta está otimizada! O Google não tem sugestões no momento.'
                  : 'Nenhuma recomendação corresponde aos filtros selecionados.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((rec: any) => {
              const isExpanded = expandedItems.has(rec.id);
              const pConfig = priorityConfig[rec.priority as keyof typeof priorityConfig];
              return (
                <Card key={rec.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <span className="text-2xl mt-0.5">{rec.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{rec.label}</h3>
                          <Badge className={`text-xs ${pConfig.color}`}>{pConfig.label}</Badge>
                          <Badge variant="outline" className="text-xs">{rec.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                        {isExpanded && (
                          <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">Campanha:</span>
                              <code className="bg-background px-2 py-0.5 rounded text-xs">{rec.campaign || 'Nível de conta'}</code>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">Resource Name:</span>
                              <code className="bg-background px-2 py-0.5 rounded text-xs truncate max-w-[400px]">{rec.resourceName}</code>
                              <button
                                onClick={() => copyResourceName(rec.resourceName, rec.id)}
                                className="p-1 hover:bg-background rounded"
                              >
                                {copiedId === rec.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                              </button>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">Tipo API:</span>
                              <code className="bg-background px-2 py-0.5 rounded text-xs">{rec.type}</code>
                            </div>
                            <div className="mt-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                              <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                Clique em "Aplicar" para aceitar esta recomendação diretamente via API do Google Ads. A ação é irreversível.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(rec.id)}
                          className="gap-1"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {isExpanded ? 'Menos' : 'Detalhes'}
                        </Button>
                        {appliedIds.has(rec.id) ? (
                          <Button variant="outline" size="sm" disabled className="gap-1 text-green-600">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Aplicado
                          </Button>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="default"
                                size="sm"
                                disabled={applyingId === rec.id}
                                className="gap-1"
                              >
                                {applyingId === rec.id ? (
                                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Aplicando...</>
                                ) : (
                                  <><Zap className="w-3.5 h-3.5" /> Aplicar</>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Aplicar recomendação?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <strong>{rec.label}</strong><br />
                                  {rec.description}<br /><br />
                                  Esta ação será aplicada diretamente na sua conta Google Ads via API. Deseja continuar?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    setApplyingId(rec.id);
                                    applyMutation.mutate({ resourceName: rec.resourceName });
                                  }}
                                >
                                  Confirmar e Aplicar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer Info */}
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Como usar:</strong> As recomendações são geradas automaticamente pelo Google Ads com base no desempenho da sua conta.
                  Clique em "Aplicar" para abrir o painel do Google Ads onde você pode revisar e aplicar cada sugestão.
                </p>
                <p>
                  <strong>Prioridade Alta:</strong> Recomendações que podem impactar significativamente o desempenho (palavras-chave, lances, orçamento).
                  Aplique primeiro as de alta prioridade para maximizar resultados.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
