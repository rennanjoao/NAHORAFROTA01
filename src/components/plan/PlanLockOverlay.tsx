import { Lock, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanLockOverlayProps {
  upgradePlanLabel: string;
  className?: string;
  children?: React.ReactNode;
}

export function PlanLockOverlay({ upgradePlanLabel, className }: PlanLockOverlayProps) {
  return (
    <div className={cn("relative min-h-[220px] overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="absolute inset-0 bg-muted/30" />
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 rounded-lg z-10">
        <div className="flex flex-col items-center gap-3 text-center p-6">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Funcionalidade Bloqueada</p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              Disponível no Plano{" "}
              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                <Crown className="h-3 w-3" />
                {upgradePlanLabel}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
