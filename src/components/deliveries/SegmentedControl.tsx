import { cn } from "@/lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** Nome do grupo para leitor de tela (ex.: "Período"). */
  label: string;
  options: SegmentedOption<T>[];
  /** null = nenhuma opcao ativa (ex.: periodo personalizado escolhido). */
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}

/** Botoes de escolha unica lado a lado (mesmo visual das abas). */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid h-12 auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1 sm:inline-grid sm:h-10", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-all duration ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
