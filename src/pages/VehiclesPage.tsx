import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Plus,
  Truck,
  CheckCircle,
  Wrench,
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle,
  Building2,
  User,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitBanner } from "@/components/plan/PlanLimitBanner";
import { 
  companyVehicleStore, 
  CompanyVehicle, 
  CompanyVehicleType, 
  VehicleStatus 
} from "@/stores/companyVehicleStore";

const VEHICLE_TYPES: CompanyVehicleType[] = ["Fiorino", "VUC", "Toco", "Truck", "Carreta", "Van"];

const statusConfig: Record<VehicleStatus, { label: string; className: string; icon: typeof CheckCircle }> = {
  available: { label: "Disponível", className: "bg-success/20 text-success border-success/30", icon: CheckCircle },
  in_use: { label: "Em Uso", className: "bg-primary/20 text-primary border-primary/30", icon: Truck },
  maintenance: { label: "Manutenção", className: "bg-warning/20 text-warning border-warning/30", icon: Wrench },
};

const capacityByType: Record<CompanyVehicleType, string> = {
  Fiorino: "650kg",
  VUC: "3.5t",
  Toco: "8t",
  Truck: "15t",
  Carreta: "25t",
  Van: "1.5t",
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<CompanyVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { canAddVehicle, vehiclesCount, limits, plan, planLabels, isLoading: planLoading } = usePlanLimits();
  const [isSaving, setIsSaving] = useState(false);
  const [isNewVehicleDialogOpen, setIsNewVehicleDialogOpen] = useState(false);
  const [isEditVehicleDialogOpen, setIsEditVehicleDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<CompanyVehicle | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // New vehicle form state
  const [newVehicle, setNewVehicle] = useState({
    plate: "",
    model: "",
    brand: "",
    type: "" as CompanyVehicleType | "",
    year: new Date().getFullYear(),
    renavam: "",
  });

  // Load vehicles from database
  useEffect(() => {
    const loadVehicles = async () => {
      setIsLoading(true);
      try {
        const data = await companyVehicleStore.getAllAsync();
        setVehicles(data);
      } catch (error) {
        console.error("Error loading vehicles:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadVehicles();
    
    // Subscribe to store changes
    const unsubscribe = companyVehicleStore.subscribe(() => {
      setVehicles(companyVehicleStore.getAll());
    });
    return unsubscribe;
  }, []);

  // Stats
  const stats = useMemo(() => companyVehicleStore.getStats(), [vehicles]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchesStatus = filterStatus === "all" || v.status === filterStatus;
      const matchesType = filterType === "all" || v.type === filterType;
      const matchesSearch = 
        searchQuery === "" || 
        v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.brand.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [vehicles, filterStatus, filterType, searchQuery]);

  const handleNewVehicle = async () => {
    if (!newVehicle.plate || !newVehicle.model || !newVehicle.brand || !newVehicle.type) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await companyVehicleStore.add({
        plate: newVehicle.plate.toUpperCase(),
        model: newVehicle.model,
        brand: newVehicle.brand,
        type: newVehicle.type as CompanyVehicleType,
        status: "available",
        capacity: capacityByType[newVehicle.type as CompanyVehicleType],
        year: newVehicle.year,
        renavam: newVehicle.renavam,
      });

      toast({
        title: "✅ Veículo Cadastrado!",
        description: `${newVehicle.plate} foi adicionado à frota e salvo no banco de dados.`,
      });

      setNewVehicle({ plate: "", model: "", brand: "", type: "", year: new Date().getFullYear(), renavam: "" });
      setIsNewVehicleDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Não foi possível cadastrar o veículo.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditVehicle = async () => {
    if (!selectedVehicle) return;

    setIsSaving(true);
    try {
      await companyVehicleStore.update(selectedVehicle.id, {
        plate: newVehicle.plate.toUpperCase() || selectedVehicle.plate,
        model: newVehicle.model || selectedVehicle.model,
        brand: newVehicle.brand || selectedVehicle.brand,
        type: (newVehicle.type as CompanyVehicleType) || selectedVehicle.type,
        year: newVehicle.year || selectedVehicle.year,
        renavam: newVehicle.renavam || selectedVehicle.renavam,
      });

      toast({
        title: "✅ Veículo Atualizado!",
        description: `${selectedVehicle.plate} foi atualizado no banco de dados.`,
      });

      setIsEditVehicleDialogOpen(false);
      setSelectedVehicle(null);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o veículo.",
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
      const success = await companyVehicleStore.delete(selectedVehicle.id);
      
      if (success) {
        toast({
          title: "🗑️ Veículo Removido",
          description: `${selectedVehicle.plate} foi removido da frota e do banco de dados.`,
        });
      } else {
        throw new Error("Não foi possível remover o veículo");
      }

      setIsDeleteDialogOpen(false);
      setSelectedVehicle(null);
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message || "Não foi possível remover o veículo.",
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
          title: "Veículo Disponível",
          description: `${vehicle.plate} voltou a ficar disponível.`,
        });
      } else {
        await companyVehicleStore.setMaintenance(vehicle.id);
        toast({
          title: "Em Manutenção",
          description: `${vehicle.plate} foi enviado para manutenção.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do veículo.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (vehicle: CompanyVehicle) => {
    setSelectedVehicle(vehicle);
    setNewVehicle({
      plate: vehicle.plate,
      model: vehicle.model,
      brand: vehicle.brand,
      type: vehicle.type,
      year: vehicle.year || new Date().getFullYear(),
      renavam: vehicle.renavam || "",
    });
    setIsEditVehicleDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Veículos da Casa
            </h1>
            <p className="text-muted-foreground">Gerencie a frota própria da empresa</p>
          </div>
          <Button 
            className="bg-primary hover:bg-primary/90 btn-neon" 
            disabled={!canAddVehicle}
            onClick={() => {
              if (!canAddVehicle) {
                toast({ title: "Limite atingido", description: `Seu plano permite até ${limits.max_vehicles} veículos.`, variant: "destructive" });
                return;
              }
              setNewVehicle({ plate: "", model: "", brand: "", type: "", year: new Date().getFullYear(), renavam: "" });
              setIsNewVehicleDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Veículo
          </Button>
        </div>

        {/* Plan Limit Banner */}
        <PlanLimitBanner
          plan={plan}
          resourceLabel="veículos"
          currentCount={vehiclesCount}
          maxCount={limits.max_vehicles}
          planLabels={planLabels}
        />

        {/* Info Banner */}
        <div className="p-4 rounded-lg bg-info/10 border border-info/20 flex items-start gap-3">
          <Building2 className="h-5 w-5 text-info mt-0.5" />
          <div>
            <p className="font-medium text-info">Frota Própria</p>
            <p className="text-sm text-muted-foreground">
              Veículos cadastrados aqui ficam disponíveis para motoristas CLT durante a montagem de romaneios.
              Motoristas terceiros/agregados utilizam seus próprios veículos.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Total da Frota</p>
            <p className="text-2xl font-bold font-heading">{stats.total}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Disponíveis</p>
            <p className="text-2xl font-bold text-success font-heading">{stats.available}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Em Uso</p>
            <p className="text-2xl font-bold text-primary font-heading">{stats.inUse}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Manutenção</p>
            <p className="text-2xl font-bold text-warning font-heading">{stats.maintenance}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar por placa, modelo ou marca..." 
              className="pl-10 bg-secondary border-0" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {VEHICLE_TYPES.map((vt) => (
                <SelectItem key={vt} value={vt}>{vt}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="available">Disponíveis</SelectItem>
              <SelectItem value="in_use">Em Uso</SelectItem>
              <SelectItem value="maintenance">Manutenção</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Vehicle Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando veículos...</span>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Nenhum veículo encontrado.
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const status = statusConfig[vehicle.status];
              const StatusIcon = status.icon;

              return (
                <div
                  key={vehicle.id}
                  className="glass-card rounded-xl p-5 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-secondary p-3">
                        <Truck className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold font-mono">{vehicle.plate}</p>
                        <p className="text-sm text-muted-foreground">{vehicle.brand} {vehicle.model}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("flex items-center gap-1", status.className)}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => openEditDialog(vehicle)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSetMaintenance(vehicle)}>
                            <Wrench className="h-4 w-4 mr-2" />
                            {vehicle.status === "maintenance" ? "Liberar Manutenção" : "Enviar p/ Manutenção"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedVehicle(vehicle);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tipo</span>
                      <span>{vehicle.type}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Capacidade</span>
                      <span>{vehicle.capacity}</span>
                    </div>
                    {vehicle.year && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Ano</span>
                        <span>{vehicle.year}</span>
                      </div>
                    )}
                    {vehicle.currentDriverName && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Motorista
                        </span>
                        <span className="font-medium">{vehicle.currentDriverName}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* New Vehicle Dialog */}
      <Dialog open={isNewVehicleDialogOpen} onOpenChange={setIsNewVehicleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Cadastrar Veículo da Casa
            </DialogTitle>
            <DialogDescription>
              Adicione um novo veículo à frota própria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Placa *</Label>
              <Input 
                placeholder="ABC1D23" 
                value={newVehicle.plate}
                onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })}
                maxLength={7}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca *</Label>
                <Input 
                  placeholder="Ex: Volkswagen" 
                  value={newVehicle.brand}
                  onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Modelo *</Label>
                <Input 
                  placeholder="Ex: Delivery Express" 
                  value={newVehicle.model}
                  onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Veículo *</Label>
                <Select 
                  value={newVehicle.type} 
                  onValueChange={(v) => setNewVehicle({ ...newVehicle, type: v as CompanyVehicleType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {VEHICLE_TYPES.map((vt) => (
                      <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input 
                  type="number"
                  placeholder="2024" 
                  value={newVehicle.year}
                  onChange={(e) => setNewVehicle({ ...newVehicle, year: parseInt(e.target.value) || new Date().getFullYear() })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>RENAVAM</Label>
              <Input 
                placeholder="Número do RENAVAM" 
                value={newVehicle.renavam}
                onChange={(e) => setNewVehicle({ ...newVehicle, renavam: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewVehicleDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleNewVehicle} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Cadastrar Veículo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Vehicle Dialog */}
      <Dialog open={isEditVehicleDialogOpen} onOpenChange={setIsEditVehicleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Veículo
            </DialogTitle>
            <DialogDescription>
              Atualize os dados do veículo {selectedVehicle?.plate}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Placa *</Label>
              <Input 
                placeholder="ABC1D23" 
                value={newVehicle.plate}
                onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })}
                maxLength={7}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca *</Label>
                <Input 
                  placeholder="Ex: Volkswagen" 
                  value={newVehicle.brand}
                  onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Modelo *</Label>
                <Input 
                  placeholder="Ex: Delivery Express" 
                  value={newVehicle.model}
                  onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Veículo *</Label>
                <Select 
                  value={newVehicle.type} 
                  onValueChange={(v) => setNewVehicle({ ...newVehicle, type: v as CompanyVehicleType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {VEHICLE_TYPES.map((vt) => (
                      <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input 
                  type="number"
                  placeholder="2024" 
                  value={newVehicle.year}
                  onChange={(e) => setNewVehicle({ ...newVehicle, year: parseInt(e.target.value) || new Date().getFullYear() })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>RENAVAM</Label>
              <Input 
                placeholder="Número do RENAVAM" 
                value={newVehicle.renavam}
                onChange={(e) => setNewVehicle({ ...newVehicle, renavam: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditVehicleDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleEditVehicle} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Remover Veículo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o veículo <strong>{selectedVehicle?.plate}</strong> da frota?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteVehicle}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                "Remover Veículo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
