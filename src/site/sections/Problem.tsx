import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { FileWarning, PhoneMissed, Calculator } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";
import { ScrubText } from "../motion/ScrubText";

const MOMENTS = [
  { time: "07:40", icon: FileWarning, title: "Romaneio no papel", text: "O motorista saiu com 18 notas. Quais? Só ele sabe. Se o canhoto se perde, a prova de entrega some junto.", status: "Sem registro" },
  { time: "15:10", icon: PhoneMissed, title: "O cliente ligou primeiro", text: "Ninguém sabia onde o veículo estava. A resposta foi “vou verificar”. O prazo já tinha estourado.", status: "SLA estourado" },
  { time: "19:30", icon: Calculator, title: "Acerto de cabeça", text: "Frete, adiantamento e desconto numa planilha que só uma pessoa entende. Um erro de R$ 50 vira discussão.", status: "Sem histórico" },
];

export function Problem() {
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start 80%", "end 60%"] });
  const line = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="problema" className="scroll-mt-nav relative py-24 lg:py-36" aria-labelledby="problema-title">
      <div className="container">
        <SectionHeader
          index="01"
          size="xl"
          eyebrow="O problema"
          title="Planilha, grupo de WhatsApp e feeling não escalam."
          accent="não escalam."
          lead="Toda operação começa assim. Funciona até o dia em que o cliente liga antes de você saber que a entrega atrasou."
        />

        {/* um dia sem painel: linha do tempo */}
        <div ref={track} className="relative mt-20">
          <div aria-hidden="true" className="absolute left-0 top-[18px] hidden h-px w-full bg-foreground/10 md:block">
            <motion.div style={reduce ? undefined : { scaleX: line }} className="h-full w-full origin-left bg-late/80" />
          </div>
          <Stagger className="grid gap-10 md:grid-cols-3 md:gap-8" gap={0.14}>
            {MOMENTS.map((m) => (
              <StaggerItem key={m.time}>
                <article className="relative">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full border border-late/50 bg-background text-late">
                      <m.icon className="h-4 w-4" />
                    </span>
                    <span className="font-data text-2xl font-bold tabular-nums tracking-tight text-foreground">{m.time}</span>
                    <span className="ml-auto rounded-sm border border-late/40 bg-late/10 px-2 py-0.5 font-data text-[10px] font-semibold uppercase tracking-[0.1em] text-late">{m.status}</span>
                  </div>
                  <h3 className="mt-6 font-heading text-2xl font-bold leading-tight tracking-tight">{m.title}</h3>
                  <p className="mt-3 max-w-sm text-pretty leading-relaxed text-muted-foreground">{m.text}</p>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div className="mt-24 lg:mt-32">
          <ScrubText
            text="Cada ponto cego vira ligação, retrabalho e desconto. O painel tira o ponto cego."
            accent="tira o ponto cego."
            className="display-md max-w-5xl text-[clamp(1.9rem,4.6vw,3.9rem)]"
          />
        </div>
      </div>
    </section>
  );
}
