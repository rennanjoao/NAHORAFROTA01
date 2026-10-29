import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LayoutDashboard, MapPin, Users, Package, Wallet, BarChart3, Bell, Search, Truck, CheckCircle2, Clock3, Route, Car, Settings, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RouteMap } from "./RouteMap";
import { useCountUp } from "./useCountUp";

/* Painel do gestor com fidelidade de produto. Decorativo: role="img" com descricao. */

const NAV = [
  { icon: LayoutDashboard, label: "Início", active: true },
  { icon: Package, label: "Entregas" },
  { icon: Route, label: "Rotas" },
  { icon: Users, label: "Motoristas" },
  { icon: Car, label: "Veículos" },
  { icon: Wallet, label: "Acerto" },
  { icon: BarChart3, label: "Relatórios" },
];

function Spark({ points, tone = "brand" }: { points: number[]; tone?: "brand" | "muted" | "alert" }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const d = points.map((v, i) => `${(i / (points.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(" ");
  const color = tone === "brand" ? "hsl(var(--brand))" : tone === "alert" ? "#FFC53D" : "hsl(var(--foreground) / 0.45)";
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <polyline points={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({ label, value, suffix, prefix, tone, delta, spark, sparkTone }: { label: string; value: number; suffix?: string; prefix?: string; tone?: "brand" | "alert"; delta: string; spark: number[]; sparkTone?: "brand" | "muted" | "alert" }) {
  const { ref, value: v } = useCountUp(value);
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="rounded-md border border-foreground/10 bg-background/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="label-caps truncate text-[9px] text-muted-foreground">{label}</p>
        <span className={cn("rounded-sm px-1 py-px font-data text-[9px] font-semibold", delta.startsWith("+") ? "bg-brand/15 text-brand" : "bg-foreground/10 text-foreground/70")}>{delta}</span>
      </div>
      <p className={cn("mt-1.5 font-data text-xl font-bold leading-none tabular-nums tracking-tight", tone === "brand" && "text-brand", tone === "alert" && "text-alert")}>
        {prefix}
        {v.toLocaleString("pt-BR")}
        {suffix}
      </p>
      <div className="mt-2">
        <Spark points={spark} tone={sparkTone ?? (tone === "brand" ? "brand" : "muted")} />
      </div>
    </div>
  );
}

type Ev = { t: string; icon: typeof CheckCircle2; text: string; meta: string; tone: string };
const POOL: Ev[] = [
  { t: "14:32", icon: CheckCircle2, text: "ABC1D23 entregou em Osasco", meta: "foto + assinatura · 3 paradas restantes", tone: "text-brand" },
  { t: "14:27", icon: Clock3, text: "GHI4J56 parado há 12 min", meta: "alerta enviado ao despachante", tone: "text-alert" },
  { t: "14:10", icon: Truck, text: "Romaneio #1043 saiu do pátio", meta: "11 notas · agregado", tone: "text-foreground/80" },
  { t: "13:58", icon: CheckCircle2, text: "DEF7G89 entregou em Barueri", meta: "NF 48219 · recebido por Carla", tone: "text-brand" },
  { t: "13:41", icon: AlertTriangle, text: "Ocorrência: cliente ausente", meta: "NF 48230 · reagendada", tone: "text-alert" },
  { t: "13:20", icon: CheckCircle2, text: "JKL2M34 entregou em Carapicuíba", meta: "SLA no prazo", tone: "text-brand" },
];

const SLA_WEEK = [96, 98, 94, 99, 97, 98, 100];
const MANIFESTS = [
  { id: "#1042", driver: "João Silva · ABC1D23", stops: "8/14", pct: 57, status: "Em rota", tone: "brand" },
  { id: "#1043", driver: "Marcos Lima · DEF7G89", stops: "3/11", pct: 27, status: "Em rota", tone: "brand" },
  { id: "#1041", driver: "Carlos Souza · GHI4J56", stops: "12/12", pct: 100, status: "Concluído", tone: "muted" },
];

export function DashboardMockup({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [feed, setFeed] = useState<Ev[]>(POOL.slice(0, 4));
  const [n, setN] = useState(4);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setN((k) => {
        const next = POOL[k % POOL.length];
        setFeed((f) => [next, ...f].slice(0, 4));
        return k + 1;
      });
    }, 3400);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div
      className={cn("overflow-hidden rounded-lg border border-foreground/12 bg-card text-card-foreground [box-shadow:inset_0_1px_0_0_hsl(var(--foreground)/0.06)]", className)}
      role="img"
      aria-label="Painel do gestor: mapa ao vivo com veículos em rota, indicadores do dia com tendência, SLA da semana, feed de eventos e romaneios de hoje."
    >
      {/* barra do navegador */}
      <div aria-hidden="true" className="flex items-center gap-2 border-b border-foreground/10 bg-background/70 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="ml-3 flex h-6 flex-1 items-center justify-center gap-2 rounded bg-muted font-data text-[10px] tracking-wide text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          app.nahorafrota.tech/dashboard
        </span>
        <span className="w-12" />
      </div>

      <div aria-hidden="true" className="grid grid-cols-[48px_1fr] lg:grid-cols-[176px_1fr]">
        {/* menu lateral */}
        <div className="flex flex-col border-r border-foreground/10 bg-nhf-ink py-3 text-white/70">
          <div className="mb-3 flex items-center gap-2 px-3 lg:px-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-nhf-green/15">
              <svg viewBox="0 0 365 212" className="h-3.5 w-auto fill-nhf-green"><path d="M0,161 L129.22,27.78 A11,11 0 0 1 144.78,27.78 L216.96,99.96 L181.6,135.31 L137,90.71 L70.71,161 Z" /><path d="M117.64,212 L297.64,32 L203,32 L235,0 L365,0 L365,98 L333,130 L333,67.36 L188.36,212 Z" /></svg>
            </span>
            <span className="hidden font-heading text-[12px] font-bold text-white lg:block">Na Hora <span className="text-nhf-green">Frota</span></span>
          </div>
          <p className="label-caps mb-1 hidden px-4 text-[8px] text-white/35 lg:block">Operação</p>
          {NAV.map((item) => (
            <span key={item.label} className={cn("mx-2 flex items-center gap-2.5 rounded px-2 py-1.5 text-[11px]", item.active ? "bg-white/10 text-nhf-green" : "text-white/60")}>
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </span>
          ))}
          <div className="mt-auto hidden px-4 pt-3 lg:block">
            <span className="flex items-center gap-2 text-[11px] text-white/50"><Settings className="h-3.5 w-3.5" /> Configurações</span>
          </div>
        </div>

        <div className="min-w-0 bg-background/30">
          {/* topo */}
          <div className="flex items-center justify-between gap-3 border-b border-foreground/10 px-3 py-2 lg:px-4">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="hidden sm:inline">Operação</span><ChevronRight className="hidden h-3 w-3 sm:inline" /><span className="font-semibold text-foreground">Início</span>
            </div>
            <div className="hidden h-7 w-44 items-center gap-1.5 rounded border border-foreground/10 bg-muted px-2 text-[10px] text-muted-foreground sm:flex">
              <Search className="h-3 w-3" /> Buscar placa, motorista… <span className="ml-auto rounded border border-foreground/15 px-1 font-data text-[8px]">⌘K</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 font-data text-[9px] uppercase tracking-wider text-brand">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> Ao vivo
              </span>
              <span className="relative"><Bell className="h-3.5 w-3.5 text-muted-foreground" /><span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-nhf-alert" /></span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand font-data text-[9px] font-bold text-nhf-ink">RJ</span>
            </div>
          </div>

          <div className="space-y-3 p-3 lg:p-4">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <Kpi label="Em rota" value={14} tone="brand" delta="+3" spark={[6, 8, 7, 10, 9, 12, 14]} />
              <Kpi label="Entregues hoje" value={148} delta="+22" spark={[20, 46, 71, 93, 118, 132, 148]} sparkTone="muted" />
              <Kpi label="SLA do dia" value={98} suffix="%" tone="brand" delta="+1,2%" spark={[95, 96, 97, 96, 98, 98, 98]} />
              <Kpi label="Frete hoje" value={4320} prefix="R$ " delta="+R$ 640" spark={[800, 1400, 2100, 2600, 3300, 3900, 4320]} sparkTone="muted" />
            </div>

            <div className="grid gap-3 md:grid-cols-[1.55fr_1fr]">
              <div className="relative overflow-hidden rounded-md border border-foreground/10 bg-background/50">
                <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded border border-foreground/10 bg-background/80 px-2 py-1 font-data text-[9px] uppercase tracking-wider backdrop-blur">
                  <MapPin className="h-3 w-3 text-brand" /> Mapa ao vivo · 14 veículos
                </div>
                <div className="aspect-[16/10]">
                  <RouteMap />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="rounded-md border border-foreground/10 bg-background/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="label-caps text-[9px] text-muted-foreground">SLA da semana</p>
                    <p className="font-data text-[11px] font-bold text-brand">97,4%</p>
                  </div>
                  <div className="mt-2 flex h-16 items-end gap-1.5">
                    {SLA_WEEK.map((v, i) => (
                      <motion.span
                        key={i}
                        className={cn("flex-1 rounded-sm", v < 95 ? "bg-nhf-alert" : "bg-brand")}
                        initial={reduce ? false : { scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 + i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        style={{ height: `${(v - 80) * 5}%`, transformOrigin: "bottom" }}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between font-data text-[8px] uppercase text-muted-foreground">
                    <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden rounded-md border border-foreground/10 bg-background/60 p-3">
                  <p className="label-caps text-[9px] text-muted-foreground">Agora</p>
                  <ul className="mt-2 space-y-2">
                    <AnimatePresence initial={false}>
                      {feed.map((f, i) => (
                        <motion.li
                          key={`${f.t}-${f.text}-${n - i}`}
                          layout
                          initial={reduce ? false : { y: -8, height: 0 }}
                          animate={{ y: 0, height: "auto" }}
                          exit={{ height: 0 }}
                          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          className="flex items-start gap-2 overflow-hidden text-[10px] leading-tight"
                        >
                          <span className="font-data text-[9px] font-bold text-brand">{f.t}</span>
                          <f.icon className={cn("mt-px h-3 w-3 shrink-0", f.tone)} />
                          <span className="min-w-0">
                            <span className="block truncate text-foreground/90">{f.text}</span>
                            <span className="block truncate text-[9px] text-muted-foreground">{f.meta}</span>
                          </span>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              </div>
            </div>

            {/* romaneios de hoje */}
            <div className="hidden overflow-hidden rounded-md border border-foreground/10 bg-background/60 md:block">
              <div className="flex items-center justify-between border-b border-foreground/10 px-3 py-2">
                <p className="label-caps text-[9px] text-muted-foreground">Romaneios de hoje</p>
                <span className="font-data text-[9px] text-muted-foreground">3 de 6</span>
              </div>
              <ul>
                {MANIFESTS.map((m) => (
                  <li key={m.id} className="grid grid-cols-[56px_1fr_120px_80px] items-center gap-3 border-b border-foreground/5 px-3 py-2 text-[10px] last:border-0">
                    <span className="font-data font-bold text-foreground">{m.id}</span>
                    <span className="truncate text-foreground/85">{m.driver}</span>
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10"><span className={cn("block h-full rounded-full", m.tone === "brand" ? "bg-brand" : "bg-foreground/40")} style={{ width: `${m.pct}%` }} /></span>
                      <span className="font-data text-[9px] text-muted-foreground">{m.stops}</span>
                    </span>
                    <span className={cn("justify-self-end rounded-sm px-1.5 py-0.5 font-data text-[8px] uppercase tracking-wider", m.tone === "brand" ? "bg-brand/15 text-brand" : "bg-foreground/10 text-foreground/70")}>{m.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
