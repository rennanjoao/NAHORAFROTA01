import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarIcon, 
  Filter, 
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ReportFilterOption {
  id: string;
  name: string;
}

export interface ReportFilterOptions {
  clients: ReportFilterOption[];
  routes: ReportFilterOption[];
  drivers: ReportFilterOption[];
}

const operationTypes: ReportFilterOption[] = [
  { id: "all", name: "Todas as Operações" },
  { id: "own_fleet", name: "Frota Própria" },
  { id: "third_party", name: "Terceiros (Agregados)" },
];

// Quick date range presets
const datePresets = [
  { label: "7 dias", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "30 dias", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "Este mês", getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Mês anterior", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "6 meses", getValue: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
];

export interface FilterState {
  dateRange: { from: Date | undefined; to: Date | undefined };
  client: string;
  route: string;
  driver: string;
  operationType: string;
  viewMode: "operational" | "executive";
}

interface ReportsFiltersProps {
  filters: FilterState;
  options: ReportFilterOptions;
  onFiltersChange: (filters: FilterState) => void;
  onClearFilters: () => void;
}

export function ReportsFilters({ filters, options, onFiltersChange, onClearFilters }: ReportsFiltersProps) {
  const clients = [{ id: "all", name: "Todos os Clientes" }, ...options.clients];
  const routes = [{ id: "all", name: "Todas as Regiões" }, ...options.routes];
  const drivers = [{ id: "all", name: "Todos os Motoristas" }, ...options.drivers];

  const activeFiltersCount = [
    filters.client !== "all",
    filters.route !== "all",
    filters.driver !== "all",
    filters.operationType !== "all",
  ].filter(Boolean).length;

  const handleDateRangeChange = (newRange: { from: Date | undefined; to: Date | undefined }) => {
    onFiltersChange({ ...filters, dateRange: newRange });
  };

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border pb-4 -mx-6 px-6 pt-2">
      <div className="space-y-4">
        {/* Top Row: Date Range & View Toggle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Date Range Section */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Período:
            </div>
            
            {/* Start Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-[130px] justify-start text-left font-normal",
                    !filters.dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {filters.dateRange.from ? format(filters.dateRange.from, "dd/MM/yy", { locale: ptBR }) : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.from}
                  onSelect={(date) => handleDateRangeChange({ ...filters.dateRange, from: date })}
                  disabled={(date) => date > new Date() || (filters.dateRange.to && date > filters.dateRange.to)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground text-sm">→</span>

            {/* End Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-[130px] justify-start text-left font-normal",
                    !filters.dateRange.to && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {filters.dateRange.to ? format(filters.dateRange.to, "dd/MM/yy", { locale: ptBR }) : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.to}
                  onSelect={(date) => handleDateRangeChange({ ...filters.dateRange, to: date })}
                  disabled={(date) => date > new Date() || (filters.dateRange.from && date < filters.dateRange.from)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* Quick Presets */}
            <div className="hidden md:flex items-center gap-1 ml-2 border-l border-border pl-3">
              {datePresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => handleDateRangeChange(preset.getValue())}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom Row: Entity Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Client Filter */}
          <Select
            value={filters.client}
            onValueChange={(value) => onFiltersChange({ ...filters, client: value })}
          >
            <SelectTrigger className="w-[180px] h-9 bg-background">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Route Filter */}
          <Select
            value={filters.route}
            onValueChange={(value) => onFiltersChange({ ...filters, route: value })}
          >
            <SelectTrigger className="w-[160px] h-9 bg-background">
              <SelectValue placeholder="Região / Rota" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {routes.map((route) => (
                <SelectItem key={route.id} value={route.id}>
                  {route.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Driver Filter */}
          <Select
            value={filters.driver}
            onValueChange={(value) => onFiltersChange({ ...filters, driver: value })}
          >
            <SelectTrigger className="w-[180px] h-9 bg-background">
              <SelectValue placeholder="Motorista" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operation Type Filter */}
          <Select
            value={filters.operationType}
            onValueChange={(value) => onFiltersChange({ ...filters, operationType: value })}
          >
            <SelectTrigger className="w-[170px] h-9 bg-background">
              <SelectValue placeholder="Tipo Operação" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {operationTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Active Filters Badge & Clear */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 ml-2">
              <Badge variant="secondary" className="gap-1">
                {activeFiltersCount} filtro{activeFiltersCount > 1 ? "s" : ""} ativo{activeFiltersCount > 1 ? "s" : ""}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={onClearFilters}
              >
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const defaultFilters: FilterState = {
  dateRange: { from: subDays(new Date(), 30), to: new Date() },
  client: "all",
  route: "all",
  driver: "all",
  operationType: "all",
  viewMode: "operational",
};
