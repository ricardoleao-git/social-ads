import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Users, Plus, Search, Brain, Phone, Mail, Building2, TrendingUp,
  DollarSign, Target, ChevronRight, Clock, MessageSquare, X, Star,
  ArrowRight, CheckCircle2, XCircle, Loader2, BarChart3, Filter
} from "lucide-react";

type Stage = "new" | "qualified" | "proposal" | "closed_won" | "closed_lost";
type Source = "google_ads" | "meta_ads" | "organic" | "whatsapp" | "referral" | "other";
type Priority = "low" | "medium" | "high";

const STAGES: { id: Stage; label: string; color: string; bg: string; icon: any }[] = [
  { id: "new", label: "Novos", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: Users },
  { id: "qualified", label: "Qualificados", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", icon: Star },
  { id: "proposal", label: "Proposta", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: Target },
  { id: "closed_won", label: "Fechados (Ganho)", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
  { id: "closed_lost", label: "Perdidos", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: XCircle },
];

const SOURCE_LABELS: Record<Source, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  organic: "Orgânico",
  whatsapp: "WhatsApp",
  referral: "Indicação",
  other: "Outro",
};

const SOURCE_COLORS: Record<Source, string> = {
  google_ads: "bg-blue-500/20 text-blue-300",
  meta_ads: "bg-indigo-500/20 text-indigo-300",
  organic: "bg-green-500/20 text-green-300",
  whatsapp: "bg-emerald-500/20 text-emerald-300",
  referral: "bg-orange-500/20 text-orange-300",
  other: "bg-gray-500/20 text-gray-300",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-red-500/20 text-red-300",
  medium: "bg-yellow-500/20 text-yellow-300",
  low: "bg-gray-500/20 text-gray-300",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

function formatCurrency(value: number | null | undefined) {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function CrmLeads() {
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityType, setActivityType] = useState<"note" | "call" | "email" | "meeting" | "whatsapp">("note");
  const [activityText, setActivityText] = useState("");
  const [movingLead, setMovingLead] = useState<number | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "", email: "", phone: "", company: "",
    source: "other" as Source, sourceCampaign: "",
    estimatedValue: "", product: "", notes: "",
    priority: "medium" as Priority, assignedTo: "",
  });

  const utils = trpc.useUtils();

  const { data: leads = [], isLoading } = trpc.crmLeads.list.useQuery({
    search: search || undefined,
    source: filterSource !== "all" ? filterSource as Source : undefined,
    priority: filterPriority !== "all" ? filterPriority as Priority : undefined,
  });

  const { data: stats } = trpc.crmLeads.getStats.useQuery();

  const { data: leadDetail } = trpc.crmLeads.getById.useQuery(
    { id: selectedLead! },
    { enabled: !!selectedLead }
  );

  const createMutation = trpc.crmLeads.create.useMutation({
    onSuccess: () => {
      utils.crmLeads.list.invalidate();
      utils.crmLeads.getStats.invalidate();
      setShowCreateModal(false);
      setForm({ name: "", email: "", phone: "", company: "", source: "other", sourceCampaign: "", estimatedValue: "", product: "", notes: "", priority: "medium", assignedTo: "" });
      toast.success("Lead criado com sucesso!");
    },
    onError: (e) => toast.error("Erro ao criar lead: " + e.message),
  });

  const moveStageMutation = trpc.crmLeads.moveStage.useMutation({
    onSuccess: () => {
      utils.crmLeads.list.invalidate();
      utils.crmLeads.getStats.invalidate();
      if (selectedLead) utils.crmLeads.getById.invalidate({ id: selectedLead });
      setMovingLead(null);
      toast.success("Lead movido no funil!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deleteMutation = trpc.crmLeads.delete.useMutation({
    onSuccess: () => {
      utils.crmLeads.list.invalidate();
      utils.crmLeads.getStats.invalidate();
      setSelectedLead(null);
      toast.success("Lead removido.");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const addActivityMutation = trpc.crmLeads.addActivity.useMutation({
    onSuccess: () => {
      if (selectedLead) utils.crmLeads.getById.invalidate({ id: selectedLead });
      setShowActivityModal(false);
      setActivityText("");
      toast.success("Atividade registrada!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const qualifyMutation = trpc.crmLeads.qualifyWithAI.useMutation({
    onSuccess: (data) => {
      utils.crmLeads.list.invalidate();
      if (selectedLead) utils.crmLeads.getById.invalidate({ id: selectedLead });
      toast.success(`IA qualificou o lead! Score: ${data.score}/100`);
    },
    onError: (e) => toast.error("Erro na qualificação: " + e.message),
  });

  const leadsByStage = (stage: Stage) => leads.filter((l: any) => l.stage === stage);

  const conversionRate = stats && stats.byStage.new + stats.byStage.qualified + stats.byStage.proposal > 0
    ? Math.round((stats.byStage.closed_won / (stats.byStage.new + stats.byStage.qualified + stats.byStage.proposal + stats.byStage.closed_won + stats.byStage.closed_lost)) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            CRM de Leads
          </h1>
          <p className="text-gray-400 text-sm mt-1">Funil de vendas com qualificação por IA e rastreamento de origem</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Novo Lead
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-xs">Total de Leads</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-xs">Pipeline</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.pipelineValue)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-xs">Receita Fechada</p>
              <p className="text-2xl font-bold text-blue-400">{formatCurrency(stats.totalValue)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-xs">Taxa de Conversão</p>
              <p className="text-2xl font-bold text-yellow-400">{conversionRate}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome, empresa, e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
          />
        </div>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            <SelectItem value="all">Todas origens</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-white">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Funnel */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto">
          {STAGES.map((stage) => {
            const stageLeads = leadsByStage(stage.id);
            const StageIcon = stage.icon;
            return (
              <div key={stage.id} className={`rounded-xl border p-3 ${stage.bg} min-h-[200px]`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <StageIcon className={`w-4 h-4 ${stage.color}`} />
                    <span className={`text-sm font-semibold ${stage.color}`}>{stage.label}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>
                    {stageLeads.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {stageLeads.map((lead: any) => (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLead(lead.id)}
                      className="bg-gray-900/80 border border-gray-700/50 rounded-lg p-3 cursor-pointer hover:border-gray-500 transition-colors"
                    >
                      <p className="text-white text-sm font-medium truncate">{lead.name}</p>
                      {lead.company && <p className="text-gray-400 text-xs truncate">{lead.company}</p>}
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${SOURCE_COLORS[lead.source as Source]}`}>
                          {SOURCE_LABELS[lead.source as Source]}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[lead.priority as Priority]}`}>
                          {PRIORITY_LABELS[lead.priority as Priority]}
                        </span>
                      </div>
                      {lead.estimatedValue && (
                        <p className="text-green-400 text-xs mt-1 font-medium">{formatCurrency(lead.estimatedValue)}</p>
                      )}
                      {lead.aiScore !== null && lead.aiScore !== undefined && (
                        <div className="flex items-center gap-1 mt-1">
                          <Brain className="w-3 h-3 text-purple-400" />
                          <span className="text-purple-400 text-xs">{lead.aiScore}/100</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <p className="text-gray-600 text-xs text-center py-4">Nenhum lead</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead Detail Panel */}
      {selectedLead && leadDetail && (
        <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{leadDetail.lead.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLead(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Lead info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {leadDetail.lead.email && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Mail className="w-4 h-4 text-gray-500" />
                    {leadDetail.lead.email}
                  </div>
                )}
                {leadDetail.lead.phone && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Phone className="w-4 h-4 text-gray-500" />
                    {leadDetail.lead.phone}
                  </div>
                )}
                {leadDetail.lead.company && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    {leadDetail.lead.company}
                  </div>
                )}
                {leadDetail.lead.estimatedValue && (
                  <div className="flex items-center gap-2 text-green-400">
                    <DollarSign className="w-4 h-4" />
                    {formatCurrency(leadDetail.lead.estimatedValue)}
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-1 rounded ${SOURCE_COLORS[leadDetail.lead.source as Source]}`}>
                  {SOURCE_LABELS[leadDetail.lead.source as Source]}
                  {leadDetail.lead.sourceCampaign && ` — ${leadDetail.lead.sourceCampaign}`}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${PRIORITY_COLORS[leadDetail.lead.priority as Priority]}`}>
                  Prioridade {PRIORITY_LABELS[leadDetail.lead.priority as Priority]}
                </span>
              </div>

              {/* AI Score */}
              {leadDetail.lead.aiScore !== null && leadDetail.lead.aiScore !== undefined && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-400 text-sm font-medium">Score IA: {leadDetail.lead.aiScore}/100</span>
                  </div>
                  {leadDetail.lead.aiNextAction && (
                    <p className="text-gray-300 text-xs">{leadDetail.lead.aiNextAction}</p>
                  )}
                </div>
              )}

              {/* Move stage */}
              <div>
                <p className="text-gray-400 text-xs mb-2">Mover no funil:</p>
                <div className="flex flex-wrap gap-2">
                  {STAGES.filter(s => s.id !== leadDetail.lead.stage).map(s => (
                    <Button
                      key={s.id}
                      variant="outline"
                      size="sm"
                      onClick={() => moveStageMutation.mutate({ id: leadDetail.lead.id, stage: s.id })}
                      disabled={moveStageMutation.isPending}
                      className="border-gray-700 text-gray-300 hover:text-white text-xs"
                    >
                      <ArrowRight className="w-3 h-3 mr-1" />
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => qualifyMutation.mutate({ id: leadDetail.lead.id })}
                  disabled={qualifyMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                >
                  {qualifyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Brain className="w-3 h-3 mr-1" />}
                  Qualificar com IA
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowActivityModal(true)}
                  className="border-gray-700 text-gray-300 hover:text-white text-xs"
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Registrar Atividade
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteMutation.mutate({ id: leadDetail.lead.id })}
                  disabled={deleteMutation.isPending}
                  className="border-red-800 text-red-400 hover:text-red-300 text-xs ml-auto"
                >
                  <X className="w-3 h-3 mr-1" />
                  Remover
                </Button>
              </div>

              {/* Activities */}
              <div>
                <p className="text-gray-400 text-xs mb-2 font-medium">Histórico de Atividades ({leadDetail.activities.length})</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {leadDetail.activities.length === 0 ? (
                    <p className="text-gray-600 text-xs">Nenhuma atividade registrada.</p>
                  ) : (
                    leadDetail.activities.map((act: any) => (
                      <div key={act.id} className="bg-gray-800/50 rounded p-2 text-xs">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-gray-500">{act.type}</span>
                          <span className="text-gray-600">·</span>
                          <span className="text-gray-500">{act.author}</span>
                          <span className="text-gray-600">·</span>
                          <span className="text-gray-600">
                            {new Date(act.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-gray-300">{act.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Activity Modal */}
      <Dialog open={showActivityModal} onOpenChange={setShowActivityModal}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Registrar Atividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-400 text-xs">Tipo</Label>
              <Select value={activityType} onValueChange={(v) => setActivityType(v as any)}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="note">Nota</SelectItem>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Descrição</Label>
              <Textarea
                value={activityText}
                onChange={(e) => setActivityText(e.target.value)}
                placeholder="Descreva a atividade..."
                className="bg-gray-800 border-gray-700 text-white mt-1 resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivityModal(false)} className="border-gray-700 text-gray-300">
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!selectedLead || !activityText.trim()) return;
                addActivityMutation.mutate({ leadId: selectedLead, type: activityType, description: activityText });
              }}
              disabled={addActivityMutation.isPending || !activityText.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {addActivityMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Lead Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-gray-400 text-xs">Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Nome completo" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="email@empresa.com" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="(83) 99999-9999" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Empresa</Label>
              <Input value={form.company} onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Nome da empresa" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Produto de Interesse</Label>
              <Input value={form.product} onChange={(e) => setForm(f => ({ ...f, product: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Ex: Wallbox, GuardIA..." />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Origem</Label>
              <Select value={form.source} onValueChange={(v) => setForm(f => ({ ...f, source: v as Source }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Campanha</Label>
              <Input value={form.sourceCampaign} onChange={(e) => setForm(f => ({ ...f, sourceCampaign: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Nome da campanha" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Valor Estimado (R$)</Label>
              <Input type="number" value={form.estimatedValue} onChange={(e) => setForm(f => ({ ...f, estimatedValue: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="0" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v as Priority }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-gray-400 text-xs">Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1 resize-none" rows={2} placeholder="Observações sobre o lead..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} className="border-gray-700 text-gray-300">
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate({
                ...form,
                estimatedValue: form.estimatedValue ? parseInt(form.estimatedValue) : undefined,
              })}
              disabled={createMutation.isPending || !form.name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Criar Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
