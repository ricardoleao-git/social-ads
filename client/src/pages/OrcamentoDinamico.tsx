/**
 * Página: Orçamento Dinâmico
 * Gerencia a automação de realocação de verba entre grupos de anúncios.
 * Inclui gráfico de cascata (waterfall) para visualizar o fluxo de caixa.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, TrendingDown, Play, FlaskConical,
  ArrowRightLeft, Clock, CheckCircle2, Info,
  RefreshCw, Settings, BarChart2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, LabelList
} from "recharts";

// ─── Tooltip personalizado para o gráfico de cascata ─────────────────────────
const WaterfallTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {d.type === "donor" && (
        <p className="text-red-600">Cedeu: <strong>R$ {Math.abs(d.realValue).toFixed(2)}</strong></p>
      )}
      {d.type === "recipient" && (
        <p className="text-green-600">Recebeu: <strong>R$ {d.realValue.toFixed(2)}</strong></p>
      )}
      {d.type === "total" && (
        <p className="text-blue-600">Saldo líquido: <strong>R$ {d.realValue.toFixed(2)}</strong></p>
      )}
      {d.status && (
        <p className="text-muted-foreground mt-1">Status: {d.statusLabel}</p>
      )}
    </div>
  );
};

export default function OrcamentoDinamico() {
  const [isRunning, setIsRunning] = useState(false);
  const [waterfallView, setWaterfallView] = useState<"cascata" | "barras">("cascata");

  const { data: summaryData, refetch: refetchSummary } = trpc.dynamicBudget.getSummary.useQuery();
  const { data: historyData, refetch: refetchHistory } = trpc.dynamicBudget.getHistory.useQuery({ limit: 30 });
  const { data: configData, refetch: refetchConfig } = trpc.dynamicBudget.getConfig.useQuery();

  const updateConfigMutation = trpc.dynamicBudget.updateConfig.useMutation({
    onSuccess: () => {
      refetchConfig();
      refetchSummary();
      toast.success("Configuração atualizada", { description: "Modo de operação salvo com sucesso." });
    },
  });

  const forceRunMutation = trpc.dynamicBudget.forceRun.useMutation({
    onSuccess: (result) => {
      setIsRunning(false);
      refetchHistory();
      refetchSummary();
      if (result.success) {
        if (result.isSimulation) {
          toast.success("Simulação concluída", { description: result.message ?? "Simulação concluída" });
        } else {
          toast.success("Realocação aplicada", { description: result.message ?? "Realocação aplicada" });
        }
      } else {
        toast.error("Erro na execução", { description: result.error ?? "Erro desconhecido" });
      }
    },
    onError: (err) => {
      setIsRunning(false);
      toast.error("Erro", { description: err.message });
    },
  });

  const summary = summaryData?.summary;
  const history = historyData?.history ?? [];
  const config = configData?.config;

  const handleForceRun = (simulation: boolean) => {
    setIsRunning(true);
    forceRunMutation.mutate({ simulation });
  };

  const handleToggleSimulation = (value: boolean) => {
    updateConfigMutation.mutate({ simulationMode: value });
  };

  const handleToggleEnabled = (value: boolean) => {
    updateConfigMutation.mutate({ enabled: value });
  };

  const statusColor: Record<string, string> = {
    applied: "#22c55e",
    simulated: "#3b82f6",
    failed: "#ef4444",
    skipped: "#f59e0b",
  };

  const statusLabel: Record<string, string> = {
    applied: "Aplicado",
    simulated: "Simulado",
    failed: "Falhou",
    skipped: "Ignorado",
  };

  // ─── Dados para gráfico de barras simples ──────────────────────────────────
  const barChartData = history.slice(0, 10).map(h => ({
    name: h.recipientAdGroupName?.split(" ").slice(0, 2).join(" ") ?? "Grupo",
    valor: ((h.amountMovedMicros ?? 0) / 1e6),
    status: h.status,
  })).reverse();

  // ─── Dados para gráfico de cascata (waterfall) ─────────────────────────────
  // Mostra o fluxo de caixa: cada realocação como um par doador→receptor
  const waterfallData = useMemo(() => {
    const recent = history.slice(0, 8).reverse();
    if (recent.length === 0) return [];

    const points: Array<{
      name: string;
      base: number;       // ponto de início da barra (para empilhamento)
      value: number;      // altura da barra (positivo = entrada, negativo = saída)
      realValue: number;  // valor real para tooltip
      type: "donor" | "recipient" | "total";
      fill: string;
      status: string;
      statusLabel: string;
    }> = [];

    let runningTotal = 0;

    recent.forEach((h, i) => {
      const amount = (h.amountMovedMicros ?? 0) / 1e6;
      const shortDonor = (h.donorAdGroupName ?? "Doador").split(" ").slice(0, 2).join(" ");
      const shortRecipient = h.recipientAdGroupName.split(" ").slice(0, 2).join(" ");

      // Barra do doador (saída — negativa)
      points.push({
        name: shortDonor,
        base: runningTotal,
        value: -amount,
        realValue: -amount,
        type: "donor",
        fill: "#ef4444",
        status: h.status,
        statusLabel: statusLabel[h.status] ?? h.status,
      });
      runningTotal -= amount;

      // Barra do receptor (entrada — positiva)
      points.push({
        name: shortRecipient,
        base: runningTotal,
        value: amount,
        realValue: amount,
        type: "recipient",
        fill: h.status === "applied" ? "#22c55e" : "#3b82f6",
        status: h.status,
        statusLabel: statusLabel[h.status] ?? h.status,
      });
      runningTotal += amount;

      // Separador de ciclo a cada par (exceto o último)
      if (i < recent.length - 1) {
        points.push({
          name: `Ciclo ${i + 1}`,
          base: 0,
          value: 0,
          realValue: 0,
          type: "total",
          fill: "transparent",
          status: "",
          statusLabel: "",
        });
      }
    });

    return points;
  }, [history]);

  // Calcular o domínio Y do waterfall
  const waterfallDomain = useMemo(() => {
    if (waterfallData.length === 0) return [-5, 5];
    const allValues = waterfallData.flatMap(d => [d.base, d.base + d.value]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const pad = Math.max(Math.abs(max - min) * 0.15, 1);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [waterfallData]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-blue-600" />
            Orçamento Dinâmico
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Realocação automática de verba entre grupos de anúncios com base em CTR e CPL
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleForceRun(true)}
            disabled={isRunning}
          >
            <FlaskConical className="w-4 h-4 mr-1" />
            Simular agora
          </Button>
          <Button
            size="sm"
            onClick={() => handleForceRun(false)}
            disabled={isRunning || config?.simulationMode}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
            Executar agora
          </Button>
        </div>
      </div>

      {/* Alerta modo simulação */}
      {config?.simulationMode && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <FlaskConical className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Modo Simulação Ativo</p>
            <p className="text-xs text-blue-600">
              Os ajustes são calculados mas não aplicados no Google Ads. Desative o modo simulação nas configurações abaixo para aplicar em produção.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total de Ajustes</p>
                <p className="text-2xl font-bold text-gray-900">{summary?.totalAdjustments ?? 0}</p>
              </div>
              <ArrowRightLeft className="w-8 h-8 text-blue-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Aplicados</p>
                <p className="text-2xl font-bold text-green-600">{summary?.appliedAdjustments ?? 0}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Simulados</p>
                <p className="text-2xl font-bold text-blue-600">{summary?.simulatedAdjustments ?? 0}</p>
              </div>
              <FlaskConical className="w-8 h-8 text-blue-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Realocado</p>
                <p className="text-2xl font-bold text-gray-900">R$ {summary?.totalMovedBRL ?? "0,00"}</p>
              </div>
              <DollarSign className="w-8 h-8 text-yellow-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico principal (cascata ou barras) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-500" />
                Fluxo de Caixa das Realocações
              </CardTitle>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setWaterfallView("cascata")}
                  className={`text-xs px-3 py-1 rounded-md transition-colors ${
                    waterfallView === "cascata"
                      ? "bg-white text-blue-700 font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-gray-700"
                  }`}
                >
                  Cascata
                </button>
                <button
                  onClick={() => setWaterfallView("barras")}
                  className={`text-xs px-3 py-1 rounded-md transition-colors ${
                    waterfallView === "barras"
                      ? "bg-white text-blue-700 font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-gray-700"
                  }`}
                >
                  Barras
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {waterfallView === "cascata" ? (
              // ── Gráfico de Cascata (Waterfall) ──────────────────────────────
              waterfallData.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Cada par de barras representa um ciclo de realocação: <span className="text-red-500 font-medium">vermelho = doador (saída)</span> e <span className="text-green-600 font-medium">verde/azul = receptor (entrada)</span>.
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={waterfallData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis
                        domain={waterfallDomain}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `R$${v.toFixed(0)}`}
                      />
                      <Tooltip content={<WaterfallTooltip />} />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />
                      {/* Barra invisível para empilhamento (base) */}
                      <Bar dataKey="base" stackId="waterfall" fill="transparent" />
                      {/* Barra visível (valor real) */}
                      <Bar dataKey="value" stackId="waterfall" radius={[3, 3, 0, 0]}>
                        {waterfallData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.fill}
                            fillOpacity={entry.type === "total" ? 0 : 0.85}
                          />
                        ))}
                        <LabelList
                          dataKey="realValue"
                          position="top"
                          formatter={(v: number) => v !== 0 ? `R$${Math.abs(v).toFixed(0)}` : ""}
                          style={{ fontSize: 9, fill: "#6b7280" }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Legenda */}
                  <div className="flex items-center gap-4 mt-2 justify-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-red-500 opacity-85" />
                      <span className="text-xs text-muted-foreground">Doador (saída)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-green-500 opacity-85" />
                      <span className="text-xs text-muted-foreground">Receptor aplicado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-blue-500 opacity-85" />
                      <span className="text-xs text-muted-foreground">Receptor simulado</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[260px] text-muted-foreground">
                  <BarChart2 className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm">Nenhum dado para o gráfico de cascata</p>
                  <p className="text-xs mt-1">Execute uma simulação para visualizar o fluxo</p>
                </div>
              )
            ) : (
              // ── Gráfico de Barras simples ────────────────────────────────────
              barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                    <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Valor realocado"]} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                      {barChartData.map((entry, index) => (
                        <Cell key={index} fill={statusColor[entry.status] ?? "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[260px] text-muted-foreground">
                  <ArrowRightLeft className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm">Nenhum ajuste registrado ainda</p>
                  <p className="text-xs mt-1">Execute uma simulação para ver os dados</p>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configurações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Automação ativa</Label>
                <p className="text-xs text-muted-foreground">Habilita o job a cada 2h</p>
              </div>
              <Switch
                checked={config?.enabled ?? true}
                onCheckedChange={handleToggleEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Modo simulação</Label>
                <p className="text-xs text-muted-foreground">Calcula sem aplicar no Ads</p>
              </div>
              <Switch
                checked={config?.simulationMode ?? true}
                onCheckedChange={handleToggleSimulation}
              />
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Execuções: 6h, 8h, 10h, 12h, 14h, 16h (Brasília)
              </p>
              {summary?.lastRunAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Última execução: {new Date(summary.lastRunAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </p>
              )}
            </div>

            {/* Legenda de status */}
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs font-medium text-gray-600 mb-2">Legenda de Status</p>
              {Object.entries(statusLabel).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColor[key] }} />
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lógica de realocação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            Como funciona a realocação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Grupos Doadores</span>
              </div>
              <p className="text-xs text-red-700">CTR abaixo de 4% com 0 conversões nos últimos 7 dias. Cedem 20% do orçamento gasto.</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-center">
              <div className="text-center">
                <ArrowRightLeft className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                <p className="text-xs text-blue-700 font-medium">Realocação automática</p>
                <p className="text-xs text-blue-600">Máximo 20% por ciclo</p>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Grupos Receptores</span>
              </div>
              <p className="text-xs text-green-700">CTR acima de 10%. Recebem verba adicional para maximizar o retorno já comprovado.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de ajustes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Realocações</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum ajuste registrado ainda</p>
              <p className="text-xs mt-1">Execute uma simulação para ver o histórico</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Data</th>
                    <th className="pb-2 pr-4">Doador</th>
                    <th className="pb-2 pr-4">Receptor</th>
                    <th className="pb-2 pr-4">Valor</th>
                    <th className="pb-2 pr-4">CTR Doador</th>
                    <th className="pb-2 pr-4">CTR Receptor</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{h.date}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs font-medium text-red-700 truncate block max-w-[140px]" title={h.donorAdGroupName ?? ""}>
                          {h.donorAdGroupName ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-xs font-medium text-green-700 truncate block max-w-[140px]" title={h.recipientAdGroupName}>
                          {h.recipientAdGroupName}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-medium">
                        R$ {((h.amountMovedMicros ?? 0) / 1e6).toFixed(2)}
                      </td>
                      <td className="py-2 pr-4 text-xs text-red-600">{h.donorCtr ?? "—"}%</td>
                      <td className="py-2 pr-4 text-xs text-green-600">{h.recipientCtr ?? "—"}%</td>
                      <td className="py-2">
                        <Badge
                          className="text-xs"
                          style={{
                            backgroundColor: `${statusColor[h.status]}20`,
                            color: statusColor[h.status],
                            border: `1px solid ${statusColor[h.status]}40`,
                          }}
                        >
                          {statusLabel[h.status] ?? h.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
