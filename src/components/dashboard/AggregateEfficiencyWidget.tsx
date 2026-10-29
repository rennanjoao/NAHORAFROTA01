import { Crown, Lock, Percent } from "lucide-react";
import { StatCard, type Tone } from "@/components/patterns";
import { SLABar } from "./SLAParts";

interface AggregateEfficiencyWidgetProps {
  freightValue: number;
  totalSalesValue: number;
  allowed: boolean;
  upgradePlanLabel: string;
}

/** Faixas do frete sobre vendas: ate 20% bom, ate 40% atencao, acima disso alto. */
function efficiencyTone(percentage: number): { tone: Tone; label: string } {
  if (percentage <= 20) return { tone: "success", label: "Dentro do esperado" };
  if (percentage <= 40) return { tone: "warning", label: "Atenção ao custo" };
  return { tone: "danger", label: "Custo alto" };
}

const formatPercent = (value: number) => `${value.toFixed(1).replace(".", ",")}%`;

/** Quanto o frete pesa sobre o valor das notas carregadas hoje. */
export function AggregateEfficiencyWidget({ freightValue, totalSalesValue, allowed, upgradePlanLabel }: AggregateEfficiencyWidgetProps) {
  const freight = Math.max(0, freightValue || 0);
  const sales = Math.max(0, totalSalesValue || 0);
  const percentage = sales > 0 ? Math.max(0, (freight / sales) * 100) : 0;

  if (!allowed) {
    return (
      <StatCard
        label="Frete sobre vendas"
        value="—"
        icon={Lock}
        tone="neutral"
        hint={
          <span className="inline-flex items-center gap-1">
            Disponível no plano
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <Crown className="h-3 w-3" aria-hidden="true" />
              {upgradePlanLabel}
            </span>
          </span>
        }
      />
    );
  }

  const { tone, label } = efficiencyTone(percentage);

  return (
    <StatCard className="max-sm:gap-2 max-sm:p-4" label="Frete sobre vendas" value={percentage} format={formatPercent} icon={Percent} tone={tone} hint={`${label} · ideal até 20%`}>
      <SLABar value={Math.min(percentage, 100)} tone={tone} className="h-1.5" />
    </StatCard>
  );
}
