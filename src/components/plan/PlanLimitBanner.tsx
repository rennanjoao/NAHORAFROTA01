import { AlertTriangle, Crown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface PlanLimitBannerProps {
  plan: string;
  resourceLabel: string;
  currentCount: number;
  maxCount: number;
  planLabels: Record<string, string>;
}

/** Aviso quando a empresa chega perto (ou no) limite do plano para um recurso. */
export function PlanLimitBanner({ plan, resourceLabel, currentCount, maxCount, planLabels }: PlanLimitBannerProps) {
  if (maxCount === -1) return null; // Sem limite
  if (currentCount <= 0) return null;

  const isAtLimit = currentCount >= maxCount;
  const isNearLimit = currentCount >= maxCount - 1 && !isAtLimit;

  if (!isAtLimit && !isNearLimit) return null;

  return (
    <Alert variant={isAtLimit ? "destructive" : "warning"} role="status" className="animate-fade-in">
      <AlertTriangle aria-hidden="true" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          {/* <p> e nao AlertTitle (h5): o aviso aparece em telas com outra ordem de titulos. */}
          <p className="mb-1 font-semibold leading-snug text-foreground">
            {isAtLimit ? `Limite de ${resourceLabel} atingido` : `Perto do limite de ${resourceLabel}`}
          </p>
          <AlertDescription>
            {isAtLimit
              ? `Seu plano permite até ${maxCount} ${resourceLabel} e você já tem ${currentCount}. Para cadastrar mais, fale com a equipe e mude de plano.`
              : `Você tem ${currentCount} de ${maxCount} ${resourceLabel} permitidos no plano atual.`}
          </AlertDescription>
        </div>
        <Badge variant="outline" className="shrink-0 self-start">
          <Crown aria-hidden="true" />
          Plano {planLabels[plan] || plan}
        </Badge>
      </div>
    </Alert>
  );
}
