import type { LucideIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: LucideIcon;
}

interface SegmentedFilterProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
}

/** Controle segmentado para filtros curtos (ex.: Todos, CLT, Agregados). */
export function SegmentedFilter<T extends string>({ label, value, onChange, options, className }: SegmentedFilterProps<T>) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={label}
      className={cn("flex h-10 w-full gap-1 rounded-lg bg-muted p-1 text-muted-foreground sm:inline-flex sm:w-auto", className)}
    >
      {options.map(({ value: optionValue, label: optionLabel, count, icon: Icon }) => (
        <ToggleGroupItem
          key={optionValue}
          value={optionValue}
          className="h-8 flex-1 gap-1.5 whitespace-nowrap px-3 hover:bg-card/60 sm:flex-none"
        >
          {Icon && <Icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />}
          {optionLabel}
          {count !== undefined && (
            <span className="font-data text-xs tabular-nums text-muted-foreground">{count.toLocaleString("pt-BR")}</span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
