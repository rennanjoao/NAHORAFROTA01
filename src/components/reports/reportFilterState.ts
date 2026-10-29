import { endOfMonth, isSameDay, startOfMonth, subDays, subMonths } from "date-fns";

/** Estado e periodos prontos dos filtros da tela de Relatorios. */

export interface ReportFilterOption {
  id: string;
  name: string;
}

export interface ReportFilterOptions {
  clients: ReportFilterOption[];
  routes: ReportFilterOption[];
  drivers: ReportFilterOption[];
}

export interface FilterState {
  dateRange: { from: Date | undefined; to: Date | undefined };
  client: string;
  route: string;
  driver: string;
  operationType: string;
  viewMode: "operational" | "executive";
}

export const operationTypes: ReportFilterOption[] = [
  { id: "all", name: "Todas as operações" },
  { id: "own_fleet", name: "Frota própria" },
  { id: "third_party", name: "Agregados (terceiros)" },
];

// Periodos prontos (os mesmos de antes, agora num seletor so).
export const datePresets = [
  { id: "7d", label: "Últimos 7 dias", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { id: "30d", label: "Últimos 30 dias", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { id: "month", label: "Este mês", getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  {
    id: "prev-month",
    label: "Mês anterior",
    getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }),
  },
  { id: "6m", label: "Últimos 6 meses", getValue: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
] as const;

export const CUSTOM_PRESET = "custom";

/** Qual periodo pronto bate com as datas escolhidas ("custom" se nenhum). */
export function matchPreset(range: FilterState["dateRange"]): string {
  if (!range.from || !range.to) return CUSTOM_PRESET;
  const found = datePresets.find((preset) => {
    const value = preset.getValue();
    return isSameDay(value.from, range.from as Date) && isSameDay(value.to, range.to as Date);
  });
  return found?.id ?? CUSTOM_PRESET;
}

export const defaultFilters: FilterState = {
  dateRange: { from: subDays(new Date(), 30), to: new Date() },
  client: "all",
  route: "all",
  driver: "all",
  operationType: "all",
  viewMode: "operational",
};
