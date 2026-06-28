/**
 * Página: Log para Diretoria
 * Exibe todas as ações de otimização realizadas pelo sistema automatizado
 * com status, diagnósticos e evidências de performance
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Bot,
  RefreshCw,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar,
  BarChart3,
  Zap,
  Shield,
  Search,
  MapPin,
  Activity,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type ActionStatus = "executed" | "pending_approval" | "rejected" | "failed";
type ActionType =
  | "auto_negative"
  | "rsa_suggestion"
  | "daily_gb_diagnosis"
  | "competitive_intelligence"
  | "anomaly_alert"
  | "search_terms_alert"
  | "weekly_report"
  | string;

interface OptimizationAction {
  id: number;
  actionType: ActionType;
  campaignName: string | null;
  reason: string | null;
  status: ActionStatus | null;
  performanceData: string | null;
  createdAt: Date | string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusConfig: Record<ActionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  executed: {
    label: "Executado",
    color: "bg-green-500/10 text-green-400 border-green-500/20",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  pending_approval: {
    label: "Aguardando Aprovação",
    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    icon: <Clock className="h-3 w-3" />,
  },
  rejected: {
    label: "Rejeitado",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: <XCircle className="h-3 w-3" />,
  },
  failed: {
    label: "Falhou",
    color: "bg-gray-500/10 text-muted-foreground border-gray-500/20",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

const actionTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  auto_negative: {
    label: "Negativação Automática",
    icon: <Shield className="h-4 w-4" />,
    color: "text-red-400",
  },
  rsa_suggestion: {
    label: "Sugestão de RSA",
    icon: <Zap className="h-4 w-4" />,
    color: "text-blue-400",
  },
  daily_gb_diagnosis: {
    label: "Diagnóstico GB Zênite",
    icon: <MapPin className="h-4 w-4" />,
    color: "text-purple-400",
  },
  competitive_intelligence: {
    label: "Inteligência Competitiva",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "text-orange-400",
  },
  anomaly_alert: {
    label: "Alerta de Anomalia",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-yellow-400",
  },
  search_terms_alert: {
    label: "Alerta de Termos",
    icon: <Search className="h-4 w-4" />,
    color: "text-cyan-400",
  },
  weekly_report: {
    label: "Relatório Semanal",
    icon: <BarChart3 className="h-4 w-4" />,
    color: "text-green-400",
  },
};

function getActionConfig(type: string) {
  return actionTypeConfig[type] ?? {
    label: type.replace(/_/g, " "),
    icon: <Activity className="h-4 w-4" />,
    color: "text-muted-foreground",
  };
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parsePerformanceData(raw: string | null): Record<string, any> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Componente de card de ação ───────────────────────────────────────────────
function ActionCard({ action }: { action: OptimizationAction }) {
  const [expanded, setExpanded] = useState(false);
  const status = (action.status ?? "executed") as ActionStatus;
  const statusCfg = statusConfig[status] ?? statusConfig.executed;
  const actionCfg = getActionConfig(action.actionType);
  const perfData = parsePerformanceData(action.performanceData);

  return (
    <div className="border border-border rounded-lg bg-card/50 hover:bg-card transition-colors">
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Ícone do tipo */}
        <div className={`mt-0.5 shrink-0 ${actionCfg.color}`}>
          {actionCfg.icon}
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {actionCfg.label}
            </span>
            {action.campaignName && (
              <span className="text-xs text-muted-foreground">
                — {action.campaignName}
              </span>
            )}
          </div>
          {action.reason && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {action.reason}
            </p>
          )}
          <p className="text-xs text-muted-foreground/60 mt-1">
            {formatDate(action.createdAt)}
          </p>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className={`text-xs flex items-center gap-1 ${statusCfg.color}`}
          >
            {statusCfg.icon}
            {statusCfg.label}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Detalhes expandidos */}
      {expanded && perfData && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {/* Métricas se disponíveis */}
          {perfData.metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              {perfData.metrics.impressions !== undefined && (
                <div className="bg-background rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">Impressões</p>
                  <p className="text-sm font-semibold">{Number(perfData.metrics.impressions).toLocaleString("pt-BR")}</p>
                </div>
              )}
              {perfData.metrics.clicks !== undefined && (
                <div className="bg-background rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">Cliques</p>
                  <p className="text-sm font-semibold">{perfData.metrics.clicks}</p>
                </div>
              )}
              {perfData.metrics.ctr !== undefined && (
                <div className="bg-background rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">CTR</p>
                  <p className="text-sm font-semibold">{perfData.metrics.ctr}%</p>
                </div>
              )}
              {perfData.metrics.cost !== undefined && (
                <div className="bg-background rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">Custo</p>
                  <p className="text-sm font-semibold">R$ {perfData.metrics.cost}</p>
                </div>
              )}
            </div>
          )}

          {/* Diagnóstico de IA */}
          {perfData.diagnosis && (
            <div className="bg-background rounded p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Bot className="h-3 w-3" />
                Análise da IA
              </p>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {perfData.diagnosis}
              </p>
            </div>
          )}

          {/* Status da campanha */}
          {perfData.status && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status da campanha:</span>
              <Badge
                variant="outline"
                className={
                  perfData.status === "CRÍTICO" ? "text-red-400 border-red-500/20" :
                  perfData.status === "ATENÇÃO" ? "text-yellow-400 border-yellow-500/20" :
                  perfData.status === "BOM" ? "text-blue-400 border-blue-500/20" :
                  "text-green-400 border-green-500/20"
                }
              >
                {perfData.status}
              </Badge>
            </div>
          )}

          {/* Dados brutos para termos negativados */}
          {perfData.term && (
            <div className="bg-background rounded p-3 mt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Termo negativado</p>
              <code className="text-xs text-red-400">"{perfData.term}"</code>
              {perfData.reason && (
                <p className="text-xs text-muted-foreground mt-1">Motivo: {perfData.reason}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function DirectorshipLog() {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data, isLoading, refetch } = trpc.gbZenite.getOptimizationLog.useQuery({
    limit: PAGE_SIZE * (page + 1),
  });

  const actions: OptimizationAction[] = (data?.actions ?? []) as OptimizationAction[];

  // Filtrar
  const filtered = actions.filter((a) => {
    if (filterType !== "all" && a.actionType !== filterType) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  });

  // Estatísticas
  const stats = {
    total: actions.length,
    executed: actions.filter((a) => a.status === "executed").length,
    pending: actions.filter((a) => a.status === "pending_approval").length,
    failed: actions.filter((a) => a.status === "failed").length,
  };

  // Tipos únicos presentes
  const uniqueTypes = Array.from(new Set(actions.map((a) => a.actionType)));

  // Exportar CSV
  const exportCSV = () => {
    const rows = filtered.map((a) => [
      formatDate(a.createdAt),
      getActionConfig(a.actionType).label,
      a.campaignName ?? "",
      a.reason ?? "",
      a.status ?? "",
    ]);
    const csv = [
      ["Data", "Tipo", "Campanha", "Motivo", "Status"].join(","),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `log-acoes-zenite-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Log de Ações — Diretoria
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registro completo de todas as otimizações automáticas realizadas pelo sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              className="gap-1"
            >
              <Download className="h-3 w-3" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-card/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Total de Ações</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{stats.executed}</p>
              <p className="text-xs text-muted-foreground mt-1">Executadas</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
              <p className="text-xs text-muted-foreground mt-1">Aguardando</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
              <p className="text-xs text-muted-foreground mt-1">Com Falha</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterType === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("all")}
                  className="h-7 text-xs"
                >
                  Todos os tipos
                </Button>
                {uniqueTypes.map((type) => {
                  const cfg = getActionConfig(type);
                  return (
                    <Button
                      key={type}
                      variant={filterType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterType(type)}
                      className="h-7 text-xs gap-1"
                    >
                      <span className={cfg.color}>{cfg.icon}</span>
                      {cfg.label}
                    </Button>
                  );
                })}
              </div>
              <div className="flex gap-2 ml-auto">
                {(["all", "executed", "pending_approval", "rejected", "failed"] as const).map((s) => (
                  <Button
                    key={s}
                    variant={filterStatus === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus(s)}
                    className="h-7 text-xs"
                  >
                    {s === "all" ? "Todos" : statusConfig[s as ActionStatus]?.label ?? s}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de ações */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma ação registrada ainda.</p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                As automações começarão a registrar ações em breve.
              </p>
            </div>
          ) : (
            filtered.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))
          )}
        </div>

        {/* Paginação */}
        {filtered.length >= PAGE_SIZE && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Carregar mais ações
            </Button>
          </div>
        )}

        {/* Rodapé informativo */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Para a Diretoria:</strong> Este log registra automaticamente todas as ações de otimização realizadas pelo sistema de gestão de tráfego pago da Zênite Tech. Cada entrada inclui o tipo de ação, campanha afetada, motivo técnico e resultado. As ações com status "Aguardando Aprovação" requerem revisão antes de serem aplicadas na conta Google Ads.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
