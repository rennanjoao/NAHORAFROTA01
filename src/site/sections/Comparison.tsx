import { X, Check } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

const ROWS = [
  ["Onde está o veículo", "Liga para o motorista e espera", "Mapa ao vivo, cor por status"],
  ["Prova de entrega", "Foto solta no grupo do WhatsApp", "Canhoto com NF, foto, assinatura e hora"],
  ["Prazo (SLA)", "Ninguém mede", "Medido por entrega, motorista e semana"],
  ["Acerto do agregado", "Planilha que só uma pessoa entende", "Calculado por romaneio, com histórico"],
  ["Cadastro das notas", "Digitação manual, uma a uma", "XML da NF-e em lote"],
  ["Acesso da equipe", "Um celular, uma senha para todos", "Perfil por função e login por pessoa"],
];

export function Comparison() {
  return (
    <section id="comparativo" className="scroll-mt-nav border-t border-border py-20 lg:py-28" aria-labelledby="comparativo-title">
      <div className="container">
        <SectionHeader eyebrow="Comparativo" title="Do grupo de WhatsApp para o painel." accent="para o painel." lead="O que muda no dia a dia de quem despacha, de quem dirige e de quem fecha a conta." />
        <Reveal className="mt-12 space-y-3 md:hidden">
          {ROWS.map(([k, a, b]) => (
            <article key={k} className="rounded border border-border bg-card p-4">
              <h3 className="font-heading font-semibold">{k}</h3>
              <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><X aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-late" /><span><span className="sr-only">Planilha e WhatsApp: </span>{a}</span></p>
              <p className="mt-2 flex items-start gap-2 text-sm"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span><span className="sr-only">Na Hora Frota: </span>{b}</span></p>
            </article>
          ))}
        </Reveal>
        <Reveal className="mt-12 hidden overflow-hidden rounded border border-border md:block">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Comparação entre operar com planilha e WhatsApp e operar com o Na Hora Frota</caption>
            <thead>
              <tr className="bg-muted/60">
                <th scope="col" className="label-caps px-4 py-4 text-muted-foreground sm:px-6">Situação</th>
                <th scope="col" className="label-caps px-4 py-4 text-muted-foreground sm:px-6">Planilha + WhatsApp</th>
                <th scope="col" className="label-caps bg-brand/10 px-4 py-4 text-brand sm:px-6">Na Hora Frota</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, a, b]) => (
                <tr key={k} className="border-t border-border">
                  <th scope="row" className="px-4 py-4 align-top font-heading font-semibold sm:px-6">{k}</th>
                  <td className="px-4 py-4 align-top text-muted-foreground sm:px-6">
                    <span className="flex items-start gap-2"><X aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-late" />{a}</span>
                  </td>
                  <td className="bg-brand/5 px-4 py-4 align-top sm:px-6">
                    <span className="flex items-start gap-2"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{b}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  );
}
