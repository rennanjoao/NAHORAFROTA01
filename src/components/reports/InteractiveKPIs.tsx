import { ArrowDownRight, ArrowUpRight, Package, Target, Wallet } from "lucide-react";
import { StatCard, type Tone } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatSLA } from "@/lib/formatSLA";
import { getSLAColorScheme } from "@/lib/slaThresholds";
import { cn } from "@/lib/utils";
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

const slaTone: Record<string, Tone> = { excellent: "success", good: "warning", attention: "warning", critical: "danger" };

/** Variacao do SLA em pontos percentuais (p.p.), no mesmo estilo do StatCard. */
function PointsTrend({ value }: { value: number }) {
  if (Math.abs(value) < 0.05) return <>Igual ao período anterior</>;
  const good = value >= 0;
  const Icon = value < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
          good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
        )}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        {formatSLA(Math.abs(value))} p.p.
        <span className="sr-only">{good ? "a mais" : "a menos"}</span>
      </span>
      <span>vs. período anterior</span>
    </span>
  );
}

// Sem variacao, nada de seta vermelha/verde: so o texto.
const trendProps = (value: number, upIsGood: boolean) =>
  Math.abs(value) < 0.05
    ? { hint: "Igual ao período anterior" }
    : { trend: { value, label: "vs. período anterior", upIsGood } };

/** Indicadores do periodo. Clique abre a lista de notas que formam o numero. */
export function InteractiveKPIs({ data, onKPIClick }: InteractiveKPIsProps) {
  const scheme = getSLAColorScheme(data.sla);

  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        label="SLA geral"
        value={data.sla}
        format={(v) => `${formatSLA(v)}%`}
        icon={Target}
        tone={slaTone[scheme.level] ?? "brand"}
        hint={<PointsTrend value={data.slaTrend} />}
        onClick={() => onKPIClick("sla")}
      >
        <span className="sr-only">Situação: {scheme.labelPt}. Abrir detalhes.</span>
      </StatCard>
      <StatCard
        label="Custo médio por entrega"
        value={data.avgCost}
        format={formatCurrency}
        icon={Wallet}
        tone="brand"
        {...trendProps(data.avgCostTrend, false)}
        onClick={() => onKPIClick("cost")}
      >
        <span className="sr-only">Abrir detalhes.</span>
      </StatCard>
      <StatCard
        label="Notas no período"
        value={data.totalVolume}
        icon={Package}
        tone="info"
        {...trendProps(data.volumeTrend, true)}
        onClick={() => onKPIClick("volume")}
      >
        <span className="sr-only">Abrir detalhes.</span>
      </StatCard>
    </div>
  );
}
