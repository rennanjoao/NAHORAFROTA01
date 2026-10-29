import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion, type AnimationPlaybackControls } from "framer-motion";
import { Pause, Play, X, Check, Truck, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, EASE } from "../components/Reveal";

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
/* Ligacoes "cade o motorista?" ao longo do dia, sem painel (a terceira, quarta e quinta perto das 12:30). */
const CALL_AT = [240, 350, 372, 390, 540];

/* Reproducao: o relogio anda (minutos do dia por segundo), desacelera e para em cada momento. */
const SPEED = 85;
const DWELL = 2300;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/* Rota pelas ruas (segmentos retos) e paradas, no viewBox 400 x 240. */
const ROUTE: [number, number][] = [[36, 204], [36, 140], [132, 140], [132, 84], [236, 84], [236, 36], [332, 36], [332, 132], [372, 132]];
const STOPS = [0.16, 0.32, 0.5, 0.66, 0.82, 1];
const ROUTE_POINTS = ROUTE.map((p) => p.join(",")).join(" ");

function clock(t: number) {
  const m = 6 * 60 + Math.round(t);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function momentAt(t: number) {
  return [...MOMENTS].reverse().find((m) => m.t <= t + 0.5) ?? MOMENTS[0];
}

/* Posicao no trilho do slider: o centro do botao (24 px) vai de 12 px a 100% - 12 px. */
const onTrack = (frac: number) => `calc(12px + (100% - 24px) * ${frac.toFixed(4)})`;

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

/* Direcao do trecho em que o veiculo esta (graus, 0 = para a direita). */
function headingAt(frac: number) {
  const [x0, y0] = pointAt(Math.max(0, frac - 0.004));
  const [x1, y1] = pointAt(Math.min(1, frac + 0.004));
  return (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
}

/** Numero que rola para cima quando muda (placar). */
function Roll({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={cn("relative inline-flex overflow-hidden", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="inline-block"
          initial={reduce ? false : { y: "80%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={reduce ? undefined : { y: "-80%", opacity: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Texto que troca com um cruzamento suave (sobe e foca). */
function Swap({ id, children, className }: { id: string | number; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={id}
        className={className}
        initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={reduce ? undefined : { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.18 } }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {children}
      </motion.p>
    </AnimatePresence>
  );
}

/** Mapa da rota. Linha e veiculo saem do mesmo progresso, quadro a quadro: o veiculo nunca descola da linha. */
function SimMap({ progress, started, moving, delivered }: { progress: number; started: boolean; moving: boolean; delivered: number }) {
  const [x, y] = pointAt(progress);
  const heading = headingAt(progress);
  return (
    <div aria-hidden="true" className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-muted/60">
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
        {/* trajeto previsto + trecho percorrido */}
        <polyline points={ROUTE_POINTS} fill="none" stroke="hsl(var(--foreground) / 0.18)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="2 8" />
        <polyline points={ROUTE_POINTS} fill="none" stroke="hsl(var(--brand))" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - progress} />
        {STOPS.map((f, i) => {
          const [sx, sy] = pointAt(f);
          const done = started && progress >= f - 0.002;
          return (
            <g key={i} transform={`translate(${sx} ${sy})`}>
              <g className="sim-stop" data-done={done}>
                <circle r="7" fill={done ? "hsl(var(--brand))" : "hsl(var(--card))"} stroke={done ? "hsl(var(--brand))" : "hsl(var(--foreground) / 0.3)"} strokeWidth="2" style={{ transition: "fill .25s ease, stroke .25s ease" }} />
                <path d="M-3 0 l2 2 l4 -4" fill="none" stroke="#080808" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={done ? 1 : 0} style={{ transition: "opacity .2s ease" }} />
              </g>
            </g>
          );
        })}
        {/* patio */}
        <rect x="22" y="196" width="28" height="18" rx="4" fill="#080808" />
        <text x="36" y="208" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="8" fontWeight="700" fill="#04E8A4">PÁTIO</text>
        {/* veiculo: sempre sobre a linha, com a seta no sentido da rua */}
        <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
          <circle r="15" fill="hsl(var(--brand) / 0.22)" className={moving ? "ping-ring" : undefined} style={{ animationDuration: "1.6s" }} />
          <circle r="9.5" fill="#080808" stroke="hsl(var(--card))" strokeWidth="2.5" />
          <path d="M-3.2 -3.6 L4 0 L-3.2 3.6 L-1.6 0 Z" fill="#04E8A4" transform={`rotate(${heading.toFixed(1)})`} />
        </g>
      </svg>
      {/* ultimo canhoto que chegou ao painel */}
      <div className={cn("absolute left-3 top-3 transition-[opacity,transform] duration-500", delivered ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0")}>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-card/95 px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur">
          <Camera className="h-3 w-3 text-brand" />
          Canhoto <Roll value={`${Math.max(1, delivered)}/14`} className="font-data tabular-nums" /> no painel
          <span className="font-data font-normal text-muted-foreground">· <Roll value={clock(DELIVERED_AT[Math.max(0, delivered - 1)])} className="tabular-nums" /></span>
        </span>
      </div>
    </div>
  );
}

/** O painel do dia (relogio, linha do tempo, comparacao). Separado do cabecalho porque re-renderiza a cada quadro ao reproduzir. */
function DayBoard() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [t, setT] = useState(0);
  const tRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [moving, setMoving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [announce, setAnnounce] = useState("");
  const tween = useRef<AnimationPlaybackControls | null>(null);

  const setTime = (v: number) => {
    tRef.current = v;
    setT(v);
  };
  const stopTween = () => {
    tween.current?.stop();
    tween.current = null;
  };

  // Toca sozinho a primeira vez que aparece.
  useEffect(() => {
    if (inView && !touched && !reduce) setPlaying(true);
  }, [inView, touched, reduce]);

  // Reproducao continua: anda ate o proximo momento (acelera e desacelera), para, le, segue.
  useEffect(() => {
    if (!playing || !inView) return;
    type Phase = { kind: "dwell"; until: number } | { kind: "travel"; from: number; to: number; start: number; dur: number };
    const travel = (now: number, from: number): Phase | null => {
      const next = MOMENTS.find((m) => m.t > from + 0.5);
      if (!next) return null;
      return { kind: "travel", from, to: next.t, start: now, dur: Math.max(900, ((next.t - from) / SPEED) * 1000) };
    };
    let phase: Phase | null = null;
    let raf = 0;
    const loop = (now: number) => {
      if (!phase) {
        const cur = tRef.current;
        const atMoment = MOMENTS.some((m) => Math.abs(m.t - cur) < 0.5);
        phase = atMoment ? { kind: "dwell", until: now + (cur < 0.5 ? 1100 : DWELL * 0.6) } : travel(now, cur);
        if (!phase) {
          setPlaying(false);
          return;
        }
      }
      if (phase.kind === "dwell") {
        setMoving(false);
        if (now >= phase.until) {
          phase = travel(now, tRef.current);
          if (!phase) {
            setPlaying(false);
            return;
          }
        }
      } else {
        setMoving(true);
        const k = Math.min(1, (now - phase.start) / phase.dur);
        setTime(phase.from + (phase.to - phase.from) * easeInOut(k));
        if (k >= 1) {
          setMoving(false);
          if (phase.to >= END) {
            setPlaying(false);
            return;
          }
          phase = { kind: "dwell", until: now + DWELL };
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setMoving(false);
    };
  }, [playing, inView]);

  useEffect(() => () => stopTween(), []);

  const moment = useMemo(() => momentAt(t), [t]);
  const delivered = DELIVERED_AT.filter((d) => d <= t + 0.5).length;
  const calls = CALL_AT.filter((c) => c <= t + 0.5).length;
  const progress = Math.min(1, Math.max(0, (t - 20) / (690 - 20)));
  const frac = t / END;
  const SEM_STATS: [string, string][] = [
    ["Ligações para achar o motorista", String(calls)],
    ["Canhotos que o escritório ainda não viu", String(delivered)],
  ];
  const COM_STATS: [string, string][] = [
    ["Ligações para achar o motorista", "0"],
    ["Canhotos já no painel", String(delivered)],
  ];

  const say = (v: number) => {
    const m = momentAt(v);
    setAnnounce(`${clock(v)}. ${m.title}. Sem painel: ${m.sem} Com o Na Hora Frota: ${m.com}`);
  };

  /* Arrastar o slider: segue o dedo, sem animacao no meio. */
  const onInput = (v: number) => {
    setTouched(true);
    setPlaying(false);
    stopTween();
    setTime(v);
    say(v);
  };

  /* Clicar num horario: o relogio corre ate la. */
  const glideTo = (v: number, then?: () => void) => {
    stopTween();
    if (reduce) {
      setTime(v);
      then?.();
      return;
    }
    const from = tRef.current;
    setMoving(true);
    tween.current = animate(from, v, {
      duration: Math.min(1.2, Math.max(0.5, Math.abs(v - from) / 500)),
      ease: [0.65, 0, 0.35, 1],
      onUpdate: setTime,
      onComplete: () => {
        setMoving(false);
        then?.();
      },
    });
  };

  const jump = (v: number) => {
    setTouched(true);
    setPlaying(false);
    glideTo(v, () => say(v));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const cur = tRef.current;
    const prev = [...MOMENTS].reverse().find((m) => m.t < cur - 0.5)?.t ?? 0;
    const next = MOMENTS.find((m) => m.t > cur + 0.5)?.t ?? END;
    const map: Record<string, number> = {
      ArrowRight: cur + (e.shiftKey ? 60 : 10),
      ArrowUp: cur + (e.shiftKey ? 60 : 10),
      ArrowLeft: cur - (e.shiftKey ? 60 : 10),
      ArrowDown: cur - (e.shiftKey ? 60 : 10),
      PageUp: next,
      PageDown: prev,
      Home: 0,
      End: END,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    onInput(Math.max(0, Math.min(END, Math.round(map[e.key]))));
  };

  const togglePlay = () => {
    setTouched(true);
    stopTween();
    if (playing) {
      setPlaying(false);
      return;
    }
    // No fim do dia, "Rever o dia" rebobina o relogio e toca de novo.
    if (t >= END - 0.5) glideTo(0, () => setPlaying(true));
    else setPlaying(true);
  };

  return (
    <div ref={ref} className="site-card p-5 sm:p-7 lg:p-8">
      {/* relogio + controle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-4">
          <span className="font-data text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">{clock(t)}</span>
          <Swap id={moment.t} className="font-heading text-lg font-semibold text-foreground/80">
            {moment.title}
          </Swap>
        </div>
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-foreground/15 bg-background px-4 text-sm font-semibold transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {playing ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
          {playing ? "Pausar" : t >= END - 0.5 ? "Rever o dia" : "Reproduzir o dia"}
        </button>
      </div>

      {/* linha do tempo: trilho desenhado + slider nativo (so o botao aparece) */}
      <div className="mt-6">
        <label htmlFor="hora-do-dia" className="sr-only">Hora do dia, das 06:00 às 19:00</label>
        <div className="relative h-6">
          {/* trilho vai do centro do botao em 06:00 ao centro em 19:00 (12 px de cada lado) */}
          <div aria-hidden="true" className="absolute left-3 right-3 top-1/2 h-2 -translate-y-1/2 rounded-full bg-foreground/10">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand/70 to-[hsl(var(--brand))] shadow-[0_0_12px_hsl(var(--brand)/0.45)]" style={{ width: `${(frac * 100).toFixed(3)}%` }} />
          </div>
          {MOMENTS.map((m) => {
            const passed = m.t <= t + 0.5;
            return (
              <span
                key={m.t}
                aria-hidden="true"
                className={cn("sim-tick absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card", passed ? "bg-[hsl(var(--brand))]" : "bg-foreground/20")}
                data-passed={passed}
                style={{ left: onTrack(m.t / END) }}
              />
            );
          })}
          <input
            id="hora-do-dia"
            type="range"
            min={0}
            max={END}
            step="any"
            value={t}
            onChange={(e) => onInput(Number(e.target.value))}
            onKeyDown={onKey}
            aria-valuetext={`${clock(t)}, ${moment.title}`}
            className="range-thumb absolute inset-0 w-full"
          />
        </div>
        <div aria-hidden="true" className="relative mt-2 hidden h-5 sm:block">
          {MOMENTS.map((m) => (
            <button
              key={m.t}
              type="button"
              tabIndex={-1}
              onClick={() => jump(m.t)}
              className={cn(
                "absolute font-data text-xs tabular-nums transition-colors duration-300 hover:text-brand",
                m.t === 0 ? "translate-x-0" : m.t === END ? "-translate-x-full" : "-translate-x-1/2",
                m.t <= t + 0.5 ? "text-foreground" : "text-muted-foreground",
              )}
              style={{ left: m.t === 0 ? 0 : m.t === END ? "100%" : onTrack(m.t / END) }}
            >
              {clock(m.t)}
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.25fr_1fr]">
        {/* sem painel */}
        <div className="relative order-2 flex flex-col overflow-hidden rounded-2xl border border-nhf-late/20 bg-nhf-late/[0.05] p-5 lg:order-1">
          <motion.span key={`f-sem-${moment.t}`} aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-nhf-late/40" initial={{ opacity: reduce ? 0 : 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.2, ease: "easeOut" }} />
          <p className="flex items-center gap-2 label-caps text-late">
            <X aria-hidden="true" className="h-4 w-4" /> Sem painel
          </p>
          <Swap id={moment.t} className="mt-3 text-pretty text-[0.95rem] leading-relaxed text-foreground/85">
            {moment.sem}
          </Swap>
          <dl className="mt-auto space-y-2 pt-5">
            {SEM_STATS.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-t border-nhf-late/15 pt-2 text-sm">
                <dt className="text-foreground/75">{k}</dt>
                <dd className="font-data text-lg font-bold tabular-nums text-late">
                  <Roll value={v} />
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* mapa + numeros */}
        <div className="order-1 lg:order-2" role="img" aria-label={`Mapa da rota às ${clock(t)}: ${delivered} de 14 entregas feitas.`}>
          <SimMap progress={progress} started={t >= 149.5} moving={moving} delivered={delivered} />
          <dl aria-hidden="true" className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["Entregues", `${delivered}/14`],
              ["Canhotos no painel", String(delivered)],
              ["SLA do dia", delivered ? "100%" : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-foreground/10 bg-background px-2 py-2.5">
                <dt className="text-[11px] text-muted-foreground">{k}</dt>
                <dd className="font-data text-lg font-bold tabular-nums">
                  <Roll value={v} />
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* com o na hora frota */}
        <div className="relative order-3 flex flex-col overflow-hidden rounded-2xl border border-brand/40 bg-brand-soft p-5">
          <motion.span key={`f-com-${moment.t}`} aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-[hsl(var(--brand))]" initial={{ opacity: reduce ? 0 : 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.2, ease: "easeOut" }} />
          <p className="flex items-center gap-2 label-caps text-brand">
            <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} /> Com o Na Hora Frota
          </p>
          <Swap id={moment.t} className="mt-3 text-pretty text-[0.95rem] leading-relaxed text-foreground">
            {moment.com}
          </Swap>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Truck aria-hidden="true" className="h-3.5 w-3.5 text-brand" /> João Silva · ABC1D23 · agregado
          </p>
          <dl className="mt-auto space-y-2 pt-5">
            {COM_STATS.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-t border-brand/20 pt-2 text-sm">
                <dt className="text-foreground/75">{k}</dt>
                <dd className="font-data text-lg font-bold tabular-nums text-brand">
                  <Roll value={v} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

export function DaySimulator() {
  return (
    <section id="na-pratica" className="scroll-mt-nav py-24 lg:py-32" aria-labelledby="na-pratica-title">
      <div className="container">
        <SectionHeader
          eyebrow="Na prática"
          title="Arraste e veja um dia da sua operação."
          accent="um dia da sua operação."
          lead="Do romaneio saindo do pátio ao acerto do agregado. À esquerda, como é sem painel. À direita, o que a sua equipe vê com o Na Hora Frota."
        />
        <Reveal className="mt-12 lg:mt-16">
          <DayBoard />
        </Reveal>
      </div>
    </section>
  );
}
