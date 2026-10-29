import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DBDriver } from "@/hooks/useDBDrivers";
import { cn } from "@/lib/utils";
import { plateText } from "@/lib/vehicles";
import { DriverAvatar } from "./DriverAvatar";

// Busca sem acento ("joao" acha "João"), CPF sem pontuacao e placa.
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const searchKeywords = (driver: DBDriver) =>
  [fold(driver.name), (driver.cpf || "").replace(/\D/g, ""), driver.vehicle_plate || ""].filter(Boolean);

interface DriverPickerProps {
  id?: string;
  drivers: DBDriver[];
  selected: DBDriver | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (driver: DBDriver) => void;
  loading?: boolean;
}

/** Campo de busca de motorista (nome ou CPF). Ocupa a largura toda no celular. */
export function DriverPicker({ id, drivers, selected, open, onOpenChange, onSelect, loading }: DriverPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={selected ? `Motorista escolhido: ${selected.name}. Trocar motorista` : "Escolher motorista"}
          disabled={loading}
          className="h-12 w-full min-w-0 justify-between px-3 font-normal sm:max-w-md"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <DriverAvatar name={selected.name} src={selected.photo || selected.avatar} className="h-8 w-8" />
              <span className="min-w-0 text-left">
                <span className="block truncate font-medium text-foreground">{selected.name}</span>
                <span className="block truncate font-data text-xs text-muted-foreground">{selected.cpf}</span>
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" aria-hidden="true" />
              {loading ? "Carregando motoristas" : "Buscar por nome ou CPF"}
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" aria-label="Escolher motorista">
        <Command>
          <CommandInput placeholder="Digite o nome ou o CPF" aria-label="Buscar motorista" />
          <CommandList>
            <CommandEmpty>Nenhum motorista encontrado. Confira o nome ou o CPF.</CommandEmpty>
            <CommandGroup>
              {drivers.map((driver) => (
                <CommandItem
                  key={driver.id}
                  value={`${driver.name} ${driver.cpf}`}
                  keywords={searchKeywords(driver)}
                  onSelect={() => onSelect(driver)}
                  className="gap-3 py-2"
                >
                  <DriverAvatar name={driver.name} src={driver.photo || driver.avatar} className="h-8 w-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{driver.name}</span>
                    <span className="block truncate font-data text-xs text-muted-foreground">
                      {[driver.cpf, plateText(driver.vehicle_plate)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <Check
                    aria-hidden="true"
                    className={cn("h-4 w-4 shrink-0 text-primary", selected?.id === driver.id ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
