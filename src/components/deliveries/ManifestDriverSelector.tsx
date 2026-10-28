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
import { Truck, Users, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogistics, Driver } from "@/contexts/LogisticsContext";
import { companyVehicleStore, CompanyVehicle } from "@/stores/companyVehicleStore";

export type FleetType = "third_party" | "own_fleet";

export interface ManifestDriverSelection {
  fleetType: FleetType;
  driver: Driver;
  vehicle?: CompanyVehicle; // Only for own_fleet
}

interface ManifestDriverSelectorProps {
  onSelect: (selection: ManifestDriverSelection) => void;
  onCancel: () => void;
}

export function ManifestDriverSelector({ onSelect, onCancel }: ManifestDriverSelectorProps) {
  const { drivers } = useLogistics();
  const [fleetType, setFleetType] = useState<FleetType | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  // Filter drivers based on fleet type
  const filteredDrivers = useMemo(() => {
    if (!fleetType) return [];
    
    if (fleetType === "own_fleet") {
      // Only show CLT/House drivers
      return drivers.filter(d => d.isOwnFleet && d.status !== "inactive");
    } else {
      // Only show third-party/aggregated drivers
      return drivers.filter(d => !d.isOwnFleet && d.status !== "inactive");
    }
  }, [drivers, fleetType]);

  // Get available company vehicles
  const availableVehicles = useMemo(() => {
    return companyVehicleStore.getAvailable();
  }, []);

  const selectedDriver = useMemo(() => {
    if (!selectedDriverId) return null;
    return drivers.find(d => d.id === Number(selectedDriverId));
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

  return (
    <div className="space-y-6">
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
              id="third_party"
              className="peer sr-only"
            />
            <Label
              htmlFor="third_party"
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
              id="own_fleet"
              className="peer sr-only"
            />
            <Label
              htmlFor="own_fleet"
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
      {fleetType && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <Label className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            Selecionar Motorista
            {fleetType === "own_fleet" && (
              <Badge variant="outline" className="text-xs">CLT</Badge>
            )}
          </Label>
          
          <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o motorista..." />
            </SelectTrigger>
            <SelectContent className="bg-popover max-h-[300px]">
              {filteredDrivers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum motorista {fleetType === "own_fleet" ? "CLT" : "terceiro"} disponível
                </div>
              ) : (
                filteredDrivers.map((driver) => (
                  <SelectItem key={driver.id} value={String(driver.id)}>
                    <div className="flex items-center gap-2">
                      <img
                        src={driver.photo}
                        alt={driver.name}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{driver.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {driver.cpf} • {driver.vehicleType}
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
                <span className="font-mono text-xs">{selectedDriver.cpf}</span>
              </div>
              {fleetType === "third_party" && (
                <>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Placa:</span>
                    <span className="font-mono">{selectedDriver.vehiclePlate}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Veículo:</span>
                    <span>{selectedDriver.vehicleType}</span>
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
          disabled={!canConfirm}
          className="gap-2"
        >
          <Truck className="h-4 w-4" />
          Confirmar Seleção
        </Button>
      </div>
    </div>
  );
}
