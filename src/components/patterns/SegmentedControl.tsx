import type { LucideIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
  /** Nome do grupo para leitor de tela (ex.: "Periodo"). */
  label: string;
  options: SegmentedOption<T>[];
  /** null = nenhuma opcao ativa (ex.: datas escolhidas a mao). */
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Escolha unica entre poucas opcoes curtas (periodo, tipo, status), com o
 * mesmo visual das abas. Setas do teclado trocam a opcao em foco.
 */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      type="single"
      value={value ?? ""}
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={label}
      className={cn(
        "flex h-11 w-full gap-1 rounded-lg bg-muted p-1 text-muted-foreground sm:inline-flex sm:h-10 sm:w-auto",
        className,
      )}
    >
      {options.map(({ value: optionValue, label: optionLabel, count, icon: Icon }) => (
        <ToggleGroupItem
          key={optionValue}
          value={optionValue}
          className="h-full flex-1 gap-1.5 whitespace-nowrap px-3 hover:bg-card/60 sm:flex-none"
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
