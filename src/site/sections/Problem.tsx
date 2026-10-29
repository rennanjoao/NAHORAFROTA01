import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

const FEED = [
  { time: "07:40", who: "Despachante", text: "O motorista saiu com 18 notas no papel. Quais? Só ele sabe.", tone: "bg-nhf-alert" },
  { time: "15:10", who: "Cliente", text: "“Cadê a minha entrega?” Ninguém sabe onde o veículo está. A resposta foi “vou verificar”.", tone: "bg-nhf-late" },
  { time: "19:30", who: "Financeiro", text: "Acerto do agregado numa planilha que só uma pessoa entende. Um erro de R$ 50 vira discussão.", tone: "bg-nhf-late" },
];

export function Problem() {
  return (
    <section id="problema" className="scroll-mt-nav py-20 lg:py-28" aria-labelledby="problema-title">
      <div className="container grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <SectionHeader eyebrow="O problema" title="Planilha e grupo de WhatsApp não mostram onde a entrega está." accent="onde a entrega está." />
          <div className="mt-6 space-y-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            <p>Toda operação começa assim e funciona até o dia em que o cliente liga antes de você saber que a entrega atrasou.</p>
            <p>Cada ponto cego vira ligação, retrabalho e desconto. O Na Hora Frota coloca romaneio, posição, canhoto e acerto na mesma tela, para a sua equipe responder antes do telefone tocar.</p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-foreground/10 bg-card p-4">
              <p className="label-caps text-late">Com planilha e WhatsApp</p>
              <p className="mt-1 font-heading text-lg font-semibold">Ponto cego o dia todo</p>
            </div>
            <div className="rounded-xl border border-brand/30 bg-brand-soft p-4">
              <p className="label-caps text-brand">Com o Na Hora Frota</p>
              <p className="mt-1 font-heading text-lg font-semibold">Tudo na tela, na hora</p>
            </div>
          </div>
        </div>

        <Reveal delay={0.1}>
          <div className="site-card p-5 sm:p-6" role="img" aria-label="Exemplo de um dia sem painel: romaneio no papel de manhã, cliente ligando à tarde para saber da entrega e acerto feito de cabeça à noite.">
            <p aria-hidden="true" className="flex items-center gap-2 label-caps text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-nhf-late" /> Um dia sem painel
            </p>
            <ul aria-hidden="true" className="mt-4 space-y-3">
              {FEED.map((f) => (
                <li key={f.time} className="flex gap-3 rounded-xl border border-foreground/10 bg-background p-4">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${f.tone}`} />
                  <div>
                    <p className="flex items-baseline gap-2 text-sm">
                      <span className="font-semibold">{f.who}</span>
                      <span className="font-data text-xs text-muted-foreground">{f.time}</span>
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
