import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Target, CheckCircle2, Clock, ExternalLink, Copy, Info,
  MessageCircle, FileText, MousePointerClick, Phone, AlertTriangle, Zap
} from "lucide-react";
import { toast } from "sonner";

interface ConversionEvent {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  priority: "alta" | "média" | "baixa";
  status: "configurado" | "pendente" | "parcial";
  trigger: string;
  ga4Config: string;
  googleAdsImport: boolean;
  estimatedConversions: string;
  lovablePrompt?: string;
}

const events: ConversionEvent[] = [
  {
    id: "whatsapp_click",
    name: "whatsapp_click",
    description: "Clique em qualquer botão ou link do WhatsApp no site — listener global + FloatingWhatsApp",
    icon: <MessageCircle className="w-4 h-4 text-green-400" />,
    priority: "alta",
    status: "configurado",
    trigger: "Listener global no Layout.tsx (qualquer link wa.me) + onClick no FloatingWhatsApp.tsx",
    ga4Config: "Ativo em G-9T2QMYCB3B e G-XN8107LBV6 via src/lib/gtag.ts. Valor: R$20. Marcar como conversão primária no Google Ads.",
    googleAdsImport: true,
    estimatedConversions: "15-30/mês",
    lovablePrompt: `// Já implementado em src/lib/gtag.ts
// Listener global no Layout.tsx:
document.addEventListener('click', (e) => {
  const link = (e.target as Element).closest('a');
  if (link?.href?.includes('wa.me') || link?.href?.includes('whatsapp')) {
    window.gtag?.('event', 'whatsapp_click', {
      send_to: ['AW-11154794013', 'G-9T2QMYCB3B', 'G-XN8107LBV6'],
      value: 20,
      currency: 'BRL'
    });
  }
});

// Ação pendente: marcar como conversão PRIMÁRIA no Google Ads
// Google Ads → Metas → Conversões → whatsapp_click → Editar → Categoria: Contato`,
  },
  {
    id: "generate_lead",
    name: "generate_lead",
    description: "Envio do formulário de contato (CONTACT_FORM) com sucesso no Contact.tsx",
    icon: <FileText className="w-4 h-4 text-blue-400" />,
    priority: "alta",
    status: "configurado",
    trigger: "onSubmit do Contact.tsx após envio bem-sucedido do formulário",
    ga4Config: "Ativo em G-9T2QMYCB3B e G-XN8107LBV6 via src/lib/gtag.ts. Valor: R$50. Marcar como conversão primária no Google Ads.",
    googleAdsImport: true,
    estimatedConversions: "5-15/mês",
    lovablePrompt: `// Já implementado em src/lib/gtag.ts + Contact.tsx
// Dispara após envio bem-sucedido:
window.gtag?.('event', 'generate_lead', {
  send_to: ['AW-11154794013', 'G-9T2QMYCB3B', 'G-XN8107LBV6'],
  value: 50,
  currency: 'BRL',
  event_category: 'form',
  event_label: 'CONTACT_FORM'
});

// Ação pendente: marcar como conversão PRIMÁRIA no Google Ads
// Google Ads → Metas → Conversões → generate_lead → Editar → Categoria: Lead`,
  },
  {
    id: "page_view_solution",
    name: "page_view_solution",
    description: "Visualização de página de solução específica (avant-charge, guardia, etc.)",
    icon: <MousePointerClick className="w-4 h-4 text-purple-400" />,
    priority: "média",
    status: "configurado",
    trigger: "Automático via GA4 — page_view com pathname /solucoes/*",
    ga4Config: "GA4 → Administrador → Eventos → Criar evento baseado em page_view",
    googleAdsImport: false,
    estimatedConversions: "100-300/mês",
  },
  {
    id: "phone_click",
    name: "phone_click",
    description: "Clique em número de telefone no site",
    icon: <Phone className="w-4 h-4 text-yellow-400" />,
    priority: "média",
    status: "pendente",
    trigger: "Clique em link tel: no site",
    ga4Config: "GA4 → Administrador → Eventos → Criar evento → phone_click",
    googleAdsImport: false,
    estimatedConversions: "3-8/mês",
    lovablePrompt: `Adicione rastreamento para cliques em telefone:

Em cada link de telefone (href='tel:...'), adicione ao onClick:
  window.gtag?.('event', 'phone_click', {
    event_category: 'engagement',
    event_label: 'phone_contact'
  });`,
  },
  {
    id: "scroll_depth",
    name: "scroll_depth",
    description: "Usuário rolou 75% da página de solução (engajamento qualificado)",
    icon: <Zap className="w-4 h-4 text-orange-400" />,
    priority: "baixa",
    status: "pendente",
    trigger: "Scroll 75% em páginas /solucoes/*",
    ga4Config: "GA4 → Administrador → Eventos → Criar evento baseado em scroll",
    googleAdsImport: false,
    estimatedConversions: "50-150/mês",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="border-border text-muted-foreground hover:bg-muted text-xs h-7"
    >
      {copied ? <CheckCircle2 className="w-3 h-3 mr-1 text-green-400" /> : <Copy className="w-3 h-3 mr-1" />}
      {copied ? "Copiado!" : "Copiar prompt"}
    </Button>
  );
}

const priorityColor = {
  alta: "bg-red-500/10 text-red-400 border-red-500/20",
  média: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  baixa: "bg-gray-500/10 text-muted-foreground border-gray-500/20",
};

const statusColor = {
  configurado: "bg-green-500/20 text-green-400 border-green-500/30",
  pendente: "bg-red-500/20 text-red-400 border-red-500/30",
  parcial: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const statusLabel = {
  configurado: "✅ Configurado",
  pendente: "⏳ Pendente",
  parcial: "⚠️ Parcial",
};

export default function GA4ConversionEvents() {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const configured = events.filter(e => e.status === "configurado").length;
  const pending = events.filter(e => e.status === "pendente").length;
  const adsImport = events.filter(e => e.googleAdsImport).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-400" />
            Eventos de Conversão GA4
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            G-XN8107LBV6 (zenitetech.com) — Configuração e status dos eventos de conversão
          </p>
        </div>
        <a
          href="https://analytics.google.com/analytics/web/#/a332699474p531461479/admin/events"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-foreground">
            <ExternalLink className="w-4 h-4 mr-1" />
            Abrir GA4
          </Button>
        </a>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">Total de Eventos</div>
            <div className="text-2xl font-bold text-foreground">{events.length}</div>
            <div className="text-muted-foreground text-xs">mapeados</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">Configurados</div>
            <div className="text-2xl font-bold text-green-400">{configured}</div>
            <div className="text-muted-foreground text-xs">ativos no GA4</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">Pendentes</div>
            <div className="text-2xl font-bold text-red-400">{pending}</div>
            <div className="text-muted-foreground text-xs">precisam de ação</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs mb-1">Importar p/ Google Ads</div>
            <div className="text-2xl font-bold text-yellow-400">{adsImport}</div>
            <div className="text-muted-foreground text-xs">eventos de conversão</div>
          </CardContent>
        </Card>
      </div>

      {/* Funil de Conversão */}
      <div className="border border-indigo-500/20 rounded-xl p-1">
        <div className="bg-indigo-500/5 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            <h2 className="text-foreground font-semibold text-base">Funil de Conversão do Usuário</h2>
            <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded px-2 py-0.5">Estimativa baseada em dados reais</span>
          </div>

          <div className="flex flex-col md:flex-row items-stretch gap-0">
            {[
              { stage: "Impressões", value: 194, pct: 100, color: "bg-indigo-600", textColor: "text-indigo-300", icon: "👁️", desc: "Buscas no Google que exibiram o site", source: "Search Console (real)" },
              { stage: "Cliques", value: 5, pct: 2.6, color: "bg-blue-600", textColor: "text-blue-300", icon: "🔗", desc: "Usuários que clicaram no resultado orgânico", source: "Search Console (real)" },
              { stage: "Sessões", value: 30, pct: 15.5, color: "bg-cyan-600", textColor: "text-cyan-300", icon: "📱", desc: "Sessões totais (orgânico + pago + direto)", source: "GA4 Data API (real)" },
              { stage: "Engajamento", value: 18, pct: 9.3, color: "bg-teal-600", textColor: "text-teal-300", icon: "⏱️", desc: "Sessões com >10s ou 2+ páginas visitadas", source: "Estimativa (60% das sessões)" },
              { stage: "Leads", value: 0, pct: 0, color: "bg-yellow-600", textColor: "text-yellow-300", icon: "📨", desc: "Formulários enviados ou WhatsApp clicado", source: "Pendente: configurar eventos" },
              { stage: "Conversões", value: 0, pct: 0, color: "bg-green-600", textColor: "text-green-300", icon: "✅", desc: "Leads qualificados que viraram oportunidade", source: "Pendente: importar para Google Ads" },
            ].map((item, i, arr) => {
              const barWidth = item.pct > 0 ? Math.max(item.pct, 5) : 3;
              return (
                <div key={i} className="flex-1 flex flex-col">
                  <div className="bg-card border border-border rounded-lg p-3 mx-1 flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg">{item.icon}</span>
                      <span className={`text-xs font-mono ${item.textColor}`}>{item.pct > 0 ? `${item.pct}%` : "0%"}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 mb-2">
                      <div
                        className={`${item.color} h-2 rounded-full transition-all`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <p className={`text-sm font-bold ${item.textColor} mb-0.5`}>{item.stage}</p>
                    <p className={`text-xl font-bold text-foreground mb-1`}>{item.value.toLocaleString()}</p>
                    <p className="text-muted-foreground text-xs">{item.desc}</p>
                    <p className={`text-xs mt-1 ${item.value === 0 ? "text-red-400" : "text-gray-600"}`}>{item.source}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="hidden md:flex items-center justify-center text-gray-600 text-xs mt-2">→</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Taxa de Clique (CTR)</p>
              <p className="text-lg font-bold text-blue-400">2.6%</p>
              <p className="text-xs text-muted-foreground">5 cliques / 194 impressões</p>
              <p className="text-xs text-green-400 mt-1">↑ Acima da média (2%)</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Taxa de Lead (pendente)</p>
              <p className="text-lg font-bold text-yellow-400">N/A</p>
              <p className="text-xs text-muted-foreground">Requer whatsapp_click configurado</p>
              <p className="text-xs text-red-400 mt-1">⚠️ Configurar no Lovable</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Meta de Conversão</p>
              <p className="text-lg font-bold text-green-400">3-5%</p>
              <p className="text-xs text-muted-foreground">Sessões → Lead (benchmark B2B)</p>
              <p className="text-xs text-muted-foreground mt-1">≈ 1-2 leads por 30 sessões</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de ação prioritária */}
      <Card className="bg-card border-yellow-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium text-sm">Ação prioritária: Importar conversões para o Google Ads</p>
              <p className="text-muted-foreground text-xs mt-1">
                Após configurar <strong className="text-foreground">whatsapp_click</strong> e <strong className="text-foreground">generate_lead</strong> no GA4,
                importe-os para o Google Ads em: <strong className="text-foreground">Google Ads → Metas → Conversões → + Nova → Importar do Google Analytics 4</strong>.
                Isso permitirá que as campanhas otimizem por conversão real em vez de cliques.
              </p>
              <a
                href="https://ads.google.com/aw/conversions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 text-xs flex items-center gap-1 mt-2 hover:underline"
              >
                Abrir Google Ads → Conversões <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de eventos */}
      <div className="space-y-3">
        {events.map((event) => (
          <Card key={event.id} className="bg-card border-border">
            <CardContent className="p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
              >
                <div className="flex items-center gap-3">
                  {event.icon}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-mono text-sm font-medium">{event.name}</span>
                      {event.googleAdsImport && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                          → Google Ads
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs mt-0.5">{event.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className={`text-xs ${priorityColor[event.priority]}`}>
                    {event.priority}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${statusColor[event.status]}`}>
                    {statusLabel[event.status]}
                  </Badge>
                </div>
              </div>

              {expandedEvent === event.id && (
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Gatilho
                      </p>
                      <p className="text-muted-foreground text-xs">{event.trigger}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                        <Target className="w-3 h-3" /> Configuração no GA4
                      </p>
                      <p className="text-muted-foreground text-xs">{event.ga4Config}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Estimativa de conversões</p>
                      <p className="text-green-400 text-sm font-medium">{event.estimatedConversions}</p>
                    </div>
                    {event.googleAdsImport && (
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs mb-1">Importar para Google Ads</p>
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                          ✅ Recomendado
                        </Badge>
                      </div>
                    )}
                  </div>

                  {event.lovablePrompt && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-muted-foreground text-xs flex items-center gap-1">
                          <Info className="w-3 h-3" /> Prompt para o Lovable
                        </p>
                        <CopyButton text={event.lovablePrompt} />
                      </div>
                      <div className="bg-muted rounded p-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                        {event.lovablePrompt}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Guia de importação para Google Ads */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            Passo a Passo — Importar Conversões GA4 → Google Ads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {[
              { step: 1, text: "Configure os eventos whatsapp_click e generate_lead no GA4 (use os prompts acima no Lovable)" },
              { step: 2, text: "Aguarde 24-48h para o GA4 começar a registrar os eventos" },
              { step: 3, text: "Acesse Google Ads → Metas → Conversões → + Nova conversão" },
              { step: 4, text: "Selecione 'Importar' → 'Google Analytics 4' → 'Continuar'" },
              { step: 5, text: "Selecione whatsapp_click e generate_lead → Importar e continuar" },
              { step: 6, text: "Nas campanhas, altere a estratégia de lances para 'Maximizar conversões' ou 'CPA desejado'" },
            ].map(({ step, text }) => (
              <li key={step} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step}
                </span>
                <p className="text-muted-foreground text-sm">{text}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          VINCULAR GOOGLE ADS AO GA4
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="border border-orange-500/20 rounded-xl p-1">
        <div className="bg-orange-500/5 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-400" />
            <h2 className="text-foreground font-semibold text-base">Vincular Google Ads ao GA4</h2>
            <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded px-2 py-0.5">Requer acesso manual</span>
          </div>

          <div className="bg-orange-900/20 border border-orange-800 rounded-lg p-4">
            <p className="text-orange-300 text-sm font-medium mb-1">⚠️ Por que isso é crítico?</p>
            <p className="text-muted-foreground text-xs">
              Sem a vinculação, o Google Ads não consegue ver as conversões do GA4. As campanhas otimizam apenas por cliques,
              não por leads reais. A vinculação é o pré-requisito para importar whatsapp_click e generate_lead como metas de conversão.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Via GA4 */}
            <div>
              <p className="text-sm font-semibold text-blue-300 mb-3">Opção A — Via GA4 (recomendado)</p>
              <ol className="space-y-2">
                {[
                  { step: 1, text: "Acesse analytics.google.com", link: "https://analytics.google.com" },
                  { step: 2, text: "Selecione a propriedade G-XN8107LBV6 (zenitetech.com)", link: null },
                  { step: 3, text: "Clique em Administrador (engrenagem) → Vinculações de produtos", link: null },
                  { step: 4, text: "Clique em Google Ads → Vincular", link: null },
                  { step: 5, text: "Selecione a conta Google Ads da Zênite Tech → Confirmar", link: null },
                  { step: 6, text: "Aguarde 24h para os dados aparecerem no Google Ads", link: null },
                ].map(({ step, text, link }) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{step}</span>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline flex items-center gap-1">
                        {text} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <p className="text-muted-foreground text-xs">{text}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            {/* Via Google Ads */}
            <div>
              <p className="text-sm font-semibold text-green-300 mb-3">Opção B — Via Google Ads</p>
              <ol className="space-y-2">
                {[
                  { step: 1, text: "Acesse ads.google.com", link: "https://ads.google.com" },
                  { step: 2, text: "Menu → Ferramentas e configurações → Configurações → Contas vinculadas", link: null },
                  { step: 3, text: "Clique em Google Analytics 4 → Detalhes", link: null },
                  { step: 4, text: "Encontre G-XN8107LBV6 (zenitetech.com) → Vincular", link: null },
                  { step: 5, text: "Confirme a vinculação e ative a importação de métricas", link: null },
                ].map(({ step, text, link }) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-green-600 text-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{step}</span>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline flex items-center gap-1">
                        {text} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <p className="text-muted-foreground text-xs">{text}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="bg-card rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <span className="text-yellow-400 font-semibold">⚠️ Permissões necessárias:</span> Você precisa ser <strong className="text-foreground">Administrador</strong> na propriedade GA4
              E ter acesso de <strong className="text-foreground">Administrador</strong> na conta Google Ads para realizar a vinculação.
              Se não aparecer a opção, verifique se o e-mail logado tem as permissões corretas em ambas as plataformas.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          RELATÓRIO SEO ORGÂNICO — zenite.tech (G-9T2QMYCB3B)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="border border-purple-500/20 rounded-xl p-1">
        <div className="bg-purple-500/5 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            <h2 className="text-foreground font-semibold text-base">Relatório SEO Orgânico — zenite.tech</h2>
            <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded px-2 py-0.5">G-9T2QMYCB3B</span>
          </div>

          <div className="bg-card rounded-lg p-4">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Contexto do domínio</p>
            <div className="grid md:grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span>Domínio</span>
                  <span className="text-foreground font-mono">zenite.tech</span>
                </div>
                <div className="flex justify-between">
                  <span>Propriedade GA4</span>
                  <span className="text-purple-400 font-mono">G-9T2QMYCB3B</span>
                </div>
                <div className="flex justify-between">
                  <span>Finalidade</span>
                  <span className="text-foreground">SEO orgânico (domínio legado)</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span>Domínio principal</span>
                  <span className="text-foreground font-mono">zenitetech.com</span>
                </div>
                <div className="flex justify-between">
                  <span>Propriedade principal</span>
                  <span className="text-blue-400 font-mono">G-XN8107LBV6</span>
                </div>
                <div className="flex justify-between">
                  <span>Google Ads vinculado</span>
                  <span className="text-green-400">zenitetech.com apenas</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {[
              {
                title: "Canonical correto",
                status: "pendente",
                desc: "Todas as páginas de zenite.tech devem ter canonical apontando para zenitetech.com para evitar conteúdo duplicado",
                action: "Verificar meta canonical em cada página do Lovable",
                priority: "CRÍTICO",
                color: "border-red-800 bg-red-900/20",
                textColor: "text-red-400",
              },
              {
                title: "Redirect 301",
                status: "pendente",
                desc: "Configurar redirect permanente de zenite.tech → zenitetech.com para consolidar autoridade de domínio",
                action: "Configurar no Lovable: redirect de zenite.tech para zenitetech.com",
                priority: "ALTO",
                color: "border-orange-800 bg-orange-900/20",
                textColor: "text-orange-400",
              },
              {
                title: "Sitemap separado",
                status: "ok",
                desc: "Manter sitemap.xml em zenite.tech para rastreamento orgânico enquanto a migração não é concluída",
                action: "Verificar zenite.tech/sitemap.xml está acessível",
                priority: "MÉDIO",
                color: "border-yellow-800 bg-yellow-900/20",
                textColor: "text-yellow-400",
              },
            ].map((item, i) => (
              <div key={i} className={`border rounded-lg p-4 ${item.color}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${item.textColor}`}>[{item.priority}]</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    item.status === "ok" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {item.status === "ok" ? "✅ OK" : "⏳ Pendente"}
                  </span>
                </div>
                <p className="text-foreground text-sm font-medium mb-1">{item.title}</p>
                <p className="text-muted-foreground text-xs mb-2">{item.desc}</p>
                <p className="text-muted-foreground text-xs">🔧 {item.action}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">Estratégia de SEO para zenite.tech</p>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                {
                  icon: "📊",
                  title: "Monitorar no Search Console separado",
                  desc: "Adicionar zenite.tech como propriedade separada no Search Console para acompanhar o tráfego orgânico residual e identificar quais termos ainda geram visitas via domínio legado.",
                  link: "https://search.google.com/search-console",
                  linkText: "Abrir Search Console",
                },
                {
                  icon: "🔗",
                  title: "Backlinks apontando para zenite.tech",
                  desc: "Verificar backlinks existentes em zenite.tech e solicitar atualização para zenitetech.com. Use o Ahrefs Free ou Google Search Console para identificar os principais backlinks.",
                  link: "https://ahrefs.com/backlink-checker",
                  linkText: "Verificar backlinks",
                },
                {
                  icon: "📈",
                  title: "Comparação de tráfego orgânico",
                  desc: "Acompanhar se o tráfego orgânico está migrando de zenite.tech para zenitetech.com. Esperado: queda em zenite.tech e crescimento em zenitetech.com nos próximos 3-6 meses.",
                  link: "https://analytics.google.com",
                  linkText: "Comparar no GA4",
                },
                {
                  icon: "🎯",
                  title: "Google Ads: usar apenas zenitetech.com",
                  desc: "Todas as URLs de destino das campanhas Google Ads devem apontar para zenitetech.com. Não usar zenite.tech como URL de destino em nenhuma campanha ativa.",
                  link: "https://ads.google.com",
                  linkText: "Verificar URLs no Ads",
                },
              ].map((item, i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-foreground text-sm font-medium mb-1">{item.title}</p>
                      <p className="text-muted-foreground text-xs mb-2">{item.desc}</p>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 text-xs flex items-center gap-1 hover:underline"
                      >
                        {item.linkText} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground">
              <span className="text-purple-400 font-semibold">💡 Estratégia recomendada:</span> Manter zenite.tech ativo com redirect 301 para zenitetech.com.
              Isso preserva a autoridade de domínio acumulada e transfere o "link juice" para o novo domínio.
              O GA4 G-9T2QMYCB3B deve ser mantido apenas para monitorar o tráfego residual de zenite.tech,
              sem vincular ao Google Ads.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          COMPARAÇÃO DE TRÁFEGO: G-9T2QMYCB3B vs G-XN8107LBV6
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="border border-cyan-500/20 rounded-xl p-1">
        <div className="bg-cyan-500/5 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            <h2 className="text-foreground font-semibold text-base">Comparação de Tráfego Orgânico</h2>
            <span className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded px-2 py-0.5">zenite.tech vs zenitetech.com</span>
          </div>

          {/* Tabela comparativa */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground text-xs py-2 pr-4">Métrica</th>
                  <th className="text-center text-purple-400 text-xs py-2 px-4">
                    zenite.tech
                    <div className="text-muted-foreground font-normal">G-9T2QMYCB3B</div>
                  </th>
                  <th className="text-center text-blue-400 text-xs py-2 px-4">
                    zenitetech.com
                    <div className="text-muted-foreground font-normal">G-XN8107LBV6</div>
                  </th>
                  <th className="text-center text-muted-foreground text-xs py-2 pl-4">Tendência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {[
                  { metric: "Sessões orgânicas (7d)", zenite: "~12-18", zenitetech: "~8-12", trend: "↓ migrando", trendColor: "text-orange-400" },
                  { metric: "Usuários orgânicos (7d)", zenite: "~10-15", zenitetech: "~7-10", trend: "↓ migrando", trendColor: "text-orange-400" },
                  { metric: "Cliques Search Console (28d)", zenite: "N/A", zenitetech: "5 (real)", trend: "↑ crescendo", trendColor: "text-green-400" },
                  { metric: "Impressões Search Console (28d)", zenite: "N/A", zenitetech: "194 (real)", trend: "↑ crescendo", trendColor: "text-green-400" },
                  { metric: "Posição média Google", zenite: "~8-12", zenitetech: "7.3 (real)", trend: "↑ melhorando", trendColor: "text-green-400" },
                  { metric: "CTR médio", zenite: "~1-2%", zenitetech: "2.6% (real)", trend: "↑ melhorando", trendColor: "text-green-400" },
                  { metric: "Google Ads vinculado", zenite: "Não", zenitetech: "Pendente", trend: "⚠️ ação", trendColor: "text-yellow-400" },
                  { metric: "Eventos de conversão", zenite: "Não", zenitetech: "Pendente", trend: "⚠️ ação", trendColor: "text-yellow-400" },
                ].map((row, i) => (
                  <tr key={i}>
                    <td className="text-muted-foreground text-xs py-2 pr-4">{row.metric}</td>
                    <td className="text-center text-purple-300 text-xs py-2 px-4 font-mono">{row.zenite}</td>
                    <td className="text-center text-blue-300 text-xs py-2 px-4 font-mono">{row.zenitetech}</td>
                    <td className={`text-center text-xs py-2 pl-4 font-medium ${row.trendColor}`}>{row.trend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Diagrama de migração */}
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Fluxo de Migração de Domínio</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <div className="text-center">
                <div className="bg-purple-900/30 border border-purple-700 rounded-lg px-4 py-3">
                  <p className="text-purple-300 font-mono text-sm font-bold">zenite.tech</p>
                  <p className="text-muted-foreground text-xs mt-1">Domínio legado</p>
                  <p className="text-muted-foreground text-xs">G-9T2QMYCB3B</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="text-yellow-400 text-lg">→</div>
                <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded px-2 py-1">301 Redirect</div>
                <div className="text-muted-foreground text-xs">pendente</div>
              </div>
              <div className="text-center">
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg px-4 py-3">
                  <p className="text-blue-300 font-mono text-sm font-bold">zenitetech.com</p>
                  <p className="text-muted-foreground text-xs mt-1">Domínio principal</p>
                  <p className="text-muted-foreground text-xs">G-XN8107LBV6</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="text-green-400 text-lg">→</div>
                <div className="text-xs text-green-400 bg-green-900/20 border border-green-800 rounded px-2 py-1">Google Ads</div>
                <div className="text-muted-foreground text-xs">vincular</div>
              </div>
              <div className="text-center">
                <div className="bg-green-900/30 border border-green-700 rounded-lg px-4 py-3">
                  <p className="text-green-300 font-mono text-sm font-bold">Conversões</p>
                  <p className="text-muted-foreground text-xs mt-1">whatsapp_click</p>
                  <p className="text-muted-foreground text-xs">generate_lead</p>
                </div>
              </div>
            </div>
          </div>

          {/* Checklist de ações */}
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-sm font-semibold text-muted-foreground mb-3">✅ Checklist de Ações Prioritárias</p>
            <div className="space-y-2">
              {[
                { done: false, priority: "URGENTE", color: "text-red-400", text: "Configurar redirect 301: zenite.tech → zenitetech.com no Lovable" },
                { done: false, priority: "URGENTE", color: "text-red-400", text: "Vincular Google Ads ao GA4 G-XN8107LBV6 (ver seção acima)" },
                { done: false, priority: "ALTO", color: "text-orange-400", text: "Implementar whatsapp_click e generate_lead no site via Lovable (prompts disponíveis acima)" },
                { done: false, priority: "ALTO", color: "text-orange-400", text: "Importar conversões GA4 → Google Ads após configurar os eventos" },
                { done: true, priority: "CONCLUÍDO", color: "text-green-400", text: "Search Console zenitetech.com conectado com dados reais (5 cliques, 194 impressões, pos. 7.3)" },
                { done: true, priority: "CONCLUÍDO", color: "text-green-400", text: "GA4 Data API integrada com dados reais (30 sessões, 86% Brasil, 7d)" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`text-xs font-bold flex-shrink-0 mt-0.5 w-20 ${item.color}`}>[{item.priority}]</span>
                  <div className="flex items-start gap-2">
                    <span className={item.done ? "text-green-400" : "text-gray-600"}>{item.done ? "✅" : "□"}</span>
                    <p className="text-muted-foreground text-xs">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="border-purple-700 text-purple-400 hover:bg-purple-900/20 text-xs">
                <ExternalLink className="w-3 h-3 mr-1" />
                GA4 zenite.tech (G-9T2QMYCB3B)
              </Button>
            </a>
            <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="border-blue-700 text-blue-400 hover:bg-blue-900/20 text-xs">
                <ExternalLink className="w-3 h-3 mr-1" />
                GA4 zenitetech.com (G-XN8107LBV6)
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
