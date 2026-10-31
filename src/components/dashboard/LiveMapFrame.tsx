import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, FileText, Maximize2, RefreshCw, RotateCcw, Truck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, StatusBadge, toneDot, toneSoftBg, toneText, type Tone } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { useOnline } from "@/components/layout/useOnline";
import { useTodayInvoices, type TodayInvoices } from "@/hooks/useTodayInvoices";
import { DetailDialog } from "./DetailPanel";
import { InvoiceList } from "./InvoiceList";
import type { MapStatusCounts } from "./mapStatus";
import { plural } from "./status";

interface LiveMapFrameProps {
  vehicleCount: number;
  counts?: MapStatusCounts;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onFitAll?: () => void;
  /** Conteudo do mapa. */
  children?: ReactNode;
  state?: "ready" | "loading" | "error";
  error?: string;
  onRetry?: () => void;
  /** Painel sobre o mapa (atualizacoes dos motoristas). Em tela menor vai para baixo do mapa. */
  overlay?: ReactNode;
}

type NoteGroup = Exclude<keyof TodayInvoices, "pending">;

/** Notas de hoje no topo do mapa (abrem a lista). Tambem e a legenda: azul em rota, vermelho ocorrencia. */
const NOTE_GROUPS: { key: NoteGroup; one: string; many: string; title: string; hint: string; tone: Tone; icon: LucideIcon }[] = [
  { key: "inRoute", one: "em rota", many: "em rota", title: "Em rota", hint: "Notas a caminho do cliente agora.", tone: "info", icon: Truck },
  { key: "delivered", one: "entregue", many: "entregues", title: "Entregues", hint: "Notas entregues hoje.", tone: "success", icon: CheckCircle2 },
  { key: "occurrence", one: "ocorrência", many: "ocorrências", title: "Ocorrência", hint: "Notas com ocorrência ou devolvidas hoje.", tone: "danger", icon: RotateCcw },
];

/**
 * Moldura do mapa ao vivo (Mapbox ou OpenStreetMap): resumo das notas de hoje e dos
 * veiculos sem sinal (que tambem e a legenda das cores), os botoes do mapa e o painel
 * de vidro com as atualizacoes dos motoristas.
 */
export function LiveMapFrame({ vehicleCount, counts, onRefresh, isRefreshing, onFitAll, children, state = "ready", error, onRetry, overlay }: LiveMapFrameProps) {
  const online = useOnline();
  const { data: notes } = useTodayInvoices();
  const [openGroup, setOpenGroup] = useState<NoteGroup | null>(null);
  const [lastGroup, setLastGroup] = useState<NoteGroup>("inRoute");
  const group = NOTE_GROUPS.find((g) => g.key === (openGroup ?? lastGroup))!;
  const groupNotes = notes[group.key];
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-foreground">
            {state === "loading" ? "Carregando o mapa…" : plural(vehicleCount, "veículo com GPS ligado", "veículos com GPS ligado")}
          </p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Notas de hoje e veículos sem sinal">
            {NOTE_GROUPS.map((item) => {
              const count = notes[item.key].length;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setLastGroup(item.key);
                      setOpenGroup(item.key);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-[filter,box-shadow] duration-fast hover:brightness-110 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      toneSoftBg[item.tone],
                      toneText[item.tone],
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", toneDot[item.tone])} aria-hidden="true" />
                    <span className="font-data font-semibold">{count}</span>
                    {count === 1 ? item.one : item.many}
                  </button>
                </li>
              );
            })}
            <li>
              <StatusBadge tone="neutral" className="py-1">
                <span className="font-data font-semibold">{counts?.stale ?? 0}</span>
                sem sinal
              </StatusBadge>
            </li>
          </ul>
        </div>
        {state === "ready" && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {onFitAll && (
              <Button variant="outline" size="sm" onClick={onFitAll} disabled={vehicleCount === 0}>
                <Maximize2 aria-hidden="true" />
                Mostrar todos
              </Button>
            )}
            {onRefresh && (
              // Sem internet nao ha o que atualizar: o mapa fica na ultima posicao.
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing || !online}>
                <RefreshCw className={cn(isRefreshing && "animate-spin")} aria-hidden="true" />
                {isRefreshing ? "Atualizando…" : "Atualizar"}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <div className="relative h-[24rem] sm:h-[32rem] xl:h-[36rem]">
          {state === "loading" && <div className="skeleton-shimmer absolute inset-0" aria-hidden="true" />}
          {state === "error" && (
            <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/40 p-6 text-center">
              <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <p className="font-heading font-semibold text-foreground">Não foi possível carregar o mapa</p>
              {error && <p className="max-w-sm text-sm text-muted-foreground">{error}</p>}
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RefreshCw aria-hidden="true" />
                  Tentar de novo
                </Button>
              )}
            </div>
          )}
          {state === "ready" && children}
          {state === "ready" && vehicleCount === 0 && (
            <div className={cn("pointer-events-none absolute inset-0 z-[450] flex items-center justify-center p-6", overlay && "xl:pr-[22.5rem]")}>
              <div className="max-w-xs rounded-lg border bg-popover/95 p-5 text-center shadow-lg backdrop-blur">
                <span aria-hidden="true" className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Truck className="h-5 w-5" />
                </span>
                <p className="font-heading text-sm font-semibold text-foreground">Nenhum veículo com GPS ligado</p>
                <p className="mt-1 text-sm text-muted-foreground">O motorista aparece aqui quando abre o aplicativo e inicia a rota.</p>
              </div>
            </div>
          )}
        </div>
        {overlay && (
          // Tela grande: vidro no canto do mapa, com folga embaixo para a atribuicao do mapa.
          <div className="flex max-h-[26rem] min-h-0 flex-col border-t xl:surface-glass-float xl:absolute xl:right-3 xl:top-3 xl:z-[460] xl:max-h-[calc(100%-3.75rem)] xl:w-[21rem] xl:overflow-hidden xl:rounded-2xl">
            {overlay}
          </div>
        )}
      </div>

      <DetailDialog
        open={openGroup !== null}
        onOpenChange={(open) => !open && setOpenGroup(null)}
        icon={group.icon ?? FileText}
        tone={group.tone}
        title={`${group.title} · ${plural(groupNotes.length, "nota", "notas")}`}
        description={group.hint}
        bodyLabel={`Notas: ${group.title}`}
        className="sm:max-w-lg"
      >
        {groupNotes.length === 0 ? (
          <EmptyState compact icon={FileText} title="Nenhuma nota nesta situação" />
        ) : (
          <InvoiceList
            items={groupNotes.map((invoice) => ({
              id: invoice.id,
              number: `NF ${invoice.nfe_number || "sem número"}`,
              recipient: invoice.recipient_name,
              address: invoice.address_full,
            }))}
          />
        )}
      </DetailDialog>
    </Card>
  );
}
