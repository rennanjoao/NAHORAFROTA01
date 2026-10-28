/**
 * SLA ALERT TOAST COMPONENT
 * Critical alert for severe SLA drops
 */

import { AlertTriangle, X } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { OCCURRENCE_RULES, getSeverityBadgeClass, OccurrenceSeverity } from "@/lib/slaCalculations";

interface SLAAlertOptions {
  driverName: string;
  occurrenceType: string;
  pointsLost: number;
  newSLA: number;
}

export function triggerSLAAlertToast({ 
  driverName, 
  occurrenceType, 
  pointsLost, 
  newSLA 
}: SLAAlertOptions) {
  const rule = OCCURRENCE_RULES[occurrenceType];
  const isVerySevere = rule?.severity === "very_severe";
  const isSevere = rule?.severity === "severe";
  
  if (isVerySevere) {
    // Very Severe - Red critical toast
    sonnerToast.error(
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" />
          Alerta de Qualidade
        </div>
        <p className="text-sm">
          Seu SLA sofreu uma redução crítica devido a: <strong>{rule.labelPt}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Motorista: {driverName} | Pontos perdidos: -{pointsLost.toFixed(1)} | Novo SLA: {newSLA.toFixed(1)}%
        </p>
      </div>,
      {
        duration: 8000,
        className: "border-destructive bg-destructive/10",
      }
    );
  } else if (isSevere) {
    // Severe - Orange warning toast
    sonnerToast.warning(
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" />
          Alerta de SLA
        </div>
        <p className="text-sm">
          Ocorrência registrada: <strong>{rule?.labelPt || occurrenceType}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Motorista: {driverName} | Pontos perdidos: -{pointsLost.toFixed(1)}
        </p>
      </div>,
      {
        duration: 5000,
      }
    );
  } else if (rule?.severity === "light") {
    // Light - Yellow info toast
    sonnerToast.info(
      <div className="flex flex-col gap-1">
        <p className="text-sm">
          Ocorrência leve: <strong>{rule.labelPt}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Motorista: {driverName} | Pontos: -{pointsLost.toFixed(1)}
        </p>
      </div>,
      {
        duration: 3000,
      }
    );
  }
}

/**
 * Trigger SLA below threshold warning
 */
export function triggerLowSLAToast(driverName: string, sla: number) {
  if (sla < 75) {
    sonnerToast.error(
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" />
          SLA Crítico
        </div>
        <p className="text-sm">
          Motorista <strong>{driverName}</strong> com SLA abaixo do limite aceitável.
        </p>
        <p className="text-xs">
          SLA atual: <span className="font-bold text-destructive">{sla.toFixed(1)}%</span>
        </p>
      </div>,
      {
        duration: 10000,
        className: "border-destructive",
      }
    );
  } else if (sla < 90) {
    sonnerToast.warning(
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 font-semibold text-warning">
          <AlertTriangle className="h-4 w-4" />
          SLA em Atenção
        </div>
        <p className="text-sm">
          Motorista <strong>{driverName}</strong> com SLA em zona de atenção.
        </p>
        <p className="text-xs">
          SLA atual: <span className="font-bold text-warning">{sla.toFixed(1)}%</span>
        </p>
      </div>,
      {
        duration: 5000,
      }
    );
  }
}
