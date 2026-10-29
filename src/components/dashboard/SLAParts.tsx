/**
 * Pecas visuais do SLA reaproveitadas nos cartoes e janelas do painel.
 */
import { useEffect, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { toneDot, toneText, type Tone } from "@/components/patterns";
import { formatSLA } from "@/lib/formatSLA";
import { cn } from "@/lib/utils";

const COMPARED = {
  yesterday: { versus: "de ontem", stable: "Igual a ontem" },
  lastWeek: { versus: "da semana anterior", stable: "Igual à semana anterior" },
};

/** Variacao contra o periodo anterior em palavras ("2,1% acima de ontem"). */
export function SLATrend({ trend, diff, compared }: { trend: "up" | "down" | "stable"; diff: number; compared: keyof typeof COMPARED }) {
  const words = COMPARED[compared];
  if (trend === "stable") {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {words.stable}
      </span>
    );
  }
  const up = trend === "up";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-start gap-1 text-sm font-medium", up ? "text-success" : "text-destructive")}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {formatSLA(Math.abs(diff))}% {up ? "acima" : "abaixo"} {words.versus}
      </span>
    </span>
  );
}

/** Anel de progresso do SLA, com o numero no meio. */
export function SLARing({
  value,
  tone,
  label,
  size = 112,
  display,
}: {
  value: number;
  tone: Tone;
  label: string;
  size?: number;
  /** Texto no meio no lugar do numero (ex.: "—" sem entregas). */
  display?: string;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // Comeca vazio e enche ate o valor (sem animacao com "reduzir movimento", via CSS).
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div role="img" aria-label={label} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(shown / 100) * circumference} ${circumference}`}
          className={cn("transition-[stroke-dasharray] duration-700 ease-out", toneText[tone])}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-data text-2xl font-semibold tracking-tight text-foreground" aria-hidden="true">
        {display ?? `${formatSLA(value)}%`}
      </span>
    </div>
  );
}

/** Linha de aviso curta: ponto da cor do status + frase. */
export function SLANote({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-foreground">
      <span aria-hidden="true" className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", toneDot[tone])} />
      <span>{children}</span>
    </li>
  );
}

/** Barra do SLA com a marca da meta. Decorativa: o numero ja esta escrito ao lado. */
export function SLABar({ value, tone, goal, className }: { value: number; tone: Tone; goal?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative h-2 w-full rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-slow ease-out", toneDot[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
      {goal !== undefined && (
        <span className="absolute -top-1 bottom-[-0.25rem] w-0.5 rounded-full bg-foreground/60" style={{ left: `calc(${goal}% - 1px)` }} />
      )}
    </div>
  );
}
