import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Download,
  History,
  Activity,
  Mail,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

// ─── Mapa de automações conhecidas ────────────────────────────────────────────
const AUTOMATION_OPTIONS = [
  { value: "all", label: "Todas as automações" },
  { value: "daily_sync_data", label: "Sincronização Diária de Dados" },
  { value: "budgetExhaustionAlert", label: "Alerta de Orçamento Esgotado" },
  { value: "expensiveKeywordPause", label: "Pausa de Keywords Caras" },
  { value: "dailyPerformanceReport", label: "Relatório Diário de Performance" },
  { value: "weekly_url_monitor", label: "Monitor Semanal de URLs" },
  { value: "whatsappConversionSync", label: "Sync Conversão WhatsApp" },
  { value: "auctionInsights", label: "Inteligência Competitiva" },
  { value: "negativeKeywordSync", label: "Sync Negativos entre Campanhas" },
  { value: "qualityScoreAlert", label: "Alerta de Quality Score" },
  { value: "landingPageMonitor", label: "Monitor de Landing Pages" },
  { value: "conversionByChannelReport", label: "Relatório Conversões por Canal" },
  { value: "pausedGroupReactivation", label: "Reativação de Grupos Pausados" },
  { value: "leadScoring", label: "Score de Lead via IA" },
  { value: "daypartingOptimization", label: "Dayparting Automático" },
  { value: "competitorAlert", label: "Alerta de Concorrentes" },
  { value: "leadSheetsSync", label: "Sync Leads Google Sheets" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "success", label: "Sucesso" },
  { value: "error", label: "Erro" },
  { value: "warning", label: "Aviso" },
  { value: "running", label: "Em execução" },
];

const PAGE_SIZE = 25;

// ─── Helpers de UI ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    success: { label: "Sucesso", className: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
    error: { label: "Erro", className: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
    warning: { label: "Aviso", className: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
    running: { label: "Executando", className: "bg-blue-100 text-blue-800 border-blue-200", icon: RefreshCw },
  };
  const c = config[status] ?? config.warning;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`${c.className} flex items-center gap-1 text-xs`}>
      <Icon className={`w-3 h-3 ${status === "running" ? "animate-spin" : ""}`} />
      {c.label}
    </Badge>
  );
}

function DurationBadge({ ms }: { ms: number | null }) {
  if (!ms) return null;
  const label = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  const color = ms > 10000 ? "text-red-500" : ms > 5000 ? "text-amber-500" : "text-muted-foreground";
  return <span className={`text-xs font-mono ${color}`}>{label}</span>;
}

function TriggeredByBadge({ by }: { by: string | null }) {
  const map: Record<string, string> = {
    manual: "Manual",
    schedule: "Agendado",
    api: "API",
  };
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {map[by ?? "manual"] ?? by ?? "Manual"}
    </span>
  );
}

// ─── Linha de log expandível ──────────────────────────────────────────────────
function LogRow({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Cabeçalho da linha */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="mt-0.5 flex-shrink-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={log.status} />
            <span className="font-medium text-sm truncate">{log.automationLabel}</span>
            {log.emailSent && (
              <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Mail className="w-3 h-3" /> E-mail
              </span>
            )}
            <DurationBadge ms={log.durationMs} />
            <TriggeredByBadge by={log.triggeredBy} />
          </div>
          {log.summary && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.summary}</p>
          )}
          {log.errorMessage && (
            <p className="text-xs text-red-500 mt-1 line-clamp-1">{log.errorMessage}</p>
          )}
        </div>

        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(log.createdAt).toLocaleString("pt-BR", {
              day: "2-digit", month: "2-digit", year: "2-digit",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">{log.automationName}</p>
        </div>
      </button>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="border-t bg-muted/20 p-4 space-y-3">
          {log.summary && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Resumo</p>
              <p className="text-sm whitespace-pre-wrap">{log.summary}</p>
            </div>
          )}
          {log.errorMessage && (
            <div>
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Mensagem de Erro</p>
              <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono bg-red-50 dark:bg-red-950/30 p-2 rounded">{log.errorMessage}</p>
            </div>
          )}
          {log.details && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Dados Detalhados (JSON)</p>
              <pre className="text-xs font-mono bg-slate-100 dark:bg-slate-900 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <p className="text-xs text-muted-foreground">ID</p>
              <p className="text-sm font-mono">#{log.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duração</p>
              <p className="text-sm">{log.durationMs ? `${log.durationMs}ms` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Acionado por</p>
              <p className="text-sm capitalize">{log.triggeredBy ?? "manual"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">E-mail enviado</p>
              <p className="text-sm">{log.emailSent ? "Sim" : "Não"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SyncHistory() {
  const [automationFilter, setAutomationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  const { data, isLoading, refetch, isFetching } = trpc.automations.getExecutionLogs.useQuery({
    automationName: automationFilter !== "all" ? automationFilter : undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleExportCSV = () => {
    if (!logs.length) return;
    const headers = ["ID", "Automação", "Nome Interno", "Status", "Resumo", "Duração (ms)", "Acionado por", "E-mail enviado", "Data"];
    const rows = logs.map((l: any) => [
      l.id,
      l.automationLabel,
      l.automationName,
      l.status,
      (l.summary ?? "").replace(/\n/g, " | "),
      l.durationMs ?? "",
      l.triggeredBy ?? "manual",
      l.emailSent ? "Sim" : "Não",
      new Date(l.createdAt).toLocaleString("pt-BR"),
    ]);
    const csv = [headers, ...rows].map(r => r.map(String).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-sincronizacoes-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  };

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0); // Reset para primeira página ao filtrar
  };

  // Estatísticas rápidas dos logs carregados
  const stats = {
    success: logs.filter((l: any) => l.status === "success").length,
    error: logs.filter((l: any) => l.status === "error").length,
    warning: logs.filter((l: any) => l.status === "warning").length,
    avgDuration: logs.length > 0
      ? Math.round(logs.filter((l: any) => l.durationMs).reduce((acc: number, l: any) => acc + (l.durationMs ?? 0), 0) / logs.filter((l: any) => l.durationMs).length)
      : 0,
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            Histórico de Sincronizações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro completo de todas as execuções de automações e jobs de sincronização
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!logs.length}>
            <Download className="w-4 h-4 mr-1" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Cards de estatísticas rápidas */}
      {!isLoading && logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Sucesso (página atual)</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.success}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Erros (página atual)</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{stats.error}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Avisos (página atual)</p>
            <p className="text-2xl font-bold text-amber-500 mt-1">{stats.warning}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Duração média</p>
            <p className="text-2xl font-bold mt-1">{stats.avgDuration > 0 ? `${(stats.avgDuration / 1000).toFixed(1)}s` : "—"}</p>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
            {total > 0 && (
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                {total} registro{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Select value={automationFilter} onValueChange={handleFilterChange(setAutomationFilter)}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Filtrar por automação" />
              </SelectTrigger>
              <SelectContent>
                {AUTOMATION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(automationFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAutomationFilter("all");
                  setStatusFilter("all");
                  setPage(0);
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Execuções
            {totalPages > 1 && (
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : !logs.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhuma execução encontrada</p>
              <p className="text-xs mt-1">
                {automationFilter !== "all" || statusFilter !== "all"
                  ? "Tente ajustar os filtros acima."
                  : "Execute uma automação para ver o histórico aqui."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
              >
                ← Anterior
              </Button>
              <div className="flex items-center gap-2">
                {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                  const pageNum = totalPages <= 7 ? i : i === 0 ? 0 : i === 6 ? totalPages - 1 : page - 2 + i;
                  if (pageNum < 0 || pageNum >= totalPages) return null;
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setPage(pageNum)}
                      disabled={isFetching}
                    >
                      {pageNum + 1}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isFetching}
              >
                Próxima →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
