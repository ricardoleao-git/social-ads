import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Wrench, ShieldAlert, CheckCircle2, Clock, Activity,
  Wifi, WifiOff, AlertTriangle, TrendingUp, RefreshCw
} from "lucide-react";

const SERVICE_LABELS: Record<string, string> = {
  google_ads: "Google Ads API",
  ga4: "Google Analytics 4",
  instagram_mcp: "Instagram MCP",
  database: "Banco de Dados",
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  google_ads: <TrendingUp className="w-4 h-4" />,
  ga4: <Activity className="w-4 h-4" />,
  instagram_mcp: <Wifi className="w-4 h-4" />,
  database: <CheckCircle2 className="w-4 h-4" />,
};

export default function MaintenanceControl() {
  const [editMessage, setEditMessage] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const { data: maintenance, refetch: refetchMaintenance } = trpc.systemSettings.getMaintenanceMode.useQuery();
  const { data: uptimeData, refetch: refetchUptime } = trpc.systemSettings.getUptimeHistory.useQuery({ hours: 24 });

  const setMaintenanceMutation = trpc.systemSettings.setMaintenanceMode.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva com sucesso!");
      setIsEditing(false);
      refetchMaintenance();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const handleToggle = () => {
    if (!maintenance) return;
    const newState = !maintenance.enabled;
    setMaintenanceMutation.mutate({
      enabled: newState,
      message: maintenance.message,
      endTime: maintenance.endTime,
    });
    toast.info(newState ? "Modo manutenção ATIVADO" : "Modo manutenção DESATIVADO");
  };

  const handleSaveSettings = () => {
    setMaintenanceMutation.mutate({
      enabled: maintenance?.enabled ?? false,
      message: editMessage || maintenance?.message,
      endTime: editEndTime || maintenance?.endTime,
    });
  };

  const startEditing = () => {
    setEditMessage(maintenance?.message ?? "");
    setEditEndTime(maintenance?.endTime ?? "");
    setIsEditing(true);
  };

  const summary = uptimeData?.summary ?? {};
  const services = Object.keys(summary);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle do Sistema</h1>
          <p className="text-sm text-gray-500 mt-1">Modo manutenção e monitoramento de uptime</p>
        </div>
        <Button variant="outline" onClick={() => { refetchMaintenance(); refetchUptime(); }} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Modo Manutenção */}
      <Card className={maintenance?.enabled ? "border-orange-300 bg-orange-50/30" : "border-green-200 bg-green-50/20"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              {maintenance?.enabled ? (
                <ShieldAlert className="w-5 h-5 text-orange-500" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              )}
              Modo Manutenção
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                maintenance?.enabled ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
              }`}>
                {maintenance?.enabled ? "ATIVO" : "INATIVO"}
              </span>
            </CardTitle>
            <Button
              onClick={handleToggle}
              disabled={setMaintenanceMutation.isPending}
              variant={maintenance?.enabled ? "destructive" : "default"}
              className="gap-2"
            >
              <Wrench className="w-4 h-4" />
              {maintenance?.enabled ? "Desativar Manutenção" : "Ativar Manutenção"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {maintenance?.enabled && (
            <div className="p-3 bg-orange-100 border border-orange-200 rounded-lg">
              <p className="text-sm font-medium text-orange-800">⚠️ O dashboard está em modo manutenção</p>
              <p className="text-sm text-orange-700 mt-1">{maintenance.message}</p>
              {maintenance.endTime && (
                <p className="text-xs text-orange-600 mt-1">Previsão de retorno: {maintenance.endTime}</p>
              )}
            </div>
          )}

          {!isEditing ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-gray-500 w-28 shrink-0">Mensagem:</span>
                <span className="text-sm text-gray-700">{maintenance?.message || "—"}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-gray-500 w-28 shrink-0">Previsão retorno:</span>
                <span className="text-sm text-gray-700">{maintenance?.endTime || "Não definida"}</span>
              </div>
              <Button variant="outline" size="sm" onClick={startEditing} className="mt-2">
                Editar mensagem
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Mensagem de manutenção</label>
                <textarea
                  value={editMessage}
                  onChange={e => setEditMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Previsão de retorno (ex: 14h30 de hoje)</label>
                <input
                  type="text"
                  value={editEndTime}
                  onChange={e => setEditEndTime(e.target.value)}
                  placeholder="Ex: 14h30 de hoje"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveSettings} disabled={setMaintenanceMutation.isPending}>
                  Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uptime dos serviços */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Uptime dos Serviços (últimas 24h)
        </h2>
        {services.length === 0 ? (
          <Card className="text-center py-10 text-gray-400">
            <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum dado de uptime registrado ainda.</p>
            <p className="text-xs mt-1">Os checks são registrados automaticamente pelos jobs do sistema.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map(svc => {
              const s = summary[svc];
              const isUp = s.lastStatus === "up";
              const isDegraded = s.lastStatus === "degraded";
              return (
                <Card key={svc} className={`${isUp ? "border-green-200" : isDegraded ? "border-yellow-200" : "border-red-200"}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-full ${isUp ? "bg-green-100 text-green-600" : isDegraded ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"}`}>
                          {isUp ? <Wifi className="w-4 h-4" /> : isDegraded ? <AlertTriangle className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{SERVICE_LABELS[svc] ?? svc}</p>
                          <p className="text-xs text-gray-500">
                            {s.lastCheck ? `Último check: ${new Date(s.lastCheck).toLocaleTimeString("pt-BR")}` : "Sem dados"}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${isUp ? "bg-green-100 text-green-700" : isDegraded ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                        {isUp ? "UP" : isDegraded ? "DEGRADED" : "DOWN"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-lg font-bold text-gray-800">{s.uptime}%</p>
                        <p className="text-xs text-gray-500">Uptime</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-lg font-bold text-gray-800">
                          {s.avgResponseMs > 0 ? `${s.avgResponseMs}ms` : "—"}
                        </p>
                        <p className="text-xs text-gray-500">Resp. média</p>
                      </div>
                    </div>
                    {/* Barra de uptime visual */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${s.uptime >= 95 ? "bg-green-500" : s.uptime >= 80 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${s.uptime}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dica de uso */}
      <Card className="bg-blue-50/50 border-blue-100">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Clock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Como funciona o modo manutenção</p>
              <p className="text-sm text-blue-700 mt-1">
                Quando ativado, um banner de aviso é exibido no topo do dashboard para todos os usuários. 
                Os jobs e automações continuam rodando normalmente em background. 
                Use durante atualizações ou quando precisar alertar sobre instabilidades.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
