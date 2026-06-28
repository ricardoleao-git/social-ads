import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Bell, BellOff, CheckCircle, AlertTriangle, TrendingDown, Mail, Save, Loader2, Database } from "lucide-react";

interface Props {
  currentEngagement?: number;
}

export function InstagramEngagementAlertConfig({ currentEngagement = 0 }: Props) {
  const [threshold, setThreshold] = useState<number>(5.0);
  const [email, setEmail] = useState("rjll70@gmail.com");
  const [enabled, setEnabled] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [savedToDb, setSavedToDb] = useState(false);

  // Carregar configuração do banco
  const { data: settingsData, isLoading: loadingSettings } = trpc.instagram.getSettings.useQuery();

  // Mutations
  const updateSetting = trpc.instagram.updateSettings.useMutation();
  const sendAlert = trpc.instagram.sendCriticalAlertEmail.useMutation();

  // Preencher campos com dados do banco ao carregar
  useEffect(() => {
    if (settingsData?.settings) {
      const s = settingsData.settings;
      const dbThreshold = parseFloat(s["instagram.engagementThreshold"] ?? "5") * 100;
      setThreshold(isNaN(dbThreshold) ? 5.0 : parseFloat(dbThreshold.toFixed(2)));
      if (s["instagram.alertEmail"]) setEmail(s["instagram.alertEmail"]);
      if (s["instagram.alertEnabled"] !== undefined) setEnabled(s["instagram.alertEnabled"] === "true");
    }
  }, [settingsData]);

  const isBelow = currentEngagement > 0 && currentEngagement < threshold;

  const handleSave = async () => {
    try {
      // Salvar threshold (em decimal: 5% → 0.05)
      await updateSetting.mutateAsync({
        key: "instagram.engagementThreshold",
        value: (threshold / 100).toFixed(4),
        label: "Limiar de Engajamento Instagram",
        description: `Alerta disparado quando engajamento semanal cair abaixo de ${threshold}%`,
      });
      // Salvar e-mail
      await updateSetting.mutateAsync({
        key: "instagram.alertEmail",
        value: email,
        label: "E-mail de Alerta Instagram",
        description: "Destinatário dos alertas automáticos de engajamento",
      });
      // Salvar status habilitado
      await updateSetting.mutateAsync({
        key: "instagram.alertEnabled",
        value: enabled ? "true" : "false",
        label: "Alerta de Engajamento Habilitado",
      });
      setSavedToDb(true);
      setIsDirty(false);
      setTimeout(() => setSavedToDb(false), 3000);
    } catch (e) {
      console.error("Erro ao salvar configuração:", e);
    }
  };

  const handleTestAlert = async () => {
    try {
      await sendAlert.mutateAsync({
        to: email,
        alertType: "low_engagement",
        severity: "high",
        title: `⚠️ Teste: Engajamento abaixo de ${threshold}%`,
        message: `Este é um e-mail de teste do alerta de engajamento.\n\nConfiguração atual:\n• Limite definido: ${threshold}%\n• Engajamento atual: ${currentEngagement.toFixed(2)}%\n• Status: ${isBelow ? "🔴 ABAIXO DO LIMITE" : "🟢 DENTRO DO LIMITE"}\n\nVocê receberá este alerta automaticamente toda segunda-feira se o engajamento semanal cair abaixo do limite configurado.`,
        saveAlert: true,
      });
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    } catch (e) {
      console.error("Erro ao enviar alerta de teste:", e);
    }
  };

  const handleThresholdChange = (v: number) => { setThreshold(v); setIsDirty(true); };
  const handleEmailChange = (v: string) => { setEmail(v); setIsDirty(true); };
  const handleToggle = () => { setEnabled(!enabled); setIsDirty(true); };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${enabled ? "bg-orange-50 text-orange-600" : "bg-gray-100 text-muted-foreground"}`}>
            {enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Alerta de Engajamento</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {loadingSettings ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Carregando...</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-green-600"><Database className="w-3 h-3" /> Configuração salva no banco</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-orange-500" : "bg-gray-200"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {/* Status atual */}
      {currentEngagement > 0 && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-3 ${isBelow ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
          {isBelow ? (
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          )}
          <div>
            <p className={`text-sm font-semibold ${isBelow ? "text-red-700" : "text-green-700"}`}>
              {isBelow ? "Engajamento abaixo do limite!" : "Engajamento dentro do limite"}
            </p>
            <p className={`text-xs ${isBelow ? "text-red-600" : "text-green-600"}`}>
              Atual: <strong>{currentEngagement.toFixed(2)}%</strong> · Limite: <strong>{threshold}%</strong>
            </p>
          </div>
          {isBelow && <TrendingDown className="w-4 h-4 text-red-500 ml-auto" />}
        </div>
      )}

      <div className="space-y-4">
        {/* Threshold */}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1 block">
            Limite mínimo de engajamento (%)
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              value={threshold}
              onChange={(e) => handleThresholdChange(parseFloat(e.target.value) || 0)}
              className="w-28 text-center font-bold"
              disabled={!enabled}
            />
            <span className="text-sm text-muted-foreground">%</span>
            <div className="flex gap-1 ml-2">
              {[2, 3, 5, 8, 10].map((v) => (
                <button
                  key={v}
                  onClick={() => handleThresholdChange(v)}
                  disabled={!enabled}
                  className={`px-2 py-1 text-xs rounded border transition-all ${threshold === v ? "bg-orange-500 text-foreground border-orange-500" : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"} disabled:opacity-40`}
                >
                  {v}%
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Alerta disparado quando engajamento semanal cair abaixo deste valor
          </p>
        </div>

        {/* E-mail destino */}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            E-mail de destino
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="seu@email.com"
            disabled={!enabled}
            className="text-sm"
          />
        </div>

        {/* Frequência */}
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-700 font-medium">📅 Verificação automática</p>
          <p className="text-xs text-blue-600 mt-0.5">
            O sistema verifica o engajamento semanal toda <strong>segunda-feira às 08:00</strong> junto com o relatório semanal. Se o engajamento estiver abaixo do limite, um alerta é enviado automaticamente.
          </p>
        </div>

        {/* Botões */}
        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSave}
            size="sm"
            className={`gap-2 text-foreground ${isDirty ? "bg-orange-500 hover:bg-orange-600" : "bg-gray-400 hover:bg-gray-500"}`}
            disabled={!enabled || updateSetting.isPending}
          >
            {updateSetting.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : savedToDb ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {updateSetting.isPending ? "Salvando..." : savedToDb ? "Salvo no banco!" : isDirty ? "Salvar Configuração" : "Configuração Salva"}
          </Button>
          <Button
            onClick={handleTestAlert}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!enabled || sendAlert.isPending}
          >
            {testSent ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Bell className="w-4 h-4" />}
            {sendAlert.isPending ? "Enviando..." : testSent ? "Enviado!" : "Testar Alerta"}
          </Button>
        </div>

        {isDirty && (
          <p className="text-xs text-orange-600 flex items-center gap-1">
            ⚠️ Há alterações não salvas. Clique em "Salvar Configuração" para persistir no banco.
          </p>
        )}
      </div>
    </Card>
  );
}
