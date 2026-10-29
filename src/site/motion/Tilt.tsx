import { useRef, type ReactNode, type PointerEvent, type ElementType, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Cartao que inclina em 3D na direcao do ponteiro, com um brilho que segue o
 * cursor. So CSS (variaveis), suavizado por transicao. Nada no toque.
 */
type TiltProps = { children: ReactNode; className?: string; max?: number; as?: ElementType; glare?: boolean } & Omit<HTMLAttributes<HTMLElement>, "onPointerMove" | "onPointerLeave">;

export function Tilt({ children, className, max = 6, as: Tag = "div", glare = true, ...rest }: TiltProps) {
  const ref = useRef<HTMLElement>(null);
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - py) * max * 2}deg`);
    el.style.setProperty("--ry", `${(px - 0.5) * max * 2}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
    el.dataset.active = "true";
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.dataset.active = "false";
  };
  return (
    <Tag ref={ref} {...rest} onPointerMove={onMove} onPointerLeave={onLeave} className={cn("tilt", glare && "tilt-glare", className)}>
      {children}
    </Tag>
  );
}
