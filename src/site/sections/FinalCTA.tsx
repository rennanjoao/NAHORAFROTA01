import { Link } from "react-router-dom";
import { Cta } from "../components/Cta";
import { Reveal } from "../components/Reveal";
import { LiveClock } from "../components/LiveClock";
import { Magnetic } from "../motion/Magnetic";
import truckPhoto from "@/assets/brand/caminhao-bau.jpg";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t hairline bg-nhf-ink text-white" aria-labelledby="cta-title">
      <img src={truckPhoto} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-35" loading="lazy" width={1800} height={1012} />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-nhf-ink via-nhf-ink/70 to-nhf-ink" />
      <div aria-hidden="true" className="orb left-1/2 top-1/2 h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/2 bg-brand/[0.12]" />
      <div className="container relative py-28 text-center lg:py-40">
        <Reveal>
          <div className="flex justify-center">
            <LiveClock label="Agora" />
          </div>
          <h2 id="cta-title" className="display mx-auto mt-8 max-w-5xl text-[clamp(3.4rem,11vw,10rem)]">
            Chegou? <span className="bg-gradient-to-r from-nhf-green to-white bg-clip-text text-transparent">Na hora.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-pretty text-lg text-white/75 sm:text-xl">
            Monte a sua operação hoje. Acesso em minutos, sem fidelidade, sem implantação.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Magnetic>
              <Cta href="#planos" size="lg" arrow>
                Ver planos e começar
              </Cta>
            </Magnetic>
            <Link
              to="/register"
              className="inline-flex h-14 items-center justify-center px-6 font-heading font-semibold text-white/85 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhf-green"
            >
              Testar grátis por 7 dias
            </Link>
            <a
              href="mailto:suporte@nahorafrota.com.br?subject=Quero%20conhecer%20o%20Na%20Hora%20Frota"
              className="inline-flex h-14 items-center justify-center px-6 font-heading font-semibold text-white/85 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhf-green"
            >
              Falar com a gente
            </a>
          </div>
        </Reveal>
      </div>
      {/* faixa de rodape em loop */}
      <div className="marquee relative overflow-hidden border-t border-white/10 py-4" aria-hidden="true">
        <div className="marquee-track flex w-max gap-10 font-heading text-2xl font-bold uppercase tracking-tight text-white/20" style={{ ["--marquee-duration" as string]: "40s" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="flex items-center gap-10">
              Sempre na hora <span className="h-1.5 w-1.5 rounded-full bg-nhf-green" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
