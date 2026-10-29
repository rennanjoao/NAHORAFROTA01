import { Card } from "@/components/ui/card";
import { 
  AlertTriangle, 
  RotateCcw, 
  Clock, 
  Repeat,
  TrendingDown,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatCurrency";

interface FinancialImpactData {
  returnCount: number;
  returnCost: number; // per return
  delayedCount: number;
  delayPenalty: number; // per delay
  reworkPercentage: number;
  reworkCost: number;
}

interface FinancialImpactProps {
  data: FinancialImpactData;
}

export function FinancialImpact({ data }: FinancialImpactProps) {
  const returnsCost = data.returnCount * data.returnCost;
  const delaysCost = data.delayedCount * data.delayPenalty;
  const totalImpact = returnsCost + delaysCost + data.reworkCost;

  const impactItems = [
    {
      label: "Custo de Devoluções",
      formula: `${data.returnCount} devoluções × ${formatCurrency(data.returnCost)}`,
      value: returnsCost,
      icon: RotateCcw,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      label: "Custo de Atrasos",
      formula: `${data.delayedCount} atrasos × ${formatCurrency(data.delayPenalty)}`,
      value: delaysCost,
      icon: Clock,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      label: "Retrabalho",
      formula: `${data.reworkPercentage.toFixed(1)}% das entregas`,
      value: data.reworkCost,
      icon: Repeat,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Impacto Financeiro do Período</h3>
          <p className="text-sm text-muted-foreground">
            Custos operacionais que afetam a margem de lucro
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Impact Cards */}
        {impactItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("p-2 rounded-lg", item.bgColor)}>
                  <Icon className={cn("h-4 w-4", item.color)} />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
              </div>
              <p className={cn("text-2xl font-bold", item.color)}>
                {formatCurrency(item.value)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{item.formula}</p>
            </Card>
          );
        })}

        {/* Total Impact Card - Highlighted */}
        <Card className="p-4 bg-destructive/5 border-destructive/30 border-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-destructive/20">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-sm font-medium text-destructive">Impacto Total</span>
          </div>
          <p className="text-3xl font-bold text-destructive">
            {formatCurrency(totalImpact)}
          </p>
          <p className="text-xs text-destructive/80 mt-1">
            Perda acumulada no período
          </p>
        </Card>
      </div>

      {/* Executive Insight */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-start gap-3">
          <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">Análise Executiva</p>
            <p className="text-sm text-muted-foreground mt-1">
              O custo de devoluções representa <span className="font-medium text-foreground">{((returnsCost / totalImpact) * 100).toFixed(0)}%</span> do impacto total.
              Reduzir a taxa de devoluções em 10% economizaria aproximadamente <span className="font-medium text-success">{formatCurrency(returnsCost * 0.1)}</span> no período.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
