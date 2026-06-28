/**
 * Página: Relatórios para Clientes
 * PDFs mensais automáticos com branding Zênite Tech.
 * Inclui formulário de personalização antes de gerar o relatório.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText, Download, Plus, Send, Users, Calendar, Clock,
  Loader2, XCircle, Settings2, BarChart2, TrendingUp, CheckSquare,
  ListChecks, MessageSquare, Pencil, ExternalLink, FileDown,
} from "lucide-react";
import { exportDataToPdf } from "@/lib/exportPdf";
import type { PieSectionData } from "@/lib/exportPdf";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  sent: "bg-green-500/20 text-green-400",
  generated: "bg-blue-500/20 text-blue-400",
  failed: "bg-red-500/20 text-red-400",
  pending: "bg-yellow-500/20 text-yellow-400",
};

const statusLabels: Record<string, string> = {
  sent: "Enviado",
  generated: "Gerado",
  failed: "Falhou",
  pending: "Pendente",
};

const productOptions = [
  { value: "guardia", label: "GuardIA" },
  { value: "wallbox", label: "Wallbox / Recarga Veicular" },
  { value: "zipy", label: "ZIPY WhatsApp" },
  { value: "relogio", label: "Relógio de Ponto" },
  { value: "catraca", label: "Catraca / Controle de Acesso" },
  { value: "conciergia", label: "ConciergIA" },
  { value: "zface", label: "Zface" },
  { value: "zblock", label: "Zblock" },
];

type Client = {
  id: number;
  name: string;
  product: string;
  email: string;
  adGroupFilter: string;
  active: boolean;
};

type CustomizationForm = {
  customTitle: string;
  customMessage: string;
  month: string;
  includeSections: {
    kpis: boolean;
    weeklyLeads: boolean;
    comparison: boolean;
    nextSteps: boolean;
  };
};

const DEFAULT_CUSTOMIZATION: CustomizationForm = {
  customTitle: "",
  customMessage: "",
  month: new Date().toISOString().slice(0, 7),
  includeSections: {
    kpis: true,
    weeklyLeads: true,
    comparison: true,
    nextSteps: true,
  },
};

export default function RelatoriosClientes() {
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", product: "", email: "", adGroupFilter: "" });
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);

  // Estado do formulário de personalização
  const [showCustomize, setShowCustomize] = useState(false);
  const [customizeTarget, setCustomizeTarget] = useState<Client | null>(null);
  const [customization, setCustomization] = useState<CustomizationForm>(DEFAULT_CUSTOMIZATION);

  const { data: clients, refetch: refetchClients } = trpc.clientReport.listClients.useQuery();
  const { data: reports, refetch: refetchReports } = trpc.clientReport.getHistory.useQuery({});

  const createClient = trpc.clientReport.createClient.useMutation({
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso");
      setShowNewClient(false);
      setNewClient({ name: "", product: "", email: "", adGroupFilter: "" });
      refetchClients();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const generateReport = trpc.clientReport.generate.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Relatório gerado com sucesso!`, {
          description: `${result.metrics?.totalLeads ?? 0} leads | CPL: R$${result.cpl?.toFixed(2) ?? "—"}`,
        });
        refetchReports();
      }
      setGeneratingFor(null);
      setShowCustomize(false);
    },
    onError: (e) => {
      toast.error(`Erro ao gerar relatório`, { description: e.message });
      setGeneratingFor(null);
    },
  });

  const deleteClient = trpc.clientReport.deleteClient.useMutation({
    onSuccess: () => {
      toast.success("Cliente removido");
      refetchClients();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const handleOpenCustomize = (client: Client) => {
    setCustomizeTarget(client);
    setCustomization({
      ...DEFAULT_CUSTOMIZATION,
      customTitle: `Relatório de Performance — ${productOptions.find(p => p.value === client.product)?.label ?? client.product} — ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} — Zênite Tech`,
    });
    setShowCustomize(true);
  };

  const handleGenerate = () => {
    if (!customizeTarget) return;
    setGeneratingFor(customizeTarget.id);
    generateReport.mutate({
      clientId: customizeTarget.id,
      month: customization.month,
      customTitle: customization.customTitle || undefined,
      customMessage: customization.customMessage || undefined,
      includeSections: customization.includeSections,
    });
  };

  // Cores para o gráfico de pizza no PDF
  const PIE_COLORS = ["#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#06B6D4", "#F97316", "#84CC16"];

  // Exportar relatório como PDF estruturado
  const handleExportPdf = (report: typeof reports extends (infer T)[] | undefined ? T : never) => {
    const clientName = (clients as Client[] | undefined)?.find(c => c.id === report.clientId)?.name ?? `Cliente #${report.clientId}`;
    const productLabel = (clients as Client[] | undefined)?.find(c => c.id === report.clientId)
      ? productOptions.find(p => p.value === (clients as Client[]).find(c => c.id === report.clientId)?.product)?.label ?? ""
      : "";

    // Montar dados do gráfico de pizza com base nas seções selecionadas
    const includedSections = (report as any).includeSections as string[] | null | undefined;
    const sectionNames: Record<string, string> = {
      overview: "Visão Geral",
      campaigns: "Campanhas",
      keywords: "Palavras-chave",
      adGroups: "Grupos de Anúncios",
      conversions: "Conversões",
      budget: "Orçamento",
    };
    const pieItems = includedSections && includedSections.length > 0
      ? includedSections.map((s, i) => ({
          name: sectionNames[s] ?? s,
          value: Math.round(100 / includedSections.length),
          color: PIE_COLORS[i % PIE_COLORS.length],
        }))
      : Object.keys(sectionNames).map((s, i) => ({
          name: sectionNames[s],
          value: Math.round(100 / Object.keys(sectionNames).length),
          color: PIE_COLORS[i % PIE_COLORS.length],
        }));

    // Se tiver dados de leads e CPL, usar como distribuição real
    const hasRealData = report.totalLeads != null && report.avgCpl != null;
    const budgetPieData: PieSectionData = hasRealData
      ? {
          items: [
            { name: "Leads Gerados", value: Number(report.totalLeads ?? 0), color: "#10B981" },
            { name: "CPL Médio (R$)", value: Number(report.avgCpl ?? 0), color: "#3B82F6" },
          ],
          totalLabel: "Total de Leads",
          formatValue: (v) => v.toFixed(0),
        }
      : {
          items: pieItems,
          totalLabel: "Total de Seções",
          formatValue: (v) => `${v}%`,
        };

    exportDataToPdf({
      title: `Relatório de Performance — ${productLabel || clientName}`,
      subtitle: `${clientName} · Mês: ${report.month} · Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      filename: `relatorio-${clientName.toLowerCase().replace(/\s+/g, "-")}-${report.month}.pdf`,
      sections: [
        {
          title: "Resumo do Relatório",
          rows: [
            { label: "Cliente", value: clientName },
            { label: "Produto", value: productLabel || "—" },
            { label: "Mês de Referência", value: report.month },
            { label: "Status", value: statusLabels[report.status] ?? report.status },
            { label: "Total de Leads", value: report.totalLeads != null ? String(report.totalLeads) : "—", highlight: true },
            { label: "CPL Médio", value: report.avgCpl != null ? `R$ ${Number(report.avgCpl).toFixed(2)}` : "—", highlight: true },
            { label: "Data de Envio", value: report.sentAt ? new Date(report.sentAt).toLocaleDateString("pt-BR") : "Não enviado" },
          ],
        },
        {
          title: "Distribuição de Orçamento por Campanha",
          rows: [],
          pieChart: budgetPieData,
        },
        ...(report.pdfUrl ? [{
          title: "Acesso ao Relatório",
          rows: [
            { label: "PDF Gerado", value: "Disponível — acesse pelo botão PDF na lista" },
          ],
        }] : []),
      ],
    });
  };

  const handleQuickGenerate = (clientId: number) => {
    setGeneratingFor(clientId);
    generateReport.mutate({
      clientId,
      month: new Date().toISOString().slice(0, 7),
    });
  };

  const toggleSection = (key: keyof CustomizationForm["includeSections"]) => {
    setCustomization(prev => ({
      ...prev,
      includeSections: {
        ...prev.includeSections,
        [key]: !prev.includeSections[key],
      },
    }));
  };

  const sectionOptions = [
    { key: "kpis" as const, label: "KPIs do Mês", icon: BarChart2, desc: "Leads, gasto, CTR, CPL" },
    { key: "weeklyLeads" as const, label: "Leads por Semana", icon: TrendingUp, desc: "Gráfico de evolução semanal" },
    { key: "comparison" as const, label: "Comparação Mensal", icon: CheckSquare, desc: "Mês atual vs. mês anterior" },
    { key: "nextSteps" as const, label: "Próximos Passos (IA)", icon: ListChecks, desc: "Recomendações geradas por IA" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-400" />
            Relatórios para Clientes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            PDFs mensais automáticos com branding Zênite Tech — enviados no dia 1 de cada mês
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-border text-muted-foreground hover:bg-muted"
            onClick={() => window.location.href = "/admin-clientes"}
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Gerenciar Clientes
          </Button>
          <Dialog open={showNewClient} onOpenChange={setShowNewClient}>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowNewClient(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-muted-foreground text-sm">Nome do Cliente / Empresa</Label>
                  <Input
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    placeholder="Ex: Condomínio Parque das Flores"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Produto Zênite Tech</Label>
                  <Select value={newClient.product} onValueChange={(v) => setNewClient({ ...newClient, product: v })}>
                    <SelectTrigger className="bg-muted border-border text-foreground mt-1">
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">E-mail para envio do relatório</Label>
                  <Input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="contato@empresa.com.br"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Filtro de grupos de anúncios (palavra-chave)</Label>
                  <Input
                    value={newClient.adGroupFilter}
                    onChange={(e) => setNewClient({ ...newClient, adGroupFilter: e.target.value })}
                    placeholder="Ex: GuardIA, Wallbox, Recarga"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                  <p className="text-slate-500 text-xs mt-1">Grupos cujo nome contenha esta palavra serão incluídos no relatório</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => createClient.mutate(newClient)}
                    disabled={createClient.isPending || !newClient.name || !newClient.product}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {createClient.isPending ? "Salvando..." : "Cadastrar"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewClient(false)} className="border-border text-muted-foreground">
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Info automação */}
      <Card className="bg-blue-900/20 border-blue-500/30">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-blue-300 text-sm font-medium">Envio automático todo dia 1 às 9h</p>
              <p className="text-muted-foreground text-xs mt-1">
                O sistema gera automaticamente os PDFs de todos os clientes ativos e envia por e-mail com assunto "Relatório de Performance — [Produto] — [Mês/Ano] — Zênite Tech". O PDF inclui capa com branding, KPIs do mês, gráfico de leads por semana, comparação com mês anterior e próximos passos gerados por IA.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de clientes */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Clientes Cadastrados
            <Badge className="bg-muted text-muted-foreground ml-auto">{clients?.length ?? 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!clients || clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum cliente cadastrado.</p>
              <p className="text-xs mt-1">Clique em "Novo Cliente" para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(clients as Client[]).map((client) => (
                <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-sm font-medium">{client.name}</span>
                      <Badge className="bg-slate-600/50 text-muted-foreground text-xs">
                        {productOptions.find(p => p.value === client.product)?.label ?? client.product}
                      </Badge>
                      {client.active ? (
                        <Badge className="bg-green-500/20 text-green-400 text-xs">Ativo</Badge>
                      ) : (
                        <Badge className="bg-slate-500/20 text-muted-foreground text-xs">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs mt-0.5">{client.email}</p>
                    {client.adGroupFilter && (
                      <p className="text-slate-500 text-xs">Filtro: "{client.adGroupFilter}"</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {/* Botão de personalizar e gerar */}
                    <Button
                      size="sm"
                      onClick={() => handleOpenCustomize(client)}
                      disabled={generatingFor === client.id}
                      className="bg-purple-600/80 hover:bg-purple-600 text-xs h-7"
                      title="Personalizar e gerar relatório"
                    >
                      {generatingFor === client.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <><Pencil className="w-3 h-3 mr-1" />Personalizar</>
                      )}
                    </Button>
                    {/* Botão de gerar rápido */}
                    <Button
                      size="sm"
                      onClick={() => handleQuickGenerate(client.id)}
                      disabled={generatingFor === client.id}
                      className="bg-blue-600/80 hover:bg-blue-600 text-xs h-7"
                      title="Gerar relatório com configurações padrão"
                    >
                      {generatingFor === client.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <><Send className="w-3 h-3 mr-1" />Gerar</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteClient.mutate({ id: client.id })}
                      className="border-border text-muted-foreground text-xs h-7"
                      title="Remover cliente"
                    >
                      <XCircle className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de relatórios */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Histórico de Relatórios
            <Badge className="bg-muted text-muted-foreground ml-auto">{reports?.length ?? 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!reports || reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum relatório gerado ainda.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs ${statusColors[report.status] ?? ""}`}>
                      {statusLabels[report.status] ?? report.status}
                    </Badge>
                    <div>
                      <p className="text-muted-foreground text-sm">Cliente #{report.clientId}</p>
                      <p className="text-slate-500 text-xs">{report.month}</p>
                    </div>
                    {report.totalLeads != null && (
                      <div className="text-muted-foreground text-xs hidden sm:block">
                        {report.totalLeads} leads · R${report.avgCpl ?? "—"} CPL
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {report.sentAt && (
                      <span className="text-slate-500 text-xs">
                        {new Date(report.sentAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportPdf(report)}
                      className="border-purple-600/50 text-purple-400 hover:bg-purple-600/20 text-xs h-7"
                      title="Exportar resumo como PDF"
                    >
                      <FileDown className="w-3 h-3 mr-1" />
                      Exportar
                    </Button>
                    {report.pdfUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(report.pdfUrl!, "_blank")}
                        className="border-border text-muted-foreground text-xs h-7"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de personalização do relatório */}
      <Dialog open={showCustomize} onOpenChange={open => !open && setShowCustomize(false)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-purple-400" />
              Personalizar Relatório
            </DialogTitle>
            {customizeTarget && (
              <p className="text-muted-foreground text-sm pt-1">
                Cliente: <span className="text-foreground font-medium">{customizeTarget.name}</span>
              </p>
            )}
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Mês de referência */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Mês de Referência
              </Label>
              <Input
                type="month"
                value={customization.month}
                onChange={e => setCustomization(prev => ({ ...prev, month: e.target.value }))}
                className="bg-muted border-border text-foreground"
              />
            </div>

            {/* Título personalizado */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                Título do Relatório
                <span className="text-slate-500 text-xs">(opcional)</span>
              </Label>
              <Input
                value={customization.customTitle}
                onChange={e => setCustomization(prev => ({ ...prev, customTitle: e.target.value }))}
                placeholder="Relatório de Performance — Produto — Mês — Zênite Tech"
                className="bg-muted border-border text-foreground text-sm"
              />
              <p className="text-slate-500 text-xs">Se vazio, o título padrão será usado automaticamente.</p>
            </div>

            {/* Mensagem personalizada para a IA */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                Contexto para a IA
                <span className="text-slate-500 text-xs">(opcional)</span>
              </Label>
              <Textarea
                value={customization.customMessage}
                onChange={e => setCustomization(prev => ({ ...prev, customMessage: e.target.value }))}
                placeholder="Ex: O cliente está considerando aumentar o orçamento no próximo mês. Foque nos resultados de conversão e destaque o ROI positivo."
                className="bg-muted border-border text-foreground text-sm resize-none"
                rows={3}
              />
              <p className="text-slate-500 text-xs">
                Esta mensagem será enviada à IA para personalizar o resumo executivo e os próximos passos do relatório.
              </p>
            </div>

            {/* Seções a incluir */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5 text-muted-foreground" />
                Seções do Relatório
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {sectionOptions.map(({ key, label, icon: Icon, desc }) => (
                  <div
                    key={key}
                    onClick={() => toggleSection(key)}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      customization.includeSections[key]
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-border bg-muted/30 opacity-60"
                    }`}
                  >
                    <Switch
                      checked={customization.includeSections[key]}
                      onCheckedChange={() => toggleSection(key)}
                      className="mt-0.5 shrink-0"
                      onClick={e => e.stopPropagation()}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-foreground text-xs font-medium">{label}</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCustomize(false)}
              className="border-border text-muted-foreground"
              disabled={generateReport.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generateReport.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {generateReport.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Gerando...</>
              ) : (
                <><Send className="w-4 h-4 mr-1" />Gerar Relatório</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
