import { useEffect, useState } from "react";
import { CheckCircle2, ChevronUp, Clock, MessageSquareText, Radio, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, toneSoftBg, toneText, type Tone } from "@/components/patterns";
import { useDriverActivity, type DriverActivity } from "@/hooks/useDriverActivity";
import { useOccurrenceReasons } from "@/hooks/useOccurrenceReasons";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import { DriverAvatar } from "./DriverAvatar";

function describe(event: DriverActivity, labelFor: (code: string | null) => string): { text: string; tone: Tone; icon: LucideIcon } {
  if (event.kind === "occurrence") return { text: `Ocorrência: ${labelFor(event.reason)}`, tone: "danger", icon: TriangleAlert };
  if (event.kind === "delivered") return { text: "Entrega concluída", tone: "success", icon: CheckCircle2 };
  return event.waiting
    ? { text: "Aguardando recebimento", tone: "warning", icon: Clock }
    : { text: "Chegou no cliente", tone: "info", icon: Clock };
}

const COLLAPSED_KEY = "nhf.feed-motoristas.recolhido";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Painel de vidro dentro do mapa (LiveMapFrame): cada atualizacao que os motoristas
 * fazem nas entregas, na hora (chegou e aguarda recebimento, entregou, ocorrencia com o
 * motivo). Tocar numa linha leva o mapa ate o motorista; recolhido, libera o mapa.
 */
export function DriverActivityFeed({ onSelectDriver, className }: { onSelectDriver?: (driverId: string) => void; className?: string }) {
  const { events, isLoading, isError } = useDriverActivity();
  const { labelFor } = useOccurrenceReasons();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () =>
    setCollapsed((current) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, current ? "0" : "1");
      } catch {
        // Ignora: so nao fica lembrado.
      }
      return !current;
    });
  // Relogio para o "há N min" andar sozinho
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section aria-labelledby="feed-motoristas" className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className={cn("flex items-start gap-2 px-4 py-3", !collapsed && "border-b border-border/60")}>
        <div className="min-w-0 flex-1">
          <h3 id="feed-motoristas" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Atualizações dos motoristas
            {collapsed && events.length > 0 && <span className="rounded-full bg-foreground/10 px-1.5 font-data text-[0.6875rem] font-semibold">{events.length}</span>}
          </h3>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-medium", toneSoftBg.brand, toneText.brand)}>
              <Radio className="h-3 w-3" aria-hidden="true" />
              Ao vivo
            </span>
            <span className="truncate">O que registraram hoje</span>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-1 h-8 w-8 shrink-0 text-muted-foreground hover:bg-foreground/[0.06]"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls="feed-motoristas-lista"
          aria-label={collapsed ? "Mostrar atualizações dos motoristas" : "Recolher atualizações dos motoristas"}
        >
          <ChevronUp className={cn("transition-transform duration-fast", collapsed && "rotate-180")} aria-hidden="true" />
        </Button>
      </div>

      <div id="feed-motoristas-lista" className={cn("min-h-0 flex-1 flex-col", collapsed ? "hidden" : "flex")}>
        {isLoading ? (
          <div className="space-y-4 p-4" aria-busy="true">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <EmptyState
              compact
              icon={MessageSquareText}
              title={isError ? "Não foi possível carregar as atualizações" : "Nenhuma atualização hoje"}
              description={isError ? "Confira a internet; a lista volta sozinha." : "Quando um motorista chegar num cliente, entregar ou registrar uma ocorrência, aparece aqui na hora."}
            />
          </div>
        ) : (
          <ol aria-labelledby="feed-motoristas" className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain">
            {events.map((event) => {
              const { text, tone, icon: Icon } = describe(event, labelFor);
              const detail = [event.nfe ? `NF ${event.nfe}` : null, event.place].filter(Boolean).join(" · ");
              const body = (
                <>
                  <DriverAvatar name={event.driverName} photo={event.driverPhoto} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{event.driverName}</span>
                      <time dateTime={event.at} className="shrink-0 font-data text-[0.6875rem] text-muted-foreground">
                        {timeAgo(event.at, now)}
                      </time>
                    </span>
                    <span className={cn("mt-1 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium", toneSoftBg[tone], toneText[tone])}>
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{text}</span>
                    </span>
                    {detail && <span className="mt-1 block truncate text-xs text-muted-foreground">{detail}</span>}
                    {event.note && <span className="mt-1 block text-xs italic text-foreground/80">“{event.note}”</span>}
                  </span>
                </>
              );
              return (
                <li key={event.id} className="animate-fade-in">
                  {onSelectDriver && event.driverId ? (
                    <button
                      type="button"
                      onClick={() => onSelectDriver(event.driverId!)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="flex items-start gap-3 px-4 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
