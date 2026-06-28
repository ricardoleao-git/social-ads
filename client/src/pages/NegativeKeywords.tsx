import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Shield,
  Tag,
  Building2,
  Users,
  Download,
  PlusCircle,
  X,
  CheckCircle2,
  History,
  Calendar,
  XCircle,
  Zap,
  CheckCheck,
  PieChart,
  Pencil,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportDataToPdf } from "@/lib/exportPdf";
import { NEGATIVE_REASONS, NEGATIVE_REASON_LABELS, inferNegativeReason } from "@shared/negativeReasons";

const MATCH_TYPE_LABELS: Record<string, string> = {
  EXACT: "Exata",
  PHRASE: "Frase",
  BROAD: "Ampla",
  "2": "Exata",
  "3": "Frase",
  "4": "Ampla",
};

const MATCH_TYPE_COLORS: Record<string, string> = {
  EXACT: "bg-blue-100 text-blue-800",
  PHRASE: "bg-purple-100 text-purple-800",
  BROAD: "bg-orange-100 text-orange-800",
  "2": "bg-blue-100 text-blue-800",
  "3": "bg-purple-100 text-purple-800",
  "4": "bg-orange-100 text-orange-800",
};

function getMatchLabel(mt: string) {
  return MATCH_TYPE_LABELS[mt] ?? mt;
}
function getMatchColor(mt: string) {
  return MATCH_TYPE_COLORS[mt] ?? "bg-gray-100 text-gray-700";
}

// Campaign ID for "Pesquisa Leads" — used as default for campaign-level negatives
const DEFAULT_CAMPAIGN_ID = "22395874206";

interface AddNegativeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefilledText?: string;
}

function AddNegativeModal({ open, onClose, onSuccess, prefilledText }: AddNegativeModalProps) {
  const [text, setText] = useState(prefilledText ?? "");
  const [matchType, setMatchType] = useState<"EXACT" | "PHRASE" | "BROAD">("EXACT");
  const [level, setLevel] = useState<"campaign" | "ad_group">("campaign");
  const [campaignId, setCampaignId] = useState(DEFAULT_CAMPAIGN_ID);
  const [adGroupId, setAdGroupId] = useState("");
  const [reason, setReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");

  const addMutation = trpc.googleAds.addNegativeKeyword.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message ?? "Negativo adicionado com sucesso!");
        onSuccess();
        onClose();
        setText(prefilledText ?? "");
      } else {
        toast.error(`Erro: ${data.error ?? "Falha ao adicionar negativo"}`);
      }
    },
    onError: (err) => {
      toast.error(`Erro de rede: ${err.message}`);
    },
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      toast.error("Digite a palavra-chave negativa");
      return;
    }
    if (level === "ad_group" && !adGroupId.trim()) {
      toast.error("Informe o ID do grupo de anúncios");
      return;
    }
    const finalReason = reason === "outro" ? customReason.trim() : reason.trim();
    addMutation.mutate({
      text: text.trim(),
      matchType,
      level,
      campaignId,
      adGroupId: level === "ad_group" ? adGroupId.trim() : undefined,
      reason: finalReason || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold">Adicionar Negativo</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Keyword text */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Palavra-chave negativa <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="ex: gratuito, free, curso..."
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Match type */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Tipo de correspondência</label>
            <div className="flex gap-2">
              {(["EXACT", "PHRASE", "BROAD"] as const).map((mt) => (
                <button
                  key={mt}
                  type="button"
                  onClick={() => setMatchType(mt)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    matchType === mt
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                  }`}
                >
                  {mt === "EXACT" ? "Exata" : mt === "PHRASE" ? "Frase" : "Ampla"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {matchType === "EXACT"
                ? "[exata] — bloqueia apenas buscas idênticas"
                : matchType === "PHRASE"
                ? '"frase" — bloqueia buscas que contêm a frase'
                : "Ampla — bloqueia variações e sinônimos"}
            </p>
          </div>

          {/* Level */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Nível de aplicação</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLevel("campaign")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  level === "campaign"
                    ? "bg-orange-500 text-foreground border-orange-500"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                }`}
              >
                <Building2 className="w-4 h-4" />
                Campanha
              </button>
              <button
                type="button"
                onClick={() => setLevel("ad_group")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  level === "ad_group"
                    ? "bg-purple-500 text-foreground border-purple-500"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                }`}
              >
                <Users className="w-4 h-4" />
                Grupo
              </button>
            </div>
          </div>

          {/* Campaign ID */}
          <div>
            <label className="block text-sm font-medium mb-1.5">ID da Campanha</label>
            <input
              type="text"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">Pesquisa Leads: {DEFAULT_CAMPAIGN_ID}</p>
          </div>

          {/* Motivo da negativação — obrigatório com descrição dinâmica e optgroups */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Motivo da Negativação <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">Selecione um motivo</option>
              <optgroup label="─ Intenção / Relevância">
                {NEGATIVE_REASONS.filter(r => r.category === "relevancia").map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </optgroup>
              <optgroup label="─ Público / Segmento">
                {NEGATIVE_REASONS.filter(r => r.category === "publico").map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </optgroup>
              <optgroup label="─ Concorrência">
                {NEGATIVE_REASONS.filter(r => r.category === "concorrencia").map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </optgroup>
              <optgroup label="─ Produto / Serviço">
                {NEGATIVE_REASONS.filter(r => r.category === "produto").map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </optgroup>
              <optgroup label="─ Preço / Posicionamento">
                {NEGATIVE_REASONS.filter(r => r.category === "preco").map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </optgroup>
              <optgroup label="─ Performance">
                {NEGATIVE_REASONS.filter(r => r.category === "performance").map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </optgroup>
              <optgroup label="─ Localidade">
                {NEGATIVE_REASONS.filter(r => r.category === "localidade").map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </optgroup>
              <optgroup label="─ Suporte / Pós-venda">
                {NEGATIVE_REASONS.filter(r => r.category === "suporte").map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </optgroup>
              <optgroup label="─ Outro">
                {NEGATIVE_REASONS.filter(r => r.category === "outro").map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </optgroup>
            </select>
            {/* Descrição dinâmica do motivo selecionado */}
            {reason && reason !== "outro" && (() => {
              const sel = NEGATIVE_REASONS.find(r => r.value === reason);
              return sel ? (
                <div className="mt-2 p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-400">{sel.description}</p>
                  {sel.examples.length > 0 && (
                    <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                      Ex: {sel.examples.slice(0, 3).join(", ")}
                    </p>
                  )}
                </div>
              ) : null;
            })()}
            {reason === "outro" && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Descreva o motivo específico..."
                className="w-full mt-2 px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>

          {/* Ad Group ID (only for ad_group level) */}
          {level === "ad_group" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                ID do Grupo de Anúncios <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={adGroupId}
                onChange={(e) => setAdGroupId(e.target.value)}
                placeholder="ex: 171234567890"
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Encontre o ID no Google Ads → Grupos de anúncios
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-foreground rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {addMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <PlusCircle className="w-4 h-4" />
              )}
              {addMutation.isPending ? "Adicionando..." : "Adicionar Negativo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Confirm Reason Modal ─────────────────────────────────────────────────────

interface ConfirmReasonModalProps {
  open: boolean;
  keywordText: string;
  suggestedReason: string | null;
  onClose: () => void;
  onConfirmed: (keywordText: string, reason: string) => void;
}

function ConfirmReasonModal({ open, keywordText, suggestedReason, onClose, onConfirmed }: ConfirmReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState(suggestedReason ?? "");

  const saveMutation = trpc.googleAds.saveKeywordReason.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Motivo confirmado e salvo com sucesso!");
        onConfirmed(keywordText, selectedReason);
        onClose();
      } else {
        toast.error(`Erro ao salvar: ${data.error ?? "Tente novamente"}`);
      }
    },
    onError: (err) => {
      toast.error(`Erro de rede: ${err.message}`);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCheck className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold">Confirmar Motivo</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-secondary rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Palavra-chave negativa</p>
          <p className="font-mono text-red-600 dark:text-red-400 font-medium">{keywordText}</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1.5">
            Motivo da Negativação <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          >
            <option value="">Selecione um motivo</option>
            <optgroup label="─ Intenção / Relevância">
              {NEGATIVE_REASONS.filter(r => r.category === "relevancia").map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="─ Público / Segmento">
              {NEGATIVE_REASONS.filter(r => r.category === "publico").map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="─ Concorrência">
              {NEGATIVE_REASONS.filter(r => r.category === "concorrencia").map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="─ Produto / Serviço">
              {NEGATIVE_REASONS.filter(r => r.category === "produto").map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="─ Preço / Posicionamento">
              {NEGATIVE_REASONS.filter(r => r.category === "preco").map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="─ Performance">
              {NEGATIVE_REASONS.filter(r => r.category === "performance").map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="─ Localidade">
              {NEGATIVE_REASONS.filter(r => r.category === "localidade").map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="─ Suporte / Pós-venda">
              {NEGATIVE_REASONS.filter(r => r.category === "suporte").map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="─ Outro">
              {NEGATIVE_REASONS.filter(r => r.category === "outro").map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </optgroup>
          </select>
          {selectedReason && (() => {
            const sel = NEGATIVE_REASONS.find(r => r.value === selectedReason);
            return sel ? (
              <div className="mt-2 p-2.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-xs text-green-700 dark:text-green-400">{sel.description}</p>
              </div>
            ) : null;
          })()}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!selectedReason) { toast.error("Selecione um motivo"); return; }
              saveMutation.mutate({ keywordText, reason: selectedReason, isManual: false });
            }}
            disabled={saveMutation.isPending || !selectedReason}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-foreground rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            {saveMutation.isPending ? "Salvando..." : "Confirmar Motivo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

// Lista canônica de motivos do shared
const REASON_OPTIONS = NEGATIVE_REASONS.map(r => r.value);

function HistoryTab() {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [appliedFrom, setAppliedFrom] = useState(thirtyDaysAgo);
  const [appliedTo, setAppliedTo] = useState(today);
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null);
  const [editHistoryText, setEditHistoryText] = useState("");
  const [editHistoryMatchType, setEditHistoryMatchType] = useState("EXACT");
  const [editHistoryReason, setEditHistoryReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data, isLoading, refetch, isFetching } = trpc.googleAds.getNegativeKeywordHistory.useQuery(
    { fromDate: appliedFrom, toDate: appliedTo },
    { refetchOnWindowFocus: false }
  );

  const confirmAllMutation = trpc.googleAds.confirmAllNegativeKeywords.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Todos os negativos marcados como confirmados");
        refetch();
      } else {
        toast.error("Erro: " + (result.error ?? "Tente novamente"));
      }
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const confirmSingleMutation = trpc.googleAds.confirmNegativeKeyword.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Negativo confirmado");
        refetch();
      } else {
        toast.error("Erro: " + (result.error ?? "Tente novamente"));
      }
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateNegativeMutation = trpc.googleAds.updateNegativeKeyword.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Palavra negativada atualizada");
        setEditingHistoryId(null);
        refetch();
      } else {
        toast.error("Erro: " + (result.error ?? "Tente novamente"));
      }
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const openHistoryEditor = (h: { id: number; text: string; matchType: string; reason?: string | null }) => {
    setEditingHistoryId(h.id);
    setEditHistoryText(h.text);
    setEditHistoryMatchType(h.matchType === "2" ? "EXACT" : h.matchType === "3" ? "PHRASE" : h.matchType === "4" ? "BROAD" : h.matchType);
    setEditHistoryReason(h.reason ?? "");
  };

  const saveHistoryEdit = () => {
    if (!editingHistoryId) return;
    updateNegativeMutation.mutate({
      id: editingHistoryId,
      text: editHistoryText.trim() || undefined,
      matchType: editHistoryMatchType as "EXACT" | "PHRASE" | "BROAD",
      reason: editHistoryReason || undefined,
    });
  };

  const confirmBulkMutation = trpc.googleAds.confirmNegativeKeyword.useMutation({
    onSuccess: () => { refetch(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const confirmSelectedIds = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    let done = 0;
    for (const id of ids) {
      await new Promise<void>((resolve) => {
        confirmBulkMutation.mutate({ id }, { onSettled: () => resolve() });
      });
      done++;
    }
    toast.success(`${done} negativo${done !== 1 ? "s" : ""} confirmado${done !== 1 ? "s" : ""}!`);
    setSelectedIds(new Set());
    refetch();
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const unconfirmed = history.filter((h) => !(h as any).confirmed);
    if (selectedIds.size === unconfirmed.length && unconfirmed.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unconfirmed.map((h) => h.id)));
    }
  };

  const allHistory = data?.history ?? [];
  const unconfirmedCount = allHistory.filter((h) => !(h as any).confirmed).length;
  const history = reasonFilter === "all"
    ? allHistory
    : allHistory.filter((h) => h.reason === reasonFilter);
  const unconfirmedInView = history.filter((h) => !(h as any).confirmed);

  const applyFilter = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  };

  const clearFilter = () => {
    setFromDate(thirtyDaysAgo);
    setToDate(today);
    setAppliedFrom(thirtyDaysAgo);
    setAppliedTo(today);
  };

  const exportHistoryCSV = () => {
    const headers = ["Data/Hora", "Palavra-chave", "Tipo", "Nível", "Campanha", "Grupo", "Motivo", "Status"];
    const rows = history.map((h) => [
      new Date(h.createdAt).toLocaleString("pt-BR"),
      h.text,
      getMatchLabel(h.matchType),
      h.level === "campaign" ? "Campanha" : "Grupo",
      h.campaignName ?? "-",
      h.adGroupName ?? "-",
      h.reason ?? "-",
      h.success ? "Sucesso" : "Falhou",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-negativos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Date filter */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtrar por período:</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">De</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2 py-1.5 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Até</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2 py-1.5 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={applyFilter}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              Aplicar
            </button>
            <button
              onClick={clearFilter}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="px-2 py-1.5 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">Todos os motivos</option>
                {REASON_OPTIONS.map((r) => (
                  <option key={r} value={r}>{NEGATIVE_REASON_LABELS[r] ?? r}</option>
                ))}
              </select>
            </div>
            {history.length > 0 && (
              <button
                onClick={exportHistoryCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors ml-auto"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editor inline do histórico */}
      {editingHistoryId && (
        <div className="bg-card border border-primary/40 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Editar Registro #{editingHistoryId}</span>
            </div>
            <button onClick={() => setEditingHistoryId(null)} className="text-muted-foreground hover:text-foreground p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Palavra-chave</label>
              <input
                type="text"
                value={editHistoryText}
                onChange={(e) => setEditHistoryText(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Correspondência</label>
              <select
                value={editHistoryMatchType}
                onChange={(e) => setEditHistoryMatchType(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="EXACT">Exata</option>
                <option value="PHRASE">Frase</option>
                <option value="BROAD">Ampla</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Motivo</label>
              <select
                value={editHistoryReason}
                onChange={(e) => setEditHistoryReason(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Sem motivo</option>
                {NEGATIVE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={saveHistoryEdit}
              disabled={updateNegativeMutation.isPending || !editHistoryText.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {updateNegativeMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => setEditingHistoryId(null)}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* History table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600" />
              Histórico de Alterações
              {!isLoading && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({history.length} de {allHistory.length} registro{allHistory.length !== 1 ? "s" : ""}{reasonFilter !== "all" ? ` — filtrado por motivo` : ""})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIds.size > 0 && (
                <button
                  onClick={confirmSelectedIds}
                  disabled={confirmBulkMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-foreground rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirmar Selecionados ({selectedIds.size})
                </button>
              )}
              {unconfirmedCount > 0 && (
                <button
                  onClick={() => confirmAllMutation.mutate()}
                  disabled={confirmAllMutation.isPending}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-foreground rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {confirmAllMutation.isPending ? "Confirmando..." : `Confirmar Tudo (${unconfirmedCount})`}
                </button>
              )}
              {unconfirmedCount === 0 && allHistory.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                  <CheckCheck className="w-3.5 h-3.5" />
                  Todos confirmados
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || isFetching ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground text-sm">Carregando histórico...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium text-sm">Nenhuma alteração registrada no período</p>
              <p className="text-xs mt-1">
                As adições feitas pelo dashboard serão registradas aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 w-8">
                      {unconfirmedInView.length > 0 && (
                        <input
                          type="checkbox"
                          checked={selectedIds.size === unconfirmedInView.length && unconfirmedInView.length > 0}
                          onChange={toggleSelectAll}
                          title="Selecionar todos não confirmados"
                          className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                        />
                      )}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data/Hora</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Palavra-chave</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campanha</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Motivo</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Confirmado</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr
                      key={h.id}
                      className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${
                        selectedIds.has(h.id) ? "bg-blue-50/40 dark:bg-blue-950/20" :
                        !(h as any).confirmed ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-8">
                        {!(h as any).confirmed && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(h.id)}
                            onChange={() => toggleSelect(h.id)}
                            className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(h.createdAt).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3 h-3 text-red-400 flex-shrink-0" />
                          <span className="font-mono text-red-600 dark:text-red-400">{h.text}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getMatchColor(h.matchType)}`}>
                          {getMatchLabel(h.matchType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground truncate max-w-[140px]">{h.campaignName ?? "—"}</div>
                        {h.adGroupName && <div className="text-muted-foreground/60 truncate max-w-[140px]">{h.adGroupName}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {h.reason ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 truncate max-w-[140px]" title={NEGATIVE_REASON_LABELS[h.reason] ?? h.reason}>
                            {NEGATIVE_REASON_LABELS[h.reason] ?? h.reason}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(h as any).confirmed ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                            <CheckCheck className="w-3.5 h-3.5" />
                            Confirmado
                          </span>
                        ) : (
                          <button
                            onClick={() => confirmSingleMutation.mutate({ id: h.id })}
                            disabled={confirmSingleMutation.isPending}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 transition-colors border border-amber-300 dark:border-amber-700 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmar
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openHistoryEditor(h)}
                            title="Editar este registro"
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            Editar
                          </button>
                          {h.success ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <CheckCircle2 className="w-3 h-3" />
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-red-500">
                              <XCircle className="w-3 h-3" />
                              Erro
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NegativeKeywords() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "campaign" | "ad_group">("all");
  const [matchFilter, setMatchFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [prefilledText, setPrefilledText] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState("lista");
  // ── Editor de palavra negativada ──────────────────────────────────────────
  const [editingItem, setEditingItem] = useState<{
    id: number;
    text: string;
    matchType: string;
    reason: string;
    campaignName: string;
  } | null>(null);
  const [editText, setEditText] = useState("");
  const [editMatchType, setEditMatchType] = useState("EXACT");
  const [editReason, setEditReason] = useState("");

  const updateNegativeMutation = trpc.googleAds.updateNegativeKeyword.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Palavra negativada atualizada com sucesso");
        setEditingItem(null);
        // Refetch history to reflect changes
        refetchHistory();
      } else {
        toast.error("Erro ao atualizar: " + (result.error ?? "Tente novamente"));
      }
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const confirmAllMutation = trpc.googleAds.confirmAllNegativeKeywords.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Todos os negativos marcados como confirmados`);
        refetchHistory();
      } else {
        toast.error("Erro ao confirmar: " + (result.error ?? "Tente novamente"));
      }
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const confirmSingleMutation = trpc.googleAds.confirmNegativeKeyword.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Negativo confirmado");
        refetchHistory();
      } else {
        toast.error("Erro ao confirmar: " + (result.error ?? "Tente novamente"));
      }
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  // History data for the Histórico tab (needed for confirm all + edit)
  const { refetch: refetchHistory } = trpc.googleAds.getNegativeKeywordHistory.useQuery(
    { fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
    { refetchOnWindowFocus: false, enabled: false }
  );

  const openEditor = (item: { id: number; text: string; matchType: string; reason?: string; campaignName: string }) => {
    setEditingItem({ id: item.id, text: item.text, matchType: item.matchType, reason: item.reason ?? "", campaignName: item.campaignName });
    setEditText(item.text);
    setEditMatchType(item.matchType === "2" ? "EXACT" : item.matchType === "3" ? "PHRASE" : item.matchType === "4" ? "BROAD" : item.matchType);
    setEditReason(item.reason ?? "");
  };

  const saveEdit = () => {
    if (!editingItem) return;
    updateNegativeMutation.mutate({
      id: editingItem.id,
      text: editText.trim() || undefined,
      matchType: editMatchType as "EXACT" | "PHRASE" | "BROAD",
      reason: editReason || undefined,
    });
  };

  const [confirmModal, setConfirmModal] = useState<{ open: boolean; keywordText: string; suggestedReason: string | null }>({
    open: false,
    keywordText: "",
    suggestedReason: null,
  });

  // Confirmed reasons from DB (map: keywordText -> reason)
  const { data: reasonsData, refetch: refetchReasons } = trpc.googleAds.getKeywordReasons.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });
  const confirmedReasons: Record<string, string> = reasonsData?.reasons ?? {};

  // Carrega dados em cache do localStorage para evitar tela em branco
  const CACHE_KEY = 'negative_keywords_cache';
  const cachedData = useMemo(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const { data, isLoading, refetch, isFetching } = trpc.googleAds.getNegativeKeywords.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutos
    placeholderData: cachedData ?? undefined,
  });

  // Salva dados no cache quando carregados com sucesso
  const allKeywords = useMemo(() => {
    const kws = data?.all ?? [];
    if (kws.length > 0) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
    }
    return kws;
  }, [data]);

  // Enrich keywords with reason (confirmed > explicit > inferred)
  const enrichedKeywords = useMemo(() => {
    return allKeywords.map((kw) => {
      const normalized = kw.text.toLowerCase().trim();
      const confirmedReason = confirmedReasons[normalized];
      const explicitReason = (kw as any).reason as string | undefined;
      const inferredReason = !confirmedReason && !explicitReason ? inferNegativeReason(kw.text) : undefined;
      return {
        ...kw,
        displayReason: confirmedReason ?? explicitReason ?? inferredReason,
        isConfirmed: !!confirmedReason,
        isInferred: !confirmedReason && !explicitReason,
      };
    });
  }, [allKeywords, confirmedReasons]);

  const filtered = useMemo(() => {
    return enrichedKeywords.filter((kw) => {
      const matchesSearch =
        search === "" ||
        kw.text.toLowerCase().includes(search.toLowerCase()) ||
        kw.campaignName.toLowerCase().includes(search.toLowerCase()) ||
        (kw.adGroupName ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesLevel = levelFilter === "all" || kw.level === levelFilter;
      const matchesMatch =
        matchFilter === "all" ||
        getMatchLabel(kw.matchType) === matchFilter ||
        kw.matchType === matchFilter;
      const matchesReason =
        reasonFilter === "all" ||
        (reasonFilter === "__none__" && !kw.displayReason) ||
        kw.displayReason === reasonFilter;
      return matchesSearch && matchesLevel && matchesMatch && matchesReason;
    });
  }, [enrichedKeywords, search, levelFilter, matchFilter, reasonFilter]);

  const campaignCount = allKeywords.filter((k) => k.level === "campaign").length;
  const adGroupCount = allKeywords.filter((k) => k.level === "ad_group").length;
  const inferredCount = enrichedKeywords.filter((k) => k.isInferred).length;
  const confirmedCount = enrichedKeywords.filter((k) => k.isConfirmed).length;

  const exportCSV = () => {
    const headers = ["Nível", "Campanha", "Grupo de Anúncios", "Palavra-chave", "Tipo de Correspondência", "Motivo"];
    const rows = filtered.map((kw) => [
      kw.level === "campaign" ? "Campanha" : "Grupo",
      kw.campaignName,
      kw.adGroupName ?? "-",
      kw.text,
      getMatchLabel(kw.matchType),
      kw.displayReason ? (NEGATIVE_REASON_LABELS[kw.displayReason] ?? kw.displayReason) : "-",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `negativos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const handleAddSuccess = () => {
    refetch();
  };

  const openAddModal = (text?: string) => {
    setPrefilledText(text);
    setShowAddModal(true);
  };

  const openConfirmModal = (keywordText: string, suggestedReason: string | null) => {
    setConfirmModal({ open: true, keywordText, suggestedReason });
  };

  const handleReasonConfirmed = (_keywordText: string, _reason: string) => {
    refetchReasons();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Add Negative Modal */}
      <AddNegativeModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
        prefilledText={prefilledText}
      />

      {/* Confirm Reason Modal */}
      <ConfirmReasonModal
        open={confirmModal.open}
        keywordText={confirmModal.keywordText}
        suggestedReason={confirmModal.suggestedReason}
        onClose={() => setConfirmModal({ open: false, keywordText: "", suggestedReason: null })}
        onConfirmed={handleReasonConfirmed}
      />

      {/* Header */}
      <div className="border-b border-border bg-card px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Dashboard</span>
          </button>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            <h1 className="text-lg font-semibold">Palavras-chave Negativas</h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setLocation("/keyword-reason-analytics")}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-indigo-600 text-foreground rounded-lg hover:bg-indigo-700 text-sm font-medium"
            title="Ver distribuição de negativos por motivo"
          >
            <PieChart className="w-4 h-4" />
            <span className="hidden sm:inline">Analytics de Motivos</span>
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm"
            title="Exportar CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          <button
            onClick={() => {
              exportDataToPdf({
                title: 'Palavras-chave Negativas',
                subtitle: `Zênite Tech | ${filtered.length} palavras | zenite-ads.manus.space`,
                filename: `Negativos_${new Date().toISOString().split('T')[0]}.pdf`,
                sections: [
                  {
                    title: '🛡️ Resumo',
                    rows: [
                      { label: 'Total de negativos', value: allKeywords.length.toString() },
                      { label: 'Nível Campanha', value: campaignCount.toString(), highlight: true },
                      { label: 'Nível Grupo', value: adGroupCount.toString() },
                      { label: 'Exibindo (com filtros)', value: filtered.length.toString() },
                    ],
                  },
                  {
                    title: '📝 Lista de Negativos',
                    rows: filtered.slice(0, 100).map(kw => ({
                      label: `[${kw.level === 'campaign' ? 'Campanha' : 'Grupo'}] ${kw.text}`,
                      value: `${getMatchLabel(kw.matchType)} | ${kw.campaignName}${kw.adGroupName ? ' > ' + kw.adGroupName : ''}`,
                    })),
                  },
                ],
              });
            }}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-red-600 text-foreground rounded-lg hover:bg-red-700 text-sm"
            title="Exportar PDF"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>
          <button
            onClick={() => setLocation("/negative-keywords/reorganize")}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-yellow-600 text-foreground rounded-lg hover:bg-yellow-700 text-sm font-medium"
            title="Reorganizar e consolidar negativos via API"
          >
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Reorganizar via API</span>
          </button>
          <button
            onClick={() => openAddModal()}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-red-600 text-foreground rounded-lg hover:bg-red-700 text-sm font-medium"
            title="Adicionar Negativo"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar Negativo</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-500" />
                Total de Negativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{isLoading ? "—" : data?.total ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Palavras-chave bloqueadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-orange-500" />
                Nível de Campanha
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{isLoading ? "—" : campaignCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Aplicados a toda a campanha</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" />
                Nível de Grupo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{isLoading ? "—" : adGroupCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Aplicados por grupo de anúncios</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-green-500" />
                Motivos Confirmados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{isLoading ? "—" : confirmedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {inferredCount > 0 ? `${inferredCount} inferidos aguardando confirmação` : "Todos confirmados"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Add Banner */}
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Adicionar novo negativo</p>
              <p className="text-xs text-red-700 dark:text-red-400">
                Bloqueie termos irrelevantes diretamente via API do Google Ads
              </p>
            </div>
          </div>
          <button
            onClick={() => openAddModal()}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-foreground rounded-lg hover:bg-red-700 text-sm font-medium flex-shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {/* ── Editor de Palavras Negativadas ───────────────────────────────── */}
        {editingItem && (
          <div id="negative-editor" className="bg-card border border-primary/40 rounded-xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Editor de Palavra Negativada</span>
                <span className="text-xs text-muted-foreground">— {editingItem.campaignName}</span>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Palavra-chave</label>
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: emprego, gratis, curso..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Tipo de Correspondência</label>
                <select
                  value={editMatchType}
                  onChange={(e) => setEditMatchType(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="EXACT">Exata</option>
                  <option value="PHRASE">Frase</option>
                  <option value="BROAD">Ampla</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Motivo</label>
                <select
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Sem motivo</option>
                  {NEGATIVE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={saveEdit}
                disabled={updateNegativeMutation.isPending || !editText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {updateNegativeMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </button>
              <button
                onClick={() => setEditingItem(null)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80"
              >
                Cancelar
              </button>
              <span className="text-xs text-muted-foreground ml-2">
                Editando registro #{editingItem.id}
              </span>
            </div>
          </div>
        )}

        {/* Tabs: Lista / Histórico */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-xs">
            <TabsTrigger value="lista" className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Lista Atual
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* ── Aba: Lista Atual ─────────────────────────────────────────── */}
          <TabsContent value="lista" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar palavra-chave, campanha ou grupo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value as any)}
                  className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none"
                >
                  <option value="all">Todos os níveis</option>
                  <option value="campaign">Campanha</option>
                  <option value="ad_group">Grupo de Anúncios</option>
                </select>

                <select
                  value={matchFilter}
                  onChange={(e) => setMatchFilter(e.target.value)}
                  className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="Exata">Exata</option>
                  <option value="Frase">Frase</option>
                  <option value="Ampla">Ampla</option>
                </select>

                {/* ── Filtro por Motivo ─── */}
                <select
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value)}
                  className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none min-w-[180px]"
                >
                  <option value="all">Todos os motivos</option>
                  <option value="__none__">Sem motivo</option>
                  <optgroup label="─ Intenção / Relevância">
                    {NEGATIVE_REASONS.filter(r => r.category === "relevancia").map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="─ Público / Segmento">
                    {NEGATIVE_REASONS.filter(r => r.category === "publico").map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="─ Concorrência">
                    {NEGATIVE_REASONS.filter(r => r.category === "concorrencia").map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="─ Produto / Serviço">
                    {NEGATIVE_REASONS.filter(r => r.category === "produto").map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="─ Preço / Posicionamento">
                    {NEGATIVE_REASONS.filter(r => r.category === "preco").map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="─ Performance">
                    {NEGATIVE_REASONS.filter(r => r.category === "performance").map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="─ Localidade">
                    {NEGATIVE_REASONS.filter(r => r.category === "localidade").map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="─ Suporte / Pós-venda">
                    {NEGATIVE_REASONS.filter(r => r.category === "suporte").map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="─ Outro">
                    {NEGATIVE_REASONS.filter(r => r.category === "outro").map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                </select>

                {reasonFilter !== "all" && (
                  <button
                    onClick={() => setReasonFilter("all")}
                    className="flex items-center gap-1 px-2 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs hover:bg-secondary/80"
                  >
                    <X className="w-3 h-3" />
                    Limpar filtro
                  </button>
                )}
              </div>

              <span className="text-sm text-muted-foreground">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-3 text-muted-foreground">Carregando palavras-chave negativas...</span>
                  </div>
                ) : !data?.success ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-red-500">
                    <AlertCircle className="w-5 h-5" />
                    <span>Erro ao carregar dados: {(data as any)?.error ?? "Verifique as credenciais do Google Ads"}</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Shield className="w-10 h-10 mb-3 opacity-30" />
                    <p className="font-medium">Nenhuma palavra-chave negativa encontrada</p>
                    <p className="text-sm mt-1">Tente ajustar os filtros ou adicione negativos abaixo</p>
                    <button
                      onClick={() => openAddModal()}
                      className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-600 text-foreground rounded-lg hover:bg-red-700 text-sm font-medium"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Adicionar primeiro negativo
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/50">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Palavra-chave Negativa</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Correspondência</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campanha / Nível</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Motivo</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((kw, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Tag className="w-3 h-3 text-red-400 flex-shrink-0" />
                                <span className="font-mono text-red-600 dark:text-red-400">{kw.text}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getMatchColor(kw.matchType)}`}
                              >
                                {getMatchLabel(kw.matchType)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-medium text-foreground truncate max-w-[160px]">{kw.campaignName}</span>
                                <span className={`inline-flex items-center gap-1 text-xs w-fit px-1.5 py-0.5 rounded-full font-medium ${
                                  kw.level === "campaign"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-purple-100 text-purple-700"
                                }`}>
                                  {kw.level === "campaign" ? <Building2 className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                                  {kw.level === "campaign" ? "Campanha" : "Grupo"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 max-w-[200px]">
                              {kw.displayReason ? (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-xs truncate max-w-full ${
                                    kw.isConfirmed
                                      ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800"
                                      : kw.isInferred
                                      ? "bg-slate-100 text-slate-500 dark:bg-card dark:text-muted-foreground border border-dashed border-slate-300 dark:border-border"
                                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                  }`}
                                  title={`${NEGATIVE_REASON_LABELS[kw.displayReason] ?? kw.displayReason}${kw.isInferred ? " (inferido — clique em Confirmar)" : kw.isConfirmed ? " (confirmado)" : ""}`}
                                >
                                  {kw.isInferred && <span className="opacity-50 mr-0.5">~</span>}
                                  {kw.isConfirmed && <CheckCheck className="w-3 h-3 inline mr-0.5 text-green-600" />}
                                  {NEGATIVE_REASON_LABELS[kw.displayReason] ?? kw.displayReason}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs italic">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Status ativo */}
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Ativo
                                </span>
                                {/* Botão Editar — sempre visível, abre o editor no topo */}
                                <button
                                  onClick={() => {
                                    // A lista atual vem da API do Google Ads (sem ID de histórico).
                                    // Usamos o índice como chave temporária para o editor visual.
                                    openEditor({
                                      id: idx + 1,
                                      text: kw.text,
                                      matchType: kw.matchType,
                                      reason: kw.displayReason,
                                      campaignName: kw.campaignName,
                                    });
                                    // Scroll to editor
                                    setTimeout(() => document.getElementById('negative-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                                  }}
                                  title="Editar esta palavra negativada"
                                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 transition-colors"
                                >
                                  <Pencil className="w-3 h-3" />
                                  Editar
                                </button>
                                {/* Confirmar motivo inferido */}
                                {kw.isInferred && (
                                  <button
                                    onClick={() => openConfirmModal(kw.text, kw.displayReason)}
                                    title="Confirmar e salvar o motivo inferido"
                                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/60 transition-colors border border-green-300 dark:border-green-700"
                                  >
                                    <CheckCheck className="w-3 h-3" />
                                    Confirmar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info box */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-1">💡 Como usar palavras-chave negativas</p>
              <p>
                Palavras-chave negativas impedem que seus anúncios sejam exibidos para buscas irrelevantes, reduzindo
                gastos desnecessários. Use o botão <strong>"Adicionar Negativo"</strong> acima para bloquear termos
                diretamente via API, ou acesse o{" "}
                <a
                  href="https://ads.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Google Ads
                </a>{" "}
                → Palavras-chave → Palavras-chave negativas.
              </p>
              <p className="mt-2 text-xs">
                <strong>Legenda de motivos:</strong>{" "}
                <span className="inline-block px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200 text-xs mr-1">✓ Confirmado</span>
                <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-xs mr-1">Manual</span>
                <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-dashed border-slate-300 text-xs">~ Inferido</span>
              </p>
            </div>
          </TabsContent>

          {/* ── Aba: Histórico ───────────────────────────────────────────── */}
          <TabsContent value="historico" className="mt-4">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
