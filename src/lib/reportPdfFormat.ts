import { formatCurrency } from "@/lib/formatCurrency";

/* Tipos e formatadores do PDF de relatorios (sem o jsPDF, que so carrega ao exportar). */
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

export const pdfCurrency = (value: number) => formatCurrency(value || 0);
export const pdfPercent = (value: number) => `${(value || 0).toFixed(1).replace(".", ",")}%`;
