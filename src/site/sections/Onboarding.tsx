import { motion, useReducedMotion } from "framer-motion";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";

const STEPS = [
  { when: "Minuto 0", text: "Escolhe o plano e paga no cartão." },
  { when: "Minuto 1", text: "Login e senha temporária chegam no e-mail e aparecem na tela." },
  { when: "10 min", text: "Cadastra motoristas e veículos, ou importa a planilha de motoristas." },
  { when: "15 min", text: "Importa o XML das notas do dia." },
  { when: "20 min", text: "Monta o romaneio e despacha para o celular do motorista." },
  { when: "Mesmo dia", text: "Acompanha no mapa e recebe os canhotos.", live: true },
];

/** Do pagamento a primeira entrega: linha do tempo que enche ao entrar na tela. */
export function Onboarding() {
  const reduce = useReducedMotion();
  return (
    <section id="comecar" className="scroll-mt-nav border-y border-foreground/10 bg-card py-20 lg:py-24" aria-labelledby="comecar-title">
      <div className="container">
        <SectionHeader eyebrow="Começar" title="Do pagamento à primeira entrega no mesmo dia." accent="no mesmo dia." lead="Sem reunião de implantação e sem esperar alguém liberar o acesso. Este é o caminho de quem assina hoje." />

        <div className="relative mt-14">
          <div aria-hidden="true" className="absolute left-0 right-0 top-[7px] hidden h-0.5 bg-foreground/10 lg:block">
            <motion.div className="h-full origin-left bg-brand" initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "-80px 0px" }} transition={{ duration: 1.6, ease: "easeInOut" }} />
          </div>
          <div aria-hidden="true" className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-foreground/10 lg:hidden">
            <motion.div className="h-full w-full origin-top bg-brand" initial={reduce ? false : { scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, margin: "-80px 0px" }} transition={{ duration: 1.6, ease: "easeInOut" }} />
          </div>
          <Stagger className="grid gap-8 lg:grid-cols-6 lg:gap-5" gap={0.16}>
            {STEPS.map((s) => (
              <StaggerItem key={s.when}>
                <div className="relative pl-8 lg:pl-0">
                  <span aria-hidden="true" className={`absolute left-0 top-0 flex h-4 w-4 items-center justify-center rounded-full lg:relative ${s.live ? "bg-brand ring-4 ring-brand/30" : "bg-card ring-2 ring-brand"}`}>
                    {!s.live && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                  </span>
                  <p className="mt-0 font-heading text-base font-semibold lg:mt-5">
                    {s.when}
                    {s.live && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-nhf-ink">ao vivo</span>}
                  </p>
                  <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
