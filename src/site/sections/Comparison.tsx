import { X, Check } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

const BEFORE = ["Liga para o motorista para saber onde está", "Foto do canhoto solta no grupo do WhatsApp", "Ninguém mede o prazo", "Acerto do agregado em planilha", "Notas digitadas uma a uma", "Um celular e uma senha para todos"];
const AFTER = ["Mapa ao vivo, com cor por status", "Canhoto com NF, foto, assinatura e hora", "SLA por entrega, motorista e semana", "Acerto calculado por romaneio, com histórico", "XML da NF-e importado em lote", "Login por pessoa e perfil por função"];

export function Comparison() {
  return (
    <section id="comparativo" className="scroll-mt-nav bg-card/50 py-20 lg:py-28" aria-labelledby="comparativo-title">
      <div className="container">
        <SectionHeader align="center" eyebrow="Comparativo" title="Do grupo de WhatsApp para o painel." accent="para o painel." lead="O que muda no dia a dia de quem despacha, de quem dirige e de quem fecha a conta." />
        <Reveal className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          <div className="site-card p-6 lg:p-7">
            <h3 className="font-heading text-lg font-semibold">Planilha + WhatsApp</h3>
            <ul className="mt-5 space-y-3">
              {BEFORE.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-muted-foreground sm:text-base">
                  <X aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-late" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-brand/40 bg-brand-soft p-6 shadow-sm lg:p-7">
            <h3 className="font-heading text-lg font-semibold">Na Hora Frota</h3>
            <ul className="mt-5 space-y-3">
              {AFTER.map((a) => (
                <li key={a} className="flex items-start gap-3 text-sm sm:text-base">
                  <Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand" strokeWidth={2.5} />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
