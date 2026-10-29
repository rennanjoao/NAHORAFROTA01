import type { ReactNode } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Building2, ChevronRight, MapPin, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section, toneSoftBg, toneText, type Tone } from "@/components/patterns";
import { getOccurrenceLabel } from "@/hooks/useSLADB";
import { cn } from "@/lib/utils";

interface TopRoute {
  rank: number;
  name: string;
  delays: number;
  occurrences?: number;
  trend: number;
}

interface TopClient {
  rank: number;
  name: string;
  returns: number;
  trend: number;
}

interface TopReason {
  rank: number;
  reason: string;
  count: number;
  percentage: number;
}

interface TopOffendersData {
  routes: TopRoute[];
  clients: TopClient[];
  reasons: TopReason[];
}

interface TopOffendersProps {
  data: TopOffendersData;
  onRouteClick?: (route: string) => void;
  onClientClick?: (client: string) => void;
}

const rankTone = (rank: number): Tone => (rank === 1 ? "danger" : rank <= 3 ? "warning" : "neutral");

function Rank({ rank }: { rank: number }) {
  const tone = rankTone(rank);
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-data text-xs font-semibold",
        toneSoftBg[tone],
        tone === "neutral" ? "text-muted-foreground" : toneText[tone],
      )}
    >
      <span className="sr-only">Posição </span>
      {rank}
    </span>
  );
}

/** Mais atrasos/devolucoes = pior: subir e vermelho, cair e verde. */
function Trend({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-1.5 py-0.5 font-data text-xs font-semibold text-muted-foreground">
        0%<span className="sr-only"> de variação em relação ao período anterior</span>
      </span>
    );
  }
  const worse = value > 0;
  const Icon = worse ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-data text-xs font-semibold",
        worse ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {worse ? "+" : ""}
      {value}%<span className="sr-only"> em relação ao período anterior</span>
    </span>
  );
}

function OffenderCard({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-2.5">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

const empty = (message: string) => <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>;

// Linha clicavel: botao de verdade (teclado e leitor de tela).
const rowButton =
  "group flex w-full min-h-[3rem] items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TopOffenders({ data, onRouteClick, onClientClick }: TopOffendersProps) {
  return (
    <Section
      id="pontos-de-atencao"
      title="Pontos de atenção"
      description="Regiões, clientes e motivos que mais pesaram no período. Toque numa região ou cliente para filtrar a tela."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <OffenderCard icon={MapPin} title="Top 5 Regiões com Atraso" hint="Regiões da roteirização (ZS, ZN, ZL...) com mais atrasos e ocorrências">
          {data.routes.length === 0 ? (
            empty("Nenhum atraso ou ocorrência no período")
          ) : (
            <ul className="-mx-2 space-y-1">
              {data.routes.map((route) => (
                <li key={route.rank}>
                  <button type="button" className={rowButton} onClick={() => onRouteClick?.(route.name)}>
                    <Rank rank={route.rank} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{route.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {route.delays} atraso{route.delays === 1 ? "" : "s"}
                        {typeof route.occurrences === "number" &&
                          ` • ${route.occurrences} ocorrência${route.occurrences === 1 ? "" : "s"}`}
                      </span>
                    </span>
                    <Trend value={route.trend} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast group-hover:translate-x-0.5" aria-hidden="true" />
                    <span className="sr-only">Filtrar por esta região</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </OffenderCard>

        <OffenderCard icon={Building2} title="Top 5 Clientes com Devolução" hint="Clientes com mais devoluções e ocorrências">
          {data.clients.length === 0 ? (
            empty("Nenhuma devolução no período")
          ) : (
            <ul className="-mx-2 space-y-1">
              {data.clients.map((client) => (
                <li key={client.rank}>
                  <button type="button" className={rowButton} onClick={() => onClientClick?.(client.name)}>
                    <Rank rank={client.rank} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{client.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {client.returns} devoluç{client.returns === 1 ? "ão" : "ões"}
                      </span>
                    </span>
                    <Trend value={client.trend} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast group-hover:translate-x-0.5" aria-hidden="true" />
                    <span className="sr-only">Filtrar por este cliente</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </OffenderCard>

        <OffenderCard icon={AlertCircle} title="Top 5 Motivos de Ocorrência" hint="Por que as entregas não deram certo">
          {data.reasons.length === 0 ? (
            empty("Nenhuma ocorrência no período")
          ) : (
            <ul className="space-y-3">
              {data.reasons.map((reason) => (
                <li key={reason.rank} className="flex min-h-[2.5rem] items-center gap-3">
                  <Rank rank={reason.rank} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{getOccurrenceLabel(reason.reason)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {reason.count} ocorrência{reason.count === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="shrink-0 font-data text-sm font-semibold text-foreground">
                    {reason.percentage.toFixed(1).replace(".", ",")}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </OffenderCard>
      </div>
    </Section>
  );
}
