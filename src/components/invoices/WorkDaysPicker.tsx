import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatCurrency";
import type { WorkDay } from "@/lib/providerInvoices";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** Cabe no botao do dia: "R$ 281", "R$ 1,2 mil". */
const shortMoney = (value: number) =>
  value >= 1000 ? `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(value)}`;

interface WorkDaysPickerProps {
  /** Primeiro dia do mes mostrado ("2026-10-01"). */
  month: string;
  onMonthChange: (month: string) => void;
  /** Ultimo mes que pode abrir (o atual). */
  maxMonth: string;
  days: WorkDay[];
  selected: string[];
  onToggle: (date: string) => void;
  loading?: boolean;
  /** "lg": botoes grandes (app do motorista). */
  size?: "md" | "lg";
  labelledBy?: string;
}

/**
 * Calendario dos dias trabalhados: so os dias com romaneio podem ser escolhidos (com o
 * frete a receber embaixo do numero). Dia que ja esta em outra nota fica bloqueado.
 */
export function WorkDaysPicker({ month, onMonthChange, maxMonth, days, selected, onToggle, loading, size = "md", labelledBy }: WorkDaysPickerProps) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const offset = first.getUTCDay();
  const byDate = new Map(days.map((d) => [d.work_date, d]));
  const monthText = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const monthLabel = monthText.charAt(0).toUpperCase() + monthText.slice(1);
  const shift = (delta: number) => {
    const next = new Date(Date.UTC(year, monthIndex + delta, 1));
    onMonthChange(iso(next.getUTCFullYear(), next.getUTCMonth(), 1));
  };
  const big = size === "lg";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size={big ? "default" : "sm"} onClick={() => shift(-1)} aria-label="Mês anterior">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <p className={cn("font-heading font-semibold text-foreground", big ? "text-lg" : "text-sm")} aria-live="polite">
          {monthLabel}
          {loading && <Loader2 className="ml-2 inline h-4 w-4 animate-spin align-[-2px] text-muted-foreground" aria-label="Carregando os dias" />}
        </p>
        <Button type="button" variant="outline" size={big ? "default" : "sm"} onClick={() => shift(1)} disabled={month >= maxMonth} aria-label="Próximo mês">
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((day, i) => (
          <span key={i} aria-hidden="true" className="pb-1 text-center text-xs font-medium text-muted-foreground">
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`v${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = iso(year, monthIndex, i + 1);
          const info = byDate.get(date);
          const isSelected = selected.includes(date);
          const taken = !!info?.other_invoice;
          // Dia todo pago: nada a receber, fica bloqueado
          const allPaid = !!info && info.paid === info.manifests;
          const enabled = !!info && !taken && !allPaid;
          const weekday = WEEKDAY_NAMES[(offset + i) % 7];
          const label = !info
            ? `Dia ${i + 1}, ${weekday}: sem romaneio`
            : taken
              ? `Dia ${i + 1}, ${weekday}: já está na nota ${info.other_invoice}`
              : allPaid
                ? `Dia ${i + 1}, ${weekday}: já pago`
              : `Dia ${i + 1}, ${weekday}: ${info.manifests} romaneio${info.manifests === 1 ? "" : "s"}${info.payable > 0 ? `, ${formatCurrency(info.freight)} a receber` : ", ainda na rua"}`;
          return (
            <button
              key={date}
              type="button"
              disabled={!enabled}
              aria-pressed={enabled ? isSelected : undefined}
              aria-label={label}
              onClick={() => onToggle(date)}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border text-center transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                big ? "min-h-[3.75rem] px-0.5 py-1" : "min-h-[3rem] px-0.5 py-1",
                !info && "border-transparent text-muted-foreground/50",
                (taken || allPaid) && "border-dashed bg-muted/50 text-muted-foreground",
                enabled && !isSelected && "border-brand/40 bg-brand/[0.06] text-foreground hover:bg-brand/15",
                isSelected && "border-brand bg-brand text-brand-foreground shadow-sm",
              )}
            >
              <span aria-hidden="true" className={cn("font-data font-semibold leading-none", big ? "text-lg" : "text-sm")}>
                {i + 1}
              </span>
              {info && (
                <span aria-hidden="true" className={cn("mt-1 max-w-full truncate leading-none", big ? "text-[0.6875rem]" : "text-[0.625rem]", !isSelected && "text-muted-foreground")}>
                  {taken ? `NF ${info.other_invoice}` : allPaid ? "pago" : info.payable > 0 ? shortMoney(info.freight) : "na rua"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
