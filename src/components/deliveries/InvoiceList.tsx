import { Lock, Route, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOccurrenceLabel } from "@/hooks/useSLADB";
import { cn } from "@/lib/utils";
import { InvoiceActionsMenu } from "./InvoiceActionsMenu";
import { DeliveryStatusBadge, getDeliveryStatus } from "./status";
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

/** Caixa de selecao com area de toque maior (24px) sem mudar o desenho. */
function SelectBox({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      aria-label={label}
      className="h-5 w-5 rounded-[0.375rem]"
    />
  );
}

/** Cadeado: nota ja esta em um romaneio (nao entra em outra selecao). */
function InManifestMark({ delivery }: { delivery: Delivery }) {
  return (
    <span
      role="img"
      aria-label={`NF ${delivery.nfe} já está no romaneio ${delivery.manifestId}`}
      title={`Já está no romaneio ${delivery.manifestId}`}
      className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground"
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
        "rounded-sm font-data font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline",
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
        <span className="max-w-[12rem] truncate text-xs text-muted-foreground">{getOccurrenceLabel(delivery.occurrenceType)}</span>
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

export function InvoiceList({
  deliveries,
  isMobile,
  headerCheckboxState,
  canSelectAny,
  onSelectAll,
  onSelect,
  actions,
}: InvoiceListProps) {
  if (isMobile) {
    return (
      <div className="space-y-3">
        <label className="flex min-h-10 items-center gap-3 rounded-lg border bg-card px-4 text-sm font-medium shadow-xs">
          <SelectBox
            checked={headerCheckboxState}
            onCheckedChange={onSelectAll}
            label="Selecionar todas as notas sem romaneio"
            disabled={!canSelectAny}
          />
          Selecionar todas sem romaneio
        </label>
        <ul className="space-y-3" aria-label="Notas fiscais">
          {deliveries.map((delivery) => (
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
                  <p className="mt-1 truncate font-medium text-foreground">{delivery.recipient}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{cityLine(delivery)}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <StatusCell delivery={delivery} />
                    <span className="font-data text-xs text-muted-foreground">{delivery.scheduledTime}</span>
                  </div>
                  {delivery.driver && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{delivery.driver}</span>
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
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 pl-5">
              <SelectBox
                checked={headerCheckboxState}
                onCheckedChange={onSelectAll}
                label="Selecionar todas as notas visíveis sem romaneio"
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
          {deliveries.map((delivery) => (
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
                <p className="truncate font-medium text-foreground">{delivery.recipient}</p>
                <p className="truncate text-sm text-muted-foreground">{cityLine(delivery)}</p>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {delivery.driver ? (
                  <span className="block max-w-[12rem] truncate">{delivery.driver}</span>
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
  );
}
