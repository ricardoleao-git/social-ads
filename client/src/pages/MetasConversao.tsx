import DashboardLayout from "@/components/DashboardLayout";
import ResolvedAlertsHistory from "@/components/ResolvedAlertsHistory";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import {
  Target, TrendingUp, TrendingDown, CheckCircle, AlertTriangle,
  Calendar, Edit2, Save, X, DollarSign, Zap, PieChart as PieIcon, History,
  Download, HelpCircle, ChevronDown, ChevronUp, Loader2, Bell, Filter
} from "lucide-react";
import { useState, useEffect } from "react";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface ConversionGoal {
  id: string;
  name: string;
  monthly: number;
  cpaTarget: number;
  color: string;
}

interface WeeklyProgress {
  week: string;
  realizado: number;
  esperado: number;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const GOAL_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

const DEFAULT_GOALS: ConversionGoal[] = [
  { id: "wallbox", name: "Wallbox / Recarga Elétrica", monthly: 20, cpaTarget: 65, color: "#3b82f6" },
  { id: "guardia", name: "GuardIA / Segurança", monthly: 15, cpaTarget: 80, color: "#10b981" },
  { id: "conciergia", name: "ConciergIA / WhatsApp", monthly: 10, cpaTarget: 90, color: "#f59e0b" },
  { id: "ponto", name: "Relógio de Ponto", monthly: 8, cpaTarget: 70, color: "#8b5cf6" },
];

const STORAGE_KEY = "zenite_conversion_goals_v1";

// ─── Exportação CSV ────────────────────────────────────────────────────────────

function exportGoalsCSV(
  goals: ConversionGoal[],
  campaigns: any[],
  totalConversions: number,
  totalSpend: number
) {
  const headers = ["Produto / Grupo", "Meta Mensal (conv.)", "CPA Alvo (R$)", "Realizado", "Progresso (%)", "CPA Estimado (R$)"];
  const rows = goals.map(g => {
    const matched = campaigns.find((c: any) =>
      c.name?.toLowerCase().includes(g.id) ||
      c.name?.toLowerCase().includes(g.name.split("/")[0].trim().toLowerCase())
    );
    const realized = matched?.conversions ?? 0;
    const pct = g.monthly > 0 ? Math.round((realized / g.monthly) * 100) : 0;
    const cpaEst = realized > 0 && totalConversions > 0
      ? ((totalSpend * realized) / totalConversions / realized).toFixed(2)
      : "N/A";
    return [g.name, g.monthly, g.cpaTarget, realized, `${pct}%`, cpaEst];
  });
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `metas-conversao-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDaysInMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function getDayOfMonth(): number {
  return new Date().getDate();
}

function getMonthLabel(): string {
  return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function buildWeeklyExpected(monthlyGoal: number): WeeklyProgress[] {
  const daysInMonth = getDaysInMonth();
  const today = getDayOfMonth();
  const weeks = Math.ceil(daysInMonth / 7);
  const perDay = monthlyGoal / daysInMonth;

  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = i * 7 + 1;
    const weekEnd = Math.min((i + 1) * 7, daysInMonth);
    const daysInWeek = weekEnd - weekStart + 1;
    const esperado = Math.round(perDay * daysInWeek);
    // Progresso real estimado com base nos dias decorridos
    const daysElapsed = Math.max(0, Math.min(today - weekStart + 1, daysInWeek));
    const realizadoFraction = today >= weekStart ? daysElapsed / daysInWeek : 0;
    return {
      week: `Sem ${i + 1}`,
      esperado,
      realizado: 0, // será preenchido com dados reais
      _fraction: realizadoFraction,
      _daysInWeek: daysInWeek,
    } as any;
  });
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function MetasConversao() {
  // Metas de conversão lidas do banco de dados (não mais localStorage)
  const { data: goalsData, refetch: refetchGoals } = trpc.conversionGoals.list.useQuery();
  const updateGoalMutation = trpc.conversionGoals.update.useMutation({ onSuccess: () => refetchGoals() });
  const resetGoalsMutation = trpc.conversionGoals.reset.useMutation({ onSuccess: () => refetchGoals() });
  const goals: ConversionGoal[] = (goalsData ?? DEFAULT_GOALS).map((g: any) => ({
    id: g.id ?? g.goalId,
    name: g.name,
    monthly: g.monthly,
    cpaTarget: g.cpaTarget,
    color: g.color,
  }));
  const [editingGoal, setEditingGoal] = useState<ConversionGoal | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ monthly: 0, cpaTarget: 0 });
  const [showHelp, setShowHelp] = useState(false);
  const [period, setPeriod] = useState<"7d" | "14d" | "30d" | "90d">("30d");
  const [dismissedNotifs, setDismissedNotifs] = useState<string[]>([]);

  // Dados reais do Google Ads — usa o período selecionado
  const { data: adsSummaryRaw, isLoading: loadingAds } = trpc.googleAds.getSummary.useQuery({ period: period as any });
  const { data: campaignMetricsRaw } = trpc.googleAds.getCampaignMetrics.useQuery({ period: period as any });
  // Tendência diária para gráfico de CPA (sempre 30 dias)
  const { data: trendsRaw, isLoading: loadingTrends } = trpc.googleAds.getTrends.useQuery({ period: "30d" });

  const adsSummary = (adsSummaryRaw as any)?.summary;
  const campaigns = Array.isArray(campaignMetricsRaw) ? campaignMetricsRaw : (campaignMetricsRaw as any)?.campaigns ?? [];

  const totalConversions = adsSummary?.totalConversions ?? 0;
  const totalSpend = adsSummary?.totalSpend ?? 0;
  const totalGoal = goals.reduce((s, g) => s + g.monthly, 0);
  const pctAchieved = totalGoal > 0 ? Math.round((totalConversions / totalGoal) * 100) : 0;
  const daysInMonth = getDaysInMonth();
  const dayOfMonth = getDayOfMonth();
  const daysRemaining = daysInMonth - dayOfMonth;
  const dailyRate = dayOfMonth > 0 ? totalConversions / dayOfMonth : 0;
  const projection = Math.round(dailyRate * daysInMonth);
  const cpaActual = totalConversions > 0 ? totalSpend / totalConversions : 0;

  // Progresso semanal estimado
  const weeklyData: WeeklyProgress[] = buildWeeklyExpected(totalGoal).map((w: any, i) => {
    const weekStart = i * 7 + 1;
    const weekEnd = Math.min((i + 1) * 7, daysInMonth);
    const daysElapsed = Math.max(0, Math.min(dayOfMonth - weekStart + 1, weekEnd - weekStart + 1));
    const weeklyRate = dayOfMonth > 0 ? (totalConversions / dayOfMonth) : 0;
    return {
      week: w.week,
      esperado: w.esperado,
      realizado: dayOfMonth >= weekStart ? Math.round(weeklyRate * daysElapsed) : 0,
    };
  });

  function openEdit(goal: ConversionGoal) {
    setEditingGoal(goal);
    setEditForm({ monthly: goal.monthly, cpaTarget: goal.cpaTarget });
    setShowEditModal(true);
  }

  function saveEdit() {
    if (!editingGoal) return;
    updateGoalMutation.mutate({
      goalId: editingGoal.id,
      monthly: editForm.monthly,
      cpaTarget: editForm.cpaTarget,
    });
    setShowEditModal(false);
  }

  function resetGoals() {
    resetGoalsMutation.mutate();
  }

  const statusColor = pctAchieved >= 90 ? "text-emerald-400" : pctAchieved >= 60 ? "text-yellow-400" : "text-red-400";
  const statusBg = pctAchieved >= 90 ? "border-emerald-500/30 bg-emerald-500/5" : pctAchieved >= 60 ? "border-yellow-500/30 bg-yellow-500/5" : "border-red-500/30 bg-red-500/5";

  // Notificações visuais de meta
  const notifications: { id: string; type: "success" | "warning" | "info"; msg: string }[] = [];
  if (!loadingAds) {
    if (pctAchieved >= 100) {
      notifications.push({ id: "meta100", type: "success", msg: `Meta mensal atingida! ${totalConversions} de ${totalGoal} conversões (${pctAchieved}%).` });
    } else if (pctAchieved >= 80) {
      notifications.push({ id: "meta80", type: "warning", msg: `Você está a ${100 - pctAchieved}% de atingir a meta mensal. Faltam ${totalGoal - totalConversions} conversões.` });
    }
    if (cpaActual > 0 && cpaActual > 90) {
      notifications.push({ id: "cpaHigh", type: "warning", msg: `CPA atual R$ ${cpaActual.toFixed(2)} está acima do limite recomendado de R$ 90. Revise os grupos com menor desempenho.` });
    }
    goals.forEach(g => {
      const matched = campaigns.find((c: any) =>
        c.name?.toLowerCase().includes(g.id) ||
        c.name?.toLowerCase().includes(g.name.split("/")[0].trim().toLowerCase())
      );
      const realized = matched?.conversions ?? 0;
      const pct = g.monthly > 0 ? Math.round((realized / g.monthly) * 100) : 0;
      if (pct >= 100) {
        notifications.push({ id: `goal_${g.id}_100`, type: "success", msg: `Meta de ${g.name.split("/")[0].trim()} atingida! (${realized}/${g.monthly} conversões)` });
      } else if (pct >= 80) {
        notifications.push({ id: `goal_${g.id}_80`, type: "info", msg: `${g.name.split("/")[0].trim()} está em ${pct}% da meta — faltam apenas ${g.monthly - realized} conversões.` });
      }
    });
  }
  const activeNotifs = notifications.filter(n => !dismissedNotifs.includes(n.id));

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-400" />
              Metas de Conversão
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Progresso mensal — {getMonthLabel()} · Dia {dayOfMonth}/{daysInMonth} · {daysRemaining} dias restantes
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Filtro de período */}
            <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg p-0.5">
              <Filter className="w-3 h-3 text-muted-foreground ml-1.5" />
              {(["7d", "14d", "30d", "90d"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    period === p
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "7d" ? "7 dias" : p === "14d" ? "14 dias" : p === "30d" ? "30 dias" : "90 dias"}
                </button>
              ))}
            </div>
            <button
              onClick={() => exportGoalsCSV(goals, campaigns, totalConversions, totalSpend)}
              disabled={loadingAds}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
            <button
              onClick={() => setShowHelp(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Ajuda
            </button>
            <button
              onClick={resetGoals}
              className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Restaurar Padrão
            </button>
          </div>
        </div>

        {/* Painel de Notificações Visuais de Meta */}
        {activeNotifs.length > 0 && (
          <div className="space-y-2">
            {activeNotifs.map(n => (
              <div
                key={n.id}
                className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${
                  n.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : n.type === "warning"
                    ? "bg-yellow-500/10 border-yellow-500/30"
                    : "bg-blue-500/10 border-blue-500/30"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Bell className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    n.type === "success" ? "text-emerald-400" : n.type === "warning" ? "text-yellow-400" : "text-blue-400"
                  }`} />
                  <span className={`text-sm ${
                    n.type === "success" ? "text-emerald-700 dark:text-emerald-300" : n.type === "warning" ? "text-yellow-700 dark:text-yellow-300" : "text-blue-700 dark:text-blue-300"
                  }`}>{n.msg}</span>
                </div>
                <button
                  onClick={() => setDismissedNotifs(prev => [...prev, n.id])}
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                  title="Dispensar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Painel de Ajuda */}
        {showHelp && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400" />
                Guia de Métricas — Metas de Conversão
              </h2>
              <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {[
                {
                  term: "Conversões Realizadas",
                  def: "Número total de ações de conversão registradas no Google Ads no período selecionado. Inclui whatsapp_click e generate_lead.",
                  tip: "Dica: Se o número estiver abaixo do esperado, verifique se os eventos de conversão estão ativos no GA4 e se o rastreamento de conversões está importado no Google Ads.",
                  example: "Ex.: 28 conversões em 30 dias = média de 0,93/dia. Para meta de 40, seria necessário 1,33/dia.",
                },
                {
                  term: "% Atingido",
                  def: "Percentual da meta mensal total já alcançado. Calculado como (Conversões Realizadas / Meta Mensal Total) × 100.",
                  tip: "Dica: Abaixo de 60% no meio do mês é sinal de alerta. Acima de 80% indica que a meta será atingida.",
                  example: "Ex.: 28 conversões com meta de 53 = 52,8% atingido. Necessário acelerar o ritmo.",
                },
                {
                  term: "Projeção Mensal",
                  def: "Estimativa de conversões até o fim do mês, baseada na taxa diária atual (Conversões / Dias Decorridos × Dias no Mês).",
                  tip: "Dica: Se a projeção estiver abaixo da meta, considere aumentar o orçamento diário ou revisar as palavras-chave de maior intenção.",
                  example: "Ex.: 28 conv em 13 dias = 2,15/dia × 30 dias = projeção de 64 conversões no mês.",
                },
                {
                  term: "CPA Atual",
                  def: "Custo por Aquisição real: total investido dividido pelo número de conversões. Quanto menor, mais eficiente a campanha.",
                  tip: "Dica: CPA acima de R$ 90 indica que o custo por lead está alto. Pause palavras-chave genéricas e foque em termos de alta intenção.",
                  example: "Ex.: R$ 1.631 investidos / 28 conv = CPA de R$ 58,27. Dentro da faixa ideal de R$ 50–80.",
                },
                {
                  term: "CPA Alvo",
                  def: "Meta de custo máximo por conversão definida para cada produto/grupo. Serve como referência para avaliar eficiência.",
                  tip: "Dica: Defina o CPA alvo com base no valor do lead para o negócio. Para Wallbox B2B, um CPA de R$ 65 pode ser muito lucrativo se o ticket médio for R$ 3.000+.",
                  example: "Ex.: Wallbox CPA alvo R$ 65, Guardia R$ 80. Grupos acima do alvo devem ter lances reduzidos.",
                },
                {
                  term: "Meta Mensal",
                  def: "Número de conversões esperadas por produto no mês corrente. Pode ser editada clicando em 'Editar' na tabela.",
                  tip: "Dica: Revise as metas mensalmente com base na sazonalidade e no orçamento disponível. Metas irreais desmotivam e distorcem a análise.",
                  example: "Ex.: Se o orçamento mensal é R$ 1.500 e o CPA alvo é R$ 65, a meta realista é ~23 conversões.",
                },
                {
                  term: "Progresso por Produto",
                  def: "Barra visual mostrando quantas conversões foram atribuídas a cada produto em relação à sua meta individual.",
                  tip: "Dica: Produtos com barra vermelha (abaixo de 60%) precisam de atenção. Verifique se o grupo de anúncios está ativo e com orçamento suficiente.",
                  example: "Ex.: Wallbox com 15/20 = 75% (amarelo). Faltam 5 conversões para atingir a meta do produto.",
                },
                {
                  term: "Realizado vs. Esperado",
                  def: "Gráfico semanal comparando conversões efetivas com a distribuição proporcional da meta ao longo do mês (pró-rata).",
                  tip: "Dica: Se o realizado estiver consistentemente abaixo do esperado nas primeiras semanas, é sinal de que o orçamento ou os lances precisam de ajuste.",
                  example: "Ex.: Na Semana 2, esperado = 13 conv, realizado = 8. Gap de 5 conv indica ritmo insuficiente.",
                },
                {
                  term: "Contribuição por Produto",
                  def: "Gráfico de pizza mostrando a participação percentual de cada produto no total de conversões do período.",
                  tip: "Dica: Concentração excessiva em um único produto (>70%) indica dependência. Diversifique os grupos ativos para reduzir risco.",
                  example: "Ex.: Wallbox 54%, Guardia 18%, Outros 28%. Wallbox é o motor principal — garantir orçamento prioritário.",
                },
                {
                  term: "Análise Automática",
                  def: "Insights gerados automaticamente com base nos dados atuais: projeção vs. meta e avaliação do CPA em relação à faixa alvo.",
                  tip: "Dica: Use os insights como ponto de partida para ações. Cada alerta tem uma ação recomendada específica (ajuste de lance, orçamento ou negativos).",
                  example: "Ex.: 'CPA acima de R$ 90' → ação: pausar palavras-chave genéricas e revisar página de destino.",
                },
              ].map(({ term, def, tip, example }) => (
                <div key={term} className="p-3 rounded-lg bg-muted/40 border border-border/50">
                  <p className="font-semibold text-foreground mb-1">{term}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed mb-2">{def}</p>
                  <p className="text-blue-600 dark:text-blue-400 text-xs leading-relaxed mb-1">{tip}</p>
                  <p className="text-muted-foreground/70 text-xs leading-relaxed italic">{example}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Dados originados da API do Google Ads (período selecionado: {period === "7d" ? "7 dias" : period === "14d" ? "14 dias" : period === "30d" ? "30 dias" : "90 dias"}). Atualizado automaticamente ao mudar o filtro de período.
            </p>
          </div>
        )}

        {/* KPIs principais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              icon: <Target className="w-5 h-5 text-blue-400" />,
              label: "Conversões Realizadas",
              value: loadingAds ? "…" : String(totalConversions),
              sub: `Meta: ${totalGoal}`,
              color: "text-blue-400",
            },
            {
              icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
              label: "% Atingido",
              value: loadingAds ? "…" : `${pctAchieved}%`,
              sub: pctAchieved >= 100 ? "Meta atingida!" : `Faltam ${totalGoal - totalConversions}`,
              color: statusColor,
            },
            {
              icon: <Calendar className="w-5 h-5 text-yellow-400" />,
              label: "Projeção Mensal",
              value: loadingAds ? "…" : String(projection),
              sub: projection >= totalGoal ? "Acima da meta" : "Abaixo da meta",
              color: projection >= totalGoal ? "text-emerald-400" : "text-yellow-400",
            },
            {
              icon: <DollarSign className="w-5 h-5 text-violet-400" />,
              label: "CPA Atual",
              value: loadingAds ? "…" : cpaActual > 0 ? `R$ ${cpaActual.toFixed(2)}` : "N/A",
              sub: `Meta média: R$ ${(goals.reduce((s, g) => s + g.cpaTarget, 0) / goals.length).toFixed(0)}`,
              color: "text-violet-400",
            },
          ].map((kpi, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">{kpi.icon}<span className="text-xs text-muted-foreground">{kpi.label}</span></div>
              {loadingAds ? (
                <div className="flex items-center gap-2 py-1">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Carregando...</span>
                </div>
              ) : (
                <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              )}
              <div className="text-xs text-muted-foreground mt-1">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Barra de progresso geral */}
        <div className={`rounded-xl border p-5 ${statusBg}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">Progresso Geral do Mês</span>
            <span className={`text-lg font-bold ${statusColor}`}>{pctAchieved}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(pctAchieved, 100)}%`,
                background: pctAchieved >= 90 ? "#10b981" : pctAchieved >= 60 ? "#f59e0b" : "#ef4444",
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>0</span>
            <span>Meta: {totalGoal} conversões</span>
          </div>
        </div>

        {/* Gráfico semanal */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            Realizado vs Esperado por Semana
            {loadingAds && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
          </h2>
          {loadingAds ? (
            <div className="flex items-center justify-center h-[220px] gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Carregando dados do Google Ads...</span>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <Bar dataKey="esperado" name="Esperado" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="realizado" name="Realizado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
          <p className="text-xs text-muted-foreground mt-2 text-center">
            * Realizado estimado com base na taxa diária atual ({dailyRate.toFixed(1)} conv/dia)
          </p>
        </div>

        {/* Tabela de metas por produto */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Metas por Produto / Grupo
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Clique em Editar para ajustar metas</span>
              <button
                onClick={() => exportGoalsCSV(goals, campaigns, totalConversions, totalSpend)}
                disabled={loadingAds}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
              >
                {loadingAds ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Produto / Grupo</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Meta Mensal</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">CPA Alvo</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Progresso</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((goal, i) => {
                  // Tenta mapear conversões reais por campanha
                  const matchedCampaign = campaigns.find((c: any) =>
                    c.name?.toLowerCase().includes(goal.id) ||
                    c.name?.toLowerCase().includes(goal.name.split("/")[0].trim().toLowerCase())
                  );
                  const realized = matchedCampaign?.conversions ?? 0;
                  const pct = goal.monthly > 0 ? Math.min(Math.round((realized / goal.monthly) * 100), 100) : 0;
                  const isOk = pct >= 80;

                  return (
                    <tr key={goal.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: goal.color }} />
                          <span className="text-foreground font-medium">{goal.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-foreground/80">{goal.monthly} conv.</td>
                      <td className="py-3 px-3 text-right text-foreground/80">R$ {goal.cpaTarget}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full"
                              style={{ width: `${pct}%`, background: isOk ? "#10b981" : "#f59e0b" }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${isOk ? "text-emerald-400" : "text-yellow-400"}`}>
                            {realized}/{goal.monthly}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => openEdit(goal)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="py-3 px-3 text-foreground font-semibold">Total</td>
                  <td className="py-3 px-3 text-right text-foreground font-semibold">{totalGoal} conv.</td>
                  <td className="py-3 px-3 text-right text-muted-foreground">—</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`text-sm font-bold ${statusColor}`}>{pctAchieved}%</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Gráfico de pizza — contribuição por produto */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-violet-400" />
            Contribuição por Produto no Total de Conversões
          </h2>
          {loadingAds ? (
            <div className="flex items-center justify-center h-[220px] gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Carregando dados do Google Ads...</span>
            </div>
          ) : totalConversions === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Sem dados de conversão no período selecionado.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ResponsiveContainer width={220} height={220}>
                <PieChart>
                  <Pie
                    data={goals.map(g => {
                      const matched = campaigns.find((c: any) =>
                        c.name?.toLowerCase().includes(g.id) ||
                        c.name?.toLowerCase().includes(g.name.split("/")[0].trim().toLowerCase())
                      );
                      return { name: g.name.split("/")[0].trim(), value: matched?.conversions ?? 0, color: g.color };
                    }).filter(d => d.value > 0)}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {goals.map((g, i) => <Cell key={i} fill={g.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: number, name: string) => [`${v} conv.`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {goals.map((g, i) => {
                  const matched = campaigns.find((c: any) =>
                    c.name?.toLowerCase().includes(g.id) ||
                    c.name?.toLowerCase().includes(g.name.split("/")[0].trim().toLowerCase())
                  );
                  const conv = matched?.conversions ?? 0;
                  const pct = totalConversions > 0 ? Math.round((conv / totalConversions) * 100) : 0;
                  return (
                    <div key={g.id} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: g.color }} />
                      <span className="text-sm text-foreground/80 flex-1">{g.name.split("/")[0].trim()}</span>
                      <span className="text-sm font-semibold text-foreground">{conv}</span>
                      <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
                {totalConversions > 0 && (
                  <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                    <div className="w-3 h-3 rounded-full flex-shrink-0 bg-muted-foreground/30" />
                    <span className="text-sm text-muted-foreground flex-1">Outros / Não mapeados</span>
                    <span className="text-sm font-semibold text-muted-foreground">
                      {Math.max(0, totalConversions - goals.reduce((s, g) => {
                        const m = campaigns.find((c: any) =>
                          c.name?.toLowerCase().includes(g.id) ||
                          c.name?.toLowerCase().includes(g.name.split("/")[0].trim().toLowerCase())
                        );
                        return s + (m?.conversions ?? 0);
                      }, 0))}
                    </span>
                    <span className="text-xs text-muted-foreground w-10 text-right">—</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Histórico de alertas de anomalia resolvidos */}
        <ResolvedAlertsHistory />

        {/* Insights automáticos */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Análise Automática
          </h2>
          <div className="space-y-2">
            {projection >= totalGoal ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-emerald-300">
                  Taxa atual de {dailyRate.toFixed(1)} conv/dia projeta {projection} conversões no mês — <strong>acima da meta de {totalGoal}</strong>.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-yellow-300">
                  Taxa atual projeta {projection} conversões — abaixo da meta de {totalGoal}. Necessário {((totalGoal - totalConversions) / Math.max(daysRemaining, 1)).toFixed(1)} conv/dia nos próximos {daysRemaining} dias.
                </span>
              </div>
            )}
            {cpaActual > 0 && (
              <div className={`flex items-start gap-2 p-3 rounded-lg ${cpaActual <= 80 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                <DollarSign className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cpaActual <= 80 ? "text-emerald-400" : "text-red-400"}`} />
                <span className={`text-sm ${cpaActual <= 80 ? "text-emerald-300" : "text-red-300"}`}>
                  CPA atual de R$ {cpaActual.toFixed(2)} está {cpaActual <= 80 ? "dentro" : "acima"} da faixa alvo (R$ 65–90).
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico de linhas — evolução semanal acumulada de conversões */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            Evolução Semanal de Conversões — Realizado vs. Meta
          </h2>
          {loadingAds ? (
            <div className="flex items-center justify-center h-[260px] gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Carregando dados do Google Ads...</span>
            </div>
          ) : weeklyData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Sem dados de tendência disponíveis.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(v: number, name: string) => [`${v} conv.`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                <Line
                  type="monotone" dataKey="realizado" name="Realizado"
                  stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: "#3b82f6" }} activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone" dataKey="esperado" name="Esperado (meta pró-rata)"
                  stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Conversões acumuladas por semana vs. meta pró-rata do mês atual
          </p>
        </div>
        {/* Gráfico de linha — Evolução diária do CPA nos últimos 30 dias */}
        {(() => {
          const trends = Array.isArray((trendsRaw as any)?.trends) ? (trendsRaw as any).trends : [];
          const cpaData = trends
            .filter((t: any) => t.conversions > 0)
            .map((t: any) => ({
              date: t.date ? String(t.date).slice(5) : "", // MM-DD
              cpa: parseFloat((t.costMicros / 1e6 / t.conversions).toFixed(2)),
              conversions: t.conversions,
            }));
          const avgCpa = cpaData.length > 0
            ? cpaData.reduce((s: number, d: any) => s + d.cpa, 0) / cpaData.length
            : 0;
          return (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-violet-400" />
                Evolução Diária do CPA — Últimos 30 Dias
                {loadingTrends && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
              </h2>
              {loadingTrends ? (
                <div className="flex items-center justify-center h-[260px] gap-3 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm">Carregando dados do Google Ads...</span>
                </div>
              ) : cpaData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Sem dados de CPA disponíveis para os últimos 30 dias.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={cpaData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        tickFormatter={(v: number) => `R$${v}`}
                        domain={[0, 'auto']}
                      />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(v: number, name: string) => [`R$ ${v.toFixed(2)}`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                      {/* Linha de referência: CPA alvo médio */}
                      <Line
                        type="monotone" dataKey="cpa" name="CPA Diário"
                        stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: "#8b5cf6" }} activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-between mt-3 px-1">
                    <p className="text-xs text-muted-foreground">
                      CPA médio no período: <span className="font-semibold text-violet-400">R$ {avgCpa.toFixed(2)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      CPA alvo médio: <span className="font-semibold text-foreground">R$ {(goals.reduce((s, g) => s + g.cpaTarget, 0) / goals.length).toFixed(0)}</span>
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Apenas dias com conversões registradas são exibidos. Fonte: Google Ads API.
                  </p>
                </>
              )}
            </div>
          );
        })()}

        {/* Modal de edição */}
        {showEditModal && editingGoal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-foreground font-semibold">Editar Meta</h3>
                <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-muted-foreground text-sm mb-4">{editingGoal.name}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Meta Mensal (conversões)</label>
                  <input
                    type="number"
                    value={editForm.monthly}
                    onChange={e => setEditForm(f => ({ ...f, monthly: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">CPA Alvo (R$)</label>
                  <input
                    type="number"
                    value={editForm.cpaTarget}
                    onChange={e => setEditForm(f => ({ ...f, cpaTarget: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEdit}
                  className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
