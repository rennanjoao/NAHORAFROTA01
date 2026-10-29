import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Check, Smartphone, FileText, MapPin, Gauge, Wallet } from "lucide-react";
import { useParallax } from "../motion/useParallax";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import { Cta } from "../components/Cta";

const LAYERS = [
  { icon: Smartphone, label: "App do motorista" },
  { icon: FileText, label: "Romaneio e notas" },
  { icon: MapPin, label: "Mapa e GPS" },
  { icon: Gauge, label: "SLA e ocorrências" },
  { icon: Wallet, label: "Acerto e relatórios" },
];

const CHECKS = ["Acesso liberado na hora, depois do pagamento", "Dados de cada empresa separados no servidor", "Funciona no navegador e no celular, sem instalar", "Suporte por e-mail, resposta no mesmo dia útil"];

/** Por dentro: as camadas do sistema empilhadas em perspectiva (so CSS). */
export function Platform() {
  const reduce = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const open = useInView(scene, { once: true, amount: 0.4 });
  useParallax(scene, section);
  return (
    <section ref={section} id="plataforma" className="scroll-mt-nav py-24 lg:py-32" aria-labelledby="plataforma-title">
      <div className="container grid items-center gap-14 lg:grid-cols-[1fr_1fr]">
        <div>
          <SectionHeader eyebrow="A plataforma" title="Cinco camadas que conversam. Uma operação só." accent="Uma operação só." lead="O que o motorista registra no app aparece no mapa, entra no SLA e fecha o acerto. Sem digitar duas vezes, sem planilha no meio." />
          <Stagger className="mt-8 space-y-3" gap={0.06}>
            {CHECKS.map((c) => (
              <StaggerItem key={c}>
                <p className="flex items-center gap-3 text-[0.95rem] font-medium">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-nhf-ink">
                    <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  {c}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
          <div className="mt-8">
            <Cta href="#planos" arrow>
              Quero na minha operação
            </Cta>
          </div>
          <Reveal className="mt-8 grid gap-3 sm:grid-cols-3">
            {[["R$ 0", "de implantação"], ["2 telas", "navegador e celular"], ["Mesmo dia", "do pagamento à 1ª rota"]].map(([v, l]) => (
              <div key={v} className="rounded-xl border border-foreground/10 border-l-4 border-l-brand bg-card px-4 py-3">
                <p className="font-heading text-lg font-semibold">{v}</p>
                <p className="text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </Reveal>
        </div>

        {/* pilha isometrica */}
        <Reveal delay={0.1}>
          <div className="relative mx-auto h-[400px] w-full max-w-[520px] overflow-hidden sm:h-[520px] sm:overflow-visible" role="img" aria-label="As cinco camadas do Na Hora Frota empilhadas: app do motorista, romaneio e notas, mapa e GPS, SLA e ocorrências, acerto e relatórios.">
            <div ref={scene} aria-hidden="true" className="iso-scene absolute inset-0 flex translate-y-14 scale-[0.74] items-center justify-center sm:translate-y-8 sm:scale-100">
              <div
                className="relative h-[190px] w-[280px] sm:h-[210px] sm:w-[320px]"
                style={{ transform: "rotateX(calc(58deg - var(--py, 0) * 6deg)) rotateZ(calc(-36deg + var(--px, 0) * 8deg))", transformStyle: "preserve-3d" }}
              >
                {LAYERS.map((l, i) => {
                  const level = LAYERS.length - 1 - i;
                  const top = i === 0;
                  return (
                    <motion.div
                      key={l.label}
                      className={`absolute inset-0 rounded-2xl border-2 ${top ? "border-nhf-green bg-white shadow-[0_0_40px_-6px_hsl(var(--brand)/0.7)]" : "border-nhf-green/55 bg-nhf-ink"}`}
                      initial={reduce ? false : { z: level * 14, opacity: 0.6 }}
                      animate={open || reduce ? { z: level * 74, opacity: 1 } : undefined}
                      transition={{ type: "spring", stiffness: 70, damping: 14, delay: 0.15 + level * 0.07 }}
                      style={reduce ? { z: level * 74 } : undefined}
                    >
                      {top && (
                        <div className="space-y-2 p-5">
                          <span className="block h-2 w-3/4 rounded-full bg-nhf-ink/15" />
                          <span className="block h-2 w-1/2 rounded-full bg-nhf-green" />
                          <span className="block h-2 w-2/3 rounded-full bg-nhf-ink/10" />
                        </div>
                      )}
                      {/* borda da frente: o que continua visivel embaixo da camada de cima */}
                      <div className="absolute inset-x-4 bottom-3 flex items-center gap-2">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${top ? "bg-nhf-ink text-nhf-green" : "bg-nhf-green/15 text-nhf-green"}`}>
                          <l.icon className="h-4 w-4" />
                        </span>
                        <span className={`whitespace-nowrap font-heading text-sm font-bold ${top ? "text-nhf-ink" : "text-white"}`}>{l.label}</span>
                        {top && <span className="ml-auto h-2 w-2 rounded-full bg-nhf-green" />}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
