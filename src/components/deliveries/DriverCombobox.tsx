import { useState, useMemo } from "react";
import { brandAvatar } from "@/lib/avatar";
import { Check, ChevronsUpDown, User, Truck, Building2, Users } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useDBDrivers, DBDriver } from "@/hooks/useDBDrivers";
import { plateText, vehicleTypeLabel } from "./status";

interface DriverComboboxProps {
  value: DBDriver | null;
  onSelect: (driver: DBDriver) => void;
  fleetType?: "third_party" | "own_fleet";
  /** Liga o campo ao <Label htmlFor>. */
  id?: string;
  /** Campo com erro (borda vermelha + aria-invalid). */
  invalid?: boolean;
  /** Id do texto de ajuda/erro abaixo do campo. */
  describedBy?: string;
}

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

/** Foto do motorista ou iniciais (mesmo desenho em toda a tela de entregas). */
export function DriverAvatar({
  driver,
  className = "h-9 w-9",
  textClassName = "text-sm",
}: {
  driver: Pick<DBDriver, "avatar" | "photo" | "name">;
  className?: string;
  textClassName?: string;
}) {
  const avatarSrc = getDriverAvatarSrc(driver);
  if (avatarSrc) {
    return <img src={brandAvatar(avatarSrc)} alt="" className={cn(className, "shrink-0 rounded-full object-cover")} />;
  }
  return (
    <span aria-hidden="true" className={cn(className, "flex shrink-0 items-center justify-center rounded-full bg-primary/10")}>
      <span className={cn(textClassName, "font-semibold text-primary")}>{getDriverInitials(driver.name)}</span>
    </span>
  );
}

export function DriverCombobox({ value, onSelect, fleetType, id, invalid, describedBy }: DriverComboboxProps) {
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
    if (!fleetType) return "Motoristas livres";
    if (fleetType === "own_fleet") return "Motoristas CLT livres";
    return "Motoristas agregados livres";
  };

  const PlaceholderIcon = fleetType === "own_fleet" ? Building2 : fleetType === "third_party" ? Users : User;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-auto min-h-12 w-full justify-between py-2 text-left font-normal",
            invalid && "border-destructive",
          )}
        >
          {value ? (
            <span className="flex min-w-0 items-center gap-3">
              <DriverAvatar driver={value} className="h-8 w-8" textClassName="text-xs" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-foreground">{value.name}</span>
                  {value.is_own_fleet && <Badge variant="secondary" className="shrink-0">CLT</Badge>}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {vehicleTypeLabel(value.vehicle_type)} · {plateText(value.vehicle_plate) || "sem placa"}
                </span>
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <PlaceholderIcon className="h-4 w-4" aria-hidden="true" />
              Escolher motorista
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>

      <PopoverContent aria-label="Escolher motorista" className="w-[var(--radix-popover-trigger-width)] min-w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por nome, CPF ou placa" />
          <CommandList>
            {isLoading ? (
              <div className="space-y-2 p-3" role="status" aria-label="Carregando motoristas">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="px-4 py-4 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum motorista livre.</p>
                    {unavailableCount > 0 && (
                      <p className="mt-1 text-xs text-warning">
                        {unavailableCount} motorista(s) com romaneio em aberto
                      </p>
                    )}
                    {fleetType === "own_fleet" && filteredDrivers.length === 0 && unavailableCount === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cadastre motoristas CLT em Motoristas &gt; Cadastrar motorista
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
                      className="gap-3 py-2.5"
                    >
                      <Check
                        className={cn("h-4 w-4 shrink-0 text-primary", value?.id === driver.id ? "opacity-100" : "opacity-0")}
                        aria-hidden="true"
                      />
                      <DriverAvatar driver={driver} />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium">{driver.name}</span>
                          {driver.is_own_fleet && <Badge variant="secondary" className="shrink-0">CLT</Badge>}
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="shrink-0 font-data">{formatCPF(driver.cpf) || "Sem CPF"}</span>
                          <span aria-hidden="true">·</span>
                          <Truck className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{vehicleTypeLabel(driver.vehicle_type)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate font-data">{plateText(driver.vehicle_plate) || "sem placa"}</span>
                        </span>
                      </span>
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
