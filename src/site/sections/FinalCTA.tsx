import { Cta } from "../components/Cta";
import { Reveal } from "../components/Reveal";
import { LiveClock } from "../components/LiveClock";
import truckPhoto from "@/assets/brand/caminhao-bau.jpg";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-border bg-nhf-ink text-white" aria-labelledby="cta-title">
      <img src={truckPhoto} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-40" loading="lazy" width={1800} height={1012} />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-nhf-ink via-nhf-ink/85 to-nhf-ink/40" />
      <div className="container relative py-24 lg:py-36">
        <Reveal>
          <LiveClock label="Agora" />
          <h2 id="cta-title" className="mt-6 max-w-3xl text-balance font-heading text-4xl font-bold leading-[1] tracking-tight sm:text-6xl lg:text-7xl">
            Chegou? <span className="text-nhf-green">Na hora.</span>
          </h2>
          <p className="mt-6 max-w-xl text-pretty text-lg text-white/75">
            Monte a sua operação hoje. Acesso em minutos, sem fidelidade, sem implantação.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Cta href="#planos" size="lg" arrow>
              Ver planos e começar
            </Cta>
            <a
              href="mailto:suporte@nahorafrota.com.br?subject=Quero%20conhecer%20o%20Na%20Hora%20Frota"
              className="inline-flex h-14 items-center justify-center px-6 font-heading font-semibold text-white/85 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhf-green"
            >
              Falar com a gente
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
