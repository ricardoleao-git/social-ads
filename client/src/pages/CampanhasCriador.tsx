/**
 * CampanhasCriador.tsx
 * Wizard guiado por IA para criação de Campanhas, Grupos de Anúncios e RSA no Google Ads.
 * 5 etapas: Tipo → Configuração → IA Sugere → Revisão → Criar
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Plus, Trash2, CheckCircle2, Loader2,
  ChevronRight, ChevronLeft, Megaphone, Layers,
  Target, FileText, Rocket, ExternalLink, RefreshCw,
  AlertCircle, X, Edit3
} from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type MatchType = "EXACT" | "PHRASE" | "BROAD";
type WizardMode = "new_campaign" | "add_group";
type Step = 1 | 2 | 3 | 4 | 5;

interface Keyword { text: string; matchType: MatchType; }
interface Headline { text: string; }
interface Description { text: string; }

interface FormData {
  mode: WizardMode;
  // Campanha
  campaignName: string;
  budgetDayBRL: number;
  existingCampaignId: string;
  existingCampaignName: string;
  // Grupo
  adGroupName: string;
  cpcBidBRL: number;
  // Palavras-chave
  keywords: Keyword[];
  // RSA
  headlines: Headline[];
  descriptions: Description[];
  finalUrl: string;
  path1: string;
  path2: string;
  // IA
  product: string;
  goal: string;
}

const MATCH_LABELS: Record<MatchType, string> = {
  EXACT: "Exata",
  PHRASE: "Frase",
  BROAD: "Ampla",
};

const MATCH_COLORS: Record<MatchType, string> = {
  EXACT: "bg-blue-100 text-blue-800 border-blue-200",
  PHRASE: "bg-purple-100 text-purple-800 border-purple-200",
  BROAD: "bg-gray-100 text-gray-700 border-gray-200",
};

const PRODUCTS = [
  "Wallbox / Recarga Veicular",
  "GuardIA - Segurança com IA",
  "ZIPY - WhatsApp Multiatendimento",
  "Zface - Reconhecimento Facial",
  "Zblock - Controle de Acesso",
  "Relógio de Ponto Eletrônico",
  "Catraca com Reconhecimento Facial",
  "PABX em Nuvem",
  "ConciergIA - Portaria Virtual",
  "Outro (digitar manualmente)",
];

const GOALS = [
  "Gerar leads qualificados",
  "Aumentar visitas ao site",
  "Promover produto específico",
  "Recuperar tráfego de marca",
  "Expandir para novo segmento",
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CampanhasCriador() {

  const [step, setStep] = useState<Step>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [form, setForm] = useState<FormData>({
    mode: "new_campaign",
    campaignName: "",
    budgetDayBRL: 30,
    existingCampaignId: "",
    existingCampaignName: "",
    adGroupName: "",
    cpcBidBRL: 2.50,
    keywords: [],
    headlines: [],
    descriptions: [],
    finalUrl: "https://zenitetech.com",
    path1: "",
    path2: "",
    product: "",
    goal: "Gerar leads qualificados",
  });

  const [newKw, setNewKw] = useState({ text: "", matchType: "EXACT" as MatchType });
  const [newHeadline, setNewHeadline] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Queries
  const { data: campaigns = [] } = trpc.campaignCreator.listCampaigns.useQuery();
  const suggestCampaignMutation = trpc.campaignCreator.suggestCampaign.useMutation();
  const suggestGroupMutation = trpc.campaignCreator.suggestAdGroup.useMutation();
  const createCampaignMutation = trpc.campaignCreator.createFullCampaign.useMutation();
  const addGroupMutation = trpc.campaignCreator.addAdGroupToCampaign.useMutation();
  const setStatusMutation = trpc.campaignCreator.setCampaignStatus.useMutation();

  // ─── IA: Gerar sugestões ───────────────────────────────────────────────────
  const handleAISuggest = async () => {
    if (!form.product) {
      toast.error("Informe o produto/serviço");
      return;
    }
    setIsGenerating(true);
    try {
      let suggestion: any;
      if (form.mode === "new_campaign") {
        suggestion = await suggestCampaignMutation.mutateAsync({
          product: form.product,
          goal: form.goal,
          budget: form.budgetDayBRL,
        });
        setForm(f => ({
          ...f,
          campaignName: suggestion.campaignName || f.campaignName,
          adGroupName: suggestion.adGroupName || f.adGroupName,
          keywords: suggestion.keywords || [],
          headlines: suggestion.headlines || [],
          descriptions: suggestion.descriptions || [],
          finalUrl: suggestion.finalUrl || f.finalUrl,
          path1: suggestion.path1 || "",
          path2: suggestion.path2 || "",
        }));
      } else {
        suggestion = await suggestGroupMutation.mutateAsync({
          campaignName: form.existingCampaignName,
          product: form.product,
          segment: form.goal,
        });
        setForm(f => ({
          ...f,
          adGroupName: suggestion.adGroupName || f.adGroupName,
          keywords: suggestion.keywords || [],
          headlines: suggestion.headlines || [],
          descriptions: suggestion.descriptions || [],
          finalUrl: suggestion.finalUrl || f.finalUrl,
        }));
      }
      toast.success("✨ Sugestões geradas pela IA!", { description: "Revise e ajuste conforme necessário." });
      setStep(4);
    } catch (e: any) {
      toast.error("Erro ao gerar sugestões", { description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Criar no Google Ads ───────────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      let res: any;
      if (form.mode === "new_campaign") {
        res = await createCampaignMutation.mutateAsync({
          campaignName: form.campaignName,
          budgetDayBRL: form.budgetDayBRL,
          adGroupName: form.adGroupName,
          cpcBidBRL: form.cpcBidBRL,
          keywords: form.keywords,
          headlines: form.headlines,
          descriptions: form.descriptions,
          finalUrl: form.finalUrl,
          path1: form.path1 || undefined,
          path2: form.path2 || undefined,
        });
      } else {
        res = await addGroupMutation.mutateAsync({
          campaignId: form.existingCampaignId,
          adGroupName: form.adGroupName,
          cpcBidBRL: form.cpcBidBRL,
          keywords: form.keywords,
          headlines: form.headlines,
          descriptions: form.descriptions,
          finalUrl: form.finalUrl,
          path1: form.path1 || undefined,
          path2: form.path2 || undefined,
        });
      }
      setResult(res);
      setStep(5);
      toast.success("🎉 Criado com sucesso!", { description: res.message });
    } catch (e: any) {
      toast.error("Erro ao criar", { description: e.message });
    }
  };

  // ─── Helpers de edição ─────────────────────────────────────────────────────
  const addKeyword = () => {
    if (!newKw.text.trim()) return;
    setForm(f => ({ ...f, keywords: [...f.keywords, { text: newKw.text.trim(), matchType: newKw.matchType }] }));
    setNewKw({ text: "", matchType: "EXACT" });
  };

  const removeKeyword = (i: number) => setForm(f => ({ ...f, keywords: f.keywords.filter((_, idx) => idx !== i) }));

  const addHeadline = () => {
    if (!newHeadline.trim() || newHeadline.length > 30) return;
    setForm(f => ({ ...f, headlines: [...f.headlines, { text: newHeadline.trim() }] }));
    setNewHeadline("");
  };

  const removeHeadline = (i: number) => setForm(f => ({ ...f, headlines: f.headlines.filter((_, idx) => idx !== i) }));

  const addDescription = () => {
    if (!newDesc.trim() || newDesc.length > 90) return;
    setForm(f => ({ ...f, descriptions: [...f.descriptions, { text: newDesc.trim() }] }));
    setNewDesc("");
  };

  const removeDescription = (i: number) => setForm(f => ({ ...f, descriptions: f.descriptions.filter((_, idx) => idx !== i) }));

  // ─── Validações por etapa ──────────────────────────────────────────────────
  const canAdvanceStep2 = form.mode === "new_campaign"
    ? form.campaignName.trim().length >= 3 && form.budgetDayBRL >= 1
    : form.existingCampaignId !== "";

  const canAdvanceStep3 = form.product.trim().length >= 3;

  const canCreate = form.adGroupName.trim().length >= 3
    && form.keywords.length >= 1
    && form.headlines.length >= 3
    && form.descriptions.length >= 2
    && form.finalUrl.startsWith("http");

  // ─── Barra de progresso ────────────────────────────────────────────────────
  const STEPS = [
    { n: 1, label: "Tipo", icon: Target },
    { n: 2, label: "Configurar", icon: Layers },
    { n: 3, label: "IA Sugere", icon: Sparkles },
    { n: 4, label: "Revisar", icon: FileText },
    { n: 5, label: "Resultado", icon: Rocket },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Criar Campanha / Grupo</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Wizard guiado por IA — Google Ads</p>
            </div>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="flex items-center mb-8 gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.n;
            const isDone = step > s.n;
            return (
              <div key={s.n} className="flex items-center flex-1">
                <div className={`flex flex-col items-center gap-1 flex-1`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                    isDone ? "bg-blue-600 border-blue-600" :
                    isActive ? "bg-white dark:bg-gray-800 border-blue-600" :
                    "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  }`}>
                    {isDone
                      ? <CheckCircle2 className="w-4 h-4 text-white" />
                      : <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                    }
                  </div>
                  <span className={`text-[10px] font-medium hidden sm:block ${isActive ? "text-blue-600" : isDone ? "text-blue-500" : "text-gray-400"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded ${step > s.n ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card principal */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

          {/* ─── ETAPA 1: Tipo ──────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">O que deseja criar?</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Escolha entre criar uma nova campanha completa ou adicionar um grupo a uma campanha existente.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setForm(f => ({ ...f, mode: "new_campaign" }))}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    form.mode === "new_campaign"
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-3">
                    <Megaphone className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Nova Campanha Completa</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cria campanha + grupo + palavras-chave + anúncio RSA do zero</p>
                </button>

                <button
                  onClick={() => setForm(f => ({ ...f, mode: "add_group" }))}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    form.mode === "add_group"
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-3">
                    <Layers className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Adicionar Grupo</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Adiciona um novo grupo de anúncios + RSA a uma campanha existente</p>
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  Continuar <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── ETAPA 2: Configuração ───────────────────────────────────────── */}
          {step === 2 && (
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {form.mode === "new_campaign" ? "Configurar Nova Campanha" : "Selecionar Campanha Existente"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {form.mode === "new_campaign"
                    ? "Defina o nome e orçamento diário da campanha."
                    : "Escolha a campanha onde o novo grupo será adicionado."
                  }
                </p>
              </div>

              {form.mode === "new_campaign" ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1.5 block">Nome da Campanha</Label>
                    <Input
                      value={form.campaignName}
                      onChange={e => setForm(f => ({ ...f, campaignName: e.target.value }))}
                      placeholder="Ex: Zênite Tech - Wallbox Empresas"
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1.5 block">Orçamento Diário (R$)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={form.budgetDayBRL}
                      onChange={e => setForm(f => ({ ...f, budgetDayBRL: parseFloat(e.target.value) || 0 }))}
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">Máx. recomendado: R$ 50/dia por campanha</p>
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1.5 block">CPC Máximo (R$)</Label>
                    <Input
                      type="number"
                      min={0.1}
                      max={50}
                      step={0.1}
                      value={form.cpcBidBRL}
                      onChange={e => setForm(f => ({ ...f, cpcBidBRL: parseFloat(e.target.value) || 0 }))}
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1.5 block">Campanha Existente</Label>
                    <Select
                      value={form.existingCampaignId}
                      onValueChange={v => {
                        const camp = campaigns.find((c: any) => c.id === v);
                        setForm(f => ({
                          ...f,
                          existingCampaignId: v,
                          existingCampaignName: camp?.name || "",
                        }));
                      }}
                    >
                      <SelectTrigger className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                        <SelectValue placeholder="Selecione uma campanha..." />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1.5 block">CPC Máximo do Grupo (R$)</Label>
                    <Input
                      type="number"
                      min={0.1}
                      max={50}
                      step={0.1}
                      value={form.cpcBidBRL}
                      onChange={e => setForm(f => ({ ...f, cpcBidBRL: parseFloat(e.target.value) || 0 }))}
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!canAdvanceStep2}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── ETAPA 3: IA Sugere ──────────────────────────────────────────── */}
          {step === 3 && (
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">IA vai sugerir tudo para você</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Informe o produto e objetivo. A IA cria automaticamente palavras-chave, títulos e descrições otimizados.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300 mb-1.5 block">Produto / Serviço</Label>
                  <Select
                    value={form.product}
                    onValueChange={v => setForm(f => ({ ...f, product: v === "Outro (digitar manualmente)" ? "" : v }))}
                  >
                    <SelectTrigger className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                      <SelectValue placeholder="Selecione o produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCTS.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(form.product === "" || !PRODUCTS.includes(form.product)) && (
                    <Input
                      className="mt-2 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                      placeholder="Descreva o produto/serviço..."
                      value={form.product}
                      onChange={e => setForm(f => ({ ...f, product: e.target.value }))}
                    />
                  )}
                </div>

                <div>
                  <Label className="text-gray-700 dark:text-gray-300 mb-1.5 block">Objetivo da Campanha</Label>
                  <Select
                    value={form.goal}
                    onValueChange={v => setForm(f => ({ ...f, goal: v }))}
                  >
                    <SelectTrigger className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GOALS.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">O que a IA vai gerar:</p>
                    <ul className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-0.5">
                      <li>• 8–12 palavras-chave com correspondência otimizada</li>
                      <li>• 10–15 títulos para o anúncio RSA (máx. 30 chars cada)</li>
                      <li>• 3–4 descrições persuasivas (máx. 90 chars cada)</li>
                      <li>• URL de destino mais relevante do zenitetech.com</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(4)}
                    className="gap-2 text-gray-600"
                  >
                    <Edit3 className="w-4 h-4" /> Preencher manualmente
                  </Button>
                  <Button
                    onClick={handleAISuggest}
                    disabled={!canAdvanceStep3 || isGenerating}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Gerar com IA</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ─── ETAPA 4: Revisão ────────────────────────────────────────────── */}
          {step === 4 && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Revisar e Ajustar</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Verifique e edite todos os dados antes de criar.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(3)}
                  className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Regerar IA
                </Button>
              </div>

              {/* Nome do grupo */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-1.5 block font-medium">Nome do Grupo de Anúncios</Label>
                <Input
                  value={form.adGroupName}
                  onChange={e => setForm(f => ({ ...f, adGroupName: e.target.value }))}
                  className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* URL */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                  <Label className="text-gray-700 dark:text-gray-300 mb-1.5 block font-medium">URL de Destino</Label>
                  <Input
                    value={form.finalUrl}
                    onChange={e => setForm(f => ({ ...f, finalUrl: e.target.value }))}
                    className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300 mb-1.5 block text-xs">Caminho 1 (máx 15)</Label>
                  <Input
                    value={form.path1}
                    maxLength={15}
                    onChange={e => setForm(f => ({ ...f, path1: e.target.value }))}
                    placeholder="ex: wallbox"
                    className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300 mb-1.5 block text-xs">Caminho 2 (máx 15)</Label>
                  <Input
                    value={form.path2}
                    maxLength={15}
                    onChange={e => setForm(f => ({ ...f, path2: e.target.value }))}
                    placeholder="ex: empresas"
                    className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              {/* Palavras-chave */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-2 block font-medium">
                  Palavras-chave ({form.keywords.length})
                </Label>
                <div className="flex flex-wrap gap-1.5 mb-3 min-h-[40px] p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  {form.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${MATCH_COLORS[kw.matchType]}`}
                    >
                      <span className="font-medium">[{MATCH_LABELS[kw.matchType]}]</span> {kw.text}
                      <button onClick={() => removeKeyword(i)} className="ml-0.5 hover:text-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {form.keywords.length === 0 && (
                    <span className="text-xs text-gray-400 p-1">Nenhuma palavra-chave adicionada</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newKw.text}
                    onChange={e => setNewKw(n => ({ ...n, text: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addKeyword()}
                    placeholder="Nova palavra-chave..."
                    className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <Select
                    value={newKw.matchType}
                    onValueChange={v => setNewKw(n => ({ ...n, matchType: v as MatchType }))}
                  >
                    <SelectTrigger className="w-28 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXACT">Exata</SelectItem>
                      <SelectItem value="PHRASE">Frase</SelectItem>
                      <SelectItem value="BROAD">Ampla</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={addKeyword} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Títulos RSA */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-2 block font-medium">
                  Títulos RSA ({form.headlines.length}/15) — máx. 30 chars cada
                </Label>
                <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
                  {form.headlines.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-200 dark:border-gray-700">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-4 shrink-0">{i + 1}.</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200 flex-1">{h.text}</span>
                      <span className={`text-[10px] shrink-0 ${h.text.length > 30 ? "text-red-500" : "text-gray-400"}`}>
                        {h.text.length}/30
                      </span>
                      <button onClick={() => removeHeadline(i)} className="text-gray-400 hover:text-red-500 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {form.headlines.length < 15 && (
                  <div className="flex gap-2">
                    <Input
                      value={newHeadline}
                      onChange={e => setNewHeadline(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addHeadline()}
                      maxLength={30}
                      placeholder="Novo título (máx 30 chars)..."
                      className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                    <span className={`text-xs self-center shrink-0 ${newHeadline.length > 30 ? "text-red-500" : "text-gray-400"}`}>
                      {newHeadline.length}/30
                    </span>
                    <Button size="sm" onClick={addHeadline} disabled={newHeadline.length > 30} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Descrições RSA */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-2 block font-medium">
                  Descrições RSA ({form.descriptions.length}/4) — máx. 90 chars cada
                </Label>
                <div className="space-y-1.5 mb-3">
                  {form.descriptions.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-4 shrink-0 mt-0.5">{i + 1}.</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200 flex-1">{d.text}</span>
                      <span className={`text-[10px] shrink-0 mt-0.5 ${d.text.length > 90 ? "text-red-500" : "text-gray-400"}`}>
                        {d.text.length}/90
                      </span>
                      <button onClick={() => removeDescription(i)} className="text-gray-400 hover:text-red-500 shrink-0 mt-0.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {form.descriptions.length < 4 && (
                  <div className="space-y-1.5">
                    <Textarea
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      maxLength={90}
                      placeholder="Nova descrição (máx 90 chars)..."
                      rows={2}
                      className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${newDesc.length > 90 ? "text-red-500" : "text-gray-400"}`}>
                        {newDesc.length}/90
                      </span>
                      <Button size="sm" onClick={addDescription} disabled={newDesc.length > 90 || !newDesc.trim()} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
                        <Plus className="w-3.5 h-3.5" /> Adicionar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Validação */}
              {!canCreate && (
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Para criar, você precisa de: mín. 1 palavra-chave, 3 títulos, 2 descrições e URL válida.
                  </p>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!canCreate || createCampaignMutation.isPending || addGroupMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  {(createCampaignMutation.isPending || addGroupMutation.isPending) ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Criando no Google Ads...</>
                  ) : (
                    <><Rocket className="w-4 h-4" /> Criar no Google Ads</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ─── ETAPA 5: Resultado ──────────────────────────────────────────── */}
          {step === 5 && result && (
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Criado com Sucesso!</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{result.message}</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                {result.campaignId && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">ID da Campanha</span>
                    <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">{result.campaignId}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">ID do Grupo</span>
                  <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">{result.adGroupId}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">ID do Anúncio RSA</span>
                  <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">{result.adId}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Palavras-chave criadas</span>
                  <span className="text-sm font-medium text-green-600">{result.keywordsCreated}</span>
                </div>
              </div>

              {result.campaignId && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">⚠️ Campanha criada como PAUSADA</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Revise os anúncios no Google Ads e ative a campanha quando estiver pronto.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={result.adsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Ver no Google Ads
                </a>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep(1);
                    setResult(null);
                    setForm(f => ({
                      ...f,
                      campaignName: "",
                      adGroupName: "",
                      keywords: [],
                      headlines: [],
                      descriptions: [],
                      product: "",
                    }));
                  }}
                  className="flex-1 gap-2"
                >
                  <Plus className="w-4 h-4" /> Criar outra
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
