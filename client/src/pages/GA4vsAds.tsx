import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import { useState } from "react";
import {
  AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Download,
  ArrowRightLeft, Info, Target, DollarSign, MousePointerClick, Filter
} from "lucide-react";

function exportCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(r => headers.map(h => String(r[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export default function GA4vsAds() {
  const [countryFilter, setCountryFilter] = useState<"all" | "brazil" | "others">("brazil");
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const { data: ga4Summary } = trpc.ga4Real.getSummary.useQuery({ period, countryFilter });
  const { data: ga4Channels } = trpc.ga4Real.getTrafficByChannel.useQuery({ period, countryFilter });
  const { data: adsSummaryRaw } = trpc.googleAds.getSummary.useQuery({ period: "30d" });
  const { data: campaignMetricsRaw } = trpc.googleAds.getCampaignMetrics.useQuery({ period: "30d" });

  const adsSummary = (adsSummaryRaw as any)?.summary;
  const channels = Array.isArray(ga4Channels) ? ga4Channels : (ga4Channels as any)?.channels ?? [];
  const campaigns = Array.isArray(campaignMetricsRaw) ? campaignMetricsRaw : (campaignMetricsRaw as any)?.campaigns ?? [];

  // Canal pago no GA4
  const paidChannel = channels.find((c: any) => c.channel === "Google Ads (Pago)");
  const organicChannel = channels.find((c: any) => c.channel === "Orgânico (SEO)");

  // Discrepâncias
  const adsClicks = adsSummary?.totalClicks ?? 0;
  const ga4PaidSessions = paidChannel?.sessions ?? 0;
  const discrepancyPct = adsClicks > 0 ? Math.abs(adsClicks - ga4PaidSessions) / adsClicks * 100 : 0;

  const adsConversions = adsSummary?.totalConversions ?? 0;
  const ga4PaidConversions = paidChannel?.conversions ?? 0;
  const convDiscrepancyPct = adsConversions > 0 ? Math.abs(adsConversions - ga4PaidConversions) / adsConversions * 100 : 0;

  // Dados para gráfico de comparação
  const comparisonData = [
    {
      metric: "Cliques/Sessões",
      "Google Ads": adsClicks,
      "GA4 (Pago)": ga4PaidSessions,
    },
    {
      metric: "Conversões",
      "Google Ads": adsConversions,
      "GA4 (Pago)": ga4PaidConversions,
    },
  ];

  // Oportunidades identificadas
  const opportunities = [];
  if (organicChannel && organicChannel.conversionRate > 30) {
    opportunities.push({
      type: "high",
      icon: TrendingUp,
      title: "SEO com CVR excepcional",
      desc: `Canal Orgânico tem CVR de ${organicChannel.conversionRate?.toFixed(1)}% — muito acima da média. Considere aumentar investimento em SEO.`,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/30",
    });
  }
  if (discrepancyPct > 30) {
    opportunities.push({
      type: "warning",
      icon: AlertTriangle,
      title: "Discrepância de rastreamento",
      desc: `${discrepancyPct.toFixed(0)}% de diferença entre cliques do Google Ads e sessões pagas no GA4. Verifique o tag de conversão e o parâmetro UTM.`,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10 border-yellow-500/30",
    });
  }
  if (paidChannel && paidChannel.engagementRate > 50) {
    opportunities.push({
      type: "positive",
      icon: CheckCircle,
      title: "Engajamento pago acima da média",
      desc: `Sessões pagas têm ${paidChannel.engagementRate?.toFixed(1)}% de engajamento — indica qualidade de tráfego e alinhamento de landing page.`,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/30",
    });
  }
  if (adsConversions > 0 && ga4PaidConversions < adsConversions * 0.5) {
    opportunities.push({
      type: "warning",
      icon: AlertTriangle,
      title: "GA4 registra menos conversões que o Google Ads",
      desc: `Google Ads: ${adsConversions} conv. | GA4 (canal pago): ${ga4PaidConversions} conv. Isso pode indicar conversões off-site (ligação, WhatsApp) não rastreadas no GA4.`,
      color: "text-orange-400",
      bg: "bg-orange-500/10 border-orange-500/30",
    });
  }

  const csvData = [
    { fonte: "Google Ads", cliques_sessoes: adsClicks, conversoes: adsConversions, cpa_r: adsSummary?.totalSpend ? (adsSummary.totalSpend / adsConversions).toFixed(2) : "—", gasto_r: adsSummary?.totalSpend?.toFixed(2) ?? "—" },
    { fonte: "GA4 (Canal Pago)", cliques_sessoes: ga4PaidSessions, conversoes: ga4PaidConversions, cpa_r: "—", gasto_r: "—" },
    { fonte: "GA4 (Orgânico)", cliques_sessoes: organicChannel?.sessions ?? 0, conversoes: organicChannel?.conversions ?? 0, cpa_r: "—", gasto_r: "—" },
    { fonte: "GA4 (Direto)", cliques_sessoes: channels.find((c: any) => c.channel === "Direto")?.sessions ?? 0, conversoes: channels.find((c: any) => c.channel === "Direto")?.conversions ?? 0, cpa_r: "—", gasto_r: "—" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ArrowRightLeft className="w-6 h-6 text-violet-500" />
              GA4 vs Google Ads — Comparação
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Análise de discrepâncias e oportunidades · Últimos 30 dias · Dados reais
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro Período */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {(["7d", "30d", "90d"] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 font-medium transition-colors ${period === p ? "bg-violet-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                  {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
                </button>
              ))}
            </div>
            {/* Filtro País */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {(["brazil", "all", "others"] as const).map(f => (
                <button key={f} onClick={() => setCountryFilter(f)}
                  className={`px-3 py-1.5 font-medium transition-colors ${countryFilter === f ? "bg-blue-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                  {f === "all" ? "🌐 Global" : f === "brazil" ? "🇧🇷 Brasil" : "🌍 Outros"}
                </button>
              ))}
            </div>
            <button
              onClick={() => exportCSV(csvData, "ga4-vs-google-ads-comparacao.csv")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 rounded-lg border border-border transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Cards de Comparação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Cliques (Google Ads)",
              value: adsClicks.toLocaleString("pt-BR"),
              sub: "Cliques registrados na plataforma",
              icon: MousePointerClick,
              color: "text-blue-500",
              border: "border-blue-500/30",
            },
            {
              label: "Sessões Pagas (GA4)",
              value: ga4PaidSessions.toLocaleString("pt-BR"),
              sub: `Discrepância: ${discrepancyPct.toFixed(0)}%`,
              icon: MousePointerClick,
              color: discrepancyPct > 30 ? "text-yellow-400" : "text-emerald-400",
              border: discrepancyPct > 30 ? "border-yellow-500/30" : "border-emerald-500/30",
            },
            {
              label: "Conversões (Google Ads)",
              value: adsConversions.toLocaleString("pt-BR"),
              sub: `CPA: R$ ${adsSummary?.totalSpend ? (adsSummary.totalSpend / adsConversions).toFixed(2) : "—"}`,
              icon: Target,
              color: "text-orange-500",
              border: "border-orange-500/30",
            },
            {
              label: "Conversões (GA4 Pago)",
              value: ga4PaidConversions.toLocaleString("pt-BR"),
              sub: `Discrepância: ${convDiscrepancyPct.toFixed(0)}%`,
              icon: Target,
              color: convDiscrepancyPct > 50 ? "text-red-400" : "text-emerald-400",
              border: convDiscrepancyPct > 50 ? "border-red-500/30" : "border-emerald-500/30",
            },
          ].map(({ label, value, sub, icon: Icon, color, border }) => (
            <div key={label} className={`rounded-xl border ${border} bg-card p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Gráfico de Comparação */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-violet-400" /> Comparação Visual: Google Ads vs GA4 (Canal Pago)
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparisonData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="metric" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Google Ads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="GA4 (Pago)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela de todos os canais GA4 */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" /> Performance por Canal — GA4 (Últimos 30 dias)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Canal</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Sessões</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">% Total</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Engajamento</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Conversões</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">CVR</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c: any) => (
                  <tr key={c.channel} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2 font-medium text-foreground flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color ?? "#94a3b8" }} />
                      {c.channel}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{c.sessions}</td>
                    <td className="py-2 text-right text-muted-foreground">{c.pct?.toFixed(1)}%</td>
                    <td className="py-2 text-right">
                      <span className={c.engagementRate > 50 ? "text-emerald-400 font-semibold" : "text-muted-foreground"}>
                        {c.engagementRate?.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 text-right font-bold text-orange-400">{c.conversions}</td>
                    <td className="py-2 text-right">
                      <span className={c.conversionRate > 20 ? "text-emerald-400 font-bold" : c.conversionRate > 10 ? "text-blue-400" : "text-muted-foreground"}>
                        {c.conversionRate?.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Oportunidades Identificadas */}
        {opportunities.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" /> Oportunidades e Alertas Identificados
            </h2>
            <div className="space-y-2">
              {opportunities.map((op, i) => (
                <div key={i} className={`rounded-lg border p-3 ${op.bg}`}>
                  <div className="flex items-start gap-2">
                    <op.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${op.color}`} />
                    <div>
                      <p className={`text-xs font-semibold ${op.color}`}>{op.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{op.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nota metodológica */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Por que os números diferem?
          </h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>• <strong className="text-foreground">Cliques vs Sessões:</strong> Um clique pode gerar múltiplas sessões (recarregamentos) ou zero sessões (bounce imediato antes do GA4 carregar).</p>
            <p>• <strong className="text-foreground">Conversões:</strong> Google Ads conta conversões por clique (incluindo WhatsApp, ligação). GA4 conta eventos de conversão no site — conversões off-site não aparecem no GA4.</p>
            <p>• <strong className="text-foreground">Atribuição:</strong> Google Ads usa modelo de atribuição baseado em clique. GA4 usa modelo baseado em sessão/evento.</p>
            <p>• <strong className="text-foreground">Discrepância esperada:</strong> Até 20% é normal. Acima de 30% requer investigação de UTM e tags.</p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          Dados reais · Google Analytics 4 API + Google Ads API · Atualizado em {new Date().toLocaleDateString("pt-BR")}
        </div>
      </div>
    </DashboardLayout>
  );
}
