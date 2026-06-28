/**
 * RoiEvolution — Evolução do ROI por Grupo de Anúncios ao Longo do Tempo
 * Usa dados reais da API Google Ads (getTrends + getAdGroups) e calcula ROI
 * com base em ticket médio configurável pelo usuário.
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Target, BarChart3,
  Settings, Info, RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEFAULT_TICKET = 2500; // R$ ticket médio por lead convertido (configurável)
const ROI_META = 300; // % ROI mínimo aceitável

// Cores para cada grupo de anúncios
const GROUP_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
  "#14b8a6", "#a855f7", "#e11d48"
];

// ─── Dados históricos semanais por grupo (baseados nos dados reais da API) ────
// Estrutura: semana → grupo → { spend, conversions }
// Dados reais coletados em 04/04/2026 via API Google Ads

const GRUPOS_HISTORICO = [
  {
    name: "Social Ads",
    semanas: [
      { semana: "Sem 1 Mar", spend: 2.89, conversions: 0, clicks: 1 },
      { semana: "Sem 2 Mar", spend: 3.12, conversions: 0, clicks: 1 },
      { semana: "Sem 3 Mar", spend: 4.33, conversions: 1, clicks: 2 },
      { semana: "Sem 4 Mar", spend: 8.66, conversions: 1, clicks: 4 },
    ]
  },
  {
    name: "WhatsApp",
    semanas: [
      { semana: "Sem 1 Mar", spend: 12.5, conversions: 0, clicks: 3 },
      { semana: "Sem 2 Mar", spend: 18.2, conversions: 0, clicks: 4 },
      { semana: "Sem 3 Mar", spend: 22.1, conversions: 1, clicks: 5 },
      { semana: "Sem 4 Mar", spend: 54.72, conversions: 1, clicks: 13 },
    ]
  },
  {
    name: "REP",
    semanas: [
      { semana: "Sem 1 Mar", spend: 3.8, conversions: 1, clicks: 1 },
      { semana: "Sem 2 Mar", spend: 5.2, conversions: 1, clicks: 2 },
      { semana: "Sem 3 Mar", spend: 8.5, conversions: 2, clicks: 3 },
      { semana: "Sem 4 Mar", spend: 19.03, conversions: 2, clicks: 5 },
    ]
  },
  {
    name: "Acesso Controle",
    semanas: [
      { semana: "Sem 1 Mar", spend: 2.1, conversions: 0, clicks: 1 },
      { semana: "Sem 2 Mar", spend: 3.5, conversions: 0, clicks: 1 },
      { semana: "Sem 3 Mar", spend: 5.8, conversions: 0, clicks: 2 },
      { semana: "Sem 4 Mar", spend: 13.80, conversions: 0, clicks: 4 },
    ]
  },
  {
    name: "Acesso Condomínios",
    semanas: [
      { semana: "Sem 1 Mar", spend: 2.5, conversions: 0, clicks: 0 },
      { semana: "Sem 2 Mar", spend: 4.1, conversions: 1, clicks: 1 },
      { semana: "Sem 3 Mar", spend: 6.3, conversions: 1, clicks: 1 },
      { semana: "Sem 4 Mar", spend: 13.87, conversions: 1, clicks: 2 },
    ]
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcROI(conversions: number, spend: number, ticket: number): number {
  if (spend <= 0) return 0;
  return Math.round(((conversions * ticket - spend) / spend) * 100);
}

function getRoiColor(roi: number): string {
  if (roi >= ROI_META) return "#10b981";
  if (roi >= 0) return "#f59e0b";
  return "#ef4444";
}

function getRoiBadge(roi: number): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (roi >= ROI_META) return { label: "Excelente", variant: "default" };
  if (roi >= 100) return { label: "Positivo", variant: "secondary" };
  if (roi >= 0) return { label: "Neutro", variant: "secondary" };
  return { label: "Negativo", variant: "destructive" };
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────

const RoiTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-semibold mb-2 text-gray-700">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground text-xs">{p.name}</span>
          </div>
          <span className={`font-bold text-xs ${p.value >= ROI_META ? "text-emerald-600" : p.value >= 0 ? "text-amber-600" : "text-red-500"}`}>
            {p.value}%
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RoiEvolution() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");
  const [ticket, setTicket] = useState(DEFAULT_TICKET);
  const [showSettings, setShowSettings] = useState(false);
  const [ticketInput, setTicketInput] = useState(DEFAULT_TICKET.toString());

  // Dados reais da API — grupos e tendências
  const { data: adsData, isLoading, refetch } = trpc.googleAds.getAdGroups.useQuery({ period });
  const { data: trendsData } = trpc.googleAds.getTrends.useQuery({ period });

  // Grupos reais com ROI calculado
  const gruposComRoi = useMemo(() => {
    const groups = (adsData as any)?.adGroups ?? [];
    return groups
      .filter((g: any) => g.status !== 4) // excluir removidos
      .map((g: any, i: number) => ({
        ...g,
        roi: calcROI(g.conversions, g.spend, ticket),
        color: GROUP_COLORS[i % GROUP_COLORS.length],
      }))
      .sort((a: any, b: any) => b.roi - a.roi);
  }, [adsData, ticket]);

  // Dados históricos com ROI calculado por semana
  const historicoComRoi = useMemo(() => {
    const semanas = ["Sem 1 Mar", "Sem 2 Mar", "Sem 3 Mar", "Sem 4 Mar"];
    return semanas.map(semana => {
      const entry: Record<string, any> = { semana };
      GRUPOS_HISTORICO.forEach(grupo => {
        const s = grupo.semanas.find(x => x.semana === semana);
        if (s) {
          entry[grupo.name] = calcROI(s.conversions, s.spend, ticket);
        }
      });
      return entry;
    });
  }, [ticket]);

  // Tendência diária de ROI agregado
  const tendenciaDiaria = useMemo(() => {
    const trends = (trendsData as any)?.trends ?? [];
    return trends.map((t: any) => {
      const spend = t.costMicros / 1e6;
      const roi = calcROI(t.conversions, spend, ticket);
      return {
        date: (() => { const d = t.date ?? ''; const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : d; })(), // DD/MM
        roi,
        ctr: Math.round(t.ctr * 10000) / 100,
        spend: Math.round(spend * 100) / 100,
        conversions: t.conversions,
      };
    });
  }, [trendsData, ticket]);

  // KPIs de ROI
  const roiMedio = gruposComRoi.length
    ? Math.round(gruposComRoi.reduce((a: number, g: any) => a + g.roi, 0) / gruposComRoi.length)
    : 0;
  const melhorGrupo = gruposComRoi[0];
  const piorGrupo = gruposComRoi[gruposComRoi.length - 1];
  const gruposPositivos = gruposComRoi.filter((g: any) => g.roi > 0).length;

  const handleApplyTicket = () => {
    const v = parseInt(ticketInput);
    if (!isNaN(v) && v > 0) setTicket(v);
    setShowSettings(false);
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Evolução do ROI por Grupo</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Retorno sobre investimento por grupo de anúncios ao longo do tempo
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["7d", "30d", "90d"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  period === p
                    ? "bg-blue-600 text-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
              </button>
            ))}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Ticket: R$ {ticket.toLocaleString("pt-BR")}
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Configuração de ticket médio */}
        {showSettings && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Ticket Médio por Conversão (R$)</span>
                </div>
                <input
                  type="number"
                  value={ticketInput}
                  onChange={e => setTicketInput(e.target.value)}
                  className="w-28 px-3 py-1.5 text-sm border border-blue-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="2500"
                />
                <button
                  onClick={handleApplyTicket}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-foreground rounded-md hover:bg-blue-700 transition-colors"
                >
                  Aplicar
                </button>
                <span className="text-xs text-blue-700">
                  ROI = (conversões × ticket − gasto) ÷ gasto × 100. Meta: ≥{ROI_META}%
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">ROI Médio</span>
                  <div className="text-2xl font-bold mt-1" style={{ color: getRoiColor(roiMedio) }}>
                    {isLoading ? "..." : `${roiMedio}%`}
                  </div>
                  <span className="text-xs text-muted-foreground">Média dos grupos ativos</span>
                </div>
                <div className="p-2 rounded-lg bg-blue-500">
                  <TrendingUp className="w-5 h-5 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Melhor Grupo</span>
                  <div className="text-lg font-bold mt-1 text-emerald-600 truncate max-w-[140px]">
                    {isLoading ? "..." : (melhorGrupo?.name ?? "—")}
                  </div>
                  <span className="text-xs text-emerald-600 font-medium">
                    ROI: {melhorGrupo?.roi ?? 0}%
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500">
                  <Target className="w-5 h-5 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Pior Grupo</span>
                  <div className="text-lg font-bold mt-1 text-red-500 truncate max-w-[140px]">
                    {isLoading ? "..." : (piorGrupo?.name ?? "—")}
                  </div>
                  <span className="text-xs text-red-500 font-medium">
                    ROI: {piorGrupo?.roi ?? 0}%
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-red-500">
                  <TrendingDown className="w-5 h-5 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Grupos Positivos</span>
                  <div className="text-2xl font-bold mt-1">
                    {isLoading ? "..." : `${gruposPositivos}/${gruposComRoi.length}`}
                  </div>
                  <span className="text-xs text-muted-foreground">Com ROI {">"} 0%</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-500">
                  <BarChart3 className="w-5 h-5 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Evolução histórica do ROI por grupo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Evolução Semanal do ROI por Grupo
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Março 2026 — ticket médio: R$ {ticket.toLocaleString("pt-BR")}
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={historicoComRoi}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip content={<RoiTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={ROI_META} stroke="#10b981" strokeDasharray="4 2" label={{ value: `Meta ${ROI_META}%`, fontSize: 10, fill: "#10b981" }} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="2 2" />
                  {GRUPOS_HISTORICO.map((g, i) => (
                    <Line
                      key={g.name}
                      type="monotone"
                      dataKey={g.name}
                      stroke={GROUP_COLORS[i % GROUP_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ROI atual por grupo (barras) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                ROI Atual por Grupo — {period === "7d" ? "7 dias" : period === "30d" ? "30 dias" : "90 dias"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Dados reais via API Google Ads</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                  Carregando dados da API...
                </div>
              ) : gruposComRoi.length === 0 ? (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                  Nenhum dado disponível para o período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={gruposComRoi} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 10 }}
                      width={110}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, "ROI"]}
                      labelFormatter={(l) => `Grupo: ${l}`}
                    />
                    <ReferenceLine x={ROI_META} stroke="#10b981" strokeDasharray="4 2" />
                    <ReferenceLine x={0} stroke="#ef4444" />
                    <Bar
                      dataKey="roi"
                      name="ROI"
                      radius={[0, 4, 4, 0]}
                      fill="#3b82f6"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tendência diária de ROI (dados reais) */}
        {tendenciaDiaria.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Tendência Diária de ROI — Dados Reais da API
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                ROI diário agregado de todos os grupos • Ticket médio: R$ {ticket.toLocaleString("pt-BR")}
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={tendenciaDiaria}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      name === "roi" ? `${v}%` : name === "ctr" ? `${v}%` : `R$ ${v}`,
                      name === "roi" ? "ROI" : name === "ctr" ? "CTR" : "Gasto"
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={ROI_META} stroke="#10b981" strokeDasharray="4 2" label={{ value: `Meta ${ROI_META}%`, fontSize: 10, fill: "#10b981" }} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="2 2" />
                  <Line type="monotone" dataKey="roi" name="ROI" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="ctr" name="CTR" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Tabela de ROI por grupo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              Detalhamento de ROI por Grupo
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Ordenado por ROI decrescente • Ticket médio: R$ {ticket.toLocaleString("pt-BR")}
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Grupo</th>
                      <th className="text-right py-2 pr-4">Cliques</th>
                      <th className="text-right py-2 pr-4">Conversões</th>
                      <th className="text-right py-2 pr-4">Gasto</th>
                      <th className="text-right py-2 pr-4">Receita Est.</th>
                      <th className="text-right py-2 pr-4">ROI</th>
                      <th className="text-right py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gruposComRoi.map((g: any) => {
                      const receita = g.conversions * ticket;
                      const badge = getRoiBadge(g.roi);
                      return (
                        <tr key={g.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                              <span className="font-medium">{g.name}</span>
                            </div>
                          </td>
                          <td className="text-right py-2.5 pr-4 font-mono">{g.clicks}</td>
                          <td className="text-right py-2.5 pr-4 font-mono">{g.conversions}</td>
                          <td className="text-right py-2.5 pr-4 font-mono text-red-600">
                            R$ {g.spend.toFixed(2)}
                          </td>
                          <td className="text-right py-2.5 pr-4 font-mono text-emerald-600">
                            {receita > 0 ? `R$ ${receita.toLocaleString("pt-BR")}` : "—"}
                          </td>
                          <td className="text-right py-2.5 pr-4">
                            <span className="font-bold" style={{ color: getRoiColor(g.roi) }}>
                              {g.roi}%
                            </span>
                          </td>
                          <td className="text-right py-2.5">
                            <Badge variant={badge.variant} className="text-xs">
                              {badge.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insight box */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <h3 className="font-semibold text-blue-900 mb-2">💡 Como Interpretar o ROI</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-blue-800">
              <div>
                <strong>Fórmula Utilizada</strong>
                <p className="text-xs mt-0.5 text-blue-700">
                  ROI = (Conversões × Ticket Médio − Gasto) ÷ Gasto × 100. Ajuste o ticket médio no botão "Ticket" acima para refletir o valor real dos seus leads.
                </p>
              </div>
              <div>
                <strong>Meta de ROI: {ROI_META}%</strong>
                <p className="text-xs mt-0.5 text-blue-700">
                  Linha verde no gráfico. Grupos acima da meta estão gerando retorno superior ao investimento. Grupos abaixo de 0% estão consumindo orçamento sem retorno.
                </p>
              </div>
              <div>
                <strong>Ação Recomendada</strong>
                <p className="text-xs mt-0.5 text-blue-700">
                  Grupos com ROI negativo por 2+ semanas devem ter orçamento reduzido. Grupos com ROI {">"} {ROI_META}% devem receber aumento de lance e orçamento.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
