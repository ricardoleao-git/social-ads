import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Mail, Save, RefreshCw, CheckCircle, AlertTriangle, Info, Plus, X, Clock, History } from "lucide-react";
import { useState, useEffect } from "react";

/**
 * Página de Administração — Configuração de E-mails de Alerta
 * Permite definir múltiplos destinatários para alertas automáticos do sistema.
 * Aceita e-mails separados por vírgula ou ponto-e-vírgula.
 */
export default function AdminEmailAlertas() {
  const { data, isLoading, refetch } = trpc.alertEmailConfig.get.useQuery();
  const updateMutation = trpc.alertEmailConfig.update.useMutation({
    onSuccess: () => {
      setFeedback({ type: "success", msg: "E-mails de alerta atualizados com sucesso!" });
      refetch();
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err) => {
      setFeedback({ type: "error", msg: `Erro ao salvar: ${err.message}` });
    },
  });

  const [emailsRaw, setEmailsRaw] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (data?.emails) {
      setEmailsRaw(data.emails);
    }
  }, [data?.emails]);

  // Parseia e valida os e-mails do campo
  const parsedEmails = emailsRaw
    .replace(/;/g, ",")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const invalidEmails = parsedEmails.filter(
    (e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  );

  function handleSave() {
    if (invalidEmails.length > 0) {
      setFeedback({ type: "error", msg: `E-mails inválidos: ${invalidEmails.join(", ")}` });
      return;
    }
    if (parsedEmails.length === 0) {
      setFeedback({ type: "error", msg: "Informe ao menos um e-mail válido." });
      return;
    }
    updateMutation.mutate({ emails: emailsRaw });
  }

  function removeEmail(email: string) {
    const updated = parsedEmails.filter((e) => e !== email).join(", ");
    setEmailsRaw(updated);
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Mail className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">E-mails de Alerta</h1>
            <p className="text-sm text-muted-foreground">
              Configure os destinatários que receberão alertas automáticos do sistema
            </p>
          </div>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <p className="font-medium">Como funciona</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Os alertas automáticos do sistema (anomalias de CTR/CPC, quedas de conversão, orçamento crítico, relatórios semanais) 
              são enviados para todos os e-mails cadastrados aqui. Separe múltiplos endereços por <strong>vírgula</strong> ou <strong>ponto-e-vírgula</strong>.
            </p>
          </div>
        </div>

        {/* Campo de e-mails */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Destinatários de Alertas
            </label>
            <textarea
              value={emailsRaw}
              onChange={(e) => setEmailsRaw(e.target.value)}
              placeholder="atendimento@zenite.tech, rjll70@gmail.com"
              rows={4}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-blue-500 resize-none font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Separe os e-mails por vírgula (,) ou ponto-e-vírgula (;). Espaços são ignorados automaticamente.
            </p>
          </div>

          {/* Tags de e-mails parseados */}
          {parsedEmails.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {parsedEmails.length} destinatário{parsedEmails.length !== 1 ? "s" : ""} detectado{parsedEmails.length !== 1 ? "s" : ""}:
              </p>
              <div className="flex flex-wrap gap-2">
                {parsedEmails.map((email) => {
                  const isInvalid = invalidEmails.includes(email);
                  return (
                    <div
                      key={email}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                        isInvalid
                          ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      <Mail className="w-3 h-3" />
                      {email}
                      <button
                        onClick={() => removeEmail(email)}
                        className="hover:opacity-70 transition-opacity"
                        title="Remover"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              )}
              {feedback.msg}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending || isLoading || invalidEmails.length > 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar E-mails
            </button>
            <button
              onClick={() => {
                if (data?.emails) setEmailsRaw(data.emails);
                setFeedback(null);
              }}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:text-foreground text-sm rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Restaurar
            </button>
          </div>
        </div>

        {/* Tipos de alerta que usam esses e-mails */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            Alertas que utilizam estes destinatários
          </h2>
          <div className="space-y-2">
            {[
              { name: "Alerta de Anomalia (4h)", desc: "Disparado quando CTR cai >30% ou CPC sobe >50% em relação à média dos últimos 7 dias." },
              { name: "Relatório Semanal de Tráfego", desc: "Enviado toda segunda-feira às 9h com resumo de performance da semana anterior." },
              { name: "Orçamento Crítico", desc: "Enviado quando o orçamento diário está abaixo de 20% do limite configurado." },
              { name: "Queda de Conversões", desc: "Disparado quando o número de conversões cai >40% em relação à semana anterior." },
              { name: "Score RSA Semanal", desc: "Enviado toda sexta-feira com análise de qualidade dos anúncios responsivos." },
              { name: "Relatório Integrado Ads+Social", desc: "Relatório mensal consolidado de Google Ads e Instagram enviado no dia 1 de cada mês." },
            ].map(({ name, desc }) => (
              <div key={name} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Log de Auditoria */}
        <AuditLog />

        {/* Última atualização */}
        {(data as any)?.updatedAt && (
          <p className="text-xs text-muted-foreground text-center">
            Última atualização: {new Date((data as any).updatedAt).toLocaleString("pt-BR")}
            {(data as any).updatedBy && ` · por ${(data as any).updatedBy}`}
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}

function AuditLog() {
  const { data: history, isLoading } = trpc.alertEmailConfig.history.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <History className="w-4 h-4 text-blue-400" />
        Histórico de Alterações
      </h2>
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Carregando histórico...
        </div>
      ) : !history || history.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
          <Clock className="w-4 h-4" />
          Nenhuma alteração registrada ainda. O histórico será criado após a primeira atualização.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry: any) => (
            <div key={entry.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
              <div className="p-1.5 rounded-lg bg-muted flex-shrink-0">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-foreground">{entry.userEmail}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(entry.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                {entry.metadata && (
                  <div className="space-y-1">
                    {entry.metadata.before && (
                      <p className="text-xs text-muted-foreground">
                        <span className="text-red-400">Antes:</span> {entry.metadata.before || "(vazio)"}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      <span className="text-emerald-400">Depois:</span> {entry.metadata.after || "(vazio)"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
