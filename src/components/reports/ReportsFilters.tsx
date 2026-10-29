import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CUSTOM_PRESET,
  datePresets,
  matchPreset,
  operationTypes,
  type FilterState,
  type ReportFilterOption,
  type ReportFilterOptions,
} from "./reportFilterState";

export type { FilterState, ReportFilterOption, ReportFilterOptions } from "./reportFilterState";

interface ReportsFiltersProps {
  filters: FilterState;
  options: ReportFilterOptions;
  onFiltersChange: (filters: FilterState) => void;
  onClearFilters: () => void;
}

const fmt = (date?: Date) => (date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "");

/** Periodo + filtros (cliente, regiao, motorista, operacao). Todos os graficos acompanham. */
export function ReportsFilters({ filters, options, onFiltersChange, onClearFilters }: ReportsFiltersProps) {
  const [customMode, setCustomMode] = useState(() => matchPreset(filters.dateRange) === CUSTOM_PRESET);
  const [showMore, setShowMore] = useState(false);
  const preset = customMode ? CUSTOM_PRESET : matchPreset(filters.dateRange);

  const entityFilters: { key: "client" | "route" | "driver" | "operationType"; label: string; items: ReportFilterOption[] }[] = [
    { key: "client", label: "Cliente", items: [{ id: "all", name: "Todos os clientes" }, ...options.clients] },
    { key: "route", label: "Região", items: [{ id: "all", name: "Todas as regiões" }, ...options.routes] },
    { key: "driver", label: "Motorista", items: [{ id: "all", name: "Todos os motoristas" }, ...options.drivers] },
    { key: "operationType", label: "Operação", items: operationTypes },
  ];

  const activeFiltersCount = entityFilters.filter((f) => filters[f.key] !== "all").length;

  const handleDateRangeChange = (newRange: { from: Date | undefined; to: Date | undefined }) => {
    onFiltersChange({ ...filters, dateRange: newRange });
  };

  const handlePreset = (value: string) => {
    if (value === CUSTOM_PRESET) {
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    const found = datePresets.find((p) => p.id === value);
    if (found) handleDateRangeChange(found.getValue());
  };

  const dateButton = (which: "from" | "to") => {
    const value = filters.dateRange[which];
    const label = which === "from" ? "De" : "Até";
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start font-normal sm:w-[11rem]", !value && "text-muted-foreground")}
            aria-label={`${which === "from" ? "Data inicial" : "Data final"}${value ? `: ${fmt(value)}` : ""}`}
          >
            <CalendarDays className="text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">{label}</span>
            <span className="font-data">{value ? fmt(value) : "escolher"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => handleDateRangeChange({ ...filters.dateRange, [which]: date })}
            disabled={(date) =>
              date > new Date() ||
              (which === "from"
                ? Boolean(filters.dateRange.to && date > filters.dateRange.to)
                : Boolean(filters.dateRange.from && date < filters.dateRange.from))
            }
            initialFocus
            locale={ptBR}
            className="pointer-events-auto p-3"
          />
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div
      role="search"
      aria-label="Filtros do relatório"
      className="rounded-lg border bg-card p-3 shadow-sm sm:p-4 lg:sticky lg:top-[calc(var(--topbar-height)+0.75rem)] lg:z-20"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        {/* Periodo */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2">
            <Label htmlFor="reports-period" className="shrink-0 text-muted-foreground">
              Período
            </Label>
            <Select value={preset} onValueChange={handlePreset}>
              <SelectTrigger id="reports-period" className="w-full sm:w-[13rem] [&>span]:flex-1">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {datePresets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_PRESET}>Escolher datas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === CUSTOM_PRESET && (
            <div className="grid grid-cols-2 gap-2 animate-fade-in sm:flex">
              {dateButton("from")}
              {dateButton("to")}
            </div>
          )}
        </div>

        {/* Mais filtros: no celular ficam recolhidos */}
        <Button
          variant="outline"
          className="justify-between lg:hidden"
          aria-expanded={showMore}
          aria-controls="reports-more-filters"
          onClick={() => setShowMore((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal aria-hidden="true" />
            {showMore ? "Esconder filtros" : "Mais filtros"}
          </span>
          {activeFiltersCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 font-data text-xs text-primary-foreground">
              {activeFiltersCount}
              <span className="sr-only"> ativo{activeFiltersCount > 1 ? "s" : ""}</span>
            </span>
          )}
        </Button>

        <div
          id="reports-more-filters"
          className={cn(
            "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-2",
            showMore ? "animate-fade-in" : "hidden lg:flex",
          )}
        >
          {entityFilters.map((filter) => (
            <Select
              key={filter.key}
              value={filters[filter.key]}
              onValueChange={(value) => onFiltersChange({ ...filters, [filter.key]: value })}
            >
              <SelectTrigger
                aria-label={filter.label}
                className={cn("w-full lg:w-[11.5rem]", filters[filter.key] !== "all" && "border-primary/50 bg-primary/5")}
              >
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                {filter.items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                setCustomMode(false);
                onClearFilters();
              }}
            >
              <X aria-hidden="true" />
              Limpar filtros ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
