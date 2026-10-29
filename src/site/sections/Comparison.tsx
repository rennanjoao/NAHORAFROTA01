import { motion, useReducedMotion } from "framer-motion";
import { X, Check } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";

const ROWS = [
  ["Onde está o veículo", "Liga para o motorista e espera", "Mapa ao vivo, cor por status"],
  ["Prova de entrega", "Foto solta no grupo do WhatsApp", "Canhoto com NF, foto, assinatura e hora"],
  ["Prazo (SLA)", "Ninguém mede", "Medido por entrega, motorista e semana"],
  ["Acerto do agregado", "Planilha que só uma pessoa entende", "Calculado por romaneio, com histórico"],
  ["Cadastro das notas", "Digitação manual, uma a uma", "XML da NF-e em lote"],
  ["Acesso da equipe", "Um celular, uma senha para todos", "Perfil por função e login por pessoa"],
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function Comparison() {
  const reduce = useReducedMotion();
  return (
    <section id="comparativo" className="scroll-mt-nav relative border-t hairline py-24 lg:py-36" aria-labelledby="comparativo-title">
      <div className="container">
        <SectionHeader index="05" size="xl" eyebrow="Comparativo" title="Do grupo de WhatsApp para o painel." accent="para o painel." lead="O que muda no dia a dia de quem despacha, de quem dirige e de quem fecha a conta." />

        <div className="mt-14 overflow-hidden rounded-lg border hairline">
          <div className="hidden grid-cols-[1fr_1.2fr_1.2fr] md:grid" aria-hidden="true">
            <div className="label-caps px-6 py-4 text-muted-foreground">Situação</div>
            <div className="label-caps px-6 py-4 text-muted-foreground">Planilha + WhatsApp</div>
            <div className="label-caps bg-brand/10 px-6 py-4 text-brand">Na Hora Frota</div>
          </div>
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Comparação entre operar com planilha e WhatsApp e operar com o Na Hora Frota</caption>
            <thead className="sr-only">
              <tr><th scope="col">Situação</th><th scope="col">Planilha e WhatsApp</th><th scope="col">Na Hora Frota</th></tr>
            </thead>
            <tbody>
              {ROWS.map(([k, a, b], i) => (
                <motion.tr
                  key={k}
                  className="grid grid-cols-1 border-t hairline md:grid-cols-[1fr_1.2fr_1.2fr]"
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-10% 0px" }}
                  transition={{ duration: 0.6, delay: i * 0.06, ease: EASE }}
                >
                  <th scope="row" className="px-6 pb-1 pt-5 text-left font-heading text-lg font-bold tracking-tight md:py-5">{k}</th>
                  <td className="px-6 py-1 text-muted-foreground md:py-5">
                    <span className="relative inline-flex items-start gap-2.5">
                      <X aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-late" />
                      <span className="relative">
                        <span className="sr-only">Antes: </span>
                        {a}
                        <motion.span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 h-px w-full origin-left bg-late/70"
                          initial={reduce ? false : { scaleX: 0 }}
                          whileInView={{ scaleX: 1 }}
                          viewport={{ once: true, margin: "-20% 0px" }}
                          transition={{ duration: 0.7, delay: 0.3 + i * 0.06, ease: EASE }}
                        />
                      </span>
                    </span>
                  </td>
                  <td className="bg-brand/[0.06] px-6 pb-5 pt-1 text-foreground md:py-5">
                    <span className="inline-flex items-start gap-2.5">
                      <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                      <span><span className="sr-only">Com o Na Hora Frota: </span>{b}</span>
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
