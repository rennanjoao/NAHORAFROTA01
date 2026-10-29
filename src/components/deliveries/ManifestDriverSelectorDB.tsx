/**
 * ManifestDriverSelector using real database drivers
 * Replaces the mock-data version for romaneio creation
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Truck, Users, Building2, User, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDBDrivers, DBDriver } from "@/hooks/useDBDrivers";
import { companyVehicleStore, CompanyVehicle } from "@/stores/companyVehicleStore";

export type FleetType = "third_party" | "own_fleet";

export interface ManifestDriverSelectionDB {
  fleetType: FleetType;
  driver: DBDriver;
  vehicle?: CompanyVehicle;
}

interface ManifestDriverSelectorDBProps {
  onSelect: (selection: ManifestDriverSelectionDB) => void;
  onCancel: () => void;
}

const vehicleTypeLabels: Record<string, string> = {
  truck: "Caminhão",
  van: "VUC/Van",
  moto: "Moto",
  fiorino: "Fiorino",
  vuc: "VUC",
  toco: "Toco",
  carreta: "Carreta",
};

export function ManifestDriverSelectorDB({ onSelect, onCancel }: ManifestDriverSelectorDBProps) {
  const { availableDrivers, drivers, isLoading, error, refetch } = useDBDrivers();
  const [fleetType, setFleetType] = useState<FleetType | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  // Filter AVAILABLE drivers based on fleet type (no open manifests)
  const filteredDrivers = useMemo(() => {
    if (!fleetType) return [];
    
    if (fleetType === "own_fleet") {
      return availableDrivers.filter(d => d.is_own_fleet === true);
    } else {
      return availableDrivers.filter(d => !d.is_own_fleet);
    }
  }, [availableDrivers, fleetType]);

  // Count unavailable drivers by fleet type
  const unavailableCount = useMemo(() => {
    if (!fleetType) return 0;
    
    const allOfType = fleetType === "own_fleet" 
      ? drivers.filter(d => d.is_own_fleet === true)
      : drivers.filter(d => !d.is_own_fleet);
    
    return allOfType.filter(d => d.hasOpenManifest).length;
  }, [drivers, fleetType]);

  // Get available company vehicles
  const availableVehicles = useMemo(() => {
    return companyVehicleStore.getAvailable();
  }, []);

  const selectedDriver = useMemo(() => {
    if (!selectedDriverId) return null;
    return drivers.find(d => d.id === selectedDriverId);
  }, [selectedDriverId, drivers]);

  const selectedVehicle = useMemo(() => {
    if (!selectedVehicleId) return null;
    return availableVehicles.find(v => v.id === selectedVehicleId);
  }, [selectedVehicleId, availableVehicles]);

  const canConfirm = useMemo(() => {
    if (!fleetType || !selectedDriver) return false;
    if (fleetType === "own_fleet" && !selectedVehicle) return false;
    return true;
  }, [fleetType, selectedDriver, selectedVehicle]);

  const handleConfirm = () => {
    if (!selectedDriver) return;
    
    onSelect({
      fleetType: fleetType!,
      driver: selectedDriver,
      vehicle: fleetType === "own_fleet" ? selectedVehicle ?? undefined : undefined,
    });
  };

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-destructive mb-4">Erro ao carregar motoristas: {error}</p>
        <Button variant="outline" onClick={refetch} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando motoristas...</span>
        </div>
      )}

      {/* Step 1: Fleet Type Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Quem fará a rota?
        </Label>
        
        <RadioGroup
          value={fleetType || ""}
          onValueChange={(value) => {
            setFleetType(value as FleetType);
            setSelectedDriverId("");
            setSelectedVehicleId("");
          }}
          className="grid grid-cols-2 gap-4"
        >
          <div>
            <RadioGroupItem
              value="third_party"
              id="third_party_db"
              className="peer sr-only"
            />
            <Label
              htmlFor="third_party_db"
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-all",
                "hover:border-primary/50 hover:bg-primary/5",
                fleetType === "third_party" 
                  ? "border-primary bg-primary/10" 
                  : "border-border"
              )}
            >
              <User className={cn(
                "h-8 w-8",
                fleetType === "third_party" ? "text-primary" : "text-muted-foreground"
              )} />
              <span className="font-medium">Terceiro / Agregado</span>
              <span className="text-xs text-muted-foreground text-center">
                Motorista com veículo próprio
              </span>
            </Label>
          </div>
          
          <div>
            <RadioGroupItem
              value="own_fleet"
              id="own_fleet_db"
              className="peer sr-only"
            />
            <Label
              htmlFor="own_fleet_db"
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-all",
                "hover:border-primary/50 hover:bg-primary/5",
                fleetType === "own_fleet" 
                  ? "border-primary bg-primary/10" 
                  : "border-border"
              )}
            >
              <Building2 className={cn(
                "h-8 w-8",
                fleetType === "own_fleet" ? "text-primary" : "text-muted-foreground"
              )} />
              <span className="font-medium">Frota Própria</span>
              <span className="text-xs text-muted-foreground text-center">
                Motorista CLT + Veículo da casa
              </span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Step 2: Driver Selection */}
      {fleetType && !isLoading && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Selecionar Motorista
              {fleetType === "own_fleet" && (
                <Badge variant="outline" className="text-xs">CLT</Badge>
              )}
            </Label>
            <Badge variant="secondary" className="text-xs">
              {filteredDrivers.length} disponíveis
            </Badge>
          </div>
          
          <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o motorista..." />
            </SelectTrigger>
            <SelectContent className="bg-popover max-h-[300px]">
              {filteredDrivers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <p>Nenhum motorista {fleetType === "own_fleet" ? "CLT" : "terceiro"} disponível</p>
                  {unavailableCount > 0 && (
                    <p className="text-xs text-warning mt-2">
                      {unavailableCount} motorista(s) com romaneio em aberto
                    </p>
                  )}
                </div>
              ) : (
                filteredDrivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id} className="py-2">
                    <div className="flex items-center gap-2 max-w-full overflow-hidden">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {driver.avatar?.charAt(0) || driver.name?.charAt(0) || 'M'}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium truncate max-w-[180px]">{driver.name}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {formatCPF(driver.cpf)} • {vehicleTypeLabels[driver.vehicle_type?.toLowerCase()] || driver.vehicle_type}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          
          {selectedDriver && (
            <div className="p-3 rounded-lg bg-secondary/50 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Motorista:</span>
                <span className="font-medium">{selectedDriver.name}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-muted-foreground">CPF:</span>
                <span className="font-mono text-xs">{formatCPF(selectedDriver.cpf)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-muted-foreground">Telefone:</span>
                <span className="font-mono text-xs">{selectedDriver.phone}</span>
              </div>
              {fleetType === "third_party" && (
                <>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Placa:</span>
                    <span className="font-mono">{selectedDriver.vehicle_plate}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Veículo:</span>
                    <span>{vehicleTypeLabels[selectedDriver.vehicle_type?.toLowerCase()] || selectedDriver.vehicle_type}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Vehicle Selection (Own Fleet only) */}
      {fleetType === "own_fleet" && selectedDriverId && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Selecionar Veículo da Casa
            <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
              {availableVehicles.length} disponíveis
            </Badge>
          </Label>
          
          <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o veículo..." />
            </SelectTrigger>
            <SelectContent className="bg-popover max-h-[300px]">
              {availableVehicles.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum veículo disponível no momento
                </div>
              ) : (
                availableVehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="font-medium font-mono">{vehicle.plate}</span>
                        <span className="text-xs text-muted-foreground">
                          {vehicle.brand} {vehicle.model} • {vehicle.type} • {vehicle.capacity}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          
          {selectedVehicle && (
            <div className="p-3 rounded-lg bg-secondary/50 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Placa:</span>
                <span className="font-mono font-medium">{selectedVehicle.plate}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-muted-foreground">Veículo:</span>
                <span>{selectedVehicle.brand} {selectedVehicle.model}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-muted-foreground">Tipo:</span>
                <span>{selectedVehicle.type}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-muted-foreground">Capacidade:</span>
                <span>{selectedVehicle.capacity}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          onClick={handleConfirm} 
          disabled={!canConfirm || isLoading}
          className="gap-2"
        >
          <Truck className="h-4 w-4" />
          Confirmar Seleção
        </Button>
      </div>
    </div>
  );
}
