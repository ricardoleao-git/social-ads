import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  RefreshCw,
  Bell,
  BellOff,
  Filter,
  Clock,
  Zap,
  TrendingDown,
  Key,
  Pause,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

const SEVERITY_CONFIG = {
  critical: {
    label: "Crítico",
    icon: AlertCircle,
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    dotClass: "bg-red-500",
    borderClass: "border-l-red-500",
  },
  warning: {
    label: "Atenção",
    icon: AlertTriangle,
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
    borderClass: "border-l-amber-500",
  },
  info: {
    label: "Info",
    icon: Info,
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    dotClass: "bg-blue-500",
    borderClass: "border-l-blue-500",
  },
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  anomaly: { label: "Anomalia", icon: Activity },
  auto_pause: { label: "Pausa Automática", icon: Pause },
  auto_pause_check: { label: "Verificação de Pausa", icon: TrendingDown },
  token_expiry: { label: "Token Expirado", icon: Key },
  ctr_drop: { label: "Queda de CTR", icon: TrendingDown },
  budget: { label: "Orçamento", icon: Zap },
  instagram: { label: "Instagram", icon: Activity },
  default: { label: "Alerta", icon: Bell },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.default;
}

function formatRelativeTime(date: Date) {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  if (hours < 24) return `há ${hours}h`;
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AlertHistory() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.alertHistory.list.useQuery({
    limit: 100,
    offset: 0,
    severity: severityFilter !== "all" ? severityFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    onlyUnread: onlyUnread || undefined,
  });

  const { data: unreadData } = trpc.alertHistory.unreadCount.useQuery();

  const acknowledgeMutation = trpc.alertHistory.acknowledge.useMutation({
    onSuccess: () => {
      utils.alertHistory.list.invalidate();
      utils.alertHistory.unreadCount.invalidate();
    },
  });

  const acknowledgeAllMutation = trpc.alertHistory.acknowledgeAll.useMutation({
    onSuccess: () => {
      utils.alertHistory.list.invalidate();
      utils.alertHistory.unreadCount.invalidate();
      toast.success("Todos os alertas marcados como lidos.");
    },
  });

  const alerts = data?.alerts || [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            Histórico de Alertas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Linha do tempo de todos os alertas do sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(unreadData?.total || 0) > 0 && (
            <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
              {unreadData?.total} não lido(s)
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </Button>
          {(unreadData?.total || 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => acknowledgeAllMutation.mutate()}
              disabled={acknowledgeAllMutation.isPending}
              className="flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Marcar todos como lidos
            </Button>
          )}
        </div>
      </div>

      {/* Resumo por severidade */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium">Críticos</p>
                <p className="text-2xl font-bold text-red-700">{unreadData?.critical || 0}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Atenção</p>
                <p className="text-2xl font-bold text-amber-700">{unreadData?.warning || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Informativos</p>
                <p className="text-2xl font-bold text-blue-700">{unreadData?.info || 0}</p>
              </div>
              <Info className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="warning">Atenção</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="anomaly">Anomalia</SelectItem>
                <SelectItem value="auto_pause">Pausa Automática</SelectItem>
                <SelectItem value="auto_pause_check">Verificação de Pausa</SelectItem>
                <SelectItem value="token_expiry">Token Expirado</SelectItem>
                <SelectItem value="ctr_drop">Queda de CTR</SelectItem>
                <SelectItem value="budget">Orçamento</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => setOnlyUnread(!onlyUnread)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                onlyUnread
                  ? "bg-blue-600 text-foreground border-blue-600"
                  : "bg-white text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {onlyUnread ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              {onlyUnread ? "Não lidos" : "Todos"}
            </button>
            <span className="text-xs text-muted-foreground ml-auto">
              {alerts.length} alerta(s)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Linha do tempo */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Carregando alertas...
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mb-3 text-green-400" />
          <p className="text-base font-medium">Nenhum alerta encontrado</p>
          <p className="text-sm mt-1">
            {onlyUnread ? "Todos os alertas foram lidos." : "O sistema está operando normalmente."}
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Linha vertical da timeline */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-3">
            {alerts.map((alert, idx) => {
              const sev = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.info;
              const typeConf = getTypeConfig(alert.type);
              const TypeIcon = typeConf.icon;
              const SevIcon = sev.icon;

              return (
                <div key={alert.id} className="relative flex gap-4 pl-12">
                  {/* Dot na timeline */}
                  <div
                    className={`absolute left-3.5 top-4 w-3 h-3 rounded-full border-2 border-background ${sev.dotClass} ${alert.acknowledged ? "opacity-40" : ""}`}
                  />

                  <Card
                    className={`flex-1 border-l-4 ${sev.borderClass} ${alert.acknowledged ? "opacity-60" : ""}`}
                  >
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge className={`text-xs ${sev.badgeClass}`}>
                              <SevIcon className="w-3 h-3 mr-1" />
                              {sev.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <TypeIcon className="w-3 h-3 mr-1" />
                              {typeConf.label}
                            </Badge>
                            {alert.acknowledged && (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Lido
                              </Badge>
                            )}
                          </div>
                          <p className="font-semibold text-sm text-foreground">{alert.title}</p>
                          {alert.message && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {alert.message}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span title={formatDateTime(alert.createdAt)}>
                              {formatRelativeTime(alert.createdAt)}
                            </span>
                            <span className="text-border">·</span>
                            <span>{formatDateTime(alert.createdAt)}</span>
                          </div>
                        </div>
                        {!alert.acknowledged && (
                          <button
                            onClick={() => acknowledgeMutation.mutate({ id: alert.id })}
                            disabled={acknowledgeMutation.isPending}
                            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                            title="Marcar como lido"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Lido
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
