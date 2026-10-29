import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, formatPriceShort } from "@/config/plans";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import { Cta } from "../components/Cta";
import { Spotlight } from "../motion/Spotlight";

const SUPPORT_EMAIL = "suporte@nahorafrota.com.br";

export function Pricing() {
  const reduce = useReducedMotion();
  return (
    <section id="planos" className="scroll-mt-nav relative border-t hairline py-24 lg:py-36" aria-labelledby="planos-title">
      <div aria-hidden="true" className="orb left-1/2 top-24 h-[700px] w-[700px] -translate-x-1/2 bg-brand/[0.07]" />
      <div className="container">
        <SectionHeader
          index="07"
          size="xl"
          align="center"
          eyebrow="Planos"
          title="Um preço por mês. Acesso liberado na hora."
          accent="na hora."
          lead="Sem fidelidade, sem taxa de implantação. Pague com cartão, receba o acesso por e-mail e entre no mesmo minuto."
        />

        <Stagger className="mt-16 grid gap-5 lg:grid-cols-3 lg:items-stretch" gap={0.1}>
          {PLANS.map((p) => (
            <StaggerItem key={p.id} className="h-full">
              <motion.div whileHover={reduce ? undefined : { y: -6 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="h-full">
                <Spotlight
                  as="article"
                  className={cn(
                    "relative flex h-full flex-col rounded-lg border bg-card p-7 lg:p-8",
                    p.highlight ? "beam border-brand/40 lg:-my-4 lg:py-12" : "spot-border hairline",
                  )}
                  aria-labelledby={`plano-${p.id}`}
                >
                  {p.badge && (
                    <span className="nhf-chamfer nhf-chamfer-sm absolute -top-3 left-7 z-10 inline-flex items-center gap-1.5 bg-brand px-3 py-1 font-data text-[10px] font-bold uppercase tracking-[0.1em] text-nhf-ink">
                      <Sparkles aria-hidden="true" className="h-3 w-3" /> {p.badge}
                    </span>
                  )}
                  <h3 id={`plano-${p.id}`} className="font-heading text-2xl font-bold tracking-tight">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>

                  <p className="mt-8 flex items-baseline gap-2">
                    <span className="display font-data text-[clamp(3.2rem,4.6vw,4.4rem)] tabular-nums">{formatPriceShort(p.amountCents)}</span>
                    <span className="font-data text-sm uppercase tracking-[0.1em] text-muted-foreground">/mês</span>
                  </p>

                  <div className="mt-8">
                    <Cta to={`/comprar/${p.id}`} className="w-full" size="lg" variant={p.highlight ? "primary" : "dark"} arrow ariaLabel={`Assinar ${p.name}: ${formatPriceShort(p.amountCents)} por mês`}>
                      Assinar {p.name}
                    </Cta>
                  </div>

                  {p.stepUp && <p className="mt-8 label-caps text-muted-foreground">{p.stepUp}</p>}
                  <ul className={cn("space-y-3 text-sm", p.stepUp ? "mt-3" : "mt-8")}>
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                        <span className="text-foreground/85">{f}</span>
                      </li>
                    ))}
                  </ul>
                </Spotlight>
              </motion.div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.2} className="mx-auto mt-14 max-w-3xl text-center text-sm text-muted-foreground">
          <p>Valores mensais em reais, cobrados no cartão de crédito. Cancele quando quiser: o acesso continua até o fim do período pago.</p>
          <p className="mt-2">
            Operação maior ou precisa de nota fiscal e contrato?{" "}
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Plano%20sob%20medida`} className="font-semibold text-brand underline-offset-4 hover:underline">
              Fale com a gente
            </a>
            . Já é cliente? <Link to="/login" className="font-semibold text-brand underline-offset-4 hover:underline">Entrar</Link>.
          </p>
          <p className="mt-2">
            Prefere testar antes? <Link to="/register" className="font-semibold text-brand underline-offset-4 hover:underline">7 dias grátis, sem cartão</Link>. Quando quiser continuar, assine por aqui com o mesmo CNPJ: tudo fica onde está.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
