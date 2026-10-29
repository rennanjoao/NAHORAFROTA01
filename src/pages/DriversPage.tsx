import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { brandAvatar } from "@/lib/avatar";
import { useUrlSearchTerm } from "@/hooks/useUrlSearchTerm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Star,
  TrendingUp,
  TrendingDown,
  MapPin,
  FileSpreadsheet,
  Loader2,
  Truck,
  Building2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { RequestVehicleWizard } from "@/components/drivers/RequestVehicleWizard";
import { ImportDriversDialog } from "@/components/drivers/ImportDriversDialog";
import { DriverDetailSheet } from "@/components/drivers/DriverDetailSheet";
import { EditDriverDialog } from "@/components/drivers/EditDriverDialog";
import { NewDriverDialog } from "@/components/drivers/NewDriverDialog";
import { formatSLA } from "@/lib/formatSLA";
import { formatCurrency } from "@/lib/formatCurrency";
import { Driver, VehicleType } from "@/contexts/LogisticsContext";
import { useSLADB } from "@/hooks/useSLADB";
import { useDriversDB, DBDriver } from "@/hooks/useDriversDB";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitBanner } from "@/components/plan/PlanLimitBanner";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";

// Status config with correct values matching database
// active = Disponível (verde), in_route = Em Rota (azul), inactive = Inativo (cinza)
const statusConfig: Record<string, { label: string; className: string; color: string }> = {
  active: { label: "Disponível", className: "bg-success/20 text-success border-success/30", color: "text-success" },
  in_route: { label: "Em Rota", className: "bg-info/20 text-info border-info/30", color: "text-info" },
  inactive: { label: "Inativo", className: "bg-muted/50 text-muted-foreground border-muted", color: "text-muted-foreground" },
  pending_approval: { label: "Pendente", className: "bg-warning/20 text-warning border-warning/30", color: "text-warning" },
};

const VEHICLE_TYPES: VehicleType[] = ["Fiorino", "VUC", "Toco", "Truck", "Carreta", "Van", "Moto"];
const ITEMS_PER_PAGE = 20;

type DriverTypeFilter = "all" | "own_fleet" | "third_party";

const vehicleTypeToDbMap: Record<string, string> = {
  fiorino: "fiorino",
  vuc: "vuc",
  toco: "toco",
  truck: "truck",
  carreta: "carreta",
  van: "van",
  moto: "moto",
};

const vehicleTypeToDisplayMap: Record<string, VehicleType> = {
  fiorino: "Fiorino",
  vuc: "VUC",
  toco: "Toco",
  truck: "Truck",
  carreta: "Carreta",
  van: "Van",
  moto: "Moto",
};

const normalizeVehicleTypeForDb = (value?: string | null): string => {
  const normalized = (value || "").trim().toLowerCase();
  return vehicleTypeToDbMap[normalized] || normalized || "van";
};

const normalizeVehicleTypeForDisplay = (value?: string | null): VehicleType => {
  const normalized = (value || "").trim().toLowerCase();
  return vehicleTypeToDisplayMap[normalized] || "Van";
};

export default function DriversPage() {
  const { driverStats: slaDriverStats } = useSLADB();
  const performanceByDriver = useMemo(
    () => new Map(slaDriverStats.map((stat) => [stat.driver_id, stat.periodStats[180]])),
    [slaDriverStats],
  );
  const [driverBalances, setDriverBalances] = useState<Map<string, number>>(new Map());
  const { drivers: dbDrivers, isLoading: isLoadingDrivers, fetchDrivers, addDriver, updateDriver } = useDriversDB();
  const { canAddDriver, driversCount, limits, plan, planLabels, refresh: refreshPlan } = usePlanLimits();
  const [openManifestDriverIds, setOpenManifestDriverIds] = useState<Set<string>>(new Set());
  
  const [isNewDriverDialogOpen, setIsNewDriverDialogOpen] = useState(false);
  const [isRequestVehicleOpen, setIsRequestVehicleOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterVehicleType, setFilterVehicleType] = useState<string>("all");
  const [filterDriverType, setFilterDriverType] = useState<DriverTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  useUrlSearchTerm((term) => {
    setSearchQuery(term);
    setFilterStatus("all");
    setFilterVehicleType("all");
    setFilterDriverType("all");
    setCurrentPage(1);
  });
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [driverToEdit, setDriverToEdit] = useState<Driver | null>(null);
  const [isEditDriverDialogOpen, setIsEditDriverDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Romaneios ainda nao pagos: definem quem esta em rota e o saldo a receber
  // (mesma regra do Acerto: pendente, em andamento ou concluido).
  const fetchOpenManifestDrivers = useCallback(async () => {
    const { data, error } = await supabase
      .from("manifests")
      .select("driver_id, status, freight_value, is_own_fleet")
      .not("driver_id", "is", null)
      .not("status", "in", '("cancelled","paid")');

    if (error) {
      console.warn("Error fetching open manifest drivers:", error);
      return;
    }

    const open = new Set<string>();
    const balances = new Map<string, number>();
    for (const manifest of data || []) {
      if (!manifest.driver_id) continue;
      if (manifest.status !== "completed") open.add(manifest.driver_id);
      if (!manifest.is_own_fleet) {
        balances.set(manifest.driver_id, (balances.get(manifest.driver_id) || 0) + (Number(manifest.freight_value) || 0));
      }
    }
    setOpenManifestDriverIds(open);
    setDriverBalances(balances);
  }, []);

  useEffect(() => {
    fetchOpenManifestDrivers();

    const manifestsChannel = supabase
      .channel(uniqueChannelName("drivers-page-open-manifests"))
      .on("postgres_changes", { event: "*", schema: "public", table: "manifests" }, fetchOpenManifestDrivers)
      .subscribe();

    return () => {
      supabase.removeChannel(manifestsChannel);
    };
  }, [fetchOpenManifestDrivers]);

  // Convert DB drivers to context Driver format for compatibility
  const drivers: Driver[] = useMemo(() => {
    return dbDrivers.map((d, index) => {
      const hasOpenManifest = openManifestDriverIds.has(d.id);
      const performance = performanceByDriver.get(d.id);
      const displayStatus = hasOpenManifest
        ? "in_route"
        : d.status === "in_route"
          ? "active"
          : d.status;

      return {
        id: index + 1, // Numeric ID for compatibility
        name: d.name,
        cpf: d.cpf,
        phone: d.phone,
        // E-mail de contato (recebe os dados de acesso), nao o login interno do app.
        email: d.contact_email || "",
        photo: d.avatar || d.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(d.name || "Motorista")}`,
        vehiclePlate: d.vehicle_plate,
        vehicleType: normalizeVehicleTypeForDisplay(d.vehicle_type),
        status: displayStatus as any,
        rating: 0,
        totalDeliveries: performance?.total ?? 0,
        successfulDeliveries: performance?.delivered ?? 0,
        failedDeliveries: performance?.occurrences ?? 0,
        sla: performance && performance.total > 0 ? performance.sla : null,
        balance: driverBalances.get(d.id) || 0,
        region: "SP",
        joinedAt: new Date(d.created_at),
        isOwnFleet: d.is_own_fleet || false,
        _dbId: d.id, // Keep database ID for operations
        tenant_id: d.tenant_id,
        cnh: d.cnh,
        cnh_category: d.cnh_category,
        banco: d.banco,
        agencia: d.agencia,
        conta: d.conta,
        tipo_conta: d.tipo_conta,
        chave_pix: d.chave_pix,
      };
    });
  }, [dbDrivers, openManifestDriverIds, driverBalances, performanceByDriver]);

  // Filter drivers from context
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const matchesStatus = filterStatus === "all" || driver.status === filterStatus;
      const matchesVehicle = filterVehicleType === "all" || driver.vehicleType === filterVehicleType;
      const matchesDriverType = 
        filterDriverType === "all" || 
        (filterDriverType === "own_fleet" && driver.isOwnFleet) ||
        (filterDriverType === "third_party" && !driver.isOwnFleet);
      const matchesSearch = 
        searchQuery === "" || 
        driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        // CPF pode estar gravado com ou sem pontuacao.
        (/\d/.test(searchQuery) && driver.cpf.replace(/\D/g, "").includes(searchQuery.replace(/\D/g, ""))) ||
        driver.vehiclePlate.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesStatus && matchesVehicle && matchesDriverType && matchesSearch;
    });
  }, [filterStatus, filterVehicleType, filterDriverType, searchQuery, drivers]);

  // Stats by driver type
  const driverTypeStats = useMemo(() => ({
    total: drivers.length,
    ownFleet: drivers.filter(d => d.isOwnFleet).length,
    thirdParty: drivers.filter(d => !d.isOwnFleet).length,
  }), [drivers]);

  // Pagination
  const totalPages = Math.ceil(filteredDrivers.length / ITEMS_PER_PAGE);
  const paginatedDrivers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDrivers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDrivers, currentPage]);

  // Stats calculated from DB drivers with correct status values
  // Status mapping: active = Disponível, in_route = Em Rota, inactive = Inativo
  const stats = useMemo(() => ({
    total: drivers.length,
    available: drivers.filter(d => d.status === "active").length, // active in DB = Disponível
    onRoute: drivers.filter(d => d.status === "in_route").length, // in_route in DB = Em Rota
    inactive: drivers.filter(d => d.status === "inactive").length,
  }), [drivers]);

  useEffect(() => {
    if (!selectedDriver) return;

    const refreshedSelectedDriver = drivers.find(
      (driver) => (driver as any)._dbId === (selectedDriver as any)._dbId
    );

    if (refreshedSelectedDriver && refreshedSelectedDriver !== selectedDriver) {
      setSelectedDriver(refreshedSelectedDriver);
    }
  }, [drivers, selectedDriver]);

  useEffect(() => {
    if (!driverToEdit) return;

    const refreshedDriverToEdit = drivers.find(
      (driver) => (driver as any)._dbId === (driverToEdit as any)._dbId
    );

    if (refreshedDriverToEdit && refreshedDriverToEdit !== driverToEdit) {
      setDriverToEdit(refreshedDriverToEdit);
    }
  }, [drivers, driverToEdit]);

  // Reset page when filters change
  const handleFilterChange = useCallback((setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  const handleNewDriver = useCallback(() => {
    setIsNewDriverDialogOpen(false);
    setCurrentPage(1);
    fetchDrivers();
  }, [fetchDrivers]);

  // Generate pagination items
  const getPaginationItems = () => {
    const items: (number | "ellipsis")[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      if (currentPage > 3) items.push("ellipsis");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) items.push(i);
      if (currentPage < totalPages - 2) items.push("ellipsis");
      items.push(totalPages);
    }
    
    return items;
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading">Motoristas</h1>
            <p className="text-muted-foreground">
              Gerencie sua frota de {drivers.length.toLocaleString()} motoristas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportOpen(true)} disabled={!canAddDriver}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Importar Planilha
            </Button>
            <Button 
              className="bg-primary hover:bg-primary/90 btn-neon" 
              disabled={!canAddDriver}
              onClick={() => {
                if (!canAddDriver) return;
                setIsNewDriverDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {canAddDriver ? "Novo Motorista" : "Limite de Motoristas atingido"}
            </Button>
          </div>
        </div>

        {/* Plan Limit Banner */}
        <PlanLimitBanner
          plan={plan}
          resourceLabel="motoristas"
          currentCount={driversCount}
          maxCount={limits.max_drivers}
          planLabels={planLabels}
        />

        {/* Driver Type Tabs */}
        <Tabs value={filterDriverType} onValueChange={(v) => handleFilterChange(setFilterDriverType as any, v as DriverTypeFilter)} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all" className="gap-2">
              <User className="h-4 w-4" />
              Todos ({driverTypeStats.total})
            </TabsTrigger>
            <TabsTrigger value="own_fleet" className="gap-2">
              <Building2 className="h-4 w-4" />
              CLT ({driverTypeStats.ownFleet})
            </TabsTrigger>
            <TabsTrigger value="third_party" className="gap-2">
              <Truck className="h-4 w-4" />
              Agregados ({driverTypeStats.thirdParty})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome, CPF ou placa..." 
              className="pl-10 bg-secondary border-0" 
              value={searchQuery}
              onChange={(e) => handleFilterChange(setSearchQuery, e.target.value)}
            />
          </div>
          
          <Select value={filterVehicleType} onValueChange={(v) => handleFilterChange(setFilterVehicleType, v)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Tipo de Veículo" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todos os Veículos</SelectItem>
              {VEHICLE_TYPES.map((vt) => (
                <SelectItem key={vt} value={vt}>{vt}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => handleFilterChange(setFilterStatus, v)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="active">Disponíveis</SelectItem>
              <SelectItem value="in_route">Em Rota</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats - KPIs with correct status mapping */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold font-heading">{stats.total.toLocaleString()}</p>
          </div>
          <div className="glass-card rounded-xl p-4 border-l-4 border-l-success">
            <p className="text-sm text-muted-foreground">Disponíveis</p>
            <p className="text-2xl font-bold text-success font-heading">{stats.available.toLocaleString()}</p>
          </div>
          <div className="glass-card rounded-xl p-4 border-l-4 border-l-primary">
            <p className="text-sm text-muted-foreground">Em Rota</p>
            <p className="text-2xl font-bold text-primary font-heading">{stats.onRoute.toLocaleString()}</p>
          </div>
          <div className="glass-card rounded-xl p-4 border-l-4 border-l-muted">
            <p className="text-sm text-muted-foreground">Inativos</p>
            <p className="text-2xl font-bold text-muted-foreground font-heading">{stats.inactive.toLocaleString()}</p>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Exibindo {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredDrivers.length)} de {filteredDrivers.length.toLocaleString()} motoristas
          </span>
          <span>Página {currentPage} de {totalPages || 1}</span>
        </div>

        {/* Driver List */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Motorista</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Veículo</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground" title="Entregues / NFs finalizadas nos últimos 6 meses">Entregas (6m)</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground" title="SLA dos últimos 6 meses">SLA (6m)</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground" title="Frete de romaneios ainda não pagos">A receber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedDrivers.map((driver) => {
                  const status = statusConfig[driver.status] || statusConfig.inactive;
                  const driverSLA = driver.sla ?? null;
                  const driverBalance = driver.balance ?? 0;
                  const completionRate = driver.totalDeliveries > 0 
                    ? (driver.successfulDeliveries / driver.totalDeliveries) * 100 
                    : 0;

                  return (
                    <tr 
                      key={driver.id} 
                      className="hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedDriver(driver)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={brandAvatar(driver.photo)} 
                            alt={driver.name}
                            className="h-10 w-10 rounded-full object-cover border border-border flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate max-w-[160px]">{driver.name}</p>
                              {driver.isOwnFleet && (
                                <Badge variant="outline" className="border-primary text-primary text-[10px] px-1.5 py-0 h-4">
                                  <Truck className="h-3 w-3 mr-0.5" />
                                  Próprio
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">
                              {driver.cpf}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <span className="text-sm font-medium">{driver.vehicleType}</span>
                          <p className="text-xs text-muted-foreground font-mono">{driver.vehiclePlate}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium font-mono">
                            {driver.successfulDeliveries}/{driver.totalDeliveries}
                          </p>
                          <Progress value={completionRate} className="h-1.5 w-20" />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {driverSLA === null ? (
                          <span className="text-xs text-muted-foreground">Sem entregas</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-medium font-mono",
                              driverSLA >= 95 ? "text-success" :
                              driverSLA >= 85 ? "text-warning" : "text-destructive"
                            )}>
                              {formatSLA(driverSLA)}%
                            </span>
                            {driverSLA >= 95 && <TrendingUp className="h-4 w-4 text-success" />}
                            {driverSLA < 85 && <TrendingDown className="h-4 w-4 text-destructive" />}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {driver.isOwnFleet ? (
                          <span className="text-xs text-muted-foreground">N/A (Próprio)</span>
                        ) : (
                          <span className={cn(
                            "font-medium font-mono text-sm",
                            driverBalance > 0 ? "text-success" : "text-muted-foreground"
                          )}>
                            {formatCurrency(driverBalance)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {getPaginationItems().map((item, idx) => (
                <PaginationItem key={idx}>
                  {item === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      onClick={() => setCurrentPage(item)}
                      isActive={currentPage === item}
                      className="cursor-pointer"
                    >
                      {item}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      {/* New Driver Dialog */}
      <NewDriverDialog
        open={isNewDriverDialogOpen}
        onOpenChange={setIsNewDriverDialogOpen}
        onSave={handleNewDriver}
        addDriver={addDriver}
      />

      <ImportDriversDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        existingCpfs={dbDrivers.map((d) => d.cpf)}
        remainingSlots={limits.max_drivers === -1 ? -1 : Math.max(0, limits.max_drivers - driversCount)}
        onImported={() => {
          fetchDrivers();
          refreshPlan();
        }}
      />

      {/* Request Vehicle Wizard */}
      <RequestVehicleWizard
        open={isRequestVehicleOpen}
        onOpenChange={setIsRequestVehicleOpen}
      />

      {/* FAB - Pedir Carro Extra */}
      <button
        onClick={() => setIsRequestVehicleOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-neon transition-all hover:scale-105 active:scale-95"
      >
        <Truck className="h-5 w-5" />
        <span className="font-semibold">Pedir Carro Extra</span>
      </button>

      {/* Driver Detail Sheet */}
      <DriverDetailSheet
        driver={selectedDriver}
        open={!!selectedDriver}
        onOpenChange={(open) => !open && setSelectedDriver(null)}
        onEditDriver={(driver) => {
          setDriverToEdit(driver);
          setIsEditDriverDialogOpen(true);
        }}
        onDeleteDriver={() => {
          setSelectedDriver(null);
          void fetchDrivers();
          void refreshPlan();
        }}
        onStatusChanged={() => {
          void fetchDrivers();
        }}
      />

      {/* Edit Driver Dialog */}
      <EditDriverDialog
        driver={driverToEdit}
        open={isEditDriverDialogOpen}
        onOpenChange={setIsEditDriverDialogOpen}
        onSave={async (updatedDriver) => {
          const driverDbId = (updatedDriver as any)._dbId;

          if (!driverDbId) {
            toast({
              title: "Erro ao atualizar",
              description: "Não foi possível identificar o motorista selecionado.",
              variant: "destructive",
            });
            return false;
          }

          const updatedRecord = await updateDriver(driverDbId, {
            name: updatedDriver.name,
            cpf: updatedDriver.cpf,
            phone: updatedDriver.phone,
            contact_email: updatedDriver.email?.trim().toLowerCase() || null,
            avatar: updatedDriver.photo,
            photo: updatedDriver.photo,
            vehicle_plate: updatedDriver.vehiclePlate,
            vehicle_type: normalizeVehicleTypeForDb(updatedDriver.vehicleType),
            status: updatedDriver.status,
            is_own_fleet: updatedDriver.isOwnFleet,
            banco: (updatedDriver as any).banco,
            agencia: (updatedDriver as any).agencia,
            conta: (updatedDriver as any).conta,
            tipo_conta: (updatedDriver as any).tipo_conta,
            chave_pix: (updatedDriver as any).chave_pix,
            updated_at: new Date().toISOString(),
          });

          if (!updatedRecord) return false;

          const refreshedDriver: Driver = {
            ...updatedDriver,
            photo: updatedRecord.avatar || updatedRecord.photo || updatedDriver.photo,
            vehiclePlate: updatedRecord.vehicle_plate || updatedDriver.vehiclePlate,
            vehicleType: normalizeVehicleTypeForDisplay(updatedRecord.vehicle_type || updatedDriver.vehicleType),
            status: (updatedRecord.status as Driver["status"]) || updatedDriver.status,
            isOwnFleet: updatedRecord.is_own_fleet ?? updatedDriver.isOwnFleet,
            _dbId: updatedRecord.id,
            tenant_id: updatedRecord.tenant_id,
            banco: updatedRecord.banco,
            agencia: updatedRecord.agencia,
            conta: updatedRecord.conta,
            tipo_conta: updatedRecord.tipo_conta,
            chave_pix: updatedRecord.chave_pix,
          } as Driver;

          setDriverToEdit(refreshedDriver);
          setSelectedDriver((currentDriver) =>
            currentDriver && (currentDriver as any)._dbId === driverDbId ? refreshedDriver : currentDriver
          );
          // O aviso de sucesso sai do updateDriver (antes eram tres avisos iguais).
          return true;
        }}
      />
    </>
  );
}
