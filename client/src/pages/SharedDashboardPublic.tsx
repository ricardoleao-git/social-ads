/**
 * SharedDashboardPublic — Página pública de dashboard compartilhado
 * Acessível via /shared/:token sem autenticação
 * Exibe métricas read-only do Google Ads para clientes
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart3, TrendingUp, MousePointerClick, Eye,
  DollarSign, Target, Lock, AlertCircle, Loader2,
  ArrowDownRight, ArrowUpRight,
} from "lucide-react";

export default function SharedDashboardPublic() {
  const [, params] = useRoute("/shared/:token");
  const token = params?.token ?? "";
  const [password, setPassword] = useState("");
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = trpc.sharedDashboard.getPublic.useQuery(
    { token, password: submittedPassword },
    { enabled: !!token, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (data?.error === "password_required" || data?.needsPassword) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 text-blue-600 mx-auto mb-2" />
            <CardTitle>Dashboard Protegido</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Este dashboard requer uma senha para acesso.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); setSubmittedPassword(password); }} className="space-y-4">
              <Input
                type="password"
                placeholder="Digite a senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full">
                Acessar Dashboard
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data?.error || !data?.data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Link Indisponível</h2>
            <p className="text-gray-500">{data?.error ?? "Este link de compartilhamento não foi encontrado ou expirou."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { name, clientName, welcomeMessage, visibleSections, metrics, customLogo, filters: shareFilters } = data.data;
  const visibleMetrics = (shareFilters as any)?.metrics ?? ["impressions", "clicks", "ctr", "cpc", "conversions", "spend", "cpa"];
  const kpis = metrics?.kpis;
  const adGroups = metrics?.adGroups ?? [];
  const trends = metrics?.trends ?? [];
  const funnel = metrics?.funnel;
  const sections = visibleSections ?? ["kpis", "funnel", "trends", "adgroups"];

  const formatNumber = (n: number) => n.toLocaleString("pt-BR");
  const formatCurrency = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {customLogo && (
                <img
                  src={customLogo}
                  alt="Logo"
                  className="w-10 h-10 object-contain rounded"
                />
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">{name}</h1>
                {clientName && (
                  <p className="text-sm text-gray-500 mt-0.5">Preparado para {clientName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Powered by</span>
              <span className="font-semibold text-blue-600">Zênite Tech</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Message */}
        {welcomeMessage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <p className="text-blue-800 text-sm">{welcomeMessage}</p>
          </div>
        )}

        {/* KPIs */}
        {sections.includes("kpis") && kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard
              title="Impressões"
              value={formatNumber(kpis.totalImpressions)}
              icon={<Eye className="w-5 h-5" />}
              color="blue"
            />
            <KpiCard
              title="Cliques"
              value={formatNumber(kpis.totalClicks)}
              icon={<MousePointerClick className="w-5 h-5" />}
              color="green"
              subtitle={`CTR: ${kpis.avgCtr}%`}
            />
            <KpiCard
              title="Conversões"
              value={formatNumber(kpis.totalConversions)}
              icon={<Target className="w-5 h-5" />}
              color="purple"
              subtitle={kpis.cpa > 0 ? `CPA: ${formatCurrency(kpis.cpa)}` : undefined}
            />
            <KpiCard
              title="Investimento"
              value={formatCurrency(kpis.totalSpend)}
              icon={<DollarSign className="w-5 h-5" />}
              color="amber"
              subtitle={`CPC: ${formatCurrency(kpis.avgCpc)}`}
            />
          </div>
        )}

        {/* Funnel */}
        {sections.includes("funnel") && funnel && (
          <Card className="mb-8 bg-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-blue-600" />
                Funil de Conversão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-center gap-8">
                {[
                  { label: "Impressões", value: funnel.impressions, pct: 100 },
                  { label: "Cliques", value: funnel.clicks, pct: funnel.impressions > 0 ? (funnel.clicks / funnel.impressions) * 100 : 0 },
                  { label: "Conversões", value: funnel.conversions, pct: funnel.clicks > 0 ? (funnel.conversions / funnel.clicks) * 100 : 0 },
                ].map((stage, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div
                      className="bg-blue-500 rounded-t-lg transition-all"
                      style={{
                        width: `${Math.max(40, 160 - i * 40)}px`,
                        height: `${Math.max(30, (stage.value / Math.max(funnel.impressions, 1)) * 200)}px`,
                        opacity: 1 - i * 0.2,
                      }}
                    />
                    <div className="text-center mt-2">
                      <p className="font-bold text-gray-900">{formatNumber(stage.value)}</p>
                      <p className="text-xs text-gray-500">{stage.label}</p>
                      {i > 0 && (
                        <p className="text-xs text-blue-600 font-medium">{stage.pct.toFixed(1)}%</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trends */}
        {sections.includes("trends") && trends.length > 0 && (
          <Card className="mb-8 bg-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Tendência Diária
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Data</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Cliques</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Impressões</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">CTR</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">CPC</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Conversões</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.slice(-14).map((day, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-900 font-medium">
                          {new Date(day.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </td>
                        <td className="text-right py-2 px-3">{formatNumber(day.clicks)}</td>
                        <td className="text-right py-2 px-3">{formatNumber(day.impressions)}</td>
                        <td className="text-right py-2 px-3">{day.ctr}%</td>
                        <td className="text-right py-2 px-3">{formatCurrency(day.cpc)}</td>
                        <td className="text-right py-2 px-3">{formatNumber(day.conversions)}</td>
                        <td className="text-right py-2 px-3">{formatCurrency(day.spend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ad Groups */}
        {sections.includes("adgroups") && adGroups.length > 0 && (
          <Card className="mb-8 bg-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Performance por Grupo de Anúncios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Grupo</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Cliques</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">CTR</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">CPC</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Conv.</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(adGroups as any[]).map((group: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div>
                            <p className="text-gray-900 font-medium">{group.name}</p>
                            <p className="text-xs text-gray-400">{group.campaign}</p>
                          </div>
                        </td>
                        <td className="text-right py-2 px-3">{formatNumber(group.clicks)}</td>
                        <td className="text-right py-2 px-3">
                          <span className={group.ctr >= 10 ? "text-green-600 font-medium" : group.ctr >= 5 ? "text-yellow-600" : "text-red-500"}>
                            {group.ctr}%
                          </span>
                        </td>
                        <td className="text-right py-2 px-3">{formatCurrency(group.cpc)}</td>
                        <td className="text-right py-2 px-3 font-medium">{formatNumber(group.conversions)}</td>
                        <td className="text-right py-2 px-3">{formatCurrency(group.spend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-8 text-xs text-gray-400">
          <p>Relatório gerado automaticamente por Zênite Tech</p>
          <p className="mt-1">Dados atualizados em {new Date(data.data.generatedAt).toLocaleString("pt-BR")}</p>
        </div>
      </main>
    </div>
  );
}

// ─── Componente KPI Card ────────────────────────────────────────────────────
function KpiCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "amber";
  subtitle?: string;
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
  };
  const iconColorMap = {
    blue: "text-blue-500",
    green: "text-green-500",
    purple: "text-purple-500",
    amber: "text-amber-500",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">{title}</span>
        <span className={iconColorMap[color]}>{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && <p className="text-xs mt-1 opacity-70">{subtitle}</p>}
    </div>
  );
}
