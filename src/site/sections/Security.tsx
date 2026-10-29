import { ShieldCheck, KeyRound, Database, FileCheck2 } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";

const ITEMS = [
  { icon: ShieldCheck, title: "Isolamento por empresa", text: "Cada cliente enxerga só os próprios dados. A regra vale no servidor, não só na tela." },
  { icon: KeyRound, title: "Login por pessoa", text: "Senha temporária trocada no primeiro acesso. Perfis por função e motorista só no app dele." },
  { icon: Database, title: "Banco gerenciado", text: "Postgres no Supabase, conexão HTTPS, fotos e assinaturas em armazenamento privado." },
  { icon: FileCheck2, title: "LGPD", text: "Dados usados só para operar o serviço. Você exporta ou apaga quando quiser." },
];

const STATUS = [
  ["Isolamento de dados", "Ativo"],
  ["Criptografia em trânsito", "HTTPS"],
  ["Perfis de acesso", "4 níveis + motorista"],
  ["Prova de entrega", "Foto, assinatura, hora"],
  ["Posição da frota", "A cada 30 s"],
];

export function Security() {
  return (
    <section id="seguranca" className="scroll-mt-nav border-t border-border bg-muted/30 py-20 lg:py-28" aria-labelledby="seguranca-title">
      <div className="container grid items-start gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <SectionHeader eyebrow="Confiança" title="Seus dados, só da sua empresa." accent="só da sua empresa." lead="Operação é informação sensível: cliente, endereço, valor de frete. Tratamos como tal." />
          <Stagger className="mt-10 grid gap-5 sm:grid-cols-2">
            {ITEMS.map((i) => (
              <StaggerItem key={i.title}>
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-brand/40 bg-brand/10 text-brand">
                    <i.icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-bold">{i.title}</h3>
                    <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{i.text}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
        <Reveal delay={0.1}>
          <div className="rounded border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <p className="label-caps text-muted-foreground">Status da plataforma</p>
              <span className="nhf-live !py-1.5 text-[11px]">Operando</span>
            </div>
            <dl className="mt-5 divide-y divide-border">
              {STATUS.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-3 text-sm">
                  <dt className="text-foreground/80">{k}</dt>
                  <dd className="font-data font-semibold uppercase tracking-[0.06em] text-brand">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              Precisa de documentação de segurança ou de um termo específico para a sua empresa? Peça pelo e-mail de suporte.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
