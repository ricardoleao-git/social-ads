import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send, CheckCircle, XCircle, Clock, AlertTriangle, Settings, History, Zap, Eye, EyeOff, Shield } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  sent: "bg-green-100 text-green-700 border-green-300",
  failed: "bg-red-100 text-red-700 border-red-300",
  rate_limited: "bg-yellow-100 text-yellow-700 border-yellow-300",
  quiet_hours: "bg-blue-100 text-blue-700 border-blue-300",
};

const statusLabels: Record<string, string> = {
  sent: "Enviado",
  failed: "Falhou",
  rate_limited: "Limite de taxa",
  quiet_hours: "Horário silencioso",
};

const statusIcons: Record<string, React.ReactNode> = {
  sent: <CheckCircle className="w-3 h-3" />,
  failed: <XCircle className="w-3 h-3" />,
  rate_limited: <Clock className="w-3 h-3" />,
  quiet_hours: <Clock className="w-3 h-3" />,
};

export default function AlertasWhatsApp() {
  const [editMode, setEditMode] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [provider, setProvider] = useState<"evolution_api" | "twilio">("evolution_api");
  const [apiUrl, setApiUrl] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioWhatsappFrom, setTwilioWhatsappFrom] = useState("");
  const [quietStart, setQuietStart] = useState(22);
  const [quietEnd, setQuietEnd] = useState(7);
  const [maxPerHour, setMaxPerHour] = useState(10);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);

  const { data: config, refetch: refetchConfig } = trpc.whatsappAlerts.getConfig.useQuery();
  const { data: history, refetch: refetchHistory } = trpc.whatsappAlerts.getHistory.useQuery({ limit: 50 });
  const { data: stats } = trpc.whatsappAlerts.getStats.useQuery();

  const updateConfig = trpc.whatsappAlerts.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva com sucesso!");
      setEditMode(false);
      refetchConfig();
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const testSend = trpc.whatsappAlerts.testSend.useMutation({
    onSuccess: (result: any) => {
      if (result.success) {
        toast.success("Mensagem de teste enviada com sucesso!");
      } else {
        toast.warning(`Não enviado: ${result.status === "quiet_hours" ? "Horário silencioso" : result.status === "rate_limited" ? "Limite de taxa atingido" : result.error}`);
      }
      refetchHistory();
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const toggleEnabled = trpc.whatsappAlerts.updateConfig.useMutation({
    onSuccess: () => refetchConfig(),
  });

  const handleSaveConfig = () => {
    const payload: any = {
      phoneNumber: phoneNumber || undefined,
      provider,
      quietHoursStart: quietStart,
      quietHoursEnd: quietEnd,
      maxPerHour,
    };
    if (provider === "evolution_api") {
      payload.apiUrl = apiUrl || undefined;
      payload.instanceName = instanceName || undefined;
      payload.apiKey = apiKey || undefined;
    } else {
      payload.twilioAccountSid = twilioAccountSid || undefined;
      payload.twilioAuthToken = twilioAuthToken || undefined;
      payload.twilioWhatsappFrom = twilioWhatsappFrom || undefined;
    }
    updateConfig.mutate(payload);
  };

  const handleEditStart = () => {
    if (config) {
      setPhoneNumber(config.phoneNumber ?? "");
      setProvider((config.provider as "evolution_api" | "twilio") ?? "evolution_api");
      setApiUrl(config.apiUrl ?? "");
      setInstanceName(config.instanceName ?? "");
      setApiKey((config as any).apiKey ?? "");
      setTwilioAccountSid((config as any).twilioAccountSid ?? "");
      setTwilioAuthToken((config as any).twilioAuthToken ?? "");
      setTwilioWhatsappFrom((config as any).twilioWhatsappFrom ?? "");
      setQuietStart(config.quietHoursStart ?? 22);
      setQuietEnd(config.quietHoursEnd ?? 7);
      setMaxPerHour(config.maxPerHour ?? 10);
    }
    setEditMode(true);
  };

  const maskValue = (val: string) => val ? val.substring(0, 4) + "****" + val.substring(val.length - 4) : "Não configurado";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-green-500" />
            Alertas WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Notificações automáticas de anomalias, leads quentes e orçamento via WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-3">
          {config && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">{config.enabled ? "Ativo" : "Inativo"}</span>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) => toggleEnabled.mutate({ enabled: v })}
              />
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleEditStart}>
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
          <Button
            size="sm"
            onClick={() => testSend.mutate()}
            disabled={testSend.isPending || !config?.enabled}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Send className="w-4 h-4 mr-2" />
            {testSend.isPending ? "Enviando..." : "Testar Envio"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Enviados", value: stats?.sent ?? 0, icon: <CheckCircle className="w-5 h-5 text-green-500" />, color: "text-green-600" },
          { label: "Falhas", value: stats?.failed ?? 0, icon: <XCircle className="w-5 h-5 text-red-500" />, color: "text-red-600" },
          { label: "Limite de Taxa", value: stats?.rateLimited ?? 0, icon: <Clock className="w-5 h-5 text-yellow-500" />, color: "text-yellow-600" },
          { label: "Horário Silencioso", value: stats?.quietHours ?? 0, icon: <Clock className="w-5 h-5 text-blue-500" />, color: "text-blue-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                {s.icon}
                <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
              </div>
              <p className="text-muted-foreground text-xs mt-2">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuração atual / Edição */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              {editMode ? "Editar Configuração" : "Configuração Atual"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editMode ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">Número WhatsApp (com DDI)</Label>
                  <Input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="5583999999999"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Formato: 55 + DDD + número (sem espaços ou hífens)</p>
                </div>
                <div>
                  <Label className="text-sm">Provedor</Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="evolution_api">Evolution API (self-hosted)</SelectItem>
                      <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {provider === "evolution_api" ? (
                  <>
                    <div>
                      <Label className="text-sm">URL da Evolution API</Label>
                      <Input
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="https://evolution.seudominio.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Nome da Instância</Label>
                      <Input
                        value={instanceName}
                        onChange={(e) => setInstanceName(e.target.value)}
                        placeholder="zenite-tech"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm flex items-center gap-1">
                        <Shield className="w-3 h-3" /> API Key
                      </Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Sua API Key da Evolution API"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowApiKey(!showApiKey)}
                          type="button"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="text-sm">Twilio Account SID</Label>
                      <Input
                        value={twilioAccountSid}
                        onChange={(e) => setTwilioAccountSid(e.target.value)}
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Twilio Auth Token
                      </Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type={showTwilioToken ? "text" : "password"}
                          value={twilioAuthToken}
                          onChange={(e) => setTwilioAuthToken(e.target.value)}
                          placeholder="Seu Auth Token do Twilio"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowTwilioToken(!showTwilioToken)}
                          type="button"
                        >
                          {showTwilioToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Número WhatsApp Twilio (From)</Label>
                      <Input
                        value={twilioWhatsappFrom}
                        onChange={(e) => setTwilioWhatsappFrom(e.target.value)}
                        placeholder="+14155238886"
                        className="mt-1"
                      />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Silêncio início (h)</Label>
                    <Input type="number" min={0} max={23} value={quietStart} onChange={(e) => setQuietStart(Number(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Silêncio fim (h)</Label>
                    <Input type="number" min={0} max={23} value={quietEnd} onChange={(e) => setQuietEnd(Number(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Máx/hora</Label>
                    <Input type="number" min={1} max={100} value={maxPerHour} onChange={(e) => setMaxPerHour(Number(e.target.value))} className="mt-1" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveConfig} disabled={updateConfig.isPending} className="flex-1">
                    {updateConfig.isPending ? "Salvando..." : "Salvar Configuração"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditMode(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {!config ? (
                  <p className="text-muted-foreground">Nenhuma configuração. Clique em "Configurar" para começar.</p>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={config.enabled ? "default" : "secondary"}>
                        {config.enabled ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Número</span>
                      <span className="font-mono">{config.phoneNumber ?? "Não configurado"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provedor</span>
                      <span>{config.provider === "evolution_api" ? "Evolution API" : "Twilio"}</span>
                    </div>
                    {config.provider === "evolution_api" && (
                      <>
                        {config.apiUrl && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">API URL</span>
                            <span className="text-xs truncate max-w-[200px]">{config.apiUrl}</span>
                          </div>
                        )}
                        {config.instanceName && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Instância</span>
                            <span>{config.instanceName}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">API Key</span>
                          <span className="font-mono text-xs">{maskValue((config as any).apiKey ?? "")}</span>
                        </div>
                      </>
                    )}
                    {config.provider === "twilio" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Account SID</span>
                          <span className="font-mono text-xs">{maskValue((config as any).twilioAccountSid ?? "")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Auth Token</span>
                          <span className="font-mono text-xs">{maskValue((config as any).twilioAuthToken ?? "")}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Horário silencioso</span>
                      <span>{config.quietHoursStart}h – {config.quietHoursEnd}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Limite por hora</span>
                      <span>{config.maxPerHour} mensagens</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gatilhos de alerta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              Gatilhos de Alerta Ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "CPC acima de R$5,00", desc: "Qualquer grupo com CPC médio acima do limite", severity: "critical", active: true },
              { label: "Queda de CTR > 30%", desc: "CTR caiu mais de 30% em relação às últimas 4h", severity: "critical", active: true },
              { label: "Lead quente detectado", desc: "Score >= 5 no sistema de lead scoring (notificação tripla)", severity: "warning", active: true },
              { label: "Orçamento >= 80%", desc: "Campanha atingiu 80% do orçamento diário", severity: "warning", active: true },
              { label: "Zero conversões em 48h", desc: "Grupo com histórico de conversões sem nenhuma em 2 dias", severity: "info", active: false },
            ].map((trigger) => (
              <div key={trigger.label} className="flex items-start justify-between p-3 rounded-lg bg-muted/40">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${trigger.severity === "critical" ? "text-red-500" : trigger.severity === "warning" ? "text-yellow-500" : "text-gray-400"}`} />
                    <span className="text-sm font-medium">{trigger.label}</span>
                    {!trigger.active && <Badge variant="secondary" className="text-xs">Em breve</Badge>}
                  </div>
                  <p className="text-muted-foreground text-xs mt-1 ml-6">{trigger.desc}</p>
                </div>
                <Switch checked={trigger.active} disabled className="ml-3" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              Histórico de Mensagens
            </CardTitle>
            <Badge variant="secondary">{history?.length ?? 0} registros</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma mensagem enviada ainda.</p>
              <p className="text-xs mt-1">Configure o número e clique em "Testar Envio" para começar.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {history.map((alert: any) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Badge className={`text-xs border shrink-0 flex items-center gap-1 ${statusColors[alert.status] ?? ""}`}>
                    {statusIcons[alert.status]}
                    {statusLabels[alert.status] ?? alert.status}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{alert.message}</p>
                    {alert.adGroupName && (
                      <p className="text-muted-foreground text-xs mt-0.5">Grupo: {alert.adGroupName}</p>
                    )}
                    {alert.errorMessage && (
                      <p className="text-red-500 text-xs mt-0.5">{alert.errorMessage}</p>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {new Date(alert.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guia de Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guia de Configuração Rápida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <span className="bg-green-100 text-green-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">A</span>
              Evolution API (recomendado)
            </h4>
            <ol className="space-y-1 text-muted-foreground list-decimal list-inside ml-7">
              <li>Instale: <code className="text-blue-600 bg-blue-50 px-1 rounded">docker run -p 8080:8080 atendai/evolution-api</code></li>
              <li>Crie uma instância e conecte via QR Code</li>
              <li>Preencha URL da API, Nome da Instância e API Key acima</li>
              <li>Ative o switch e clique em "Testar Envio"</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">B</span>
              Twilio WhatsApp
            </h4>
            <ol className="space-y-1 text-muted-foreground list-decimal list-inside ml-7">
              <li>Crie conta em <a href="https://twilio.com" target="_blank" rel="noopener" className="text-blue-600 underline">twilio.com</a> e ative o sandbox WhatsApp</li>
              <li>Preencha Account SID, Auth Token e número WhatsApp From acima</li>
              <li>Selecione "Twilio" como provedor e salve</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
