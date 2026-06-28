import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Activity,
  Zap,
  Instagram,
  BarChart3,
  Link2,
  Shield,
  Calendar,
  TrendingUp,
  Search,
  Bell,
} from "lucide-react";

const JOB_DEFINITIONS = [
  { key: "anomaly_alert", name: "Alerta de Anomalia", schedule: "A cada 4h", icon: AlertCircle, color: "text-orange-500" },
  { key: "instagram_sync", name: "Sync Instagram", schedule: "Diária 8h", icon: Instagram, color: "text-pink-500" },
  { key: "rsa_score", name: "Score RSA com IA", schedule: "Segunda 9h", icon: BarChart3, color: "text-blue-500" },
  { key: "integrated_report", name: "Relatório Integrado", schedule: "Domingo 19h", icon: TrendingUp, color: "text-purple-500" },
  { key: "bid_optimization", name: "Otimização de Lances", schedule: "Quarta 10h", icon: Zap, color: "text-yellow-500" },
  { key: "editorial_calendar", name: "Calendário Editorial", schedule: "Sexta 17h", icon: Calendar, color: "text-green-500" },
  { key: "competition_dashboard", name: "Dashboard Concorrência", schedule: "Terça 9h", icon: Search, color: "text-cyan-500" },
  { key: "auto_negative", name: "Detecção de Negativos", schedule: "Diária 8h", icon: Shield, color: "text-red-500" },

];

const INTEGRATION_DEFINITIONS = [
  { key: "google_ads", name: "Google Ads API", description: "Métricas de campanhas, RSA, leilão" },
  { key: "ga4", name: "Google Analytics 4", description: "Sessões, conversões, origem de tráfego" },
  { key: "instagram_mcp", name: "Instagram MCP", description: "Métricas de engajamento e posts" },
  { key: "instagram_internal", name: "Instagram (interno)", description: "Dados de Instagram incorporados no dashboard" },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "ok") return <Badge className="bg-green-500/15 text-green-600 border-green-500/30 gap-1"><CheckCircle2 className="w-3 h-3" />Ativo</Badge>;
  if (status === "warning") return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 gap-1"><AlertCircle className="w-3 h-3" />Atenção</Badge>;
  if (status === "error") return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 gap-1"><XCircle className="w-3 h-3" />Falha</Badge>;
  return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Aguardando</Badge>;
}

export default function SystemStatus() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = trpc.automations.getExecutionLogs.useQuery(
    { limit: 20 },
    { refetchInterval: 30000 }
  );

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    refetchLogs();
  };

  // Processar logs para status por job
  const jobStatuses: Record<string, { status: string; lastRun: string; lastError?: string }> = {};
  const logs = Array.isArray(logsData) ? logsData : [];
  for (const log of logs) {
    const key = log.automationName ?? "unknown";
    if (!jobStatuses[key]) {
      jobStatuses[key] = {
        status: log.status === "success" ? "ok" : log.status === "error" ? "error" : "warning",
        lastRun: log.createdAt ? new Date(log.createdAt).toLocaleString("pt-BR") : "—",
        lastError: log.status === "error" ? (log.errorMessage ?? "Erro desconhecido") : undefined,
      };
    }
  }

  const totalJobs = JOB_DEFINITIONS.length;
  const activeJobs = JOB_DEFINITIONS.filter(j => jobStatuses[j.key]?.status === "ok").length;
  const failedJobs = JOB_DEFINITIONS.filter(j => jobStatuses[j.key]?.status === "error").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Status do Sistema</h1>
            <p className="text-sm text-muted-foreground">
              Monitoramento em tempo real de jobs e integrações
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-green-500/30">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-green-500">{activeJobs}</div>
            <div className="text-sm text-muted-foreground">Jobs Ativos</div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-red-500">{failedJobs}</div>
            <div className="text-sm text-muted-foreground">Com Falha</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-muted-foreground">{totalJobs - activeJobs - failedJobs}</div>
            <div className="text-sm text-muted-foreground">Aguardando 1ª Execução</div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Agendados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4" /> Jobs Agendados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-center text-muted-foreground py-6">Carregando logs...</div>
          ) : (
            <div className="space-y-2">
              {JOB_DEFINITIONS.map((job) => {
                const status = jobStatuses[job.key];
                const Icon = job.icon;
                return (
                  <div key={job.key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                    <Icon className={`w-4 h-4 shrink-0 ${job.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{job.name}</span>
                        <span className="text-xs text-muted-foreground">({job.schedule})</span>
                      </div>
                      {status?.lastError && (
                        <p className="text-xs text-red-500 truncate mt-0.5">{status.lastError}</p>
                      )}
                      {status?.lastRun && !status?.lastError && (
                        <p className="text-xs text-muted-foreground mt-0.5">Última execução: {status.lastRun}</p>
                      )}
                    </div>
                    <StatusBadge status={status?.status ?? "pending"} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integrações Externas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="w-4 h-4" /> Integrações Externas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {INTEGRATION_DEFINITIONS.map((integration) => {
              const isRedes = integration.key === "redes_sociais";
              return (
                <div key={integration.key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground">{integration.name}</div>
                    <div className="text-xs text-muted-foreground">{integration.description}</div>
                    {isRedes && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                        ⚠ Servidor offline — aguardando republicação do projeto
                      </p>
                    )}
                  </div>
                  <StatusBadge status={isRedes ? "warning" : "ok"} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Últimos Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4" /> Últimas Execuções
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum log disponível ainda</p>
              <p className="text-xs mt-1">Os jobs começarão a registrar execuções nos horários agendados</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {logs.slice(0, 15).map((log: any, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded text-xs hover:bg-muted/40">
                  {log.status === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{log.automationType ?? log.jobName ?? "Job"}</span>
                    {log.details && <span className="text-muted-foreground ml-2 truncate">{log.details}</span>}
                  </div>
                  <span className="text-muted-foreground shrink-0">
                    {log.executedAt ? new Date(log.executedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
