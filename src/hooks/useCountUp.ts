import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, readPreferences } from "@/lib/preferences";

/**
 * Numero que "corre" ate o valor (KPIs). Respeita movimento reduzido. Valores
 * nao numericos passam direto.
 */
export function useCountUp(value: number, duration = 700): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (!Number.isFinite(value) || prefersReducedMotion(readPreferences())) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(from + (value - from) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return display;
}
