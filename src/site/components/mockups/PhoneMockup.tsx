import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Camera, PenLine, Check, Navigation, Signal, Wifi, BatteryFull, MapPin, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const STOPS = [
  { n: 9, who: "Mercado Bom Preço", addr: "R. das Flores, 120 · Osasco", nf: "48213" },
  { n: 10, who: "Drogaria Central", addr: "Av. dos Autonomistas, 2330", nf: "48219" },
  { n: 11, who: "Padaria Nova Era", addr: "R. Erasmo Braga, 44 · Carapicuíba", nf: "48225" },
];

/** App do motorista em miniatura. Alterna entre "próxima parada" e "entregue" a cada 4 s. */
export function PhoneMockup({ className, static: isStatic = false, step: controlled }: { className?: string; static?: boolean; /** Tela fixada de fora (ex.: pela rolagem). */ step?: 0 | 1 | 2 }) {
  const reduce = useReducedMotion();
  const [auto, setAuto] = useState(0); // 0 = próxima parada, 1 = confirmando, 2 = entregue
  const step = controlled ?? auto;
  useEffect(() => {
    if (reduce || isStatic || controlled !== undefined) return;
    const id = window.setInterval(() => setAuto((s) => (s + 1) % 3), 2600);
    return () => window.clearInterval(id);
  }, [reduce, isStatic, controlled]);
  const [h, m] = [new Date().getHours(), new Date().getMinutes()];
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  return (
    <div
      className={cn("relative aspect-[9/19] w-[260px] rounded-[2.4rem] border-[6px] border-nhf-ink bg-nhf-ink shadow-lift dark:border-nhf-lead", className)}
      role="img"
      aria-label="App do motorista: romaneio com 14 entregas, próxima parada com endereço e botão de confirmar entrega com foto e assinatura."
    >
      <div aria-hidden="true" className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-nhf-ink" />
      <div aria-hidden="true" className="flex h-full w-full flex-col overflow-hidden rounded-[2rem] bg-nhf-ink text-white">
        {/* status bar */}
        <div className="flex items-center justify-between px-5 pb-1 pt-3 font-data text-[10px] font-semibold">
          <span>{time}</span>
          <span className="flex items-center gap-1 text-white/80">
            <Signal className="h-3 w-3" /> <Wifi className="h-3 w-3" /> <BatteryFull className="h-3 w-3" />
          </span>
        </div>

        {/* header */}
        <div className="px-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-caps text-[9px] text-white/55">Romaneio #1042</p>
              <p className="font-heading text-sm font-bold">14 entregas · agregado</p>
            </div>
            <span className="flex items-center gap-1 rounded border border-nhf-green/50 bg-nhf-green/10 px-1.5 py-0.5 font-data text-[9px] uppercase tracking-wider text-nhf-green">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-nhf-green" /> GPS
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-nhf-green"
              initial={{ width: "57%" }}
              animate={{ width: step === 2 ? "64%" : "57%" }}
              transition={{ duration: 0.6 }}
            />
          </div>
          <p className="mt-1 font-data text-[10px] text-white/60">
            {step === 2 ? "9" : "8"} de 14 entregues · SLA no prazo
          </p>
        </div>

        {/* próxima parada */}
        <div className="px-4 pt-3">
          <div className="relative overflow-hidden rounded border border-white/10 bg-white/[0.05] p-3">
            <AnimatePresence mode="wait" initial={false}>
              {step < 2 ? (
                <motion.div key="next" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                  <p className="label-caps text-[9px] text-nhf-green">Próxima parada · 9/14</p>
                  <p className="mt-1 font-heading text-[13px] font-bold leading-tight">{STOPS[0].who}</p>
                  <p className="mt-0.5 flex items-start gap-1 text-[11px] leading-snug text-white/65">
                    <MapPin className="mt-px h-3 w-3 shrink-0" /> {STOPS[0].addr}
                  </p>
                  <div className="mt-2 flex items-center justify-between font-data text-[10px] text-white/60">
                    <span>NF {STOPS[0].nf} · 6 vol.</span>
                    <span className="flex items-center gap-1 text-nhf-green"><Navigation className="h-3 w-3" /> 1,2 km</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <span className="flex items-center justify-center gap-1 rounded border border-white/15 py-1.5 text-[10px] font-semibold text-white/85">
                      <Camera className="h-3 w-3" /> Foto
                    </span>
                    <span className="flex items-center justify-center gap-1 rounded border border-white/15 py-1.5 text-[10px] font-semibold text-white/85">
                      <PenLine className="h-3 w-3" /> Assinatura
                    </span>
                  </div>
                  <motion.span
                    className="nhf-chamfer nhf-chamfer-sm mt-2 flex h-10 w-full items-center justify-center gap-1.5 bg-nhf-green font-heading text-[12px] font-bold text-nhf-ink"
                    animate={step === 1 ? { scale: [1, 0.97, 1] } : { scale: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Check className="h-3.5 w-3.5" /> {step === 1 ? "Confirmando…" : "Confirmar entrega"}
                  </motion.span>
                </motion.div>
              ) : (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center py-3 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-nhf-green text-nhf-ink">
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </span>
                  <p className="mt-2.5 font-heading text-[13px] font-bold">Entrega confirmada</p>
                  <p className="mt-0.5 font-data text-[10px] uppercase tracking-wider text-nhf-green">{time} · NF 48213</p>
                  <p className="mt-1 text-[10px] text-white/60">Foto e assinatura enviadas ao painel.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* próximas */}
        <div className="flex-1 px-4 pt-3">
          <p className="label-caps text-[9px] text-white/50">Depois</p>
          <ul className="mt-1.5 space-y-1.5">
            {STOPS.slice(1).map((s) => (
              <li key={s.n} className="flex items-center gap-2 rounded border border-white/[0.07] px-2.5 py-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-white/10 font-data text-[10px] font-bold">{s.n}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold">{s.who}</span>
                  <span className="block truncate text-[10px] text-white/55">{s.addr}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ocorrência + tab bar */}
        <div className="px-4 pb-3">
          <span className="flex items-center justify-center gap-1.5 rounded border border-nhf-alert/40 py-1.5 text-[10px] font-semibold text-nhf-alert">
            <AlertTriangle className="h-3 w-3" /> Registrar ocorrência
          </span>
        </div>
        <div className="mx-auto mb-2 h-1 w-24 rounded-full bg-white/30" />
      </div>
    </div>
  );
}
