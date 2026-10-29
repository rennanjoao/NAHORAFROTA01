import { LayoutDashboard, MapPin, Users, Package, Wallet, BarChart3, Bell, Search, Truck, CheckCircle2, Clock3 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { RouteMap } from "./RouteMap";
import { useCountUp } from "./useCountUp";

function Kpi({ label, value, suffix, prefix, tone }: { label: string; value: number; suffix?: string; prefix?: string; tone?: "brand" | "alert" }) {
  const { ref, value: v } = useCountUp(value);
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="rounded border border-border bg-background/60 px-3 py-2.5">
      <p className="label-caps truncate text-[9px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-data text-base sm:text-lg font-bold leading-none tabular-nums", tone === "brand" && "text-brand", tone === "alert" && "text-alert")}>
        {prefix}
        {v.toLocaleString("pt-BR")}
        {suffix}
      </p>
    </div>
  );
}

const FEED = [
  { t: "14:32", icon: CheckCircle2, text: "ABC1D23 entregou em Osasco", meta: "3 paradas restantes", tone: "text-brand" },
  { t: "14:27", icon: Clock3, text: "GHI4J56 parado há 12 min", meta: "alerta enviado", tone: "text-alert" },
  { t: "14:10", icon: Truck, text: "Romaneio #1043 saiu do pátio", meta: "11 notas · agregado", tone: "text-foreground/80" },
  { t: "13:58", icon: CheckCircle2, text: "DEF7G89 entregou em Barueri", meta: "assinatura + foto", tone: "text-brand" },
];

const SLA_WEEK = [96, 98, 94, 99, 97, 98, 100];

/** Painel do gestor em miniatura: barra lateral, KPIs, mapa ao vivo, SLA e feed. Decorativo. */
export function DashboardMockup({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div
      className={cn("overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-lift", className)}
      role="img"
      aria-label="Painel do gestor: mapa ao vivo com três veículos em rota, indicadores do dia, SLA da semana e feed de eventos."
    >
      {/* barra do navegador */}
      <div aria-hidden="true" className="flex items-center gap-2 border-b border-border bg-background/70 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="ml-3 flex h-6 flex-1 items-center gap-2 rounded bg-muted px-2.5 font-data text-[10px] tracking-wide text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          app.nahorafrota.tech/dashboard
        </span>
      </div>

      <div aria-hidden="true" className="grid grid-cols-[44px_1fr] md:grid-cols-[52px_1fr]">
        {/* sidebar */}
        <div className="flex flex-col items-center gap-3 border-r border-border bg-nhf-ink py-3 text-white/60">
          <span className="mb-1 flex h-7 w-7 items-center justify-center rounded bg-nhf-green/15">
            <svg viewBox="0 0 365 212" className="h-3.5 w-auto fill-nhf-green"><path d="M0,161 L129.22,27.78 A11,11 0 0 1 144.78,27.78 L216.96,99.96 L181.6,135.31 L137,90.71 L70.71,161 Z" /><path d="M117.64,212 L297.64,32 L203,32 L235,0 L365,0 L365,98 L333,130 L333,67.36 L188.36,212 Z" /></svg>
          </span>
          {[LayoutDashboard, MapPin, Users, Package, Wallet, BarChart3].map((I, i) => (
            <span key={i} className={cn("flex h-7 w-7 items-center justify-center rounded", i === 0 && "bg-white/10 text-nhf-green")}>
              <I className="h-3.5 w-3.5" />
            </span>
          ))}
        </div>

        <div className="min-w-0">
          {/* topbar */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex h-6 w-40 items-center gap-1.5 rounded bg-muted px-2 text-[10px] text-muted-foreground">
              <Search className="h-3 w-3" /> Buscar placa, motorista…
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded border border-brand/40 bg-brand/10 px-2 py-0.5 font-data text-[9px] uppercase tracking-wider text-brand sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> Ao vivo
              </span>
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand font-data text-[9px] font-bold text-nhf-ink">RJ</span>
            </div>
          </div>

          <div className="space-y-2.5 p-2.5 md:p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Em rota" value={12} tone="brand" />
              <Kpi label="Entregues" value={148} />
              <Kpi label="SLA do dia" value={98} suffix="%" tone="brand" />
              <Kpi label="Frete hoje" value={4320} prefix="R$ " />
            </div>

            <div className="grid gap-2.5 md:grid-cols-[1.5fr_1fr]">
              <div className="relative aspect-[16/10] overflow-hidden rounded border border-border bg-background/50">
                <RouteMap />
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="rounded border border-border bg-background/60 p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="label-caps text-[9px] text-muted-foreground">SLA da semana</p>
                    <p className="font-data text-[11px] font-bold text-brand">97,4%</p>
                  </div>
                  <div className="mt-2 flex h-14 items-end gap-1">
                    {SLA_WEEK.map((v, i) => (
                      <motion.span
                        key={i}
                        className={cn("flex-1 rounded-sm", v < 95 ? "bg-nhf-alert" : "bg-brand")}
                        initial={reduce ? false : { scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 + i * 0.06, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                        style={{ height: `${(v - 80) * 5}%`, transformOrigin: "bottom" }}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between font-data text-[8px] uppercase text-muted-foreground">
                    <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span>
                  </div>
                </div>

                <div className="flex-1 rounded border border-border bg-background/60 p-2.5">
                  <p className="label-caps text-[9px] text-muted-foreground">Agora</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {FEED.map((f, i) => (
                      <motion.li
                        key={i}
                        className="flex items-start gap-2 text-[10px] leading-tight"
                        initial={reduce ? false : { opacity: 0, x: 10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + i * 0.12, duration: 0.5 }}
                      >
                        <span className="font-data text-[9px] font-bold text-brand">{f.t}</span>
                        <f.icon className={cn("mt-px h-3 w-3 shrink-0", f.tone)} />
                        <span className="min-w-0">
                          <span className="block truncate text-foreground/90">{f.text}</span>
                          <span className="block truncate text-[9px] text-muted-foreground">{f.meta}</span>
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
