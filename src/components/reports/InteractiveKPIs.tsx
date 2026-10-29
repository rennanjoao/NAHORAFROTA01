import { ArrowDownRight, ArrowUpRight, Package, Target, Wallet } from "lucide-react";
import { StatCard, type Tone } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatSLA } from "@/lib/formatSLA";
import { getSLAColorScheme } from "@/lib/slaThresholds";
import { cn } from "@/lib/utils";
import { DrilldownType } from "./KPIDrilldownSheet";

/** Tendencias: null quando o periodo anterior nao tem dados para comparar. */
interface KPIData {
  /** null: nenhuma entrega finalizada no periodo. */
  sla: number | null;
  slaTrend: number | null;
  onTime: number;
  onTimeTrend: number | null;
  delayed: number;
  delayedTrend: number | null;
  returns: number;
  returnsTrend: number | null;
  /** null: nenhuma entrega no periodo. */
  avgCost: number | null;
  avgCostTrend: number | null;
  totalVolume: number;
  volumeTrend: number | null;
}

interface InteractiveKPIsProps {
  data: KPIData;
  viewMode: "operational" | "executive";
  onKPIClick: (type: DrilldownType) => void;
  loading?: boolean;
}

const slaTone: Record<string, Tone> = { excellent: "success", good: "warning", attention: "warning", critical: "danger" };

/** Variacao do SLA em pontos percentuais (p.p.), no mesmo estilo do StatCard. */
const NO_PREVIOUS = "Sem dados do período anterior";

function PointsTrend({ value }: { value: number | null }) {
  if (value === null) return <>{NO_PREVIOUS}</>;
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

// Sem variacao (ou sem periodo anterior), nada de seta vermelha/verde: so o texto.
const trendProps = (value: number | null, upIsGood: boolean) =>
  value === null
    ? { hint: NO_PREVIOUS }
    : Math.abs(value) < 0.05
    ? { hint: "Igual ao período anterior" }
    : { trend: { value, label: "vs. período anterior", upIsGood } };

/** Indicadores do periodo. Clique abre a lista de notas que formam o numero. */
export function InteractiveKPIs({ data, onKPIClick, loading }: InteractiveKPIsProps) {
  const scheme = data.sla === null ? null : getSLAColorScheme(data.sla);

  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        label="SLA geral"
        value={data.sla ?? "—"}
        format={(v) => `${formatSLA(v)}%`}
        icon={Target}
        tone={scheme ? slaTone[scheme.level] ?? "brand" : "neutral"}
        hint={loading ? undefined : scheme ? <PointsTrend value={data.slaTrend} /> : "Sem entregas finalizadas no período"}
        loading={loading}
        onClick={() => onKPIClick("sla")}
      >
        <span className="sr-only">{scheme ? `Situação: ${scheme.labelPt}. ` : ""}Abrir detalhes.</span>
      </StatCard>
      <StatCard
        label="Custo médio por entrega"
        value={data.avgCost ?? "—"}
        format={formatCurrency}
        icon={Wallet}
        tone="brand"
        {...(loading ? {} : data.avgCost === null ? { hint: "Sem entregas no período" } : trendProps(data.avgCostTrend, false))}
        loading={loading}
        onClick={() => onKPIClick("cost")}
      >
        <span className="sr-only">Abrir detalhes.</span>
      </StatCard>
      <StatCard
        label="Notas no período"
        value={data.totalVolume}
        icon={Package}
        tone="info"
        // Com 2 colunas, o terceiro cartao ocupa a linha toda (antes ficava sozinho pela metade).
        className="sm:col-span-2 xl:col-span-1"
        {...(loading ? {} : trendProps(data.volumeTrend, true))}
        loading={loading}
        onClick={() => onKPIClick("volume")}
      >
        <span className="sr-only">Abrir detalhes.</span>
      </StatCard>
    </div>
  );
}
