import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";
import { toneSoftBg, toneText, type Tone } from "./tones";

const toneBar: Record<Tone, string> = {
  neutral: "bg-gradient-to-r from-transparent via-foreground/15 to-transparent",
  brand: "bg-gradient-to-r from-transparent via-brand to-transparent",
  success: "bg-gradient-to-r from-transparent via-success to-transparent",
  warning: "bg-gradient-to-r from-transparent via-warning to-transparent",
  danger: "bg-gradient-to-r from-transparent via-destructive to-transparent",
  info: "bg-gradient-to-r from-transparent via-info to-transparent",
};

interface StatCardProps {
  label: string;
  value: number | string;
  /** Formata o numero (ex.: moeda). Padrao: inteiro em pt-BR. */
  format?: (value: number) => string;
  icon?: LucideIcon;
  tone?: Tone;
  /** Linha curta abaixo do numero ("3 notas em transito"). */
  hint?: ReactNode;
  /** Variacao contra o periodo anterior, em %. */
  trend?: { value: number; label?: string; upIsGood?: boolean };
  onClick?: () => void;
  href?: string;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
}

const defaultFormat = (value: number) => Math.round(value).toLocaleString("pt-BR");

function AnimatedValue({ value, format }: { value: number; format: (value: number) => string }) {
  const display = useCountUp(value);
  return <>{format(display)}</>;
}

/** Cartao de indicador (KPI). Clicavel quando abre detalhes. */
export function StatCard({
  label,
  value,
  format = defaultFormat,
  icon: Icon,
  tone = "brand",
  hint,
  trend,
  onClick,
  href,
  loading,
  className,
  children,
}: StatCardProps) {
  const interactive = Boolean(onClick || href);
  // Variacao zero e neutra (nem boa nem ruim).
  const trendFlat = trend ? Math.abs(trend.value) < 0.05 : false;
  const trendGood = trend ? (trend.value > 0) === (trend.upIsGood ?? true) : false;
  const TrendIcon = trendFlat ? ArrowRight : trend && trend.value < 0 ? ArrowDownRight : ArrowUpRight;

  const body = (
    <>
      {/* Altura fixa (a do icone): rotulo em 2 linhas nao desalinha os numeros da fileira. */}
      <div className="flex min-h-9 items-start justify-between gap-2 min-[400px]:gap-3">
        <p className="min-w-0 hyphens-auto text-sm font-medium leading-tight text-muted-foreground">{label}</p>
        {Icon && (
          <span
            aria-hidden="true"
            className={cn(
              // Menor no celular estreito: rotulo de uma palavra longa ("Disponiveis") cabe ao lado.
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md min-[400px]:h-10 min-[400px]:w-10 min-[400px]:rounded-xl",
              toneSoftBg[tone],
              toneText[tone],
            )}
          >
            <Icon className="h-4 w-4 min-[400px]:h-[1.125rem] min-[400px]:w-[1.125rem]" />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-1 h-9 w-24" />
      ) : (
        <p className="font-data text-[2rem] font-semibold leading-none tracking-tight text-foreground min-[400px]:text-[2.25rem]">
          {typeof value === "number" ? <AnimatedValue value={value} format={format} /> : value}
        </p>
      )}
      {(hint || trend) && (
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-sm">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
                trendFlat ? "bg-muted text-muted-foreground" : trendGood ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              <TrendIcon className="h-3 w-3" aria-hidden="true" />
              {Math.abs(trend.value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              <span className="sr-only">{trendFlat ? "sem variação" : trend.value > 0 ? "a mais" : "a menos"}</span>
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
          {trend?.label && <span className="text-muted-foreground">{trend.label}</span>}
        </div>
      )}
      {children}
      {/* filete na cor do indicador, no topo */}
      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-70", toneBar[tone])} />
      {interactive && (
        <ChevronRight
          aria-hidden="true"
          className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground opacity-0 transition-all duration ease-out group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      )}
    </>
  );

  const classes = cn(
    "group relative isolate flex h-full min-h-[8.5rem] flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm min-[400px]:p-5",
    interactive && "card-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    className,
  );

  if (href) {
    return (
      <Link to={href} className={classes}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {body}
      </button>
    );
  }
  return <div className={classes}>{body}</div>;
}
