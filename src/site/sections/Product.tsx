import { MapPin, FileText, Gauge, Camera, Wallet, BarChart3, Users, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "../components/SectionHeader";
import { Stagger, StaggerItem } from "../components/Reveal";
import { RouteMap } from "../components/mockups/RouteMap";

function Card({ className, children, title, text, icon: Icon, eyebrow }: { className?: string; children?: React.ReactNode; title: string; text: string; icon: React.ElementType; eyebrow: string }) {
  return (
    <article className={cn("group relative flex h-full flex-col overflow-hidden rounded border border-border bg-card transition-colors hover:border-brand/60", className)}>
      <div className="p-6 pb-4">
        <p className="label-caps flex items-center gap-2 text-muted-foreground">
          <Icon aria-hidden="true" className="h-4 w-4 text-brand" /> {eyebrow}
        </p>
        <h3 className="mt-3 text-balance font-heading text-xl font-bold leading-tight">{title}</h3>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
      {children && <div className="relative mt-auto min-h-0 flex-1">{children}</div>}
    </article>
  );
}

const MANIFEST_ROWS = [
  ["48213", "Mercado Bom Preço", "Osasco", "6"],
  ["48219", "Drogaria Central", "Osasco", "2"],
  ["48225", "Padaria Nova Era", "Carapicuíba", "9"],
  ["48230", "Loja Casa & Cia", "Barueri", "4"],
];

const SLA_ROWS = [
  ["João Silva", 99],
  ["Marcos Lima", 97],
  ["Carlos Souza", 92],
  ["Pedro Alves", 88],
] as const;

export function Product() {
  return (
    <section id="produto" className="scroll-mt-nav border-t border-border bg-muted/30 py-20 lg:py-28" aria-labelledby="produto-title">
      <div className="container">
        <SectionHeader
          eyebrow="O produto"
          title="O pátio inteiro numa tela."
          accent="numa tela."
          lead="Sete módulos que falam a língua do pátio: romaneio, rota, canhoto, SLA, acerto. Sem traduzir para inglês de software."
        />

        <Stagger className="mt-12 grid gap-4 md:grid-cols-6 lg:grid-cols-12" gap={0.06}>
          <StaggerItem className="md:col-span-6 lg:col-span-7">
            <Card icon={MapPin} eyebrow="Mapa ao vivo" title="Cada placa, um ponto no mapa." text="A posição vem do celular do motorista, a cada 30 segundos, sem rastreador. Em rota, parado ou atrasado: a cor diz na hora.">
              <div className="aspect-[16/9] border-t border-border bg-background/40">
                <RouteMap />
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem className="md:col-span-6 lg:col-span-5">
            <Card icon={FileText} eyebrow="Romaneio e entregas" title="Importe o XML, monte o romaneio, despache." text="Notas em lote direto da NF-e, rota otimizada e romaneio impresso ou no celular, em minutos.">
              <div aria-hidden="true" className="border-t border-border px-4 py-3 font-data text-[11px]">
                <div className="grid grid-cols-[52px_1fr_80px_28px] gap-2 label-caps text-[9px] text-muted-foreground">
                  <span>NF</span><span>Cliente</span><span>Cidade</span><span>Vol</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {MANIFEST_ROWS.map((r) => (
                    <li key={r[0]} className="grid grid-cols-[52px_1fr_80px_28px] items-center gap-2 rounded bg-background/60 px-2 py-1.5">
                      <span className="text-brand">{r[0]}</span>
                      <span className="truncate font-sans text-foreground/85">{r[1]}</span>
                      <span className="truncate text-muted-foreground">{r[2]}</span>
                      <span className="text-right">{r[3]}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between rounded border border-brand/40 bg-brand/10 px-2.5 py-1.5">
                  <span className="text-foreground/85">Romaneio #1044 · 14 notas · 48 km</span>
                  <span className="nhf-chamfer nhf-chamfer-sm bg-primary px-2 py-1 font-heading text-[10px] font-bold text-primary-foreground">Despachar</span>
                </div>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem className="md:col-span-3 lg:col-span-4">
            <Card icon={Gauge} eyebrow="SLA" title="SLA não se promete. Se mede." text="Diário e semanal, por motorista, por região e por entrega. Quem atrasa aparece. Quem cumpre também.">
              <ul aria-hidden="true" className="space-y-2 border-t border-border px-5 py-4">
                {SLA_ROWS.map(([name, v]) => (
                  <li key={name} className="text-[11px]">
                    <div className="flex justify-between font-data">
                      <span className="font-sans text-foreground/85">{name}</span>
                      <span className={cn("font-bold tabular-nums", v >= 95 ? "text-brand" : v >= 90 ? "text-alert" : "text-late")}>{v}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                      <div className={cn("h-full rounded-full", v >= 95 ? "bg-brand" : v >= 90 ? "bg-nhf-alert" : "bg-nhf-late")} style={{ width: `${v}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </StaggerItem>

          <StaggerItem className="md:col-span-3 lg:col-span-4">
            <Card icon={Camera} eyebrow="Canhoto digital" title="Prova de entrega com hora, foto e assinatura." text="O motorista confirma na porta do cliente. O comprovante entra no painel na mesma hora, ligado à nota.">
              <div aria-hidden="true" className="border-t border-border p-5">
                <div className="rounded border border-border bg-background/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-data text-[10px] uppercase tracking-wider text-brand">14:32 · NF 48213</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-nhf-ink"><Check className="h-3 w-3" strokeWidth={3} /></span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="aspect-[4/3] rounded bg-gradient-to-br from-foreground/15 to-foreground/5" />
                    <div className="flex aspect-[4/3] items-end rounded border border-dashed border-foreground/25 p-2">
                      <svg viewBox="0 0 100 40" className="h-7 w-full stroke-foreground/70" fill="none" strokeWidth="2" strokeLinecap="round">
                        <path d="M4 30 C 15 5, 25 35, 35 15 S 55 5, 60 25 S 80 35, 96 12" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Recebido por Maria · Osasco</p>
                </div>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem className="md:col-span-6 lg:col-span-4">
            <Card icon={Wallet} eyebrow="Acerto financeiro" title="Frete, adiantamento, desconto. Acerto fechado." text="Cada romaneio de agregado gera o acerto sozinho. Histórico por motorista e chave Pix na tela para pagar.">
              <div aria-hidden="true" className="border-t border-border p-5 font-data text-[11px]">
                <div className="rounded border border-border bg-background/60 p-3">
                  <p className="label-caps text-[9px] text-muted-foreground">Acerto · João Silva · ABC1D23</p>
                  <dl className="mt-2 space-y-1">
                    <div className="flex justify-between"><dt className="font-sans text-muted-foreground">Frete (3 romaneios)</dt><dd className="tabular-nums">R$ 1.540,00</dd></div>
                    <div className="flex justify-between"><dt className="font-sans text-muted-foreground">Adiantamento</dt><dd className="tabular-nums text-late">− R$ 300,00</dd></div>
                    <div className="flex justify-between border-t border-border pt-1.5 font-bold"><dt className="font-sans">A pagar</dt><dd className="tabular-nums text-brand">R$ 1.240,00</dd></div>
                  </dl>
                  <span className="mt-3 flex items-center justify-center rounded border border-brand/50 py-1.5 font-sans text-[11px] font-semibold text-brand">Copiar chave Pix</span>
                </div>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem className="md:col-span-3 lg:col-span-7">
            <Card icon={BarChart3} eyebrow="Relatórios" title="Lucratividade por rota, eficiência por região, top ofensores." text="O que custou, o que atrasou e onde. Exporte em PDF para a reunião de segunda.">
              <div aria-hidden="true" className="border-t border-border p-5">
                <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="h-32 w-full" fill="none">
                  <g stroke="hsl(var(--foreground) / 0.1)">
                    <path d="M0 30 H400" /><path d="M0 60 H400" /><path d="M0 90 H400" />
                  </g>
                  <path d="M0 95 C 40 90, 60 70, 100 72 S 160 50, 200 48 S 260 40, 300 30 S 360 24, 400 18" stroke="hsl(var(--brand))" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M0 95 C 40 90, 60 70, 100 72 S 160 50, 200 48 S 260 40, 300 30 S 360 24, 400 18 V120 H0 Z" fill="hsl(var(--brand))" fillOpacity="0.08" />
                  <path d="M0 100 C 40 104, 80 96, 120 98 S 200 92, 240 95 S 320 90, 400 92" stroke="hsl(var(--foreground) / 0.35)" strokeWidth="2" strokeDasharray="4 4" />
                  <circle cx="300" cy="30" r="4" fill="hsl(var(--brand))" />
                </svg>
                <div className="mt-2 flex gap-4 font-data text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded bg-brand" /> SLA no prazo</span>
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded bg-foreground/35" /> Custo por entrega</span>
                </div>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem className="md:col-span-3 lg:col-span-5">
            <Card icon={Users} eyebrow="Equipe e perfis" title="Cada um vê o que precisa." text="Administrador, gestor de frota, despachante e visualizador. Motorista só vê o romaneio dele. Limites por plano.">
              <ul aria-hidden="true" className="grid grid-cols-2 gap-2 border-t border-border p-5 text-[11px]">
                {[["RJ", "Admin", "tudo"], ["AL", "Gestor de frota", "motoristas, veículos"], ["MS", "Despachante", "romaneios"], ["JS", "Motorista", "só o romaneio"]].map(([ini, role, scope]) => (
                  <li key={role} className="flex items-center gap-2 rounded border border-border bg-background/60 px-2.5 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 font-data text-[10px] font-bold text-brand">{ini}</span>
                    <span className="min-w-0"><span className="block truncate font-semibold">{role}</span><span className="block truncate text-muted-foreground">{scope}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}
