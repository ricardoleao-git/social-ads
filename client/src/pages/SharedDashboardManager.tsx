/**
 * SharedDashboardManager — Gestão de links de compartilhamento
 * Permite criar, listar, copiar e revogar links públicos do dashboard
 * Inclui personalização por cliente: logo, seções visíveis, métricas
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Share2, Plus, Copy, Trash2, Eye, EyeOff, Link2,
  ExternalLink, Clock, Loader2, Check, RefreshCw,
  Upload, Image, Lock, X,
} from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_SECTIONS = [
  { id: "kpis", label: "KPIs Principais", description: "Impressões, Cliques, Conversões, Investimento" },
  { id: "funnel", label: "Funil de Conversão", description: "Impressões → Cliques → Conversões" },
  { id: "trends", label: "Tendência Diária", description: "Tabela com métricas dia a dia" },
  { id: "adgroups", label: "Grupos de Anúncios", description: "Performance por grupo de anúncios" },
];

const AVAILABLE_METRICS = [
  { id: "impressions", label: "Impressões" },
  { id: "clicks", label: "Cliques" },
  { id: "ctr", label: "CTR (%)" },
  { id: "cpc", label: "CPC (R$)" },
  { id: "conversions", label: "Conversões" },
  { id: "spend", label: "Investimento (R$)" },
  { id: "cpa", label: "CPA (R$)" },
];

export default function SharedDashboardManager() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWelcome, setNewWelcome] = useState("");
  const [newExpiry, setNewExpiry] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [newType, setNewType] = useState<"executive_summary" | "campaign_detail" | "client_report" | "custom">("executive_summary");
  const [selectedSections, setSelectedSections] = useState<string[]>(["kpis", "funnel", "trends", "adgroups"]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["impressions", "clicks", "ctr", "cpc", "conversions", "spend", "cpa"]);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: shares, isLoading } = trpc.sharedDashboard.list.useQuery();

  const createMutation = trpc.sharedDashboard.create.useMutation({
    onSuccess: (data) => {
      toast.success("Link criado com sucesso!");
      utils.sharedDashboard.list.invalidate();
      resetForm();
      const url = `${window.location.origin}${data.shareUrl}`;
      navigator.clipboard.writeText(url);
      toast.info("Link copiado para a área de transferência!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const revokeMutation = trpc.sharedDashboard.revoke.useMutation({
    onSuccess: () => { toast.success("Link desativado"); utils.sharedDashboard.list.invalidate(); },
  });

  const reactivateMutation = trpc.sharedDashboard.reactivate.useMutation({
    onSuccess: () => { toast.success("Link reativado"); utils.sharedDashboard.list.invalidate(); },
  });

  const deleteMutation = trpc.sharedDashboard.delete.useMutation({
    onSuccess: () => { toast.success("Link removido"); utils.sharedDashboard.list.invalidate(); },
  });

  const resetForm = () => {
    setShowCreateForm(false);
    setNewName("");
    setNewWelcome("");
    setNewExpiry("");
    setNewPassword("");
    setLogoUrl("");
    setLogoPreview("");
    setSelectedSections(["kpis", "funnel", "trends", "adgroups"]);
    setSelectedMetrics(["impressions", "clicks", "ctr", "cpc", "conversions", "spend", "cpa"]);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem (PNG, JPG, SVG)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 2MB");
      return;
    }

    // Preview local
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload via API
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-logo", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setLogoUrl(data.url);
        toast.success("Logo enviado com sucesso!");
      } else {
        // Fallback: usar preview local como URL (base64)
        setLogoUrl(reader.result as string);
        toast.info("Logo salvo localmente");
      }
    } catch {
      // Fallback: usar preview local
      setLogoUrl(logoPreview || "");
      toast.info("Logo salvo localmente");
    } finally {
      setUploadingLogo(false);
    }
  };

  const toggleSection = (id: string) => {
    setSelectedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleMetric = (id: string) => {
    setSelectedMetrics(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (selectedSections.length === 0) {
      toast.error("Selecione pelo menos uma seção");
      return;
    }
    createMutation.mutate({
      name: newName,
      dashboardType: newType,
      welcomeMessage: newWelcome || undefined,
      expiresInDays: newExpiry ? parseInt(newExpiry) : undefined,
      accessPassword: newPassword || undefined,
      visibleSections: selectedSections,
      filters: { metrics: selectedMetrics },
      customLogo: logoUrl || undefined,
    });
  };

  const copyLink = (token: string, id: number) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const typeLabels: Record<string, string> = {
    executive_summary: "Resumo Executivo",
    campaign_detail: "Detalhe de Campanha",
    client_report: "Relatório de Cliente",
    custom: "Personalizado",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Share2 className="w-6 h-6 text-blue-500" />
            Links Compartilhados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie links públicos personalizados para seus clientes visualizarem métricas em tempo real
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Link
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Criar Novo Link Personalizado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dados básicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Nome do Link *</label>
                <Input
                  placeholder="Ex: Relatório Mensal - Abril 2026"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Tipo de Dashboard</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                >
                  <option value="executive_summary">Resumo Executivo</option>
                  <option value="campaign_detail">Detalhe de Campanha</option>
                  <option value="client_report">Relatório de Cliente</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Expiração (dias)</label>
                <Input
                  type="number"
                  placeholder="Sem expiração"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Senha de Acesso</label>
                <Input
                  type="password"
                  placeholder="Opcional"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Mensagem de boas-vindas */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Mensagem de Boas-vindas</label>
              <Input
                placeholder="Ex: Olá! Aqui estão as métricas atualizadas da sua campanha."
                value={newWelcome}
                onChange={(e) => setNewWelcome(e.target.value)}
              />
            </div>

            {/* Logo do Cliente */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                <Image className="w-4 h-4 inline mr-1" />
                Logo do Cliente
              </label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white p-1"
                    />
                    <button
                      onClick={() => { setLogoPreview(""); setLogoUrl(""); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    ) : (
                      <Upload className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                )}
                <div className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {logoPreview ? "Trocar Logo" : "Enviar Logo"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou SVG. Máx 2MB.</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">Ou cole a URL do logo:</label>
                  <Input
                    placeholder="https://..."
                    value={logoUrl && !logoUrl.startsWith("data:") ? logoUrl : ""}
                    onChange={(e) => {
                      setLogoUrl(e.target.value);
                      setLogoPreview(e.target.value);
                    }}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Seções Visíveis */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">Seções Visíveis</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVAILABLE_SECTIONS.map((section) => (
                  <label
                    key={section.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSections.includes(section.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(section.id)}
                      onChange={() => toggleSection(section.id)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground">{section.label}</span>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Métricas Visíveis */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">Métricas Visíveis nas Tabelas</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_METRICS.map((metric) => (
                  <label
                    key={metric.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors ${
                      selectedMetrics.includes(metric.id)
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(metric.id)}
                      onChange={() => toggleMetric(metric.id)}
                      className="hidden"
                    />
                    {selectedMetrics.includes(metric.id) && <Check className="w-3 h-3" />}
                    {metric.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Criar Link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !shares || shares.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Share2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">Nenhum link criado</h3>
            <p className="text-sm text-muted-foreground">
              Crie seu primeiro link para compartilhar métricas com seus clientes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shares.map((share: any) => {
            const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();
            const isActive = share.isActive && !isExpired;
            const sections = (share.visibleSections as string[]) ?? [];

            return (
              <Card key={share.id} className={!isActive ? "opacity-60" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Logo thumbnail */}
                      {share.customLogo && (
                        <img
                          src={share.customLogo}
                          alt="Logo"
                          className="w-10 h-10 object-contain rounded border border-gray-200 bg-white p-0.5 flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium text-foreground truncate">{share.name}</h3>
                          <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                            {isActive ? "Ativo" : isExpired ? "Expirado" : "Desativado"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {typeLabels[share.dashboardType] ?? share.dashboardType}
                          </Badge>
                          {share.accessPassword && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Lock className="w-3 h-3" /> Protegido
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {share.viewCount ?? 0} visualizações
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Criado em {new Date(share.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                          {share.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Expira em {new Date(share.expiresAt).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          {sections.length > 0 && sections.length < 4 && (
                            <span className="text-xs">
                              {sections.length} seções
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLink(share.token, share.id)}
                        className="gap-1"
                      >
                        {copiedId === share.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedId === share.id ? "Copiado" : "Copiar"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/shared/${share.token}`, "_blank")}
                        className="gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Abrir
                      </Button>
                      {isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeMutation.mutate({ id: share.id })}
                          className="gap-1 text-orange-600 hover:text-orange-700"
                        >
                          <EyeOff className="w-3 h-3" />
                          Desativar
                        </Button>
                      ) : !isExpired ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reactivateMutation.mutate({ id: share.id })}
                          className="gap-1 text-green-600 hover:text-green-700"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Reativar
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja remover este link permanentemente?")) {
                            deleteMutation.mutate({ id: share.id });
                          }
                        }}
                        className="gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
