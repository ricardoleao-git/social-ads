import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Dicionário de siglas do marketing digital / Google Ads
 * Usado para exibir tooltips explicativos ao passar o mouse sobre as siglas.
 */
export const ACRONYMS: Record<string, { full: string; description: string }> = {
  RSA: {
    full: "Responsive Search Ad",
    description: "Anúncio Responsivo de Pesquisa — formato de anúncio do Google Ads que combina automaticamente até 15 títulos e 4 descrições para encontrar as melhores combinações.",
  },
  CTR: {
    full: "Click-Through Rate",
    description: "Taxa de Cliques — percentual de pessoas que clicaram no anúncio em relação ao total de impressões. Fórmula: (Cliques ÷ Impressões) × 100.",
  },
  CPC: {
    full: "Cost Per Click",
    description: "Custo por Clique — valor médio pago cada vez que alguém clica no anúncio. Fórmula: Gasto Total ÷ Cliques.",
  },
  CPR: {
    full: "Custo por Resultado",
    description: "Custo por Resultado (ou CPA — Cost Per Acquisition) — valor médio pago por cada conversão obtida. Fórmula: Gasto Total ÷ Conversões.",
  },
  CPA: {
    full: "Cost Per Acquisition",
    description: "Custo por Aquisição — valor médio pago por cada conversão ou lead gerado. Equivalente ao CPR. Fórmula: Gasto Total ÷ Conversões.",
  },
  ROAS: {
    full: "Return on Ad Spend",
    description: "Retorno sobre o Investimento em Anúncios — receita gerada para cada R$ 1 investido em anúncios. Fórmula: Receita ÷ Gasto × 100.",
  },
  ROI: {
    full: "Return on Investment",
    description: "Retorno sobre o Investimento — lucro líquido em relação ao custo total do investimento. Fórmula: (Receita - Custo) ÷ Custo × 100.",
  },
  KPI: {
    full: "Key Performance Indicator",
    description: "Indicador-chave de Desempenho — métricas usadas para medir o sucesso de uma campanha ou estratégia de marketing.",
  },
  CPM: {
    full: "Cost Per Mille",
    description: "Custo por Mil Impressões — valor pago a cada 1.000 exibições do anúncio. Usado principalmente em campanhas de Display e YouTube.",
  },
  GBP: {
    full: "Google Business Profile",
    description: "Perfil de Empresa no Google — página gratuita do Google que exibe informações do negócio no Google Maps e na pesquisa.",
  },
  GA4: {
    full: "Google Analytics 4",
    description: "Google Analytics 4 — plataforma de análise de dados do Google que rastreia o comportamento dos usuários no site e nos aplicativos.",
  },
};

interface AcronymTooltipProps {
  acronym: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Componente que exibe uma sigla com tooltip explicativo ao passar o mouse.
 * Uso: <AcronymTooltip acronym="CTR" /> ou <AcronymTooltip acronym="RSA">RSA Optimizer</AcronymTooltip>
 */
export function AcronymTooltip({ acronym, className = "", children }: AcronymTooltipProps) {
  const info = ACRONYMS[acronym.toUpperCase()];

  if (!info) {
    return <span className={className}>{children ?? acronym}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`cursor-help border-b border-dashed border-current/50 ${className}`}
            aria-label={`${acronym}: ${info.full}`}
          >
            {children ?? acronym}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-3" side="top">
          <div>
            <p className="font-semibold text-sm">
              {acronym} — {info.full}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Componente que exibe o nome completo da sigla + tooltip.
 * Uso: <AcronymLabel acronym="RSA" />
 * Renderiza: "RSA (Anúncio Responsivo de Pesquisa)" com tooltip
 */
export function AcronymLabel({ acronym, className = "" }: { acronym: string; className?: string }) {
  const info = ACRONYMS[acronym.toUpperCase()];
  if (!info) return <span className={className}>{acronym}</span>;

  const ptLabel = info.description.split(" — ")[0] ?? info.full;

  return (
    <AcronymTooltip acronym={acronym} className={className}>
      {acronym}
    </AcronymTooltip>
  );
}

export default AcronymTooltip;
