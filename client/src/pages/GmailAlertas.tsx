import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Mail, AlertTriangle, Info, CheckCircle2, RefreshCw,
  Clock, ArrowRightLeft, Loader2, Eye, EyeOff, Bell
} from "lucide-react";

// ─── Urgency Config ───────────────────────────────────────────────────────────
const URGENCY_CONFIG = {
  critical: {
    label: "Crítico",
    color: "bg-red-600 text-white",
    border: "border-red-500",
    bg: "bg-red-950/40",
    icon: AlertTriangle,
    pulse: true,
  },
  warning: {
    label: "Atenção",
    color: "bg-yellow-500 text-black",
    border: "border-yellow-500",
    bg: "bg-yellow-950/30",
    icon: AlertTriangle,
    pulse: true,
  },
  info: {
    label: "Info",
    color: "bg-blue-600 text-white",
    border: "border-blue-500",
    bg: "bg-blue-950/20",
    icon: Info,
    pulse: false,
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  billing: "Cobrança",
  policy: "Política",
  performance: "Performance",
  divergence: "Divergência",
  other: "Outro",
};

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({
  alert,
  onResolve,
  onDismiss,
}: {
  alert: any;
  onResolve: (alert: any) => void;
  onDismiss: (id: number) => void;
}) {
  const cfg = URGENCY_CONFIG[alert.urgency as keyof typeof URGENCY_CONFIG] ?? URGENCY_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div
      className={`relative rounded-xl border-2 p-4 transition-all ${cfg.border} ${cfg.bg} ${
        alert.isBlinking && !alert.isResolved ? "animate-pulse" : ""
      }`}
    >
      {/* Urgency badge + category */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${cfg.color} text-xs font-bold`}>
            <Icon className="w-3 h-3 mr-1" />
            {cfg.label}
          </Badge>
          <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
            {CATEGORY_LABELS[alert.category] ?? alert.category}
          </Badge>
          {alert.isBlinking && !alert.isResolved && (
            <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
              <Bell className="w-3 h-3" />
              Novo
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {new Date(alert.emailDate).toLocaleDateString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "2-digit",
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
      </div>

      {/* Subject */}
      <h3 className="text-sm font-semibold text-white mb-1 leading-tight">
        {alert.subject}
      </h3>

      {/* Summary */}
      <p className="text-sm text-gray-300 mb-3 leading-relaxed">{alert.summary}</p>

      {/* Divergence */}
      {alert.divergence && (
        <div className="bg-orange-950/50 border border-orange-700 rounded-lg p-3 mb-3 text-xs">
          <div className="flex items-center gap-1 text-orange-400 font-semibold mb-1">
            <ArrowRightLeft className="w-3 h-3" />
            Divergência detectada
          </div>
          <p className="text-orange-200">{alert.divergence.description}</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <span className="text-gray-400">E-mail: </span>
              <span className="text-orange-300">{alert.divergence.emailValue}</span>
            </div>
            <div>
              <span className="text-gray-400">API: </span>
              <span className="text-green-300">{alert.divergence.apiValue}</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions history */}
      {alert.actions?.length > 0 && (
        <div className="mb-3 space-y-1">
          {alert.actions.map((action: any) => (
            <div key={action.id} className="text-xs bg-gray-800/60 rounded p-2 border border-gray-700">
              <span className="text-green-400 font-medium">{action.takenBy}: </span>
              <span className="text-gray-300">{action.actionTaken}</span>
              <span className="text-gray-500 ml-1">
                · {new Date(action.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Resolved indicator */}
      {alert.isResolved ? (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          Resolvido por {alert.resolvedBy} em{" "}
          {alert.resolvedAt
            ? new Date(alert.resolvedAt).toLocaleDateString("pt-BR")
            : "—"}
        </div>
      ) : (
        <div className="flex gap-2 mt-1">
          <Button
            size="sm"
            className="bg-green-700 hover:bg-green-600 text-white text-xs h-7"
            onClick={() => onResolve(alert)}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Marcar como tratado
          </Button>
          {alert.isBlinking && (
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-gray-200 text-xs h-7"
              onClick={() => onDismiss(alert.id)}
            >
              <EyeOff className="w-3 h-3 mr-1" />
              Ignorar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GmailAlertas() {
  const [showResolved, setShowResolved] = useState(false);
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; alert: any | null }>({
    open: false,
    alert: null,
  });
  const [actionText, setActionText] = useState("");

  const utils = trpc.useUtils();

  const { data: alerts = [], isLoading } = trpc.gmailAlerts.list.useQuery(
    { showResolved, limit: 100 },
    { refetchInterval: 5 * 60 * 1000 }
  );

  const { data: counts } = trpc.gmailAlerts.countUnresolved.useQuery(
    undefined,
    { refetchInterval: 5 * 60 * 1000 }
  );

  const { data: lastSync } = trpc.gmailAlerts.lastSync.useQuery();

  const syncMutation = trpc.gmailAlerts.syncNow.useMutation({
    onSuccess: (result) => {
      toast.success(`Sincronização concluída: ${result.saved} novo(s) alerta(s) salvo(s)`);
      utils.gmailAlerts.list.invalidate();
      utils.gmailAlerts.countUnresolved.invalidate();
      utils.gmailAlerts.lastSync.invalidate();
    },
    onError: () => toast.error("Erro ao sincronizar e-mails"),
  });

  const resolveMutation = trpc.gmailAlerts.resolve.useMutation({
    onSuccess: () => {
      toast.success("Alerta marcado como tratado!");
      setResolveDialog({ open: false, alert: null });
      setActionText("");
      utils.gmailAlerts.list.invalidate();
      utils.gmailAlerts.countUnresolved.invalidate();
    },
    onError: () => toast.error("Erro ao resolver alerta"),
  });

  const dismissMutation = trpc.gmailAlerts.dismiss.useMutation({
    onSuccess: () => {
      utils.gmailAlerts.list.invalidate();
    },
  });

  const handleResolve = (alert: any) => {
    setResolveDialog({ open: true, alert });
    setActionText("");
  };

  const handleConfirmResolve = () => {
    if (!resolveDialog.alert || actionText.trim().length < 5) {
      toast.error("Descreva o que foi feito (mínimo 5 caracteres)");
      return;
    }
    resolveMutation.mutate({
      alertId: resolveDialog.alert.id,
      actionTaken: actionText.trim(),
    });
  };

  const criticalAlerts = alerts.filter((a: any) => a.urgency === "critical" && !a.isResolved);
  const warningAlerts = alerts.filter((a: any) => a.urgency === "warning" && !a.isResolved);
  const infoAlerts = alerts.filter((a: any) => a.urgency === "info" && !a.isResolved);
  const resolvedAlerts = alerts.filter((a: any) => a.isResolved);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-400" />
            Alertas Gmail
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            E-mails do Google Ads analisados por IA · Sincronização automática a cada 4h
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {lastSync?.lastSync && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Último sync: {new Date(lastSync.lastSync).toLocaleString("pt-BR")}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sincronizar agora
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="bg-red-950/40 border-red-700">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{counts?.critical ?? 0}</div>
            <div className="text-xs text-red-300 mt-1">Críticos</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-950/30 border-yellow-700">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{counts?.warning ?? 0}</div>
            <div className="text-xs text-yellow-300 mt-1">Atenção</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-950/20 border-blue-700">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{counts?.info ?? 0}</div>
            <div className="text-xs text-blue-300 mt-1">Informativos</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/40 border-gray-700">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-300">{counts?.total ?? 0}</div>
            <div className="text-xs text-gray-400 mt-1">Total pendentes</div>
          </CardContent>
        </Card>
      </div>

      {/* Toggle resolved */}
      <div className="flex items-center gap-2 mb-4">
        <Switch
          id="show-resolved"
          checked={showResolved}
          onCheckedChange={setShowResolved}
        />
        <Label htmlFor="show-resolved" className="text-sm text-gray-400 cursor-pointer">
          {showResolved ? <Eye className="w-4 h-4 inline mr-1" /> : <EyeOff className="w-4 h-4 inline mr-1" />}
          {showResolved ? "Mostrando resolvidos" : "Ocultar resolvidos"}
        </Label>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && alerts.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhum alerta encontrado</p>
          <p className="text-sm mt-1">Clique em "Sincronizar agora" para buscar e-mails recentes</p>
        </div>
      )}

      {/* Critical alerts */}
      {criticalAlerts.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Críticos ({criticalAlerts.length})
          </h2>
          <div className="space-y-3">
            {criticalAlerts.map((alert: any) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onResolve={handleResolve}
                onDismiss={(id) => dismissMutation.mutate({ alertId: id })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Warning alerts */}
      {warningAlerts.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Atenção ({warningAlerts.length})
          </h2>
          <div className="space-y-3">
            {warningAlerts.map((alert: any) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onResolve={handleResolve}
                onDismiss={(id) => dismissMutation.mutate({ alertId: id })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Info alerts */}
      {infoAlerts.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Informativos ({infoAlerts.length})
          </h2>
          <div className="space-y-3">
            {infoAlerts.map((alert: any) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onResolve={handleResolve}
                onDismiss={(id) => dismissMutation.mutate({ alertId: id })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Resolved alerts */}
      {showResolved && resolvedAlerts.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Resolvidos ({resolvedAlerts.length})
          </h2>
          <div className="space-y-3 opacity-60">
            {resolvedAlerts.map((alert: any) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onResolve={handleResolve}
                onDismiss={(id) => dismissMutation.mutate({ alertId: id })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Resolve Dialog */}
      <Dialog
        open={resolveDialog.open}
        onOpenChange={(open) => {
          if (!open) setResolveDialog({ open: false, alert: null });
        }}
      >
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              Registrar resolução
            </DialogTitle>
          </DialogHeader>

          {resolveDialog.alert && (
            <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">Alerta:</p>
              <p className="text-sm text-white font-medium">{resolveDialog.alert.subject}</p>
              <p className="text-xs text-gray-300 mt-1">{resolveDialog.alert.summary}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm text-gray-300">
              O que você fez para resolver? *
            </Label>
            <Textarea
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              placeholder="Ex: Verifiquei a campanha e ajustei o orçamento diário de R$50 para R$80. O problema era que o orçamento estava esgotando antes das 16h."
              className="bg-gray-800 border-gray-600 text-white placeholder-gray-500 resize-none h-28"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 text-right">{actionText.length}/500</p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              className="text-gray-400 hover:text-white"
              onClick={() => setResolveDialog({ open: false, alert: null })}
            >
              Cancelar
            </Button>
            <Button
              className="bg-green-700 hover:bg-green-600 text-white"
              onClick={handleConfirmResolve}
              disabled={resolveMutation.isPending || actionText.trim().length < 5}
            >
              {resolveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirmar resolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
