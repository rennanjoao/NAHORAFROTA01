import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MapPin, FileText, Camera, Wallet, Gauge, BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import { MapPanel, ManifestPanel, ProofPanel, SettlementPanel } from "../components/mockups/Panels";

const TABS = [
  { id: "mapa", icon: MapPin, label: "Mapa ao vivo", title: "Cada placa, um ponto no mapa.", text: "A posição vem do celular do motorista, a cada 30 segundos. Em rota, parado ou atrasado: a cor diz na hora.", Panel: MapPanel, alt: "Mapa ao vivo com veículos em rota, filtros e detalhe do motorista selecionado" },
  { id: "romaneio", icon: FileText, label: "Romaneio", title: "Importe o XML, monte o romaneio, despache.", text: "Notas em lote direto da NF-e, ordem das paradas otimizada e romaneio no celular do motorista.", Panel: ManifestPanel, alt: "Montagem de romaneio com notas importadas do XML e botão de despachar" },
  { id: "canhoto", icon: Camera, label: "Canhoto", title: "Prova de entrega com hora, foto e assinatura.", text: "O motorista confirma na porta do cliente. O comprovante entra no painel na mesma hora, ligado à nota.", Panel: ProofPanel, alt: "Comprovante de entrega com foto, assinatura, recebedor e SLA cumprido" },
  { id: "acerto", icon: Wallet, label: "Acerto", title: "Frete, adiantamento, desconto. Acerto fechado.", text: "Cada romaneio de agregado gera o acerto sozinho. Histórico por motorista e chave Pix na tela.", Panel: SettlementPanel, alt: "Acerto do motorista com frete, adiantamento, total a pagar e chave Pix" },
];

const MORE = [
  { icon: Gauge, title: "SLA medido, não prometido", text: "Diário e semanal, por motorista, região e entrega." },
  { icon: BarChart3, title: "Relatórios para a reunião", text: "Lucratividade por rota, eficiência por região e top ofensores, em PDF." },
  { icon: Users, title: "Cada um vê o que precisa", text: "Admin, gestor, despachante e visualizador. Motorista só vê o romaneio dele." },
];

/** O produto na pratica: abas que trocam a tela do painel. */
export function Product() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const base = useId();
  const tab = TABS[active];
  return (
    <section id="produto" className="scroll-mt-nav py-20 lg:py-28" aria-labelledby="produto-title">
      <div className="container">
        <SectionHeader align="center" eyebrow="O produto" title="O pátio inteiro numa tela." accent="numa tela." lead="Escolha um módulo para ver como ele aparece no painel." />

        <Reveal className="mt-10">
          <div role="tablist" aria-label="Módulos do painel" className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                role="tab"
                id={`${base}-tab-${t.id}`}
                aria-selected={i === active}
                aria-controls={`${base}-panel-${t.id}`}
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") setActive((a) => (a + 1) % TABS.length);
                  if (e.key === "ArrowLeft") setActive((a) => (a - 1 + TABS.length) % TABS.length);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === active ? "border-brand bg-brand text-nhf-ink" : "border-foreground/10 bg-card text-foreground/80 hover:border-brand/50",
                )}
              >
                <t.icon aria-hidden="true" className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          <div id={`${base}-panel-${tab.id}`} role="tabpanel" aria-labelledby={`${base}-tab-${tab.id}`} className="mx-auto mt-8 grid max-w-5xl items-start gap-8 lg:grid-cols-[0.8fr_1.4fr]">
            <div className="lg:pt-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <h3 className="font-heading text-2xl font-semibold tracking-tight">{tab.title}</h3>
                  <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{tab.text}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div role="img" aria-label={tab.alt}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab.id} aria-hidden="true" initial={reduce ? false : { opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="shadow-lg">
                  <tab.Panel />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>

        <Stagger className="mt-14 grid gap-5 md:grid-cols-3" gap={0.06}>
          {MORE.map((m) => (
            <StaggerItem key={m.title}>
              <div className="site-card h-full p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <m.icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-heading text-lg font-semibold tracking-tight">{m.title}</h3>
                <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">{m.text}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
