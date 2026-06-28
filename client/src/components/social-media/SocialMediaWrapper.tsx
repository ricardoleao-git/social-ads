import { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Instagram,
  LayoutDashboard,
  BarChart2,
  FileText,
  Settings,
  Calendar,
  GitCompare,
  Download,
  Users,
  ChevronDown,
  ArrowLeft,
  Plus,
  CheckCircle,
  Youtube,
  Linkedin,
  Facebook,
  Music2,
  Globe,
  ChevronRight,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────
export type SocialNetwork = "instagram" | "youtube" | "tiktok" | "linkedin" | "facebook" | "all";

export interface AccountProfile {
  id: string;
  username: string;
  displayName: string;
  followers: number;
  engagement: number;
  reach: number;
  impressions: number;
  bio: string;
  category: string;
  verified: boolean;
  platformId?: string;
  isActive?: boolean;
  lastSync?: Date | null;
}

export interface SocialMediaContextType {
  selectedAccount: AccountProfile;
  setSelectedAccountId: (id: string) => void;
  allAccounts: AccountProfile[];
  addAccount: (acc: AccountProfile) => void;
  selectedNetwork: SocialNetwork;
  setSelectedNetwork: (n: SocialNetwork) => void;
  refetchAccounts: () => void;
}

const defaultAccount: AccountProfile = {
  id: "loading",
  username: "@carregando...",
  displayName: "Carregando...",
  followers: 0,
  engagement: 0,
  reach: 0,
  impressions: 0,
  bio: "",
  category: "Geral",
  verified: false,
};

export const SocialMediaContext = createContext<SocialMediaContextType>({
  selectedAccount: defaultAccount,
  setSelectedAccountId: () => {},
  allAccounts: [],
  addAccount: () => {},
  selectedNetwork: "instagram",
  setSelectedNetwork: () => {},
  refetchAccounts: () => {},
});

export const useSocialMedia = () => useContext(SocialMediaContext);

// ─── Network config ───────────────────────────────────────────────────────────
const networks: { id: SocialNetwork; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { id: "instagram", label: "Instagram", icon: Instagram, color: "from-purple-500 to-pink-500" },
  { id: "youtube", label: "YouTube", icon: Youtube, color: "from-red-500 to-red-600" },
  { id: "tiktok", label: "TikTok", icon: Music2, color: "from-gray-800 to-gray-900" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "from-blue-600 to-blue-700" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "from-blue-500 to-blue-600" },
];

// ─── Nav items por rede ───────────────────────────────────────────────────────
const instagramNavItems = [
  { label: "Dashboard", path: "/redes-sociais", icon: LayoutDashboard },
  { label: "Análise Detalhada", path: "/redes-sociais/analise", icon: BarChart2 },
  { label: "Relatórios", path: "/redes-sociais/relatorios", icon: FileText },
  { label: "Agendar Posts", path: "/redes-sociais/agendamento", icon: Calendar },
  { label: "Comparar Contas", path: "/redes-sociais/comparar", icon: GitCompare },
  { label: "Exportar Dados", path: "/redes-sociais/exportar", icon: Download },
  { label: "Configurações", path: "/redes-sociais/configuracoes", icon: Settings },
];

const genericNavItems = (network: SocialNetwork) => [
  { label: "Visão Geral", path: `/redes-sociais/${network}`, icon: LayoutDashboard },
];

const globalNavItems = [
  { label: "Gerenciar Contas", path: "/redes-sociais/contas", icon: Users },
];

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar() {
  const [location, setLocation] = useLocation();
  const { selectedAccount, setSelectedAccountId, allAccounts, selectedNetwork, setSelectedNetwork, refetchAccounts } = useSocialMedia();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [networksExpanded, setNetworksExpanded] = useState(true);

  const activeNetwork = networks.find((n) => n.id === selectedNetwork) ?? networks[0];

  // Filter accounts by selected network
  const networkAccounts = allAccounts.filter(
    (a) => !a.platformId || a.platformId === selectedNetwork
  );

  const navItems = selectedNetwork === "instagram"
    ? instagramNavItems
    : genericNavItems(selectedNetwork);

  return (
    <div className="w-full md:w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col md:h-screen overflow-y-auto">
      {/* Voltar ao Dashboard Principal — sempre visível no topo */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <button
          onClick={() => setLocation("/")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard Principal
        </button>
      </div>
      {/* Logo */}
      <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 bg-gradient-to-br ${activeNetwork.color} rounded-xl flex items-center justify-center shadow-sm`}>
            <Globe className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <span className="text-base font-bold text-gray-900 block leading-tight">Social Hub</span>
            <span className="text-xs text-muted-foreground">Multi-rede Analytics</span>
          </div>
        </div>
      </div>

      {/* Network Selector */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={() => setNetworksExpanded(!networksExpanded)}
          className="w-full flex items-center justify-between mb-2"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rede Social</p>
          <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${networksExpanded ? "rotate-90" : ""}`} />
        </button>
        {networksExpanded && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {networks.map((net) => {
              const Icon = net.icon;
              const isActive = selectedNetwork === net.id;
              const hasAccounts = allAccounts.some((a) => a.platformId === net.id);
              return (
                <button
                  key={net.id}
                  onClick={() => {
                    setSelectedNetwork(net.id);
                    // Navigate to the network's main page
                    if (net.id === "instagram") {
                      setLocation("/redes-sociais");
                    } else {
                      setLocation(`/redes-sociais/${net.id}`);
                    }
                  }}
                  title={net.label}
                  className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                    isActive
                      ? `bg-gradient-to-br ${net.color} shadow-sm`
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
                  {hasAccounts && !isActive && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full" title="Conta cadastrada" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2 text-center font-medium">
          {activeNetwork.label}
        </p>
      </div>

      {/* Account Selector */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conta Ativa</p>
          <button
            onClick={() => refetchAccounts()}
            className="text-muted-foreground hover:text-gray-600 transition-colors"
            title="Atualizar contas"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
          >
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${activeNetwork.color} flex items-center justify-center text-foreground text-sm font-bold flex-shrink-0 shadow-sm`}>
              {selectedAccount.displayName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900 truncate">{selectedAccount.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{selectedAccount.username}</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              {networkAccounts.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground text-center">
                  Nenhuma conta cadastrada para {activeNetwork.label}
                </div>
              ) : (
                networkAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setSelectedAccountId(acc.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 p-3 hover:bg-gray-50 transition-colors ${
                      acc.id === selectedAccount.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${activeNetwork.color} flex items-center justify-center text-foreground text-xs font-bold flex-shrink-0`}>
                      {acc.displayName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-xs font-semibold text-gray-900 truncate">{acc.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{acc.username}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span title={acc.lastSync ? "Sincronizado" : "Não sincronizado"}>
                        {acc.lastSync ? (
                          <Wifi className="w-3 h-3 text-green-500" />
                        ) : (
                          <WifiOff className="w-3 h-3 text-muted-foreground" />
                        )}
                      </span>
                      {acc.id === selectedAccount.id && (
                        <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))
              )}
              <button
                onClick={() => { setLocation("/redes-sociais/contas"); setDropdownOpen(false); }}
                className="w-full flex items-center gap-2.5 p-3 hover:bg-gray-50 transition-colors border-t border-gray-100 text-blue-600"
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs font-medium">Gerenciar contas</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recursos</p>
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-600 text-foreground shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Global items */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-4">Geral</p>
        <div className="space-y-0.5">
          {globalNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-600 text-foreground shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Account stats */}
      <div className="p-4 border-t border-gray-100 flex-shrink-0">
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-3 mb-3">
          <p className="text-xs text-muted-foreground mb-1">Seguidores</p>
          <p className="text-lg font-bold text-gray-900">{selectedAccount.followers.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-green-600 font-medium">↗ Engajamento: {selectedAccount.engagement.toFixed(1)}%</p>
        </div>

        {/* Back to main dashboard */}
        <button
          onClick={() => setLocation("/")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard Principal
        </button>
      </div>
    </div>
  );
}

// ─── Main Wrapper ─────────────────────────────────────────────────────────────
interface Props {
  children: React.ReactNode;
}

export default function SocialMediaWrapper({ children }: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<SocialNetwork>("instagram");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Fetch accounts from DB via tRPC
  const { data: dbAccounts, refetch: refetchAccounts } = trpc.instagram.getAccounts.useQuery(
    { activeOnly: false },
    { staleTime: 60_000 }
  );

  // Fetch live data for selected account to get real follower count
  const selectedUsername = dbAccounts?.find((a) => a.id === selectedAccountId)?.accountHandle?.replace("@", "");
  const { data: liveData } = trpc.instagram.getLiveData.useQuery(
    { username: selectedUsername },
    {
      enabled: !!selectedUsername && selectedNetwork === "instagram",
      staleTime: 300_000,
    }
  );

  // Convert DB accounts to AccountProfile format
  const allAccounts: AccountProfile[] = (dbAccounts ?? []).map((a) => ({
    id: a.id,
    username: a.accountHandle,
    displayName: a.accountName,
    followers: liveData?.success && a.id === selectedAccountId
      ? (liveData.accountInfo?.followers ?? 0)
      : 0,
    engagement: liveData?.success && a.id === selectedAccountId
      ? (liveData.metrics?.avgEngagement ?? 0)
      : 0,
    reach: 0,
    impressions: 0,
    bio: "",
    category: "Geral",
    verified: false,
    platformId: a.platformId,
    isActive: a.isActive ?? true,
    lastSync: a.lastSync ?? null,
  }));

  // Auto-select first Instagram account if none selected
  useEffect(() => {
    if (!selectedAccountId && allAccounts.length > 0) {
      const instagramAcc = allAccounts.find((a) => a.platformId === "instagram");
      if (instagramAcc) setSelectedAccountId(instagramAcc.id);
    }
  }, [allAccounts, selectedAccountId]);

  const selectedAccount = allAccounts.find((a) => a.id === selectedAccountId) ?? (allAccounts[0] ?? defaultAccount);

  const addAccount = (acc: AccountProfile) => {
    // In the new architecture, accounts are added via the Gerenciar Contas page
    // This is kept for compatibility but refetch will update the list
    refetchAccounts();
  };

  return (
    <SocialMediaContext.Provider value={{
      selectedAccount,
      setSelectedAccountId,
      allAccounts,
      addAccount,
      selectedNetwork,
      setSelectedNetwork,
      refetchAccounts,
    }}>
      <div className="flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden">
        {/* Mobile header bar with toggle */}
        <div className="md:hidden flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <span className="text-base">{mobileSidebarOpen ? '✕' : '☰'}</span>
            <span>{mobileSidebarOpen ? 'Fechar Menu' : 'Menu'}</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Social Hub</span>
          </div>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
          >
            ← Dashboard
          </button>
        </div>
        {/* Sidebar: always visible on desktop, collapsible on mobile */}
        <div className={`${mobileSidebarOpen ? 'block' : 'hidden'} md:block`}>
          <Sidebar />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </div>
    </SocialMediaContext.Provider>
  );
}
