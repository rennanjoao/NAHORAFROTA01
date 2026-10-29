import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, formatPriceShort } from "@/config/plans";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import { Cta } from "../components/Cta";
import { PlanFinder } from "../components/PlanFinder";
import { FINDER_DEFAULT, recommend, type FinderState } from "../components/planFinderLogic";
import { PlanTable } from "../components/PlanTable";

const SUPPORT_EMAIL = "suporte@nahorafrota.com.br";

export function Pricing() {
  const reduce = useReducedMotion();
  const [finder, setFinder] = useState<FinderState>(FINDER_DEFAULT);
  const [touched, setTouched] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const indicated = recommend(finder).plan;

  return (
    <section id="planos" className="scroll-mt-nav py-20 lg:py-28" aria-labelledby="planos-title">
      <div className="container">
        <SectionHeader align="center" eyebrow="Planos" title="Um preço por mês. Acesso liberado na hora." accent="na hora." lead="Sem fidelidade, sem taxa de implantação. Pague com cartão, receba o acesso por e-mail e entre no mesmo minuto." />

        <Reveal className="mt-12">
          <PlanFinder state={finder} onChange={(s) => { setFinder(s); setTouched(true); }} />
        </Reveal>

        <Stagger className="mt-8 grid gap-5 lg:grid-cols-3" gap={0.08}>
          {PLANS.map((p) => {
            const isIndicated = touched && p.id === indicated;
            return (
              <StaggerItem key={p.id} className="h-full">
                <article
                  className={cn(
                    "relative flex h-full flex-col rounded-2xl border bg-card p-7 transition-[border-color,box-shadow] duration-300 lg:p-8",
                    isIndicated || (!touched && p.highlight) ? "border-brand shadow-[0_16px_48px_-20px_hsl(var(--brand)/0.6)]" : "border-foreground/10 shadow-sm",
                  )}
                  aria-labelledby={`plano-${p.id}`}
                >
                  {(isIndicated || (!touched && p.badge)) && (
                    <span className="absolute -top-3 left-7 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-nhf-ink">
                      <Sparkles aria-hidden="true" className="h-3 w-3" /> {isIndicated ? "Indicado para você" : p.badge}
                    </span>
                  )}
                  <h3 id={`plano-${p.id}`} className="font-heading text-xl font-semibold tracking-tight">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="font-data text-5xl font-bold tracking-tight tabular-nums">{formatPriceShort(p.amountCents)}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </p>
                  <div className="mt-6">
                    <Cta to={`/comprar/${p.id}`} className="w-full" variant={isIndicated || (!touched && p.highlight) ? "primary" : "dark"} arrow ariaLabel={`Assinar ${p.name}: ${formatPriceShort(p.amountCents)} por mês`}>
                      Assinar {p.name}
                    </Cta>
                  </div>
                  {p.stepUp && <p className="mt-6 label-caps text-muted-foreground">{p.stepUp}</p>}
                  <ul className={cn("space-y-2.5 text-sm", p.stepUp ? "mt-3" : "mt-6")}>
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                        <span className="text-foreground/85">{f}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            aria-expanded={showTable}
            aria-controls="tabela-planos"
            onClick={() => setShowTable((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-card px-5 py-2.5 font-heading text-sm font-semibold transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showTable ? "Esconder a comparação" : "Comparar todos os recursos"}
            <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", showTable && "rotate-180")} />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {showTable && (
            <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mt-6">
              <PlanTable id="tabela-planos" />
            </motion.div>
          )}
        </AnimatePresence>

        <Reveal delay={0.1} className="mx-auto mt-10 max-w-3xl text-center text-sm text-muted-foreground">
          <p>Valores mensais em reais, cobrados no cartão de crédito. Cancele quando quiser: o acesso continua até o fim do período pago.</p>
          <p className="mt-2">
            Prefere testar antes? <Link to="/register" className="font-semibold text-brand underline-offset-4 hover:underline">7 dias grátis, sem cartão</Link>. Depois, assine por aqui com o mesmo CNPJ: tudo fica onde está.
          </p>
          <p className="mt-2">
            Operação maior ou precisa de nota fiscal e contrato? <a href={`mailto:${SUPPORT_EMAIL}?subject=Plano%20sob%20medida`} className="font-semibold text-brand underline-offset-4 hover:underline">Fale com a gente</a>. Já é cliente? <Link to="/login" className="font-semibold text-brand underline-offset-4 hover:underline">Entrar</Link>.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
