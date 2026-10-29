import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { CheckCircle2, FileSpreadsheet, MoreHorizontal, Plus, Route, SearchX, Truck, UserX, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, FilterBar, ListSkeleton, PageHeader, SearchInput } from "@/components/patterns";
import { ActionMenu } from "@/components/patterns/ActionMenu";
import { RequestVehicleWizard } from "@/components/drivers/RequestVehicleWizard";
import { ImportDriversDialog } from "@/components/drivers/ImportDriversDialog";
import { DriverDetailSheet } from "@/components/drivers/DriverDetailSheet";
import { EditDriverDialog } from "@/components/drivers/EditDriverDialog";
import { NewDriverDialog } from "@/components/drivers/NewDriverDialog";
import { DriverList } from "@/components/drivers/DriverList";
import { FilterStatCard } from "@/components/patterns/FilterStatCard";
import { ListPagination } from "@/components/drivers/ListPagination";
import { SegmentedControl } from "@/components/patterns/SegmentedControl";
import { DRIVER_VEHICLE_TYPES } from "@/components/drivers/driverConfig";
import { useDriverQuickActions, type DriverRecord } from "@/components/drivers/useDriverQuickActions";
import { PlanLimitBanner } from "@/components/plan/PlanLimitBanner";
import { Driver, VehicleType } from "@/contexts/LogisticsContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useQueryAction } from "@/hooks/useQueryAction";
import { useUrlSearchTerm } from "@/hooks/useUrlSearchTerm";
import { useSLADB } from "@/hooks/useSLADB";
import { useDriversDB } from "@/hooks/useDriversDB";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";

const ITEMS_PER_PAGE = 20;

type DriverTypeFilter = "all" | "own_fleet" | "third_party";
type StatusFilter = "all" | "active" | "in_route" | "inactive";

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

// Busca sem acento e sem caixa ("joao" acha "João").
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const normalizeVehicleTypeForDisplay = (value?: string | null): VehicleType => {
  const normalized = (value || "").trim().toLowerCase();
  return vehicleTypeToDisplayMap[normalized] || "Van";
};

// Celular estreito: o icone decorativo sai do cartao para o rotulo ("Disponíveis",
// "Em manutenção") caber sem o icone vazar da borda. Ate 359px sempre; ate 419px
// so com texto ampliado (Configuracoes > Aparencia).
const narrowStat =
  "max-[359px]:[&>div:first-child>span]:hidden [html[data-text-size]_&]:max-[419px]:[&>div:first-child>span]:hidden";

export default function DriversPage() {
  const { driverStats: slaDriverStats } = useSLADB();
  const performanceByDriver = useMemo(
    () => new Map(slaDriverStats.map((stat) => [stat.driver_id, stat.periodStats[180]])),
    [slaDriverStats],
  );
  const { roles } = useAuth();
  const canManageDrivers = roles.includes("admin") || roles.includes("fleet_manager");
  const { callOnWhatsApp, showOnMap } = useDriverQuickActions();
  const [driverBalances, setDriverBalances] = useState<Map<string, number>>(new Map());
  const { drivers: dbDrivers, isLoading: isLoadingDrivers, fetchDrivers, addDriver, updateDriver } = useDriversDB();
  const { canAddDriver, driversCount, limits, plan, planLabels, refresh: refreshPlan } = usePlanLimits();
  const [openManifestDriverIds, setOpenManifestDriverIds] = useState<Set<string>>(new Set());

  const [isNewDriverDialogOpen, setIsNewDriverDialogOpen] = useState(false);
  const [isRequestVehicleOpen, setIsRequestVehicleOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
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
  const [selectedDriver, setSelectedDriver] = useState<DriverRecord | null>(null);
  const [driverToEdit, setDriverToEdit] = useState<DriverRecord | null>(null);
  const [isEditDriverDialogOpen, setIsEditDriverDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const openNewDriver = useCallback(() => {
    if (!canAddDriver) {
      toast({ title: "Limite do plano atingido", description: `Seu plano permite até ${limits.max_drivers} motoristas.`, variant: "destructive" });
      return;
    }
    setIsNewDriverDialogOpen(true);
  }, [canAddDriver, limits.max_drivers]);

  // Ctrl K > "Cadastrar motorista" abre /drivers?action=new. O foco passa antes
  // pelo botao da tela: ao fechar a janela, ele volta para la (e nao para o topo).
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLElement>(null);
  useQueryAction("new", () => {
    newButtonRef.current?.focus();
    openNewDriver();
  });

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

  // Converte o motorista do banco para o formato Driver do contexto.
  const drivers: DriverRecord[] = useMemo(() => {
    return dbDrivers.map((d, index) => {
      const hasOpenManifest = openManifestDriverIds.has(d.id);
      const performance = performanceByDriver.get(d.id);
      const displayStatus = hasOpenManifest
        ? "in_route"
        : d.status === "in_route"
          ? "active"
          : d.status;

      return {
        id: index + 1, // Id numerico por compatibilidade
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
        _dbId: d.id, // Id do banco para as operacoes
        tenant_id: d.tenant_id,
        cnh: d.cnh,
        cnh_category: d.cnh_category,
        banco: d.banco,
        agencia: d.agencia,
        conta: d.conta,
        tipo_conta: d.tipo_conta,
        chave_pix: d.chave_pix,
        // Login interno do app (so existe quando o acesso foi criado).
        appLogin: d.user_id ? d.email || null : null,
      };
    });
  }, [dbDrivers, openManifestDriverIds, driverBalances, performanceByDriver]);

  const filteredDrivers = useMemo(() => {
    const term = fold(searchQuery.trim());
    // CPF so quando a busca parece CPF (numeros e pontuacao): antes, "ABC1D23"
    // ou qualquer texto com um numero achava todo CPF com aquele digito.
    const cpfDigits = /^[\d.\-\s]+$/.test(term) ? term.replace(/\D/g, "") : "";
    return drivers.filter((driver) => {
      const matchesStatus = filterStatus === "all" || driver.status === filterStatus;
      const matchesVehicle = filterVehicleType === "all" || driver.vehicleType === filterVehicleType;
      const matchesDriverType =
        filterDriverType === "all" ||
        (filterDriverType === "own_fleet" && driver.isOwnFleet) ||
        (filterDriverType === "third_party" && !driver.isOwnFleet);
      const matchesSearch =
        term === "" ||
        fold(driver.name).includes(term) ||
        // CPF pode estar gravado com ou sem pontuacao.
        (cpfDigits !== "" && (driver.cpf || "").replace(/\D/g, "").includes(cpfDigits)) ||
        // Placa: ignora traco e espaco ("abc-1d23" acha ABC1D23).
        (driver.vehiclePlate || "").toLowerCase().replace(/[^a-z0-9]/g, "").includes(term.replace(/[^a-z0-9]/g, "") || term);

      return matchesStatus && matchesVehicle && matchesDriverType && matchesSearch;
    });
  }, [filterStatus, filterVehicleType, filterDriverType, searchQuery, drivers]);

  const driverTypeStats = useMemo(
    () => ({
      total: drivers.length,
      ownFleet: drivers.filter((d) => d.isOwnFleet).length,
      thirdParty: drivers.filter((d) => !d.isOwnFleet).length,
    }),
    [drivers],
  );

  const totalPages = Math.ceil(filteredDrivers.length / ITEMS_PER_PAGE);
  const paginatedDrivers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDrivers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDrivers, currentPage]);

  // Contagem por situacao: active = disponivel, in_route = em rota, inactive = inativo.
  const stats = useMemo(
    () => ({
      total: drivers.length,
      available: drivers.filter((d) => d.status === "active").length,
      onRoute: drivers.filter((d) => d.status === "in_route").length,
      inactive: drivers.filter((d) => d.status === "inactive").length,
    }),
    [drivers],
  );

  useEffect(() => {
    if (!selectedDriver) return;
    const refreshedSelectedDriver = drivers.find((driver) => driver._dbId === selectedDriver._dbId);
    if (refreshedSelectedDriver && refreshedSelectedDriver !== selectedDriver) {
      setSelectedDriver(refreshedSelectedDriver);
    }
  }, [drivers, selectedDriver]);

  useEffect(() => {
    if (!driverToEdit) return;
    const refreshedDriverToEdit = drivers.find((driver) => driver._dbId === driverToEdit._dbId);
    if (refreshedDriverToEdit && refreshedDriverToEdit !== driverToEdit) {
      setDriverToEdit(refreshedDriverToEdit);
    }
  }, [drivers, driverToEdit]);

  // Trocar filtro volta para a primeira pagina.
  const changeStatus = (value: StatusFilter) => {
    setFilterStatus(value);
    setCurrentPage(1);
  };
  const changeDriverType = (value: DriverTypeFilter) => {
    setFilterDriverType(value);
    setCurrentPage(1);
  };
  const changeVehicleType = (value: string) => {
    setFilterVehicleType(value);
    setCurrentPage(1);
  };
  const changeSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };
  const hasFilters = filterStatus !== "all" || filterVehicleType !== "all" || filterDriverType !== "all" || searchQuery !== "";
  const clearFilters = () => {
    setFilterStatus("all");
    setFilterVehicleType("all");
    setFilterDriverType("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleNewDriver = useCallback(() => {
    setIsNewDriverDialogOpen(false);
    setCurrentPage(1);
    fetchDrivers();
  }, [fetchDrivers]);

  const openEdit = (driver: DriverRecord) => {
    setDriverToEdit(driver);
    setIsEditDriverDialogOpen(true);
  };

  const isFirstLoad = isLoadingDrivers && drivers.length === 0;
  const firstShown = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const lastShown = Math.min(currentPage * ITEMS_PER_PAGE, filteredDrivers.length);
  const countLabel =
    totalPages > 1
      ? `Mostrando ${firstShown}–${lastShown} de ${filteredDrivers.length.toLocaleString("pt-BR")}`
      : `${filteredDrivers.length.toLocaleString("pt-BR")} ${filteredDrivers.length === 1 ? "motorista" : "motoristas"}`;

  return (
    <>
      <PageHeader
        icon={Users}
        title="Motoristas"
        description="Cadastro, documentos, acesso ao aplicativo e desempenho de cada motorista."
        actions={
          <>
            <div className="hidden gap-2 lg:flex">
              <Button variant="outline" onClick={() => setIsImportOpen(true)} disabled={!canAddDriver}>
                <FileSpreadsheet aria-hidden="true" />
                Importar planilha
              </Button>
              <Button variant="outline" onClick={() => setIsRequestVehicleOpen(true)}>
                <Truck aria-hidden="true" />
                Pedir carro extra
              </Button>
            </div>
            <ActionMenu
              align="start"
              trigger={
                <Button variant="outline" className="lg:hidden">
                  <MoreHorizontal aria-hidden="true" />
                  Mais ações
                </Button>
              }
              items={[
                { label: "Importar planilha", icon: FileSpreadsheet, onSelect: () => setIsImportOpen(true), disabled: !canAddDriver },
                { label: "Pedir carro extra", icon: Truck, onSelect: () => setIsRequestVehicleOpen(true) },
              ]}
            />
            <Button ref={newButtonRef} onClick={openNewDriver} disabled={!canAddDriver}>
              <Plus aria-hidden="true" />
              {canAddDriver ? "Cadastrar motorista" : "Limite de motoristas atingido"}
            </Button>
          </>
        }
      />

      <div className="space-y-6 md:space-y-8">
        <PlanLimitBanner
          plan={plan}
          resourceLabel="motoristas"
          currentCount={driversCount}
          maxCount={limits.max_drivers}
          planLabels={planLabels}
        />

        {/* Indicadores que tambem filtram a lista por situacao */}
        <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <FilterStatCard
            className={narrowStat}
            label="Total"
            value={stats.total}
            icon={Users}
            tone="brand"
            loading={isFirstLoad}
            // Carregando: sem "0 CLT · 0 agregados" (o numero ainda nao chegou).
            hint={isFirstLoad ? undefined : `${driverTypeStats.ownFleet} CLT · ${driverTypeStats.thirdParty} agregados`}
            pressed={filterStatus === "all"}
            onPressedChange={() => changeStatus("all")}
          />
          <FilterStatCard
            className={narrowStat}
            label="Disponíveis"
            value={stats.available}
            icon={CheckCircle2}
            tone="success"
            loading={isFirstLoad}
            hint="Prontos para romaneio"
            pressed={filterStatus === "active"}
            onPressedChange={(on) => changeStatus(on ? "active" : "all")}
          />
          <FilterStatCard
            className={narrowStat}
            label="Em rota agora"
            value={stats.onRoute}
            icon={Route}
            tone="info"
            loading={isFirstLoad}
            hint="Com romaneio aberto"
            pressed={filterStatus === "in_route"}
            onPressedChange={(on) => changeStatus(on ? "in_route" : "all")}
          />
          <FilterStatCard
            className={narrowStat}
            label="Inativos"
            value={stats.inactive}
            icon={UserX}
            tone="neutral"
            loading={isFirstLoad}
            hint="Fora das listas de seleção"
            pressed={filterStatus === "inactive"}
            onPressedChange={(on) => changeStatus(on ? "inactive" : "all")}
          />
        </div>

        <section ref={listRef} aria-labelledby="lista-motoristas" className="space-y-4">
          <h2 id="lista-motoristas" className="sr-only">
            Lista de motoristas
          </h2>
          {/* Sem motoristas nao ha o que filtrar: a lista vazia mostra o proximo passo. */}
          {(isFirstLoad || drivers.length > 0) && (
            <FilterBar
              actions={
                <>
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {isFirstLoad ? "Carregando..." : countLabel}
                  </p>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  )}
                </>
              }
            >
              <SearchInput label="Buscar motorista" placeholder="Nome, CPF ou placa" value={searchQuery} onChange={changeSearch} className="sm:max-w-xs" />
              <SegmentedControl
                label="Tipo de motorista"
                value={filterDriverType}
                onChange={changeDriverType}
                // Contagens so depois de carregar (antes mostrava "Todos 0").
                options={[
                  { value: "all", label: "Todos", count: isFirstLoad ? undefined : driverTypeStats.total, icon: Users },
                  { value: "own_fleet", label: "CLT", count: isFirstLoad ? undefined : driverTypeStats.ownFleet, icon: Building2 },
                  { value: "third_party", label: "Agregados", count: isFirstLoad ? undefined : driverTypeStats.thirdParty, icon: Truck },
                ]}
              />
              <Select value={filterVehicleType} onValueChange={changeVehicleType}>
                <SelectTrigger className="w-full sm:w-44" aria-label="Tipo de veículo">
                  <SelectValue placeholder="Tipo de veículo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os veículos</SelectItem>
                  {DRIVER_VEHICLE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar>
          )}

          {isFirstLoad ? (
            <ListSkeleton rows={6} />
          ) : drivers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum motorista cadastrado"
              description="Cadastre o primeiro motorista ou importe uma planilha com vários de uma vez."
              action={
                <Button onClick={openNewDriver} disabled={!canAddDriver}>
                  <Plus aria-hidden="true" />
                  Cadastrar motorista
                </Button>
              }
              secondaryAction={
                <Button variant="outline" onClick={() => setIsImportOpen(true)} disabled={!canAddDriver}>
                  <FileSpreadsheet aria-hidden="true" />
                  Importar planilha
                </Button>
              }
            />
          ) : filteredDrivers.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Nenhum motorista encontrado"
              description="Tente outro nome, CPF ou placa, ou limpe os filtros para ver todos."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <>
              <DriverList
                drivers={paginatedDrivers}
                canManage={canManageDrivers}
                onOpen={setSelectedDriver}
                onEdit={openEdit}
                onWhatsApp={callOnWhatsApp}
                onShowOnMap={showOnMap}
              />
              <ListPagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  // A nova pagina comeca no alto da lista (antes ficava rolada no fim).
                  listRef.current?.scrollIntoView({ block: "start" });
                }}
              />
            </>
          )}
        </section>
      </div>

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

      <RequestVehicleWizard open={isRequestVehicleOpen} onOpenChange={setIsRequestVehicleOpen} />

      <DriverDetailSheet
        driver={selectedDriver}
        open={!!selectedDriver}
        onOpenChange={(open) => !open && setSelectedDriver(null)}
        onEditDriver={(driver) => openEdit(driver as DriverRecord)}
        onDeleteDriver={() => {
          // A linha some com o motorista: o foco vai para a linha vizinha (ou para o cadastro).
          const deletedId = selectedDriver?._dbId;
          const index = Math.max(0, paginatedDrivers.findIndex((driver) => driver._dbId === deletedId));
          setSelectedDriver(null);
          void refreshPlan();
          void Promise.resolve(fetchDrivers()).then(() =>
            window.setTimeout(() => {
              const rows = [...document.querySelectorAll<HTMLElement>("[data-driver-open]")].filter(
                (el) => el.dataset.driverOpen !== deletedId && el.getClientRects().length > 0,
              );
              (rows[Math.min(index, rows.length - 1)] ?? newButtonRef.current)?.focus();
            }, 350),
          );
        }}
        onStatusChanged={() => {
          void fetchDrivers();
        }}
      />

      <EditDriverDialog
        driver={driverToEdit}
        open={isEditDriverDialogOpen}
        onOpenChange={setIsEditDriverDialogOpen}
        onSave={async (driverToSave) => {
          const updatedDriver = driverToSave as DriverRecord;
          const driverDbId = updatedDriver._dbId;

          if (!driverDbId) {
            toast({
              title: "Não foi possível salvar",
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
            banco: updatedDriver.banco,
            agencia: updatedDriver.agencia,
            conta: updatedDriver.conta,
            tipo_conta: updatedDriver.tipo_conta,
            chave_pix: updatedDriver.chave_pix,
            updated_at: new Date().toISOString(),
          });

          if (!updatedRecord) return false;

          const refreshedDriver: DriverRecord = {
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
          };

          setDriverToEdit(refreshedDriver);
          setSelectedDriver((currentDriver) =>
            currentDriver && currentDriver._dbId === driverDbId ? refreshedDriver : currentDriver,
          );
          // O aviso de sucesso sai do updateDriver (antes eram tres avisos iguais).
          return true;
        }}
      />
    </>
  );
}
