import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, User, Truck, Loader2, Building2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { useDBDrivers, DBDriver } from "@/hooks/useDBDrivers";

interface DriverComboboxProps {
  value: DBDriver | null;
  onSelect: (driver: DBDriver) => void;
  fleetType?: "third_party" | "own_fleet";
}

const vehicleTypeLabels: Record<string, string> = {
  truck: "Caminhao",
  van: "VUC/Van",
  moto: "Moto",
  fiorino: "Fiorino",
  vuc: "VUC",
  toco: "Toco",
  carreta: "Carreta",
};

const formatCPF = (cpf: string) => {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return cpf;
};

const isImageSource = (value?: string | null) => {
  if (!value) return false;
  return /^(https?:\/\/|data:image\/|blob:)/i.test(value);
};

const getDriverInitials = (name?: string) => {
  if (!name) return "MT";
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "MT"
  );
};

const getDriverAvatarSrc = (driver: Pick<DBDriver, "avatar" | "photo">) => {
  if (isImageSource(driver.photo)) return driver.photo;
  if (isImageSource(driver.avatar)) return driver.avatar;
  return null;
};

export function DriverCombobox({ value, onSelect, fleetType }: DriverComboboxProps) {
  const [open, setOpen] = useState(false);
  const { availableDrivers, drivers, isLoading } = useDBDrivers();

  const filteredDrivers = useMemo(() => {
    const baseDrivers = availableDrivers;

    if (!fleetType) return baseDrivers;

    return baseDrivers.filter((driver) => {
      if (fleetType === "own_fleet") {
        return driver.is_own_fleet === true;
      }
      return driver.is_own_fleet !== true;
    });
  }, [availableDrivers, fleetType]);

  const unavailableCount = useMemo(() => {
    const total = fleetType === "own_fleet"
      ? drivers.filter((d) => d.is_own_fleet === true)
      : fleetType === "third_party"
        ? drivers.filter((d) => d.is_own_fleet !== true)
        : drivers;

    return total.filter((d) => d.hasOpenManifest).length;
  }, [drivers, fleetType]);

  const getFleetLabel = () => {
    if (!fleetType) return "Motoristas disponiveis";
    if (fleetType === "own_fleet") return "Motoristas CLT disponiveis";
    return "Motoristas agregados disponiveis";
  };

  const renderDriverAvatar = (driver: Pick<DBDriver, "avatar" | "photo" | "name">, sizeClass: string, textClass: string) => {
    const avatarSrc = getDriverAvatarSrc(driver);

    if (avatarSrc) {
      return (
        <img
          src={avatarSrc}
          alt={driver.name}
          className={cn(sizeClass, "rounded-full object-cover flex-shrink-0")}
        />
      );
    }

    return (
      <div className={cn(sizeClass, "rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0")}>
        <span className={cn(textClass, "font-semibold text-primary")}>{getDriverInitials(driver.name)}</span>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-[2.5rem] w-full justify-between py-2"
        >
          {value ? (
            <div className="flex min-w-0 items-center gap-3 text-left">
              {renderDriverAvatar(value, "h-8 w-8", "text-xs")}
              <div className="flex-1 min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate font-medium">{value.name}</p>
                  {value.is_own_fleet && (
                    <Badge variant="secondary" className="shrink-0 text-xs">CLT</Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  CPF: {formatCPF(value.cpf) || "-"} | {vehicleTypeLabels[value.vehicle_type?.toLowerCase()] || value.vehicle_type || "-"} | {value.vehicle_plate || "PENDENTE"}
                </p>
              </div>
            </div>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              {fleetType === "own_fleet" ? (
                <Building2 className="h-4 w-4" />
              ) : fleetType === "third_party" ? (
                <Users className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
              Selecionar motorista...
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[400px] max-w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por nome, CPF ou placa..." />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="py-4 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum motorista disponível.</p>
                    {unavailableCount > 0 && (
                      <p className="mt-1 text-xs text-warning">
                        {unavailableCount} motorista(s) com romaneio em aberto
                      </p>
                    )}
                    {fleetType === "own_fleet" && filteredDrivers.length === 0 && unavailableCount === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cadastre motoristas CLT em Motoristas / Novo Motorista
                      </p>
                    )}
                  </div>
                </CommandEmpty>

                <CommandGroup heading={`${getFleetLabel()} (${filteredDrivers.length})`}>
                  {filteredDrivers.map((driver) => (
                    <CommandItem
                      key={driver.id}
                      value={`${driver.name} ${driver.cpf} ${driver.vehicle_plate}`}
                      onSelect={() => {
                        onSelect(driver);
                        setOpen(false);
                      }}
                      className="py-3"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 flex-shrink-0",
                          value?.id === driver.id ? "opacity-100" : "opacity-0",
                        )}
                      />

                      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                        {renderDriverAvatar(driver, "h-9 w-9", "text-sm")}
                        <div className="flex-1 min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate font-medium">{driver.name}</p>
                            {driver.is_own_fleet && (
                              <Badge variant="secondary" className="shrink-0 text-xs">CLT</Badge>
                            )}
                          </div>

                          <div className="flex min-w-0 items-center gap-2 overflow-hidden text-xs text-muted-foreground">
                            <span className="shrink-0">{formatCPF(driver.cpf) || "-"}</span>
                            <span className="shrink-0">|</span>
                            <span className="flex min-w-0 items-center gap-1 truncate">
                              <Truck className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {vehicleTypeLabels[driver.vehicle_type?.toLowerCase()] || driver.vehicle_type || "-"}
                              </span>
                            </span>
                            <span className="shrink-0">|</span>
                            <span className="truncate font-mono">{driver.vehicle_plate || "PENDENTE"}</span>
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export type { DBDriver as ExtendedDriver };
