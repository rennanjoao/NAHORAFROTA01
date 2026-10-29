import { useCountUp } from "@/hooks/useCountUp";
import { toneDot, toneSoftBg, toneText, type Tone } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { DELIVERY_STATUS } from "./status";

export type KPIStatusFilter = "all" | "pending" | "in_transit" | "delivered" | "occurrence" | "returned";

interface KPIStats {
  pending: number;
  in_transit: number;
  delivered: number;
  occurrence: number;
  returned: number;
}

interface DeliveryKPICardsProps {
  stats: KPIStats;
  activeFilter: KPIStatusFilter;
  onFilterChange: (filter: KPIStatusFilter) => void;
}

const TILES: { key: Exclude<KPIStatusFilter, "all">; label: string }[] = [
  { key: "pending", label: "Pendentes" },
  { key: "in_transit", label: "Em rota" },
  { key: "delivered", label: "Entregues" },
  { key: "occurrence", label: "Ocorrências" },
  { key: "returned", label: "Devolvidas" },
];

// Classes completas por cor (o Tailwind precisa ver o nome inteiro).
const activeTone: Record<Tone, string> = {
  neutral: "border-foreground/30 ring-foreground/10",
  brand: "border-primary/50 ring-primary/15",
  success: "border-success/50 ring-success/15",
  warning: "border-warning/50 ring-warning/15",
  danger: "border-destructive/50 ring-destructive/15",
  info: "border-info/50 ring-info/15",
};

function Count({ value }: { value: number }) {
  const display = useCountUp(value);
  return <>{Math.round(display).toLocaleString("pt-BR")}</>;
}

/** Contagem por status. Cada cartao filtra a lista; tocar de novo tira o filtro. */
export function DeliveryKPICards({ stats, activeFilter, onFilterChange }: DeliveryKPICardsProps) {
  return (
    <div
      role="group"
      aria-label="Filtrar notas por status"
      // Celular: 3 em cima e 2 embaixo, sem buraco no fim da grade.
      className="stagger grid grid-cols-6 gap-2 sm:gap-3 lg:grid-cols-5"
    >
      {TILES.map((tile, index) => {
        const meta = DELIVERY_STATUS[tile.key];
        const Icon = meta.icon;
        const count = stats[tile.key] || 0;
        const active = activeFilter === tile.key;

        return (
          <button
            key={tile.key}
            type="button"
            aria-pressed={active}
            onClick={() => onFilterChange(active ? "all" : tile.key)}
            className={cn(
              "card-interactive group relative flex min-h-[5rem] flex-col justify-between gap-2 rounded-lg border bg-card px-2.5 py-3 text-left text-card-foreground shadow-sm sm:min-h-[6.5rem] sm:gap-3 sm:p-4 lg:col-span-1",
              index < 3 ? "col-span-2" : "col-span-3",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
              active && cn("ring-4", activeTone[meta.tone]),
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1 text-xs font-medium text-muted-foreground sm:gap-2 sm:text-sm">
                <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2", toneDot[meta.tone])} />
                <span className="truncate">{tile.label}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn("hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex", toneSoftBg[meta.tone], toneText[meta.tone])}
              >
                <Icon className="h-4 w-4" />
              </span>
            </span>
            <span className="flex items-end justify-between gap-2">
              <span className="font-data text-2xl font-semibold leading-none tracking-tight text-foreground sm:text-[1.75rem]">
                <Count value={count} />
              </span>
              <span
                className={cn(
                  "hidden text-xs font-medium transition-opacity duration sm:inline",
                  active ? "text-foreground" : "text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                )}
              >
                {active ? "Filtro ativo" : "Filtrar lista"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
