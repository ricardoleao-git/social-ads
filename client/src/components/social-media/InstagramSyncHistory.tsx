import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  History, Settings, TrendingUp, TrendingDown, Users,
  Heart, MessageCircle, RefreshCw, CheckCircle, AlertCircle, Save, Download, BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

function EngagementBadge({ rate }: { rate: number }) {
  const threshold = 0.15;
  const isOk = rate >= threshold;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      isOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
    }`}>
      {isOk ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {rate.toFixed(2)}%
    </span>
  );
}

function exportSyncHistoryCSV(history: any[]) {
  const headers = ["Data/Hora", "Seguidores", "Engajamento (%)", "Curtidas", "Comentários", "Posts", "Fonte"];
  const rows = history.map((row) => [
    row.syncedAt ? new Date(row.syncedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    row.followers ?? 0,
    (row.engagementRate ?? 0).toFixed(2),
    row.likes ?? 0,
    row.comments ?? 0,
    row.totalPosts ?? 0,
    row.source ?? "mcp",
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `instagram-sync-history-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type PeriodFilter = 7 | 15 | 30;

export function InstagramSyncHistory() {
  const { data, isLoading, refetch } = trpc.instagram.getSyncHistory.useQuery({ limit: 60 });
  const [view, setView] = useState<"chart" | "table">("chart");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(30);

  const allHistory = data?.history ?? [];

  // Filtrar por período selecionado
  const history = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodFilter);
    return allHistory.filter((row) => {
      if (!row.syncedAt) return false;
      return new Date(row.syncedAt) >= cutoff;
    });
  }, [allHistory, periodFilter]);

  // Prepara dados para o gráfico (ordem cronológica, mais antigo primeiro)
  const chartData = [...history].reverse().map((row) => ({
    date: row.syncedAt
      ? new Date(row.syncedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
      : "—",
    seguidores: row.followers ?? 0,
    engajamento: parseFloat((row.engagementRate ?? 0).toFixed(2)),
  }));

  const periodOptions: { label: string; value: PeriodFilter }[] = [
    { label: "7 dias", value: 7 },
    { label: "15 dias", value: 15 },
    { label: "30 dias", value: 30 },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600" />
            Histórico de Sincronizações
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro de período */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {periodOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriodFilter(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    periodFilter === opt.value
                      ? "bg-purple-600 text-foreground shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {history.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant={view === "chart" ? "default" : "outline"}
                  onClick={() => setView("chart")}
                  title="Ver gráfico"
                  className={view === "chart" ? "bg-purple-600 hover:bg-purple-700 text-foreground" : ""}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={view === "table" ? "default" : "outline"}
                  onClick={() => setView("table")}
                  title="Ver tabela"
                  className={view === "table" ? "bg-purple-600 hover:bg-purple-700 text-foreground" : ""}
                >
                  <History className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportSyncHistoryCSV(history)}
                  title="Exportar histórico como CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {history.length > 0
            ? `${history.length} sincronização(ões) nos últimos ${periodFilter} dias`
            : `Nenhuma sincronização nos últimos ${periodFilter} dias`}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Carregando histórico...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <History className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma sincronização nos últimos {periodFilter} dias.</p>
            <p className="text-xs mt-1">
              {allHistory.length > 0
                ? `Existem ${allHistory.length} registros em outros períodos. Tente "30 dias".`
                : 'Use o botão "Sincronizar no Banco" para registrar a primeira.'}
            </p>
          </div>
        ) : view === "chart" ? (
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs text-muted-foreground mb-3">
              Evolução de seguidores e engajamento médio — últimos {periodFilter} dias
            </p>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString("pt-BR")} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === "seguidores"
                        ? [value.toLocaleString("pt-BR"), "Seguidores"]
                        : [`${value}%`, "Engajamento"]
                    }
                  />
                  <Legend formatter={(v: string) => v === "seguidores" ? "Seguidores" : "Engajamento (%)"} />
                  <Line yAxisId="left" type="monotone" dataKey="seguidores" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line yAxisId="right" type="monotone" dataKey="engajamento" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Data/Hora</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center justify-end gap-1"><Users className="w-3 h-3" />Seguidores</span>
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Engajamento</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">
                    <span className="flex items-center justify-end gap-1"><Heart className="w-3 h-3 text-red-400" />Curtidas</span>
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">
                    <span className="flex items-center justify-end gap-1"><MessageCircle className="w-3 h-3 text-blue-400" />Coments.</span>
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Fonte</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => {
                  const date = row.syncedAt
                    ? new Date(row.syncedAt).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                        timeZone: "America/Sao_Paulo",
                      })
                    : "—";
                  return (
                    <tr key={row.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i === 0 ? "bg-purple-50/40" : ""}`}>
                      <td className="px-4 py-2.5 text-gray-700 font-mono text-xs">
                        {i === 0 && (
                          <span className="inline-block bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded mr-1.5 font-semibold">Último</span>
                        )}
                        {date}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                        {(row.followers ?? 0).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <EngagementBadge rate={row.engagementRate ?? 0} />
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 hidden sm:table-cell">
                        {(row.likes ?? 0).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 hidden sm:table-cell">
                        {(row.comments ?? 0).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5 text-right hidden md:table-cell">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {row.source ?? "mcp"}
                        </span>
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
  );
}

export function InstagramEngagementSettings() {
  const { data: settingsData, refetch: refetchSettings } = trpc.instagram.getSettings.useQuery();
  const updateMutation = trpc.instagram.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva com sucesso!");
      refetchSettings();
    },
    onError: (err) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  const currentThreshold = settingsData?.settings?.["instagram.engagementThreshold"] ?? "0.15";
  const currentEmail = settingsData?.settings?.["instagram.alertEmail"] ?? "rjll70@gmail.com";

  const [threshold, setThreshold] = useState(currentThreshold);
  const [email, setEmail] = useState(currentEmail);
  const [dirty, setDirty] = useState(false);

  const handleSave = () => {
    updateMutation.mutate({
      key: "instagram.engagementThreshold",
      value: threshold,
      label: "Limiar de Engajamento Instagram",
      description: "Percentual mínimo de engajamento. Abaixo disso, um alerta por e-mail é disparado.",
    });
    updateMutation.mutate({
      key: "instagram.alertEmail",
      value: email,
      label: "E-mail de Alerta Instagram",
      description: "Endereço que recebe o alerta quando o engajamento cai abaixo do limiar.",
    });
    setDirty(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-600" />
          Configurações de Alerta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Limiar de Engajamento (%)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={threshold}
            onChange={(e) => { setThreshold(e.target.value); setDirty(true); }}
            className="h-8 text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">Abaixo deste valor, um alerta é disparado automaticamente.</p>
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">E-mail de Alerta</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setDirty(true); }}
            className="h-8 text-sm"
          />
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || updateMutation.isPending}
          className="bg-purple-600 hover:bg-purple-700 text-foreground"
        >
          {updateMutation.isPending ? (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5 mr-1.5" />
          )}
          Salvar Configurações
        </Button>
        {updateMutation.isSuccess && (
          <div className="flex items-center gap-1.5 text-green-600 text-xs">
            <CheckCircle className="w-3.5 h-3.5" />
            Configurações salvas com sucesso!
          </div>
        )}
      </CardContent>
    </Card>
  );
}
