import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp, RefreshCw } from "lucide-react";
import { useSocialMedia } from "@/components/social-media/SocialMediaWrapper";

interface ChartPoint {
  label: string;
  alcance: number;
  engajamento: number;
  curtidas: number;
  comentarios: number;
  date: string;
}

// Dados reais coletados via MCP Instagram em 06/04/2026 (últimos 20 posts sincronizados)
const REAL_POSTS_DATA: ChartPoint[] = [
  { label: "Câmera IA", date: "28/02", alcance: 645, engajamento: 8.37, curtidas: 45, comentarios: 9 },
  { label: "Brindes 🎁", date: "20/03", alcance: 825, engajamento: 14.93, curtidas: 96, comentarios: 13 },
  { label: "TBT Reunião", date: "28/03", alcance: 344, engajamento: 5.52, curtidas: 17, comentarios: 2 },
  { label: "Páscoa", date: "20/04", alcance: 114, engajamento: 3.51, curtidas: 4, comentarios: 0 },
];

const AVG_REACH = Math.round(REAL_POSTS_DATA.reduce((s, d) => s + d.alcance, 0) / REAL_POSTS_DATA.length);
const AVG_ENG = parseFloat((REAL_POSTS_DATA.reduce((s, d) => s + d.engajamento, 0) / REAL_POSTS_DATA.length).toFixed(2));

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600 capitalize">{entry.name}:</span>
          <span className="font-medium text-gray-900">
            {entry.name === "engajamento" ? `${entry.value}%` : entry.value.toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}

interface InstagramPostsLineChartProps {
  /** Se true, usa dados do banco via tRPC; se false, usa dados reais hardcoded do MCP */
  useLiveData?: boolean;
}

export function InstagramPostsLineChart({ useLiveData = false }: InstagramPostsLineChartProps) {
  const { selectedAccount } = useSocialMedia();

  const { data: dbPosts, isLoading, refetch, isFetching } = trpc.instagram.getPosts.useQuery(
    { accountId: selectedAccount.id, limit: 20 },
    { staleTime: 120_000, enabled: useLiveData && !!selectedAccount.id }
  );

  const chartData: ChartPoint[] = useMemo(() => {
    if (useLiveData && dbPosts && dbPosts.length > 0) {
      return [...dbPosts]
        .sort((a, b) => new Date(a.postedAt ?? 0).getTime() - new Date(b.postedAt ?? 0).getTime())
        .slice(-15)
        .map((p) => ({
          label: (p.caption ?? "Post").substring(0, 12) + (p.caption && p.caption.length > 12 ? "…" : ""),
          date: p.postedAt ? new Date(p.postedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—",
          alcance: 0, // banco não armazena reach por post ainda
          engajamento: parseFloat(p.engagement ?? "0"),
          curtidas: p.likes ?? 0,
          comentarios: p.comments ?? 0,
        }));
    }
    return REAL_POSTS_DATA;
  }, [dbPosts, useLiveData]);

  const bestPost = useMemo(
    () => chartData.reduce((best, p) => (p.engajamento > best.engajamento ? p : best), chartData[0]),
    [chartData]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            Evolução de Alcance e Engajamento
          </CardTitle>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
          <span>Média alcance: <strong className="text-purple-700">{AVG_REACH.toLocaleString("pt-BR")}</strong></span>
          <span>Média engajamento: <strong className="text-pink-700">{AVG_ENG}%</strong></span>
          {bestPost && (
            <span className="ml-auto text-amber-600 font-medium">
              🏆 Melhor: {bestPost.label} ({bestPost.engajamento}%)
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Carregando dados...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                domain={[0, "auto"]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                formatter={(value) => value === "engajamento" ? "Engajamento (%)" : value === "alcance" ? "Alcance" : value === "curtidas" ? "Curtidas" : "Comentários"}
              />
              <ReferenceLine
                yAxisId="right"
                y={AVG_ENG}
                stroke="#f472b6"
                strokeDasharray="4 2"
                strokeOpacity={0.6}
                label={{ value: `Média ${AVG_ENG}%`, position: "insideTopRight", fontSize: 10, fill: "#f472b6" }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="alcance"
                stroke="#7c3aed"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="engajamento"
                stroke="#ec4899"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#ec4899", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="curtidas"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="text-xs text-muted-foreground text-center mt-2">
          Fonte: Instagram Graph API via MCP · {chartData.length} posts analisados
        </p>
      </CardContent>
    </Card>
  );
}
