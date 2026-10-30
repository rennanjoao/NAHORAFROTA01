import { useState, useMemo, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Plus, Route, SearchX, Truck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardsSkeleton, ConfirmDialog, EmptyState, FilterBar, PageHeader, SearchInput } from "@/components/patterns";
import { FilterStatCard } from "@/components/patterns/FilterStatCard";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { VehicleFormDialog } from "@/components/vehicles/VehicleFormDialog";
import { COMPANY_VEHICLE_TYPES, emptyVehicleForm, type VehicleFormValues } from "@/components/vehicles/vehicleConfig";
import { OFFLINE_MESSAGE, plainError } from "@/components/drivers/driverConfig";
import { useReturnFocusOnClose } from "@/hooks/useReturnFocus";
import { PlanLimitBanner } from "@/components/plan/PlanLimitBanner";
import { toast } from "@/hooks/use-toast";
import { useQueryAction } from "@/hooks/useQueryAction";
import { useUrlSearchTerm } from "@/hooks/useUrlSearchTerm";
import { usePlanLimits, invalidatePlanStatus } from "@/hooks/usePlanLimits";
import { useQueryClient } from "@tanstack/react-query";
import {
  companyVehicleStore,
  CompanyVehicle,
  CompanyVehicleType,
  VehicleStatus,
  vehicleCapacityByType,
} from "@/stores/companyVehicleStore";

const capacityByType = vehicleCapacityByType;

type StatusFilter = "all" | VehicleStatus;

// Erro do banco em linguagem simples (placa repetida vinha como "duplicate key value...").
// Sem internet o store acusava "Sessão inválida. Faça login novamente." (enganoso): plainError trata.
function friendlyVehicleError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (navigator.onLine && /duplicate key|unique|já existe/i.test(message)) {
    return "Já existe um veículo com esta placa. Confira a placa e tente de novo.";
  }
  return plainError(error, fallback);
}

// Busca sem acento, sem caixa e sem traco na placa ("abc-1d23" acha ABC1D23).
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Celular estreito: o icone decorativo sai do cartao para o rotulo ("Disponíveis",
// "Em manutenção") caber sem o icone vazar da borda. Ate 359px sempre; ate 419px
// so com texto ampliado (Configuracoes > Aparencia).
const narrowStat =
  "max-[359px]:[&>div:first-child>span]:hidden [html[data-text-size]_&]:max-[419px]:[&>div:first-child>span]:hidden";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<CompanyVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { canAddVehicle, vehiclesCount, limits, plan, planLabels } = usePlanLimits();
  const queryClient = useQueryClient();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formMode, setFormMode] = useState<"new" | "edit">("new");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<VehicleFormValues>(emptyVehicleForm);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<CompanyVehicle | null>(null);
  const captureDeleteFocus = useReturnFocusOnClose(isDeleteDialogOpen);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  useUrlSearchTerm((term) => {
    setSearchQuery(term);
    setFilterStatus("all");
    setFilterType("all");
  });

  const openNewVehicle = () => {
    if (!canAddVehicle) {
      toast({ title: "Limite do plano atingido", description: `Seu plano permite até ${limits.max_vehicles} veículos.`, variant: "destructive" });
      return;
    }
    setSelectedVehicle(null);
    setFormMode("new");
    setFormInitial(emptyVehicleForm());
    setIsFormOpen(true);
  };

  // Ctrl K > "Cadastrar veiculo" abre /vehicles?action=new. O foco passa antes
  // pelo botao da tela: ao fechar a janela, ele volta para la (e nao para o topo).
  const newButtonRef = useRef<HTMLButtonElement>(null);
  useQueryAction("new", () => {
    newButtonRef.current?.focus();
    openNewVehicle();
  });

  // O cartao removido levava o foco junto: passa para o cartao vizinho (ou para o cadastro).
  const focusVehicleAt = (index: number) => {
    window.setTimeout(() => {
      const cards = [...document.querySelectorAll<HTMLElement>("[data-vehicle-open]")];
      (cards[Math.min(index, cards.length - 1)] ?? newButtonRef.current)?.focus();
    }, 50);
  };

  const loadVehicles = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await companyVehicleStore.initialize();
      setVehicles(data);
    } catch (error) {
      console.error("Error loading vehicles:", error);
      // Mensagem simples na tela; o detalhe tecnico fica no console.
      setLoadError(
        typeof navigator !== "undefined" && !navigator.onLine
          ? OFFLINE_MESSAGE
          : "Tente de novo em instantes. Se continuar, fale com o suporte.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Carrega do banco e acompanha as mudancas do store.
  useEffect(() => {
    loadVehicles();

    const unsubscribe = companyVehicleStore.subscribe(() => {
      setVehicles(companyVehicleStore.getAll());
    });
    return unsubscribe;
  }, []);

  const stats = useMemo(
    () => ({
      total: vehicles.length,
      available: vehicles.filter((v) => v.status === "available").length,
      inUse: vehicles.filter((v) => v.status === "in_use").length,
      maintenance: vehicles.filter((v) => v.status === "maintenance").length,
    }),
    [vehicles],
  );

  const filteredVehicles = useMemo(() => {
    const term = fold(searchQuery.trim());
    const plateTerm = term.replace(/[^a-z0-9]/g, "");
    return vehicles.filter((v) => {
      const matchesStatus = filterStatus === "all" || v.status === filterStatus;
      const matchesType = filterType === "all" || v.type === filterType;
      const matchesSearch =
        term === "" ||
        (plateTerm !== "" && v.plate.toLowerCase().includes(plateTerm)) ||
        fold(v.model).includes(term) ||
        fold(v.brand).includes(term) ||
        fold(`${v.brand} ${v.model}`).includes(term);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [vehicles, filterStatus, filterType, searchQuery]);

  const hasFilters = filterStatus !== "all" || filterType !== "all" || searchQuery !== "";
  const clearFilters = () => {
    setFilterStatus("all");
    setFilterType("all");
    setSearchQuery("");
  };

  const handleNewVehicle = async (values: VehicleFormValues, year: number | undefined) => {
    setIsSaving(true);
    try {
      await companyVehicleStore.add({
        plate: values.plate.trim().toUpperCase(),
        model: values.model.trim(),
        brand: values.brand.trim(),
        type: values.type as CompanyVehicleType,
        status: "available",
        capacity: capacityByType[values.type as CompanyVehicleType],
        year,
        renavam: values.renavam.trim() || undefined,
        photoUrl: values.photoUrl || undefined,
      });
      invalidatePlanStatus(queryClient);

      toast({
        title: "Veículo cadastrado",
        description: `${values.plate} entrou na frota.`,
      });

      setIsFormOpen(false);
    } catch (error) {
      toast({
        title: "Não foi possível cadastrar",
        description: friendlyVehicleError(error, "Confira a placa e tente de novo."),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditVehicle = async (values: VehicleFormValues, year: number | undefined) => {
    if (!selectedVehicle) return;

    setIsSaving(true);
    try {
      const type = values.type as CompanyVehicleType;
      await companyVehicleStore.update(selectedVehicle.id, {
        plate: values.plate.trim().toUpperCase(),
        model: values.model.trim(),
        brand: values.brand.trim(),
        type,
        // Capacidade segue o tipo: trocar Van por Truck mantinha "1.5t".
        ...(type !== selectedVehicle.type ? { capacity: capacityByType[type] } : {}),
        year: year ?? null,
        renavam: values.renavam.trim() || null,
        photoUrl: values.photoUrl || null,
      });

      toast({
        title: "Veículo atualizado",
        description: `${selectedVehicle.plate} foi atualizado.`,
      });

      setIsFormOpen(false);
      setSelectedVehicle(null);
    } catch (error) {
      toast({
        title: "Não foi possível salvar",
        description: friendlyVehicleError(error, "Confira os dados e tente de novo."),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!selectedVehicle) return;

    setIsSaving(true);
    try {
      if (selectedVehicle.status === "in_use") {
        throw new Error(
          `${selectedVehicle.plate} está com ${selectedVehicle.currentDriverName || "um motorista"} agora. Ele fica livre quando a rota terminar; remova depois disso.`,
        );
      }

      const index = filteredVehicles.findIndex((vehicle) => vehicle.id === selectedVehicle.id);
      await companyVehicleStore.delete(selectedVehicle.id);
      invalidatePlanStatus(queryClient);
      focusVehicleAt(Math.max(0, index));
      toast({
        title: "Veículo removido",
        description: `${selectedVehicle.plate} saiu da frota.`,
      });

      setIsDeleteDialogOpen(false);
      setSelectedVehicle(null);
    } catch (error) {
      // Como antes: fecha a confirmacao e explica o motivo no aviso.
      setIsDeleteDialogOpen(false);
      toast({
        title: "Não foi possível remover",
        description: friendlyVehicleError(error, "Tente de novo em instantes."),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetMaintenance = async (vehicle: CompanyVehicle) => {
    try {
      if (vehicle.status === "maintenance") {
        await companyVehicleStore.update(vehicle.id, { status: "available" });
        toast({
          title: "Veículo disponível",
          description: `${vehicle.plate} voltou a ficar disponível.`,
        });
      } else {
        // setMaintenance devolve false em vez de lancar: antes o aviso de sucesso saia mesmo com erro.
        const done = await companyVehicleStore.setMaintenance(vehicle.id);
        if (!done) throw new Error("Não foi possível enviar para manutenção. Tente de novo em instantes.");
        toast({
          title: "Veículo em manutenção",
          description: `${vehicle.plate} foi enviado para manutenção.`,
        });
      }
    } catch (error) {
      toast({
        title: "Não foi possível alterar a situação",
        description: friendlyVehicleError(error, "Tente de novo em instantes."),
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (vehicle: CompanyVehicle) => {
    setSelectedVehicle(vehicle);
    setFormMode("edit");
    setFormInitial({
      plate: vehicle.plate,
      model: vehicle.model,
      brand: vehicle.brand,
      type: vehicle.type,
      year: vehicle.year ? String(vehicle.year) : "",
      renavam: vehicle.renavam || "",
      photoUrl: vehicle.photoUrl || "",
    });
    setIsFormOpen(true);
  };

  const openDeleteDialog = (vehicle: CompanyVehicle) => {
    captureDeleteFocus();
    setSelectedVehicle(vehicle);
    setIsDeleteDialogOpen(true);
  };

  const toggleStatus = (status: VehicleStatus) => (on: boolean) => setFilterStatus(on ? status : "all");
  const isFirstLoad = isLoading && vehicles.length === 0;

  return (
    <>
      <PageHeader
        icon={Truck}
        title="Veículos"
        description="Veículos da empresa, usados pelos motoristas da casa (CLT) nos romaneios. Agregados usam o próprio veículo."
        actions={
          <Button ref={newButtonRef} onClick={openNewVehicle} disabled={!canAddVehicle}>
            <Plus aria-hidden="true" />
            Cadastrar veículo
          </Button>
        }
      />

      <div className="space-y-6 md:space-y-8">
        <PlanLimitBanner
          plan={plan}
          resourceLabel="veículos"
          currentCount={vehiclesCount}
          maxCount={limits.max_vehicles}
          planLabels={planLabels}
        />

        {/* Indicadores que tambem filtram a lista por situacao */}
        <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <FilterStatCard
            className={narrowStat}
            label="Total"
            value={stats.total}
            icon={Truck}
            tone="brand"
            loading={isFirstLoad}
            hint="Veículos da frota"
            pressed={filterStatus === "all"}
            onPressedChange={() => setFilterStatus("all")}
          />
          <FilterStatCard
            className={narrowStat}
            label="Disponíveis"
            value={stats.available}
            icon={CheckCircle2}
            tone="success"
            loading={isFirstLoad}
            hint="Livres para a próxima rota"
            pressed={filterStatus === "available"}
            onPressedChange={toggleStatus("available")}
          />
          <FilterStatCard
            className={narrowStat}
            label="Em uso"
            value={stats.inUse}
            icon={Route}
            tone="info"
            loading={isFirstLoad}
            hint="Com um motorista agora"
            pressed={filterStatus === "in_use"}
            onPressedChange={toggleStatus("in_use")}
          />
          <FilterStatCard
            className={narrowStat}
            label="Em manutenção"
            value={stats.maintenance}
            icon={Wrench}
            tone="warning"
            loading={isFirstLoad}
            hint="Fora de uso por enquanto"
            pressed={filterStatus === "maintenance"}
            onPressedChange={toggleStatus("maintenance")}
          />
        </div>

        <section aria-labelledby="lista-veiculos" className="space-y-4">
          <h2 id="lista-veiculos" className="sr-only">
            Lista de veículos
          </h2>
          {/* Sem veiculos nao ha o que filtrar: a lista vazia mostra o proximo passo. */}
          {(isFirstLoad || vehicles.length > 0) && (
            <FilterBar
              actions={
                <>
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {isFirstLoad
                      ? "Carregando..."
                      : `${filteredVehicles.length.toLocaleString("pt-BR")} ${filteredVehicles.length === 1 ? "veículo" : "veículos"}`}
                  </p>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  )}
                </>
              }
            >
              <SearchInput label="Buscar veículo" placeholder="Placa, marca ou modelo" value={searchQuery} onChange={setSearchQuery} className="sm:max-w-xs" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-44" aria-label="Tipo de veículo">
                  <SelectValue placeholder="Tipo de veículo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {COMPANY_VEHICLE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar>
          )}

          {isFirstLoad ? (
            <CardsSkeleton count={3} className="sm:grid-cols-2 xl:grid-cols-3" />
          ) : loadError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Não foi possível carregar os veículos"
              description={loadError}
              action={
                <Button variant="outline" onClick={loadVehicles}>
                  Tentar de novo
                </Button>
              }
            />
          ) : vehicles.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Nenhum veículo cadastrado"
              description="Cadastre os veículos da empresa para os motoristas da casa usarem nas rotas."
              action={
                <Button onClick={openNewVehicle} disabled={!canAddVehicle}>
                  <Plus aria-hidden="true" />
                  Cadastrar veículo
                </Button>
              }
            />
          ) : filteredVehicles.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Nenhum veículo encontrado"
              description="Tente outra placa, marca ou modelo, ou limpe os filtros para ver todos."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <ul className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Veículos">
              {filteredVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  onEdit={openEditDialog}
                  onToggleMaintenance={handleSetMaintenance}
                  onRemove={openDeleteDialog}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <VehicleFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        mode={formMode}
        initialValues={formInitial}
        saving={isSaving}
        onSubmit={formMode === "new" ? handleNewVehicle : handleEditVehicle}
      />

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        tone="danger"
        title={`Remover o veículo ${selectedVehicle?.plate ?? ""}?`}
        description="O veículo sai da frota. Não dá para desfazer."
        confirmLabel={isSaving ? "Removendo..." : "Remover veículo"}
        loading={isSaving}
        onConfirm={handleDeleteVehicle}
      />
    </>
  );
}
