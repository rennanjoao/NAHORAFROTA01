import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Escolha o motorista", "Confira os romaneios", "Marque como pago"];

/** Passo a passo do acerto (1 → 2 → 3). O passo atual fica destacado. */
export function SettlementSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Passo a passo do acerto" className="grid grid-cols-3 gap-2 sm:gap-3">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const state = step < current ? "done" : step === current ? "current" : "upcoming";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "flex flex-col gap-2 rounded-lg border px-3 py-2.5 transition-colors duration sm:flex-row sm:items-center sm:gap-3",
              state === "current" && "border-primary/40 bg-primary/5",
              state === "upcoming" && "border-dashed",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-data text-xs font-semibold",
                state === "done" && "bg-primary text-primary-foreground",
                state === "current" && "bg-primary/15 text-primary ring-1 ring-primary/40",
                state === "upcoming" && "bg-muted text-muted-foreground",
              )}
            >
              {state === "done" ? <Check className="h-3.5 w-3.5" /> : step}
            </span>
            <span
              className={cn(
                "text-xs font-medium leading-snug sm:text-sm",
                state === "upcoming" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              <span className="sr-only">Passo {step}: </span>
              {label}
              {state === "done" && <span className="sr-only"> (feito)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
