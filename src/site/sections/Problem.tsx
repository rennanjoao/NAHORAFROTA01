import { useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { FileText, MapPin, Camera, Wallet, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, EASE } from "../components/Reveal";

const FEED = [
  { who: "Despachante", ago: "07:40", text: "O motorista saiu com 18 notas no papel. Quais exatamente? Só ele sabe.", dot: "bg-nhf-alert", q: "Quais notas saíram no caminhão?", fix: "Romaneio digital", icon: FileText },
  { who: "Cliente", ago: "15:10", text: "“Cadê a minha entrega?” Ninguém sabe onde o veículo está. A resposta é “vou verificar”.", dot: "bg-nhf-late", q: "Onde está o veículo agora?", fix: "Mapa ao vivo", icon: MapPin },
  { who: "Motorista", ago: "16:45", text: "Foto do canhoto no grupo do WhatsApp, junto com outras 40 mensagens.", dot: "bg-nhf-alert", q: "Foi entregue mesmo? Para quem?", fix: "Canhoto digital", icon: Camera },
  { who: "Financeiro", ago: "19:30", text: "Acerto do agregado numa planilha que só uma pessoa entende. Um erro de R$ 50 vira discussão.", dot: "bg-nhf-late", q: "Quanto pagar ao agregado?", fix: "Acerto do frete", icon: Wallet },
];

/* Ritmo da linha do tempo: um cartao a cada STEP; o aviso final so depois do ultimo. */
const FIRST = 0.1;
const STEP = 0.32;
const CALLOUT_AT = FIRST + FEED.length * STEP + 0.1;

export function Problem() {
  const reduce = useReducedMotion();
  const feedRef = useRef<HTMLDivElement>(null);
  const inView = useInView(feedRef, { once: true, amount: 0.3 });
  const show = !!reduce || inView;
  const [hi, setHi] = useState<number | null>(null);

  return (
    <section id="problema" className="scroll-mt-nav py-24 lg:py-32" aria-labelledby="problema-title">
      <div className="container">
        <SectionHeader eyebrow="O problema" title="Planilha e grupo de WhatsApp não mostram onde a entrega está." accent="onde a entrega está." />
        <div className="mt-12 grid gap-12 lg:mt-16 lg:grid-cols-[1fr_1fr] lg:gap-16">
          {/* esquerda: o argumento + as quatro perguntas que o painel responde */}
          <div className="flex flex-col">
            <Reveal>
              <p className="text-balance font-heading text-2xl font-semibold leading-snug tracking-tight text-foreground sm:text-[1.75rem]">
                Toda operação começa assim. Funciona até o dia em que o cliente liga antes de você saber que a entrega atrasou.
              </p>
              <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
                Cada ponto cego vira ligação, retrabalho e desconto no frete. <strong className="font-semibold text-foreground">O Na Hora Frota coloca romaneio, posição, canhoto e acerto na mesma tela</strong>, para a sua equipe responder antes de o telefone tocar.
              </p>
            </Reveal>

            <Reveal delay={0.1} className="mt-10">
              <p className="label-caps text-muted-foreground">As quatro perguntas de todo dia, e quem responde</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {FEED.map((f, i) => (
                  <li
                    key={f.q}
                    onMouseEnter={() => setHi(i)}
                    onMouseLeave={() => setHi(null)}
                    className={cn(
                      "group rounded-2xl border bg-card p-4 shadow-sm transition-[border-color,box-shadow,transform] duration-300",
                      hi === i ? "-translate-y-0.5 border-brand/60 shadow-md" : "border-foreground/10",
                    )}
                  >
                    <p className="font-heading text-base font-semibold leading-snug">{f.q}</p>
                    <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-brand">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft">
                        <f.icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      {f.fix}
                      <ArrowRight aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform duration-300", hi === i && "translate-x-1")} />
                    </p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* direita: um dia sem painel, em ordem; o aviso entra por ultimo */}
          <div ref={feedRef} role="img" aria-label="Exemplo de um dia sem painel: romaneio no papel de manhã, cliente ligando à tarde, canhoto perdido no WhatsApp e acerto feito de cabeça à noite. Sem painel, quem descobre o atraso é o cliente.">
            <p aria-hidden="true" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="ping-ring absolute inset-0 rounded-full bg-nhf-late" />
                <span className="relative h-2 w-2 rounded-full bg-nhf-late" />
              </span>
              Um dia sem painel
            </p>
            <div aria-hidden="true" className="relative mt-4">
              {/* trilho que cresce junto com os cartoes */}
              <span className="absolute bottom-4 left-0 top-4 w-px bg-foreground/10" />
              <motion.span
                className="absolute left-0 top-4 w-px origin-top bg-nhf-late/60"
                style={{ bottom: "1rem" }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={show ? { scaleY: 1 } : { scaleY: 0 }}
                transition={{ duration: FEED.length * STEP, delay: FIRST, ease: "linear" }}
              />
              <ol className="space-y-3 pl-6">
                {FEED.map((f, i) => (
                  <motion.li
                    key={f.ago}
                    className="relative"
                    onMouseEnter={() => setHi(i)}
                    onMouseLeave={() => setHi(null)}
                    initial={reduce ? false : { opacity: 0, x: 18, filter: "blur(4px)" }}
                    animate={show ? { opacity: 1, x: 0, filter: "blur(0px)" } : { opacity: 0, x: 18, filter: "blur(4px)" }}
                    transition={{ duration: 0.55, delay: FIRST + i * STEP, ease: EASE }}
                  >
                    <span className={`absolute -left-[29px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-background ${f.dot}`} />
                    <div className={cn("site-card p-4 transition-[border-color,box-shadow] duration-300", hi === i && "border-nhf-late/40 shadow-md")}>
                      <p className="flex items-baseline gap-2 text-sm">
                        <span className="font-semibold">{f.who}</span>
                        <span className="font-data text-xs text-muted-foreground">{f.ago}</span>
                      </p>
                      <p className="mt-1 text-[0.95rem] leading-relaxed text-foreground/80">{f.text}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </div>
            <motion.div
              aria-hidden="true"
              className="mt-5 flex items-center gap-4 rounded-2xl border border-nhf-late/25 bg-nhf-late/[0.06] p-5"
              initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
              animate={show ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.6, delay: CALLOUT_AT, ease: EASE }}
            >
              <span className="font-heading text-4xl font-bold text-late">?</span>
              <p className="text-sm leading-relaxed text-foreground/80 sm:text-base">
                Sem painel, <strong className="font-semibold text-foreground">quem descobre o atraso é o cliente</strong>, e o canhoto só aparece no fim do dia.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
