/**
 * Multi-format exporter stub for Instagram Dashboard
 * Supports PDF and XLSX export
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExportRow = Record<string, any>;

const downloadCSV = (data: ExportRow[], filename: string, headers?: string[]) => {
  const cols = headers ?? (data.length > 0 ? Object.keys(data[0]) : []);
  const rows = data.map((row) => cols.map((col) => `"${row[col] ?? ''}"`).join(','));
  const csv = [cols.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToPDF = (
  data: ExportRow[],
  filename: string,
  title?: string,
  headers?: string[]
): void => {
  // Stub: In production, use jsPDF
  console.log(`Exporting PDF: ${title ?? filename}`);
  downloadCSV(data, filename, headers);
};

export const exportToXLSX = (
  data: ExportRow[],
  filename: string,
  _sheetName?: string
): void => {
  // Stub: In production, use xlsx library
  downloadCSV(data, filename);
};

export const exportMetricsToPDF = (
  metrics: ExportRow,
  accountName: string,
  period: string
): void => {
  exportToPDF(
    [metrics],
    `metricas-${accountName}-${period}`,
    `Relatório de Métricas - ${accountName}`
  );
};

export const exportMetricsToXLSX = (
  metrics: ExportRow,
  accountName: string,
  period: string,
  top5Posts?: ExportRow[]
): void => {
  if (top5Posts && top5Posts.length > 0) {
    // Exportar métricas + top 5 posts em arquivo CSV com seções separadas
    const metricsCols = Object.keys(metrics);
    const postCols = ['posicao', 'tipo', 'data', 'curtidas', 'comentarios', 'compartilhamentos', 'alcance', 'legenda'];
    const metricsRow = metricsCols.map((col) => `"${metrics[col] ?? ''}"`).join(';');
    const postsRows = top5Posts.map((p, i) =>
      [i + 1, p.tipo ?? '', p.data ?? '', p.curtidas ?? 0, p.comentarios ?? 0, p.compartilhamentos ?? 0, p.alcance ?? 0, `"${(p.legenda ?? '').replace(/"/g, '""')}"`].join(';')
    );
    const csv = [
      '=== MÉTRICAS GERAIS ===',
      metricsCols.join(';'),
      metricsRow,
      '',
      '=== TOP 5 POSTS POR ALCANCE ===',
      postCols.join(';'),
      ...postsRows,
    ].join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metricas-${accountName}-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    exportToXLSX([metrics], `metricas-${accountName}-${period}`, 'Métricas');
  }
};

export const exportPostsToPDF = (
  posts: ExportRow[],
  accountName: string
): void => {
  exportToPDF(
    posts,
    `posts-${accountName}`,
    `Relatório de Posts - ${accountName}`
  );
};

export const exportPostsToXLSX = (
  posts: ExportRow[],
  accountName: string
): void => {
  exportToXLSX(posts, `posts-${accountName}`, 'Posts');
};

export default {
  exportToPDF,
  exportToXLSX,
  exportMetricsToPDF,
  exportMetricsToXLSX,
  exportPostsToPDF,
  exportPostsToXLSX,
};
