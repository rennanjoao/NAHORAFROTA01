import { Check, ShieldCheck } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

const ITEMS = [
  ["Isolamento por empresa", "Cada cliente enxerga só os próprios dados. A regra vale no servidor, não só na tela."],
  ["Login por pessoa", "Senha temporária trocada no primeiro acesso. Perfis por função e motorista só no app dele."],
  ["Conexão segura", "HTTPS em tudo. Fotos e assinaturas em armazenamento privado."],
  ["Banco gerenciado", "Postgres no Supabase, com regra de acesso por linha em todas as tabelas."],
  ["LGPD", "Dados usados só para operar o serviço. Você exporta ou apaga quando quiser."],
];

function Shield() {
  return (
    <svg viewBox="0 0 320 260" className="h-auto w-full max-w-[360px]" aria-hidden="true">
      <defs>
        <radialGradient id="sh-glow" r="0.5">
          <stop offset="0" stopColor="hsl(var(--brand))" stopOpacity="0.35" />
          <stop offset="1" stopColor="hsl(var(--brand))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="130" r="120" fill="url(#sh-glow)" />
      {[110, 86, 62].map((r, i) => (
        <circle key={r} cx="160" cy="130" r={r} fill="none" stroke="hsl(var(--brand))" strokeOpacity={0.15 + i * 0.12} strokeDasharray={i === 0 ? "3 7" : undefined} />
      ))}
      {[[50, 130], [270, 130], [160, 20], [86, 52], [236, 210]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5" fill="hsl(var(--brand))" />
          <circle cx={x} cy={y} r="5" fill="hsl(var(--brand))" className="ping-ring" style={{ animationDelay: `${i * 0.5}s` }} />
        </g>
      ))}
      <path d="M160 72 l44 16 v34 c0 30 -20 52 -44 62 c-24 -10 -44 -32 -44 -62 v-34 z" fill="#080808" stroke="hsl(var(--brand))" strokeWidth="3" />
      <path d="M142 128 l12 12 l24 -26" fill="none" stroke="#04E8A4" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Security() {
  return (
    <section id="seguranca" className="scroll-mt-nav border-y border-foreground/10 bg-card py-20 lg:py-28" aria-labelledby="seguranca-title">
      <div className="container grid items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div>
          <SectionHeader eyebrow="Confiança" title="Seus dados, só da sua empresa." accent="só da sua empresa." lead="Operação é informação sensível: cliente, endereço, valor de frete. Tratamos como tal." />
          <a href="mailto:suporte@nahorafrota.com.br?subject=Documenta%C3%A7%C3%A3o%20de%20seguran%C3%A7a" className="mt-6 inline-flex font-heading text-sm font-semibold underline decoration-brand decoration-2 underline-offset-[6px] hover:text-brand">
            Pedir documentação de segurança
          </a>
          <Reveal className="mt-8 flex justify-center lg:justify-start">
            <Shield />
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-sm">
            <div className="flex items-center justify-between border-b border-foreground/10 bg-brand-soft px-6 py-4">
              <p className="flex items-center gap-2 font-heading font-semibold">
                <ShieldCheck aria-hidden="true" className="h-5 w-5 text-brand" /> Proteção da plataforma
              </p>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-xs font-bold text-nhf-ink">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-nhf-ink" /> Ativa
              </span>
            </div>
            <ul className="divide-y divide-foreground/10">
              {ITEMS.map(([t, d]) => (
                <li key={t} className="flex gap-3 px-6 py-4">
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
