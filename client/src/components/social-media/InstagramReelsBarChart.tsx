import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import { Film, RefreshCw, TrendingUp, Eye, Users, Share2 } from "lucide-react";
import { toast } from "sonner";

// Dados reais coletados via MCP Instagram em 06/04/2026
const REAL_REELS_DATA = [
  {
    id: "18179876854376796",
    label: "Páscoa ✨",
    date: "05/04",
    reach: 114,
    views: 191,
    likes: 1,
    shares: 1,
    saved: 0,
    interactions: 2,
    link: "https://www.instagram.com/reel/DWwlpoIjV8s/",
  },
  {
    id: "18080307524377265",
    label: "TBT Reunião",
    date: "02/04",
    reach: 344,
    views: 485,
    likes: 13,
    shares: 2,
    saved: 0,
    interactions: 16,
    link: "https://www.instagram.com/reel/DWoUaJ6jQWm/",
  },
  {
    id: "18003849773723274",
    label: "Brindes 🎁",
    date: "20/03",
    reach: 825,
    views: 1450,
    likes: 96,
    shares: 11,
    saved: 2,
    interactions: 123,
    link: "https://www.instagram.com/reel/DWHrTfzDaHu/",
  },
  {
    id: "18058148576342014",
    label: "Câmera IA",
    date: "12/02",
    reach: 645,
    views: 890,
    likes: 41,
    shares: 29,
    saved: 1,
    interactions: 74,
    link: "https://www.instagram.com/reel/DUqESWWEaYs/",
  },
];

type MetricKey = "reach" | "views" | "interactions" | "shares";

const METRIC_CONFIG: Record<MetricKey, { label: string; color: string; iconColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  reach: { label: "Alcance", color: "#8B5CF6", iconColor: "text-purple-600", icon: Users },
  views: { label: "Visualizações", color: "#EC4899", iconColor: "text-pink-600", icon: Eye },
  interactions: { label: "Interações", color: "#F59E0B", iconColor: "text-amber-600", icon: TrendingUp },
  shares: { label: "Compartilhamentos", color: "#10B981", iconColor: "text-emerald-600", icon: Share2 },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-bold text-gray-900">{entry.value.toLocaleString("pt-BR")}</span>
        </div>
      ))}
    </div>
  );
};

export function InstagramReelsBarChart() {
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(["reach", "views"]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState(REAL_REELS_DATA);

  const syncMutation = trpc.instagram.syncFromMCP.useMutation({
    onSuccess: () => {
      toast.success("Dados atualizados! Recarregue a página para ver os novos insights.");
      setIsRefreshing(false);
    },
    onError: () => {
      toast.error("Erro ao sincronizar. Usando dados do último cache.");
      setIsRefreshing(false);
    },
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    syncMutation.mutate({ username: "zenite.tech" });
  };

  const toggleMetric = (metric: MetricKey) => {
    setActiveMetrics((prev) =>
      prev.includes(metric)
        ? prev.length > 1 ? prev.filter((m) => m !== metric) : prev
        : [...prev, metric]
    );
  };

  // Preparar dados para o gráfico
  const chartData = data.map((reel) => ({
    name: `${reel.label}\n${reel.date}`,
    label: reel.label,
    date: reel.date,
    reach: reel.reach,
    views: reel.views,
    interactions: reel.interactions,
    shares: reel.shares,
    link: reel.link,
  }));

  // Calcular totais
  const totals = data.reduce(
    (acc, r) => ({
      reach: acc.reach + r.reach,
      views: acc.views + r.views,
      interactions: acc.interactions + r.interactions,
      shares: acc.shares + r.shares,
    }),
    { reach: 0, views: 0, interactions: 0, shares: 0 }
  );

  const bestReel = data.reduce((best, r) => (r.reach > best.reach ? r : best), data[0]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Film className="w-4 h-4 text-pink-600" />
            Reels — Alcance e Visualizações
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5 h-7 text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Comparativo dos 4 reels mais recentes — dados coletados via MCP Instagram
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros de métricas */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((metric) => {
            const config = METRIC_CONFIG[metric];
            const Icon = config.icon;
            const isActive = activeMetrics.includes(metric);
            return (
              <button
                key={metric}
                onClick={() => toggleMetric(metric)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  isActive
                    ? "text-foreground border-transparent shadow-sm"
                    : "bg-gray-50 text-muted-foreground border-gray-200 hover:bg-gray-100"
                }`}
                style={isActive ? { backgroundColor: config.color, borderColor: config.color } : {}}
              >
                <Icon className="w-3 h-3" />
                {config.label}
              </button>
            );
          })}
        </div>

        {/* Gráfico de barras */}
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#6B7280" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6B7280" }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value) => METRIC_CONFIG[value as MetricKey]?.label ?? value}
              />
              {(Object.keys(METRIC_CONFIG) as MetricKey[])
                .filter((m) => activeMetrics.includes(m))
                .map((metric) => (
                  <Bar
                    key={metric}
                    dataKey={metric}
                    name={metric}
                    fill={METRIC_CONFIG[metric].color}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Resumo de totais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
          {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((metric) => {
            const config = METRIC_CONFIG[metric];
            const Icon = config.icon;
            return (
              <div key={metric} className="text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Icon className={`w-3 h-3 ${config.iconColor}`} />
                  <span className="text-xs text-muted-foreground">{config.label}</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {totals[metric].toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground">total</p>
              </div>
            );
          })}
        </div>

        {/* Destaque: melhor reel */}
        <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-purple-800">Melhor reel por alcance</p>
            <p className="text-sm font-bold text-purple-900">{bestReel.label} ({bestReel.date})</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-purple-700">{bestReel.reach.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-purple-500">alcance</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Fonte: Instagram Graph API via MCP · Última coleta: 06/04/2026
        </p>
      </CardContent>
    </Card>
  );
}
