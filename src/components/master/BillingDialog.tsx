import { useState, useEffect, type ReactNode } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type Tone } from "@/components/patterns";
import { FormField } from "@/components/settings/FormField";
import { BellRing, FileText, Loader2, Plus, Receipt, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, addMonths, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentRecord {
  id: string;
  amount: number;
  payment_date: string;
  due_date: string | null;
  cycle: string | null;
  notes: string | null;
  created_at: string;
}

interface BillingNoticeRecord {
  id: string;
  notice_type: string;
  reference_date: string;
  channel: string;
  shown_at: string;
  acknowledged_at: string | null;
  notes: string | null;
  created_at: string;
}

const noticeTypeLabels: Record<string, string> = {
  trial_ending: "Fim do teste",
  trial_expired: "Teste expirado",
  due_soon: "Vencimento próximo",
  due_today: "Vence hoje",
  overdue: "Em atraso",
  manual: "Contato da equipe",
};

const channelLabels: Record<string, string> = {
  in_app: "Pop-up no sistema",
  email: "E-mail",
  whatsapp: "WhatsApp",
  phone: "Telefone",
};

interface BillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    id: string;
    razao_social: string;
    cnpj: string;
    status?: string;
    contract_start_date?: string | null;
    payment_cycle?: string | null;
    next_due_date?: string | null;
    financial_status?: string | null;
    auto_block_days?: number | null;
  } | null;
  onSaved: () => void;
}

const cycleLabels: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
};

const financialStatusConfig: Record<string, { label: string; tone: Tone }> = {
  current: { label: "Em dia", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  blocked: { label: "Bloqueado", tone: "danger" },
};

const formatMoney = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** Bloco do dialogo com titulo (h3) e acao opcional a direita. */
function DialogSection({ id, title, icon: Icon, action, children }: {
  id: string;
  title: string;
  icon: typeof Receipt;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3 border-t pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <h3 id={id} className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function addCycle(date: Date, cycle: string): Date {
  return cycle === "annual" ? addMonths(date, 12) : cycle === "quarterly" ? addMonths(date, 3) : addMonths(date, 1);
}

function calcNextDueDate(startDate: string, cycle: string): string {
  const start = new Date(startDate + "T12:00:00");
  const today = new Date();
  let next = new Date(start);

  const addFn = cycle === "annual" ? (d: Date) => addMonths(d, 12)
    : cycle === "quarterly" ? (d: Date) => addMonths(d, 3)
    : (d: Date) => addMonths(d, 1);

  while (next <= today) {
    next = addFn(next);
  }
  return format(next, "yyyy-MM-dd");
}

export function BillingDialog({ open, onOpenChange, tenant, onSaved }: BillingDialogProps) {
  const [contractStart, setContractStart] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [nextDue, setNextDue] = useState("");
  const [financialStatus, setFinancialStatus] = useState("pending");
  const [autoBlockDays, setAutoBlockDays] = useState(0);
  const [saving, setSaving] = useState(false);

  // Payment history
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // New payment form
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);

  // Billing notices ("cobranca avisada")
  const [notices, setNotices] = useState<BillingNoticeRecord[]>([]);
  const [noticeChannel, setNoticeChannel] = useState("whatsapp");
  const [noticeNotes, setNoticeNotes] = useState("");
  const [savingNotice, setSavingNotice] = useState(false);

  useEffect(() => {
    if (tenant && open) {
      setContractStart(tenant.contract_start_date || "");
      setCycle(tenant.payment_cycle || "monthly");
      setNextDue(tenant.next_due_date || "");
      setFinancialStatus(tenant.financial_status || "pending");
      setAutoBlockDays(tenant.auto_block_days || 0);
      fetchHistory();
    }
  }, [tenant, open]);

  // Sugere o proximo vencimento quando o inicio do contrato ou o ciclo sao
  // alterados aqui. Ao abrir o dialogo mantem a data gravada (antes era sobrescrita).
  useEffect(() => {
    if (!tenant || !contractStart || !cycle) return;
    const unchanged =
      contractStart === (tenant.contract_start_date || "") && cycle === (tenant.payment_cycle || "monthly");
    if (unchanged && tenant.next_due_date) return;
    setNextDue(calcNextDueDate(contractStart, cycle));
  }, [contractStart, cycle, tenant]);

  const fetchHistory = async () => {
    if (!tenant) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("payment_history" as any)
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("payment_date", { ascending: false })
      .limit(20);
    setHistory((data as any as PaymentRecord[]) || []);

    const { data: noticesData } = await supabase
      .from("billing_notices")
      .select("id, notice_type, reference_date, channel, shown_at, acknowledged_at, notes, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setNotices(noticesData || []);
    setLoadingHistory(false);
  };

  const handleRegisterNotice = async () => {
    if (!tenant) return;
    setSavingNotice(true);
    const { error } = await supabase.from("billing_notices").insert({
      tenant_id: tenant.id,
      notice_type: "manual",
      reference_date: nextDue || new Date().toISOString().split("T")[0],
      channel: noticeChannel,
      notes: noticeNotes.trim() || null,
      user_id: (await supabase.auth.getUser()).data.user?.id,
    });
    setSavingNotice(false);

    if (error) {
      toast({ title: "Erro ao registrar aviso", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cobrança marcada como avisada", variant: "success" });
    setNoticeNotes("");
    fetchHistory();
    onSaved();
  };

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        contract_start_date: contractStart || null,
        payment_cycle: cycle,
        next_due_date: nextDue || null,
        financial_status: financialStatus,
        auto_block_days: autoBlockDays,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", tenant.id);

    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contrato salvo", variant: "success" });
      onSaved();
    }
  };

  const handleAddPayment = async () => {
    if (!tenant) return;
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      setAmountError("Digite o valor pago. Exemplo: 199,90");
      document.getElementById("billing-amount")?.focus();
      return;
    }
    setAmountError(null);

    const { error } = await supabase.from("payment_history" as any).insert({
      tenant_id: tenant.id,
      amount,
      payment_date: new Date().toISOString().split("T")[0],
      due_date: nextDue || null,
      cycle,
      notes: newNotes || null,
      recorded_by: (await supabase.auth.getUser()).data.user?.id,
    } as any);

    if (error) {
      toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pagamento registrado", variant: "success" });

      // Pagamento de empresa em teste encerra o trial e ativa a assinatura
      if (tenant.status === "trial") {
        const { error: activateError } = await supabase
          .from("tenants")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", tenant.id);
        if (activateError) {
          toast({ title: "Erro ao ativar assinatura", description: activateError.message, variant: "destructive" });
        } else {
          toast({ title: "Assinatura ativada", description: "O período de teste foi encerrado." });
        }
      }

      setNewAmount("");
      setNewNotes("");
      setShowNewPayment(false);

      // Avanca um ciclo a partir do vencimento pago (antes contava a partir de hoje
      // e um pagamento atrasado "pulava" o vencimento seguinte).
      // Primeiro pagamento (ex.: fim do teste) sem contrato: o contrato comeca hoje.
      const today = format(new Date(), "yyyy-MM-dd");
      const startsContract = !contractStart && !nextDue;
      const paidDue = nextDue || (contractStart ? calcNextDueDate(contractStart, cycle) : today);
      const newNextDue = format(addCycle(new Date(paidDue.slice(0, 10) + "T12:00:00"), cycle), "yyyy-MM-dd");
      setNextDue(newNextDue);
      setFinancialStatus("current");
      if (startsContract) setContractStart(today);
      const { error: dueError } = await supabase.from("tenants").update({
        next_due_date: newNextDue,
        financial_status: "current",
        ...(startsContract ? { contract_start_date: today } : {}),
        updated_at: new Date().toISOString(),
      } as any).eq("id", tenant.id);
      if (dueError) {
        toast({ title: "Pagamento salvo, mas o vencimento não foi atualizado", description: dueError.message, variant: "destructive" });
      }

      fetchHistory();
      onSaved();
    }
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Financeiro de {tenant.razao_social}</DialogTitle>
          <DialogDescription className="font-data">CNPJ {tenant.cnpj}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Contrato */}
          <DialogSection id="billing-contrato" title="Contrato" icon={FileText}>
            <form
              className="space-y-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField id="billing-start" label="Início do contrato">
                  {(control) => (
                    <Input {...control} type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} />
                  )}
                </FormField>
                <FormField id="billing-cycle" label="Ciclo de pagamento">
                  {(control) => (
                    <Select value={cycle} onValueChange={setCycle}>
                      <SelectTrigger {...control}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField id="billing-next-due" label="Próximo vencimento" hint="Calculado pelo ciclo. Você pode ajustar.">
                  {(control) => (
                    <Input {...control} type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
                  )}
                </FormField>
                <FormField id="billing-status" label="Situação financeira">
                  {(control) => (
                    <Select value={financialStatus} onValueChange={setFinancialStatus}>
                      <SelectTrigger {...control}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(financialStatusConfig).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField
                  id="billing-auto-block"
                  label="Bloqueio automático"
                  hint="Dias de atraso até bloquear o acesso. Use 0 para nunca bloquear."
                  className="sm:col-span-2"
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={autoBlockDays}
                      onChange={(e) => setAutoBlockDays(parseInt(e.target.value) || 0)}
                      className="sm:max-w-[10rem]"
                    />
                  )}
                </FormField>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving} className="max-sm:w-full">
                  {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                  {saving ? "Salvando..." : "Salvar contrato"}
                </Button>
              </div>
            </form>
          </DialogSection>

          {/* Pagamentos */}
          <DialogSection
            id="billing-pagamentos"
            title="Pagamentos"
            icon={Receipt}
            action={
              !showNewPayment && (
                <Button size="sm" variant="outline" onClick={() => setShowNewPayment(true)}>
                  <Plus aria-hidden="true" />
                  Registrar pagamento
                </Button>
              )
            }
          >
            {showNewPayment && (
              <form
                noValidate
                className="space-y-3 rounded-lg border bg-muted/30 p-4 animate-fade-in"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleAddPayment();
                }}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField id="billing-amount" label="Valor pago (R$)" error={amountError}>
                    {(control) => (
                      <Input
                        {...control}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={newAmount}
                        onChange={(e) => {
                          setNewAmount(e.target.value);
                          if (amountError) setAmountError(null);
                        }}
                        placeholder="0,00"
                      />
                    )}
                  </FormField>
                  <FormField id="billing-amount-notes" label="Observação" optional>
                    {(control) => (
                      <Input {...control} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Ex.: PIX de outubro" />
                    )}
                  </FormField>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewPayment(false);
                      setAmountError(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Confirmar pagamento</Button>
                </div>
              </form>
            )}

            {loadingHistory ? (
              <div className="space-y-2" role="status" aria-label="Carregando pagamentos">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : history.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                Nenhum pagamento registrado ainda.
              </p>
            ) : (
              <ul className="max-h-[14rem] divide-y overflow-y-auto rounded-lg border">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-data font-semibold text-foreground">{formatMoney(Number(h.amount))}</p>
                      <p className="truncate text-xs text-muted-foreground">{h.notes || "Sem observação"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-foreground">
                        {new Date(h.payment_date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                      {h.cycle && <Badge variant="secondary">{cycleLabels[h.cycle] || h.cycle}</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DialogSection>

          {/* Avisos de cobranca */}
          <DialogSection id="billing-avisos" title="Avisos de cobrança" icon={BellRing}>
            <form
              noValidate
              className="space-y-3 rounded-lg border bg-muted/30 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleRegisterNotice();
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField id="billing-notice-channel" label="Como o cliente foi avisado">
                  {(control) => (
                    <Select value={noticeChannel} onValueChange={setNoticeChannel}>
                      <SelectTrigger {...control}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="phone">Telefone</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField id="billing-notice-notes" label="Observação" optional>
                  {(control) => (
                    <Input
                      {...control}
                      value={noticeNotes}
                      onChange={(e) => setNoticeNotes(e.target.value)}
                      placeholder="Ex.: falou com o financeiro"
                    />
                  )}
                </FormField>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" disabled={savingNotice} className="max-sm:w-full">
                  {savingNotice ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
                  {savingNotice ? "Registrando..." : "Marcar cobrança como avisada"}
                </Button>
              </div>
            </form>

            {notices.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">Nenhum aviso registrado.</p>
            ) : (
              <ul className="max-h-[12rem] divide-y overflow-y-auto rounded-lg border">
                {notices.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{noticeTypeLabels[n.notice_type] || n.notice_type}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {channelLabels[n.channel] || n.channel}
                        {n.notes ? ` · ${n.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="text-xs text-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR")}</p>
                      {n.channel === "in_app" && (
                        <StatusBadge tone={n.acknowledged_at ? "success" : "neutral"}>
                          {n.acknowledged_at ? "Cliente ciente" : "Exibido"}
                        </StatusBadge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DialogSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}
