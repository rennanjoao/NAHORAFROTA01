import { useState, useMemo, useCallback } from "react";
import { brandAvatar } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Wallet,
  ChevronsUpDown,
  Check,
  User,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Trash2,
  CreditCard,
  Truck,
  Pencil,
} from "lucide-react";
import {
  Building2,
  RotateCcw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, parseDecimalInput } from "@/lib/formatCurrency";
import { getTodayBrazil, parseDateOnly } from "@/lib/timezone";
import { requireCurrentTenantId } from "@/lib/tenant";
import { formatSLA } from "@/lib/formatSLA";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditTransactionDialog } from "@/components/settlement/EditTransactionDialog";
import { EditManifestDialog } from "@/components/settlement/EditManifestDialog";
import { BankDetailsDialog } from "@/components/settlement/BankDetailsDialog";
import { ReversalPasswordDialog } from "@/components/settlement/ReversalPasswordDialog";
import { PixCopyButton } from "@/components/settlement/PixCopyButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// Database hooks
import { useSettlementsDB } from "@/hooks/useSettlementsDB";
import { useManifestsDB, DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";
import { useDBDrivers, DBDriver } from "@/hooks/useDBDrivers";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { PlanLockOverlay } from "@/components/plan/PlanLockOverlay";

interface LocalAdjustment {
  id: string;
  date: Date;
  description: string;
  value: number;
  type: "credit" | "debit";
  category?: "discount" | "bonus" | "unloading" | "toll" | "fuel" | "other";
  observation?: string;
  /** pending = entra no saldo a pagar; paid = ja quitado. */
  status?: string;
}

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

type AdjustmentCategory = "discount" | "bonus" | "unloading" | "toll" | "fuel" | "other";

const categoryLabels: Record<AdjustmentCategory, string> = {
  discount: "Desconto",
  bonus: "Bônus",
  unloading: "Descarga",
  toll: "Pedágio",
  fuel: "Combustível",
  other: "Outros",
};

type PeriodFilter = "daily" | "weekly" | "monthly" | "quarterly" | "semester" | "annual";

const periodLabels: Record<PeriodFilter, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semester: "Semestral",
  annual: "Anual",
};

const periodDays: Record<PeriodFilter, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  semester: 180,
  annual: 365,
};

const freightTypeLabels: Record<string, string> = {
  fixed: "Frete Fixo",
  lumpsum: "Frete Fechado",
  per_km: "Frete/KM",
};

export default function SettlementPage() {
  const { checkFeatureAccess } = useFeatureAccess();
  const financialAccess = checkFeatureAccess('financial_dashboard');

  // Database hooks
  const { drivers, isLoading: driversLoading } = useDBDrivers();
  const { manifests, isLoading: manifestsLoading, fetchManifests } = useManifestsDB();
  const { 
    settlements, 
    openSettlements, 
    markAsPaid: markSettlementPaid, 
    addAdjustmentItem,
    revertToPending: revertSettlementToPending,
    isLoading: settlementsLoading 
  } = useSettlementsDB();
  
  const [selectedDriver, setSelectedDriver] = useState<DBDriver | null>(null);
  const [driverSearchOpen, setDriverSearchOpen] = useState(false);
  // Creditos/debitos avulsos do motorista (driver_wallet). Antes ficavam so na tela.
  const [localAdjustments, setLocalAdjustments] = useState<LocalAdjustment[]>([]);
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [adjustmentDescription, setAdjustmentDescription] = useState("");
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"credit" | "debit">("debit");
  const [adjustmentCategory, setAdjustmentCategory] = useState<AdjustmentCategory>("other");
  const [adjustmentObservation, setAdjustmentObservation] = useState("");
  const [activePeriod, setActivePeriod] = useState<PeriodFilter>("monthly");
  const [activeTab, setActiveTab] = useState<"pending" | "paid">("pending");
  
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
    const disputed = 0; // No disputed status in DB yet
    
    return {
      totalPaid: paid,
      totalPending: pending,
      totalDisputed: disputed,
      totalGeneral: paid + pending + disputed,
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
    
    const summary = new Map<string, { 
      driverId: string;
      driverName: string;
      driverCpf: string;
      manifestCount: number;
      totalValue: number;
    }>();
    
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
      toast({ title: "Erro ao carregar lançamentos", description: error.message, variant: "destructive" });
      return;
    }
    setLocalAdjustments(((data || []) as WalletAdjustmentRow[]).map(toAdjustment));
  }, []);

  const handleSelectDriver = useCallback((driver: DBDriver) => {
    setSelectedDriver(driver);
    setDriverSearchOpen(false);
    setLocalAdjustments([]);
    void fetchAdjustments(driver.id);
  }, [fetchAdjustments]);

  // Motorista com pendencia pode nao estar na lista (ex.: inativo): busca direto.
  const handleSelectPendingDriver = useCallback(async (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver) {
      handleSelectDriver(driver);
      return;
    }
    const { data } = await supabase.from("drivers").select("*").eq("id", driverId).maybeSingle();
    if (data) {
      handleSelectDriver(data as unknown as DBDriver);
    } else {
      toast({ title: "Motorista não encontrado", description: "O cadastro deste motorista foi removido.", variant: "destructive" });
    }
  }, [drivers, handleSelectDriver]);

  const handleAddAdjustment = async () => {
    if (!adjustmentValue || !adjustmentDescription || !selectedDriver) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a descrição e o valor.",
        variant: "destructive",
      });
      return;
    }

    const value = parseDecimalInput(adjustmentValue);
    if (value === null || value === 0) {
      toast({ title: "Valor inválido", description: "Informe um valor maior que zero.", variant: "destructive" });
      return;
    }

    setIsSavingAdjustment(true);
    const signedValue = adjustmentType === "credit" ? Math.abs(value) : -Math.abs(value);
    const { error } = await supabase.from("driver_wallet").insert({
      driver_id: selectedDriver.id,
      tenant_id: await requireCurrentTenantId(),
      type: adjustmentType,
      category: adjustmentCategory,
      description: adjustmentDescription.trim(),
      observation: adjustmentObservation.trim() || null,
      amount: signedValue,
      date: getTodayBrazil(),
      status: "pending",
    });
    setIsSavingAdjustment(false);

    if (error) {
      toast({ title: "Erro ao registrar lançamento", description: error.message, variant: "destructive" });
      return;
    }

    await fetchAdjustments(selectedDriver.id);
    setIsAdjustmentDialogOpen(false);
    setAdjustmentDescription("");
    setAdjustmentValue("");
    setAdjustmentType("debit");
    setAdjustmentCategory("other");
    setAdjustmentObservation("");

    toast({
      title: adjustmentType === "credit" ? "Crédito registrado" : "Débito registrado",
      description: `${adjustmentDescription}: ${adjustmentType === "credit" ? "+" : "-"}${formatCurrency(Math.abs(value))}`,
    });
  };

  const handleRemoveAdjustment = async (adjustmentId: string) => {
    const { error } = await supabase.from("driver_wallet").delete().eq("id", adjustmentId);
    if (error) {
      toast({ title: "Erro ao excluir lançamento", description: error.message, variant: "destructive" });
      return;
    }
    if (selectedDriver) await fetchAdjustments(selectedDriver.id);
    toast({
      title: "Ajuste removido",
      description: "O lançamento foi excluído com sucesso.",
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
      toast({ title: "Erro ao salvar lançamento", description: error.message, variant: "destructive" });
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
      toast({ title: "Erro ao atualizar lançamento", description: error.message, variant: "destructive" });
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
        title: "Erro ao marcar como pago",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    await fetchManifests();
    toast({
      title: "Pagamento registrado",
      description: `Romaneio marcado como pago.`,
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
        title: "Erro ao atualizar romaneio",
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
    {
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
          title: "Erro ao estornar",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      await fetchManifests();
      setManifestToReverse(null);
      return true;
    }
  };

  if (!financialAccess.allowed) {
    return (
      <>
        <PlanLockOverlay upgradePlanLabel={financialAccess.upgradePlanLabel}>
          <div className="space-y-6 min-h-[60vh]">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Wallet className="h-7 w-7 text-primary" />
                Acerto Financeiro
              </h1>
              <p className="text-muted-foreground">Painel financeiro e liquidação de motoristas</p>
            </div>
          </div>
        </PlanLockOverlay>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Acerto Financeiro
          </h1>
          <p className="text-muted-foreground">Painel financeiro e liquidação de motoristas</p>
        </div>

        {/* Global Period Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground mr-2">Período:</span>
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30 flex-wrap">
            {(Object.keys(periodLabels) as PeriodFilter[]).map((period) => (
              <button
                key={period}
                onClick={() => setActivePeriod(period)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  activePeriod === period
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {periodLabels[period]}
              </button>
            ))}
          </div>
        </div>

        {/* Global Financial Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-success">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pago</p>
                <p className="text-xl font-bold text-success font-mono truncate">
                  {formatCurrency(globalStats.totalPaid)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-destructive">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total a Pagar</p>
                <p className="text-xl font-bold text-destructive font-mono truncate">
                  {formatCurrency(globalStats.totalPending)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-warning">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disputado</p>
                <p className="text-xl font-bold text-warning font-mono truncate">
                  {formatCurrency(globalStats.totalDisputed)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-primary">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Geral</p>
                <p className="text-xl font-bold text-foreground font-mono truncate">
                  {formatCurrency(globalStats.totalGeneral)}
                </p>
                <p className="text-xs text-muted-foreground">{globalStats.manifestCount.toLocaleString('pt-BR')} romaneios</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Pending Drivers Summary */}
        {!selectedDriver && pendingDrivers.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Motoristas com Pendências
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Motorista</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead className="text-center">Romaneios</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingDrivers.map((driver) => (
                    <TableRow key={driver.driverId}>
                      <TableCell className="font-medium truncate max-w-[200px]">{driver.driverName}</TableCell>
                      <TableCell className="font-mono text-sm">{driver.driverCpf}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{driver.manifestCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-destructive font-mono">
                        {formatCurrency(driver.totalValue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="gap-1"
                          onClick={() => handleSelectPendingDriver(driver.driverId)}
                        >
                          Realizar Acerto
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Driver Selection */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Label className="text-sm font-medium whitespace-nowrap">Selecionar Motorista:</Label>
            <Popover open={driverSearchOpen} onOpenChange={setDriverSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={driverSearchOpen}
                  className="w-full min-w-0 max-w-md justify-between"
                >
                  {selectedDriver ? (
                    <span className="flex items-center gap-2 truncate">
                      <User className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{selectedDriver.name} - {selectedDriver.cpf}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Buscar motorista...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(400px,calc(100vw-2rem))] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Digite o nome ou CPF..." />
                  <CommandList>
                    <CommandEmpty>Nenhum motorista encontrado.</CommandEmpty>
                    <CommandGroup>
                      {drivers.map((driver) => (
                        <CommandItem
                          key={driver.id}
                          value={`${driver.name} ${driver.cpf}`}
                          onSelect={() => handleSelectDriver(driver)}
                        >
                          <Check
                            className={cn(
                            "mr-2 h-4 w-4",
                              selectedDriver?.id === driver.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex items-center gap-3">
                            <img 
                              src={brandAvatar(driver.photo || driver.avatar)} 
                              alt={driver.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                            <div>
                              <p className="font-medium truncate max-w-[200px]">{driver.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{driver.cpf} • {driver.vehicle_plate}</p>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedDriver && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDriver(null)}>
                Limpar
              </Button>
            )}
          </div>
        </Card>

        {/* Driver View */}
        {selectedDriver && (
          <>
            {/* Driver Info & Stats */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <img 
                      src={brandAvatar(selectedDriver.photo || selectedDriver.avatar)} 
                      alt={selectedDriver.name}
                      className="h-12 w-12 rounded-full object-cover border-2 border-primary"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{selectedDriver.name}</CardTitle>
                        {selectedDriver.is_own_fleet && (
                          <Badge variant="outline" className="border-primary text-primary gap-1">
                            <Truck className="h-3 w-3" />
                            Frota Própria
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="font-mono">CPF: {selectedDriver.cpf}</span>
                          <PixCopyButton 
                            pixKey={(selectedDriver as any).chave_pix} 
                            cpf={selectedDriver.cpf} 
                            compact 
                          />
                        </div>
                        <span>•</span>
                        <span className="font-mono">Placa: {selectedDriver.vehicle_plate}</span>
                        <span>•</span>
                        <span className={cn(
                          "font-semibold",
                          (selectedDriver.individual_sla || 100) >= 95 ? "text-success" : "text-warning"
                        )}>
                          SLA: {formatSLA(selectedDriver.individual_sla || 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!selectedDriver.is_own_fleet && (
                      <Button 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => setIsBankDetailsDialogOpen(true)}
                      >
                        <Building2 className="h-4 w-4" />
                        Dados Bancários
                      </Button>
                    )}
                    {!selectedDriver.is_own_fleet && (
                      <Button 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => setIsAdjustmentDialogOpen(true)}
                      >
                        <DollarSign className="h-4 w-4" />
                        Novo Lançamento
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selectedDriver.is_own_fleet ? (
                  <Alert className="border-primary/30 bg-primary/5">
                    <Truck className="h-4 w-4" />
                    <AlertTitle>Motorista de Frota Própria</AlertTitle>
                    <AlertDescription>
                      Este motorista pertence à frota própria da empresa e não gera valores a receber no acerto financeiro. 
                      Apenas custos operacionais (combustível, pedágio, etc.) podem ser registrados.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-success/5 border border-success/20">
                      <p className="text-sm text-muted-foreground">Pago no Período</p>
                      <p className="text-2xl font-bold text-success font-mono">{formatCurrency(driverStats.paid)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                      <p className="text-sm text-muted-foreground">Pendente</p>
                      <p className="text-2xl font-bold text-destructive font-mono">{formatCurrency(driverStats.pending)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm text-muted-foreground">Saldo a Pagar</p>
                      <p className="text-2xl font-bold text-primary font-mono">{formatCurrency(driverStats.balance)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manifests Table */}
            <Card>
              <CardHeader>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "paid")}>
                  <TabsList>
                    <TabsTrigger value="pending" className="gap-2">
                      <Clock className="h-4 w-4" />
                      Pendentes
                    </TabsTrigger>
                    <TabsTrigger value="paid" className="gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Pagos
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Romaneio</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo de Frete</TableHead>
                      <TableHead className="text-center">Entregas</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driverManifests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum romaneio {activeTab === "pending" ? "pendente" : "pago"} no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      driverManifests.map((manifest) => (
                        <TableRow key={manifest.id}>
                          <TableCell className="font-mono font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                {formatManifestNumber(manifest)}
                                {manifest.is_own_fleet && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className="border-primary text-primary gap-1 text-xs">
                                          <Truck className="h-3 w-3" />
                                          Casa
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Frota Própria</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(manifest.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                          <TableCell>{freightTypeLabels[manifest.freight_type] || manifest.freight_type}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{manifest.deliveries_count}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold font-mono">
                            {formatCurrency(manifest.freight_value || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      onClick={() => handleEditManifest(manifest)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Editar valor</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {activeTab === "pending" && (
                                manifest.status === "completed" ? (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="gap-1 text-success border-success/30 hover:bg-success/10"
                                    onClick={() => handleMarkAsPaid(manifest.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Pagar
                                  </Button>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button size="sm" variant="outline" className="gap-1" disabled>
                                            <Clock className="h-4 w-4" />
                                            {manifest.status === "in_progress" ? "Em rota" : "Aguardando"}
                                          </Button>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>O pagamento libera quando o romaneio é finalizado</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )
                              )}
                              {activeTab === "paid" && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="gap-1 text-warning border-warning/30 hover:bg-warning/10"
                                        onClick={() => handleReverseToPending(manifest)}
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                        Estornar
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Voltar para 'A Pagar'</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {driverManifests.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4}>
                          <span className="font-semibold">Total</span>
                        </TableCell>
                        <TableCell className="text-right font-bold font-mono text-lg">
                          {formatCurrency(driverManifests.reduce((sum, m) => sum + (m.freight_value || 0), 0))}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </CardContent>
            </Card>

            {/* Lancamentos avulsos (gravados na carteira do motorista) */}
            {localAdjustments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Créditos e Débitos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {localAdjustments.map((adj) => {
                        const isPaid = adj.status === "paid";
                        return (
                        <TableRow key={adj.id}>
                          <TableCell>
                            <p>{adj.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {categoryLabels[(adj.category || "other") as AdjustmentCategory]}
                              {adj.observation ? ` • ${adj.observation}` : ""}
                            </p>
                          </TableCell>
                          <TableCell>{format(adj.date, "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                          <TableCell>
                            <Badge variant={isPaid ? "secondary" : "outline"}>{isPaid ? "Pago" : "A pagar"}</Badge>
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-semibold font-mono",
                            adj.type === "credit" ? "text-success" : "text-destructive"
                          )}>
                            {adj.type === "credit" ? "+" : ""}{formatCurrency(adj.value)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className={cn("gap-1", isPaid ? "text-warning border-warning/30" : "text-success border-success/30")}
                                onClick={() => handleSetAdjustmentPaid(adj, !isPaid)}
                              >
                                {isPaid ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                {isPaid ? "Reabrir" : "Quitar"}
                              </Button>
                              {!isPaid && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label="Editar lançamento"
                                    onClick={() => handleEditAdjustment(adj)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label="Excluir lançamento"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveAdjustment(adj.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Adjustment Dialog */}
      <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Novo Lançamento
            </DialogTitle>
            <DialogDescription>
              Adicione um crédito ou débito ao extrato do motorista
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <RadioGroup
              value={adjustmentType}
              onValueChange={(v) => setAdjustmentType(v as "credit" | "debit")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="debit" id="adj-debit" />
                <Label htmlFor="adj-debit" className="text-destructive font-medium cursor-pointer">Débito (Desconto)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="credit" id="adj-credit" />
                <Label htmlFor="adj-credit" className="text-success font-medium cursor-pointer">Crédito (A Receber)</Label>
              </div>
            </RadioGroup>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={adjustmentCategory} onValueChange={(v) => setAdjustmentCategory(v as AdjustmentCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input 
                placeholder="Ex: Vale Combustível, Avaria NF 12345..."
                value={adjustmentDescription}
                onChange={(e) => setAdjustmentDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input 
                type="number"
                step="0.01"
                placeholder="0,00"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observação / Motivo</Label>
              <Textarea 
                placeholder="Ex: Desconto referente a avaria na NF 12345, mercadoria danificada durante transporte..."
                value={adjustmentObservation}
                onChange={(e) => setAdjustmentObservation(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustmentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddAdjustment} disabled={isSavingAdjustment}>
              <Plus className="h-4 w-4 mr-2" />
              {isSavingAdjustment ? "Salvando..." : "Adicionar Lançamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <EditTransactionDialog
        transaction={transactionToEdit}
        open={isEditTransactionDialogOpen}
        onOpenChange={setIsEditTransactionDialogOpen}
        onSave={handleSaveEditedAdjustment}
      />

      {/* Edit Manifest Dialog */}
      <EditManifestDialog
        manifest={manifestToEdit}
        open={isEditManifestDialogOpen}
        onOpenChange={setIsEditManifestDialogOpen}
        onSave={handleSaveManifest}
      />

      {/* Bank Details Dialog */}
      {selectedDriver && (
        <BankDetailsDialog
          open={isBankDetailsDialogOpen}
          onOpenChange={setIsBankDetailsDialogOpen}
          bankDetails={{
            banco: (selectedDriver as any).banco,
            agencia: (selectedDriver as any).agencia,
            conta: (selectedDriver as any).conta,
            tipo_conta: (selectedDriver as any).tipo_conta,
            chave_pix: (selectedDriver as any).chave_pix,
            cpf: selectedDriver.cpf,
            driverName: selectedDriver.name,
          }}
        />
      )}

      {/* Reversal Password Dialog */}
      <ReversalPasswordDialog
        open={isReversalDialogOpen}
        onOpenChange={setIsReversalDialogOpen}
        onConfirm={confirmReversal}
        manifestCode={manifestToReverse?.id}
        driverName={selectedDriver?.name}
      />
    </>
  );
}
