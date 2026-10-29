import { FileWarning, PhoneMissed, Calculator } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem, Reveal } from "../components/Reveal";

const CARDS = [
  {
    time: "07:40",
    icon: FileWarning,
    title: "Romaneio no papel",
    text: "O motorista saiu com 18 notas. Quais? Só ele sabe. Se o canhoto se perde, a prova de entrega some junto.",
    status: "SEM REGISTRO",
  },
  {
    time: "15:10",
    icon: PhoneMissed,
    title: "O cliente ligou primeiro",
    text: "Ninguém sabia onde o veículo estava. A resposta foi “vou verificar”. O prazo já tinha estourado.",
    status: "SLA ESTOURADO",
  },
  {
    time: "19:30",
    icon: Calculator,
    title: "Acerto de cabeça",
    text: "Frete, adiantamento e desconto numa planilha que só uma pessoa entende. Um erro de R$ 50 vira discussão.",
    status: "SEM HISTÓRICO",
  },
];

export function Problem() {
  return (
    <section id="problema" className="scroll-mt-nav border-t border-border py-20 lg:py-28" aria-labelledby="problema-title">
      <div className="container">
        <SectionHeader
          eyebrow="O problema"
          title="Planilha, grupo de WhatsApp e feeling não escalam."
          accent="não escalam."
          lead="Toda operação começa assim. Funciona até o dia em que o cliente liga antes de você saber que a entrega atrasou."
        />
        <Stagger className="mt-12 grid gap-4 md:grid-cols-3">
          {CARDS.map((c) => (
            <StaggerItem key={c.title}>
              <article className="group relative h-full rounded border border-border bg-card p-6 transition-colors hover:border-nhf-late/60">
                <div className="flex items-center justify-between">
                  <span className="font-data text-sm font-bold tabular-nums text-foreground/70">{c.time}</span>
                  <span className="rounded border border-nhf-late/40 bg-nhf-late/10 px-2 py-0.5 font-data text-[10px] font-semibold tracking-[0.08em] text-late">
                    {c.status}
                  </span>
                </div>
                <c.icon aria-hidden="true" className="mt-6 h-7 w-7 text-foreground/60 transition-colors group-hover:text-late" />
                <h3 className="mt-4 font-heading text-xl font-bold">{c.title}</h3>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{c.text}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal delay={0.2} className="mt-10">
          <p className="max-w-2xl text-pretty font-heading text-xl font-semibold leading-snug sm:text-2xl">
            Cada ponto cego vira ligação, retrabalho e desconto. <span className="text-brand">O painel tira o ponto cego.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
