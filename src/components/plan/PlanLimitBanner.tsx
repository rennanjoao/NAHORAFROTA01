import { AlertTriangle, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlanLimitBannerProps {
  plan: string;
  resourceLabel: string;
  currentCount: number;
  maxCount: number;
  planLabels: Record<string, string>;
}

export function PlanLimitBanner({ plan, resourceLabel, currentCount, maxCount, planLabels }: PlanLimitBannerProps) {
  if (maxCount === -1) return null; // Unlimited
  if (currentCount <= 0) return null;

  const isAtLimit = currentCount >= maxCount;
  const isNearLimit = currentCount >= maxCount - 1 && !isAtLimit;

  if (!isAtLimit && !isNearLimit) return null;

  return (
    <div className={`p-4 rounded-lg border flex items-start gap-3 ${
      isAtLimit 
        ? "bg-destructive/10 border-destructive/30" 
        : "bg-warning/10 border-warning/30"
    }`}>
      <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
        isAtLimit ? "text-destructive" : "text-warning"
      }`} />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className={`font-medium ${isAtLimit ? "text-destructive" : "text-warning"}`}>
            {isAtLimit ? `Limite de ${resourceLabel} atingido` : `Próximo do limite de ${resourceLabel}`}
          </p>
          <Badge variant="outline" className="text-xs">
            <Crown className="h-3 w-3 mr-1" />
            Plano {planLabels[plan] || plan}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {isAtLimit 
            ? `Seu plano permite até ${maxCount} ${resourceLabel}. Você já possui ${currentCount}. Faça upgrade para adicionar mais.`
            : `Você possui ${currentCount} de ${maxCount} ${resourceLabel} permitidos no plano atual.`
          }
        </p>
      </div>
    </div>
  );
}
