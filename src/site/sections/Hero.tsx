import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Clock, Satellite, Gift, Wallet } from "lucide-react";
import { Cta } from "../components/Cta";
import { PhoneMockup } from "../components/mockups/PhoneMockup";
import { RouteMap } from "../components/mockups/RouteMap";

const EASE = [0.2, 0.8, 0.2, 1] as const;
const TRUST = [
  { icon: Clock, text: "Acesso na hora, após o pagamento" },
  { icon: Satellite, text: "Sem rastreador: o GPS do celular basta" },
  { icon: Gift, text: "7 dias grátis para testar" },
];

function Item({ children, delay }: { children: React.ReactNode; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/** Capa: mensagem a esquerda, ilustracao do produto a direita (celular do motorista + cartoes do painel). */
export function Hero() {
  const reduce = useReducedMotion();
  return (
    <section id="inicio" className="hero-glow relative overflow-hidden pt-[72px]" aria-labelledby="hero-title">
      <div className="container grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:py-24">
        <div className="max-w-[40rem]">
          <Item delay={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" />
              Gestão de entregas e frota
            </span>
          </Item>
          <Item delay={0.06}>
            <h1 id="hero-title" className="mt-6 font-heading text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Sua frota no mapa.
              <br />
              Suas entregas <span className="whitespace-nowrap text-brand">na hora.</span>
            </h1>
          </Item>
          <Item delay={0.12}>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Painel para transportadoras e distribuidoras: romaneio no celular do motorista, posição de cada veículo, canhoto com foto e acerto do frete. Tudo no navegador, sem instalar nada.
            </p>
          </Item>
          <Item delay={0.18}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Cta href="#planos" size="lg" arrow>
                Ver planos
              </Cta>
              <Cta href="#como-funciona" size="lg" variant="outline">
                Como funciona
              </Cta>
            </div>
          </Item>
          <Item delay={0.26}>
            <ul className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {TRUST.map((t) => (
                <li key={t.text} className="flex items-center gap-2 text-sm text-foreground/80">
                  <t.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
                  {t.text}
                </li>
              ))}
            </ul>
          </Item>
        </div>

        {/* ilustracao */}
        <motion.div
          className="relative mx-auto w-full max-w-[560px]"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
          role="img"
          aria-label="App do motorista com a próxima entrega, ao lado de cartões do painel: entrega confirmada com foto, SLA do dia em 98% e acerto do frete fechado."
        >
          <div aria-hidden="true" className="relative h-[560px] sm:h-[620px]">
            {/* mapa ao fundo */}
            <div className="site-card absolute left-0 top-10 w-[300px] overflow-hidden p-2 sm:w-[340px]">
              <div className="flex items-center justify-between px-1 pb-1.5 pt-0.5 font-data text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>Mapa ao vivo</span>
                <span className="text-brand">14 veículos</span>
              </div>
              <div className="aspect-[16/11] overflow-hidden rounded-xl bg-muted">
                <RouteMap compact showLegend={false} />
              </div>
            </div>

            {/* celular */}
            <div className="absolute right-0 top-0 w-[250px] sm:right-4 sm:w-[270px]">
              <PhoneMockup className="w-full" static />
            </div>

            {/* badges */}
            <div className="float-slow absolute left-4 top-[-6px] flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3 shadow-lg sm:left-10">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-nhf-ink">
                <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <span>
                <span className="block text-sm font-semibold">Entregue · 14:32</span>
                <span className="block text-xs text-muted-foreground">NF 48213 · foto e assinatura</span>
              </span>
            </div>

            <div className="float-slower absolute bottom-24 right-[-8px] w-[168px] rounded-2xl border border-foreground/10 bg-card p-4 shadow-lg sm:right-[-16px]">
              <span className="label-caps text-[10px] text-muted-foreground">SLA do dia</span>
              <span className="mt-1 block font-data text-3xl font-bold tracking-tight text-brand">98%</span>
              <span className="mt-2 flex h-6 items-end gap-1">
                {[70, 85, 60, 95, 80, 90, 100].map((h, i) => (
                  <span key={i} className="flex-1 rounded-sm bg-brand/80" style={{ height: `${h}%` }} />
                ))}
              </span>
            </div>

            <div className="float-slow absolute bottom-4 left-6 flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3 shadow-lg sm:left-16">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Wallet className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">Acerto fechado · R$ 1.240</span>
                <span className="block text-xs text-muted-foreground">João Silva · pago por Pix</span>
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
