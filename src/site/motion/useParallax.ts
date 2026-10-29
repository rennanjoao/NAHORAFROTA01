import { useEffect, type RefObject } from "react";

/**
 * Escreve --px e --py (-1 a 1) no elemento, seguindo o ponteiro dentro da area
 * `bounds` com suavizacao. As camadas usam essas variaveis em transform (so CSS,
 * sem re-render). Desligado no toque e com reduced-motion.
 */
export function useParallax(target: RefObject<HTMLElement>, bounds?: RefObject<HTMLElement>, ease = 0.075) {
  useEffect(() => {
    const el = target.current;
    const area = bounds?.current ?? el;
    if (!el || !area) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const tick = () => {
      x += (tx - x) * ease;
      y += (ty - y) * ease;
      el.style.setProperty("--px", x.toFixed(4));
      el.style.setProperty("--py", y.toFixed(4));
      raf = Math.abs(tx - x) > 0.0008 || Math.abs(ty - y) > 0.0008 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      const r = area.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (inside) {
        tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
        ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      } else {
        tx = 0;
        ty = 0;
      }
      kick();
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [target, bounds, ease]);
}
