import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Users, Eye, Heart, TrendingUp, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import PeriodSelector, { PeriodType } from "@/components/social-media/PeriodSelector";

export default function CompareAccounts() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("week");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // Load all accounts from DB
  const { data: allAccounts } = trpc.instagram.getAccounts.useQuery(
    undefined,
    { staleTime: 120_000 }
  );

  // Auto-select first 2 accounts
  const selectedAccounts = useMemo(() => {
    if (!allAccounts) return [];
    const ids = selectedAccountIds.length > 0 ? selectedAccountIds : allAccounts.slice(0, 2).map((a) => a.id);
    return allAccounts.filter((a) => ids.includes(a.id));
  }, [allAccounts, selectedAccountIds]);

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  // Load live data for each selected account
  const { data: liveData0 } = trpc.instagram.getLiveData.useQuery(
    { accountId: selectedAccounts[0]?.id ?? "" },
    { staleTime: 120_000, enabled: !!selectedAccounts[0]?.id }
  );
  const { data: liveData1 } = trpc.instagram.getLiveData.useQuery(
    { accountId: selectedAccounts[1]?.id ?? "" },
    { staleTime: 120_000, enabled: !!selectedAccounts[1]?.id }
  );
  const { data: posts0 } = trpc.instagram.getPosts.useQuery(
    { accountId: selectedAccounts[0]?.id ?? "", limit: 20 },
    { staleTime: 120_000, enabled: !!selectedAccounts[0]?.id }
  );
  const { data: posts1 } = trpc.instagram.getPosts.useQuery(
    { accountId: selectedAccounts[1]?.id ?? "", limit: 20 },
    { staleTime: 120_000, enabled: !!selectedAccounts[1]?.id }
  );

  const buildMetrics = (ld: any, posts: any[]) => ({
    followers: ld?.followers ?? ld?.accountInfo?.followers ?? 0,
    reach: ld?.reach ?? 0,
    engagement: posts.length > 0
      ? parseFloat(((posts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0), 0) / posts.length / Math.max(ld?.followers ?? 1, 1)) * 100).toFixed(2))
      : 0,
    likes: posts.reduce((s, p) => s + (p.likes ?? 0), 0),
    comments: posts.reduce((s, p) => s + (p.comments ?? 0), 0),
    posts: posts.length,
  });

  const comparisonData = useMemo(() => {
    return [
      selectedAccounts[0] ? { id: selectedAccounts[0].id, name: selectedAccounts[0].accountName ?? selectedAccounts[0].accountHandle, username: selectedAccounts[0].accountHandle, ...buildMetrics(liveData0, posts0 ?? []) } : null,
      selectedAccounts[1] ? { id: selectedAccounts[1].id, name: selectedAccounts[1].accountName ?? selectedAccounts[1].accountHandle, username: selectedAccounts[1].accountHandle, ...buildMetrics(liveData1, posts1 ?? []) } : null,
    ].filter(Boolean);
  }, [selectedAccounts, liveData0, liveData1, posts0, posts1]);

  // Build historical chart data from posts
  const historicalData = useMemo(() => {
    if (selectedAccounts.length === 0) return [];
    const p0 = (posts0 ?? []).slice(0, 7).reverse();
    const periodData: any = p0.map((p, i) => ({
      date: p.postedAt ? new Date(p.postedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : `Post ${i + 1}`,
    }));

    return periodData.map((item: any, i: number) => {
      const dataPoint: any = { date: item.date };
      const p0item = (posts0 ?? [])[i];
      const p1item = (posts1 ?? [])[i];
      if (selectedAccounts[0]) {
        dataPoint[`${selectedAccounts[0].accountName}-followers`] = (liveData0 as any)?.followers ?? 0;
        dataPoint[`${selectedAccounts[0].accountName}-engagement`] = p0item ? (p0item.likes ?? 0) + (p0item.comments ?? 0) : 0;
      }
      if (selectedAccounts[1]) {
        dataPoint[`${selectedAccounts[1].accountName}-followers`] = (liveData1 as any)?.followers ?? 0;
        dataPoint[`${selectedAccounts[1].accountName}-engagement`] = p1item ? (p1item.likes ?? 0) + (p1item.comments ?? 0) : 0;
      }
      return dataPoint;
    });
  }, [selectedAccounts, posts0, posts1, liveData0, liveData1]);

  // Prepare radar chart data
  const radarData = comparisonData.filter(Boolean).map((account) => ({
    name: (account as any).name,
    followers: ((account as any).followers / 2500) * 100,
    reach: ((account as any).reach / 6000) * 100,
    engagement: (account as any).engagement * 15,
    likes: ((account as any).likes / 800) * 100,
    comments: ((account as any).comments / 100) * 100,
  }));

  const colors = ["#3b82f6", "#ef4444", "#10b981"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comparação de Contas</h1>
          <p className="text-gray-600 mt-1">Analise e compare métricas entre suas contas</p>
        </div>
      </div>

      {/* Account Selection */}
      <Card className="p-6 border-0 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-4">Selecione as Contas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(allAccounts ?? []).map((account) => (
            <button
              key={account.id}
              onClick={() => toggleAccount(account.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedAccounts.some((a) => a.id === account.id)
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <p className="font-semibold text-gray-900">{account.accountName}</p>
              <p className="text-sm text-gray-600">@{account.accountHandle}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Period Selector */}
      <Card className="p-6 border-0 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-4">Período</h3>
        <PeriodSelector selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} />
      </Card>

      {selectedAccounts.length > 0 && (
        <>
          {/* Comparison Table */}
          <Card className="p-6 border-0 shadow-sm overflow-x-auto">
            <h3 className="font-bold text-gray-900 mb-4">Métricas Comparativas</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Métrica</th>
                  {comparisonData.filter(Boolean).map((account: any) => (
                    <th key={account.id} className="text-left py-3 px-4 font-semibold text-gray-900">
                      {account.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-semibold text-gray-700">Seguidores</td>
                  {comparisonData.filter(Boolean).map((account: any) => (
                    <td key={account.id} className="py-3 px-4 text-gray-900">
                      {account.followers.toLocaleString("pt-BR")}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-semibold text-gray-700">Alcance</td>
                  {comparisonData.filter(Boolean).map((account: any) => (
                    <td key={account.id} className="py-3 px-4 text-gray-900">
                      {account.reach.toLocaleString("pt-BR")}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-semibold text-gray-700">Curtidas</td>
                  {comparisonData.filter(Boolean).map((account: any) => (
                    <td key={account.id} className="py-3 px-4 text-gray-900">
                      {account.likes.toLocaleString("pt-BR")}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-semibold text-gray-700">Comentários</td>
                  {comparisonData.filter(Boolean).map((account: any) => (
                    <td key={account.id} className="py-3 px-4 text-gray-900">
                      {account.comments.toLocaleString("pt-BR")}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-semibold text-gray-700">Compartilhamentos</td>
                  {comparisonData.map((account) => (
                    <td key={account!.id} className="py-3 px-4 text-gray-900">
                      {((account as any).shares ?? 0).toLocaleString("pt-BR")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-gray-700">Taxa de Engajamento</td>
                  {comparisonData.filter(Boolean).map((account: any) => (
                    <td key={account.id} className="py-3 px-4 text-gray-900">
                      {account.engagement.toFixed(2)}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Followers Trend */}
            <Card className="p-6 border-0 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Crescimento de Seguidores</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: "12px" }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }} />
                  <Legend />
                  {selectedAccounts.map((account, idx) => (
                    <Line
                      key={account.id}
                      type="monotone"
                      dataKey={`${account.accountName}-followers`}
                      stroke={colors[idx]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Engagement Trend */}
            <Card className="p-6 border-0 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Taxa de Engajamento</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: "12px" }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }} />
                  <Legend />
                  {selectedAccounts.map((account, idx) => (
                    <Line
                      key={account.id}
                      type="monotone"
                      dataKey={`${account.accountName}-engagement`}
                      stroke={colors[idx]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Radar Chart */}
            <Card className="p-6 border-0 shadow-sm lg:col-span-2">
              <h3 className="font-bold text-gray-900 mb-4">Comparação Geral de Desempenho</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="name" stroke="#9ca3af" />
                  <PolarRadiusAxis stroke="#9ca3af" />
                  <Radar name="Seguidores" dataKey="followers" stroke={colors[0]} fill={colors[0]} fillOpacity={0.25} />
                  {selectedAccounts.length > 1 && (
                    <Radar name="Alcance" dataKey="reach" stroke={colors[1]} fill={colors[1]} fillOpacity={0.25} />
                  )}
                  {selectedAccounts.length > 2 && (
                    <Radar name="Engajamento" dataKey="engagement" stroke={colors[2]} fill={colors[2]} fillOpacity={0.25} />
                  )}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}

      {selectedAccounts.length === 0 && (
        <Card className="p-12 border-0 shadow-sm text-center">
          <p className="text-gray-600">Selecione pelo menos uma conta para visualizar a comparação</p>
        </Card>
      )}
    </div>
  );
}
