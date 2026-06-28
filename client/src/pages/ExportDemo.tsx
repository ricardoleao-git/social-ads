import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Printer,
  Download,
  FileText,
  CheckCircle2,
  ChevronRight,
  Eye,
  Settings,
  Monitor,
  Smartphone,
  Info,
  BarChart3,
  Table,
  Layout,
  Zap,
} from "lucide-react";

// Dados do relatório de impacto de 04/04/2026 para demonstração
// Fonte: relatorio_impacto_04_04_2026.pdf
const DEMO_DATA = {
  data: "04/04/2026",
  negativos: 37,
  urlsCorrigidas: 9,
  extensoes: 12,
  economiaMin: 266,
  economiaMax: 531,
  ctrAtual: 6.86,
  cpcAtual: 3.94,
  grupos: [
    { nome: "PABX em Nuvem", ctr: "4,5%", cpc: "R$ 4,20", status: "Corrigido" },
    { nome: "ZIPY WhatsApp", ctr: "6,2%", cpc: "R$ 2,89", status: "Corrigido" },
    { nome: "Acesso Controle", ctr: "5,8%", cpc: "R$ 3,50", status: "Corrigido" },
  ],
};

const STEPS = [
  {
    id: 1,
    title: "Acesse a página do Relatório de Impacto",
    description: "Navegue até /impact-report no dashboard. A página carrega automaticamente o relatório mais recente.",
    icon: Layout,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    id: 2,
    title: "Clique no botão 'Exportar PDF'",
    description: "O botão está no canto superior direito da página, ao lado de 'Exportar CSV' e 'Comparar Períodos'.",
    icon: Printer,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    id: 3,
    title: "Configure a impressão no navegador",
    description: "O diálogo de impressão do sistema abre automaticamente. Selecione 'Salvar como PDF' no destino.",
    icon: Settings,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    id: 4,
    title: "Ajuste as configurações de layout",
    description: "Recomendado: Orientação Paisagem, margens Nenhuma, escala 80–90%. Ative 'Gráficos de fundo'.",
    icon: Monitor,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    id: 5,
    title: "Salve o PDF",
    description: "Clique em 'Salvar'. O arquivo gerado inclui todos os gráficos, tabelas e seções do relatório.",
    icon: Download,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
];

const INCLUDED_SECTIONS = [
  { icon: BarChart3, label: "KPIs principais (CTR, CPC, economia estimada)" },
  { icon: Table, label: "Tabela de negativos por grupo (37 termos)" },
  { icon: FileText, label: "URLs corrigidas com antes/depois (9 anúncios)" },
  { icon: Zap, label: "Extensões criadas (6 sitelinks + 6 callouts)" },
  { icon: BarChart3, label: "Gráficos de impacto estimado de CPC e CTR" },
  { icon: BarChart3, label: "Projeção de CTR por grupo (6 semanas)" },
  { icon: BarChart3, label: "Economia acumulada em 4 meses" },
  { icon: FileText, label: "Grupo Institucional — keywords de marca" },
  { icon: FileText, label: "Posts publicados no Google Business" },
  { icon: CheckCircle2, label: "Resumo executivo e próximos passos" },
];

const TIPS = [
  {
    icon: Monitor,
    title: "Chrome / Edge",
    tip: "Melhor compatibilidade com gráficos. Use Ctrl+P ou o botão 'Exportar PDF' na página.",
  },
  {
    icon: Smartphone,
    title: "Escala recomendada",
    tip: "80–90% para que o conteúdo caiba em uma página A4 sem cortar elementos.",
  },
  {
    icon: Eye,
    title: "Gráficos de fundo",
    tip: "Ative a opção 'Gráficos de fundo' (ou 'Background graphics') para preservar cores e gráficos.",
  },
  {
    icon: Info,
    title: "Orientação",
    tip: "Use Paisagem (Landscape) para melhor visualização das tabelas e gráficos horizontais.",
  },
];

export default function ExportDemo() {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50">
                Funcionalidade
              </Badge>
              <Badge variant="outline" className="text-xs font-semibold text-green-600 border-green-200 bg-green-50">
                Disponível
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Exportação em PDF</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Guia completo para exportar o Relatório de Impacto como arquivo PDF
            </p>
          </div>
          <Button onClick={handleExportPDF} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-foreground">
            <Printer className="w-4 h-4" />
            Testar Exportação
          </Button>
        </div>

        {/* Preview card */}
        <Card className="mb-6 border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Relatório de Impacto — 04/04/2026</div>
                  <div className="text-sm text-muted-foreground">
                    Zênite Tech · Google Ads · {DEMO_DATA.negativos} negativos · {DEMO_DATA.urlsCorrigidas} URLs · {DEMO_DATA.extensoes} extensões
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">R$ {DEMO_DATA.economiaMin}–{DEMO_DATA.economiaMax}</div>
                  <div className="text-xs text-muted-foreground">economia estimada/mês</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("/impact-report", "_blank")}
                  className="flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  Ver Relatório
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Steps */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Printer className="w-4 h-4 text-blue-600" />
                  Passo a Passo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {STEPS.map((step) => {
                    const Icon = step.icon;
                    const isActive = activeStep === step.id;
                    return (
                      <div
                        key={step.id}
                        className={`flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors ${
                          isActive ? "bg-blue-50 border border-blue-200" : "bg-gray-50 hover:bg-gray-100 border border-transparent"
                        }`}
                        onClick={() => setActiveStep(isActive ? null : step.id)}
                      >
                        <div className={`w-9 h-9 rounded-lg ${step.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${step.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground">0{step.id}</span>
                            <span className="font-semibold text-gray-900 text-sm">{step.title}</span>
                          </div>
                          {isActive && (
                            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{step.description}</p>
                          )}
                        </div>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isActive ? "rotate-90" : ""}`} />
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100">
                  <Button
                    onClick={handleExportPDF}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-foreground"
                  >
                    <Printer className="w-4 h-4" />
                    Exportar Esta Página como PDF (Demonstração)
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Clique para abrir o diálogo de impressão do navegador
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-500" />
                  Dicas para Melhor Resultado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {TIPS.map((tip, i) => {
                    const Icon = tip.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-gray-700 mb-1">{tip.title}</div>
                          <div className="text-xs text-muted-foreground leading-relaxed">{tip.tip}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Included sections */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Conteúdo Incluído no PDF
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {INCLUDED_SECTIONS.map((section, i) => {
                    const Icon = section.icon;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                        <span>{section.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  Dados do Relatório
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-muted-foreground">Data</span>
                    <span className="text-sm font-semibold text-gray-900">{DEMO_DATA.data}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-muted-foreground">Negativos</span>
                    <Badge className="bg-amber-100 text-amber-700 font-semibold">{DEMO_DATA.negativos}</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-muted-foreground">URLs Corrigidas</span>
                    <Badge className="bg-blue-100 text-blue-700 font-semibold">{DEMO_DATA.urlsCorrigidas}</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-muted-foreground">Extensões</span>
                    <Badge className="bg-green-100 text-green-700 font-semibold">{DEMO_DATA.extensoes}</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-muted-foreground">CTR Atual</span>
                    <span className="text-sm font-bold text-gray-900">{DEMO_DATA.ctrAtual}%</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Economia Est.</span>
                    <span className="text-sm font-bold text-green-600">
                      R$ {DEMO_DATA.economiaMin}–{DEMO_DATA.economiaMax}/mês
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Formats comparison */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Download className="w-4 h-4 text-gray-600" />
                  Formatos Disponíveis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Printer className="w-3 h-3 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-700">PDF (via impressão)</span>
                      <Badge className="text-xs bg-blue-100 text-blue-600 ml-auto">Esta página</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Preserva gráficos, cores e layout. Ideal para apresentações e arquivamento.</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Download className="w-3 h-3 text-green-600" />
                      <span className="text-xs font-semibold text-green-700">CSV (dados brutos)</span>
                      <Badge className="text-xs bg-green-100 text-green-600 ml-auto">Disponível</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Exporta negativos, URLs, extensões e impacto em formato tabular para Excel ou Sheets.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .p-6 { visibility: visible; }
          .p-6 * { visibility: visible; }
          .p-6 { position: absolute; left: 0; top: 0; width: 100%; }
          button { display: none !important; }
          .cursor-pointer { cursor: default; }
        }
      `}</style>
    </>
  );
}
