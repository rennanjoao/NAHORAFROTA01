import { useId } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_BY_ID, formatLimit, formatPriceShort } from "@/config/plans";
import { recommend, type FinderState } from "./planFinderLogic";
import { Cta } from "./Cta";

function Range({ label, value, min, max, onChange, suffix }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix: string }) {
  const id = useId();
  const shown = value >= max ? `${max}+` : String(value);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <output htmlFor={id} className="font-data text-lg font-bold tabular-nums">{shown} <span className="text-xs font-normal text-muted-foreground">{suffix}</span></output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${shown} ${suffix}`}
        className="range-brand mt-3 w-full"
        style={{ ["--fill" as string]: `${((value - min) / (max - min)) * 100}%` }}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors", checked ? "border-brand bg-brand-soft" : "border-foreground/10 bg-background hover:border-foreground/25")}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2", checked ? "border-brand bg-brand text-nhf-ink" : "border-foreground/30")}>
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}

/** Recomendador: a pessoa diz o tamanho da operacao e o que precisa; o site indica o plano. */
export function PlanFinder({ state, onChange }: { state: FinderState; onChange: (s: FinderState) => void }) {
  const { plan, reasons } = recommend(state);
  const p = PLAN_BY_ID[plan];
  const set = <K extends keyof FinderState>(k: K, v: FinderState[K]) => onChange({ ...state, [k]: v });
  return (
    <div className="site-card grid overflow-hidden lg:grid-cols-[1.25fr_1fr]">
      <div className="space-y-6 p-6 sm:p-8">
        <div>
          <p className="label-caps text-brand">Qual plano é o seu?</p>
          <h3 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Conte o tamanho da operação.</h3>
        </div>
        <Range label="Motoristas" suffix="motoristas" value={state.drivers} min={1} max={300} onChange={(v) => set("drivers", v)} />
        <Range label="Veículos" suffix="veículos" value={state.vehicles} min={1} max={150} onChange={(v) => set("vehicles", v)} />
        <Range label="Pessoas no painel" suffix="usuários" value={state.users} min={1} max={40} onChange={(v) => set("users", v)} />
        <fieldset>
          <legend className="text-sm font-semibold">O que você precisa</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Toggle label="Importar notas em lote (XML)" checked={state.xml} onChange={(v) => set("xml", v)} />
            <Toggle label="SLA por motorista e região" checked={state.sla} onChange={(v) => set("sla", v)} />
            <Toggle label="Acerto automático de agregados" checked={state.acerto} onChange={(v) => set("acerto", v)} />
            <Toggle label="Relatórios financeiros por rota" checked={state.financeiro} onChange={(v) => set("financeiro", v)} />
          </div>
        </fieldset>
      </div>

      <div className="relative flex flex-col justify-between gap-6 bg-nhf-ink p-6 text-white sm:p-8" aria-live="polite">
        <div aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative">
          <p className="flex items-center gap-2 label-caps text-nhf-green">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /> Indicado para você
          </p>
          <p className="mt-3 font-heading text-4xl font-semibold tracking-tight">{p.name}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-data text-3xl font-bold">{formatPriceShort(p.amountCents)}</span>
            <span className="text-sm text-white/60">/mês</span>
          </p>
          <ul className="mt-5 space-y-2.5">
            {reasons.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/85">
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-nhf-green" strokeWidth={3} />
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-white/60">
            {p.limits.drivers === -1
              ? "Usuários, motoristas e veículos ilimitados."
              : `Cabe até ${formatLimit(p.limits.drivers)} motoristas, ${formatLimit(p.limits.vehicles)} veículos e ${formatLimit(p.limits.users)} usuários.`}
          </p>
        </div>
        <div className="relative flex flex-col gap-3">
          <Cta to={`/comprar/${p.id}`} size="lg" arrow className="w-full" ariaLabel={`Assinar ${p.name}: ${formatPriceShort(p.amountCents)} por mês`}>
            Assinar {p.name}
          </Cta>
          <Link to="/register" className="text-center text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline">
            Ou teste 7 dias grátis, sem cartão
          </Link>
        </div>
      </div>
    </div>
  );
}
