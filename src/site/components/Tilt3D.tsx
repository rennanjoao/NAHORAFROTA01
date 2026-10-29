import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  /** Inclinação máxima em graus. */
  max?: number;
  /** Inclinação de repouso (dá a sensação de "mesa" do painel). */
  restX?: number;
  restY?: number;
};

/** Perspectiva 3D que segue o ponteiro. Fica parada com reduced-motion ou toque. */
export function Tilt3D({ children, className, max = 7, restX = 8, restY = -10 }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const rX = wide ? restX : 0;
  const rY = wide ? restY : 0;
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 120, damping: 18, mass: 0.6 });
  const rotateX = useTransform(sy, (v) => rX - v * max);
  const rotateY = useTransform(sx, (v) => rY + v * max);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType === "touch" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    py.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={cn("perspective-1600", className)}>
      <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}
