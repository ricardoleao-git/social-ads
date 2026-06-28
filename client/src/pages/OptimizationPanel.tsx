/**
 * Painel de Otimizações Automáticas
 * Exibe histórico de ações do sistema, candidatos a negativar,
 * inteligência competitiva e sugestões de novas palavras-chave.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Shield,
  TrendingUp,
  Lightbulb,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  BarChart2,
  Search,
  Building2,
  ChevronRight,
  Zap,
  Target,
  Download,
  Bell,
  DollarSign,
} from "lucide-react";
import { NEGATIVE_REASON_LABELS } from "@shared/negativeReasons";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    applied: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    pending_approval: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    skipped: "bg-gray-100 text-gray-600 dark:bg-muted dark:text-muted-foreground",
    auto_applied: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    manually_applied: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    dismissed: "bg-gray-100 text-muted-foreground dark:bg-muted dark:text-muted-foreground",
    approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    low: "bg-gray-100 text-gray-600 dark:bg-muted dark:text-muted-foreground",
  };
  const labels: Record<string, string> = {
    applied: "Aplicado", pending_approval: "Aguardando", rejected: "Rejeitado",
    skipped: "Ignorado", auto_applied: "Auto-aplicado", manually_applied: "Manual",
    pending_review: "Pendente", dismissed: "Descartado", approved: "Aprovado",
    high: "Alta", medium: "Média", low: "Baixa",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function ActionTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    auto_negative: { label: "Auto-negativo", icon: <Shield className="w-3 h-3" />, color: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400" },
    competitive_alert: { label: "Concorrência", icon: <BarChart2 className="w-3 h-3" />, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400" },
    keyword_suggestion: { label: "Sugestão KW", icon: <Lightbulb className="w-3 h-3" />, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400" },
    budget_alert: { label: "Orçamento", icon: <AlertTriangle className="w-3 h-3" />, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400" },
    audit_cleanup: { label: "Auditoria", icon: <Zap className="w-3 h-3" />, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400" },
  };
  const info = map[type] ?? { label: type, icon: <Bot className="w-3 h-3" />, color: "text-gray-600 bg-gray-50" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${info.color}`}>
      {info.icon}
      {info.label}
    </span>
  );
}

// ─── Aba: Ações Automáticas ────────────────────────────────────────────────────

function ActionsTab() {
  const [actionType, setActionType] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const { data, isLoading, refetch, isFetching } = trpc.googleAds.getOptimizationActions.useQuery({
    limit: 100,
    actionType: actionType || undefined,
    status: status || undefined,
  }, { refetchOnWindowFocus: false });

  const actions = data?.actions ?? [];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none"
        >
          <option value="">Todos os tipos</option>
          <option value="auto_negative">Auto-negativo</option>
          <option value="competitive_alert">Concorrência</option>
          <option value="keyword_suggestion">Sugestão KW</option>
          <option value="audit_cleanup">Auditoria</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none"
        >
          <option value="">Todos os status</option>
          <option value="applied">Aplicado</option>
          <option value="pending_approval">Aguardando</option>
          <option value="rejected">Rejeitado</option>
          <option value="skipped">Ignorado</option>
        </select>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
        <span className="text-sm text-muted-foreground ml-auto">{actions.length} ação{actions.length !== 1 ? "ões" : ""}</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Carregando histórico...</span>
            </div>
          ) : actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bot className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">Nenhuma ação registrada ainda</p>
              <p className="text-sm mt-1">O sistema automático registrará ações aqui a cada hora</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Palavra-chave</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campanha</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Motivo</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Economia Est.</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => {
                    const reasonKey = action.reason?.split(" | ")[0] ?? "";
                    const reasonLabel = NEGATIVE_REASON_LABELS[reasonKey] ?? action.reason?.split(" | ")[1] ?? action.reason ?? "—";
                    return (
                      <tr key={action.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3">
                          <ActionTypeBadge type={action.actionType} />
                        </td>
                        <td className="px-4 py-3 font-mono text-red-600 dark:text-red-400 text-xs">
                          {action.keyword ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                          {action.campaignName ?? "—"}
                          {action.adGroupName && <div className="text-purple-500">{action.adGroupName}</div>}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 rounded text-xs truncate max-w-full" title={reasonLabel}>
                            {reasonLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-green-600 dark:text-green-400 font-medium">
                          {action.estimatedSavings ? `R$ ${Number(action.estimatedSavings).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={action.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(action.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Aba: Candidatos a Negativar ───────────────────────────────────────────────

function CandidatesTab() {
  const [status, setStatus] = useState<string>("pending_review");

  const { data, isLoading, refetch, isFetching } = trpc.googleAds.getSearchTermCandidates.useQuery({
    status: status || undefined,
    limit: 100,
  }, { refetchOnWindowFocus: false });

  const candidates = data?.candidates ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none"
        >
          <option value="">Todos</option>
          <option value="pending_review">Pendentes</option>
          <option value="auto_applied">Auto-aplicados</option>
          <option value="manually_applied">Aplicados manualmente</option>
          <option value="dismissed">Descartados</option>
        </select>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
        <span className="text-sm text-muted-foreground ml-auto">{candidates.length} candidato{candidates.length !== 1 ? "s" : ""}</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Carregando candidatos...</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">Nenhum candidato encontrado</p>
              <p className="text-sm mt-1">O sistema detectará termos suspeitos a cada hora</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Termo</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Grupo</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliques</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Gasto</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Conv.</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Confiança</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Motivo</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Detectado</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-red-600 dark:text-red-400 text-xs">{c.term}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">{c.adGroupName ?? "—"}</td>
                      <td className="px-4 py-3 text-xs font-medium">{c.clicks ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-orange-600 dark:text-orange-400 font-medium">
                        R$ {Number(c.spend ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs">{Number(c.conversions ?? 0).toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${(c.confidence ?? 0) >= 80 ? "bg-green-500" : (c.confidence ?? 0) >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                              style={{ width: `${c.confidence ?? 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{c.confidence ?? 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 rounded text-xs truncate max-w-full" title={c.reason ?? ""}>
                          {NEGATIVE_REASON_LABELS[c.intentCategory ?? ""] ?? c.intentCategory ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.detectedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Aba: Inteligência Competitiva ─────────────────────────────────────────────

function CompetitiveTab() {
  const { data, isLoading, refetch, isFetching } = trpc.googleAds.getCompetitiveInsights.useQuery(
    { limit: 50 },
    { refetchOnWindowFocus: false }
  );

  const insights = data?.insights ?? [];

  // Agrupar por concorrente (pegar o mais recente de cada)
  const byCompetitor = new Map<string, typeof insights[0]>();
  for (const i of insights) {
    if (!byCompetitor.has(i.competitor)) byCompetitor.set(i.competitor, i);
  }
  const latest = Array.from(byCompetitor.values());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Dados coletados diariamente via Auction Insights. Mostra concorrentes que aparecem nos mesmos leilões.
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Carregando dados competitivos...</span>
        </div>
      ) : latest.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">Nenhum dado competitivo ainda</p>
            <p className="text-sm mt-1">O job diário coletará dados de Auction Insights todo dia às 7h</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {latest.map((insight) => (
            <Card key={insight.id} className="border border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  {insight.competitor}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Sobreposição</span>
                  <span className="font-medium text-orange-600">{Number(insight.overlapRate ?? 0).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Posição acima</span>
                  <span className="font-medium">{Number(insight.positionAboveRate ?? 0).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Imp. Share deles</span>
                  <span className="font-medium text-red-600">{Number(insight.impressionShare ?? 0).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Imp. Share nosso</span>
                  <span className="font-medium text-green-600">{Number(insight.ourImpressionShare ?? 0).toFixed(1)}%</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                  Coletado: {formatDate(insight.collectedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Aba: Sugestões de Palavras-chave ──────────────────────────────────────────

function SuggestionsTab() {
  const [status, setStatus] = useState<string>("pending_review");
  const utils = trpc.useUtils();

  const { data, isLoading, refetch, isFetching } = trpc.googleAds.getKeywordSuggestions.useQuery({
    status: status || undefined,
    limit: 100,
  }, { refetchOnWindowFocus: false });

  const approveMutation = trpc.googleAds.approveKeywordSuggestion.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message ?? "Palavra-chave adicionada!");
        utils.googleAds.getKeywordSuggestions.invalidate();
      } else {
        toast.error(result.error ?? "Erro ao aprovar");
      }
    },
  });

  const rejectMutation = trpc.googleAds.rejectKeywordSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Sugestão rejeitada");
      utils.googleAds.getKeywordSuggestions.invalidate();
    },
  });

  const suggestions = data?.suggestions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none"
        >
          <option value="">Todas</option>
          <option value="pending_review">Pendentes</option>
          <option value="approved">Aprovadas</option>
          <option value="rejected">Rejeitadas</option>
        </select>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
        <span className="text-sm text-muted-foreground ml-auto">{suggestions.length} sugestão{suggestions.length !== 1 ? "ões" : ""}</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Carregando sugestões...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Lightbulb className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">Nenhuma sugestão disponível</p>
              <p className="text-sm mt-1">O sistema identificará termos de alta performance para adicionar como palavras-chave</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Termo Sugerido</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Grupo Sugerido</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">CTR Obs.</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Conv.</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Gasto</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Prioridade</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Target className="w-3 h-3 text-green-500 flex-shrink-0" />
                          <span className="font-mono text-green-700 dark:text-green-400 text-xs font-medium">{s.term}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate" title={s.reason ?? ""}>{s.reason ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                        {s.suggestedAdGroup ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-blue-600 dark:text-blue-400">
                        {Number(s.observedCtr ?? 0).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">
                        {Number(s.observedConversions ?? 0).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-xs text-orange-600 dark:text-orange-400">
                        R$ {Number(s.observedSpend ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3">
                        {s.status === "pending_review" && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                const adGroupId = prompt("ID do grupo de anúncios para adicionar a palavra-chave:");
                                if (adGroupId) approveMutation.mutate({ id: s.id, adGroupId });
                              }}
                              disabled={approveMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-foreground rounded text-xs hover:bg-green-700"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Aprovar
                            </button>
                            <button
                              onClick={() => rejectMutation.mutate({ id: s.id })}
                              disabled={rejectMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-xs hover:bg-red-200"
                            >
                              <XCircle className="w-3 h-3" />
                              Rejeitar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Gráfico de Evolução de Custos ────────────────────────────────────────────

function CostEvolutionChart() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = trpc.googleAds.getDailyCostEvolution.useQuery({ days }, { refetchOnWindowFocus: false });
  const chartData = (data?.data ?? []).map(d => ({
    ...d,
    dateLabel: (() => { const p = (d.date ?? '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : d.date; })(),
  }));
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            Evolução Diária de Custos
          </CardTitle>
          <div className="flex items-center gap-2">
            {data && (
              <div className="text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground">R$ {data.totalCost.toFixed(2)}</span>
                <span className="mx-2">|</span>
                Média/dia: <span className="font-semibold text-foreground">R$ {data.avgDailyCost.toFixed(2)}</span>
              </div>
            )}
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="px-2 py-1 bg-secondary border border-border rounded text-xs focus:outline-none"
            >
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando dados da API...</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Sem dados de custo disponíveis
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cpcGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis yAxisId="cost" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={v => `R$${v}`} />
              <YAxis yAxisId="cpc" orientation="right" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={v => `R$${v}`} />
              <RechartsTooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [
                  `R$ ${value.toFixed(2)}`,
                  name === "cost" ? "Gasto" : name === "cpc" ? "CPC" : name,
                ]}
                labelFormatter={l => `Data: ${l}`}
              />
              <Area yAxisId="cost" type="monotone" dataKey="cost" stroke="#22c55e" fill="url(#costGrad)" strokeWidth={2} name="cost" />
              <Area yAxisId="cpc" type="monotone" dataKey="cpc" stroke="#3b82f6" fill="url(#cpcGrad)" strokeWidth={2} name="cpc" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OptimizationPanel() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("acoes");
  const [isExporting, setIsExporting] = useState(false);
  const [isAlertChecking, setIsAlertChecking] = useState(false);

  // Estatísticas rápidas
  const { data: actionsData } = trpc.googleAds.getOptimizationActions.useQuery({ limit: 200 }, { refetchOnWindowFocus: false });
  const { data: candidatesData } = trpc.googleAds.getSearchTermCandidates.useQuery({ status: "pending_review", limit: 200 }, { refetchOnWindowFocus: false });
  const { data: suggestionsData } = trpc.googleAds.getKeywordSuggestions.useQuery({ status: "pending_review", limit: 200 }, { refetchOnWindowFocus: false });
  const { data: competitiveData } = trpc.googleAds.getCompetitiveInsights.useQuery({ limit: 50 }, { refetchOnWindowFocus: false });
  const { data: csvData, refetch: refetchCSV } = trpc.googleAds.exportOptimizationActionsCSV.useQuery({ limit: 500 }, { enabled: false });
  const competitorAlertMutation = trpc.googleAds.checkNewCompetitorAlert.useMutation();

  const totalActions = actionsData?.total ?? 0;
  const pendingCandidates = candidatesData?.total ?? 0;
  const pendingSuggestions = suggestionsData?.total ?? 0;
  const competitors = competitiveData?.total ?? 0;

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const result = await refetchCSV();
      const csv = result.data?.csv;
      if (!csv) { toast.error("Nenhum dado para exportar"); return; }
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `otimizacoes-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`CSV exportado: ${result.data?.total ?? 0} ações`);
    } catch (e) {
      toast.error("Erro ao exportar CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCheckCompetitorAlert = async () => {
    setIsAlertChecking(true);
    try {
      const result = await competitorAlertMutation.mutateAsync({});
      if (result.alertSent) {
        toast.success(`Alerta enviado! ${result.competitors} concorrente(s) detectado(s) com mais de 3 aparições hoje.`);
      } else {
        toast.info(result.message ?? "Nenhum concorrente novo com alta frequência hoje.");
      }
    } catch (e) {
      toast.error("Erro ao verificar concorrentes");
    } finally {
      setIsAlertChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Dashboard</span>
          </button>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-500" />
            <h1 className="text-base sm:text-lg font-semibold">Painel de Otimizações Automáticas</h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={handleCheckCompetitorAlert}
            disabled={isAlertChecking}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-lg text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
            title="Verificar Concorrentes"
          >
            <Bell className={`w-3.5 h-3.5 ${isAlertChecking ? "animate-pulse" : ""}`} />
            <span className="hidden sm:inline">{isAlertChecking ? "Verificando..." : "Verificar Concorrentes"}</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary text-secondary-foreground border border-border rounded-lg text-xs font-medium hover:bg-secondary/80 transition-colors"
            title="Exportar CSV"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isExporting ? "Exportando..." : "Exportar CSV"}</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg text-xs font-medium">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="hidden sm:inline">Sistema ativo — executa a cada hora</span>
            <span className="sm:hidden">Ativo</span>
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-blue-500" />
                Ações Realizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActions}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Total histórico</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Candidatos Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${pendingCandidates > 0 ? "text-amber-600" : ""}`}>{pendingCandidates}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Aguardando revisão</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
                Sugestões de KW
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${pendingSuggestions > 0 ? "text-yellow-600" : ""}`}>{pendingSuggestions}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Para adicionar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                Concorrentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{competitors}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Monitorados</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Evolução de Custos */}
        <CostEvolutionChart />

        {/* Banner informativo */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Bot className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Sistema de Gestão Autônoma de Tráfego</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                <strong>A cada hora:</strong> analisa termos de pesquisa, detecta padrões ruins e aplica negativações automáticas com justificativa. &nbsp;
                <strong>Todo dia às 7h:</strong> coleta dados de Auction Insights e identifica novos concorrentes. &nbsp;
                <strong>Todo dia às 8h:</strong> sugere novas palavras-chave positivas com base em termos de alta performance.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 max-w-xl">
            <TabsTrigger value="acoes" className="flex items-center gap-1.5 text-xs">
              <Bot className="w-3.5 h-3.5" />
              Ações
              {totalActions > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs">{totalActions}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="candidatos" className="flex items-center gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5" />
              Candidatos
              {pendingCandidates > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded text-xs">{pendingCandidates}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="concorrencia" className="flex items-center gap-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5" />
              Concorrência
            </TabsTrigger>
            <TabsTrigger value="sugestoes" className="flex items-center gap-1.5 text-xs">
              <Lightbulb className="w-3.5 h-3.5" />
              Sugestões
              {pendingSuggestions > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded text-xs">{pendingSuggestions}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="acoes" className="mt-4">
            <ActionsTab />
          </TabsContent>
          <TabsContent value="candidatos" className="mt-4">
            <CandidatesTab />
          </TabsContent>
          <TabsContent value="concorrencia" className="mt-4">
            <CompetitiveTab />
          </TabsContent>
          <TabsContent value="sugestoes" className="mt-4">
            <SuggestionsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
