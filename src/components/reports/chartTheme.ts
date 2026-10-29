import type { CSSProperties } from "react";

/**
 * Tema dos graficos (recharts) com tokens: acompanha o tema claro/escuro sem
 * cor fixa. Series em ordem fixa (chart-1..5); cores com significado
 * (success = bom, destructive = ruim) so quando o dado e bom/ruim.
 */
export const SERIES = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

export const GOOD = "hsl(var(--success))";
export const BAD = "hsl(var(--destructive))";
export const MUTED = "hsl(var(--muted-foreground))";

/** Grade em linha fina e solida, um tom acima do fundo. */
export const gridProps = { stroke: "hsl(var(--border))", strokeDasharray: undefined } as const;

export const axisTick = { fill: "hsl(var(--muted-foreground))", fontSize: 12 } as const;
export const axisLine = { stroke: "hsl(var(--border))" } as const;

export const tooltipStyle: CSSProperties = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
  boxShadow: "var(--shadow-md)",
};

export const tooltipLabelStyle: CSSProperties = { color: "hsl(var(--popover-foreground))", fontWeight: 600, marginBottom: 4 };
export const tooltipItemStyle: CSSProperties = { color: "hsl(var(--popover-foreground))", padding: 0 };
export const tooltipCursor = { fill: "hsl(var(--muted))", opacity: 0.6 } as const;

/** Numero em pt-BR com virgula decimal. */
export const fmtNumber = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtPercent = (value: number, digits = 1) => `${fmtNumber(value, digits)}%`;
