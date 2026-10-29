import { motion, useReducedMotion } from "framer-motion";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

const FEED = [
  { who: "Despachante", ago: "07:40", text: "O motorista saiu com 18 notas no papel. Quais exatamente? Só ele sabe.", dot: "bg-nhf-alert" },
  { who: "Cliente", ago: "15:10", text: "“Cadê a minha entrega?” Ninguém sabe onde o veículo está. A resposta é “vou verificar”.", dot: "bg-nhf-late" },
  { who: "Motorista", ago: "16:45", text: "Foto do canhoto no grupo do WhatsApp, junto com outras 40 mensagens.", dot: "bg-nhf-alert" },
  { who: "Financeiro", ago: "19:30", text: "Acerto do agregado numa planilha que só uma pessoa entende. Um erro de R$ 50 vira discussão.", dot: "bg-nhf-late" },
];

export function Problem() {
  const reduce = useReducedMotion();
  return (
    <section id="problema" className="scroll-mt-nav py-20 lg:py-28" aria-labelledby="problema-title">
      <div className="container">
        <SectionHeader eyebrow="O problema" title="Planilha e grupo de WhatsApp não mostram onde a entrega está." accent="onde a entrega está." />
        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <Reveal className="space-y-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            <p>Toda operação começa assim. Funciona até o dia em que o cliente liga antes de você saber que a entrega atrasou.</p>
            <p>Cada ponto cego vira ligação, retrabalho e desconto no frete. <strong className="font-semibold text-foreground">O Na Hora Frota coloca romaneio, posição, canhoto e acerto na mesma tela</strong>, para a sua equipe responder antes de o telefone tocar.</p>
          </Reveal>

          <div role="img" aria-label="Exemplo de um dia sem painel: romaneio no papel de manhã, cliente ligando à tarde, canhoto perdido no WhatsApp e acerto feito de cabeça à noite.">
            <p aria-hidden="true" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="ping-ring absolute inset-0 rounded-full bg-nhf-late" />
                <span className="relative h-2 w-2 rounded-full bg-nhf-late" />
              </span>
              Um dia sem painel
            </p>
            <ol aria-hidden="true" className="relative mt-4 space-y-3 border-l border-foreground/10 pl-6">
              {FEED.map((f, i) => (
                <motion.li
                  key={f.ago}
                  className="relative"
                  initial={reduce ? false : { opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px 0px" }}
                  transition={{ duration: 0.45, delay: 0.15 + i * 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <span className={`absolute -left-[29px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-background ${f.dot}`} />
                  <div className="site-card p-4">
                    <p className="flex items-baseline gap-2 text-sm">
                      <span className="font-semibold">{f.who}</span>
                      <span className="font-data text-xs text-muted-foreground">{f.ago}</span>
                    </p>
                    <p className="mt-1 text-[0.95rem] leading-relaxed text-foreground/80">{f.text}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
            <Reveal delay={0.4} className="mt-5">
              <div className="flex items-center gap-4 rounded-2xl border border-nhf-late/25 bg-nhf-late/[0.06] p-5">
                <span className="font-heading text-4xl font-bold text-late">?</span>
                <p className="text-sm leading-relaxed text-foreground/80 sm:text-base">
                  Sem painel, <strong className="font-semibold text-foreground">quem descobre o atraso é o cliente</strong>, e o canhoto só aparece no fim do dia.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
