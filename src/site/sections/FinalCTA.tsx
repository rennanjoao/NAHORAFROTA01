import { Link } from "react-router-dom";
import { Cta } from "../components/Cta";
import { Reveal } from "../components/Reveal";

export function FinalCTA() {
  return (
    <section className="pb-20 lg:pb-28" aria-labelledby="cta-title">
      <div className="container">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-nhf-ink px-6 py-14 text-center text-white sm:px-12 lg:py-20">
            <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
            <div aria-hidden="true" className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
            <h2 id="cta-title" className="relative text-balance font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Monte a sua operação hoje. <span className="text-nhf-green">Acesso em minutos.</span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-pretty text-white/70 sm:text-lg">Sem fidelidade, sem implantação. Pague, receba o acesso por e-mail e entre no mesmo minuto.</p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Cta href="#planos" size="lg" arrow>
                Ver planos
              </Cta>
              <Link to="/register" className="inline-flex h-14 items-center justify-center rounded-full border border-white/20 px-6 font-heading font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhf-green">
                Testar grátis por 7 dias
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
