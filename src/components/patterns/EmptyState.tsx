import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: ReactNode;
  /** Diga o que fazer a seguir, em linguagem simples. */
  description?: ReactNode;
  /** Botao com o proximo passo (ex.: "Importar notas"). */
  action?: ReactNode;
  secondaryAction?: ReactNode;
  /** Versao menor, para dentro de cartoes e listas. */
  compact?: boolean;
  className?: string;
}

/** Tela/lista vazia que ensina o proximo passo, em vez de so dizer "nada aqui". */
export function EmptyState({ icon: Icon, title, description, action, secondaryAction, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center animate-fade-in",
        compact ? "gap-2 px-4 py-8" : "gap-3 rounded-lg border border-dashed px-6 py-14",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-2xl bg-muted text-muted-foreground",
          compact ? "h-10 w-10" : "mb-1 h-14 w-14",
        )}
      >
        <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </span>
      <p className={cn("font-heading font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
