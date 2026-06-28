import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mail, AlertTriangle, CheckCircle, RefreshCw, Send, Bell, Info,
} from "lucide-react";
import { toast } from "sonner";

type AlertType = "low_engagement" | "drop_followers" | "spike_comments" | "custom";
type Severity = "low" | "medium" | "high";

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  low_engagement: "Engajamento Baixo",
  drop_followers: "Queda de Seguidores",
  spike_comments: "Pico de Comentários",
  custom: "Personalizado",
};

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; emoji: string }> = {
  low: { label: "Baixa", color: "bg-green-100 text-green-700 border-green-200", emoji: "🟢" },
  medium: { label: "Média", color: "bg-yellow-100 text-yellow-700 border-yellow-200", emoji: "🟡" },
  high: { label: "Alta", color: "bg-red-100 text-red-700 border-red-200", emoji: "🔴" },
};

const QUICK_TEMPLATES: { label: string; alertType: AlertType; severity: Severity; title: string; message: string }[] = [
  {
    label: "Engajamento crítico",
    alertType: "low_engagement",
    severity: "high",
    title: "Engajamento Instagram abaixo do limiar",
    message: "O engajamento médio da conta @zenite.tech caiu abaixo do limiar configurado. Ação imediata necessária: revisar os posts recentes, verificar horários de publicação e aumentar a frequência de Reels.",
  },
  {
    label: "Queda de seguidores",
    alertType: "drop_followers",
    severity: "medium",
    title: "Queda de seguidores detectada",
    message: "A conta @zenite.tech registrou uma queda no número de seguidores nas últimas 24h. Verifique se houve algum post polêmico ou mudança de estratégia de conteúdo.",
  },
  {
    label: "Pico de comentários",
    alertType: "spike_comments",
    severity: "low",
    title: "Pico de comentários detectado",
    message: "A conta @zenite.tech registrou um volume incomum de comentários. Verifique se há comentários negativos ou spam que precisam de moderação.",
  },
];

export function InstagramAlertEmailPanel() {
  const [alertType, setAlertType] = useState<AlertType>("custom");
  const [severity, setSeverity] = useState<Severity>("high");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [to, setTo] = useState("rjll70@gmail.com");
  const [saveAlert, setSaveAlert] = useState(true);
  const [lastResult, setLastResult] = useState<{
    emailSent: boolean;
    recipient: string;
    title: string;
    emailError?: string | null;
  } | null>(null);

  const sendMutation = trpc.instagram.sendCriticalAlertEmail.useMutation({
    onSuccess: (data) => {
      setLastResult(data);
      if (data.emailSent) {
        toast.success(`E-mail enviado para ${data.recipient}!`);
      } else {
        toast.error(`Falha ao enviar e-mail: ${data.emailError}`);
      }
    },
    onError: (err) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const handleTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    setAlertType(tpl.alertType);
    setSeverity(tpl.severity);
    setTitle(tpl.title);
    setMessage(tpl.message);
  };

  const handleSend = () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Preencha o título e a mensagem do alerta.");
      return;
    }
    sendMutation.mutate({ alertType, severity, title, message, to, saveAlert });
  };

  const isValid = title.trim().length > 0 && message.trim().length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4 text-red-600" />
          Alertas Críticos por E-mail
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Envie alertas manuais por e-mail para situações críticas de redes sociais
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Templates rápidos */}
        <div>
          <Label className="text-xs text-gray-600 mb-2 block">Templates Rápidos</Label>
          <div className="flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                onClick={() => handleTemplate(tpl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  SEVERITY_CONFIG[tpl.severity].color
                } hover:opacity-80`}
              >
                {SEVERITY_CONFIG[tpl.severity].emoji} {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo e Severidade */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Tipo de Alerta</Label>
            <select
              value={alertType}
              onChange={(e) => setAlertType(e.target.value as AlertType)}
              className="w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {(Object.keys(ALERT_TYPE_LABELS) as AlertType[]).map((t) => (
                <option key={t} value={t}>{ALERT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Severidade</Label>
            <div className="flex items-center gap-1.5">
              {(Object.keys(SEVERITY_CONFIG) as Severity[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`flex-1 py-1 rounded-md text-xs font-medium border transition-colors ${
                    severity === s
                      ? SEVERITY_CONFIG[s].color + " ring-1 ring-offset-1 ring-current"
                      : "bg-gray-50 text-muted-foreground border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {SEVERITY_CONFIG[s].emoji} {SEVERITY_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Título */}
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Título do Alerta</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Engajamento crítico detectado"
            className="h-8 text-sm"
          />
        </div>

        {/* Mensagem */}
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Mensagem</Label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Descreva o alerta em detalhes..."
            rows={4}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <p className="text-xs text-muted-foreground mt-0.5">{message.length}/500 caracteres</p>
        </div>

        {/* Destinatário */}
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Destinatário</Label>
          <Input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Salvar no banco */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="saveAlert"
            checked={saveAlert}
            onChange={(e) => setSaveAlert(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="saveAlert" className="text-xs text-gray-600 cursor-pointer">
            Salvar alerta no banco de dados (aparece no painel de alertas)
          </label>
        </div>

        {/* Botão de envio */}
        <Button
          onClick={handleSend}
          disabled={!isValid || sendMutation.isPending}
          className="w-full bg-red-600 hover:bg-red-700 text-foreground gap-2"
        >
          {sendMutation.isPending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {sendMutation.isPending ? "Enviando..." : "Enviar Alerta por E-mail"}
        </Button>

        {/* Resultado */}
        {lastResult && (
          <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
            lastResult.emailSent
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            {lastResult.emailSent ? (
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <div>
              {lastResult.emailSent ? (
                <p>E-mail enviado com sucesso para <strong>{lastResult.recipient}</strong>.</p>
              ) : (
                <p>Falha ao enviar: {lastResult.emailError}</p>
              )}
              <p className="text-xs opacity-70 mt-0.5">Assunto: {lastResult.title}</p>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p>
            O alerta automático de engajamento (<strong>checkEngagementAlert</strong>) já é executado diariamente às 8h.
            Use este painel para envios manuais em situações críticas pontuais.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
