import { useRef, type ReactNode, type PointerEvent, type ElementType } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** Raio do foco em px. */
  radius?: number;
};

/**
 * Superficie com foco de luz que segue o ponteiro (borda e brilho). Feita com
 * variaveis CSS, sem re-render por movimento. Ver .spot e .spot-border no index.css.
 */
export function Spotlight({ children, className, as: Tag = "div", radius = 320 }: Props) {
  const ref = useRef<HTMLElement>(null);
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
  };
  return (
    <Tag ref={ref} onPointerMove={onMove} className={cn("spot", className)} style={{ ["--spot-r" as string]: `${radius}px` }}>
      {children}
    </Tag>
  );
}
