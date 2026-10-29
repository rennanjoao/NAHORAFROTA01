import { useEffect, useMemo, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { Pause, Play, X, Check, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

/* Um dia de operacao das 06:00 as 19:00 (t em minutos desde as 06:00). */
const END = 780;
const MOMENTS = [
  { t: 0, title: "Saída do pátio", sem: "Romaneio impresso. Ninguém confere quais notas saíram no caminhão.", com: "Romaneio #1042 no celular do João: 14 notas, com as paradas já em ordem." },
  { t: 150, title: "Primeira entrega", sem: "O canhoto vai para o porta-luvas. Volta no fim do dia, se voltar.", com: "NF 48213 entregue às 08:31, com foto, assinatura e posição." },
  { t: 240, title: "Imprevisto na rota", sem: "Trânsito parado. O motorista avisa no WhatsApp, se lembrar.", com: "Ocorrência de atraso registrada no app. O despachante vê na hora e avisa o cliente." },
  { t: 390, title: "O cliente liga", sem: "“Vou verificar e te retorno.” Três ligações até achar o motorista.", com: "O mapa mostra onde o veículo está e quantas paradas faltam. Resposta em segundos." },
  { t: 540, title: "Cliente ausente", sem: "Foto solta no grupo, sem nota fiscal e sem horário.", com: "Ocorrência com foto, ligada à NF 48230, aparece no painel na mesma hora." },
  { t: 690, title: "Fim da rota", sem: "Conferir os canhotos um a um para saber o que foi entregue.", com: "14 de 14 entregues, SLA do dia medido e todos os canhotos já no painel." },
  { t: 780, title: "Acerto do agregado", sem: "Acerto de cabeça, numa planilha que só uma pessoa entende.", com: "Acerto pronto: frete, adiantamento e total a pagar, com a chave Pix na tela." },
];
const DELIVERED_AT = [150, 190, 230, 280, 320, 360, 410, 450, 480, 520, 560, 600, 640, 690];

/* Rota pelas ruas (segmentos retos) e paradas, no viewBox 400 x 240. */
const ROUTE: [number, number][] = [[36, 204], [36, 140], [132, 140], [132, 84], [236, 84], [236, 36], [332, 36], [332, 132], [372, 132]];
const STOPS = [0.16, 0.32, 0.5, 0.66, 0.82, 1];

function clock(t: number) {
  const m = 6 * 60 + Math.round(t);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function pointAt(frac: number): [number, number] {
  const segs = ROUTE.slice(1).map((p, i) => Math.hypot(p[0] - ROUTE[i][0], p[1] - ROUTE[i][1]));
  const total = segs.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, frac)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]) {
      const k = segs[i] ? d / segs[i] : 0;
      return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * k, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * k];
    }
    d -= segs[i];
  }
  return ROUTE[ROUTE.length - 1];
}

export function DaySimulator() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [touched, setTouched] = useState(false);
  const [announce, setAnnounce] = useState("");

  // Toca sozinho a primeira vez que aparece (passa pelos momentos do dia).
  useEffect(() => {
    if (inView && !touched && !reduce) setPlaying(true);
  }, [inView, touched, reduce]);
  useEffect(() => {
    if (!playing) return;
    if (!inView) return;
    const id = window.setInterval(() => {
      setT((cur) => {
        const next = MOMENTS.find((m) => m.t > cur);
        if (!next) {
          setPlaying(false);
          return cur;
        }
        return next.t;
      });
    }, 2300);
    return () => window.clearInterval(id);
  }, [playing, inView]);

  const moment = useMemo(() => [...MOMENTS].reverse().find((m) => m.t <= t) ?? MOMENTS[0], [t]);
  const delivered = DELIVERED_AT.filter((d) => d <= t).length;
  const progress = Math.min(1, Math.max(0, (t - 20) / (690 - 20)));
  const [tx, ty] = pointAt(progress);
  const fill = `${(t / END) * 100}%`;
  // Placar acumulado do dia (sem painel x com painel).
  const calls = (t >= 240 ? 1 : 0) + (t >= 390 ? 3 : 0) + (t >= 540 ? 1 : 0);
  const SEM_STATS: [string, string][] = [
    ["Ligações para achar o motorista", String(calls)],
    ["Canhotos que o escritório ainda não viu", String(delivered)],
  ];
  const COM_STATS: [string, string][] = [
    ["Ligações para achar o motorista", "0"],
    ["Canhotos já no painel", String(delivered)],
  ];

  const onInput = (v: number) => {
    setTouched(true);
    setPlaying(false);
    setT(v);
    const m = [...MOMENTS].reverse().find((x) => x.t <= v) ?? MOMENTS[0];
    setAnnounce(`${clock(v)}. ${m.title}. Sem painel: ${m.sem} Com o Na Hora Frota: ${m.com}`);
  };

  const togglePlay = () => {
    setTouched(true);
    if (!playing && t >= END) setT(0);
    setPlaying((p) => !p);
  };

  return (
    <section id="na-pratica" className="scroll-mt-nav py-20 lg:py-28" aria-labelledby="na-pratica-title">
      <div className="container">
        <SectionHeader
          eyebrow="Na prática"
          title="Arraste e veja um dia da sua operação."
          accent="um dia da sua operação."
          lead="Do romaneio saindo do pátio ao acerto do agregado. À esquerda, como é sem painel. À direita, o que a sua equipe vê com o Na Hora Frota."
        />

        <Reveal className="mt-12">
          <div ref={ref} className="site-card p-5 sm:p-7 lg:p-8">
            {/* relogio + controle */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-baseline gap-4">
                <span className="font-data text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">{clock(t)}</span>
                <span className="font-heading text-lg font-semibold text-foreground/80">{moment.title}</span>
              </div>
              <button
                type="button"
                onClick={togglePlay}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-foreground/15 bg-background px-4 text-sm font-semibold transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {playing ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
                {playing ? "Pausar" : t >= END ? "Rever o dia" : "Reproduzir o dia"}
              </button>
            </div>

            {/* linha do tempo */}
            <div className="mt-6">
              <label htmlFor="hora-do-dia" className="sr-only">Hora do dia, das 06:00 às 19:00</label>
              <input
                id="hora-do-dia"
                type="range"
                min={0}
                max={END}
                step={10}
                value={t}
                onChange={(e) => onInput(Number(e.target.value))}
                aria-valuetext={`${clock(t)}, ${moment.title}`}
                className="range-brand w-full"
                style={{ ["--fill" as string]: fill }}
              />
              <div aria-hidden="true" className="relative mt-3 hidden h-5 sm:block">
                {MOMENTS.map((m) => (
                  <button
                    key={m.t}
                    type="button"
                    tabIndex={-1}
                    onClick={() => onInput(m.t)}
                    className={cn(
                      "absolute font-data text-xs tabular-nums transition-colors",
                      m.t === 0 ? "translate-x-0" : m.t === END ? "-translate-x-full" : "-translate-x-1/2",
                      m.t <= t ? "text-foreground" : "text-muted-foreground",
                    )}
                    style={{ left: `${(m.t / END) * 100}%` }}
                  >
                    {clock(m.t)}
                  </button>
                ))}
              </div>
              <p className="sr-only" aria-live="polite">{announce}</p>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.25fr_1fr]">
              {/* sem painel */}
              <div className="order-2 flex flex-col rounded-2xl border border-nhf-late/20 bg-nhf-late/[0.05] p-5 lg:order-1">
                <p className="flex items-center gap-2 label-caps text-late">
                  <X aria-hidden="true" className="h-4 w-4" /> Sem painel
                </p>
                <p key={`sem-${moment.t}`} className="mt-3 animate-fade-in text-pretty text-[0.95rem] leading-relaxed text-foreground/85">{moment.sem}</p>
                <dl className="mt-auto space-y-2 pt-5">
                  {SEM_STATS.map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3 border-t border-nhf-late/15 pt-2 text-sm">
                      <dt className="text-foreground/75">{k}</dt>
                      <dd className="font-data text-lg font-bold tabular-nums text-late">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* mapa + numeros */}
              <div className="order-1 lg:order-2" role="img" aria-label={`Mapa da rota às ${clock(t)}: ${delivered} de 14 entregas feitas.`}>
                <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-foreground/10 bg-muted/60">
                  <svg viewBox="0 0 400 240" className="h-auto w-full">
                    <defs>
                      <pattern id="ruas" width="48" height="48" patternUnits="userSpaceOnUse">
                        <path d="M48 0H0V48" fill="none" stroke="hsl(var(--foreground) / 0.07)" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="400" height="240" fill="url(#ruas)" />
                    <g fill="hsl(var(--foreground) / 0.045)">
                      <rect x="56" y="160" width="60" height="40" rx="3" />
                      <rect x="152" y="104" width="64" height="28" rx="3" />
                      <rect x="256" y="52" width="60" height="64" rx="3" />
                      <rect x="56" y="40" width="56" height="80" rx="3" />
                      <rect x="250" y="150" width="70" height="60" rx="3" />
                    </g>
                    <polyline points={ROUTE.map((p) => p.join(",")).join(" ")} fill="none" stroke="hsl(var(--foreground) / 0.18)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="2 8" />
                    <polyline
                      points={ROUTE.map((p) => p.join(",")).join(" ")}
                      fill="none"
                      stroke="hsl(var(--brand))"
                      strokeWidth="4"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      pathLength={1}
                      strokeDasharray="1"
                      strokeDashoffset={1 - progress}
                      style={{ transition: playing ? "stroke-dashoffset 1.2s ease" : undefined }}
                    />
                    {STOPS.map((f, i) => {
                      const [x, y] = pointAt(f);
                      const done = progress >= f - 0.001 && t >= 150;
                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r="7" fill={done ? "hsl(var(--brand))" : "hsl(var(--card))"} stroke={done ? "hsl(var(--brand))" : "hsl(var(--foreground) / 0.3)"} strokeWidth="2" />
                          {done && <path d={`M${x - 3} ${y} l2 2 l4 -4`} fill="none" stroke="#080808" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
                        </g>
                      );
                    })}
                    {/* patio */}
                    <rect x="22" y="196" width="28" height="18" rx="4" fill="#080808" />
                    <text x="36" y="208" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="8" fontWeight="700" fill="#04E8A4">PÁTIO</text>
                    {/* veiculo */}
                    <g style={{ transform: `translate(${tx}px, ${ty}px)`, transition: playing ? "transform 1.2s ease" : undefined }}>
                      <circle r="16" fill="hsl(var(--brand) / 0.2)" />
                      <circle r="11" fill="hsl(var(--brand))" stroke="hsl(var(--card))" strokeWidth="3" />
                    </g>
                  </svg>
                </div>
                <dl aria-hidden="true" className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Entregues", `${delivered}/14`],
                    ["Canhotos no painel", String(delivered)],
                    ["SLA do dia", delivered ? "100%" : "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-foreground/10 bg-background px-2 py-2.5">
                      <dt className="text-[11px] text-muted-foreground">{k}</dt>
                      <dd className="font-data text-lg font-bold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* com o na hora frota */}
              <div className="order-3 flex flex-col rounded-2xl border border-brand/40 bg-brand-soft p-5">
                <p className="flex items-center gap-2 label-caps text-brand">
                  <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} /> Com o Na Hora Frota
                </p>
                <p key={`com-${moment.t}`} className="mt-3 animate-fade-in text-pretty text-[0.95rem] leading-relaxed text-foreground">{moment.com}</p>
                <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Truck aria-hidden="true" className="h-3.5 w-3.5 text-brand" /> João Silva · ABC1D23 · agregado
                </p>
                <dl className="mt-auto space-y-2 pt-5">
                  {COM_STATS.map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3 border-t border-brand/20 pt-2 text-sm">
                      <dt className="text-foreground/75">{k}</dt>
                      <dd className="font-data text-lg font-bold tabular-nums text-brand">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
