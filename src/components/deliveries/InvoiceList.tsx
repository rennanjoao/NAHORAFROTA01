import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Route, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { InvoiceActionsMenu } from "./InvoiceActionsMenu";
import { DeliveryStatusBadge, getDeliveryStatus, occurrenceLabel } from "./status";
import type { Delivery, InvoiceActionHandlers } from "./types";

interface InvoiceListProps {
  deliveries: Delivery[];
  /** Celular: cartoes em vez de tabela. */
  isMobile: boolean;
  headerCheckboxState: boolean | "indeterminate";
  /** Ha notas visiveis que ainda podem ser selecionadas. */
  canSelectAny: boolean;
  onSelectAll: (checked: boolean) => void;
  onSelect: (id: number, checked: boolean) => void;
  actions: InvoiceActionHandlers;
}

/**
 * Caixa de selecao de 24px (minimo da WCAG 2.2) dentro de uma area de toque de
 * 40px: tocar em volta da caixa tambem marca.
 */
function SelectBox({
  checked,
  onCheckedChange,
  label,
  disabled,
  hitArea = true,
}: {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  /** false quando a caixa ja esta dentro de um rotulo maior. */
  hitArea?: boolean;
}) {
  const box = (
    <Checkbox
      checked={checked}
      disabled={disabled}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      aria-label={label}
      // "Algumas marcadas" mostra um tracinho (o componente base desenha o visto nos dois casos).
      className="flex h-6 w-6 items-center justify-center rounded-[0.375rem] [&_svg]:h-4 [&_svg]:w-4 [&[data-state=indeterminate]_svg]:hidden data-[state=indeterminate]:after:h-0.5 data-[state=indeterminate]:after:w-3 data-[state=indeterminate]:after:rounded-full data-[state=indeterminate]:after:bg-current data-[state=indeterminate]:after:content-['']"
    />
  );
  if (!hitArea) return box;
  return (
    <label className={cn("-m-2 inline-flex h-10 w-10 items-center justify-center rounded-md", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
      {box}
    </label>
  );
}

/** Cadeado: nota ja esta em um romaneio (nao entra em outra selecao). */
function InManifestMark({ delivery }: { delivery: Delivery }) {
  return (
    <span
      role="img"
      aria-label={`NF ${delivery.nfe} já está no romaneio ${delivery.manifestId}`}
      title={`Já está no romaneio ${delivery.manifestId}`}
      className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground"
    >
      <Lock className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function NfButton({ delivery, onOpen, className }: { delivery: Delivery; onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Ver detalhes da NF ${delivery.nfe}`}
      className={cn(
        "inline-flex min-h-6 items-center rounded-sm font-data font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        className,
      )}
    >
      NF {delivery.nfe}
    </button>
  );
}

function ManifestTag({ delivery }: { delivery: Delivery }) {
  if (!delivery.manifestId) return null;
  return (
    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
      <Route className="h-3 w-3 shrink-0" aria-hidden="true" />
      Romaneio {delivery.manifestId}
    </span>
  );
}

function StatusCell({ delivery }: { delivery: Delivery }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <DeliveryStatusBadge status={delivery.status} />
      {delivery.status === "occurrence" && delivery.occurrenceType && (
        <span className="max-w-[12rem] truncate text-xs text-muted-foreground" title={occurrenceLabel(delivery.occurrenceType)}>
          {occurrenceLabel(delivery.occurrenceType)}
        </span>
      )}
    </div>
  );
}

// Atraso e ocorrencia ganham so uma barra lateral (sem pintar a linha).
const needsAttention = (delivery: Delivery) => getDeliveryStatus(delivery.status).tone === "danger";

function cityLine(delivery: Delivery) {
  const city = [delivery.city, delivery.state].filter(Boolean).join("/");
  return [delivery.address, city].filter(Boolean).join(" · ");
}

/*
 * A lista mostra 50 notas por pagina. Antes desenhava todas de uma vez (mil notas viravam
 * uma pagina de 7.500 px e cada clique redesenhava tudo). "Selecionar todas" continua
 * valendo para todas as notas filtradas, nao so para a pagina.
 */
const PAGE_SIZE = 50;

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  return (
    <nav aria-label="Páginas da lista de notas" className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4 text-sm">
      <p className="text-muted-foreground">
        Mostrando <span className="font-data font-semibold text-foreground">{from.toLocaleString("pt-BR")}–{to.toLocaleString("pt-BR")}</span> de{" "}
        <span className="font-data font-semibold text-foreground">{total.toLocaleString("pt-BR")}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page === 0}>
          <ChevronLeft aria-hidden="true" /> Anterior
        </Button>
        <span className="min-w-[6.5rem] text-center font-data text-xs text-muted-foreground" aria-live="polite">
          Página {page + 1} de {pages}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages - 1}>
          Próxima <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

export function InvoiceList({
  deliveries,
  isMobile,
  headerCheckboxState,
  canSelectAny,
  onSelectAll,
  onSelect,
  actions,
}: InvoiceListProps) {
  const [page, setPage] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const pages = Math.max(1, Math.ceil(deliveries.length / PAGE_SIZE));
  // Filtro ou busca muda a lista: volta para a primeira pagina.
  useEffect(() => setPage(0), [deliveries.length]);
  const current = Math.min(page, pages - 1);
  const visible = deliveries.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const goTo = (p: number) => {
    setPage(Math.max(0, Math.min(pages - 1, p)));
    const el = topRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const pager = <Pager page={current} pages={pages} total={deliveries.length} onPage={goTo} />;

  if (isMobile) {
    return (
      <div ref={topRef} className="scroll-mt-24 space-y-3">
        <label
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-lg border bg-card px-4 text-sm font-medium shadow-xs",
            canSelectAny ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground",
          )}
        >
          <SelectBox
            checked={headerCheckboxState}
            onCheckedChange={onSelectAll}
            label="Selecionar todas as notas sem romaneio"
            disabled={!canSelectAny}
            hitArea={false}
          />
          Selecionar todas sem romaneio
        </label>
        <ul className="space-y-3" aria-label="Notas fiscais">
          {visible.map((delivery) => (
            <li
              key={delivery.id}
              className={cn(
                "rounded-lg border bg-card p-4 shadow-xs transition-colors duration-fast",
                delivery.selected && "border-primary/50 bg-primary/5",
                needsAttention(delivery) && "shadow-[inset_3px_0_0_hsl(var(--destructive))]",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-6 shrink-0 items-center justify-center">
                  {delivery.manifestId ? (
                    <InManifestMark delivery={delivery} />
                  ) : (
                    <SelectBox
                      checked={delivery.selected || false}
                      onCheckedChange={(checked) => onSelect(delivery.id, checked)}
                      label={`Selecionar NF ${delivery.nfe}`}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-h-10 flex-col justify-center">
                    <NfButton delivery={delivery} onOpen={() => actions.onDetail(delivery)} className="self-start text-base" />
                    <ManifestTag delivery={delivery} />
                  </div>
                  <p className="mt-1 truncate font-medium text-foreground" title={delivery.recipient}>
                    {delivery.recipient}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{cityLine(delivery)}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <StatusCell delivery={delivery} />
                    <span className="font-data text-xs text-muted-foreground">{delivery.scheduledTime}</span>
                  </div>
                  {delivery.driver && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate" title={delivery.driver}>
                        {delivery.driver}
                      </span>
                    </p>
                  )}
                </div>
                <div className="-mr-2 -mt-1 shrink-0">
                  <InvoiceActionsMenu delivery={delivery} actions={actions} />
                </div>
              </div>
            </li>
          ))}
        </ul>
        {pager}
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 pl-5">
              <SelectBox
                checked={headerCheckboxState}
                onCheckedChange={onSelectAll}
                label="Selecionar todas as notas filtradas sem romaneio"
                disabled={!canSelectAny}
              />
            </TableHead>
            <TableHead>Nota</TableHead>
            <TableHead>Cliente e endereço</TableHead>
            <TableHead className="hidden lg:table-cell">Motorista</TableHead>
            <TableHead className="hidden lg:table-cell">Data</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-16 pr-5 text-right">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((delivery) => (
            <TableRow
              key={delivery.id}
              data-state={delivery.selected ? "selected" : undefined}
              className={cn("h-[4.25rem]", needsAttention(delivery) && "shadow-[inset_3px_0_0_hsl(var(--destructive))]")}
            >
              <TableCell className="pl-5">
                {delivery.manifestId ? (
                  <InManifestMark delivery={delivery} />
                ) : (
                  <SelectBox
                    checked={delivery.selected || false}
                    onCheckedChange={(checked) => onSelect(delivery.id, checked)}
                    label={`Selecionar NF ${delivery.nfe}`}
                  />
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex flex-col items-start">
                  <NfButton delivery={delivery} onOpen={() => actions.onDetail(delivery)} />
                  <ManifestTag delivery={delivery} />
                </div>
              </TableCell>
              <TableCell className="max-w-0 w-full">
                <p className="truncate font-medium text-foreground" title={delivery.recipient}>
                  {delivery.recipient}
                </p>
                <p className="truncate text-sm text-muted-foreground" title={cityLine(delivery)}>
                  {cityLine(delivery)}
                </p>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {delivery.driver ? (
                  <span className="block max-w-[12rem] truncate" title={delivery.driver}>
                    {delivery.driver}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sem motorista</span>
                )}
              </TableCell>
              <TableCell className="hidden whitespace-nowrap font-data text-muted-foreground lg:table-cell">
                {delivery.scheduledTime}
              </TableCell>
              <TableCell>
                <StatusCell delivery={delivery} />
              </TableCell>
              <TableCell className="pr-3 text-right">
                <InvoiceActionsMenu delivery={delivery} actions={actions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
    {pager}
    </div>
  );
}
