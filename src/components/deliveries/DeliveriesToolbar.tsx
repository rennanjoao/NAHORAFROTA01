import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FilterBar, SearchInput } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { RegionFilter } from "./RegionFilter";
import { SegmentedControl } from "./SegmentedControl";
import type { TimeFilter } from "./types";

export interface PeriodRange {
  from?: Date;
  to?: Date;
}

const PERIOD_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "daily", label: "Hoje" },
  { value: "weekly", label: "7 dias" },
  { value: "monthly", label: "30 dias" },
];

const shortDate = (date: Date) => format(date, "dd/MM/yy", { locale: ptBR });
const longDate = (date: Date) => format(date, "dd/MM/yyyy", { locale: ptBR });

export function describePeriod(range: PeriodRange) {
  if (range.from && range.to) return `${longDate(range.from)} até ${longDate(range.to)}`;
  if (range.from) return `A partir de ${longDate(range.from)}`;
  if (range.to) return `Até ${longDate(range.to)}`;
  return "";
}

interface DateRangeButtonProps {
  value: PeriodRange;
  onChange: (range: PeriodRange) => void;
  isMobile: boolean;
}

/** Botao "Escolher datas": calendario de intervalo (inicio e fim). */
function DateRangeButton({ value, onChange, isMobile }: DateRangeButtonProps) {
  const [open, setOpen] = useState(false);
  const hasRange = !!value.from || !!value.to;
  const label = value.from && value.to
    ? `${shortDate(value.from)} – ${shortDate(value.to)}`
    : value.from
      ? `Desde ${shortDate(value.from)}`
      : value.to
        ? `Até ${shortDate(value.to)}`
        : "Escolher datas";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasRange ? "soft" : "outline"}
          className="justify-start gap-2 font-medium"
          aria-label={hasRange ? `Período escolhido: ${describePeriod(value)}. Alterar datas` : "Escolher datas"}
        >
          <CalendarDays aria-hidden="true" />
          <span className="font-data">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Escolher período" align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Escolha o período</p>
          <p className="text-xs text-muted-foreground">Toque no dia inicial e depois no dia final.</p>
        </div>
        <Calendar
          mode="range"
          numberOfMonths={isMobile ? 1 : 2}
          selected={{ from: value.from, to: value.to }}
          onSelect={(range) => onChange({ from: range?.from, to: range?.to })}
          disabled={{ after: new Date() }}
          defaultMonth={value.from}
          locale={ptBR}
          initialFocus
        />
        <div className="flex items-center justify-between gap-2 border-t p-3">
          <Button variant="ghost" size="sm" onClick={() => onChange({})} disabled={!hasRange}>
            Limpar datas
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            Pronto
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DeliveriesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  timeFilter: TimeFilter;
  periodFilter: PeriodRange;
  onQuickPeriod: (value: TimeFilter) => void;
  onPeriodChange: (range: PeriodRange) => void;
  selectedRegions: string[];
  onRegionsChange: (regions: string[]) => void;
  isMobile: boolean;
}

/** Busca e filtros da lista de notas: tudo numa faixa so. */
export function DeliveriesToolbar({
  search,
  onSearchChange,
  timeFilter,
  periodFilter,
  onQuickPeriod,
  onPeriodChange,
  selectedRegions,
  onRegionsChange,
  isMobile,
}: DeliveriesToolbarProps) {
  const hasRange = !!periodFilter.from || !!periodFilter.to;

  return (
    <FilterBar>
      <SearchInput
        label="Buscar nota"
        placeholder="Número da nota, cliente ou endereço"
        value={search}
        onChange={onSearchChange}
        className="sm:max-w-xs lg:max-w-sm"
      />
      <SegmentedControl
        label="Período"
        options={PERIOD_OPTIONS}
        value={hasRange ? null : timeFilter}
        onChange={onQuickPeriod}
      />
      <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
        <DateRangeButton value={periodFilter} onChange={onPeriodChange} isMobile={isMobile} />
        <RegionFilter selectedRegions={selectedRegions} onRegionsChange={onRegionsChange} />
      </div>
    </FilterBar>
  );
}

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/** Filtros ligados, cada um com "x" para tirar. */
export function ActiveFilterChips({ chips, onClearAll }: { chips: FilterChip[]; onClearAll: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 animate-fade-in" aria-label="Filtros ligados" role="group">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          aria-label={`Tirar filtro: ${chip.label}`}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-full border bg-card pl-3 pr-2 text-sm font-medium text-foreground shadow-xs transition-colors duration-fast sm:h-8",
            "hover:border-foreground/20 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
          )}
        >
          {chip.label}
          <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      ))}
      <Button variant="link" size="sm" onClick={onClearAll} className="h-10 px-2 sm:h-8">
        Limpar filtros
      </Button>
    </div>
  );
}
