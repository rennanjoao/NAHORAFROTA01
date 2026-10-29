import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  AlertTriangle, 
  TrendingDown, 
  MapPin,
  User,
  Building2,
  Lightbulb,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightData {
  topDelayRoute: { name: string; percentage: number };
  topReturnClient: { name: string; percentage: number };
  belowAverageDriver: { name: string; difference: number };
  peakDelayTime: { time: string; percentage: number };
  improvementOpportunity: { area: string; potential: string };
}

interface AIInsightsProps {
  data: InsightData;
}

export function AIInsights({ data }: AIInsightsProps) {
  const insights = [
    {
      id: 1,
      type: "warning",
      icon: MapPin,
      message: (
        <>
          <span className="font-medium">{data.topDelayRoute.percentage.toFixed(0)}%</span> dos atrasos estão concentrados na rota{" "}
          <span className="font-medium text-foreground">{data.topDelayRoute.name}</span>.
        </>
      ),
      action: "Ver detalhes da rota →",
    },
    {
      id: 2,
      type: "alert",
      icon: Building2,
      message: (
        <>
          Cliente <span className="font-medium text-foreground">{data.topReturnClient.name}</span> é responsável por{" "}
          <span className="font-medium">{data.topReturnClient.percentage.toFixed(0)}%</span> de todas as devoluções.
        </>
      ),
      action: "Analisar cliente →",
    },
    {
      id: 3,
      type: "info",
      icon: User,
      message: (
        <>
          Motorista <span className="font-medium text-foreground">{data.belowAverageDriver.name}</span> está{" "}
          <span className="font-medium">{data.belowAverageDriver.difference.toFixed(0)}%</span> abaixo da média de SLA da frota.
        </>
      ),
      action: "Ver perfil →",
    },
    {
      id: 4,
      type: "insight",
      icon: TrendingDown,
      message: (
        <>
          <span className="font-medium">{data.peakDelayTime.percentage.toFixed(0)}%</span> dos atrasos ocorrem entre{" "}
          <span className="font-medium text-foreground">{data.peakDelayTime.time}</span>. Considere ajustar horários de coleta.
        </>
      ),
      action: "Ver análise temporal →",
    },
    {
      id: 5,
      type: "opportunity",
      icon: Lightbulb,
      message: (
        <>
          Oportunidade de melhoria: <span className="font-medium text-foreground">{data.improvementOpportunity.area}</span> pode 
          gerar economia de <span className="font-medium text-success">{data.improvementOpportunity.potential}</span>.
        </>
      ),
      action: "Explorar oportunidade →",
    },
  ];

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "warning":
        return { badge: "bg-warning/10 text-warning border-warning/30", dot: "bg-warning" };
      case "alert":
        return { badge: "bg-destructive/10 text-destructive border-destructive/30", dot: "bg-destructive" };
      case "info":
        return { badge: "bg-primary/10 text-primary border-primary/30", dot: "bg-primary" };
      case "insight":
        return { badge: "bg-warning/10 text-warning border-warning/30", dot: "bg-warning" };
      case "opportunity":
        return { badge: "bg-success/10 text-success border-success/30", dot: "bg-success" };
      default:
        return { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" };
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-gradient-to-br from-info/20 to-info/20">
          <Sparkles className="h-5 w-5 text-info" />
        </div>
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            Insights da Operação
            <Badge variant="outline" className="text-xs font-normal">
              Análise Inteligente
            </Badge>
          </h3>
          <p className="text-sm text-muted-foreground">
            Padrões identificados automaticamente nos dados
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => {
          const Icon = insight.icon;
          const styles = getTypeStyles(insight.type);
          
          return (
            <div
              key={insight.id}
              className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group cursor-pointer"
            >
              {/* Icon */}
              <div className={cn("p-2 rounded-lg shrink-0", styles.badge)}>
                <Icon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {insight.message}
                </p>
                <button className="mt-2 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {insight.action}
                </button>
              </div>

              {/* Status Dot */}
              <div className={cn("w-2 h-2 rounded-full shrink-0 mt-2", styles.dot)} />
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Insights gerados com base nos dados do período selecionado • Atualizado há 5 minutos
        </p>
      </div>
    </Card>
  );
}
