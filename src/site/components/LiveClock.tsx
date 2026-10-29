import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function fmt(d: Date, seconds: boolean) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return seconds ? `${h}:${m}:${s}` : `${h}:${m}`;
}

/** Marcador de hora da marca: ponto pulsando + hora atual em caixa alta. */
export function LiveClock({ label = "Ao vivo", seconds = true, className }: { label?: string; seconds?: boolean; className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className={cn("nhf-live", className)} role="timer" aria-live="off" aria-label={`${label}, ${fmt(now, false)}`}>
      <span>{label}</span>
      <span aria-hidden="true" className="opacity-50">·</span>
      <span className="tabular-nums">{fmt(now, seconds)}</span>
    </span>
  );
}
