import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toneDot, toneSoftBg, toneText, type Tone } from "./tones";

interface StatusBadgeProps {
  tone: Tone;
  children: ReactNode;
  /** Ponto pulsando: so para "ao vivo"/"em rota agora". */
  pulse?: boolean;
  className?: string;
}

/** Status = ponto + texto (manual da marca). Nunca so cor: o texto diz o estado. */
export function StatusBadge({ tone, children, pulse, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneSoftBg[tone],
        toneText[tone],
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
        {pulse && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", toneDot[tone])} />}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", toneDot[tone])} />
      </span>
      {children}
    </span>
  );
}
