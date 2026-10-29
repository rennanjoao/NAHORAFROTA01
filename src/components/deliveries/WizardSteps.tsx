import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardStepsProps {
  steps: string[];
  /** Indice (0..n-1) da etapa atual. */
  current: number;
  className?: string;
}

/** Etapas de um assistente: "1 Arquivos — 2 Conferir — 3 Pronto". */
export function WizardSteps({ steps, current, className }: WizardStepsProps) {
  return (
    <ol aria-label="Etapas" className={cn("flex items-center gap-2", className)}>
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn("flex min-w-0 items-center gap-2", index < steps.length - 1 && "flex-1")}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-primary/10 text-primary",
                !done && !active && "border-border bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
              {done && <span className="sr-only">Concluída:</span>}
            </span>
            <span
              className={cn(
                "truncate text-xs font-medium",
                active ? "text-foreground" : "text-muted-foreground",
                !active && "sr-only sm:not-sr-only",
              )}
            >
              {label}
            </span>
            {index < steps.length - 1 && (
              <span aria-hidden="true" className={cn("h-px min-w-3 flex-1 rounded-full", done ? "bg-primary" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
