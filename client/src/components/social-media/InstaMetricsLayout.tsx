import { useState, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Instagram,
  LayoutDashboard,
  BarChart2,
  FileText,
  Settings,
  Calendar,
  GitCompare,
  Download,
  Link2,
  ChevronDown,
  X,
  ArrowLeft,
} from "lucide-react";
import { accountProfiles, AccountProfile } from "@/lib/social-media/multiAccountData";

// Context para compartilhar conta selecionada entre todas as páginas
interface InstaMetricsContextType {
  selectedAccount: AccountProfile;
  setSelectedAccountId: (id: string) => void;
  allAccounts: AccountProfile[];
}

const InstaMetricsContext = createContext<InstaMetricsContextType>({
  selectedAccount: accountProfiles[0],
  setSelectedAccountId: () => {},
  allAccounts: accountProfiles,
});

export const useInstaMetrics = () => useContext(InstaMetricsContext);

const navItems = [
  { label: "Dashboard", path: "/redes-sociais", icon: LayoutDashboard },
  { label: "Análise Detalhada", path: "/redes-sociais/analise", icon: BarChart2 },
  { label: "Relatórios", path: "/redes-sociais/relatorios", icon: FileText },
  { label: "Configurações", path: "/redes-sociais/configuracoes", icon: Settings },
  { label: "Agendar Posts", path: "/redes-sociais/agendamento", icon: Calendar },
  { label: "Comparar Contas", path: "/redes-sociais/comparar", icon: GitCompare },
  { label: "Exportar Dados", path: "/redes-sociais/exportar", icon: Download },
  { label: "Integração Instagram", path: "/redes-sociais/integracao", icon: Link2 },
];

interface Props {
  children: React.ReactNode;
}

export default function InstaMetricsLayout({ children }: Props) {
  const [location, setLocation] = useLocation();
  const [selectedAccountId, setSelectedAccountId] = useState(accountProfiles[0].id);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  const selectedAccount = accountProfiles.find((a) => a.id === selectedAccountId) ?? accountProfiles[0];

  return (
    <InstaMetricsContext.Provider value={{ selectedAccount, setSelectedAccountId, allAccounts: accountProfiles }}>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto">
          {/* Logo */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Instagram className="w-5 h-5 text-foreground" />
              </div>
              <span className="text-lg font-bold text-gray-900">InstaMetrics</span>
            </div>
          </div>

          {/* Account Selector */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contas</p>
            <div className="relative">
              <button
                onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-foreground text-xs font-bold flex-shrink-0">
                    {selectedAccount.displayName.charAt(0)}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedAccount.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedAccount.username}</p>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${accountDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {accountDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {accountProfiles.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setAccountDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 p-2.5 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        acc.id === selectedAccountId ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-foreground text-xs font-bold flex-shrink-0">
                        {acc.displayName.charAt(0)}
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-medium text-gray-900 truncate">{acc.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{acc.username}</p>
                      </div>
                      {acc.id === selectedAccountId && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recursos</p>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => setLocation(item.path)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-blue-600" : "text-muted-foreground"}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Back to dashboard */}
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => setLocation("/")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Dashboard
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {/* Top bar with account name */}
          <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
            <div />
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{selectedAccount.displayName}</p>
              <p className="text-xs text-muted-foreground">{selectedAccount.username}</p>
            </div>
          </div>

          {/* Page content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </InstaMetricsContext.Provider>
  );
}
