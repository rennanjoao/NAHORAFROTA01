import { Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PLANS, formatPriceShort } from "@/config/plans";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem, Reveal } from "../components/Reveal";
import { Cta } from "../components/Cta";

const SUPPORT_EMAIL = "suporte@nahorafrota.com.br";

export function Pricing() {
  return (
    <section id="planos" className="scroll-mt-nav border-t border-border py-20 lg:py-28" aria-labelledby="planos-title">
      <div className="container">
        <SectionHeader
          align="center"
          eyebrow="Planos"
          title="Um preço por mês. Acesso liberado na hora."
          accent="na hora."
          lead="Sem fidelidade, sem taxa de implantação. Pague com cartão, receba o acesso por e-mail e entre no mesmo minuto."
        />

        <Stagger className="mt-14 grid items-stretch gap-5 lg:grid-cols-3" gap={0.1}>
          {PLANS.map((p) => (
            <StaggerItem key={p.id} className="h-full">
              <article
                className={cn(
                  "relative flex h-full flex-col rounded border bg-card p-7 transition-colors",
                  p.highlight ? "border-brand glow-brand lg:-my-3 lg:py-10" : "border-border hover:border-foreground/30",
                )}
                aria-labelledby={`plano-${p.id}`}
              >
                {p.badge && (
                  <span className="absolute -top-3 left-7 inline-flex items-center gap-1.5 bg-brand px-2.5 py-1 font-data text-[11px] font-bold uppercase tracking-[0.08em] text-nhf-ink">
                    <Sparkles aria-hidden="true" className="h-3 w-3" /> {p.badge}
                  </span>
                )}
                <h3 id={`plano-${p.id}`} className="font-heading text-2xl font-bold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>

                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="font-data text-5xl font-bold tracking-tight tabular-nums">{formatPriceShort(p.amountCents)}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </p>

                <div className="mt-7">
                  <Cta to={`/comprar/${p.id}`} className="w-full" variant={p.highlight ? "primary" : "dark"} arrow ariaLabel={`Assinar ${p.name}: ${formatPriceShort(p.amountCents)} por mês`}>
                    Assinar {p.name}
                  </Cta>
                </div>

                {p.stepUp && <p className="mt-7 label-caps text-muted-foreground">{p.stepUp}</p>}
                <ul className={cn("space-y-3 text-sm", p.stepUp ? "mt-3" : "mt-7")}>
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                      <span className="text-foreground/85">{f}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.2} className="mx-auto mt-10 max-w-3xl text-center text-sm text-muted-foreground">
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
