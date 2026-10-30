import { useState, useMemo, useCallback } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Users, Wallet, Warehouse } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ListSkeleton, PageHeader, Section, SegmentedControl, StatCard } from "@/components/patterns";
import { InvoiceRulePrompt } from "@/components/settings/InvoiceRuleQuestion";
import { ProviderInvoicesPanel } from "@/components/invoices/ProviderInvoicesPanel";
import { CarrierSummaryCard } from "@/components/settlement/CarrierSummaryCard";
import { useTenantData } from "@/hooks/useTenantData";
import { useProviderInvoices } from "@/hooks/useProviderInvoices";
import { carrierName, useCarriers } from "@/hooks/useCarriers";
import { useAuth } from "@/contexts/AuthContext";
import { formatCNPJ } from "@/lib/cnpjValidation";
import { INVOICE_STATUS } from "@/lib/providerInvoices";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, parseDecimalInput } from "@/lib/formatCurrency";
import { getTodayBrazil, parseDateOnly } from "@/lib/timezone";
import { requireCurrentTenantId } from "@/lib/tenant";
import { EditTransactionDialog } from "@/components/settlement/EditTransactionDialog";
import { EditManifestDialog } from "@/components/settlement/EditManifestDialog";
import { BankDetailsDialog } from "@/components/settlement/BankDetailsDialog";
import { ReversalPasswordDialog } from "@/components/settlement/ReversalPasswordDialog";
import { AdjustmentDialog, type AdjustmentFormValues } from "@/components/settlement/AdjustmentDialog";
import { AdjustmentsPanel } from "@/components/settlement/AdjustmentsPanel";
import { DriverPicker } from "@/components/settlement/DriverPicker";
import { DriverSummaryCard } from "@/components/settlement/DriverSummaryCard";
import { ManifestsPanel, type ManifestTab } from "@/components/settlement/ManifestsPanel";
import { PendingDriversList } from "@/components/settlement/PendingDriversList";
import { SettlementSteps } from "@/components/settlement/SettlementSteps";
import {
  periodDays,
  periodLabels,
  type LocalAdjustment,
  type PendingDriverSummary,
  type PeriodFilter,
} from "@/components/settlement/settlementConfig";
// Database hooks
import { useSettlementsDB } from "@/hooks/useSettlementsDB";
import { useManifestsDB, DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";
import { useSLADB } from "@/hooks/useSLADB";
import { useDBDrivers, DBDriver } from "@/hooks/useDBDrivers";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { plainError } from "@/components/drivers/driverConfig";
import { PlanLockOverlay } from "@/components/plan/PlanLockOverlay";

interface WalletAdjustmentRow {
  id: string;
  date: string;
  created_at: string | null;
  description: string;
  amount: number;
  type: string | null;
  category: string | null;
  observation: string | null;
  status: string;
}

function toAdjustment(row: WalletAdjustmentRow): LocalAdjustment {
  const type = row.type === "credit" ? "credit" : "debit";
  return {
    id: row.id,
    date: row.created_at ? new Date(row.created_at) : parseDateOnly(row.date) ?? new Date(),
    description: row.description,
    value: Number(row.amount) || 0,
    type,
    category: (row.category as LocalAdjustment["category"]) || "other",
    observation: row.observation || undefined,
    status: row.status,
  };
}

// Cartoes de resumo mais baixos no celular: o passo a passo do acerto aparece sem rolar tanto.
const compactStat = "min-h-0 gap-2 p-4 sm:min-h-[8.5rem] sm:gap-3 sm:p-5";

// Foco depois que a tela troca (o botao clicado some da tela).
const focusById = (id: string) => window.setTimeout(() => document.getElementById(id)?.focus(), 50);

const PAGE_TITLE = "Acerto financeiro";
const PAGE_DESCRIPTION = "Quanto pagar a cada motorista, o que já foi pago e o que está pendente.";

export default function SettlementPage() {
  const { checkFeatureAccess } = useFeatureAccess();
  const financialAccess = checkFeatureAccess('settlement');

  // Database hooks
  const { drivers, isLoading: driversLoading } = useDBDrivers();
  const { manifests, isLoading: manifestsLoading, fetchManifests } = useManifestsDB();
  // Mantido: carrega os acertos (settlements) do banco junto com a tela.
  useSettlementsDB();
  // Mesmo "No prazo (6 meses)" da tela de Motoristas (antes mostrava individual_sla, sempre 100%).
  const { driverStats: slaDriverStats } = useSLADB();

  // Pagamento mediante nota fiscal e transportadoras
  const { tenant } = useTenantData();
  const { isAdmin } = useAuth();
  const invoiceRequired = tenant?.pays_only_with_invoice === true;
  const { invoices: allInvoices, refresh: refreshInvoices } = useProviderInvoices();
  const { carriers } = useCarriers();
  const [mode, setMode] = useState<"drivers" | "carriers">("drivers");
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const selectedCarrier = carriers.find((c) => c.id === selectedCarrierId) ?? null;
  const carrierByDriver = useMemo(() => new Map(drivers.map((d) => [d.id, d.carrier_id ?? null])), [drivers]);
  const invoicesById = useMemo(() => new Map(allInvoices.map((i) => [i.id, i])), [allInvoices]);
  // Romaneio de agregado sem nota aprovada nao pode ser pago (o banco tambem bloqueia).
  const paymentBlock = useCallback(
    (m: DBManifest) => {
      if (!invoiceRequired || m.is_own_fleet) return null;
      const invoice = m.provider_invoice_id ? invoicesById.get(m.provider_invoice_id) : undefined;
      if (!invoice) return "Falta a nota fiscal";
      if (invoice.status === "pending") return "Nota aguardando aprovação";
      if (invoice.status === "rejected") return "Nota recusada";
      return null;
    },
    [invoiceRequired, invoicesById],
  );
  const invoiceLabel = useCallback(
    (m: DBManifest) => {
      const invoice = m.provider_invoice_id ? invoicesById.get(m.provider_invoice_id) : undefined;
      return invoice ? `NF ${invoice.invoice_number} · ${INVOICE_STATUS[invoice.status].label.toLowerCase()}` : null;
    },
    [invoicesById],
  );
  const [selectedDriver, setSelectedDriver] = useState<DBDriver | null>(null);
  const [driverSearchOpen, setDriverSearchOpen] = useState(false);
  // Creditos/debitos avulsos do motorista (driver_wallet). Antes ficavam so na tela.
  const [localAdjustments, setLocalAdjustments] = useState<LocalAdjustment[]>([]);
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [activePeriod, setActivePeriod] = useState<PeriodFilter>("monthly");
  const [activeTab, setActiveTab] = useState<ManifestTab>("pending");

  // Edit transaction state
  const [isEditTransactionDialogOpen, setIsEditTransactionDialogOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<LocalAdjustment | null>(null);

  // Edit manifest state
  const [isEditManifestDialogOpen, setIsEditManifestDialogOpen] = useState(false);
  const [manifestToEdit, setManifestToEdit] = useState<DBManifest | null>(null);

  // Bank details dialog state
  const [isBankDetailsDialogOpen, setIsBankDetailsDialogOpen] = useState(false);

  // Reversal dialog state
  const [isReversalDialogOpen, setIsReversalDialogOpen] = useState(false);
  const [manifestToReverse, setManifestToReverse] = useState<DBManifest | null>(null);

  // Get global stats from database manifests (only third-party drivers)
  const globalStats = useMemo(() => {
    const days = periodDays[activePeriod];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Filter by period and only third-party (non-own-fleet)
    const filtered = manifests.filter(m => {
      const manifestDate = new Date(m.created_at);
      return manifestDate >= cutoffDate && !m.is_own_fleet;
    });

    const paid = filtered.filter(m => m.status === "paid").reduce((sum, m) => sum + (m.freight_value || 0), 0);
    const pending = filtered.filter(m => m.status === "pending" || m.status === "in_progress" || m.status === "completed").reduce((sum, m) => sum + (m.freight_value || 0), 0);

    // "Em disputa" saiu da tela: nao existe esse status no banco (o cartao mostrava sempre R$ 0,00).
    return {
      totalPaid: paid,
      totalPending: pending,
      totalGeneral: paid + pending,
      manifestCount: filtered.length,
    };
  }, [manifests, activePeriod]);

  // Get pending drivers summary from manifests
  const pendingDrivers = useMemo(() => {
    // Filter only third-party drivers with unpaid manifests
    const pending = manifests.filter(m =>
      !m.is_own_fleet &&
      m.status !== "paid" &&
      m.status !== "cancelled" &&
      m.driver_id
    );

    const summary = new Map<string, PendingDriverSummary>();

    pending.forEach(m => {
      if (!m.driver_id) return;
      // Motorista de transportadora: o acerto fica na aba Transportadoras
      if (carrierByDriver.get(m.driver_id)) return;
      const existing = summary.get(m.driver_id);
      if (existing) {
        existing.manifestCount++;
        existing.totalValue += (m.freight_value || 0);
      } else {
        summary.set(m.driver_id, {
          driverId: m.driver_id,
          driverName: m.driver_name,
          driverCpf: m.driver_cpf || "",
          manifestCount: 1,
          totalValue: m.freight_value || 0,
        });
      }
    });

    for (const invoice of allInvoices) {
      if (invoice.status !== "pending" || !invoice.driver_id) continue;
      const entry = summary.get(invoice.driver_id);
      if (entry) entry.invoicesToApprove = (entry.invoicesToApprove ?? 0) + 1;
    }
    return Array.from(summary.values());
  }, [manifests, carrierByDriver, allInvoices]);

  // Transportadoras com romaneio sem pagamento (dos motoristas ligados a elas)
  const pendingCarriers = useMemo(() => {
    const summary = new Map<string, PendingDriverSummary>();
    for (const m of manifests) {
      const carrierId = m.driver_id ? carrierByDriver.get(m.driver_id) : null;
      if (!carrierId || m.is_own_fleet || m.status === "paid" || m.status === "cancelled") continue;
      const carrier = carriers.find((c) => c.id === carrierId);
      if (!carrier) continue;
      const entry = summary.get(carrierId) ?? { driverId: carrierId, driverName: carrierName(carrier), driverCpf: formatCNPJ(carrier.cnpj), manifestCount: 0, totalValue: 0 };
      entry.manifestCount += 1;
      entry.totalValue += m.freight_value || 0;
      summary.set(carrierId, entry);
    }
    for (const invoice of allInvoices) {
      if (invoice.status !== "pending" || !invoice.carrier_id) continue;
      const entry = summary.get(invoice.carrier_id);
      if (entry) entry.invoicesToApprove = (entry.invoicesToApprove ?? 0) + 1;
    }
    return Array.from(summary.values());
  }, [manifests, carrierByDriver, carriers, allInvoices]);

  // Romaneios e totais da transportadora escolhida
  const carrierDriverIds = useMemo(
    () => new Set(drivers.filter((d) => selectedCarrierId && d.carrier_id === selectedCarrierId).map((d) => d.id)),
    [drivers, selectedCarrierId],
  );
  const carrierManifests = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays[activePeriod]);
    return manifests
      .filter((m) => m.driver_id && carrierDriverIds.has(m.driver_id) && !m.is_own_fleet)
      .filter((m) => new Date(m.created_at) >= cutoffDate)
      .filter((m) => (activeTab === "pending" ? m.status === "pending" || m.status === "in_progress" || m.status === "completed" : m.status === "paid"));
  }, [manifests, carrierDriverIds, activePeriod, activeTab]);
  const carrierStats = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays[activePeriod]);
    const mine = manifests.filter((m) => m.driver_id && carrierDriverIds.has(m.driver_id) && !m.is_own_fleet);
    return {
      paid: mine.filter((m) => m.status === "paid" && new Date(m.created_at) >= cutoffDate).reduce((sum, m) => sum + (m.freight_value || 0), 0),
      pending: mine.filter((m) => m.status !== "paid" && m.status !== "cancelled").reduce((sum, m) => sum + (m.freight_value || 0), 0),
    };
  }, [manifests, carrierDriverIds, activePeriod]);

  // Get driver manifests filtered by period
  const driverManifests = useMemo(() => {
    if (!selectedDriver) return [];

    const days = periodDays[activePeriod];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return manifests
      .filter(m => m.driver_id === selectedDriver.id)
      .filter(m => new Date(m.created_at) >= cutoffDate)
      .filter(m => activeTab === "pending"
        ? (m.status === "pending" || m.status === "in_progress" || m.status === "completed")
        : m.status === "paid"
      );
  }, [selectedDriver, manifests, activePeriod, activeTab]);

  // Driver stats
  const driverStats = useMemo(() => {
    if (!selectedDriver) return { paid: 0, pending: 0, balance: 0 };

    const days = periodDays[activePeriod];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const allManifests = manifests
      .filter(m => m.driver_id === selectedDriver.id)
      .filter(m => new Date(m.created_at) >= cutoffDate);

    const paid = allManifests.filter(m => m.status === "paid").reduce((sum, m) => sum + (m.freight_value || 0), 0);
    const pending = allManifests
      .filter(m => m.status !== "paid" && m.status !== "cancelled")
      .reduce((sum, m) => sum + (m.freight_value || 0), 0);

    // Lancamentos avulsos ainda nao pagos
    const adjustmentTotal = localAdjustments
      .filter((a) => a.status !== "paid")
      .reduce((sum, a) => sum + a.value, 0);

    return {
      paid,
      pending,
      balance: pending + adjustmentTotal,
    };
  }, [selectedDriver, manifests, activePeriod, localAdjustments]);

  const fetchAdjustments = useCallback(async (driverId: string) => {
    const { data, error } = await supabase
      .from("driver_wallet")
      .select("id, date, created_at, description, amount, type, category, observation, status")
      .eq("driver_id", driverId)
      .in("type", ["credit", "debit"])
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading adjustments:", error);
      toast({ title: "Não foi possível carregar os lançamentos", description: plainError(error), variant: "destructive" });
      return;
    }
    setLocalAdjustments(((data || []) as WalletAdjustmentRow[]).map(toAdjustment));
  }, []);

  const selectedDriverSLA = useMemo(() => {
    if (!selectedDriver) return null;
    const stats = slaDriverStats.find((stat) => stat.driver_id === selectedDriver.id)?.periodStats[180];
    return stats && stats.total > 0 ? stats.sla : null;
  }, [selectedDriver, slaDriverStats]);

  const handleSelectDriver = useCallback((driver: DBDriver) => {
    setSelectedDriver(driver);
    setDriverSearchOpen(false);
    setLocalAdjustments([]);
    void fetchAdjustments(driver.id);
  }, [fetchAdjustments]);

  // Motorista com pendencia pode nao estar na lista (ex.: inativo): busca direto.
  // O botao clicado some com a lista: o foco vai para o nome do motorista escolhido.
  const handleSelectPendingDriver = useCallback(async (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver) {
      handleSelectDriver(driver);
      focusById("acerto-motorista");
      return;
    }
    const { data } = await supabase.from("drivers").select("*").eq("id", driverId).maybeSingle();
    if (data) {
      handleSelectDriver(data as unknown as DBDriver);
      focusById("acerto-motorista");
    } else {
      toast({ title: "Motorista não encontrado", description: "O cadastro deste motorista foi removido.", variant: "destructive" });
    }
  }, [drivers, handleSelectDriver]);

  const handleAddAdjustment = async (form: AdjustmentFormValues): Promise<boolean> => {
    if (!form.value || !form.description || !selectedDriver) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a descrição e o valor.",
        variant: "destructive",
      });
      return false;
    }

    const value = parseDecimalInput(form.value);
    if (value === null || value === 0) {
      toast({ title: "Valor inválido", description: "Informe um valor maior que zero.", variant: "destructive" });
      return false;
    }

    setIsSavingAdjustment(true);
    const signedValue = form.type === "credit" ? Math.abs(value) : -Math.abs(value);
    // try/finally: se a empresa nao for encontrada, o botao nao fica preso em "Salvando...".
    let error: { message: string } | null = null;
    try {
      ({ error } = await supabase.from("driver_wallet").insert({
        driver_id: selectedDriver.id,
        tenant_id: await requireCurrentTenantId(),
        type: form.type,
        category: form.category,
        description: form.description.trim(),
        observation: form.observation.trim() || null,
        amount: signedValue,
        date: getTodayBrazil(),
        status: "pending",
      }));
    } catch (err) {
      error = { message: plainError(err) };
    } finally {
      setIsSavingAdjustment(false);
    }

    if (error) {
      toast({ title: "Não foi possível registrar o lançamento", description: plainError(error), variant: "destructive" });
      return false;
    }

    await fetchAdjustments(selectedDriver.id);
    setIsAdjustmentDialogOpen(false);

    toast({
      title: form.type === "credit" ? "Crédito registrado" : "Débito registrado",
      description: `${form.description.trim()}: ${form.type === "credit" ? "+" : "-"}${formatCurrency(Math.abs(value))}`,
    });
    return true;
  };

  const handleRemoveAdjustment = async (adjustmentId: string) => {
    // RLS sem permissao nao da erro: so nao apaga nada. Confere o que saiu.
    const { data: removed, error } = await supabase.from("driver_wallet").delete().eq("id", adjustmentId).select("id");
    if (error || !removed?.length) {
      toast({
        title: "Não foi possível excluir o lançamento",
        description: error ? plainError(error) : "Você não tem permissão para esta tarefa.",
        variant: "destructive",
      });
      return;
    }
    if (selectedDriver) await fetchAdjustments(selectedDriver.id);
    toast({
      title: "Lançamento excluído",
      description: "Ele saiu do extrato do motorista.",
    });
  };

  const handleEditAdjustment = (adjustment: LocalAdjustment) => {
    setTransactionToEdit(adjustment);
    setIsEditTransactionDialogOpen(true);
  };

  const handleSaveEditedAdjustment = async (updatedAdjustment: LocalAdjustment): Promise<boolean> => {
    const { error } = await supabase
      .from("driver_wallet")
      .update({
        description: updatedAdjustment.description,
        amount: updatedAdjustment.type === "credit" ? Math.abs(updatedAdjustment.value) : -Math.abs(updatedAdjustment.value),
        type: updatedAdjustment.type,
        category: updatedAdjustment.category || "other",
        observation: updatedAdjustment.observation || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", updatedAdjustment.id);
    if (error) {
      toast({ title: "Não foi possível salvar o lançamento", description: plainError(error), variant: "destructive" });
      return false;
    }
    if (selectedDriver) await fetchAdjustments(selectedDriver.id);
    return true;
  };

  const handleSetAdjustmentPaid = async (adjustment: LocalAdjustment, paid: boolean) => {
    const { error } = await supabase
      .from("driver_wallet")
      .update({ status: paid ? "paid" : "pending", updated_at: new Date().toISOString() })
      .eq("id", adjustment.id);
    if (error) {
      toast({ title: "Não foi possível atualizar o lançamento", description: plainError(error), variant: "destructive" });
      return;
    }
    if (selectedDriver) await fetchAdjustments(selectedDriver.id);
    toast({
      title: paid ? "Lançamento quitado" : "Lançamento reaberto",
      description: `${adjustment.description}: ${formatCurrency(adjustment.value)}`,
    });
  };

  const handleMarkAsPaid = async (manifestId: string) => {
    // So romaneio finalizado vai para pago (o filtro evita pagar um que ainda esta na rua).
    const { data: updated, error } = await supabase
      .from("manifests")
      .update({
        status: "paid",
        paid_at: new Date().toISOString()
      })
      .eq("id", manifestId)
      .eq("status", "completed")
      .select("id");

    if (!error && (!updated || updated.length === 0)) {
      toast({
        title: "Romaneio ainda não finalizado",
        description: "Finalize o romaneio (todas as entregas baixadas) antes de registrar o pagamento.",
        variant: "destructive",
      });
      await fetchManifests();
      return;
    }

    if (error) {
      toast({
        title: "Não foi possível marcar como pago",
        description: plainError(error),
        variant: "destructive",
      });
      return;
    }

    await fetchManifests();
    void refreshInvoices();
    toast({
      title: "Pagamento registrado",
      description: "Romaneio marcado como pago.",
    });
  };

  const handleEditManifest = (manifest: DBManifest) => {
    setManifestToEdit(manifest);
    setIsEditManifestDialogOpen(true);
  };

  const handleSaveManifest = async (manifestId: string, newValue: number, observation: string): Promise<boolean> => {
    const { error } = await supabase
      .from("manifests")
      .update({
        freight_value: newValue,
        observation: observation,
        updated_at: new Date().toISOString()
      })
      .eq("id", manifestId);

    if (error) {
      toast({
        title: "Não foi possível salvar o romaneio",
        description: plainError(error),
        variant: "destructive",
      });
      return false;
    }
    await fetchManifests();
    return true;
  };

  const handleReverseToPending = (manifest: DBManifest) => {
    setManifestToReverse(manifest);
    setIsReversalDialogOpen(true);
  };

  const confirmReversal = async (): Promise<boolean> => {
    if (!manifestToReverse) return false;
    // Estorno volta para "finalizado" (era o status antes do pagamento)
    const { error } = await supabase
      .from("manifests")
      .update({
        status: "completed",
        paid_at: null
      })
      .eq("id", manifestToReverse.id);

    if (error) {
      toast({
        title: "Não foi possível estornar",
        description: plainError(error),
        variant: "destructive",
      });
      return false;
    }

    await fetchManifests();
    void refreshInvoices();
    setManifestToReverse(null);
    // O romaneio sai da aba "Pagos": o foco vai para o vizinho (ou para a aba "Pendentes").
    window.setTimeout(() => {
      const rows = [...document.querySelectorAll<HTMLElement>("[data-manifest-action]")].filter((el) => el.getClientRects().length > 0);
      (rows[0] ?? document.querySelector<HTMLElement>('[data-romaneios-tab="pending"]'))?.focus();
    }, 300);
    return true;
  };

  if (!financialAccess.allowed) {
    return (
      <>
        <PageHeader icon={Wallet} title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
        <PlanLockOverlay upgradePlanLabel={financialAccess.upgradePlanLabel} className="min-h-[60vh]" />
      </>
    );
  }

  const periodLabel = periodLabels[activePeriod];
  const statsLoading = manifestsLoading && manifests.length === 0;
  // Passo atual: 1 escolher, 2 conferir, 3 pagar (quando ha romaneio finalizado na lista).
  const currentStep =
    mode === "carriers"
      ? !selectedCarrier ? 1 : carrierManifests.some((m) => m.status === "completed") ? 3 : 2
      : !selectedDriver ? 1 : driverManifests.some((m) => m.status === "completed") ? 3 : 2;

  return (
    <>
      <PageHeader
        icon={Wallet}
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Label htmlFor="settlement-period" className="shrink-0 text-muted-foreground">
              Período
            </Label>
            <Select value={activePeriod} onValueChange={(v) => setActivePeriod(v as PeriodFilter)}>
              <SelectTrigger id="settlement-period" className="w-full sm:w-[13.5rem] [&>span]:flex-1">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {(Object.keys(periodLabels) as PeriodFilter[]).map((period) => (
                  <SelectItem key={period} value={period}>
                    {periodLabels[period]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="space-y-6 md:space-y-8">
        <InvoiceRulePrompt />

        {/* Resumo do periodo (so agregados; frota propria nao recebe frete) */}
        <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          <StatCard
            label="Total pago"
            value={globalStats.totalPaid}
            format={formatCurrency}
            icon={CheckCircle2}
            tone="success"
            hint="Romaneios já pagos"
            loading={statsLoading}
            className={compactStat}
          />
          <StatCard
            label="A pagar"
            value={globalStats.totalPending}
            format={formatCurrency}
            icon={Clock}
            tone="warning"
            hint="Romaneios ainda em aberto"
            loading={statsLoading}
            className={compactStat}
          />
          <StatCard
            label="Total geral"
            value={globalStats.totalGeneral}
            format={formatCurrency}
            icon={Wallet}
            tone="brand"
            hint={`${globalStats.manifestCount.toLocaleString("pt-BR")} romaneio${globalStats.manifestCount === 1 ? "" : "s"} · ${periodLabel.toLowerCase()}`}
            loading={statsLoading}
            className={`${compactStat} sm:col-span-2 lg:col-span-1`}
          />
        </div>

        {/* Passo a passo + escolha do motorista */}
        <Section
          id="fazer-acerto"
          title="Fazer o acerto"
          description="Escolha o motorista, confira os romaneios e marque como pago depois de pagar."
        >
          <Card className="space-y-5 p-4 sm:p-5">
            <SettlementSteps current={currentStep} carrier={mode === "carriers"} />
            {carriers.length > 0 && (
              <SegmentedControl
                label="Acerto de"
                value={mode}
                onChange={(value) => {
                  setMode(value);
                  setSelectedDriver(null);
                  setSelectedCarrierId(null);
                }}
                options={[
                  { value: "drivers", label: "Motoristas (TAC)", icon: Users, count: pendingDrivers.length },
                  { value: "carriers", label: "Transportadoras", icon: Warehouse, count: pendingCarriers.length },
                ]}
              />
            )}
            {mode === "carriers" ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Label htmlFor="carrier-picker" className="shrink-0 sm:w-24">
                  Transportadora
                </Label>
                <Select value={selectedCarrierId ?? ""} onValueChange={(value) => setSelectedCarrierId(value)}>
                  <SelectTrigger id="carrier-picker" className="w-full sm:max-w-sm">
                    <SelectValue placeholder="Escolha a transportadora" />
                  </SelectTrigger>
                  <SelectContent>
                    {carriers.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.id}>
                        {carrierName(carrier)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCarrier && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedCarrierId(null);
                      focusById("carrier-picker");
                    }}
                    className="self-start sm:self-auto"
                  >
                    <ArrowLeft aria-hidden="true" />
                    Voltar à lista
                  </Button>
                )}
              </div>
            ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Label htmlFor="driver-picker" className="shrink-0 sm:w-24">
                Motorista
              </Label>
              <DriverPicker
                id="driver-picker"
                drivers={drivers}
                selected={selectedDriver}
                open={driverSearchOpen}
                onOpenChange={setDriverSearchOpen}
                onSelect={handleSelectDriver}
                loading={driversLoading && drivers.length === 0}
              />
              {selectedDriver && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedDriver(null);
                    // O botao some: o foco volta para a busca de motorista.
                    focusById("driver-picker");
                  }}
                  className="self-start sm:self-auto"
                >
                  <ArrowLeft aria-hidden="true" />
                  Voltar à lista
                </Button>
              )}
            </div>
            )}
          </Card>
        </Section>

        {/* Transportadoras: quem tem algo a receber */}
        {mode === "carriers" && !selectedCarrier && (
          <Section id="pendencias-transportadoras" title="Transportadoras com pendências" description="Romaneios dos motoristas delas ainda sem pagamento.">
            {pendingCarriers.length === 0 ? (
              <EmptyState icon={Warehouse} title="Nenhuma transportadora com pagamento pendente" description="Quando um motorista ligado a uma transportadora finalizar romaneios, eles aparecem aqui." />
            ) : (
              <PendingDriversList
                drivers={pendingCarriers}
                nameLabel="Transportadora"
                documentLabel="CNPJ"
                onSelect={(carrierId) => {
                  setSelectedCarrierId(carrierId);
                  focusById("acerto-transportadora");
                }}
              />
            )}
          </Section>
        )}

        {/* Transportadora escolhida */}
        {mode === "carriers" && selectedCarrier && tenant && (
          <div className="space-y-6 md:space-y-8">
            <CarrierSummaryCard
              carrier={selectedCarrier}
              drivers={drivers.filter((d) => d.carrier_id === selectedCarrier.id).map((d) => d.name)}
              stats={carrierStats}
              periodLabel={periodLabel}
              onOpenBankDetails={() => setIsBankDetailsDialogOpen(true)}
            />
            <ProviderInvoicesPanel
              invoices={allInvoices.filter((i) => i.carrier_id === selectedCarrier.id)}
              payee={{ carrierId: selectedCarrier.id }}
              payeeName={carrierName(selectedCarrier)}
              tenantId={tenant.id}
              isAdmin={isAdmin()}
              required={invoiceRequired}
              onChanged={() => {
                void refreshInvoices();
                void fetchManifests();
              }}
            />
            <ManifestsPanel
              manifests={carrierManifests}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              driverName={carrierName(selectedCarrier)}
              periodLabel={periodLabel}
              onEdit={handleEditManifest}
              onMarkPaid={handleMarkAsPaid}
              onReverse={handleReverseToPending}
              paymentBlock={paymentBlock}
              invoiceLabel={invoiceLabel}
              showDriver
            />
          </div>
        )}

        {/* Sem motorista: quem tem algo a receber */}
        {mode === "drivers" && !selectedDriver && (
          <Section
            id="pendencias"
            title="Motoristas com pendências"
            description="Quem tem romaneio sem pagamento. Escolha um para fazer o acerto."
          >
            {manifestsLoading && manifests.length === 0 ? (
              <ListSkeleton rows={3} />
            ) : pendingDrivers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum motorista com pagamento pendente"
                description="Tudo pago por aqui. Quando um agregado tiver romaneio a receber, ele aparece nesta lista."
              />
            ) : (
              <PendingDriversList drivers={pendingDrivers} onSelect={handleSelectPendingDriver} />
            )}
          </Section>
        )}

        {/* Motorista escolhido */}
        {mode === "drivers" && selectedDriver && (
          <div className="space-y-6 md:space-y-8">
            {selectedDriver.carrier_id && (
              <Alert variant="info">
                <Warehouse aria-hidden="true" />
                <AlertTitle>Recebe pela transportadora {carrierName(carriers.find((c) => c.id === selectedDriver.carrier_id))}</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                  O acerto e a nota fiscal dos romaneios dele saem para a transportadora.
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMode("carriers");
                      setSelectedCarrierId(selectedDriver.carrier_id ?? null);
                      setSelectedDriver(null);
                    }}
                  >
                    Abrir acerto da transportadora
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <DriverSummaryCard
              driver={selectedDriver}
              stats={driverStats}
              sla={selectedDriverSLA}
              periodLabel={periodLabel}
              onOpenBankDetails={() => setIsBankDetailsDialogOpen(true)}
              onAddAdjustment={() => setIsAdjustmentDialogOpen(true)}
            />

            {/* Nota fiscal do TAC (enviada pelo app ou anexada aqui) */}
            {!selectedDriver.is_own_fleet && !selectedDriver.carrier_id && tenant && (invoiceRequired || allInvoices.some((i) => i.driver_id === selectedDriver.id)) && (
              <ProviderInvoicesPanel
                invoices={allInvoices.filter((i) => i.driver_id === selectedDriver.id && !i.carrier_id)}
                payee={{ driverId: selectedDriver.id }}
                payeeName={selectedDriver.name}
                tenantId={tenant.id}
                isAdmin={isAdmin()}
                required={invoiceRequired}
                onChanged={() => {
                  void refreshInvoices();
                  void fetchManifests();
                }}
              />
            )}

            <ManifestsPanel
              manifests={driverManifests}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              driverName={selectedDriver.name}
              periodLabel={periodLabel}
              onEdit={handleEditManifest}
              onMarkPaid={handleMarkAsPaid}
              onReverse={handleReverseToPending}
              paymentBlock={paymentBlock}
              invoiceLabel={invoiceLabel}
            />

            {/* Lancamentos avulsos (gravados na carteira do motorista) */}
            {(localAdjustments.length > 0 || !selectedDriver.is_own_fleet) && (
              <AdjustmentsPanel
                adjustments={localAdjustments}
                canAdd={!selectedDriver.is_own_fleet}
                onAdd={() => setIsAdjustmentDialogOpen(true)}
                onEdit={handleEditAdjustment}
                onRemove={handleRemoveAdjustment}
                onSetPaid={handleSetAdjustmentPaid}
              />
            )}
          </div>
        )}
      </div>

      <AdjustmentDialog
        open={isAdjustmentDialogOpen}
        onOpenChange={setIsAdjustmentDialogOpen}
        driverName={selectedDriver?.name}
        saving={isSavingAdjustment}
        onSubmit={handleAddAdjustment}
      />

      <EditTransactionDialog
        transaction={transactionToEdit}
        open={isEditTransactionDialogOpen}
        onOpenChange={setIsEditTransactionDialogOpen}
        onSave={handleSaveEditedAdjustment}
      />

      <EditManifestDialog
        manifest={manifestToEdit}
        open={isEditManifestDialogOpen}
        onOpenChange={setIsEditManifestDialogOpen}
        onSave={handleSaveManifest}
      />

      {mode === "carriers" && selectedCarrier && (
        <BankDetailsDialog
          open={isBankDetailsDialogOpen}
          onOpenChange={setIsBankDetailsDialogOpen}
          bankDetails={{
            banco: selectedCarrier.banco ?? undefined,
            agencia: selectedCarrier.agencia ?? undefined,
            conta: selectedCarrier.conta ?? undefined,
            tipo_conta: selectedCarrier.tipo_conta ?? undefined,
            chave_pix: selectedCarrier.chave_pix ?? undefined,
            cpf: formatCNPJ(selectedCarrier.cnpj),
            driverName: carrierName(selectedCarrier),
          }}
        />
      )}

      {mode === "drivers" && selectedDriver && (
        <BankDetailsDialog
          open={isBankDetailsDialogOpen}
          onOpenChange={setIsBankDetailsDialogOpen}
          bankDetails={{
            banco: selectedDriver.banco ?? undefined,
            agencia: selectedDriver.agencia ?? undefined,
            conta: selectedDriver.conta ?? undefined,
            tipo_conta: selectedDriver.tipo_conta ?? undefined,
            chave_pix: selectedDriver.chave_pix ?? undefined,
            cpf: selectedDriver.cpf,
            driverName: selectedDriver.name,
          }}
        />
      )}

      <ReversalPasswordDialog
        open={isReversalDialogOpen}
        onOpenChange={setIsReversalDialogOpen}
        onConfirm={confirmReversal}
        manifestCode={manifestToReverse?.id}
        manifestLabel={manifestToReverse ? formatManifestNumber(manifestToReverse) : undefined}
        driverName={selectedDriver?.name}
      />
    </>
  );
}
