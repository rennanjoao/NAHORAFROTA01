/**
 * SLA DRIVER CARD COMPONENT
 * Displays individual driver's SLA with color-coded status
 */

import { AlertTriangle, TrendingDown, TrendingUp, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DriverSLAData } from "@/hooks/useSLA";
import { formatSLAScore } from "@/lib/slaCalculations";

interface SLADriverCardProps {
  data: DriverSLAData;
  compact?: boolean;
  onClick?: () => void;
}

export function SLADriverCard({ data, compact = false, onClick }: SLADriverCardProps) {
  const { driverName, currentDailySLA, weeklySLA, totalDeliveriestoday, occurrencesToday, lastOccurrence, colorScheme } = data;

  const trend = currentDailySLA >= weeklySLA ? "up" : "down";
  const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;

  if (compact) {
    return (
      <div 
        className={`flex items-center justify-between p-3 rounded-lg border ${colorScheme.bgClass} ${colorScheme.borderClass} cursor-pointer hover:shadow-md transition-shadow`}
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${colorScheme.progressClass}`} />
          <span className="font-medium truncate max-w-[150px]">{driverName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-bold font-data ${colorScheme.textClass}`}>
            {formatSLAScore(currentDailySLA)}%
          </span>
          <TrendIcon className={`h-4 w-4 ${trend === "up" ? "text-success" : "text-destructive"}`} />
        </div>
      </div>
    );
  }

  return (
    <Card 
      className={`p-4 border-2 ${colorScheme.borderClass} ${colorScheme.bgClass} cursor-pointer hover:shadow-lg transition-all`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold truncate max-w-[180px]">{driverName}</h4>
          <p className="text-xs text-muted-foreground">
            {totalDeliveriestoday} entregas hoje
          </p>
        </div>
        <Badge variant="outline" className={colorScheme.textClass}>
          {colorScheme.labelPt}
        </Badge>
      </div>

      <div className="space-y-3">
        {/* Daily SLA */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">SLA Diário</span>
            <span className={`text-lg font-bold font-data ${colorScheme.textClass}`}>
              {formatSLAScore(currentDailySLA)}%
            </span>
          </div>
          <Progress 
            value={currentDailySLA} 
            className={`h-2 ${colorScheme.bgClass}`}
          />
        </div>

        {/* Weekly SLA */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">SLA Semanal</span>
          <div className="flex items-center gap-1">
            <span className="font-data">{formatSLAScore(weeklySLA)}%</span>
            <TrendIcon className={`h-3 w-3 ${trend === "up" ? "text-success" : "text-destructive"}`} />
          </div>
        </div>

        {/* Occurrences */}
        {occurrencesToday > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-muted-foreground">
              {occurrencesToday} ocorrência{occurrencesToday > 1 ? "s" : ""} hoje
            </span>
          </div>
        )}

        {/* Last occurrence tooltip */}
        {lastOccurrence && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-xs text-destructive flex items-center gap-1 cursor-help">
                  <Activity className="h-3 w-3" />
                  Última: {lastOccurrence.label}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Perdeu {lastOccurrence.pointsLost.toFixed(1)} pontos</p>
                <p className="text-xs text-muted-foreground">
                  {lastOccurrence.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </Card>
  );
}
