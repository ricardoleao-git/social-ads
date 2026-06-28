// jspdf e html2canvas são carregados dinamicamente para reduzir o bundle inicial

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  elementId?: string; // ID do elemento HTML a capturar (opcional)
  sections?: PdfSection[]; // Seções de dados estruturados (alternativa ao elementId)
}

export interface PdfSection {
  title: string;
  rows: { label: string; value: string; highlight?: boolean }[];
  pieChart?: PieSectionData; // opcional: gráfico de pizza
}

export interface PieSectionData {
  items: { name: string; value: number; color: string }[];
  totalLabel?: string;
  formatValue?: (v: number) => string;
}

/**
 * Gera PDF a partir de um elemento HTML (captura visual).
 * Ideal para dashboards com gráficos e tabelas.
 */
export async function exportElementToPdf(options: PdfExportOptions): Promise<void> {
  const { title, subtitle, filename, elementId } = options;

  const element = elementId
    ? document.getElementById(elementId)
    : document.body;

  if (!element) {
    throw new Error(`Elemento "${elementId}" não encontrado`);
  }

  // Lazy imports para reduzir bundle inicial
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // Captura o elemento como canvas
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // Cabeçalho
  pdf.setFillColor(15, 23, 42); // azul escuro
  pdf.rect(0, 0, pageWidth, 22, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text(title, margin, 12);
  if (subtitle) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(subtitle, margin, 18);
  }
  // Data de geração
  const now = new Date().toLocaleString("pt-BR");
  pdf.setFontSize(8);
  pdf.text(`Gerado em: ${now}`, pageWidth - margin, 18, { align: "right" });

  // Imagem do conteúdo
  const contentY = 25;
  const contentHeight = pageHeight - contentY - margin;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= contentHeight) {
    // Cabe em uma página
    pdf.addImage(imgData, "PNG", margin, contentY, imgWidth, imgHeight);
  } else {
    // Divide em múltiplas páginas
    let remainingHeight = imgHeight;
    let sourceY = 0;
    let isFirstPage = true;

    while (remainingHeight > 0) {
      if (!isFirstPage) {
        pdf.addPage();
        // Cabeçalho nas páginas seguintes
        pdf.setFillColor(15, 23, 42);
        pdf.rect(0, 0, pageWidth, 12, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.text(title, margin, 8);
      }

      const startY = isFirstPage ? contentY : 15;
      const availableHeight = pageHeight - startY - margin;
      const sliceHeight = Math.min(remainingHeight, availableHeight);
      const sourceHeight = (sliceHeight / imgHeight) * canvas.height;

      // Cria canvas parcial para a página atual
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
      }
      const pageImgData = pageCanvas.toDataURL("image/png");
      pdf.addImage(pageImgData, "PNG", margin, startY, imgWidth, sliceHeight);

      sourceY += sourceHeight;
      remainingHeight -= sliceHeight;
      isFirstPage = false;
    }
  }

  // Rodapé na última página
  pdf.setFillColor(240, 240, 240);
  pdf.rect(0, pageHeight - 8, pageWidth, 8, "F");
  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.text("Zênite Tech — Social Ads | zenite-ads.manus.space", margin, pageHeight - 3);
  pdf.text(`Página ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 3, { align: "right" });

  pdf.save(filename);
}

/**
 * Gera PDF estruturado a partir de dados (sem captura de tela).
 * Ideal para relatórios de texto com tabelas de dados.
 */
export async function exportDataToPdf(options: PdfExportOptions): Promise<void> {
  const { title, subtitle, filename, sections = [] } = options;

  // Lazy import para reduzir bundle inicial
  const { default: jsPDF } = await import("jspdf");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let y = 0;

  // Cabeçalho
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, 30, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text(title, margin, 16);
  if (subtitle) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(subtitle, margin, 23);
  }
  const now = new Date().toLocaleString("pt-BR");
  pdf.setFontSize(8);
  pdf.text(`Gerado em: ${now}`, pageWidth - margin, 27, { align: "right" });

  y = 38;

  // ─── Helper: desenhar gráfico de pizza (barras horizontais) ────────────────
  function drawPieChart(data: NonNullable<PdfSection["pieChart"]>, startY: number): number {
    const { items, totalLabel, formatValue } = data;
    const fmt = formatValue ?? ((v: number) => v.toFixed(2));
    const total = items.reduce((s, d) => s + d.value, 0);
    let cy = startY;

    // Título da legenda
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(50, 50, 50);
    pdf.text("Distribuição de Orçamento por Campanha", margin, cy);
    cy += 6;

    items.forEach((item) => {
      if (cy > pageHeight - 20) { pdf.addPage(); cy = 15; }

      const pct = total > 0 ? (item.value / total) * 100 : 0;
      const barW = (pageWidth - margin * 2) * 0.55;
      const fillW = barW * (pct / 100);

      // Cor da barra
      const hex = item.color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      // Fundo da barra
      pdf.setFillColor(230, 230, 230);
      pdf.roundedRect(margin, cy - 3, barW, 5, 1, 1, "F");

      // Barra preenchida
      if (fillW > 0) {
        pdf.setFillColor(r, g, b);
        pdf.roundedRect(margin, cy - 3, fillW, 5, 1, 1, "F");
      }

      // Texto: nome + valor + percentual
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(30, 30, 30);
      const nameX = margin + barW + 3;
      pdf.text(item.name.length > 22 ? item.name.substring(0, 22) + "…" : item.name, nameX, cy + 1);
      pdf.setFont("helvetica", "bold");
      pdf.text(fmt(item.value), pageWidth - margin, cy + 1, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${pct.toFixed(1)}%`, nameX + 55, cy + 1);

      cy += 8;
    });

    // Total
    if (totalLabel) {
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, cy, pageWidth - margin, cy);
      cy += 4;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      pdf.text(totalLabel, margin, cy);
      pdf.text(fmt(total), pageWidth - margin, cy, { align: "right" });
      cy += 6;
    }

    return cy;
  }

  // Seções de dados
  sections.forEach((section) => {
    // Verifica se precisa de nova página
    if (y > pageHeight - 40) {
      pdf.addPage();
      y = 15;
    }

    // Título da seção
    pdf.setFillColor(30, 58, 138);
    pdf.rect(margin - 2, y - 4, pageWidth - margin * 2 + 4, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(section.title, margin, y + 1);
    y += 10;

    // Linhas de dados
    section.rows.forEach((row, idx) => {
      if (y > pageHeight - 15) {
        pdf.addPage();
        y = 15;
      }

      const isEven = idx % 2 === 0;
      pdf.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
      pdf.rect(margin - 2, y - 4, pageWidth - margin * 2 + 4, 7, "F");

      if (row.highlight) {
        pdf.setTextColor(22, 101, 52); // verde escuro
        pdf.setFont("helvetica", "bold");
      } else {
        pdf.setTextColor(30, 30, 30);
        pdf.setFont("helvetica", "normal");
      }

      pdf.setFontSize(9);
      pdf.text(row.label, margin, y);
      pdf.text(row.value, pageWidth - margin, y, { align: "right" });
      y += 7;
    });

    y += 6;

    // Gráfico de pizza (se houver)
    if (section.pieChart && section.pieChart.items.length > 0) {
      if (y > pageHeight - 40) { pdf.addPage(); y = 15; }
      y = drawPieChart(section.pieChart, y);
    }
  });

  // Rodapé
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFillColor(240, 240, 240);
    pdf.rect(0, pageHeight - 8, pageWidth, 8, "F");
    pdf.setTextColor(100, 100, 100);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text("Zênite Tech — Social Ads | zenite-ads.manus.space", margin, pageHeight - 3);
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 3, { align: "right" });
  }

  pdf.save(filename);
}
