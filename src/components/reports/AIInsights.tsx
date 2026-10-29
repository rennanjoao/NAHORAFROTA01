import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingDown, MapPin, User, Building2, Lightbulb } from "lucide-react";
import { toneSoftBg, toneText, type Tone } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { ReportCard } from "./ReportCard";

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
          <span className="font-medium">{data.topDelayRoute.percentage.toFixed(0).replace(".", ",")}%</span> dos atrasos estão concentrados na rota{" "}
          <span className="font-medium text-foreground">{data.topDelayRoute.name}</span>.
        </>
      ),
    },
    {
      id: 2,
      type: "alert",
      icon: Building2,
      message: (
        <>
          Cliente <span className="font-medium text-foreground">{data.topReturnClient.name}</span> é responsável por{" "}
          <span className="font-medium">{data.topReturnClient.percentage.toFixed(0).replace(".", ",")}%</span> de todas as devoluções.
        </>
      ),
    },
    {
      id: 3,
      type: "info",
      icon: User,
      message: (
        <>
          Motorista <span className="font-medium text-foreground">{data.belowAverageDriver.name}</span> está{" "}
          <span className="font-medium">{data.belowAverageDriver.difference.toFixed(0).replace(".", ",")}%</span> abaixo da média de SLA da frota.
        </>
      ),
    },
    {
      id: 4,
      type: "insight",
      icon: TrendingDown,
      message: (
        <>
          <span className="font-medium">{data.peakDelayTime.percentage.toFixed(0).replace(".", ",")}%</span> dos atrasos ocorrem entre{" "}
          <span className="font-medium text-foreground">{data.peakDelayTime.time}</span>. Considere ajustar horários de coleta.
        </>
      ),
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
    },
  ];

  // Cor com significado: alerta = vermelho, atencao = amarelo, oportunidade = verde.
  const typeTone: Record<string, Tone> = {
    warning: "warning",
    alert: "danger",
    info: "info",
    insight: "warning",
    opportunity: "success",
  };

  return (
    <ReportCard
      icon={Sparkles}
      tone="info"
      title="Padrões da operação"
      description="O que chama atenção nos dados do período escolhido."
      actions={<Badge variant="outline">Análise automática</Badge>}
    >
      <ul className="space-y-3">
        {insights.map((insight) => {
          const Icon = insight.icon;
          const tone = typeTone[insight.type] ?? "neutral";
          return (
            <li key={insight.id} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
              <span aria-hidden="true" className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", toneSoftBg[tone], toneText[tone])}>
                <Icon className="h-4 w-4" />
              </span>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{insight.message}</p>
            </li>
          );
        })}
      </ul>
    </ReportCard>
  );
}
