import { Lock, Crown, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AggregateEfficiencyWidgetProps {
  freightValue: number;
  totalSalesValue: number;
  allowed: boolean;
  upgradePlanLabel: string;
}

function MiniGauge({ percentage }: { percentage: number }) {
  const clamped = Math.min(Math.max(percentage, 0), 100);
  // Arc from 180° (left) to 0° (right) = π to 0
  const radius = 40;
  const strokeWidth = 8;
  const cx = 50;
  const cy = 50;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (clamped / 100) * circumference;

  // Color zones: green < 20%, yellow 20-40%, red > 40%
  const color =
    clamped <= 20
      ? "hsl(var(--success))"
      : clamped <= 40
        ? "hsl(var(--warning))"
        : "hsl(var(--destructive))";

  return (
    <svg width="100" height="58" viewBox="0 0 100 58" className="shrink-0">
      {/* Background arc */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Filled arc */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
      {/* Center text */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        className="fill-foreground text-lg font-bold"
        style={{ fontSize: "16px", fontFamily: "Space Grotesk, sans-serif" }}
      >
        {clamped.toFixed(1)}%
      </text>
    </svg>
  );
}

export function AggregateEfficiencyWidget({
  freightValue,
  totalSalesValue,
  allowed,
  upgradePlanLabel,
}: AggregateEfficiencyWidgetProps) {
  const freight = Math.max(0, freightValue || 0);
  const sales = Math.max(0, totalSalesValue || 0);
  const percentage = sales > 0 ? Math.max(0, (freight / sales) * 100) : 0;

  if (!allowed) {
    return (
      <div className="glass-card rounded-xl p-5 relative overflow-hidden">
        <div className="pointer-events-none select-none opacity-40 blur-[2px]">
          <p className="text-sm text-muted-foreground">Eficiência do Custo Frete</p>
          <div className="flex items-center justify-between mt-2">
            <MiniGauge percentage={0} />
            <TrendingDown className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl z-10">
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground max-w-[180px]">
              Análise de Eficiência do Custo Frete disponível no Plano{" "}
              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                <Crown className="h-3 w-3" />
                {upgradePlanLabel}
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-sm text-muted-foreground">Eficiência do Custo Frete</p>
      <div className="flex items-center gap-3 mt-2">
        <MiniGauge percentage={percentage} />
        <div className="flex-1 min-w-0">
          <p
            className="text-2xl font-bold font-mono"
            style={{ color: "hsl(var(--foreground))" }}
          >
            {percentage.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            do valor total de vendas
          </p>
        </div>
      </div>
    </div>
  );
}
