import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ExternalLink, RefreshCw, Search, TrendingUp, Target,
  DollarSign, Calendar, Download, FileText, BarChart3,
} from "lucide-react";
import { toast } from "sonner";

export default function LeadsSheet() {
  const [campaignFilter, setCampaignFilter] = useState("");
  const [adGroupFilter, setAdGroupFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = trpc.leadsSheet.getSummary.useQuery();
  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = trpc.leadsSheet.getLeads.useQuery({
    campaign: campaignFilter || undefined,
    adGroup: adGroupFilter || undefined,
    limit: 200,
  });

  const leads = leadsData?.leads ?? [];
  const filtered = search
    ? leads.filter(l =>
        l.campanha.toLowerCase().includes(search.toLowerCase()) ||
        l.grupo.toLowerCase().includes(search.toLowerCase()) ||
        l.conversao.toLowerCase().includes(search.toLowerCase()) ||
        l.keyword.toLowerCase().includes(search.toLowerCase())
      )
    : leads;

  const handleRefresh = () => {
    refetchSummary();
    refetchLeads();
    toast.success("Dados atualizados!");
  };

  const handleExportCSV = () => {
    if (!filtered.length) return;
    const headers = ["Data", "Campanha", "Grupo", "Conversão", "Qtd", "CPA", "Dispositivo", "Keyword"];
    const rows = filtered.map(l => [l.data, l.campanha, l.grupo, l.conversao, l.quantidade, l.cpa, l.dispositivo, l.keyword]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-zenite-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("CSV exportado!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              Histórico de Leads
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Conversões sincronizadas diariamente do Google Ads para o Google Sheets (Auto-13)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2" disabled={!filtered.length}>
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
            {summary?.sheetsUrl && (
              <a href={summary.sheetsUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" /> Abrir Planilha
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Registros</p>
                  <p className="text-xl font-bold">{summaryLoading ? "..." : (summary?.totalLeads ?? 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Target className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Conversões Totais</p>
                  <p className="text-xl font-bold">{summaryLoading ? "..." : (summary?.totalConversions ?? 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CPA Médio</p>
                  <p className="text-xl font-bold">{summaryLoading ? "..." : (summary?.avgCpa ?? "R$0,00")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
                  <p className="text-xl font-bold">{summaryLoading ? "..." : (summary?.last7Days ?? 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Aviso se planilha vazia */}
        {!leadsLoading && leads.length === 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Planilha ainda sem dados</p>
                  <p className="text-xs text-blue-700 mt-1">
                    O Auto-13 sincroniza as conversões do Google Ads todo dia às 9h30. Os primeiros dados aparecerão amanhã cedo.
                    Você pode <a href={summary?.sheetsUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">abrir a planilha</a> para verificar o status.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros e Tabela */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4" />
              Registros de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="flex gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por campanha, grupo, keyword..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Input
                placeholder="Filtrar por campanha"
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="w-48"
              />
              <Input
                placeholder="Filtrar por grupo"
                value={adGroupFilter}
                onChange={(e) => setAdGroupFilter(e.target.value)}
                className="w-48"
              />
              {(search || campaignFilter || adGroupFilter) && (
                <Button variant="outline" size="sm" onClick={() => { setSearch(""); setCampaignFilter(""); setAdGroupFilter(""); }}>
                  Limpar
                </Button>
              )}
            </div>

            {leadsLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-30" />
                <p>Carregando dados da planilha...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum registro encontrado</p>
                <p className="text-xs mt-1">Ajuste os filtros ou aguarde a próxima sincronização (Auto-13 às 9h30)</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Exibindo {filtered.length} de {leadsData?.total ?? 0} registros
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Campanha</TableHead>
                        <TableHead className="text-xs">Grupo</TableHead>
                        <TableHead className="text-xs">Conversão</TableHead>
                        <TableHead className="text-xs text-right">Qtd</TableHead>
                        <TableHead className="text-xs text-right">CPA</TableHead>
                        <TableHead className="text-xs">Dispositivo</TableHead>
                        <TableHead className="text-xs">Keyword</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((lead, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell className="font-mono">{lead.data}</TableCell>
                          <TableCell className="max-w-[140px] truncate" title={lead.campanha}>{lead.campanha || "—"}</TableCell>
                          <TableCell className="max-w-[140px] truncate" title={lead.grupo}>{lead.grupo || "—"}</TableCell>
                          <TableCell>
                            <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                              {lead.conversao || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{lead.quantidade}</TableCell>
                          <TableCell className="text-right font-mono">{lead.cpa || "—"}</TableCell>
                          <TableCell className="capitalize">{lead.dispositivo || "—"}</TableCell>
                          <TableCell className="max-w-[160px] truncate text-muted-foreground" title={lead.keyword}>{lead.keyword || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Info sobre sincronização */}
        <div className="text-xs text-muted-foreground text-center">
          Dados sincronizados automaticamente pelo Auto-13 todo dia às 9h30 •{" "}
          {summary?.sheetsUrl && (
            <a href={summary.sheetsUrl} target="_blank" rel="noopener noreferrer" className="underline">
              Ver planilha completa no Google Sheets
            </a>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
