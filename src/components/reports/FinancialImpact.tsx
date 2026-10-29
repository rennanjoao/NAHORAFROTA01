import { AlertTriangle, RotateCcw, Clock, Repeat, TrendingDown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Section, StatCard } from "@/components/patterns";
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
      label: "Custo de devoluções",
      formula: `${data.returnCount} devoluções × ${formatCurrency(data.returnCost)}`,
      value: returnsCost,
      icon: RotateCcw,
      tone: "warning" as const,
    },
    {
      label: "Custo de atrasos",
      formula: `${data.delayedCount} atrasos × ${formatCurrency(data.delayPenalty)}`,
      value: delaysCost,
      icon: Clock,
      tone: "danger" as const,
    },
    {
      label: "Retrabalho",
      formula: `${data.reworkPercentage.toFixed(1).replace(".", ",")}% das entregas`,
      value: data.reworkCost,
      icon: Repeat,
      tone: "warning" as const,
    },
  ];

  const returnsShare = totalImpact > 0 ? (returnsCost / totalImpact) * 100 : 0;

  return (
    <Section
      id="impacto-financeiro"
      title="Impacto financeiro do período"
      description="Quanto as devoluções, os atrasos e o retrabalho custaram."
    >
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {impactItems.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} format={formatCurrency} icon={item.icon} tone={item.tone} hint={item.formula} />
        ))}
        <StatCard
          label="Impacto total"
          value={totalImpact}
          format={formatCurrency}
          icon={TrendingDown}
          tone="danger"
          hint="Perda somada no período"
          className="border-destructive/30"
        />
      </div>

      <Alert variant="warning">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>Onde economizar</AlertTitle>
        <AlertDescription>
          As devoluções são <span className="font-medium text-foreground">{returnsShare.toFixed(0).replace(".", ",")}%</span> do impacto.
          Reduzir as devoluções em 10% economizaria cerca de{" "}
          <span className="font-medium text-foreground">{formatCurrency(returnsCost * 0.1)}</span> no período.
        </AlertDescription>
      </Alert>
    </Section>
  );
}
