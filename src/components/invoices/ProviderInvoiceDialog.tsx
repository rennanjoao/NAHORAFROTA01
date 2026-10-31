import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, FileText, Loader2, Paperclip, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/patterns/FormField";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, parseDecimalInput } from "@/lib/formatCurrency";
import { getTodayBrazil } from "@/lib/timezone";
import {
  INVOICE_FILE_TYPES,
  fetchWorkDays,
  openInvoiceFile,
  submitInvoice,
  uploadInvoiceFile,
  workDaysLabel,
  type ProviderInvoice,
} from "@/lib/providerInvoices";
import { cn } from "@/lib/utils";
import { WorkDaysPicker } from "./WorkDaysPicker";

interface ProviderInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  driverId: string;
  /** Nome do motorista (texto do painel). */
  driverName: string;
  /** Nota sendo editada (null = nova). */
  invoice?: ProviderInvoice | null;
  /** "app": botoes e textos maiores (app do motorista). */
  variant?: "panel" | "app";
  onSaved?: () => void;
}

const monthOf = (date: string) => `${date.slice(0, 7)}-01`;
const lastDay = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${month.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
const money = (value: number) => formatCurrency(value).replace("R$", "").trim();

/**
 * Enviar ou corrigir a nota fiscal: 1) dias trabalhados, 2) dados da nota e o arquivo
 * (PDF ou foto). O valor vem preenchido com o frete dos dias escolhidos.
 */
export function ProviderInvoiceDialog({ open, onOpenChange, tenantId, driverId, driverName, invoice, variant = "panel", onSaved }: ProviderInvoiceDialogProps) {
  const app = variant === "app";
  const ids = useId();
  const today = getTodayBrazil();
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState<string[]>([]);
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [issueDate, setIssueDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ days?: string; number?: string; amount?: string; file?: string }>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(invoice?.work_dates ?? []);
    setNumber(invoice?.invoice_number ?? "");
    setAmount(invoice ? money(invoice.amount) : "");
    setAmountTouched(!!invoice);
    setIssueDate(invoice?.issue_date ?? today);
    setMonth(monthOf(invoice?.work_dates?.[0] ?? today));
    setFile(null);
    setErrors({});
  }, [open, invoice, today]);

  const daysQuery = useQuery({
    queryKey: ["work-days", driverId, month, invoice?.id ?? null],
    queryFn: () => fetchWorkDays(driverId, month, lastDay(month), invoice?.id),
    enabled: open,
    staleTime: 30 * 1000,
  });
  // Frete dos dias escolhidos (os de outros meses ficam guardados ao trocar de mes)
  const [knownDays, setKnownDays] = useState(new Map<string, number>());
  useEffect(() => {
    if (!daysQuery.data) return;
    setKnownDays((prev) => {
      const next = new Map(prev);
      daysQuery.data.forEach((d) => next.set(d.work_date, d.payable > 0 ? d.freight : 0));
      return next;
    });
  }, [daysQuery.data]);
  const total = selected.reduce((sum, date) => sum + (knownDays.get(date) ?? 0), 0);

  useEffect(() => {
    if (!amountTouched) setAmount(total > 0 ? money(total) : "");
  }, [total, amountTouched]);

  const toggle = (date: string) => {
    setSelected((current) => (current.includes(date) ? current.filter((d) => d !== date) : [...current, date].sort()));
    setErrors((e) => ({ ...e, days: undefined }));
  };

  const pickFile = (chosen: File | undefined) => {
    if (!chosen) return;
    if (!INVOICE_FILE_TYPES.split(",").includes(chosen.type)) {
      setErrors((e) => ({ ...e, file: "Envie a nota em PDF ou foto (JPG, PNG)." }));
      return;
    }
    setFile(chosen);
    setErrors((e) => ({ ...e, file: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = parseDecimalInput(amount);
    const found: typeof errors = {};
    if (selected.length === 0) found.days = "Toque nos dias que você trabalhou.";
    if (!number.trim()) found.number = "Informe o número da nota fiscal.";
    if (!value || value <= 0) found.amount = "Informe o valor da nota.";
    if (!file && !invoice?.file_path) found.file = "Anexe a nota (PDF ou foto).";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = found.days ? `${ids}-dias` : found.number ? `${ids}-numero` : found.amount ? `${ids}-valor` : `${ids}-arquivo`;
      document.getElementById(first)?.focus();
      return;
    }
    setSaving(true);
    try {
      const filePath = file ? await uploadInvoiceFile(tenantId, driverId, file) : invoice!.file_path;
      await submitInvoice({
        id: invoice?.id,
        driverId,
        workDates: selected,
        number: number.trim(),
        issueDate: issueDate || null,
        amount: value!,
        filePath,
        fileName: file?.name ?? invoice?.file_name ?? null,
      });
      toast({
        title: invoice ? "Nota corrigida" : "Nota enviada",
        description: invoice?.status === "approved" ? "A nota continua aprovada." : "A empresa vai conferir e aprovar. Você acompanha aqui.",
      });
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Não foi possível enviar a nota", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const difference = (parseDecimalInput(amount) ?? 0) - total;
  const step = (n: number, title: string, hint?: string) => (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
        {n}
      </span>
      <div>
        <h3 id={n === 1 ? `${ids}-dias-titulo` : undefined} className={cn("font-semibold text-foreground", app ? "text-base" : "text-sm")}>
          {title}
        </h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className={cn("flex max-h-[94dvh] flex-col gap-0 overflow-hidden p-0", app ? "sm:max-w-lg" : "sm:max-w-xl")}>
        <DialogHeader className="border-b p-5 pb-4">
          <DialogTitle>{invoice ? "Corrigir nota fiscal" : "Enviar nota fiscal"}</DialogTitle>
          <DialogDescription>
            {app ? "Escolha os dias que trabalhou e anexe a nota que você emitiu." : `Nota de ${driverName}: dias trabalhados, dados da nota e o arquivo.`}
          </DialogDescription>
        </DialogHeader>

        <form id={`${ids}-form`} onSubmit={handleSubmit} noValidate className="flex-1 space-y-6 overflow-y-auto p-5">
          {invoice?.status === "rejected" && invoice.review_note && (
            <Alert variant="destructive">
              <AlertDescription>
                <span className="font-semibold">Motivo da recusa:</span> {invoice.review_note}
              </AlertDescription>
            </Alert>
          )}

          <section className="space-y-3">
            {step(1, "Quais dias você trabalhou?", "Só aparecem os dias com romaneio. Toque de novo para tirar.")}
            <div id={`${ids}-dias`} tabIndex={-1} className="outline-none">
              <WorkDaysPicker
                month={month}
                onMonthChange={setMonth}
                maxMonth={monthOf(today)}
                days={daysQuery.data ?? []}
                selected={selected}
                onToggle={toggle}
                loading={daysQuery.isFetching}
                size={app ? "lg" : "md"}
                labelledBy={`${ids}-dias-titulo`}
              />
            </div>
            <div aria-live="polite" className={cn("rounded-lg border p-3 text-sm", errors.days ? "border-destructive text-destructive" : "bg-muted/40")}>
              {errors.days ??
                (selected.length === 0 ? (
                  "Nenhum dia escolhido."
                ) : (
                  <>
                    <span className="font-medium text-foreground">Dias {workDaysLabel(selected)}</span>
                    <span className="text-muted-foreground"> · frete desses dias </span>
                    <span className="font-data font-semibold text-foreground">{formatCurrency(total)}</span>
                  </>
                ))}
            </div>
          </section>

          <section className="space-y-4">
            {step(2, "Dados da nota fiscal", "A nota é emitida fora do app. Aqui você só informa e anexa.")}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id={`${ids}-numero`} label="Número da nota" error={errors.number}>
                {(control) => (
                  <Input {...control} inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} className={cn(app && "h-12 text-base")} />
                )}
              </FormField>
              <FormField id={`${ids}-emissao`} label="Data de emissão" optional>
                {(control) => (
                  <Input {...control} type="date" max={today} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={cn(app && "h-12 text-base")} />
                )}
              </FormField>
              <FormField
                id={`${ids}-valor`}
                label="Valor da nota (R$)"
                error={errors.amount}
                hint={total > 0 && Math.abs(difference) >= 0.01 ? `Diferente do frete dos dias (${formatCurrency(total)}).` : undefined}
                className="sm:col-span-2"
              >
                {(control) => (
                  <Input
                    {...control}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setAmountTouched(true);
                    }}
                    className={cn("font-data", app && "h-12 text-base")}
                  />
                )}
              </FormField>
            </div>

            <div className="space-y-2">
              <span id={`${ids}-arquivo-rotulo`} className="text-sm font-medium text-foreground">
                Arquivo da nota
              </span>
              <input ref={fileRef} type="file" accept={INVOICE_FILE_TYPES} className="hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-labelledby={`${ids}-arquivo-rotulo`}>
                <Button id={`${ids}-arquivo`} type="button" variant="outline" className={cn(app && "h-12")} onClick={() => fileRef.current?.click()}>
                  <Paperclip aria-hidden="true" />
                  {file || invoice?.file_path ? "Trocar arquivo" : "Escolher PDF ou foto"}
                </Button>
                <Button type="button" variant="outline" className={cn(app && "h-12")} onClick={() => cameraRef.current?.click()}>
                  <Camera aria-hidden="true" />
                  Fotografar a nota
                </Button>
              </div>
              {(file || invoice?.file_path) && (
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">{file?.name ?? invoice?.file_name ?? "Arquivo enviado"}</span>
                  {!file && invoice?.file_path && (
                    <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => openInvoiceFile(invoice.file_path).catch(() => undefined)}>
                      Ver
                    </Button>
                  )}
                </p>
              )}
              {errors.file && <p className="text-sm font-medium text-destructive">{errors.file}</p>}
            </div>
          </section>
        </form>

        <DialogFooter className="gap-2 border-t p-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className={cn(app && "h-12")}>
            Cancelar
          </Button>
          <Button type="submit" form={`${ids}-form`} disabled={saving} className={cn(app && "h-12 text-base")}>
            {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {saving ? "Enviando..." : invoice ? "Salvar correção" : "Enviar nota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
