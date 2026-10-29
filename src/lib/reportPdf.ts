import { jsPDF } from "jspdf";
import { formatCurrency } from "@/lib/formatCurrency";

export interface ReportPdfSection {
  title: string;
  /** Pares rotulo/valor exibidos como resumo. */
  summary?: Array<[string, string]>;
  table?: { headers: string[]; rows: string[][]; widths?: number[] };
  emptyText?: string;
}

export interface ReportPdfInput {
  companyName: string;
  periodLabel: string;
  filtersLabel: string;
  sections: ReportPdfSection[];
}

const MARGIN = 14;
const LINE = 6;
// Manual da marca (documento claro): titulo em Preto Asfalto, barra em Verde Na Hora,
// verde como texto so em Verde Escuro; tabelas com cabecalho em Nevoa.
const INK: [number, number, number] = [8, 8, 8];
const GREEN: [number, number, number] = [4, 232, 164];
const GREEN_DEEP: [number, number, number] = [11, 107, 79];
const MIST: [number, number, number] = [242, 244, 245];

/** Gera o PDF do relatorio e dispara o download. Retorna o nome do arquivo. */
export function downloadReportPdf(input: ReportPdfInput, fileName: string): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Cabecalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text("Relatório Operacional", MARGIN, y + 4);
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(input.companyName, pageWidth - MARGIN, y + 4, { align: "right" });
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Período: ${input.periodLabel}`, MARGIN, y);
  y += 5;
  doc.splitTextToSize(`Filtros: ${input.filtersLabel}`, contentWidth).forEach((line: string) => {
    doc.text(line, MARGIN, y);
    y += 4.5;
  });
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, MARGIN, y);
  y += 3;
  doc.setFillColor(...GREEN);
  doc.rect(MARGIN, y - 0.6, contentWidth, 1.2, "F");
  y += 7;

  for (const section of input.sections) {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...GREEN_DEEP);
    doc.text(section.title, MARGIN, y);
    y += LINE;

    if (section.summary?.length) {
      doc.setFontSize(9);
      const columns = 2;
      const colWidth = contentWidth / columns;
      // Valor longo (ex.: nome de cliente) quebra em linhas a direita, sem passar por cima do rotulo.
      let rowLines = 1;
      section.summary.forEach(([label, value], index) => {
        const col = index % columns;
        if (col === 0) {
          ensureSpace(LINE * 2);
          rowLines = 1;
        }
        const x = MARGIN + col * colWidth;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(110);
        doc.text(label, x, y);
        const labelWidth = doc.getTextWidth(label);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30);
        const valueWidth = Math.max(colWidth - 8 - labelWidth, colWidth * 0.35);
        const lines = doc.splitTextToSize(value, valueWidth) as string[];
        lines.forEach((line, li) => doc.text(line, x + colWidth - 4, y + li * 4.2, { align: "right" }));
        rowLines = Math.max(rowLines, lines.length);
        if (col === columns - 1 || index === section.summary!.length - 1) y += LINE + (rowLines - 1) * 4.2;
      });
      y += 2;
    }

    if (section.table) {
      const { headers, rows } = section.table;
      const widths = section.table.widths ?? headers.map(() => contentWidth / headers.length);
      const drawRow = (cells: string[], header: boolean) => {
        const wrapped = cells.map((cell, i) => doc.splitTextToSize(cell, widths[i] - 2) as string[]);
        const height = Math.max(...wrapped.map((w) => w.length)) * 4.2 + 2;
        ensureSpace(height);
        if (header) {
          doc.setFillColor(...MIST);
          doc.rect(MARGIN, y - 4, contentWidth, height, "F");
        }
        let x = MARGIN;
        doc.setFont("helvetica", header ? "bold" : "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(header ? 60 : 30);
        wrapped.forEach((lines, i) => {
          lines.forEach((line, li) => doc.text(line, x + 1, y + li * 4.2));
          x += widths[i];
        });
        y += height;
        doc.setDrawColor(227, 230, 232);
        doc.setLineWidth(0.2);
        doc.line(MARGIN, y - 3, pageWidth - MARGIN, y - 3);
      };

      if (rows.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(120);
        ensureSpace(LINE);
        doc.text(section.emptyText || "Sem dados no período.", MARGIN, y);
        y += LINE;
      } else {
        drawRow(headers, true);
        rows.forEach((row) => drawRow(row, false));
      }
      y += 3;
    }
    y += 3;
  }

  // Rodape com paginacao
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Na Hora Frota · Sempre na hora · Página ${page} de ${pages}`, pageWidth / 2, pageHeight - 6, { align: "center" });
  }

  doc.save(fileName);
  return fileName;
}

export const pdfCurrency = (value: number) => formatCurrency(value || 0);
export const pdfPercent = (value: number) => `${(value || 0).toFixed(1).replace(".", ",")}%`;
