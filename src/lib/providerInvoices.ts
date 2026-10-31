import { supabase } from "@/integrations/supabase/client";
import type { Tone } from "@/components/patterns";

/*
 * Nota fiscal do agregado TAC para o acerto (transportadora e motorista da casa ficam
 * fora da regra). Grava so pelas funcoes do banco (submit/review/delete_provider_invoice),
 * que conferem quem pode enviar, aprovar e editar. O arquivo fica no bucket privado
 * "provider-invoices", na pasta da empresa e do motorista.
 */
export type ProviderInvoiceStatus = "pending" | "approved" | "rejected" | "paid";

export interface ProviderInvoice {
  id: string;
  tenant_id: string;
  driver_id: string;
  work_dates: string[];
  invoice_number: string;
  issue_date: string | null;
  amount: number;
  expected_amount: number;
  file_path: string;
  file_name: string | null;
  status: ProviderInvoiceStatus;
  review_note: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface WorkDay {
  work_date: string;
  manifests: number;
  payable: number;
  /** Romaneios do dia ja pagos. */
  paid: number;
  freight: number;
  other_invoice: string | null;
}

export const INVOICE_STATUS: Record<ProviderInvoiceStatus, { label: string; tone: Tone; hint: string }> = {
  pending: { label: "Aguardando aprovação", tone: "warning", hint: "A empresa ainda vai conferir." },
  approved: { label: "Aprovada", tone: "info", hint: "Liberada para pagamento." },
  rejected: { label: "Recusada", tone: "danger", hint: "Corrija e envie de novo." },
  paid: { label: "Paga", tone: "success", hint: "Pagamento registrado." },
};

export const INVOICE_FILE_TYPES = "application/pdf,image/png,image/jpeg,image/webp";
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "1, 2, 3 e 4/out" (mesmo mes) ou "30/set e 1/out". */
export function workDaysLabel(dates: string[]): string {
  const sorted = [...dates].sort();
  if (sorted.length === 0) return "";
  const parts = sorted.map((d) => ({ day: Number(d.slice(8, 10)), month: Number(d.slice(5, 7)) - 1 }));
  const sameMonth = parts.every((p) => p.month === parts[0].month);
  const items = parts.map((p, i) => (sameMonth && i < parts.length - 1 ? String(p.day) : `${p.day}/${MONTHS[p.month]}`));
  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** Envia o arquivo da nota e devolve o caminho (vai para submit_provider_invoice). */
export async function uploadInvoiceFile(tenantId: string, driverId: string, file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Arquivo muito grande. Envie um PDF ou foto de até 10 MB.");
  if (!INVOICE_FILE_TYPES.split(",").includes(file.type)) throw new Error("Envie a nota em PDF ou foto (JPG, PNG).");
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${tenantId}/${driverId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("provider-invoices").upload(path, file, { contentType: file.type });
  if (error) throw new Error("Não foi possível enviar o arquivo. Confira a internet e tente de novo.");
  return path;
}

/** Link temporario (10 min) para abrir o arquivo da nota. */
export async function openInvoiceFile(path: string) {
  const { data, error } = await supabase.storage.from("provider-invoices").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error("Não foi possível abrir o arquivo da nota.");
  window.open(data.signedUrl, "_blank", "noopener");
}

/** Mensagem do banco em portugues (as funcoes ja levantam o texto para o usuario). */
export function invoiceError(error: unknown): string {
  const message = (error as { message?: string })?.message ?? "";
  if (/[áéíóúãõç]|Escolha|Informe|Anexe|Nota|nota|dia/.test(message) && !/violates|permission denied|function/i.test(message)) return message;
  return "Confira a internet e tente de novo.";
}

export async function fetchWorkDays(driverId: string, from: string, to: string, invoiceId?: string | null): Promise<WorkDay[]> {
  const { data, error } = await supabase.rpc("provider_invoice_days", {
    p_driver_id: driverId,
    p_from: from,
    p_to: to,
    p_invoice_id: invoiceId ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((d) => ({ ...d, freight: Number(d.freight) || 0 }));
}

export interface InvoiceInput {
  id?: string | null;
  driverId: string;
  workDates: string[];
  number: string;
  issueDate: string | null;
  amount: number;
  filePath: string;
  fileName: string | null;
}

export async function submitInvoice(input: InvoiceInput): Promise<string> {
  const { data, error } = await supabase.rpc("submit_provider_invoice", {
    p_id: input.id ?? null,
    p_driver_id: input.driverId,
    p_work_dates: input.workDates,
    p_invoice_number: input.number,
    p_issue_date: input.issueDate,
    p_amount: input.amount,
    p_file_path: input.filePath,
    p_file_name: input.fileName,
  });
  if (error) throw new Error(invoiceError(error));
  return data as string;
}

export async function reviewInvoice(id: string, approve: boolean, note?: string) {
  const { error } = await supabase.rpc("review_provider_invoice", { p_id: id, p_approve: approve, p_note: note ?? null });
  if (error) throw new Error(invoiceError(error));
}

export async function deleteInvoice(id: string) {
  const { error } = await supabase.rpc("delete_provider_invoice", { p_id: id });
  if (error) throw new Error(invoiceError(error));
}
