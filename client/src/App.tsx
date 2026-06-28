import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import SocialMediaWrapper from "@/components/social-media/SocialMediaWrapper";
import { Loader2 } from "lucide-react";
import { useEffect, useState, createContext, useContext, lazy, Suspense } from "react";

// ─── Lazy-loaded pages (code splitting para carregamento mais rápido) ─────────
const Home = lazy(() => import("./pages/Home"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const RSAOptimizer = lazy(() => import("@/pages/RSAOptimizer"));
const NegativeKeywords = lazy(() => import("@/pages/NegativeKeywords"));
const NegativeKeywordsReorganize = lazy(() => import("@/pages/NegativeKeywordsReorganize"));
const PausedGroups = lazy(() => import("@/pages/PausedGroups"));
const ImpactReport = lazy(() => import("@/pages/ImpactReport"));
const ExportDemo = lazy(() => import("@/pages/ExportDemo"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const GA4Analytics = lazy(() => import("@/pages/GA4Analytics"));
const RoiEvolution = lazy(() => import("@/pages/RoiEvolution"));
const DashboardLogin = lazy(() => import("@/pages/DashboardLogin"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const AdminClientes = lazy(() => import("@/pages/AdminClientes"));
const ActivityLog = lazy(() => import("@/pages/admin/ActivityLog"));
const AdminEmailAlertas = lazy(() => import("@/pages/admin/AdminEmailAlertas"));
const AdminSystemStatus = lazy(() => import("@/pages/admin/AdminSystemStatus"));
const ChangePassword = lazy(() => import("@/pages/ChangePassword"));
const Perfil = lazy(() => import("@/pages/Perfil"));
const OptimizationPanel = lazy(() => import("@/pages/OptimizationPanel"));
const KeywordReasonAnalytics = lazy(() => import("@/pages/KeywordReasonAnalytics"));
const InstagramJobGuide = lazy(() => import("@/pages/InstagramJobGuide"));
const InstagramDashboard = lazy(() => import("@/pages/InstagramDashboard"));
const AutomationsHub = lazy(() => import("@/pages/AutomationsHub"));
const ExecutiveSummary = lazy(() => import("@/pages/ExecutiveSummary"));
const InsightsAI = lazy(() => import("@/pages/InsightsAI"));
const SearchTermsAnalysis = lazy(() => import("@/pages/SearchTermsAnalysis"));
const GBZeniteOptimizer = lazy(() => import("@/pages/GBZeniteOptimizer"));
const AIChatDashboard = lazy(() => import("@/pages/AIChatDashboard"));
const GestaoSemanal = lazy(() => import("@/pages/GestaoSemanal"));
const DirectorshipLog = lazy(() => import("@/pages/DirectorshipLog"));
const WhenWhereAds = lazy(() => import("@/pages/WhenWhereAds"));
const ABExperiments = lazy(() => import("@/pages/ABExperiments"));
const IndexingMonitor = lazy(() => import("@/pages/IndexingMonitor"));
const GA4ConversionEvents = lazy(() => import("@/pages/GA4ConversionEvents"));
const PageSpeed = lazy(() => import("@/pages/PageSpeed"));
const RelatorioAds = lazy(() => import("@/pages/RelatorioAds"));
const OrcamentoDinamico = lazy(() => import("@/pages/OrcamentoDinamico"));
const AlertasWhatsApp = lazy(() => import("@/pages/AlertasWhatsApp"));
const AlertHistory = lazy(() => import("@/pages/AlertHistory"));
const SyncHistory = lazy(() => import("@/pages/SyncHistory"));
const PrevisaoLeads = lazy(() => import("@/pages/PrevisaoLeads"));
const LeadsSheet = lazy(() => import("@/pages/LeadsSheet"));
const RelatoriosClientes = lazy(() => import("@/pages/RelatoriosClientes"));
const Briefings = lazy(() => import("@/pages/Briefings"));
const Documentos = lazy(() => import("@/pages/Documentos"));
const InstagramHome = lazy(() => import("@/pages/social-media/instagram/InstagramHome"));
const InstagramPosts = lazy(() => import("@/pages/social-media/instagram/InstagramPosts"));
const InstagramAnalysis = lazy(() => import("@/pages/social-media/instagram/InstagramAnalysis"));
const InstagramCompare = lazy(() => import("@/pages/social-media/instagram/InstagramCompare"));
const InstagramScheduler = lazy(() => import("@/pages/social-media/instagram/InstagramScheduler"));
const InstagramReports = lazy(() => import("@/pages/social-media/instagram/InstagramReports"));
const InstagramExport = lazy(() => import("@/pages/social-media/instagram/InstagramExport"));
const InstagramSettings = lazy(() => import("@/pages/social-media/instagram/InstagramSettings"));
const InstagramIntegration = lazy(() => import("@/pages/social-media/instagram/InstagramIntegration"));
const SocialAccountsManager = lazy(() => import("@/pages/social-media/SocialAccountsManager"));
const SocialNetworkOverview = lazy(() => import("@/pages/social-media/SocialNetworkOverview"));
const MetaAds = lazy(() => import("@/pages/MetaAds"));
const ComparativoAds = lazy(() => import("@/pages/ComparativoAds"));
const AccountHealth = lazy(() => import("@/pages/AccountHealth"));
const Recommendations = lazy(() => import("@/pages/Recommendations"));
const QualityScore = lazy(() => import("@/pages/QualityScore"));
const CreativeAnalysis = lazy(() => import("@/pages/CreativeAnalysis"));
const ProductROI = lazy(() => import("@/pages/ProductROI"));
const AlertasSaude = lazy(() => import("@/pages/AlertasSaude"));
const PalavrasChave = lazy(() => import("@/pages/PalavrasChave"));
const SupplierWhitelist = lazy(() => import("@/pages/SupplierWhitelist"));
const SystemStatus = lazy(() => import("@/pages/SystemStatus"));
const NotificationCenter = lazy(() => import("@/pages/NotificationCenter"));
const FeedbackCenter = lazy(() => import("@/pages/FeedbackCenter"));
const MaintenanceControl = lazy(() => import("@/pages/MaintenanceControl"));
const GA4AbrilReport = lazy(() => import("@/pages/GA4AbrilReport"));
const GA4vsAds = lazy(() => import("@/pages/GA4vsAds"));
const GA4AdsReport = lazy(() => import("@/pages/GA4AdsReport"));
const MonitoramentoDiario = lazy(() => import("@/pages/MonitoramentoDiario"));
const HistoricoDiario = lazy(() => import("@/pages/HistoricoDiario"));
const MetasConversao = lazy(() => import("@/pages/MetasConversao"));
const Funcionalidades = lazy(() => import("@/pages/Funcionalidades"));
const GmailInsights = lazy(() => import("@/pages/GmailInsights"));
const LeadQualification = lazy(() => import("@/pages/LeadQualification"));
const CompetitiveAnalysis = lazy(() => import("@/pages/CompetitiveAnalysis"));
const SharedDashboardPublic = lazy(() => import("@/pages/SharedDashboardPublic"));
const SharedDashboardManager = lazy(() => import("@/pages/SharedDashboardManager"));
const DemographicAnalysis = lazy(() => import("@/pages/DemographicAnalysis"));
const CampanhasCriador = lazy(() => import("@/pages/CampanhasCriador"));
const GmailAlertas = lazy(() => import("@/pages/GmailAlertas"));
const MetaLeads = lazy(() => import("@/pages/MetaLeads"));
const FacebookPage = lazy(() => import("@/pages/FacebookPage"));
const InstagramCreator = lazy(() => import("@/pages/InstagramCreator"));
const CrmLeads = lazy(() => import("@/pages/CrmLeads"));
const EditorialCalendar = lazy(() => import("@/pages/EditorialCalendar"));
const EmailInbox = lazy(() => import("@/pages/EmailInbox"));
import AIChatFloating from "@/components/AIChatFloating";

// Fallback de carregamento para Suspense
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
    </div>
  );
}

// ─── Dashboard Auth Context ──────────────────────────────────────────────────
interface DashUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user" | "viewer";
}

interface DashAuthCtx {
  user: DashUser | null;
  loading: boolean;
  refetch: () => void;
}

const DashAuthContext = createContext<DashAuthCtx>({ user: null, loading: true, refetch: () => {} });

export function useDashAuth() {
  return useContext(DashAuthContext);
}

function DashAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DashUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  return (
    <DashAuthContext.Provider value={{ user, loading, refetch: fetchMe }}>
      {children}
    </DashAuthContext.Provider>
  );
}

// ─── Auth Guard ──────────────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, loading } = useDashAuth();

  useEffect(() => {
    if (!loading && !user && location !== "/login") {
      navigate("/login");
    }
  }, [loading, user, location]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

// ─── Admin Guard ─────────────────────────────────────────────────────────────
function AdminGuard({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const { user, loading } = useDashAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate("/login");
      else if (user.role !== "admin") navigate("/");
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;
  return <>{children}</>;
}

// ─── Router ──────────────────────────────────────────────────────────────────
// O DashboardLayout envolve TODAS as rotas protegidas para que o sidebar
// permaneça sempre visível e persistente durante a navegação.
function Router() {
  const [location] = useLocation();
  const isPublicRoute = location === "/login" || location.startsWith("/reset-password") || location.startsWith("/shared/");

  if (isPublicRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/login" component={DashboardLogin} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/shared/:token" component={SharedDashboardPublic} />
        </Switch>
      </Suspense>
    );
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <Suspense fallback={<PageLoader />}>
          <Switch>
          {/* Dashboard principal */}
          <Route path="/" component={Home} />

          {/* Google Ads */}
          <Route path="/rsa-optimizer" component={RSAOptimizer} />
          <Route path="/negative-keywords" component={NegativeKeywords} />
          <Route path="/negative-keywords/reorganize" component={NegativeKeywordsReorganize} />
          <Route path="/paused-groups" component={PausedGroups} />
          <Route path="/impact-report" component={ImpactReport} />
          <Route path="/export-demo" component={ExportDemo} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/ga4-analytics" component={GA4Analytics} />
          <Route path="/roi-evolution" component={RoiEvolution} />
          <Route path="/change-password" component={ChangePassword} />
          <Route path="/perfil" component={Perfil} />
          <Route path="/optimization-panel" component={OptimizationPanel} />
          <Route path="/keyword-reason-analytics" component={KeywordReasonAnalytics} />
          <Route path="/instagram-job-guide" component={InstagramJobGuide} />
          <Route path="/automacoes" component={AutomationsHub} />
          <Route path="/painel-executivo" component={ExecutiveSummary} />
          <Route path="/insights-ia" component={InsightsAI} />
          <Route path="/termos-pesquisa" component={SearchTermsAnalysis} />
          <Route path="/gb-zenite" component={GBZeniteOptimizer} />
          <Route path="/chat-ia" component={AIChatDashboard} />
          <Route path="/gestao-semanal" component={GestaoSemanal} />
          <Route path="/log-diretoria" component={DirectorshipLog} />
          <Route path="/quando-onde" component={WhenWhereAds} />
          <Route path="/experimentos-ab" component={ABExperiments} />
          <Route path="/indexacao" component={IndexingMonitor} />
          <Route path="/ga4-conversoes" component={GA4ConversionEvents} />
          <Route path="/pagespeed" component={PageSpeed} />
          <Route path="/relatorio-ads" component={RelatorioAds} />
          <Route path="/orcamento-dinamico" component={OrcamentoDinamico} />
          <Route path="/alertas-whatsapp" component={AlertasWhatsApp} />
          <Route path="/historico-alertas" component={AlertHistory} />
          <Route path="/sync-history" component={SyncHistory} />
          <Route path="/previsao-leads" component={PrevisaoLeads} />
          <Route path="/leads" component={LeadsSheet} />
          <Route path="/relatorios-clientes" component={RelatoriosClientes} />
          <Route path="/briefings" component={Briefings} />
          <Route path="/documentos" component={Documentos} />

          {/* Admin-only routes */}
          <Route path="/admin/users">
            <AdminGuard><AdminUsers /></AdminGuard>
          </Route>
          <Route path="/admin/activity">
            <AdminGuard><ActivityLog /></AdminGuard>
          </Route>
          <Route path="/admin-clientes">
            <AdminGuard><AdminClientes /></AdminGuard>
          </Route>
          <Route path="/admin/email-alertas">
            <AdminGuard><AdminEmailAlertas /></AdminGuard>
          </Route>
          <Route path="/admin/status">
            <AdminGuard><AdminSystemStatus /></AdminGuard>
          </Route>

          {/* Instagram Analytics - dados ao vivo */}
          <Route path="/instagram-analytics" component={InstagramDashboard} />

          {/* Instagram / Redes Sociais */}
          <Route path="/redes-sociais">
            <SocialMediaWrapper><InstagramHome /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/posts">
            <SocialMediaWrapper><InstagramPosts /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/analise">
            <SocialMediaWrapper><InstagramAnalysis /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/comparar">
            <SocialMediaWrapper><InstagramCompare /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/agendamento">
            <SocialMediaWrapper><InstagramScheduler /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/relatorios">
            <SocialMediaWrapper><InstagramReports /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/exportar">
            <SocialMediaWrapper><InstagramExport /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/configuracoes">
            <SocialMediaWrapper><InstagramSettings /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/integracao">
            <SocialMediaWrapper><InstagramIntegration /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/contas">
            <SocialMediaWrapper><SocialAccountsManager /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/youtube">
            <SocialMediaWrapper><SocialNetworkOverview network="youtube" /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/tiktok">
            <SocialMediaWrapper><SocialNetworkOverview network="tiktok" /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/linkedin">
            <SocialMediaWrapper><SocialNetworkOverview network="linkedin" /></SocialMediaWrapper>
          </Route>
          <Route path="/redes-sociais/facebook">
            <SocialMediaWrapper><SocialNetworkOverview network="facebook" /></SocialMediaWrapper>
          </Route>

          <Route path="/meta-ads" component={MetaAds} />
          <Route path="/comparativo-ads" component={ComparativoAds} />
          <Route path="/account-health" component={AccountHealth} />
          <Route path="/recommendations" component={Recommendations} />
          <Route path="/quality-score" component={QualityScore} />
          <Route path="/creative-analysis" component={CreativeAnalysis} />
          <Route path="/roi-produtos" component={ProductROI} />
          <Route path="/alertas-saude" component={AlertasSaude} />
          <Route path="/palavras-chave" component={PalavrasChave} />
          <Route path="/fornecedores-protegidos" component={SupplierWhitelist} />
          <Route path="/status-sistema" component={SystemStatus} />
          <Route path="/notificacoes" component={NotificationCenter} />
          <Route path="/feedback" component={FeedbackCenter} />
          <Route path="/manutencao" component={MaintenanceControl} />
          <Route path="/ga4-abril" component={GA4AbrilReport} />
          <Route path="/ga4-vs-ads" component={GA4vsAds} />
          <Route path="/ga4-ads-report" component={GA4AdsReport} />
          <Route path="/monitoramento-diario" component={MonitoramentoDiario} />
          <Route path="/historico-diario" component={HistoricoDiario} />
          <Route path="/metas-conversao" component={MetasConversao} />
          <Route path="/funcionalidades" component={Funcionalidades} />
          <Route path="/gmail-insights" component={GmailInsights} />
          <Route path="/qualificacao-leads" component={LeadQualification} />
          <Route path="/competitive-analysis" component={CompetitiveAnalysis} />
          <Route path="/links-compartilhados" component={SharedDashboardManager} />
          <Route path="/demografico" component={DemographicAnalysis} />
          <Route path="/criar-campanha" component={CampanhasCriador} />
          <Route path="/gmail-alertas" component={GmailAlertas} />
          <Route path="/meta-leads" component={MetaLeads} />
          <Route path="/facebook-page" component={FacebookPage} />
           <Route path="/instagram-creator" component={InstagramCreator} />
          <Route path="/crm-leads" component={CrmLeads} />
          <Route path="/calendario-editorial" component={EditorialCalendar} />
          <Route path="/email-inbox" component={EmailInbox} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
          </Switch>
        </Suspense>
      </DashboardLayout>
      <AIChatFloating />
    </AuthGuard>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <DashAuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </DashAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
