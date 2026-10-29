import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import { StatCard } from "./StatCard";
import { cn } from "@/lib/utils";

type FilterStatCardProps = Omit<ComponentProps<typeof StatCard>, "onClick" | "href"> & {
  /** Filtro ligado (aria-pressed). */
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
};

/** Indicador que tambem filtra a lista: clicar liga/desliga o filtro. */
export function FilterStatCard({ pressed, onPressedChange, className, hint, ...stat }: FilterStatCardProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className="group relative block h-full w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <StatCard
        {...stat}
        // No celular a dica some para o cartao ficar baixo.
        hint={hint ? <span className="hidden sm:inline">{hint}</span> : undefined}
        className={cn(
          "card-interactive min-h-0 gap-2 p-4 sm:min-h-[7.5rem] sm:gap-3 sm:p-5",
          pressed && "border-primary/60 bg-primary/[0.04] shadow-md ring-1 ring-primary/40",
          className,
        )}
      />
      {pressed && (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-background animate-pop-in"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
