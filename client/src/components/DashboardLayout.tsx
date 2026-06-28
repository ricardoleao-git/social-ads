import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useDashAuth } from "@/App";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3, LayoutDashboard, LogOut, PanelLeft, PauseCircle, Printer,
  ShieldOff, Zap, LineChart, TrendingUp, Globe, KeyRound, Users, Activity,
  PieChart, GitBranch, Instagram, Bot, LayoutGrid, Bell, X, CheckCheck,
  Lightbulb, Search, MapPin, MessageSquare, Clock, FlaskConical, Gauge,
  Target, FileBarChart, ArrowRightLeft, MessageCircle, BrainCircuit,
  FileText, Radio, UserCircle, FolderDown, ChevronDown, ChevronRight, Facebook, Heart, ShieldAlert,
  Sun, Moon, Shield, ShieldCheck, ServerCrash, MessageSquarePlus, Wrench, CalendarCheck, List, Mail, Share2, Megaphone,
  Users2, PenLine, Film, History,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { trpc } from "@/lib/trpc";

// ─── Grupos do menu ────────────────────────────────────────────────────────────
const menuGroups = [
  // ── 1. VISÃO GERAL ─────────────────────────────────────────────────────────────────
  {
    id: "visao-geral",
    label: "Visão Geral",
    items: [
      { icon: LayoutGrid, label: "Painel Executivo", path: "/painel-executivo" },
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Activity, label: "Monitoramento Diário", path: "/monitoramento-diario" },
      { icon: Radio, label: "Briefing Diário", path: "/briefings" },
    ],
  },
  // ── 2. GOOGLE ADS ──────────────────────────────────────────────────────────────
  {
    id: "google-ads",
    label: "Google Ads",
    items: [
      { icon: LineChart, label: "Performance", path: "/analytics" },
      { icon: Megaphone, label: "Campanhas / Grupos", path: "/criar-campanha" },
      { icon: Zap, label: "RSA Optimizer", path: "/rsa-optimizer" },
      { icon: ShieldOff, label: "Palavras Negativas", path: "/negative-keywords" },
      { icon: Search, label: "Termos de Pesquisa", path: "/termos-pesquisa" },
      { icon: Target, label: "Quality Score", path: "/quality-score" },
      { icon: ArrowRightLeft, label: "Orçamento Dinâmico", path: "/orcamento-dinamico" },
      { icon: Shield, label: "Análise Competitiva", path: "/competitive-analysis" },
      { icon: History, label: "Histórico Diário", path: "/historico-diario" },
    ],
  },
  // ── 3. META ADS ─────────────────────────────────────────────────────────────────
  {
    id: "meta-ads",
    label: "Meta Ads",
    items: [
      { icon: Facebook, label: "Campanhas Meta", path: "/meta-ads" },
      { icon: Users2, label: "Leads Meta", path: "/meta-leads" },
      { icon: Facebook, label: "Página Facebook", path: "/facebook-page" },
      { icon: BarChart3, label: "Comparativo Ads", path: "/comparativo-ads" },
    ],
  },
  // ── 4. REDES SOCIAIS ───────────────────────────────────────────────────────────
  {
    id: "redes-sociais",
    label: "Redes Sociais",
    items: [
      { icon: Instagram, label: "Instagram Analytics", path: "/instagram-analytics" },
      { icon: BarChart3, label: "Análise Detalhada", path: "/redes-sociais/analise" },
      { icon: PenLine, label: "Criador de Conteúdo", path: "/instagram-creator" },
      { icon: CalendarCheck, label: "Calendário Editorial", path: "/calendario-editorial" },
    ],
  },
  // ── 4b. CRM & LEADS ────────────────────────────────────────────────────────────
  {
    id: "crm",
    label: "CRM & Leads",
    items: [
      { icon: Users2, label: "CRM de Leads", path: "/crm-leads" },
      { icon: Target, label: "Qualificação de Leads", path: "/qualificacao-leads" },
      { icon: BrainCircuit, label: "Previsão de Leads", path: "/previsao-leads" },
      { icon: FileText, label: "Leads (Planilha)", path: "/leads" },
    ],
  },
  // ── 5. ANALYTICS & ROI ─────────────────────────────────────────────────────────
  {
    id: "analytics",
    label: "Analytics & ROI",
    items: [
      { icon: Globe, label: "GA4 Analytics", path: "/ga4-analytics" },
      { icon: ArrowRightLeft, label: "GA4 vs Google Ads", path: "/ga4-vs-ads" },
      { icon: TrendingUp, label: "Evolução ROI", path: "/roi-evolution" },
      { icon: Target, label: "Metas de Conversão", path: "/metas-conversao" },
      { icon: Clock, label: "Quando/Onde", path: "/quando-onde" },
      { icon: Users, label: "Análise Demográfica", path: "/demografico" },
    ],
  },
  // ── 6. INTELIGÊNCIA & LEADS ────────────────────────────────────────────────────
  {
    id: "inteligencia",
    label: "Inteligência & Leads",
    items: [
      { icon: MessageSquare, label: "Chat com IA", path: "/chat-ia" },
      { icon: Lightbulb, label: "Insights IA", path: "/insights-ia" },
      { icon: Target, label: "Qualificação de Leads", path: "/qualificacao-leads" },
      { icon: BrainCircuit, label: "Previsão de Leads", path: "/previsao-leads" },
      { icon: Lightbulb, label: "Recomendações Google", path: "/recommendations" },
      { icon: Mail, label: "Gmail Insights", path: "/gmail-insights" },
      { icon: Mail, label: "Caixa de Entrada", path: "/email-inbox" },
    ],
  },
  // ── 7. AUTOMAÇÕES ────────────────────────────────────────────────────────────────
  {
    id: "automacoes",
    label: "Automações",
    items: [
      { icon: Bot, label: "Central de Automações", path: "/automacoes" },
      { icon: CalendarCheck, label: "Gestão Semanal", path: "/gestao-semanal" },
      { icon: MessageCircle, label: "Alertas WhatsApp", path: "/alertas-whatsapp" },
      { icon: Bell, label: "Histórico de Alertas", path: "/historico-alertas" },
      { icon: History, label: "Histórico de Sincronizações", path: "/sync-history" },
      { icon: FlaskConical, label: "Experimentos A/B", path: "/experimentos-ab" },
    ],
  },
  // ── 8. RELATÓRIOS ───────────────────────────────────────────────────────────────
  {
    id: "relatorios",
    label: "Relatórios",
    items: [
      { icon: BarChart3, label: "Impacto", path: "/impact-report" },
      { icon: FileBarChart, label: "Campanhas", path: "/relatorio-ads" },
      { icon: FileText, label: "Clientes", path: "/relatorios-clientes" },
      { icon: Activity, label: "Log Diretoria", path: "/log-diretoria" },
      { icon: Printer, label: "Exportação PDF", path: "/export-demo" },
    ],
  },
  // ── 9. SAÚDE & SISTEMA ──────────────────────────────────────────────────────────
  {
    id: "saude-sistema",
    label: "Saúde & Sistema",
    items: [
      { icon: Heart, label: "Health Score", path: "/account-health" },
      { icon: ShieldAlert, label: "Alertas de Saúde", path: "/alertas-saude" },
      { icon: Gauge, label: "PageSpeed", path: "/pagespeed" },
      { icon: Globe, label: "Indexação Google", path: "/indexacao" },
      { icon: MapPin, label: "GB Zênite", path: "/gb-zenite" },
      { icon: ServerCrash, label: "Status do Sistema", path: "/status-sistema" },
    ],
  },
  // ── 10. MAIS (itens secundários) ─────────────────────────────────────────────────
  {
    id: "mais",
    label: "Mais",
    items: [
      { icon: FileText, label: "Leads (Sheets)", path: "/leads" },
      { icon: TrendingUp, label: "ROI por Produto", path: "/roi-produtos" },
      { icon: Target, label: "GA4 Conversões", path: "/ga4-conversoes" },
      { icon: PieChart, label: "Motivos Negação", path: "/keyword-reason-analytics" },
      { icon: PauseCircle, label: "Grupos Pausados", path: "/paused-groups" },
      { icon: KeyRound, label: "Palavras-chave", path: "/palavras-chave" },
      { icon: FolderDown, label: "Documentos", path: "/documentos" },
      { icon: Bell, label: "Notificações", path: "/notificacoes" },
      { icon: MessageSquarePlus, label: "Feedback", path: "/feedback" },
      { icon: Wrench, label: "Manutenção", path: "/manutencao" },
      { icon: GitBranch, label: "Integração IG", path: "/instagram-job-guide" },
    ],
  },
]


const adminMenuItems = [
  { icon: Users, label: "Usuários", path: "/admin/users" },
  { icon: Activity, label: "Log de Atividades", path: "/admin/activity" },
  { icon: FileText, label: "Admin Clientes", path: "/admin-clientes" },
  { icon: Mail, label: "E-mails de Alerta", path: "/admin/email-alertas" },
  { icon: Activity, label: "Saúde do Sistema", path: "/admin/status" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

// Grupos expandidos por padrão (apenas os que contêm a rota atual serão abertos)
const DEFAULT_OPEN_GROUPS = ["visao-geral"];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { user: dashUser, loading: isLoading } = useDashAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, refetch } = useDashAuth();
  const { theme, toggleTheme } = useTheme();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    refetch();
    window.location.href = "/login";
  };
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Determinar qual grupo contém a rota atual
  const activeGroupId = menuGroups.find(g =>
    g.items.some(item => item.path === location)
  )?.id ?? null;

  // Estado dos grupos: aberto/fechado
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuGroups.forEach(g => {
      initial[g.id] = DEFAULT_OPEN_GROUPS.includes(g.id) || g.items.some(i => i.path === location);
    });
    return initial;
  });

  // Abrir automaticamente o grupo da rota ativa quando a rota mudar
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups(prev => ({ ...prev, [activeGroupId]: true }));
    }
  }, [activeGroupId]);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Alertas Instagram
  const utils = trpc.useUtils();
  const { data: unreadAlerts } = trpc.instagram.getAlerts.useQuery(
    { unreadOnly: true },
    { refetchInterval: 5 * 60 * 1000 }
  );
  const unreadCount = unreadAlerts?.length ?? 0;
  const [showAlertDropdown, setShowAlertDropdown] = useState(false);
  const alertDropdownRef = useRef<HTMLDivElement>(null);

  const markAllReadMutation = trpc.instagram.markAllAlertsRead.useMutation({
    onSuccess: () => utils.instagram.getAlerts.invalidate(),
  });

  // Badge de e-mails não lidos na Caixa de Entrada
  const { data: emailUnreadData } = trpc.gmailAlerts.unreadCount.useQuery(
    undefined,
    { staleTime: 2 * 60 * 1000, refetchInterval: 5 * 60 * 1000 }
  );
  const emailUnreadCount = emailUnreadData?.count ?? 0;

  // Modo manutenção
  const { data: maintenanceData } = trpc.systemSettings.getMaintenanceMode.useQuery(
    undefined,
    { refetchInterval: 2 * 60 * 1000 } // verifica a cada 2 min
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (alertDropdownRef.current && !alertDropdownRef.current.contains(e.target as Node)) {
        setShowAlertDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const activeMenuItem = menuGroups.flatMap(g => g.items).find(item => item.path === location);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold tracking-tight truncate text-primary">
                      Zênite Tech
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate leading-tight">
                      Social Ads
                    </span>
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto">
            {menuGroups.map((group) => {
              const isOpen = openGroups[group.id] ?? false;
              const hasActive = group.items.some(i => i.path === location);

              return (
                <div key={group.id}>
                  {/* Cabeçalho do grupo — clicável para colapsar/expandir */}
                  <button
                    onClick={() => !isCollapsed && toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-4 py-2 mt-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 ${
                      hasActive ? "text-primary" : "text-muted-foreground"
                    } hover:text-foreground transition-colors`}
                    title={isCollapsed ? group.label : undefined}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                      {group.label}
                    </span>
                    {!isCollapsed && (
                      isOpen
                        ? <ChevronDown className="h-3 w-3 opacity-60" />
                        : <ChevronRight className="h-3 w-3 opacity-60" />
                    )}
                  </button>

                  {/* Itens do grupo — visíveis quando expandido ou sidebar colapsada (modo ícone) */}
                  {(isOpen || isCollapsed) && (
                    <SidebarMenu className="px-2 pb-1">
                      {group.items.map(item => {
                        const isActive = location === item.path;
                        const isEmailInbox = item.path === "/email-inbox";
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setLocation(item.path)}
                              tooltip={item.label}
                              className="h-9 transition-all font-normal"
                            >
                              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                              <span className="flex-1">{item.label}</span>
                              {isEmailInbox && emailUnreadCount > 0 && (
                                <span className="ml-auto bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center group-data-[collapsible=icon]:hidden">
                                  {emailUnreadCount > 99 ? "99+" : emailUnreadCount}
                                </span>
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  )}
                </div>
              );
            })}

            {/* Seção Admin */}
            {(user as any)?.role === "admin" && (
              <div>
                <div className="px-4 pt-3 pb-1 border-t border-border mt-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                    Administração
                  </p>
                </div>
                <SidebarMenu className="px-2 py-1">
                  {adminMenuItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-9 transition-all font-normal"
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => setLocation("/perfil")}
                  className="cursor-pointer"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Meu Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation("/change-password")}
                  className="cursor-pointer"
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  <span>Alterar Senha</span>
                </DropdownMenuItem>
                {(user as any)?.role === "admin" && (
                  <DropdownMenuItem
                    onClick={() => setLocation("/admin/users")}
                    className="cursor-pointer"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span>Gerenciar Usuários</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={toggleTheme}
                  className="cursor-pointer"
                >
                  {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  <span>{theme === "dark" ? "Tema Claro" : "Tema Escuro"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Handle de redimensionamento */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Toggle de tema */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              {/* Badge de notificação de alertas não lidos com dropdown */}
              <div ref={alertDropdownRef} className="relative">
              <button
                onClick={() => setShowAlertDropdown((v) => !v)}
                className={`relative flex items-center justify-center h-9 w-9 rounded-lg border transition-colors ${
                  unreadCount > 0
                    ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                    : "bg-background text-muted-foreground border-gray-200 hover:bg-gray-50"
                }`}
                title={unreadCount > 0 ? `${unreadCount} alerta(s) de engajamento baixo` : "Alertas"}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-red-600 text-foreground rounded-full">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {showAlertDropdown && (
                <div className="absolute right-0 top-11 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <span className="text-sm font-semibold text-gray-800">
                      {unreadCount > 0 ? `${unreadCount} Alerta(s) não lido(s)` : "Nenhum alerta pendente"}
                    </span>
                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllReadMutation.mutate()}
                          disabled={markAllReadMutation.isPending}
                          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                          title="Marcar todos como lidos"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Marcar todos
                        </button>
                      )}
                      <button
                        onClick={() => setShowAlertDropdown(false)}
                        className="text-muted-foreground hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {!unreadAlerts || unreadAlerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Bell className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">Sem alertas não lidos</p>
                      </div>
                    ) : (
                      unreadAlerts.map((alert) => (
                        <div key={alert.id} className="px-4 py-3 border-b border-gray-50 hover:bg-red-50/40 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-red-700 truncate">{alert.alertType ?? "Engajamento baixo"}</p>
                              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{alert.message}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {alert.createdAt
                                  ? new Date(alert.createdAt).toLocaleString("pt-BR", {
                                      timeZone: "America/Sao_Paulo",
                                      day: "2-digit",
                                      month: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                    <button
                      onClick={() => {
                        setShowAlertDropdown(false);
                        setLocation("/redes-sociais");
                      }}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Ver todos os alertas →
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        )}
        {maintenanceData?.enabled && (
          <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 shrink-0" />
              <span className="font-medium">Modo Manutenção Ativo:</span>
              <span>{maintenanceData.message}</span>
              {maintenanceData.endTime && (
                <span className="opacity-80">· Retorno previsto: {maintenanceData.endTime}</span>
              )}
            </div>
          </div>
        )}
        <main className="flex-1 p-6 min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
