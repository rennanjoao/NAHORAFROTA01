import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { MapPin, FileText, Camera, Wallet, Gauge, BarChart3, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";
import { MapPanel, ManifestPanel, ProofPanel, SettlementPanel, SlaPanel, ReportsPanel } from "../components/mockups/Panels";
import { Tilt } from "../motion/Tilt";

const TABS = [
  { id: "mapa", icon: MapPin, label: "Mapa ao vivo", plan: "Standard: a cada 30 min · Premium: tempo real", title: "Cada placa, um ponto no mapa.", text: "A posição vem do celular do motorista. No Premium o mapa é em tempo real; no Standard, atualiza a cada 30 minutos. Em rota, parado ou atrasado: a cor diz na hora.", bullets: ["GPS do celular, sem rastreador", "Cor por status: no prazo, atenção, atrasado", "Áreas de alerta com o status de cada motorista"], Panel: MapPanel, alt: "Mapa ao vivo com veículos em rota, filtros e detalhe do motorista selecionado" },
  { id: "romaneio", icon: FileText, label: "Romaneio", plan: "Em todos os planos · melhor trajeto a partir do Standard", title: "Importe as notas, monte o romaneio, despache.", text: "Notas pelo XML da NF-e ou pedidos por planilha. A ordem das paradas é a que você escolher no Basic, o melhor trajeto no Standard e o roteirizador avançado no Premium.", bullets: ["XML da NF-e ou planilha de pedidos, sem digitar", "Devolvidos voltam para um novo romaneio", "Regiões separadas para ver e roteirizar"], Panel: ManifestPanel, alt: "Montagem de romaneio com notas importadas do XML e botão de despachar" },
  { id: "canhoto", icon: Camera, label: "Canhoto digital", plan: "Em todos os planos", title: "Prova de entrega com hora, foto e assinatura.", text: "O motorista confirma na porta do cliente. O comprovante entra no painel na mesma hora, ligado à nota.", bullets: ["Foto e assinatura na porta do cliente", "Nome de quem recebeu", "Ligado à nota fiscal: acha em segundos"], Panel: ProofPanel, alt: "Comprovante de entrega com foto, assinatura, recebedor e SLA cumprido" },
  { id: "sla", icon: Gauge, label: "SLA", plan: "A partir do Standard · por motorista no Premium", title: "SLA não se promete. Se mede.", text: "SLA em tempo real no painel, com receita, custo do frete de terceiros e eficiência do frete. No Premium, quem está abaixo hoje aparece motorista por motorista.", bullets: ["SLA em tempo real", "Receita, custo e eficiência do frete", "Motoristas que pedem atenção, com nota de 0 a 5, no Premium"], Panel: SlaPanel, alt: "SLA da semana com barras por dia, ranking de motoristas e regiões" },
  { id: "acerto", icon: Wallet, label: "Acerto", plan: "Em todos os planos · relatório de pagamento no Premium", title: "Frete, adiantamento, desconto. Acerto fechado.", text: "Acerto em lote com recibo, baixa em lote e comprovante de pagamento. No Premium, relatório de pagamento e aviso ao financeiro quando o motorista deixa de entregar.", bullets: ["Acerto em lote, com recibo", "Baixa em lote e comprovante", "Motoristas que mais faturaram, no Premium"], Panel: SettlementPanel, alt: "Acerto do motorista com frete, adiantamento, total a pagar e chave Pix" },
  { id: "relatorios", icon: BarChart3, label: "Relatórios", plan: "Uso da frota em todos · desempenho no Standard · tudo no Premium", title: "Os números da reunião de segunda, prontos.", text: "Uso da frota em todos os planos. Desempenho e eficiência a partir do Standard. Rentabilidade e exportação em PDF no Premium.", bullets: ["Uso da frota", "Desempenho e eficiência", "Rentabilidade e exportação no Premium"], Panel: ReportsPanel, alt: "Relatórios do mês com custo por entrega, margem por rota, gráfico de SLA e botão de exportar PDF" },
];

/** O produto na pratica: abas que avancam sozinhas (pausam no hover e param quando a pessoa escolhe). */
export function Product() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState(false);
  const base = useId();
  const tab = TABS[active];
  const autoplay = auto && !reduce;

  const choose = (i: number) => {
    setAuto(false);
    setActive(i);
  };

  return (
    <section id="produto" className="scroll-mt-nav border-y border-foreground/10 bg-card py-24 lg:py-32" aria-labelledby="produto-title">
      <div className="container">
        <SectionHeader align="center" eyebrow="O produto" title="O pátio inteiro numa tela." accent="numa tela." lead="Seis módulos que falam a língua da operação. Escolha um para ver como ele aparece no painel." />

        <Reveal className="mt-12 lg:mt-16">
          <div ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocusCapture={() => setHover(true)} onBlurCapture={() => setHover(false)}>
            <div role="tablist" aria-label="Módulos do painel" className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2">
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  role="tab"
                  id={`${base}-tab-${t.id}`}
                  aria-selected={i === active}
                  aria-controls={`${base}-panel`}
                  tabIndex={i === active ? 0 : -1}
                  onClick={() => choose(i)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") { e.preventDefault(); choose((active + 1) % TABS.length); document.getElementById(`${base}-tab-${TABS[(active + 1) % TABS.length].id}`)?.focus(); }
                    if (e.key === "ArrowLeft") { e.preventDefault(); const p = (active - 1 + TABS.length) % TABS.length; choose(p); document.getElementById(`${base}-tab-${TABS[p].id}`)?.focus(); }
                  }}
                  className={cn(
                    "relative inline-flex items-center gap-2 overflow-hidden rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    i === active ? "border-nhf-ink bg-nhf-ink text-white dark:border-white dark:bg-white dark:text-nhf-ink" : "border-foreground/10 bg-background text-foreground/80 hover:border-foreground/30",
                  )}
                >
                  <t.icon aria-hidden="true" className={cn("h-4 w-4", i === active && "text-nhf-green dark:text-nhf-green-deep")} />
                  {t.label}
                  {autoplay && i === active && (
                    <span
                      key={`p-${active}`}
                      aria-hidden="true"
                      data-paused={!inView || hover}
                      onAnimationEnd={() => setActive((a) => (a + 1) % TABS.length)}
                      className="tab-progress absolute inset-x-0 bottom-0 h-[3px] bg-nhf-green"
                      style={{ ["--tab-duration" as string]: "6.5s" }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${tab.id}`} className="mx-auto mt-10 grid max-w-6xl items-center gap-10 lg:grid-cols-[0.85fr_1.4fr]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab.id} initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                  <p className="label-caps text-brand">{tab.plan}</p>
                  <h3 className="mt-3 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{tab.title}</h3>
                  <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{tab.text}</p>
                  <ul className="mt-5 space-y-2.5">
                    {tab.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-[0.95rem]">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-nhf-ink">
                          <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <a href="#planos" className="mt-6 inline-flex items-center gap-1.5 font-heading text-sm font-semibold underline decoration-brand decoration-2 underline-offset-[6px] hover:text-brand">
                    Ver em qual plano entra <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </a>
                </motion.div>
              </AnimatePresence>
              <div role="img" aria-label={tab.alt} className="relative">
                <div aria-hidden="true" className="absolute -inset-4 -z-10 rounded-[28px] bg-brand/10 blur-2xl" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={tab.id} aria-hidden="true" initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
                    <Tilt max={3} glare={false} className="rounded-lg shadow-xl">
                      <tab.Panel />
                    </Tilt>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
