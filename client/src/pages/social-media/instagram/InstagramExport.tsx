import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Download, BarChart3, TrendingUp, MessageCircle, Eye } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSocialMedia } from "@/components/social-media/SocialMediaWrapper";
import PeriodSelector, { PeriodType } from "@/components/social-media/PeriodSelector";

// ─── CSV export helpers ────────────────────────────────────────────────────────
function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => String(r[h] ?? "")).join(";")),
  ].join("\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportData() {
  const [, setLocation] = useLocation();
  const { selectedAccount } = useSocialMedia();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("week");
  const [activeTab, setActiveTab] = useState("metrics");

  const { data: liveData } = trpc.instagram.getLiveData.useQuery(
    { accountId: selectedAccount.id },
    { staleTime: 120_000, enabled: !!selectedAccount.id }
  );
  const { data: dbPosts } = trpc.instagram.getPosts.useQuery(
    { accountId: selectedAccount.id, limit: 100 },
    { staleTime: 120_000, enabled: !!selectedAccount.id }
  );
  const { data: allAccounts } = trpc.instagram.getAccounts.useQuery(
    undefined,
    { staleTime: 120_000 }
  );

  const accountName = (selectedAccount as any).accountName ?? (selectedAccount as any).accountHandle ?? selectedAccount.username ?? "Conta";
  const followers = (liveData as any)?.followers ?? (liveData as any)?.accountInfo?.followers ?? 0;
  const posts = dbPosts ?? [];

  const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments ?? 0), 0);
  const totalShares = posts.reduce((s, p) => s + (p.shares ?? 0), 0);
  const avgEng = followers > 0 && posts.length > 0
    ? parseFloat(((totalLikes + totalComments + totalShares) / posts.length / followers * 100).toFixed(2))
    : 0;

  const metricsRows = [
    { "Métrica": "Seguidores", "Valor": followers, "Período": selectedPeriod },
    { "Métrica": "Curtidas (total posts)", "Valor": totalLikes, "Período": selectedPeriod },
    { "Métrica": "Comentários (total posts)", "Valor": totalComments, "Período": selectedPeriod },
    { "Métrica": "Compartilhamentos (total posts)", "Valor": totalShares, "Período": selectedPeriod },
    { "Métrica": "Taxa de Engajamento (%)", "Valor": avgEng, "Período": selectedPeriod },
    { "Métrica": "Total de Posts", "Valor": posts.length, "Período": selectedPeriod },
  ];

  const postsRows = posts.map((p) => ({
    "ID": (p as any).externalId ?? p.id,
    "Tipo": (p as any).mediaType ?? p.postType ?? "post",
    "Curtidas": p.likes ?? 0,
    "Comentários": p.comments ?? 0,
    "Compartilhamentos": p.shares ?? 0,
    "Visualizações": (p as any).views ?? 0,
    "Data": p.postedAt ? new Date(p.postedAt).toLocaleDateString("pt-BR") : "",
    "Legenda": (p.caption ?? "").slice(0, 100),
  }));

  const hashtagsRows = useMemo(() => {
    const map: Record<string, { posts: number; likes: number }> = {};
    posts.forEach((p) => {
      const tags = ((p.caption ?? "").match(/#\w+/g) ?? []);
      tags.forEach((tag) => {
        if (!map[tag]) map[tag] = { posts: 0, likes: 0 };
        map[tag].posts++;
        map[tag].likes += p.likes ?? 0;
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1].posts - a[1].posts)
      .slice(0, 20)
      .map(([tag, stats]) => ({
        "Hashtag": tag,
        "Posts": stats.posts,
        "Curtidas Totais": stats.likes,
        "Média Curtidas": stats.posts > 0 ? Math.round(stats.likes / stats.posts) : 0,
      }));
  }, [posts]);

  return (
    <div className="p-6 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Exportar Dados</h1>
          </div>
          <span className="text-sm text-muted-foreground">
            Conta: <strong>{accountName}</strong>
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Selecionar Conta</h3>
            <div className="space-y-2">
              {(allAccounts ?? []).map((acc) => (
                <div
                  key={acc.id}
                  className={`w-full text-left p-3 rounded-lg border-2 transition ${
                    selectedAccount.id === acc.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="font-semibold text-gray-900">{acc.accountName}</div>
                  <div className="text-sm text-gray-600">@{acc.accountHandle}</div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2">Para trocar de conta, use o seletor no topo da página.</p>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Selecionar Período</h3>
            <PeriodSelector selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} />
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>{posts.length}</strong> posts disponíveis para exportação.
              </p>
            </div>
          </Card>
        </div>

        {/* Export Options */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Métricas
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="hashtags" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Hashtags
            </TabsTrigger>
          </TabsList>

          {/* Metrics Export */}
          <TabsContent value="metrics" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Exportar Métricas</h3>
              <p className="text-gray-600 mb-6">Métricas principais da conta com dados reais.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Button
                  onClick={() => downloadCSV(metricsRows, `metricas-${accountName}`)}
                  className="bg-green-600 hover:bg-green-700 text-foreground flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar como CSV
                </Button>
                <Button
                  onClick={() => downloadJSON({ account: accountName, period: selectedPeriod, metrics: metricsRows }, `metricas-${accountName}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-foreground flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar como JSON
                </Button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Prévia</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-600">Seguidores</p>
                    <p className="text-xl font-bold text-gray-900">{followers.toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-600">Curtidas</p>
                    <p className="text-xl font-bold text-gray-900">{totalLikes.toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-600">Engajamento</p>
                    <p className="text-xl font-bold text-gray-900">{avgEng}%</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-600">Comentários</p>
                    <p className="text-xl font-bold text-gray-900">{totalComments.toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-600">Compartilhamentos</p>
                    <p className="text-xl font-bold text-gray-900">{totalShares.toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-600">Total de Posts</p>
                    <p className="text-xl font-bold text-gray-900">{posts.length}</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Posts Export */}
          <TabsContent value="posts" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Exportar Posts</h3>
              <p className="text-gray-600 mb-6">
                Dados detalhados de todos os {posts.length} posts da conta.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Button
                  onClick={() => downloadCSV(postsRows, `posts-${accountName}`)}
                  className="bg-green-600 hover:bg-green-700 text-foreground flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar como CSV
                </Button>
                <Button
                  onClick={() => downloadJSON(postsRows, `posts-${accountName}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-foreground flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar como JSON
                </Button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                <h4 className="font-semibold text-gray-900 mb-3">Prévia (primeiros 5 posts)</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-600">Tipo</th>
                      <th className="text-left py-2 px-3 text-gray-600">Curtidas</th>
                      <th className="text-left py-2 px-3 text-gray-600">Comentários</th>
                      <th className="text-left py-2 px-3 text-gray-600">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postsRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-900">{row["Tipo"]}</td>
                        <td className="py-2 px-3 text-gray-900">{row["Curtidas"]}</td>
                        <td className="py-2 px-3 text-gray-900">{row["Comentários"]}</td>
                        <td className="py-2 px-3 text-gray-900">{row["Data"]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Hashtags Export */}
          <TabsContent value="hashtags" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Exportar Hashtags</h3>
              <p className="text-gray-600 mb-6">
                Top {hashtagsRows.length} hashtags extraídas das legendas dos posts.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Button
                  onClick={() => downloadCSV(hashtagsRows, `hashtags-${accountName}`)}
                  className="bg-green-600 hover:bg-green-700 text-foreground flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar como CSV
                </Button>
                <Button
                  onClick={() => downloadJSON(hashtagsRows, `hashtags-${accountName}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-foreground flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar como JSON
                </Button>
              </div>

              {hashtagsRows.length > 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                  <h4 className="font-semibold text-gray-900 mb-3">Top Hashtags</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-gray-600">Hashtag</th>
                        <th className="text-left py-2 px-3 text-gray-600">Posts</th>
                        <th className="text-left py-2 px-3 text-gray-600">Curtidas Totais</th>
                        <th className="text-left py-2 px-3 text-gray-600">Média</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hashtagsRows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 px-3 font-medium text-blue-600">{row["Hashtag"]}</td>
                          <td className="py-2 px-3 text-gray-900">{row["Posts"]}</td>
                          <td className="py-2 px-3 text-gray-900">{row["Curtidas Totais"]}</td>
                          <td className="py-2 px-3 text-gray-900">{row["Média Curtidas"]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <Eye className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Nenhuma hashtag encontrada nas legendas dos posts.</p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
