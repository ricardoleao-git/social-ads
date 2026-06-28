import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  RefreshCw,
  Filter,
} from "lucide-react";

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20", label: "Info" },
  success: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10 border-green-500/20", label: "Sucesso" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20", label: "Atenção" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20", label: "Erro" },
};

function timeAgo(date: Date | string) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

export default function NotificationCenter() {
  
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, refetch, isLoading } = trpc.inAppNotifications.list.useQuery(
    { limit: 50, unreadOnly: filter === "unread" },
    { refetchInterval: 15000 }
  );

  const markReadMut = trpc.inAppNotifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });
  const markAllMut = trpc.inAppNotifications.markAllRead.useMutation({
    onSuccess: () => { refetch(); toast.success("Todas as notificações marcadas como lidas"); },
  });
  const deleteMut = trpc.inAppNotifications.delete.useMutation({
    onSuccess: () => refetch(),
  });
  const clearReadMut = trpc.inAppNotifications.clearRead.useMutation({
    onSuccess: () => { refetch(); toast.success("Notificações lidas removidas"); },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-7 h-7 text-blue-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Central de Notificações</h1>
            <p className="text-sm text-muted-foreground">
              Alertas e eventos do sistema em tempo real
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllMut.mutate()} className="gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como lidas
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => clearReadMut.mutate()} className="gap-1.5 text-muted-foreground">
            <Trash2 className="w-3.5 h-3.5" /> Limpar lidas
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
          const count = notifications.filter(n => n.type === type).length;
          const Icon = cfg.icon;
          return (
            <Card key={type} className={`border ${cfg.bg}`}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                  <div>
                    <div className="text-xl font-bold text-foreground">{count}</div>
                    <div className="text-xs text-muted-foreground">{cfg.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          Todas ({notifications.length})
        </Button>
        <Button
          variant={filter === "unread" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("unread")}
        >
          Não lidas {unreadCount > 0 && <Badge className="ml-1 bg-red-500 text-white text-xs">{unreadCount}</Badge>}
        </Button>
      </div>

      {/* Lista de notificações */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Carregando notificações...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <BellOff className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">
                {filter === "unread" ? "Nenhuma notificação não lida" : "Nenhuma notificação ainda"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Os jobs do sistema enviarão alertas aqui quando houver eventos importantes
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => {
                const cfg = TYPE_CONFIG[notif.type ?? "info"] ?? TYPE_CONFIG.info;
                const Icon = cfg.icon;
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      notif.read
                        ? "bg-muted/20 border-muted/30 opacity-70"
                        : `${cfg.bg} border`
                    }`}
                    onClick={() => !notif.read && markReadMut.mutate({ id: notif.id })}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${notif.read ? "text-muted-foreground" : "text-foreground"}`}>
                          {notif.title}
                        </span>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{timeAgo(notif.createdAt)}</span>
                        {notif.source && notif.source !== "system" && (
                          <Badge variant="outline" className="text-xs py-0">{notif.source}</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteMut.mutate({ id: notif.id }); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
