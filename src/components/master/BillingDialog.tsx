import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, DollarSign, History, Save, Plus, BellRing } from "lucide-react";
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

const financialStatusConfig: Record<string, { label: string; className: string }> = {
  current: { label: "Em dia", className: "bg-emerald-500/20 text-emerald-400" },
  pending: { label: "Pendente", className: "bg-yellow-500/20 text-yellow-400" },
  blocked: { label: "Bloqueado", className: "bg-destructive/20 text-destructive" },
};

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
    toast({ title: "✅ Cobrança marcada como avisada" });
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
      toast({ title: "✅ Dados financeiros salvos" });
      onSaved();
    }
  };

  const handleAddPayment = async () => {
    if (!tenant) return;
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }

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
      toast({ title: "✅ Pagamento registrado" });

      // Pagamento de empresa em teste encerra o trial e ativa a assinatura
      if (tenant.status === "trial") {
        const { error: activateError } = await supabase
          .from("tenants")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", tenant.id);
        if (activateError) {
          toast({ title: "Erro ao ativar assinatura", description: activateError.message, variant: "destructive" });
        } else {
          toast({ title: "✅ Assinatura ativada", description: "O período de teste foi encerrado." });
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Financeiro — {tenant.razao_social}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{tenant.cnpj}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contract Start */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Início do Contrato</Label>
              <Input
                type="date"
                value={contractStart}
                onChange={(e) => setContractStart(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Ciclo de Pagamento</Label>
              <Select value={cycle} onValueChange={setCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Next Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Próximo Vencimento</Label>
              <Input
                type="date"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Status Financeiro</Label>
              <Select value={financialStatus} onValueChange={setFinancialStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(financialStatusConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <Badge variant="outline" className={v.className}>{v.label}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Auto Block */}
          <div>
            <Label className="text-xs">Bloqueio automático após X dias de atraso (0 = desativado)</Label>
            <Input
              type="number"
              min={0}
              value={autoBlockDays}
              onChange={(e) => setAutoBlockDays(parseInt(e.target.value) || 0)}
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>

          <Separator />

          {/* Payment History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico de Pagamentos
              </h3>
              <Button size="sm" variant="outline" onClick={() => setShowNewPayment(!showNewPayment)}>
                <Plus className="h-3 w-3 mr-1" /> Registrar
              </Button>
            </div>

            {showNewPayment && (
              <div className="border rounded-lg p-3 space-y-2 mb-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Observação</Label>
                    <Input
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Referência..."
                    />
                  </div>
                </div>
                <Button size="sm" onClick={handleAddPayment} className="w-full">
                  Confirmar Pagamento
                </Button>
              </div>
            )}

            {loadingHistory ? (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum pagamento registrado</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                    <div>
                      <p className="font-medium">
                        R$ {Number(h.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">{h.notes || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs">
                        {new Date(h.payment_date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                      {h.cycle && (
                        <Badge variant="outline" className="text-[10px]">
                          {cycleLabels[h.cycle] || h.cycle}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Billing notices */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <BellRing className="h-4 w-4" />
              Cobrança Avisada
            </h3>

            <div className="border rounded-lg p-3 space-y-2 mb-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Canal</Label>
                  <Select value={noticeChannel} onValueChange={setNoticeChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Observação</Label>
                  <Input
                    value={noticeNotes}
                    onChange={(e) => setNoticeNotes(e.target.value)}
                    placeholder="Ex.: falou com o financeiro"
                  />
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleRegisterNotice} disabled={savingNotice} className="w-full">
                {savingNotice ? "Registrando..." : "Marcar cobrança como avisada"}
              </Button>
            </div>

            {notices.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhum aviso registrado</p>
            ) : (
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {notices.map((n) => (
                  <div key={n.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                    <div>
                      <p className="font-medium">{noticeTypeLabels[n.notice_type] || n.notice_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {channelLabels[n.channel] || n.channel}
                        {n.notes ? ` • ${n.notes}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs">{new Date(n.created_at).toLocaleDateString("pt-BR")}</p>
                      {n.channel === "in_app" && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${n.acknowledged_at ? "bg-emerald-500/20 text-emerald-400" : ""}`}
                        >
                          {n.acknowledged_at ? "Cliente ciente" : "Exibido"}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
