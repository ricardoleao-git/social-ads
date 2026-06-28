import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Thermometer, Snowflake, Target, TrendingUp, Info, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useMemo } from "react";

const qualColors = {
  quente: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", badge: "bg-red-500 text-white", icon: Flame },
  morno: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30", badge: "bg-yellow-500 text-black", icon: Thermometer },
  frio: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", badge: "bg-blue-500 text-white", icon: Snowflake },
};

export default function LeadQualification() {
  const [limit] = useState(50);
  const { data, isLoading } = trpc.leadsSheet.qualifyLeads.useQuery({ limit });
  const [filter, setFilter] = useState<"all" | "quente" | "morno" | "frio">("all");

  const filtered = useMemo(() => {
    if (!data?.leads) return [];
    if (filter === "all") return data.leads;
    return data.leads.filter((l: any) => l.qualification === filter);
  }, [data?.leads, filter]);

  const stats = data?.stats ?? { quente: 0, morno: 0, frio: 0 };
  const total = stats.quente + stats.morno + stats.frio;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Target className="w-6 h-6 text-orange-400" />
          Qualificação de Leads
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Classificação automática dos leads em Quente, Morno e Frio com base em critérios B2B (conversões, CPA, keyword, dispositivo, campanha)
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-all ${filter === "all" ? "ring-2 ring-blue-400" : "hover:ring-1 hover:ring-muted-foreground/30"}`}
          onClick={() => setFilter("all")}
        >
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{total}</p>
            <p className="text-sm text-muted-foreground">Total de Leads</p>
          </CardContent>
        </Card>

        {(["quente", "morno", "frio"] as const).map((q) => {
          const colors = qualColors[q];
          const Icon = colors.icon;
          const pct = total > 0 ? ((stats[q] / total) * 100).toFixed(0) : "0";
          return (
            <Card
              key={q}
              className={`cursor-pointer transition-all ${colors.bg} ${colors.border} border ${filter === q ? "ring-2 ring-offset-1 ring-offset-background ring-current " + colors.text : "hover:ring-1 hover:ring-muted-foreground/30"}`}
              onClick={() => setFilter(q)}
            >
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                  <span className={`text-3xl font-bold ${colors.text}`}>{stats[q]}</span>
                </div>
                <p className="text-sm text-muted-foreground capitalize">{q} ({pct}%)</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Distribution Bar */}
      {total > 0 && (
        <div className="w-full h-4 rounded-full overflow-hidden flex bg-muted">
          <div className="bg-red-500 h-full transition-all" style={{ width: `${(stats.quente / total) * 100}%` }} />
          <div className="bg-yellow-500 h-full transition-all" style={{ width: `${(stats.morno / total) * 100}%` }} />
          <div className="bg-blue-500 h-full transition-all" style={{ width: `${(stats.frio / total) * 100}%` }} />
        </div>
      )}

      {/* Leads Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Leads Classificados
            <Badge variant="secondary" className="ml-2">{filtered.length} resultados</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum lead encontrado para o filtro selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Score</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Campanha</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Grupo</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Keyword</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Qtd</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">CPA</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Dispositivo</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Motivos</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead: any, idx: number) => {
                    const colors = qualColors[lead.qualification as keyof typeof qualColors];
                    const Icon = colors.icon;
                    return (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2.5 px-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.badge}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {lead.qualification.charAt(0).toUpperCase() + lead.qualification.slice(1)}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className={`font-bold ${colors.text}`}>{lead.score}</span>
                        </td>
                        <td className="py-2.5 px-2 text-foreground">{lead.data}</td>
                        <td className="py-2.5 px-2 text-foreground max-w-[180px] truncate">{lead.campanha}</td>
                        <td className="py-2.5 px-2 text-foreground max-w-[180px] truncate">{lead.grupo}</td>
                        <td className="py-2.5 px-2 text-foreground max-w-[150px] truncate">{lead.keyword || "—"}</td>
                        <td className="py-2.5 px-2 text-foreground font-medium">{lead.quantidade}</td>
                        <td className="py-2.5 px-2 text-foreground">{lead.cpa || "—"}</td>
                        <td className="py-2.5 px-2 text-foreground">{lead.dispositivo || "—"}</td>
                        <td className="py-2.5 px-2">
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <ul className="text-xs space-y-0.5">
                                {lead.reasons.map((r: string, i: number) => (
                                  <li key={i}>• {r}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
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

      {/* Methodology */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">Metodologia de Classificação</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p><strong className="text-foreground">Quente (score ≥ 5):</strong> Múltiplas conversões, CPA baixo, keyword com intenção comercial (empresa, orçamento, comprar), dispositivo desktop</p>
          <p><strong className="text-foreground">Morno (score 3-4):</strong> Pelo menos 1 conversão, CPA moderado, campanha de leads</p>
          <p><strong className="text-foreground">Frio (score ≤ 2):</strong> Poucas conversões, CPA alto, keyword informacional (como, o que é, grátis)</p>
          <p className="text-muted-foreground/70 italic mt-2">Critérios B2B: termos comerciais (+2), desktop (+1), campanha de leads (+1), CPA baixo (+2), múltiplas conversões (+3). Termos informacionais (-1).</p>
        </CardContent>
      </Card>
    </div>
  );
}
