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
const BRAND: [number, number, number] = [220, 38, 38];

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
  doc.setTextColor(...BRAND);
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
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 7;

  for (const section of input.sections) {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text(section.title, MARGIN, y);
    y += LINE;

    if (section.summary?.length) {
      doc.setFontSize(9);
      const columns = 2;
      const colWidth = contentWidth / columns;
      section.summary.forEach(([label, value], index) => {
        const col = index % columns;
        if (col === 0) ensureSpace(LINE);
        const x = MARGIN + col * colWidth;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(110);
        doc.text(label, x, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30);
        doc.text(value, x + colWidth - 4, y, { align: "right" });
        if (col === columns - 1 || index === section.summary!.length - 1) y += LINE;
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
          doc.setFillColor(243, 244, 246);
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
        doc.setDrawColor(229, 231, 235);
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
    doc.text(`NaHora Frota • Página ${page} de ${pages}`, pageWidth / 2, pageHeight - 6, { align: "center" });
  }

  doc.save(fileName);
  return fileName;
}

export const pdfCurrency = (value: number) => formatCurrency(value || 0);
export const pdfPercent = (value: number) => `${(value || 0).toFixed(1).replace(".", ",")}%`;
