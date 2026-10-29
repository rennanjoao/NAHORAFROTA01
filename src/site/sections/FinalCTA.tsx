import { useRef } from "react";
import { Link } from "react-router-dom";
import { useParallax } from "../motion/useParallax";
import { Cta } from "../components/Cta";
import { Reveal } from "../components/Reveal";
import { BrazilMap } from "../components/BrazilMap";

export function FinalCTA() {
  const card = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useParallax(stage, card);
  return (
    <section className="pb-20 pt-4 lg:pb-28" aria-labelledby="cta-title">
      <div className="container">
        <Reveal>
          <div ref={card} className="relative grid items-center gap-8 overflow-hidden rounded-3xl border border-nhf-green/30 bg-nhf-ink px-6 py-12 text-white shadow-[0_30px_80px_-40px_hsl(var(--brand)/0.7)] sm:px-12 lg:grid-cols-[1.2fr_1fr] lg:py-16">
            <div aria-hidden="true" className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
            <div className="relative">
              <h2 id="cta-title" className="text-balance font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                Pare de descobrir o atraso pelo cliente. <span className="text-nhf-green">Veja a rota inteira hoje.</span>
              </h2>
              <p className="mt-4 max-w-lg text-pretty text-white/70 sm:text-lg">Sem fidelidade, sem implantação. Pague, receba o acesso por e-mail e despache o primeiro romaneio no mesmo dia.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Cta href="#planos" size="lg" arrow>
                  Ver planos
                </Cta>
                <Link to="/register" className="inline-flex h-14 items-center justify-center rounded-full border border-white/20 px-6 font-heading font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhf-green">
                  Testar grátis por 7 dias
                </Link>
              </div>
              <p className="mt-5 text-xs text-white/60">Cancele quando quiser. O acesso continua até o fim do período pago.</p>
            </div>
            <div ref={stage} className="relative mx-auto w-full max-w-[380px]" style={{ perspective: "1200px" }}>
              <div style={{ transform: "rotateX(calc(18deg - var(--py, 0) * 8deg)) rotateY(calc(-8deg + var(--px, 0) * 12deg))", transformStyle: "preserve-3d", transition: "transform 0.1s linear" }}>
                <BrazilMap className="h-auto w-full drop-shadow-[0_30px_40px_rgba(4,232,164,0.15)]" />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
