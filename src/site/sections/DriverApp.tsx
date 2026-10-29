import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";
import { PhoneMockup } from "../components/mockups/PhoneMockup";

const SPECS = [
  { value: "1 min", title: "Instala em um minuto", text: "Abre no navegador do celular e vira app na tela inicial. Android e iPhone, sem loja." },
  { value: "30 s", title: "Posição a cada 30 segundos", text: "Enquanto o romaneio está em rota, o GPS do celular alimenta o mapa do gestor." },
  { value: "1 toque", title: "Canhoto com foto e assinatura", text: "Confirmação na porta do cliente, com hora e nota fiscal ligadas ao comprovante." },
  { value: "Ligada", title: "Tela acordada em rota", text: "O app mantém a tela ligada e avisa quando o GPS cai. Menos entrega sem posição." },
  { value: "1 login", title: "Só o romaneio dele", text: "Cada motorista entra com a conta dele e vê só a rota do dia. Nada de painel do gestor." },
];

/** O celular gira em 3D conforme a pagina rola e troca de tela: lista → confirmando → entregue. */
export function DriverApp() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 40%"] });
  const p = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });
  const rotateY = useTransform(p, [0, 1], [-30, 14]);
  const rotateX = useTransform(p, [0, 1], [12, -4]);
  const y = useTransform(p, [0, 1], [40, -40]);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  useMotionValueEvent(p, "change", (v) => setStep(v < 0.38 ? 0 : v < 0.62 ? 1 : 2));

  return (
    <section ref={ref} id="motorista" className="scroll-mt-nav relative overflow-hidden border-t hairline bg-nhf-ink py-24 text-white lg:py-36 dark:bg-background" aria-labelledby="motorista-title">
      <div aria-hidden="true" className="orb left-[-10%] top-1/3 h-[560px] w-[560px] bg-brand/[0.14]" />
      <div className="container grid items-center gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
        <div className="order-2 flex justify-center lg:order-1">
          <div className="perspective-1600 relative">
            {/* ondas de GPS */}
            <div aria-hidden="true" className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/30"
                  animate={reduce ? undefined : { scale: [0.6, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 4.5, delay: i * 1.5, repeat: Infinity, ease: "easeOut" }}
                />
              ))}
            </div>
            <motion.div style={reduce ? undefined : { rotateY, rotateX, y, transformStyle: "preserve-3d" }} className="will-change-transform">
              <PhoneMockup className="w-[280px] sm:w-[300px] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]" step={step} />
            </motion.div>
          </div>
        </div>

        <div className="order-1 lg:order-2 [&_.text-brand]:!text-nhf-green [&_.text-muted-foreground]:!text-white/65 [&_h2]:text-white">
          <SectionHeader
            index="04"
            size="xl"
            eyebrow="App do motorista"
            title="Na mão do motorista. Sem treinamento."
            accent="Sem treinamento."
            lead="Lista de entregas em ordem, próxima parada com endereço, canhoto com foto e assinatura, ocorrência com um toque. Fala a língua de quem dirige."
          />
          <Stagger className="mt-12 divide-y divide-white/10 border-y border-white/10" gap={0.07}>
            {SPECS.map((s) => (
              <StaggerItem key={s.title}>
                <div className="grid grid-cols-[112px_1fr] items-start gap-4 py-5 sm:grid-cols-[140px_1fr]">
                  <span className="font-data text-2xl font-bold tracking-tight text-nhf-green sm:text-3xl">{s.value}</span>
                  <div>
                    <h3 className="font-heading text-base font-bold text-white sm:text-lg">{s.title}</h3>
                    <p className="mt-1 text-pretty text-sm leading-relaxed text-white/60">{s.text}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
