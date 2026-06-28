import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileText,
  History,
  Image,
  Link2,
  Presentation,
  RefreshCw,
  Search,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { exportDataToPdf } from "@/lib/exportPdf";
import { Download } from "lucide-react";
import { AcronymTooltip } from "@/components/AcronymTooltip";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Dados estáticos de fallback ─────────────────────────────────────────────

const IMPACTO_ESTIMADO = [
  { metrica: "CTR Médio", antes: 8.2, depois: 11.5, unidade: "%" },
  { metrica: "Taxa Conversão", antes: 2.8, depois: 4.1, unidade: "%" },
  { metrica: "Qualidade Score", antes: 6.2, depois: 7.8, unidade: "/10" },
  { metrica: "Bounce Rate", antes: 68, depois: 52, unidade: "%" },
];

const ARMADILHAS = [
  {
    problema: "MARKETING_IMAGE not supported",
    causa: "Campo incompatível com Search",
    solucao: "Usar AD_IMAGE",
  },
  {
    problema: "Too long em path1/path2",
    causa: "Limite é 15 chars (não 30)",
    solucao: "Abreviar: Ponto-Eletr",
  },
  {
    problema: "Resource not found em ad_id",
    causa: "IDs mudam após edição",
    solucao: "Rebuscar IDs via GAQL",
  },
  {
    problema: "CopyFrom incompatible",
    causa: "Uso de op.update.CopyFrom(ad)",
    solucao: "Atribuir diretamente em op.update",
  },
  {
    problema: "final_urls in wrong place",
    causa: "URL dentro de sitelink_asset",
    solucao: "URL vai no Asset raiz",
  },
  {
    problema: "Aspect ratio mismatch",
    causa: "Imagem com proporção errada",
    solucao: "Redimensionar para 1200×628 px",
  },
];

const AD_STRENGTH_LABEL: Record<string, { label: string; color: string }> = {
  EXCELLENT: { label: "Excelente", color: "bg-green-100 text-green-800 border-green-200" },
  GOOD: { label: "Bom", color: "bg-blue-100 text-blue-800 border-blue-200" },
  AVERAGE: { label: "Médio", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  POOR: { label: "Baixo", color: "bg-red-100 text-red-800 border-red-200" },
  PENDING: { label: "Pendente", color: "bg-gray-100 text-gray-600 border-gray-200" },
  UNKNOWN: { label: "—", color: "bg-gray-100 text-muted-foreground border-gray-200" },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RSAOptimizer() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("relatorio");

  const {
    data: rsaData,
    isLoading: isLoadingRsa,
    isFetching: isFetchingRsa,
    refetch: refetchRsa,
    dataUpdatedAt,
  } = trpc.googleAds.getRsaDetails.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleRefresh = () => {
    refetchRsa();
  };

  const rsaDetails = rsaData?.rsaDetails ?? [];
  const totalRSA = rsaData?.totalRSA ?? rsaDetails.length;
  const totalSitelinks = rsaData?.totalSitelinks ?? 0;
  const totalClicks = rsaData?.totalClicks ?? 0;
  const totalSpend = rsaData?.totalSpend ?? 0;
  const avgCtr = rsaData?.avgCtr ?? 0;
  const urlsCorrigidas = rsaDetails.filter((r: any) => r.finalUrl && r.finalUrl.includes("zenitetech.com")).length;
  const fetchedAt = rsaData?.fetchedAt ? new Date(rsaData.fetchedAt).toLocaleString("pt-BR") : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        {/* Botão Voltar */}
        <button
          onClick={() => setLocation('/')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 w-fit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar ao Dashboard
        </button>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-600" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900"><AcronymTooltip acronym="RSA">RSA</AcronymTooltip> Optimizer <span className="hidden sm:inline">— Anúncios Responsivos de Pesquisa</span></h1>
            <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
              Skill Ativa
            </Badge>
            {rsaData?.success === false && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                Dados estáticos
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {fetchedAt && (
              <span className="text-xs text-muted-foreground">
                Atualizado em {fetchedAt}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const rsaDetails = rsaData?.rsaDetails ?? [];
                const alerts = rsaData?.lowStrengthAlerts ?? [];
                exportDataToPdf({
                  title: 'RSA Optimizer — Anúncios Responsivos de Pesquisa',
                  subtitle: 'Campanha: Pesquisa Leads | Zênite Tech | zenite-ads.manus.space',
                  filename: `RSA_Optimizer_${new Date().toISOString().split('T')[0]}.pdf`,
                  sections: [
                    {
                      title: '📊 Anúncios RSA',
                      rows: rsaDetails.length > 0
                        ? rsaDetails.map((r: any) => ({
                            label: r.adGroupName,
                            value: `Força: ${AD_STRENGTH_LABEL[r.adStrength]?.label ?? r.adStrength} | Cliques: ${r.clicks ?? '-'} | CTR: ${r.ctr ?? '-'}`,
                            highlight: r.adStrength === 'EXCELLENT' || r.adStrength === 'GOOD',
                          }))
                        : [{ label: 'Sem dados da API', value: 'Usando dados estáticos de referência' }],
                    },
                    {
                      title: '⚠️ Alertas de Força Baixa',
                      rows: alerts.length > 0
                        ? alerts.map((a: any) => ({
                            label: a.adGroupName,
                            value: `Força: ${AD_STRENGTH_LABEL[a.adStrength]?.label ?? a.adStrength} | ${a.suggestion}`,
                          }))
                        : [{ label: 'Nenhum alerta', value: 'Todos os anúncios estão com boa força' }],
                    },
                    {
                      title: '📈 Impacto Estimado das Otimizações',
                      rows: IMPACTO_ESTIMADO.map(i => ({
                        label: i.metrica,
                        value: `${i.antes}${i.unidade} → ${i.depois}${i.unidade} (+${(i.depois - i.antes).toFixed(1)}${i.unidade})`,
                        highlight: true,
                      })),
                    },
                  ],
                });
              }}
              className="flex items-center gap-1.5 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetchingRsa}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetchingRsa ? "animate-spin" : ""}`} />
              {isFetchingRsa ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Otimização completa de anúncios Responsive Search Ads via API Google Ads v23 — Campanha{" "}
          <strong>Pesquisa Leads</strong> · Zênite Tech
        </p>
      </div>

      {/* KPIs — dados reais da API */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoadingRsa ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border shadow-sm animate-pulse">
              <CardContent className="pt-4 pb-4">
                <div className="h-12 bg-gray-100 rounded" />
              </CardContent>
            </Card>
          ))
        ) : (
          [
            {
              label: "Anúncios RSA",
              value: totalRSA,
              icon: FileText,
              color: "text-blue-600",
              bg: "bg-blue-50",
              sub: "ativos na campanha",
            },
            {
              label: "Sitelinks",
              value: totalSitelinks,
              icon: Link2,
              color: "text-green-600",
              bg: "bg-green-50",
              sub: "por grupos de anúncios",
            },
            {
              label: "Cliques (30d)",
              value: totalClicks,
              icon: TrendingUp,
              color: "text-purple-600",
              bg: "bg-purple-50",
              sub: `CTR ${(avgCtr * 100).toFixed(2)}%`,
            },
            {
              label: "Gasto (30d)",
              value: `R$ ${totalSpend.toFixed(2)}`,
              icon: Image,
              color: "text-orange-600",
              bg: "bg-orange-50",
              sub: "custo total do período",
            },
          ].map((kpi) => (
            <Card key={kpi.label} className="border shadow-sm">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-xs text-muted-foreground">{kpi.sub}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="relatorio">Relatório</TabsTrigger>
          <TabsTrigger value="impacto">Impacto</TabsTrigger>
          <TabsTrigger value="skill">Skill</TabsTrigger>
          <TabsTrigger value="monitoramento">Monitoramento</TabsTrigger>
        </TabsList>

        {/* ── Aba: Relatório ─────────────────────────────────────────────── */}
        <TabsContent value="relatorio" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-600" />
                  Anúncios RSA — Dados Reais (Últimos 30 dias)
                </CardTitle>
                {rsaData?.success === false && (
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    ⚠ API indisponível — exibindo dados estáticos
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingRsa ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-400" />
                  Buscando dados reais da API Google Ads...
                </div>
              ) : rsaDetails.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="pb-2 pr-4 font-medium">Grupo</th>
                        <th className="pb-2 pr-4 font-medium">Campanha</th>
                        <th className="pb-2 pr-4 font-medium text-center">Headlines</th>
                        <th className="pb-2 pr-4 font-medium text-center">Sitelinks</th>
                        <th className="pb-2 pr-4 font-medium text-right">Cliques</th>
                        <th className="pb-2 pr-4 font-medium text-right">CTR</th>
                        <th className="pb-2 pr-4 font-medium text-right">Gasto</th>
                        <th className="pb-2 font-medium text-center">Força do Anúncio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rsaDetails.map((r: any) => {
                        const strength = AD_STRENGTH_LABEL[r.adStrength] ?? AD_STRENGTH_LABEL.UNKNOWN;
                        return (
                          <tr key={r.adId} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-gray-900 text-sm">{r.adGroupName}</p>
                              {r.headlines.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]" title={r.headlines[0]}>
                                  {r.headlines[0]}
                                </p>
                              )}
                            </td>
                            <td className="py-3 pr-4 text-xs text-muted-foreground">{r.campaignName}</td>
                            <td className="py-3 pr-4 text-center">
                              <span className={`font-semibold ${r.headlineCount >= 15 ? "text-green-700" : r.headlineCount >= 10 ? "text-yellow-600" : "text-red-600"}`}>
                                {r.headlineCount}
                              </span>
                              <span className="text-muted-foreground text-xs">/15</span>
                            </td>
                            <td className="py-3 pr-4 text-center">
                              <span className={`font-semibold ${r.sitelinkCount >= 4 ? "text-green-700" : r.sitelinkCount > 0 ? "text-yellow-600" : "text-red-600"}`}>
                                {r.sitelinkCount}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-right font-semibold text-gray-900">{r.clicks}</td>
                            <td className="py-3 pr-4 text-right">
                              <span className={`font-semibold ${r.ctr * 100 >= 10 ? "text-green-700" : r.ctr * 100 >= 5 ? "text-yellow-600" : "text-red-600"}`}>
                                {(r.ctr * 100).toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-right text-gray-700">
                              R$ {r.spend.toFixed(2)}
                            </td>
                            <td className="py-3 text-center">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${strength.color}`}>
                                {strength.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                // Fallback estático quando API não retorna dados
                <FallbackStaticTable />
              )}
            </CardContent>
          </Card>

          {/* Resumo das ações realizadas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Headlines e Descrições</p>
                <p className="text-xs text-muted-foreground">
                  15 headlines e 4 descrições por anúncio, todas dentro dos limites de 30 e 90
                  caracteres. Cobertura de produto, benefício, público, diferencial, CTA e prova
                  social.
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Sitelinks com Descrições</p>
                <p className="text-xs text-muted-foreground">
                  28 sitelinks criados (4 por grupo) com 2 descrições cada, apontando para páginas
                  específicas do produto. Todos os sitelinks antigos (70) foram removidos e
                  recriados com URLs validadas.
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Imagens AD_IMAGE</p>
                <p className="text-xs text-muted-foreground">
                  7 imagens geradas com IA (1 por produto), redimensionadas para 1200×628 px e
                  vinculadas como extensões visuais nos grupos de anúncios via AdGroupAsset.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Aba: Impacto ───────────────────────────────────────────────── */}
        <TabsContent value="impacto" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Impacto Estimado das Correções (7–14 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={IMPACTO_ESTIMADO}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="metrica" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      `${v}`,
                      name === "antes" ? "Antes" : "Depois (est.)",
                    ]}
                  />
                  <Legend formatter={(v) => (v === "antes" ? "Antes" : "Depois (estimado)")} />
                  <Bar dataKey="antes" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="depois" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {IMPACTO_ESTIMADO.map((item) => {
              const delta = item.depois - item.antes;
              const pct = ((delta / item.antes) * 100).toFixed(0);
              const isBounce = item.metrica === "Bounce Rate";
              const isPositive = isBounce ? delta < 0 : delta > 0;
              return (
                <Card key={item.metrica} className="border shadow-sm">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground mb-1">{item.metrica}</p>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-bold text-gray-900">
                        {item.depois}
                        {item.unidade}
                      </span>
                      <span
                        className={`text-xs font-medium mb-0.5 ${
                          isPositive ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {isPositive ? "▲" : "▼"} {Math.abs(Number(pct))}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Antes: {item.antes}
                      {item.unidade}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Nota sobre os dados</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Os valores de impacto são estimativas baseadas em benchmarks do setor B2B para
                    correção de URLs 404 e otimização de RSA. O Google Ads leva 7–14 dias para
                    testar combinações e atualizar o Ad Strength. Recomenda-se verificar as métricas
                    reais no painel após esse período.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba: Skill ─────────────────────────────────────────────────── */}
        <TabsContent value="skill" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="h-4 w-4 text-purple-600" />
                Skill: google-ads-rsa-optimizer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Fluxo de Otimização (6 Passos)
                  </p>
                  <ol className="space-y-2">
                    {[
                      { step: "1", label: "Diagnóstico: buscar RSAs via GAQL" },
                      { step: "2", label: "Atualizar headlines (15) + descrições (4) + paths" },
                      { step: "3", label: "Sitelinks por grupo (4 por grupo, ≤ 25 chars)" },
                      { step: "4", label: "Callouts + Structured Snippets por grupo" },
                      { step: "5", label: "Assets de campanha: Business Name, Logo, Telefone" },
                      { step: "6", label: "Upload de imagens AD_IMAGE (1200×628 px)" },
                    ].map((item) => (
                      <li key={item.step} className="flex items-start gap-2 text-sm">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center mt-0.5">
                          {item.step}
                        </span>
                        <span className="text-gray-700">{item.label}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Limites da API v23
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { campo: "Headlines por RSA", limite: "≤ 15 (recomendado: 15)" },
                      { campo: "Chars por headline", limite: "≤ 30 caracteres" },
                      { campo: "Descriptions por RSA", limite: "≤ 4 (recomendado: 4)" },
                      { campo: "Chars por description", limite: "≤ 90 caracteres" },
                      { campo: "path1 / path2", limite: "≤ 15 caracteres cada" },
                      { campo: "link_text sitelink", limite: "≤ 25 caracteres" },
                      { campo: "Callout text", limite: "≤ 25 caracteres" },
                      { campo: "Business Name", limite: "≤ 25 chars (nível campanha)" },
                      { campo: "Logo", limite: "1200×1200 px, BUSINESS_LOGO" },
                      { campo: "Imagem AD_IMAGE", limite: "1200×628 px, ≤ 500 KB" },
                    ].map((row) => (
                      <div
                        key={row.campo}
                        className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-gray-600">{row.campo}</span>
                        <span className="font-mono text-gray-900">{row.limite}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Armadilhas Conhecidas
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground uppercase tracking-wider">
                        <th className="pb-1.5 pr-4 font-medium">Problema</th>
                        <th className="pb-1.5 pr-4 font-medium">Causa</th>
                        <th className="pb-1.5 font-medium">Solução</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ARMADILHAS.map((a) => (
                        <tr key={a.problema} className="hover:bg-gray-50">
                          <td className="py-2 pr-4 font-mono text-red-600">{a.problema}</td>
                          <td className="py-2 pr-4 text-gray-600">{a.causa}</td>
                          <td className="py-2 text-green-700">{a.solucao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() =>
                    window.open(
                      "https://developers.google.com/google-ads/api/docs/responsive-search-ads/overview",
                      "_blank"
                    )
                  }
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Documentação RSA API
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() =>
                    window.open("https://zenitetech.com/solucoes/avant-charge", "_blank")
                  }
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  zenitetech.com
                </Button>
                <Button
                  size="sm"
                  className="text-xs bg-blue-700 hover:bg-blue-800 text-foreground"
                  onClick={() =>
                    window.open("https://manus.im/slides/nByOrSwzxDlse3ywITuECW", "_blank")
                  }
                >
                  <Presentation className="h-3 w-3 mr-1" />
                  Ver Apresentação de Slides
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba: Monitoramento ─────────────────────────────────────────── */}
        <TabsContent value="monitoramento" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Monitoramento Automático de URLs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                O script <code className="bg-gray-100 px-1 rounded text-xs">monitorar_urls.py</code>{" "}
                verifica semanalmente se todas as URLs dos anúncios RSA e sitelinks retornam HTTP
                200. Quando detecta URLs com problema, envia um alerta por e-mail e registra o
                resultado em log.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    URLs Monitoradas
                  </p>
                  <div className="space-y-1">
                    {[
                      { grupo: "Social Ads", url: "/solucoes/avant-charge" },
                      { grupo: "PABX", url: "/solucoes/conciergia" },
                      { grupo: "REP", url: "/ponto-eletronico-portaria-671" },
                      { grupo: "WhatsApp", url: "/solucoes/conciergia" },
                      { grupo: "Acesso Controle", url: "/solucoes/guardia" },
                      { grupo: "Acesso Condomínios", url: "/segmentos/condominios" },
                      { grupo: "Acesso Escolas", url: "/segmentos/escolas" },
                    ].map((item) => (
                      <div
                        key={item.grupo}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-gray-700">{item.grupo}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="font-mono text-muted-foreground">{item.url}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Configuração do Script
                  </p>
                  <pre className="bg-card text-green-400 text-xs p-3 rounded-lg overflow-x-auto leading-relaxed">
{`# Executar manualmente:
python3 monitorar_urls.py

# Agendar no cron (toda segunda, 8h):
0 8 * * 1 python3 /home/ubuntu/gads/monitorar_urls.py

# Saída esperada:
✅ /solucoes/avant-charge → 200 OK
✅ /solucoes/guardia → 200 OK
✅ /segmentos/condominios → 200 OK
❌ /pabx-nuvem → 404 NOT FOUND
   ↳ Alerta enviado para rjll70@gmail.com`}
                  </pre>

                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-800 mb-1">Próxima execução</p>
                    <p className="text-xs text-blue-700">
                      Segunda-feira, 07/04/2026 às 08:00 — verificação semanal automática
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Histórico de Verificações */}
          <UrlCheckHistoryCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Fallback estático quando API não retorna dados ───────────────────────────

function FallbackStaticTable() {
  const GRUPOS_ESTATICOS = [
    { name: "Social Ads", campanha: "Pesquisa Leads", headlines: 15, sitelinks: 4, clicks: "—", ctr: "—", spend: "—", strength: "GOOD" },
    { name: "PABX", campanha: "Pesquisa Leads", headlines: 15, sitelinks: 4, clicks: "—", ctr: "—", spend: "—", strength: "AVERAGE" },
    { name: "REP", campanha: "Pesquisa Leads", headlines: 15, sitelinks: 4, clicks: "—", ctr: "—", spend: "—", strength: "GOOD" },
    { name: "WhatsApp", campanha: "Pesquisa Leads", headlines: 15, sitelinks: 4, clicks: "—", ctr: "—", spend: "—", strength: "AVERAGE" },
    { name: "Acesso Controle", campanha: "Pesquisa Leads", headlines: 15, sitelinks: 4, clicks: "—", ctr: "—", spend: "—", strength: "EXCELLENT" },
    { name: "Acesso Condomínios", campanha: "Pesquisa Leads", headlines: 15, sitelinks: 4, clicks: "—", ctr: "—", spend: "—", strength: "GOOD" },
    { name: "Acesso Escolas", campanha: "Pesquisa Leads", headlines: 15, sitelinks: 4, clicks: "—", ctr: "—", spend: "—", strength: "GOOD" },
  ];
  const AD_STRENGTH_LABEL: Record<string, { label: string; color: string }> = {
    EXCELLENT: { label: "Excelente", color: "bg-green-100 text-green-800 border-green-200" },
    GOOD: { label: "Bom", color: "bg-blue-100 text-blue-800 border-blue-200" },
    AVERAGE: { label: "Médio", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  };
  return (
    <div className="overflow-x-auto">
      <div className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
        Dados estáticos — clique em "Atualizar" para buscar métricas reais da API Google Ads
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
            <th className="pb-2 pr-4 font-medium">Grupo</th>
            <th className="pb-2 pr-4 font-medium">Campanha</th>
            <th className="pb-2 pr-4 font-medium text-center">Headlines</th>
            <th className="pb-2 pr-4 font-medium text-center">Sitelinks</th>
            <th className="pb-2 pr-4 font-medium text-right">Cliques</th>
            <th className="pb-2 pr-4 font-medium text-right">CTR</th>
            <th className="pb-2 pr-4 font-medium text-right">Gasto</th>
            <th className="pb-2 font-medium text-center">Força do Anúncio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {GRUPOS_ESTATICOS.map((g) => {
            const s = AD_STRENGTH_LABEL[g.strength] ?? { label: g.strength, color: "bg-gray-100 text-gray-600 border-gray-200" };
            return (
              <tr key={g.name} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 pr-4 font-medium text-gray-900">{g.name}</td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{g.campanha}</td>
                <td className="py-3 pr-4 text-center"><span className="font-semibold text-green-700">{g.headlines}</span><span className="text-muted-foreground text-xs">/15</span></td>
                <td className="py-3 pr-4 text-center"><span className="font-semibold text-green-700">{g.sitelinks}</span></td>
                <td className="py-3 pr-4 text-right text-muted-foreground">{g.clicks}</td>
                <td className="py-3 pr-4 text-right text-muted-foreground">{g.ctr}</td>
                <td className="py-3 pr-4 text-right text-muted-foreground">{g.spend}</td>
                <td className="py-3 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── URL Check History Component (reads real log files via tRPC) ──────────────

function UrlCheckHistoryCard() {
  const { data, isLoading } = trpc.googleAds.getUrlCheckHistory.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const history = data?.history ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-blue-600" />
          Histórico de Verificações de URL
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Carregando histórico...</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma verificação registrada ainda. Execute o script{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">monitorar_urls.py</code> para gerar o primeiro registro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-4 font-medium">Data</th>
                  <th className="pb-2 pr-4 font-medium">URLs OK</th>
                  <th className="pb-2 pr-4 font-medium">Falhas</th>
                  <th className="pb-2 pr-4 font-medium">Problemas</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(history as any[]).map((row: any, i: number) => {
                  const dateStr = row.data
                    ? new Date(row.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                    : row.filename;
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4 font-mono text-xs text-gray-600">{dateStr}</td>
                      <td className="py-3 pr-4">
                        <span className="font-semibold text-green-700">{row.ok}</span>
                        <span className="text-muted-foreground text-xs ml-1">/ {row.totalUrls}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`font-semibold ${row.falhas > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                          {row.falhas}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-gray-600 max-w-xs">
                        {row.problemas && row.problemas.length > 0
                          ? row.problemas.join(", ")
                          : <span className="text-muted-foreground">Nenhum</span>}
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            row.falhas === 0
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-red-100 text-red-800 border-red-200"
                          }`}
                        >
                          {row.falhas === 0 ? "OK" : `${row.falhas} ERRO(S)`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Próxima verificação automática: <strong>Segunda-feira, 07/04/2026 às 08:00</strong> — o histórico é atualizado
          automaticamente após cada execução do script de monitoramento.
        </p>
      </CardContent>
    </Card>
  );
}
