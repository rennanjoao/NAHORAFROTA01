import { Card } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  DollarSign,
  Package,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatSLA } from "@/lib/formatSLA";
import { getSLAColorScheme } from "@/lib/slaThresholds";
import { DrilldownType } from "./KPIDrilldownSheet";

interface KPIData {
  sla: number;
  slaTrend: number;
  onTime: number;
  onTimeTrend: number;
  delayed: number;
  delayedTrend: number;
  returns: number;
  returnsTrend: number;
  avgCost: number;
  avgCostTrend: number;
  totalVolume: number;
  volumeTrend: number;
}

interface InteractiveKPIsProps {
  data: KPIData;
  viewMode: "operational" | "executive";
  onKPIClick: (type: DrilldownType) => void;
}

export function InteractiveKPIs({ data, viewMode, onKPIClick }: InteractiveKPIsProps) {
  const slaScheme = getSLAColorScheme(data.sla);

  const kpis = [
    {
      id: "sla" as DrilldownType,
      label: "SLA Geral",
      value: `${formatSLA(data.sla)}%`,
      trend: data.slaTrend,
      trendLabel: "vs mês anterior",
      icon: Target,
      color: slaScheme.textClass,
      bgColor: slaScheme.bgClass,
      isGoodWhenPositive: true,
    },
    {
      id: "cost" as DrilldownType,
      label: "Custo Médio",
      value: formatCurrency(data.avgCost),
      trend: data.avgCostTrend,
      trendLabel: "vs mês anterior",
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10",
      isGoodWhenPositive: false,
    },
    {
      id: "volume" as DrilldownType,
      label: "Volume Total",
      value: data.totalVolume.toLocaleString(),
      trend: data.volumeTrend,
      trendLabel: "vs mês anterior",
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
      isGoodWhenPositive: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const isTrendPositive = kpi.trend > 0;
        const isTrendGood = kpi.isGoodWhenPositive ? isTrendPositive : !isTrendPositive;
        
        return (
          <Card
            key={kpi.id}
            className={cn(
              "p-4 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
              "border-2 hover:border-primary/50 group"
            )}
            onClick={() => onKPIClick(kpi.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={cn("p-2 rounded-lg", kpi.bgColor)}>
                <Icon className={cn("h-5 w-5", kpi.color)} />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <p className="text-sm text-muted-foreground mb-1">{kpi.label}</p>
            <p className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</p>
            
            {/* Trend Indicator */}
            <div className="mt-3 flex items-center gap-1">
              {isTrendPositive ? (
                <TrendingUp className={cn("h-3 w-3", isTrendGood ? "text-success" : "text-destructive")} />
              ) : (
                <TrendingDown className={cn("h-3 w-3", isTrendGood ? "text-success" : "text-destructive")} />
              )}
              <span className={cn(
                "text-xs font-medium",
                isTrendGood ? "text-success" : "text-destructive"
              )}>
                {isTrendPositive ? "+" : ""}{kpi.trend.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">{kpi.trendLabel}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
