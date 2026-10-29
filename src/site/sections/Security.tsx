import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, KeyRound, Database, FileCheck2 } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";

const ITEMS = [
  { icon: ShieldCheck, title: "Isolamento por empresa", text: "Cada cliente enxerga só os próprios dados. A regra vale no servidor, não só na tela." },
  { icon: KeyRound, title: "Login por pessoa", text: "Senha temporária trocada no primeiro acesso. Perfis por função e motorista só no app dele." },
  { icon: Database, title: "Banco gerenciado", text: "Postgres no Supabase, conexão HTTPS, fotos e assinaturas em armazenamento privado." },
  { icon: FileCheck2, title: "LGPD", text: "Dados usados só para operar o serviço. Você exporta ou apaga quando quiser." },
];

const LOG = [
  ["14:32:08", "canhoto NF 48213 gravado em armazenamento privado", "ok"],
  ["14:32:09", "consulta: empresa 552007c7 · isolamento aplicado no servidor", "ok"],
  ["14:32:11", "primeiro acesso: senha temporária substituída", "ok"],
  ["14:32:15", "posição ABC1D23 recebida por HTTPS", "ok"],
  ["14:32:20", "motorista JS: acesso ao painel do gestor", "negado"],
  ["14:32:31", "exportação de dados solicitada pelo administrador", "ok"],
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function Security() {
  const reduce = useReducedMotion();
  return (
    <section id="seguranca" className="scroll-mt-nav relative border-t hairline py-24 lg:py-36" aria-labelledby="seguranca-title">
      <div className="container grid items-start gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <SectionHeader index="08" size="md" eyebrow="Confiança" title="Seus dados, só da sua empresa." accent="só da sua empresa." lead="Operação é informação sensível: cliente, endereço, valor de frete. Tratamos como tal." />
          <Stagger className="mt-12 grid gap-6 sm:grid-cols-2" gap={0.08}>
            {ITEMS.map((i) => (
              <StaggerItem key={i.title}>
                <div className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand">
                    <i.icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-heading text-lg font-bold tracking-tight">{i.title}</h3>
                    <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{i.text}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-lg border hairline bg-nhf-ink text-white" role="img" aria-label="Exemplo de registro de atividade do sistema: comprovantes gravados em armazenamento privado, isolamento por empresa aplicado no servidor, senha temporária substituída no primeiro acesso, posição recebida por HTTPS e acesso indevido negado.">
            <div aria-hidden="true" className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="font-data text-[11px] uppercase tracking-[0.12em] text-white/50">Registro de atividade</span>
              <span className="nhf-live !border-nhf-green/40 !bg-nhf-green/10 !py-1 text-[11px] !text-nhf-green">Operando</span>
            </div>
            <ul aria-hidden="true" className="space-y-2.5 px-4 py-5 font-data text-[12px] leading-relaxed">
              {LOG.map(([t, msg, status], i) => (
                <motion.li
                  key={t}
                  className="grid grid-cols-[64px_1fr_auto] items-baseline gap-3"
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-10% 0px" }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.18, ease: EASE }}
                >
                  <span className="text-white/60">{t}</span>
                  <span className="text-white/85">{msg}</span>
                  <span className={status === "ok" ? "text-nhf-green" : "text-nhf-late"}>{status === "ok" ? "✓ ok" : "✕ negado"}</span>
                </motion.li>
              ))}
              {!reduce && (
                <motion.li className="text-white/60" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                  ▌
                </motion.li>
              )}
            </ul>
            <dl aria-hidden="true" className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-white/10 px-4 py-4 text-[11px] sm:grid-cols-3">
              {[["Isolamento", "ativo"], ["Em trânsito", "HTTPS"], ["Perfis", "4 + motorista"], ["Prova de entrega", "foto · assinatura · hora"], ["Posição", "a cada 30 s"], ["Backup", "diário"]].map(([k, v]) => (
                <div key={k}>
                  <dt className="label-caps text-[9px] text-white/60">{k}</dt>
                  <dd className="font-data uppercase tracking-[0.06em] text-nhf-green">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
