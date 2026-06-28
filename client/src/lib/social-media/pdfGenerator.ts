/**
 * PDF Generator stub for Instagram Dashboard
 * Full implementation would use jsPDF or similar library
 */

export interface ReportData {
  title?: string;
  period: string;
  accountName?: string;
  metrics: Record<string, number | string>;
  posts?: Array<Record<string, unknown>>;
  hashtags?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface PDFReportData {
  title?: string;
  period: string;
  accountName?: string;
  metrics: Record<string, number | string>;
  posts?: Array<Record<string, unknown>>;
  hashtags?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export const generatePDFReport = async (data: PDFReportData): Promise<void> => {
  // Stub: In production, use jsPDF or react-pdf to generate PDF
  console.log("Generating PDF report:", data.title);
  
  // Create a simple text-based download as fallback
  const content = `
RELATÓRIO: ${data.title}
Período: ${data.period}

MÉTRICAS:
${Object.entries(data.metrics).map(([k, v]) => `  ${k}: ${v}`).join('\n')}
  `.trim();

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-instagram-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

export const generateAccountReport = async (
  accountId: string,
  period: string
): Promise<void> => {
  await generatePDFReport({
    title: `Relatório de Performance - ${accountId}`,
    period,
    metrics: {
      'Seguidores': 'N/A',
      'Engajamento': 'N/A',
      'Alcance': 'N/A',
    },
  });
};

export const downloadPDFReport = generatePDFReport;

export default { generatePDFReport, generateAccountReport, downloadPDFReport };
