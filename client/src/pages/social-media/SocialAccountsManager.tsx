import { useState } from "react";
import {
  Instagram, Youtube, Linkedin, Facebook, Music2, Plus, Trash2,
  RefreshCw, CheckCircle, XCircle, Settings, Globe, Wifi, WifiOff,
  AlertTriangle, Info,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useSocialMedia } from "@/components/social-media/SocialMediaWrapper";

// ─── Platform config ──────────────────────────────────────────────────────────
const PLATFORMS = [
  {
    id: "instagram",
    label: "Instagram",
    icon: Instagram,
    color: "from-purple-500 to-pink-500",
    bg: "bg-purple-50",
    text: "text-purple-700",
    available: true,
    description: "Sincronizado via MCP pelo agente Manus. Suporta métricas de posts, seguidores e engajamento.",
    connectGuide: "Informe o @username da conta. O agente Manus sincronizará os dados via MCP automaticamente.",
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: Youtube,
    color: "from-red-500 to-red-600",
    bg: "bg-red-50",
    text: "text-red-700",
    available: true,
    description: "Conecte um canal do YouTube para monitorar visualizações, inscritos e desempenho de vídeos.",
    connectGuide: "Informe o @handle ou ID do canal (ex: @zenitetech). Requer YouTube Data API v3.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: Music2,
    color: "from-gray-800 to-gray-900",
    bg: "bg-gray-50",
    text: "text-gray-700",
    available: true,
    description: "Monitore seguidores, visualizações de vídeos e taxa de engajamento no TikTok.",
    connectGuide: "Informe o @username do TikTok. Requer TikTok for Business API.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    color: "from-blue-600 to-blue-700",
    bg: "bg-blue-50",
    text: "text-blue-700",
    available: true,
    description: "Acompanhe seguidores, impressões e engajamento de posts no LinkedIn.",
    connectGuide: "Informe o @username ou URL da página/perfil. Requer LinkedIn Marketing API.",
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: Facebook,
    color: "from-blue-500 to-blue-600",
    bg: "bg-blue-50",
    text: "text-blue-700",
    available: true,
    description: "Monitore curtidas na página, alcance e engajamento de posts no Facebook.",
    connectGuide: "Informe o @username ou ID da página. Requer Meta Business API.",
  },
];

interface AddAccountForm {
  platformId: string;
  accountHandle: string;
  accountName: string;
}

export default function SocialAccountsManager() {
  const { refetchAccounts } = useSocialMedia();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [form, setForm] = useState<AddAccountForm>({
    platformId: "instagram",
    accountHandle: "",
    accountName: "",
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch all accounts
  const { data: accounts, isLoading, refetch } = trpc.instagram.getAccounts.useQuery(
    { activeOnly: false },
    { staleTime: 30_000 }
  );

  // Fetch platforms
  const { data: platforms } = trpc.instagram.getPlatforms.useQuery(undefined, {
    staleTime: 300_000,
  });

  // Seed initial data (platforms + default accounts)
  const seedMutation = trpc.instagram.seedInitialData.useMutation({
    onSuccess: () => {
      refetch();
      refetchAccounts();
      setSuccessMsg("Dados iniciais inseridos com sucesso!");
      setTimeout(() => setSuccessMsg(null), 3000);
    },
  });

  // Create account
  const createMutation = trpc.instagram.createAccount.useMutation({
    onSuccess: () => {
      refetch();
      refetchAccounts();
      setShowAddForm(false);
      setForm({ platformId: "instagram", accountHandle: "", accountName: "" });
      setSuccessMsg("Conta adicionada com sucesso!");
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });

  // Update account (toggle active)
  const updateMutation = trpc.instagram.updateAccount.useMutation({
    onSuccess: () => {
      refetch();
      refetchAccounts();
    },
  });

  const handleAddAccount = () => {
    if (!form.accountHandle || !form.accountName) {
      setErrorMsg("Preencha o @username e o nome da conta.");
      return;
    }
    const handle = form.accountHandle.startsWith("@")
      ? form.accountHandle
      : `@${form.accountHandle}`;
    const id = `${form.platformId}_${handle.replace("@", "").replace(/[^a-zA-Z0-9_]/g, "_")}`;
    createMutation.mutate({
      id,
      platformId: form.platformId,
      accountHandle: handle,
      accountName: form.accountName,
    });
  };

  const platformsByNetwork = PLATFORMS.map((p) => ({
    ...p,
    accounts: (accounts ?? []).filter((a) => a.platformId === p.id),
  }));

  const activePlatform = PLATFORMS.find((p) => p.id === selectedPlatform) ?? PLATFORMS[0];
  const ActiveIcon = activePlatform.icon;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciar Contas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Cadastre e gerencie contas de múltiplas redes sociais
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(accounts ?? []).length === 0 && (
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${seedMutation.isPending ? "animate-spin" : ""}`} />
              Inicializar Dados Padrão
            </Button>
          )}
          <Button
            onClick={() => setShowAddForm(true)}
            size="sm"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Conta
          </Button>
        </div>
      </div>

      {/* Feedback messages */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Add Account Form */}
      {showAddForm && (
        <Card className="p-5 border-blue-200 bg-blue-50/30">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            Nova Conta de Rede Social
          </h3>

          {/* Platform selector */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 block mb-2">Rede Social</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setForm((f) => ({ ...f, platformId: p.id }));
                      setSelectedPlatform(p.id);
                    }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      form.platformId === p.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                      <Icon className="w-4 h-4 text-foreground" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guide */}
          <div className="flex items-start gap-2 p-3 bg-white border border-gray-200 rounded-xl mb-4">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">
              {PLATFORMS.find((p) => p.id === form.platformId)?.connectGuide}
            </p>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">@Username *</label>
              <input
                type="text"
                placeholder="@zenite.tech"
                value={form.accountHandle}
                onChange={(e) => setForm((f) => ({ ...f, accountHandle: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nome da Conta *</label>
              <input
                type="text"
                placeholder="Zênite Tech"
                value={form.accountName}
                onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleAddAccount}
              disabled={createMutation.isPending}
              size="sm"
              className="gap-2"
            >
              {createMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Adicionar Conta
            </Button>
            <Button
              onClick={() => { setShowAddForm(false); setErrorMsg(null); }}
              variant="outline"
              size="sm"
            >
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {/* Platforms grid */}
      <div className="space-y-4">
        {platformsByNetwork.map((platform) => {
          const Icon = platform.icon;
          return (
            <Card key={platform.id} className="overflow-hidden">
              {/* Platform header */}
              <div className={`flex items-center justify-between p-4 border-b border-gray-100 ${platform.bg}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${platform.text}`}>{platform.label}</h3>
                    <p className="text-xs text-muted-foreground">{platform.accounts.length} conta(s) cadastrada(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {platform.accounts.length > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      Ativo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground bg-gray-50 px-2 py-1 rounded-full">
                      <XCircle className="w-3 h-3" />
                      Sem contas
                    </span>
                  )}
                  <Button
                    onClick={() => {
                      setForm((f) => ({ ...f, platformId: platform.id }));
                      setShowAddForm(true);
                    }}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs h-7"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {/* Description */}
              <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                <p className="text-xs text-muted-foreground">{platform.description}</p>
              </div>

              {/* Accounts list */}
              {platform.accounts.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {platform.accounts.map((acc) => (
                    <div key={acc.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${platform.color} flex items-center justify-center text-foreground text-sm font-bold flex-shrink-0`}>
                        {acc.accountName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{acc.accountName}</p>
                        <p className="text-xs text-muted-foreground truncate">{acc.accountHandle}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Sync status */}
                        <div className="text-right">
                          {acc.lastSync ? (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <Wifi className="w-3 h-3" />
                              <span>Sincronizado</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <WifiOff className="w-3 h-3" />
                              <span>Aguardando sync</span>
                            </div>
                          )}
                          {acc.lastSync && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(acc.lastSync).toLocaleString("pt-BR")}
                            </p>
                          )}
                        </div>

                        {/* Active toggle */}
                        <button
                          onClick={() => updateMutation.mutate({ id: acc.id, isActive: !acc.isActive })}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            acc.isActive
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-muted-foreground hover:bg-gray-200"
                          }`}
                        >
                          {acc.isActive ? "Ativa" : "Inativa"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma conta cadastrada para {platform.label}</p>
                  <button
                    onClick={() => {
                      setForm((f) => ({ ...f, platformId: platform.id }));
                      setShowAddForm(true);
                    }}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    + Adicionar conta {platform.label}
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Info card */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800 mb-1">Como funciona a sincronização?</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• <strong>Instagram:</strong> Sincronizado automaticamente via MCP pelo agente Manus. Os dados ficam em cache no servidor e são atualizados periodicamente.</li>
              <li>• <strong>YouTube, TikTok, LinkedIn, Facebook:</strong> Cadastre a conta aqui. A sincronização via API será ativada pelo agente Manus quando solicitada.</li>
              <li>• Após cadastrar uma conta, solicite ao agente: <em>"Sincronize os dados da conta @username no YouTube"</em></li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
