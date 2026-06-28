import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  Activity, Target, DollarSign, Users, TrendingUp,
  CheckCircle, AlertTriangle, Clock, MousePointerClick, Globe, Smartphone,
  Mail, Bell, BellOff, Link2, BarChart2, ShieldCheck, Download, History, Zap
} from "lucide-react";
import { useState, useEffect } from "react";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
      {ok ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {label}
    </span>
  );
}

const DEVICE_COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

const MONITOR_PERIOD_OPTIONS = [
  { value: "7d", label: "7 dias" },
  { value: "14d", label: "14 dias" },
  { value: "30d", label: "30 dias" },
] as const;

export default function MonitoramentoDiario() {
  const [monitorPeriod, setMonitorPeriod] = useState<"7d" | "14d" | "30d">("7d");
  const [countryFilter, setCountryFilter] = useState<"all" | "brazil" | "others">("brazil");
  const { data: ga4Summary, isLoading: loadingGA4 } = trpc.ga4Real.getSummary.useQuery({ period: monitorPeriod, countryFilter });
  const { data: ga4Channels } = trpc.ga4Real.getTrafficByChannel.useQuery({ period: monitorPeriod, countryFilter });
  const { data: deviceRaw } = trpc.ga4Real.getDeviceBreakdown.useQuery({ period: monitorPeriod, countryFilter });
  const { data: adsSummaryRaw, isLoading: loadingAds } = trpc.googleAds.getSummary.useQuery({ period: monitorPeriod as any });
  const { data: trendsRaw } = trpc.googleAds.getTrends.useQuery({ period: monitorPeriod as any });
  const { data: anomalyRaw } = trpc.automations.getAnomalyAlerts.useQuery({ limit: 5 });
  const { data: campaignMetricsRaw } = trpc.googleAds.getCampaignMetrics.useQuery({ period: monitorPeriod as any });
  const notifyOwner = trpc.system.notifyOwner.useMutation();

  const adsSummary = (adsSummaryRaw as any)?.summary;
  const channels = Array.isArray(ga4Channels) ? ga4Channels : (ga4Channels as any)?.channels ?? [];
  const trends = Array.isArray(trendsRaw) ? trendsRaw : (trendsRaw as any)?.trends ?? [];
  const anomalies = Array.isArray(anomalyRaw) ? anomalyRaw : (anomalyRaw as any)?.alerts ?? [];
  const campaigns = Array.isArray(campaignMetricsRaw) ? campaignMetricsRaw : (campaignMetricsRaw as any)?.campaigns ?? [];
  const devices: any[] = (deviceRaw as any)?.devices ?? [];

  const paidChannel = channels.find((c: any) => c.channel === "Google Ads (Pago)");
  const organicChannel = channels.find((c: any) => c.channel === "Orgânico (SEO)");

  const cpa = adsSummary?.totalConversions > 0
    ? adsSummary.totalSpend / adsSummary.totalConversions
    : 0;
  const cpaOk = cpa > 0 && cpa <= 65;

  // ─── isLoaded (definido aqui para evitar referência antes da inicialização) ───
  const isLoaded = !loadingGA4 && !loadingAds;

  // ─── Score de Saúde (0–100) ───────────────────────────────────────────────
  const checklistItems = [
    { ok: cpaOk, weight: 20, label: `CPA ≤ R$65 (atual: ${cpa > 0 ? `R$ ${cpa.toFixed(2)}` : "—"})` },
    { ok: (adsSummary?.totalConversions ?? 0) > 0, weight: 20, label: `Conversões registradas (${adsSummary?.totalConversions ?? 0} no período)` },
    { ok: (ga4Summary?.totalSessions ?? 0) > 0, weight: 15, label: `GA4 recebendo sessões (${ga4Summary?.totalSessions ?? 0} sessões)` },
    { ok: (paidChannel?.sessions ?? 0) > 0, weight: 15, label: `Tráfego pago chegando ao GA4 (${paidChannel?.sessions ?? 0} sessões)` },
    { ok: (organicChannel?.sessions ?? 0) > 0, weight: 10, label: `SEO orgânico ativo (${organicChannel?.sessions ?? 0} sessões)` },
    { ok: anomalies.length === 0, weight: 10, label: `Sem alertas de anomalia (${anomalies.length} alertas)` },
    { ok: (adsSummary?.avgCtr ?? 0) > 0.01, weight: 5, label: `CTR acima de 1% (atual: ${((adsSummary?.avgCtr ?? 0) * 100).toFixed(2)}%)` },
    { ok: ga4Summary?.googleAdsLinked === true, weight: 5, label: "GA4 vinculado ao Google Ads" },
  ];

  const totalWeight = checklistItems.reduce((s, i) => s + i.weight, 0);
  const earnedWeight = checklistItems.filter(i => i.ok).reduce((s, i) => s + i.weight, 0);
  const healthScore = Math.round((earnedWeight / totalWeight) * 100);
  const scoreColor = healthScore >= 80 ? "text-emerald-400" : healthScore >= 60 ? "text-yellow-400" : "text-red-400";
  const scoreBg = healthScore >= 80 ? "bg-emerald-500/10 border-emerald-500/30" : healthScore >= 60 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-red-500/10 border-red-500/30";

  // ─── Alerta visual quando score < 90 ────────────────────────────────────
  const scoreBelow90 = isLoaded && healthScore < 90;

  // ─── Anomalias Recentes: métricas inesperadas ────────────────────────────
  const unexpectedMetrics = [
    ...(cpa > 0 && cpa > 65 ? [{ type: "warning", label: "CPA acima do alvo", detail: `R$ ${cpa.toFixed(2)} (alvo: R$ 65,00)`, icon: "\uD83D\uDCB8" }] : []),
    ...(cpa > 0 && cpa < 20 ? [{ type: "info", label: "CPA excepcionalmente baixo", detail: `R$ ${cpa.toFixed(2)} — verificar qualidade das conversões`, icon: "\uD83D\uDCC9" }] : []),
    ...((adsSummary?.avgCtr ?? 0) > 0 && (adsSummary?.avgCtr ?? 0) * 100 > 20 ? [{ type: "info", label: "CTR muito alto", detail: `${((adsSummary?.avgCtr ?? 0) * 100).toFixed(2)}% — verificar segmentação`, icon: "\uD83D\uDE80" }] : []),
    ...((ga4Summary?.totalSessions ?? 0) === 0 && isLoaded ? [{ type: "critical", label: "GA4 sem sessões no período", detail: "Verificar rastreamento e vinculação", icon: "\uD83D\uDEA8" }] : []),
    ...((paidChannel?.sessions ?? 0) === 0 && (adsSummary?.totalClicks ?? 0) > 0 ? [{ type: "warning", label: "Cliques Google Ads sem sessões GA4", detail: "Possível falha de rastreamento nas landing pages", icon: "\u26A0" }] : []),
    ...(anomalies.filter((a: any) => a.severity === "critical").map((a: any) => ({ type: "critical", label: a.title ?? "Anomalia crítica", detail: a.message ?? "", icon: "\uD83D\uDD34" }))),
    ...(anomalies.filter((a: any) => a.severity === "warning").map((a: any) => ({ type: "warning", label: a.title ?? "Anomalia", detail: a.message ?? "", icon: "\uD83D\uDFE1" }))),
  ];

  // ─── Histórico de problemas e soluções do GA4 ────────────────────────────
  const ga4ProblemHistory = [
    { date: "13/04/2026", problem: "Service Account com permissão insuficiente (Visualizador)", solution: "Elevada para Editor manualmente no painel GA4 (Admin → Gerenciamento de acesso)", status: "resolvido" },
    { date: "07/04/2026", problem: "GA4 não vinculado ao Google Ads — conversões sem atribuição", solution: "Vinculação ativada em GA4 → Admin → Vinculações de produtos → Google Ads", status: "resolvido" },
    { date: "05/04/2026", problem: "Conversões whatsapp_click não importadas no Google Ads", solution: "Importadas via Google Ads → Metas → Conversões → Importar do GA4", status: "resolvido" },
    { date: "02/04/2026", problem: "Dados GA4 retornando isReal: false no dashboard", solution: "GA4_SERVICE_ACCOUNT_JSON e GA4_PROPERTY_ID configurados como secrets", status: "resolvido" },
  ];

  // ─── Exportação PDF/CSV ────────────────────────────────────────────────────
  const exportMonitoramentoCSV = () => {
    const rows = [
      ["Métrica", "Valor", "Status"],
      ["Score de Saúde", `${healthScore}/100`, healthScore >= 80 ? "Excelente" : healthScore >= 60 ? "Atenção" : "Crítico"],
      ["CPA (7d)", cpa > 0 ? `R$ ${cpa.toFixed(2)}` : "N/A", cpaOk ? "OK" : "Acima do alvo"],
      ["Sessões GA4 (7d)", String(ga4Summary?.totalSessions ?? 0), (ga4Summary?.totalSessions ?? 0) > 0 ? "OK" : "Sem dados"],
      ["Conversões GA4 (7d)", String(ga4Summary?.conversions ?? 0), (ga4Summary?.conversions ?? 0) > 0 ? "OK" : "Sem dados"],
      ["Cliques Google Ads (7d)", String(adsSummary?.totalClicks ?? 0), "—"],
      ["Conversões Google Ads (7d)", String(adsSummary?.totalConversions ?? 0), (adsSummary?.totalConversions ?? 0) > 0 ? "OK" : "Sem conversões"],
      ["Gasto Google Ads (7d)", `R$ ${(adsSummary?.totalSpend ?? 0).toFixed(2)}`, "—"],
      ["CTR Médio", `${((adsSummary?.avgCtr ?? 0) * 100).toFixed(2)}%`, (adsSummary?.avgCtr ?? 0) > 0.01 ? "OK" : "Baixo"],
      ["GA4 Vinculado ao Google Ads", ga4Summary?.googleAdsLinked ? "Sim" : "Não", ga4Summary?.googleAdsLinked ? "OK" : "Verificar"],
      ["Anomalias Ativas", String(anomalies.length), anomalies.length === 0 ? "OK" : "Atenção"],
      ["Data do Relatório", new Date().toLocaleString("pt-BR"), "—"],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoramento-diario-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // ─── Sistema de alertas por e-mail quando score < 70 ─────────────────────
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(() => {
    const stored = localStorage.getItem("monitoramento_email_alerts");
    return stored !== null ? stored === "true" : true;
  });
  const [lastAlertSent, setLastAlertSent] = useState<string | null>(() =>
    localStorage.getItem("monitoramento_last_alert_sent")
  );
  const [alertSending, setAlertSending] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);

  const toggleEmailAlerts = () => {
    const next = !emailAlertsEnabled;
    setEmailAlertsEnabled(next);
    localStorage.setItem("monitoramento_email_alerts", String(next));
  };

  // ─── Alertas automáticos para anomalias críticas ─────────────────────────
  const [anomalyAlertsEnabled, setAnomalyAlertsEnabled] = useState(() => {
    const stored = localStorage.getItem("monitoramento_anomaly_alerts");
    return stored !== null ? stored === "true" : true;
  });
  const [lastAnomalyAlertSent, setLastAnomalyAlertSent] = useState<string | null>(() =>
    localStorage.getItem("monitoramento_last_anomaly_alert")
  );
  const [anomalyAlertFeedback, setAnomalyAlertFeedback] = useState<string | null>(null);

  const toggleAnomalyAlerts = () => {
    const next = !anomalyAlertsEnabled;
    setAnomalyAlertsEnabled(next);
    localStorage.setItem("monitoramento_anomaly_alerts", String(next));
  };

  // isLoaded já declarado acima (movido para antes das primeiras utilizações)
  useEffect(() => {
    if (!isLoaded || !emailAlertsEnabled || healthScore >= 70) return;
    const now = Date.now();
    const lastSent = lastAlertSent ? parseInt(lastAlertSent) : 0;
    const sixHours = 6 * 60 * 60 * 1000;
    if (now - lastSent < sixHours) return;

    const problemItems = checklistItems.filter(i => !i.ok).map(i => `• ${i.label}`).join("\n");
    const content = `🚨 Score de Saúde da Campanha: ${healthScore}/100 (abaixo de 70)\n\nProblemas identificados:\n${problemItems}\n\nAcesse o dashboard para tomar ação: social-ads.zenitetech.com/monitoramento-diario`;

    notifyOwner.mutate(
      { title: `⚠️ Alerta: Score de Saúde ${healthScore}/100`, content },
      {
        onSuccess: () => {
          const ts = String(Date.now());
          setLastAlertSent(ts);
          localStorage.setItem("monitoramento_last_alert_sent", ts);
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, healthScore, emailAlertsEnabled]);

  // Alerta automático para anomalias críticas (imediato, 1x por hora por anomalia)
  const criticalAnomalies = anomalies.filter((a: any) => a.severity === "critical");
  useEffect(() => {
    if (!isLoaded || !anomalyAlertsEnabled || criticalAnomalies.length === 0) return;
    const now = Date.now();
    const lastSent = lastAnomalyAlertSent ? parseInt(lastAnomalyAlertSent) : 0;
    const oneHour = 60 * 60 * 1000;
    if (now - lastSent < oneHour) return;

    const anomalyList = criticalAnomalies.map((a: any) => `🔴 ${a.title ?? "Anomalia crítica"}: ${a.message ?? ""}`).join("\n");
    const content = `🚨 ${criticalAnomalies.length} anomalia(s) crítica(s) detectada(s) no monitoramento diário:\n\n${anomalyList}\n\nScore de Saúde atual: ${healthScore}/100\n\nAcesse: social-ads.zenitetech.com/monitoramento-diario`;

    notifyOwner.mutate(
      { title: `🚨 ${criticalAnomalies.length} Anomalia(s) Crítica(s) Detectada(s)`, content },
      {
        onSuccess: () => {
          const ts = String(Date.now());
          setLastAnomalyAlertSent(ts);
          localStorage.setItem("monitoramento_last_anomaly_alert", ts);
          setAnomalyAlertFeedback(`✅ Alerta de anomalia enviado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
          setTimeout(() => setAnomalyAlertFeedback(null), 5000);
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, criticalAnomalies.length, anomalyAlertsEnabled]);

  const sendManualAlert = async () => {
    setAlertSending(true);
    setAlertFeedback(null);
    const problemItems = checklistItems.filter(i => !i.ok).map(i => `• ${i.label}`).join("\n");
    const content = `📊 Relatório Manual de Saúde — Score: ${healthScore}/100\n\n${problemItems.length > 0 ? `Problemas:\n${problemItems}` : "✅ Todos os indicadores estão OK."}\n\nAcesse: social-ads.zenitetech.com/monitoramento-diario`;
    notifyOwner.mutate(
      { title: `📊 Relatório de Saúde Manual — Score ${healthScore}/100`, content },
      {
        onSuccess: (ok) => {
          setAlertFeedback(ok ? "✅ Notificação enviada com sucesso!" : "❌ Falha ao enviar — tente novamente.");
          setAlertSending(false);
          setTimeout(() => setAlertFeedback(null), 4000);
        },
        onError: () => {
          setAlertFeedback("❌ Erro ao enviar notificação.");
          setAlertSending(false);
          setTimeout(() => setAlertFeedback(null), 4000);
        },
      }
    );
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-500" />
              Monitoramento Diário
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 capitalize">
              {dateStr} · {timeStr} · Últimos 7 dias
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge ok={!loadingGA4 && !!ga4Summary} label="GA4 Online" />
            <StatusBadge ok={!loadingAds && !!adsSummary} label="Google Ads Online" />
            <div className="flex items-center gap-1 bg-slate-800/50 border border-slate-700/50 rounded-lg p-0.5">
              {MONITOR_PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMonitorPeriod(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    monitorPeriod === opt.value
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Filtro País GA4 */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {(["brazil", "all", "others"] as const).map(f => (
                <button key={f} onClick={() => setCountryFilter(f)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    countryFilter === f ? "bg-blue-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"
                  }`}>
                  {f === "all" ? "🌐 Global" : f === "brazil" ? "🇧🇷 Brasil" : "🌍 Outros"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card de Status GA4 */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-foreground">Status da Integração GA4 — Confirmado em 13/04/2026</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-card border border-border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-muted-foreground font-medium">Property GA4</span>
              </div>
              <p className="text-xs font-bold text-foreground">G-XN8107LBV6</p>
              <p className="text-xs text-muted-foreground">ID: 531461479</p>
              <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle className="w-3 h-3" /> Ativo
              </span>
            </div>
            <div className="rounded-lg bg-card border border-border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Link2 className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs text-muted-foreground font-medium">Vinculação Google Ads</span>
              </div>
              <p className="text-xs font-bold text-foreground">Zênite Tech</p>
              <p className="text-xs text-muted-foreground">Ativa desde 07/04/2026</p>
              <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle className="w-3 h-3" /> Vinculada
              </span>
            </div>
            <div className="rounded-lg bg-card border border-border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs text-muted-foreground font-medium">Service Account</span>
              </div>
              <p className="text-xs font-bold text-foreground">ga4-analytics-reader</p>
              <p className="text-xs text-muted-foreground">Permissão: Editor</p>
              <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle className="w-3 h-3" /> Configurada
              </span>
            </div>
            <div className="rounded-lg bg-card border border-border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-pink-400" />
                <span className="text-xs text-muted-foreground font-medium">Conversões Ativas</span>
              </div>
              <p className="text-xs font-bold text-foreground">whatsapp_click</p>
              <p className="text-xs text-muted-foreground">+ generate_lead</p>
              <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle className="w-3 h-3" /> Fluindo
              </span>
            </div>
          </div>
        </div>

        {/* Score de Saúde + Alertas por e-mail */}
        <div className={`rounded-xl border ${scoreBg} p-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className={`text-5xl font-black ${scoreColor}`}>{healthScore}</p>
                <p className="text-xs text-muted-foreground font-medium">/ 100</p>
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Score de Saúde da Campanha</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {healthScore >= 80 ? "✅ Excelente — campanha saudável" : healthScore >= 60 ? "⚠️ Atenção — alguns indicadores precisam de ajuste" : "🚨 Crítico — ação imediata necessária"}
                </p>
                {lastAlertSent && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Último alerta enviado: {new Date(parseInt(lastAlertSent)).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={toggleEmailAlerts}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${emailAlertsEnabled ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25" : "bg-muted border-border text-muted-foreground hover:bg-muted/80"}`}
              >
                {emailAlertsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                {emailAlertsEnabled ? "Alertas Ativos (score < 70)" : "Alertas Desativados"}
              </button>
              <button
                onClick={sendManualAlert}
                disabled={alertSending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25 disabled:opacity-50 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                {alertSending ? "Enviando..." : "Enviar Relatório Agora"}
              </button>
            </div>
          </div>
          {alertFeedback && (
            <div className="mt-3 text-xs font-medium text-foreground bg-muted rounded-lg px-3 py-2">
              {alertFeedback}
            </div>
          )}
        </div>

        {/* Painel de Status Rápido */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            {
              label: "Cliques (7d)",
              value: adsSummary?.totalClicks?.toLocaleString("pt-BR") ?? "—",
              icon: MousePointerClick,
              color: "text-blue-400",
              border: "border-blue-500/30",
              loading: loadingAds,
            },
            {
              label: "Conversões (7d)",
              value: adsSummary?.totalConversions?.toLocaleString("pt-BR") ?? "—",
              icon: Target,
              color: "text-orange-400",
              border: "border-orange-500/30",
              loading: loadingAds,
            },
            {
              label: "Gasto (7d)",
              value: adsSummary?.totalSpend ? `R$ ${adsSummary.totalSpend.toFixed(0)}` : "—",
              icon: DollarSign,
              color: "text-violet-400",
              border: "border-violet-500/30",
              loading: loadingAds,
            },
            {
              label: "CPA (7d)",
              value: cpa > 0 ? `R$ ${cpa.toFixed(2)}` : "—",
              icon: cpaOk ? CheckCircle : AlertTriangle,
              color: cpaOk ? "text-emerald-400" : "text-red-400",
              border: cpaOk ? "border-emerald-500/30" : "border-red-500/30",
              loading: loadingAds,
            },
            {
              label: "Sessões GA4 (7d)",
              value: ga4Summary?.totalSessions?.toLocaleString("pt-BR") ?? "—",
              icon: Users,
              color: "text-cyan-400",
              border: "border-cyan-500/30",
              loading: loadingGA4,
            },
            {
              label: "Conv. GA4 (7d)",
              value: ga4Summary?.conversions?.toLocaleString("pt-BR") ?? "—",
              icon: TrendingUp,
              color: "text-pink-400",
              border: "border-pink-500/30",
              loading: loadingGA4,
            },
          ].map(({ label, value, icon: Icon, color, border, loading }) => (
            <div key={label} className={`rounded-xl border ${border} bg-card p-3`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground font-medium leading-tight">{label}</span>
                <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
              </div>
              {loading ? (
                <div className="h-6 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Gráfico de Tendência + Pizza de Dispositivos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Tendência 7 dias */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" /> Evolução dos Últimos 7 Dias — Google Ads
            </h2>
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line yAxisId="left" type="monotone" dataKey="clicks" name="Cliques" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="conversions" name="Conversões" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                Sem dados de tendência para o período
              </div>
            )}
          </div>

          {/* Pizza de Dispositivos */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-violet-400" /> Sessões por Dispositivo
            </h2>
            {devices.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={devices}
                      dataKey="sessions"
                      nameKey="device"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {devices.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color ?? DEVICE_COLORS[index % DEVICE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                      formatter={(value: any, name: any) => [`${value} sessões`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {devices.map((d: any, i: number) => (
                    <div key={d.device} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color ?? DEVICE_COLORS[i % DEVICE_COLORS.length] }} />
                        <span className="text-foreground">{d.device}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{d.sessions} sess.</span>
                        <span className="font-semibold" style={{ color: d.color ?? DEVICE_COLORS[i % DEVICE_COLORS.length] }}>{d.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                {!(deviceRaw as any)?.isReal && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">* Dados estimados (GA4 API não configurada)</p>
                )}
              </>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
                Carregando...
              </div>
            )}
          </div>
        </div>

        {/* Canais GA4 + Campanhas lado a lado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Canais GA4 */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-400" /> Canais de Tráfego — GA4 (7d)
            </h2>
            <div className="space-y-2">
              {channels.map((c: any) => (
                <div key={c.channel} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color ?? "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="font-medium text-foreground truncate">{c.channel}</span>
                      <span className="text-muted-foreground ml-2 flex-shrink-0">{c.sessions} sess.</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.color ?? "#94a3b8" }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-bold ${c.conversions > 0 ? "text-orange-400" : "text-muted-foreground"}`}>{c.conversions} conv.</span>
                    <p className="text-xs text-muted-foreground">{c.conversionRate?.toFixed(1)}% CVR</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Campanhas Google Ads */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" /> Campanhas Google Ads (7d)
            </h2>
            <div className="space-y-3">
              {campaigns.map((camp: any) => {
                const campCpa = camp.conversions > 0 ? camp.spend / camp.conversions : 0;
                const campCpaOk = campCpa > 0 && campCpa <= 65;
                return (
                  <div key={camp.campaignId ?? camp.name} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground truncate">{camp.name}</span>
                      <StatusBadge ok={camp.status === "ENABLED"} label={camp.status === "ENABLED" ? "Ativa" : "Pausada"} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Cliques</p>
                        <p className="font-bold text-blue-400">{camp.clicks}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Conv.</p>
                        <p className="font-bold text-orange-400">{camp.conversions}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">CPA</p>
                        <p className={`font-bold ${campCpaOk ? "text-emerald-400" : campCpa > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                          {campCpa > 0 ? `R$ ${campCpa.toFixed(0)}` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Alertas de Anomalia */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> Alertas Recentes de Anomalia
          </h2>
          {anomalies.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle className="w-4 h-4" /> Nenhum alerta ativo — tudo dentro do esperado.
            </div>
          ) : (
            <div className="space-y-2">
              {anomalies.slice(0, 5).map((a: any, i: number) => (
                <div key={i} className={`rounded-lg border p-3 ${a.severity === "critical" ? "bg-red-500/10 border-red-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-xs font-semibold ${a.severity === "critical" ? "text-red-400" : "text-yellow-400"}`}>
                        {a.title ?? a.metric ?? "Anomalia detectada"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.message ?? a.description ?? JSON.stringify(a)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString("pt-BR") : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checklist de Monitoramento Diário */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> Checklist de Monitoramento Diário
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {checklistItems.map(({ ok, label }, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-lg p-2 ${ok ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                {ok
                  ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                }
                <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerta Score < 90 */}
        {scoreBelow90 && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 flex items-start gap-3">
            <Zap className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-400">Score de Saúde abaixo de 90% — {healthScore}/100</p>
              <p className="text-xs text-muted-foreground mt-1">
                {checklistItems.filter(i => !i.ok).map(i => i.label).join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Acesse o painel de saúde acima para ver os detalhes e tomar ação.</p>
            </div>
          </div>
        )}

        {/* Anomalias Recentes — Métricas Inesperadas */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-400" /> Anomalias Recentes — Métricas Inesperadas
            </h2>
            <div className="flex items-center gap-2">
              {anomalyAlertFeedback && (
                <span className="text-xs text-emerald-400">{anomalyAlertFeedback}</span>
              )}
              <button
                onClick={toggleAnomalyAlerts}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  anomalyAlertsEnabled
                    ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
                    : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {anomalyAlertsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                {anomalyAlertsEnabled ? `Alerta Crítico Ativo (${criticalAnomalies.length} crítico${criticalAnomalies.length !== 1 ? "s" : ""})` : "Alertas Desativados"}
              </button>
              <span className="text-xs text-muted-foreground">{unexpectedMetrics.length} ocorrências</span>
            </div>
          </div>
          {unexpectedMetrics.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle className="w-4 h-4" /> Nenhuma anomalia detectada — todas as métricas dentro do esperado.
            </div>
          ) : (
            <div className="space-y-2">
              {unexpectedMetrics.map((m, i) => (
                <div key={i} className={`rounded-lg border p-3 flex items-start gap-3 ${
                  m.type === "critical" ? "bg-red-500/10 border-red-500/30" :
                  m.type === "warning" ? "bg-yellow-500/10 border-yellow-500/30" :
                  "bg-blue-500/10 border-blue-500/30"
                }`}>
                  <span className="text-base">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${
                      m.type === "critical" ? "text-red-400" :
                      m.type === "warning" ? "text-yellow-400" : "text-blue-400"
                    }`}>{m.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.detail}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    m.type === "critical" ? "bg-red-500/20 text-red-400" :
                    m.type === "warning" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-blue-500/20 text-blue-400"
                  }`}>
                    {m.type === "critical" ? "Crítico" : m.type === "warning" ? "Atenção" : "Info"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Histórico de Problemas e Soluções do GA4 */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-violet-400" /> Histórico de Problemas e Soluções — GA4
            </h2>
            <span className="text-xs text-muted-foreground">{ga4ProblemHistory.length} registros</span>
          </div>
          <div className="space-y-3">
            {ga4ProblemHistory.map((entry, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                  {i < ga4ProblemHistory.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                </div>
                <div className="pb-3 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">{entry.date}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">Resolvido</span>
                  </div>
                  <p className="text-xs font-medium text-foreground">{entry.problem}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">✅ {entry.solution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé com exportação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Dados reais · GA4 API + Google Ads API · Atualizado em {new Date().toLocaleString("pt-BR")}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={exportMonitoramentoCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 rounded-lg border border-border transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Exportar PDF
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
