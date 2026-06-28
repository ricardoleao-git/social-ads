import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import {
  LayoutDashboard, TrendingUp, Search, Target, BarChart3, Activity,
  Brain, Bell, FileText, Users, Settings, Zap, Globe, PieChart,
  Calendar, Download, Mail, Shield, ChevronDown, ChevronRight,
  CheckCircle, ExternalLink, Star, Clock, Database, Cpu, Link2
} from "lucide-react";
import { Link } from "wouter";

interface Feature {
  name: string;
  description: string;
  path?: string;
  status: "active" | "beta" | "new";
  tags?: string[];
}

interface FeatureGroup {
  id: string;
  icon: React.ElementType;
  color: string;
  title: string;
  subtitle: string;
  features: Feature[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    color: "text-blue-400",
    title: "Dashboard Principal",
    subtitle: "Visão geral de performance Google Ads",
    features: [
      { name: "Painel Executivo", description: "Resumo executivo com KPIs principais de todas as campanhas", path: "/painel-executivo", status: "active", tags: ["Google Ads", "KPIs"] },
      { name: "Dashboard Principal", description: "Métricas agregadas: CTR, CPC, cliques, conversões, gasto total com filtros de período", path: "/", status: "active", tags: ["Google Ads", "Filtros"] },
      { name: "Análise de Campanhas", description: "Heatmap de grupos de anúncios, ranking Top/Bottom, ROI e ROAS por grupo", path: "/", status: "active", tags: ["Heatmap", "ROI"] },
      { name: "Comparativo de Períodos", description: "Comparação entre dois períodos para identificar tendências de melhoria ou queda", path: "/", status: "active", tags: ["Comparativo"] },
      { name: "Previsões de Performance", description: "Projeções de CTR, CPC e conversões para os próximos 7 dias com base em tendências", path: "/", status: "active", tags: ["IA", "Previsão"] },
    ],
  },
  {
    id: "google-ads",
    icon: TrendingUp,
    color: "text-green-400",
    title: "Google Ads",
    subtitle: "Gestão e otimização de campanhas",
    features: [
      { name: "RSA Optimizer", description: "Análise e otimização de anúncios responsivos: headlines, descrições, Ad Strength, URLs", path: "/rsa-optimizer", status: "active", tags: ["RSA", "Anúncios"] },
      { name: "Palavras-chave Negativas", description: "Visualização, adição e gestão de negativos por grupo de anúncios via API", path: "/negative-keywords", status: "active", tags: ["Negativos", "API"] },
      { name: "Reorganização de Negativos", description: "Auditoria e reorganização em massa de palavras-chave negativas", path: "/negative-keywords/reorganize", status: "active", tags: ["Negativos"] },
      { name: "Grupos Pausados", description: "Análise de grupos pausados com sugestões de migração de palavras-chave", path: "/paused-groups", status: "active", tags: ["Grupos"] },
      { name: "Análise de Termos de Pesquisa", description: "Relatório de termos reais pesquisados que ativaram os anúncios", path: "/termos-pesquisa", status: "active", tags: ["Keywords", "Pesquisa"] },
      { name: "Palavras-chave", description: "Gestão completa de palavras-chave com métricas de performance por keyword", path: "/palavras-chave", status: "active", tags: ["Keywords"] },
      { name: "Análise de Campanhas", description: "Comparativo detalhado entre campanhas com métricas de conversão", path: "/", status: "active", tags: ["Campanhas"] },
      { name: "Orçamento Dinâmico", description: "Gestão e simulação de orçamentos por campanha e grupo", path: "/orcamento-dinamico", status: "active", tags: ["Orçamento"] },
      { name: "Quando e Onde Anunciar", description: "Análise de horários e dispositivos com melhor performance", path: "/quando-onde", status: "active", tags: ["Segmentação"] },
      { name: "Experimentos A/B", description: "Gestão de experimentos e testes A/B em campanhas", path: "/experimentos-ab", status: "active", tags: ["A/B", "Testes"] },
      { name: "Saúde da Conta", description: "Score de saúde geral da conta Google Ads com recomendações", path: "/account-health", status: "active", tags: ["Score", "Saúde"] },
      { name: "Alertas de Saúde", description: "Alertas automáticos para métricas fora do padrão esperado", path: "/alertas-saude", status: "active", tags: ["Alertas"] },
      { name: "Fornecedores Protegidos", description: "Lista de domínios/termos protegidos para não negativar por engano", path: "/fornecedores-protegidos", status: "active", tags: ["Proteção"] },
    ],
  },
  {
    id: "analytics",
    icon: BarChart3,
    color: "text-violet-400",
    title: "Analytics e GA4",
    subtitle: "Dados reais do Google Analytics 4",
    features: [
      { name: "Relatório GA4", description: "Sessões, usuários, conversões, canais e distribuição geográfica com filtros 7/14/30/90 dias", path: "/ga4-abril", status: "active", tags: ["GA4", "API Real"] },
      { name: "GA4 vs Google Ads", description: "Correlação entre tráfego pago e sessões GA4 por landing page", path: "/ga4-vs-ads", status: "active", tags: ["GA4", "Correlação"] },
      { name: "GA4 Analytics", description: "Análise completa de tráfego por canal, país e página de destino", path: "/ga4-analytics", status: "active", tags: ["GA4"] },
      { name: "Eventos de Conversão GA4", description: "Visualização de todos os eventos de conversão configurados no GA4", path: "/ga4-conversoes", status: "active", tags: ["GA4", "Conversões"] },
      { name: "Analytics Avançado", description: "Análise de funil, cohort e segmentos de usuários", path: "/analytics", status: "active", tags: ["Funil", "Cohort"] },
      { name: "Evolução do ROI", description: "Gráfico de evolução do ROI e ROAS ao longo do tempo por produto", path: "/roi-evolution", status: "active", tags: ["ROI", "ROAS"] },
      { name: "ROI por Produto", description: "Comparativo de ROI entre todos os produtos da Zênite Tech", path: "/roi-produtos", status: "active", tags: ["ROI", "Produtos"] },
      { name: "Razão de Keywords", description: "Análise de por que cada keyword foi ativada ou não", path: "/keyword-reason-analytics", status: "active", tags: ["Keywords", "Diagnóstico"] },
      { name: "PageSpeed", description: "Monitoramento de velocidade das landing pages dos anúncios", path: "/pagespeed", status: "active", tags: ["Performance", "SEO"] },
      { name: "Indexação", description: "Monitor de indexação das páginas no Google Search Console", path: "/indexacao", status: "active", tags: ["SEO", "Indexação"] },
    ],
  },
  {
    id: "monitoramento",
    icon: Activity,
    color: "text-orange-400",
    title: "Monitoramento e Alertas",
    subtitle: "Vigilância contínua das campanhas",
    features: [
      { name: "Monitoramento Diário", description: "Score de saúde 0-100, anomalias recentes, dispositivos GA4, alertas automáticos por e-mail quando score < 70", path: "/monitoramento-diario", status: "active", tags: ["Score", "Alertas", "GA4"] },
      { name: "Histórico de Alertas", description: "Registro completo de todos os alertas gerados com status de resolução", path: "/historico-alertas", status: "active", tags: ["Histórico", "Alertas"] },
      { name: "Alertas WhatsApp", description: "Configuração e histórico de alertas enviados via WhatsApp", path: "/alertas-whatsapp", status: "active", tags: ["WhatsApp", "Alertas"] },
      { name: "Status do Sistema", description: "Status de todas as integrações: GA4, Google Ads, Gmail, Instagram", path: "/status-sistema", status: "active", tags: ["Status", "Integrações"] },
      { name: "Manutenção e Controle", description: "Controle de manutenções programadas e histórico de incidentes", path: "/manutencao", status: "active", tags: ["Manutenção"] },
    ],
  },
  {
    id: "metas",
    icon: Target,
    color: "text-emerald-400",
    title: "Metas e Conversões",
    subtitle: "Acompanhamento de objetivos mensais",
    features: [
      { name: "Metas de Conversão", description: "Progresso mensal por produto, gráfico de pizza de contribuição, evolução diária, histórico de alertas resolvidos", path: "/metas-conversao", status: "new", tags: ["Metas", "Produtos", "Pizza"] },
      { name: "Previsão de Leads", description: "Projeção de leads esperados por campanha para o mês corrente", path: "/previsao-leads", status: "active", tags: ["Leads", "Previsão"] },
      { name: "Painel de Otimização", description: "Recomendações automáticas de otimização com prioridade e impacto estimado", path: "/optimization-panel", status: "active", tags: ["Otimização", "IA"] },
    ],
  },
  {
    id: "relatorios",
    icon: FileText,
    color: "text-cyan-400",
    title: "Relatórios",
    subtitle: "Exportação e compartilhamento de dados",
    features: [
      { name: "Relatório de Impacto", description: "Relatório completo de impacto das otimizações: negativos, URLs, extensões, grupo institucional, posts GBP", path: "/impact-report", status: "active", tags: ["PDF", "Impacto"] },
      { name: "Relatório de Anúncios", description: "Relatório detalhado de todos os anúncios ativos com métricas de performance", path: "/relatorio-ads", status: "active", tags: ["Anúncios", "PDF"] },
      { name: "Relatórios de Clientes", description: "Geração de relatórios personalizados por cliente com exportação PDF/CSV", path: "/relatorios-clientes", status: "active", tags: ["Clientes", "PDF"] },
      { name: "Comparativo de Anúncios", description: "Comparação entre diferentes versões de anúncios e campanhas", path: "/comparativo-ads", status: "active", tags: ["Comparativo"] },
      { name: "Meta Ads", description: "Painel de performance de campanhas Meta (Facebook/Instagram Ads)", path: "/meta-ads", status: "active", tags: ["Meta", "Facebook"] },
      { name: "Exportação Demo", description: "Demonstração de exportação de relatórios em PDF", path: "/export-demo", status: "active", tags: ["PDF", "Demo"] },
    ],
  },
  {
    id: "ia",
    icon: Brain,
    color: "text-pink-400",
    title: "Inteligência Artificial",
    subtitle: "Análises e recomendações com IA",
    features: [
      { name: "Insights de IA", description: "Análises automáticas com recomendações estratégicas baseadas nos dados das campanhas", path: "/insights-ia", status: "active", tags: ["IA", "Recomendações"] },
      { name: "Chat com IA", description: "Assistente conversacional para análise de campanhas e geração de estratégias", path: "/chat-ia", status: "active", tags: ["IA", "Chat"] },
      { name: "Análise de Sentimento", description: "Análise de sentimento de comentários e menções à marca", path: "/redes-sociais/analise", status: "active", tags: ["IA", "Sentimento"] },
    ],
  },
  {
    id: "automacoes",
    icon: Zap,
    color: "text-yellow-400",
    title: "Automações",
    subtitle: "Tarefas automáticas e agendadas",
    features: [
      { name: "Hub de Automações", description: "Central de controle de todas as 8 automações: anomalias, RSA, relatórios, lances, concorrência, negativos", path: "/automacoes", status: "active", tags: ["Automação", "Agendamento"] },
      { name: "Gestão Semanal", description: "Checklist semanal de tarefas de gestão com status e histórico", path: "/gestao-semanal", status: "active", tags: ["Gestão", "Checklist"] },
      { name: "Log da Diretoria", description: "Registro de decisões e ações estratégicas para histórico executivo", path: "/log-diretoria", status: "active", tags: ["Log", "Executivo"] },
      { name: "Briefings", description: "Criação e gestão de briefings de campanha e projetos", path: "/briefings", status: "active", tags: ["Briefing"] },
    ],
  },
  {
    id: "redes-sociais",
    icon: Globe,
    color: "text-indigo-400",
    title: "Redes Sociais",
    subtitle: "Gestão de Instagram, YouTube, TikTok, LinkedIn, Facebook",
    features: [
      { name: "Dashboard Social", description: "Visão geral de todas as redes sociais com métricas consolidadas", path: "/redes-sociais", status: "active", tags: ["Instagram", "YouTube"] },
      { name: "Posts e Publicações", description: "Gestão de posts com métricas de alcance, engajamento e impressões", path: "/redes-sociais/posts", status: "active", tags: ["Posts", "Instagram"] },
      { name: "Análise de Performance", description: "Análise detalhada de performance por tipo de conteúdo e horário", path: "/redes-sociais/analise", status: "active", tags: ["Análise"] },
      { name: "Comparativo de Redes", description: "Comparação de métricas entre diferentes redes sociais", path: "/redes-sociais/comparar", status: "active", tags: ["Comparativo"] },
      { name: "Agendamento de Posts", description: "Calendário editorial com agendamento e sugestões de horários", path: "/redes-sociais/agendamento", status: "active", tags: ["Agendamento"] },
      { name: "Relatórios Sociais", description: "Relatórios de performance com exportação PDF/CSV", path: "/redes-sociais/relatorios", status: "active", tags: ["Relatório", "PDF"] },
      { name: "Integração Instagram MCP", description: "Conexão direta com a API do Instagram para dados em tempo real", path: "/redes-sociais/integracao", status: "active", tags: ["API", "Instagram"] },
    ],
  },
  {
    id: "google-business",
    icon: Search,
    color: "text-red-400",
    title: "Google Business Profile",
    subtitle: "Otimização do perfil local da Zênite Tech",
    features: [
      { name: "GB Zênite Optimizer", description: "Otimização do Google Business Profile: posts, produtos, categorias, horários especiais", path: "/gb-zenite", status: "active", tags: ["GBP", "SEO Local"] },
    ],
  },
  {
    id: "clientes",
    icon: Users,
    color: "text-teal-400",
    title: "Clientes e CRM",
    subtitle: "Gestão de clientes e documentos",
    features: [
      { name: "Leads (Planilha)", description: "Planilha de leads com dados de contato, origem e status de qualificação", path: "/leads", status: "active", tags: ["Leads", "CRM"] },
      { name: "Documentos", description: "Repositório de documentos, contratos e propostas por cliente", path: "/documentos", status: "active", tags: ["Documentos"] },
      { name: "Admin Clientes", description: "Gestão administrativa de clientes com histórico de interações", path: "/admin-clientes", status: "active", tags: ["Admin"] },
      { name: "Centro de Feedback", description: "Coleta e análise de feedback de clientes e usuários do dashboard", path: "/feedback", status: "active", tags: ["Feedback"] },
    ],
  },
  {
    id: "admin",
    icon: Settings,
    color: "text-slate-400",
    title: "Administração",
    subtitle: "Configurações e controle de acesso",
    features: [
      { name: "Usuários", description: "Gestão de usuários do dashboard com controle de permissões e roles", path: "/admin/users", status: "active", tags: ["Usuários", "Permissões"] },
      { name: "Notificações", description: "Central de notificações do sistema com histórico de alertas", path: "/notificacoes", status: "active", tags: ["Notificações"] },
      { name: "Perfil", description: "Configurações de perfil, senha e preferências do usuário", path: "/perfil", status: "active", tags: ["Perfil"] },
    ],
  },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
  beta: { label: "Beta", className: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" },
  new: { label: "Novo", className: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
};

export default function Funcionalidades() {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(FEATURE_GROUPS.map(g => [g.id, true]))
  );
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const allTags = Array.from(
    new Set(FEATURE_GROUPS.flatMap(g => g.features.flatMap(f => f.tags ?? [])))
  ).sort();

  const totalFeatures = FEATURE_GROUPS.reduce((s, g) => s + g.features.length, 0);
  const totalPages = FEATURE_GROUPS.reduce((s, g) => s + g.features.filter(f => f.path).length, 0);

  function toggleGroup(id: string) {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function matchesSearch(f: Feature) {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || (f.tags ?? []).some(t => t.toLowerCase().includes(q));
  }

  function matchesTag(f: Feature) {
    if (!filterTag) return true;
    return (f.tags ?? []).includes(filterTag);
  }

  const filteredGroups = FEATURE_GROUPS.map(g => ({
    ...g,
    features: g.features.filter(f => matchesSearch(f) && matchesTag(f)),
  })).filter(g => g.features.length > 0);

  function exportCSV() {
    const rows = FEATURE_GROUPS.flatMap(g =>
      g.features.map(f => [g.title, f.name, f.description, f.path ?? "", f.status, (f.tags ?? []).join("; ")])
    );
    const csv = [
      ["Módulo", "Funcionalidade", "Descrição", "URL", "Status", "Tags"].join(","),
      ...rows.map(r => r.map(v => `"${v}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zenite-dashboard-funcionalidades-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-blue-500" />
              Lista de Funcionalidades
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Social Ads Zênite Tech · {totalFeatures} funcionalidades em {FEATURE_GROUPS.length} módulos · {totalPages} páginas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 rounded-lg border border-border transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Stats rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Módulos", value: FEATURE_GROUPS.length, icon: Database, color: "text-blue-400" },
            { label: "Funcionalidades", value: totalFeatures, icon: CheckCircle, color: "text-emerald-400" },
            { label: "Páginas", value: totalPages, icon: Link2, color: "text-violet-400" },
            { label: "Integrações API", value: 5, icon: Cpu, color: "text-orange-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Buscar funcionalidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterTag(null)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${!filterTag ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              Todos
            </button>
            {["Google Ads", "GA4", "IA", "API Real", "PDF", "Alertas", "Automação"].map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${filterTag === tag ? "bg-violet-600 text-white border-violet-600" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Grupos de funcionalidades */}
        {filteredGroups.map(group => {
          const Icon = group.icon;
          const isOpen = openGroups[group.id] !== false;
          return (
            <div key={group.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Header do grupo */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${group.color}`} />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">{group.title}</p>
                    <p className="text-xs text-muted-foreground">{group.subtitle} · {group.features.length} funcionalidades</p>
                  </div>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>

              {/* Lista de funcionalidades */}
              {isOpen && (
                <div className="border-t border-border divide-y divide-border/50">
                  {group.features.map(feature => {
                    const badge = STATUS_BADGE[feature.status];
                    return (
                      <div key={feature.name} className="flex items-start justify-between gap-4 px-5 py-3 hover:bg-muted/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{feature.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
                            {feature.tags?.map(tag => (
                              <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{tag}</span>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                        </div>
                        {feature.path && (
                          <Link href={feature.path}>
                            <button className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-0.5">
                              <ExternalLink className="w-3.5 h-3.5" />
                              Abrir
                            </button>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredGroups.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma funcionalidade encontrada para "{search}"</p>
          </div>
        )}

        {/* Rodapé */}
        <div className="rounded-xl border border-border bg-card/50 p-5 text-center">
          <p className="text-xs text-muted-foreground">
            Social Ads · Zênite Tech · Última atualização: 13/04/2026 · {totalFeatures} funcionalidades ativas
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Integrações ativas: Google Ads API · GA4 Data API · Gmail MCP · Instagram MCP · Google Business Profile
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
