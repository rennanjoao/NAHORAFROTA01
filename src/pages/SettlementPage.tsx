import { useState, useMemo, useCallback } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ListSkeleton, PageHeader, Section, StatCard } from "@/components/patterns";
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
  const financialAccess = checkFeatureAccess('financial_dashboard');

  // Database hooks
  const { drivers, isLoading: driversLoading } = useDBDrivers();
  const { manifests, isLoading: manifestsLoading, fetchManifests } = useManifestsDB();
  // Mantido: carrega os acertos (settlements) do banco junto com a tela.
  useSettlementsDB();
  // Mesmo "No prazo (6 meses)" da tela de Motoristas (antes mostrava individual_sla, sempre 100%).
  const { driverStats: slaDriverStats } = useSLADB();

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

    return Array.from(summary.values());
  }, [manifests]);

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
      toast({ title: "Não foi possível carregar os lançamentos", description: error.message, variant: "destructive" });
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
      error = { message: err instanceof Error ? err.message : "Tente de novo em instantes." };
    } finally {
      setIsSavingAdjustment(false);
    }

    if (error) {
      toast({ title: "Não foi possível registrar o lançamento", description: error.message, variant: "destructive" });
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
        description: error?.message || "Você não tem permissão para esta tarefa.",
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
      toast({ title: "Não foi possível salvar o lançamento", description: error.message, variant: "destructive" });
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
      toast({ title: "Não foi possível atualizar o lançamento", description: error.message, variant: "destructive" });
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
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    await fetchManifests();
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
        description: error.message,
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
        description: error.message,
        variant: "destructive",
      });
      return false;
    }

    await fetchManifests();
    setManifestToReverse(null);
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
  const currentStep = !selectedDriver ? 1 : driverManifests.some((m) => m.status === "completed") ? 3 : 2;

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
        {/* Resumo do periodo (so agregados; frota propria nao recebe frete) */}
        <div className="stagger grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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
            <SettlementSteps current={currentStep} />
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
          </Card>
        </Section>

        {/* Sem motorista: quem tem algo a receber */}
        {!selectedDriver && (
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
        {selectedDriver && (
          <div className="space-y-6 md:space-y-8">
            <DriverSummaryCard
              driver={selectedDriver}
              stats={driverStats}
              sla={selectedDriverSLA}
              periodLabel={periodLabel}
              onOpenBankDetails={() => setIsBankDetailsDialogOpen(true)}
              onAddAdjustment={() => setIsAdjustmentDialogOpen(true)}
            />

            <ManifestsPanel
              manifests={driverManifests}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              driverName={selectedDriver.name}
              periodLabel={periodLabel}
              onEdit={handleEditManifest}
              onMarkPaid={handleMarkAsPaid}
              onReverse={handleReverseToPending}
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

      {selectedDriver && (
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
