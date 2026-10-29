import { brandAvatar } from "@/lib/avatar";
import { initials } from "@/lib/user";
import { cn } from "@/lib/utils";
import type { Tone } from "@/components/patterns";

const sizes = {
  sm: "h-9 w-9 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

const ringTone: Record<Tone, string> = {
  neutral: "ring-border",
  brand: "ring-primary/40",
  success: "ring-success/50",
  warning: "ring-warning/50",
  danger: "ring-destructive/50",
  info: "ring-info/50",
};

/**
 * Foto do motorista ou iniciais. Decorativa: o nome sempre aparece ao lado,
 * entao o leitor de tela nao repete.
 */
export function DriverAvatar({
  name,
  photo,
  size = "md",
  tone,
  className,
}: {
  name?: string | null;
  photo?: string | null;
  size?: keyof typeof sizes;
  /** Anel na cor do status (ex.: SLA). */
  tone?: Tone;
  className?: string;
}) {
  const src = brandAvatar(photo);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary",
        tone && "ring-2 ring-offset-2 ring-offset-card",
        tone && ringTone[tone],
        sizes[size],
        className,
      )}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" /> : initials(name)}
    </span>
  );
}
