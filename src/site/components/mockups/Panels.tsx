import { motion, useReducedMotion } from "framer-motion";
import { Camera, Check, Filter, MapPin, Route, Sparkles, Wallet, Copy, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { RouteMap } from "./RouteMap";

/* Telas do produto usadas na historia rolavel. Todas decorativas (o palco tem role="img"). */

const frame = "overflow-hidden rounded-lg border border-foreground/12 bg-card text-card-foreground [box-shadow:inset_0_1px_0_0_hsl(var(--foreground)/0.06)]";

function Chrome({ title, children, chip }: { title: string; children: React.ReactNode; chip?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-foreground/10 bg-background/70 px-4 py-2.5">
      <span className="flex items-center gap-2 font-data text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{children} {title}</span>
      {chip && <span className="flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 font-data text-[9px] uppercase tracking-wider text-brand"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> {chip}</span>}
    </div>
  );
}

export function MapPanel({ className }: { className?: string }) {
  return (
    <div className={cn(frame, className)}>
      <Chrome title="Mapa ao vivo" chip="14 veículos">
        <MapPin className="h-3.5 w-3.5 text-brand" />
      </Chrome>
      <div className="relative">
        <div className="absolute left-3 top-3 z-10 flex gap-1.5">
          {["Todos", "Em rota", "Atrasados"].map((f, i) => (
            <span key={f} className={cn("rounded border px-2 py-1 font-data text-[9px] uppercase tracking-wider backdrop-blur", i === 0 ? "border-brand/60 bg-brand/15 text-brand" : "border-foreground/15 bg-background/70 text-muted-foreground")}>{f}</span>
          ))}
        </div>
        <div className="absolute right-3 top-3 z-10 rounded border border-foreground/10 bg-background/80 p-2.5 font-data text-[10px] backdrop-blur">
          <p className="text-brand">ABC1D23 · João</p>
          <p className="text-muted-foreground">8/14 · 1,2 km da próxima</p>
          <p className="text-muted-foreground">Atualizado há 12 s</p>
        </div>
        <div className="aspect-[16/10]">
          <RouteMap />
        </div>
      </div>
    </div>
  );
}

const ROWS = [
  ["48213", "Mercado Bom Preço", "Osasco", "6", "08:40"],
  ["48219", "Drogaria Central", "Osasco", "2", "09:05"],
  ["48225", "Padaria Nova Era", "Carapicuíba", "9", "09:50"],
  ["48230", "Loja Casa & Cia", "Barueri", "4", "10:30"],
  ["48231", "Atacado Paulista", "Barueri", "12", "11:10"],
];

export function ManifestPanel({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn(frame, className)}>
      <Chrome title="Romaneio #1044 · montando" chip="XML em lote">
        <Route className="h-3.5 w-3.5 text-brand" />
      </Chrome>
      <div className="p-4 font-data text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">14 notas importadas · 48 km · 2h50</span>
          <span className="flex items-center gap-1.5 rounded border border-brand/40 bg-brand/10 px-2 py-1 text-[10px] text-brand"><Sparkles className="h-3 w-3" /> Ordem otimizada</span>
        </div>
        <div className="mt-3 grid grid-cols-[48px_1fr_84px_28px_44px] gap-2 label-caps text-[9px] text-muted-foreground">
          <span>NF</span><span>Cliente</span><span>Cidade</span><span>Vol</span><span className="text-right">Prev.</span>
        </div>
        <ul className="mt-1.5 space-y-1.5">
          {ROWS.map((r, i) => (
            <motion.li
              key={r[0]}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-[48px_1fr_84px_28px_44px] items-center gap-2 rounded border border-foreground/5 bg-background/60 px-2 py-2"
            >
              <span className="text-brand">{r[0]}</span>
              <span className="truncate font-sans text-foreground/85">{r[1]}</span>
              <span className="truncate text-muted-foreground">{r[2]}</span>
              <span className="text-right">{r[3]}</span>
              <span className="text-right text-muted-foreground">{r[4]}</span>
            </motion.li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded border border-foreground/10 bg-background/60 p-3">
          <div className="grid grid-cols-3 gap-3 text-[10px]">
            <span><span className="block text-muted-foreground">Motorista</span><span className="font-sans text-foreground">João Silva · ABC1D23</span></span>
            <span><span className="block text-muted-foreground">Frota</span><span className="font-sans text-foreground">Agregado</span></span>
            <span><span className="block text-muted-foreground">Frete</span><span className="text-foreground">R$ 520,00</span></span>
          </div>
          <span className="nhf-chamfer nhf-chamfer-sm bg-brand px-3 py-2 font-heading text-[11px] font-bold text-nhf-ink">Despachar</span>
        </div>
      </div>
    </div>
  );
}

export function ProofPanel({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn(frame, className)}>
      <Chrome title="Canhoto digital · NF 48213" chip="Confirmada 14:32">
        <Camera className="h-3.5 w-3.5 text-brand" />
      </Chrome>
      <div className="grid gap-4 p-4 md:grid-cols-[1.1fr_1fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded border border-foreground/10 bg-gradient-to-br from-foreground/20 via-foreground/10 to-foreground/5">
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_60%,hsl(var(--brand)/0.12),transparent)]" />
          <span className="absolute left-3 top-3 rounded bg-background/80 px-2 py-1 font-data text-[9px] uppercase tracking-wider backdrop-blur">Foto · 14:32:08</span>
          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded bg-background/80 px-2 py-1 font-data text-[9px] backdrop-blur"><MapPin className="h-3 w-3 text-brand" /> -23.532, -46.791</span>
          <Camera className="absolute right-4 top-4 h-5 w-5 text-foreground/40" />
          <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-nhf-ink"><Check className="h-4 w-4" strokeWidth={3} /></span>
        </div>
        <div className="flex flex-col">
          <div className="flex-1 rounded border border-dashed border-foreground/25 p-3">
            <p className="label-caps text-[9px] text-muted-foreground">Assinatura do recebedor</p>
            <svg viewBox="0 0 220 70" className="mt-2 h-20 w-full stroke-foreground" fill="none" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <motion.path
                d="M8 50 C 20 10, 32 60, 48 30 S 70 8, 84 40 S 110 62, 126 28 S 150 4, 164 36 S 190 58, 212 20"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.6, delay: 0.3, ease: "easeInOut" }}
              />
            </svg>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 font-data text-[11px]">
            <div><dt className="label-caps text-[9px] text-muted-foreground">Recebido por</dt><dd className="font-sans text-foreground">Maria Santos</dd></div>
            <div><dt className="label-caps text-[9px] text-muted-foreground">Documento</dt><dd className="text-foreground">***.482.***-**</dd></div>
            <div><dt className="label-caps text-[9px] text-muted-foreground">Motorista</dt><dd className="font-sans text-foreground">João Silva</dd></div>
            <div><dt className="label-caps text-[9px] text-muted-foreground">SLA</dt><dd className="text-brand">No prazo · 18 min antes</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}

export function SettlementPanel({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const items = [
    ["#1042", "14 entregas", 520],
    ["#1038", "11 entregas", 480],
    ["#1031", "16 entregas", 540],
  ] as const;
  return (
    <div className={cn(frame, className)}>
      <Chrome title="Acerto · João Silva · ABC1D23" chip="Semana 44">
        <Wallet className="h-3.5 w-3.5 text-brand" />
      </Chrome>
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1fr]">
        <div className="font-data text-[11px]">
          <p className="label-caps text-[9px] text-muted-foreground">Romaneios do período</p>
          <ul className="mt-2 space-y-1.5">
            {items.map(([id, n, v], i) => (
              <motion.li key={id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="flex items-center justify-between rounded border border-foreground/5 bg-background/60 px-2.5 py-2">
                <span><span className="font-bold text-foreground">{id}</span> <span className="font-sans text-muted-foreground">· {n}</span></span>
                <span className="tabular-nums">R$ {v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </motion.li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground"><ArrowUpDown className="h-3 w-3" /> Adiantamento e descontos lançados pelo despachante</p>
        </div>
        <div className="rounded border border-foreground/10 bg-background/60 p-4 font-data text-[12px]">
          <dl className="space-y-2">
            <div className="flex justify-between"><dt className="font-sans text-muted-foreground">Frete (3 romaneios)</dt><dd className="tabular-nums">R$ 1.540,00</dd></div>
            <div className="flex justify-between"><dt className="font-sans text-muted-foreground">Adiantamento</dt><dd className="tabular-nums text-late">− R$ 300,00</dd></div>
            <div className="flex justify-between"><dt className="font-sans text-muted-foreground">Pedágio</dt><dd className="tabular-nums text-brand">+ R$ 42,00</dd></div>
            <div className="flex justify-between border-t border-foreground/10 pt-2 text-base font-bold"><dt className="font-sans">A pagar</dt><dd className="tabular-nums text-brand">R$ 1.282,00</dd></div>
          </dl>
          <span className="mt-4 flex items-center justify-center gap-2 rounded border border-brand/50 py-2 font-sans text-[11px] font-semibold text-brand"><Copy className="h-3.5 w-3.5" /> Copiar chave Pix</span>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">Histórico guardado por motorista</p>
        </div>
      </div>
    </div>
  );
}

export function FilterHint() {
  return <Filter className="h-3 w-3" />;
}
