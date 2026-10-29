import { Link } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanLockOverlayProps {
  upgradePlanLabel: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Bloco no lugar de um recurso fora do plano. O conteudo (children) nao e
 * mostrado de proposito: dados reais nao vazam por tras do aviso.
 */
export function PlanLockOverlay({ upgradePlanLabel, className }: PlanLockOverlayProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg border border-dashed bg-card p-6 text-center",
        className,
      )}
    >
      <div aria-hidden="true" className="nhf-routes pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative flex max-w-[16rem] flex-col items-center gap-3 animate-fade-in">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-muted text-muted-foreground shadow-xs"
        >
          <Lock className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <p className="font-heading text-sm font-semibold text-foreground">Recurso de outro plano</p>
          <p className="text-[0.8125rem] text-muted-foreground">
            Disponível no plano <span className="font-semibold text-primary">{upgradePlanLabel}</span>.
          </p>
        </div>
        <Link
          to={`/upgrade?plano=${encodeURIComponent(upgradePlanLabel)}`}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-[0.8125rem] font-semibold text-primary transition-colors duration-fast hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver como liberar
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
