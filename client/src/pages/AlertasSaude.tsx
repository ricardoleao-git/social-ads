import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ShieldAlert, RefreshCw, AlertCircle, AlertTriangle, Info,
  CheckCircle2, Activity, Gauge, Globe, Zap, Clock, BellOff
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

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

// Tipos de alertas relacionados à saúde do site
const SITE_HEALTH_TYPES = ["pagespeed", "sitemap_ping", "site_health", "anomaly", "token_expiry"];

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes}min`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${days}d`;
}

export default function AlertasSaude() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);

  const { data, isLoading, refetch } = trpc.alertHistory.list.useQuery({
    limit: 100,
    offset: 0,
    severity: severityFilter !== "all" ? severityFilter : undefined,
    onlyUnread: showOnlyUnread || undefined,
  });

  const acknowledge = trpc.alertHistory.acknowledge.useMutation({
    onSuccess: () => { refetch(); toast.success("Alerta reconhecido."); }
  });

  const acknowledgeAll = trpc.alertHistory.acknowledgeAll.useMutation({
    onSuccess: () => { refetch(); toast.success("Todos os alertas foram reconhecidos."); }
  });

  // Filtrar por tipo de saúde do site
  const allAlerts = data?.alerts ?? [];
  const siteAlerts = typeFilter === "all"
    ? allAlerts
    : allAlerts.filter(a => a.type === typeFilter);

  const unreadCount = siteAlerts.filter(a => !a.acknowledged).length;
  const criticalCount = siteAlerts.filter(a => a.severity === "critical" && !a.acknowledged).length;
  const warningCount = siteAlerts.filter(a => a.severity === "warning" && !a.acknowledged).length;

  const typeOptions = [
    { value: "all", label: "Todos os tipos" },
    { value: "pagespeed", label: "PageSpeed" },
    { value: "sitemap_ping", label: "Sitemap Ping" },
    { value: "anomaly", label: "Anomalia" },
    { value: "token_expiry", label: "Token OAuth" },
    { value: "site_health", label: "Saúde do Site" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-orange-500" />
              Alertas de Saúde do Site
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Histórico de alertas de PageSpeed, sitemap, anomalias e tokens OAuth
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => acknowledgeAll.mutate()}
                disabled={acknowledgeAll.isPending}
              >
                <BellOff className="w-4 h-4" />
                Reconhecer Todos ({unreadCount})
              </Button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold mt-1">{siteAlerts.length}</p>
              <p className="text-xs text-muted-foreground">alertas no período</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Críticos</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-red-500">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">não reconhecidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Atenção</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-amber-500">{warningCount}</p>
              <p className="text-xs text-muted-foreground">não reconhecidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Reconhecidos</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-green-500">
                {siteAlerts.filter(a => a.acknowledged).length}
              </p>
              <p className="text-xs text-muted-foreground">resolvidos</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Gauge className="w-4 h-4" />
            <span>Severidade:</span>
          </div>
          {["all", "critical", "warning", "info"].map(s => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
                severityFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "Todos" : s === "critical" ? "Crítico" : s === "warning" ? "Atenção" : "Info"}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Globe className="w-4 h-4" />
            <span>Tipo:</span>
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
          >
            {typeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowOnlyUnread(!showOnlyUnread)}
            className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
              showOnlyUnread
                ? "bg-orange-100 text-orange-800 border-orange-200"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Apenas não lidos
          </button>
        </div>

        {/* Lista de alertas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Linha do Tempo — {siteAlerts.length} alerta(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-30 animate-pulse" />
                <p>Carregando alertas...</p>
              </div>
            ) : siteAlerts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum alerta encontrado</p>
                <p className="text-xs mt-1">
                  Os alertas de PageSpeed e sitemap ping aparecerão aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {siteAlerts.map(alert => {
                  const sev = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
                  const SevIcon = sev.icon;
                  const createdAt = new Date(alert.createdAt);
                  return (
                    <div
                      key={alert.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${sev.borderClass} bg-muted/30 ${
                        alert.acknowledged ? "opacity-60" : ""
                      }`}
                    >
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${sev.dotClass}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{alert.title}</span>
                            <Badge className={`text-xs border ${sev.badgeClass}`}>
                              {sev.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {alert.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(createdAt)}
                            </span>
                            {!alert.acknowledged && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => acknowledge.mutate({ id: alert.id })}
                                disabled={acknowledge.isPending}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {alert.message && (
                          <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                        )}
                        {alert.acknowledged && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Reconhecido em {new Date(alert.acknowledgedAt!).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legenda dos tipos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Info className="w-4 h-4" />
              Sobre os Alertas de Saúde
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <Gauge className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">PageSpeed</p>
                  <p className="text-xs text-muted-foreground">Alertas quando o score mobile ou desktop cai abaixo de 50. Job roda a cada 1h.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Globe className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Sitemap Ping</p>
                  <p className="text-xs text-muted-foreground">Falhas no ping diário para Google e Bing. Job roda todo dia às 7h.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Anomalia</p>
                  <p className="text-xs text-muted-foreground">Quedas bruscas de CTR, CPC acima do normal ou conversões zeradas. Job a cada 4h.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Activity className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Token OAuth</p>
                  <p className="text-xs text-muted-foreground">Alertas quando o token do Google Ads está próximo de expirar (menos de 7 dias).</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
