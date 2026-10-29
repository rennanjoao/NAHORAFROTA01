import { Check } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

const ITEMS = [
  ["Isolamento por empresa", "Cada cliente enxerga só os próprios dados. A regra vale no servidor, não só na tela."],
  ["Login por pessoa", "Senha temporária trocada no primeiro acesso. Perfis por função e motorista só no app dele."],
  ["Banco gerenciado", "Postgres no Supabase, conexão HTTPS, fotos e assinaturas em armazenamento privado."],
  ["LGPD", "Dados usados só para operar o serviço. Você exporta ou apaga quando quiser."],
];

export function Security() {
  return (
    <section id="seguranca" className="scroll-mt-nav bg-card/50 py-20 lg:py-28" aria-labelledby="seguranca-title">
      <div className="container grid items-start gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div>
          <SectionHeader eyebrow="Confiança" title="Seus dados, só da sua empresa." accent="só da sua empresa." lead="Operação é informação sensível: cliente, endereço, valor de frete. Tratamos como tal." />
          <p className="mt-6 text-sm text-muted-foreground">Precisa de documentação de segurança ou de um termo específico? Peça pelo e-mail de suporte.</p>
        </div>
        <Reveal delay={0.1}>
          <div className="site-card p-6 lg:p-7">
            <div className="flex items-center justify-between">
              <p className="label-caps text-muted-foreground">Status da plataforma</p>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" /> Operando
              </span>
            </div>
            <ul className="mt-5 divide-y divide-foreground/10">
              {ITEMS.map(([t, d]) => (
                <li key={t} className="flex gap-3 py-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-nhf-ink">
                    <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="font-heading font-semibold">{t}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
