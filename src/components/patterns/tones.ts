/**
 * Cores com significado fixo (manual da marca). Use sempre por estes nomes:
 * - success: no prazo, entregue, ativo, pago
 * - warning: atencao, pendente, vencendo
 * - danger: atraso, ocorrencia, erro, bloqueado
 * - info: em rota, em transito, informacao
 * - neutral: inativo, finalizado, sem dado
 * - brand: destaque da marca (sem significado de status)
 */
export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

export const toneText: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  brand: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
};

export const toneSoftBg: Record<Tone, string> = {
  neutral: "bg-muted",
  brand: "bg-primary/10",
  success: "bg-success/10",
  warning: "bg-warning/10",
  danger: "bg-destructive/10",
  info: "bg-info/10",
};

export const toneDot: Record<Tone, string> = {
  neutral: "bg-idle",
  brand: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
};

export const toneBorder: Record<Tone, string> = {
  neutral: "border-border",
  brand: "border-primary/30",
  success: "border-success/30",
  warning: "border-warning/30",
  danger: "border-destructive/30",
  info: "border-info/30",
};
