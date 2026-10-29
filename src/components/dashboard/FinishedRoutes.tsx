import { useState } from "react";
import { CheckCircle2, ChevronDown, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, StatusBadge } from "@/components/patterns";
import { FinishedDriverData } from "@/hooks/useDashboardKPIs";
import { cn } from "@/lib/utils";
import { DriverAvatar } from "./DriverAvatar";
import { InvoiceList } from "./InvoiceList";
import { formatTime, invoiceNumber, invoiceStatus, plateLabel, plural } from "./status";

/** Ponto + texto do resultado da rota: sem ocorrencia (verde) ou com (vermelho). */
export function RouteResultBadge({ occurrences }: { occurrences: number }) {
  return occurrences > 0 ? (
    <StatusBadge tone="danger">{plural(occurrences, "ocorrência", "ocorrências")}</StatusBadge>
  ) : (
    <StatusBadge tone="success">Sem ocorrência</StatusBadge>
  );
}

/** Notas de uma rota finalizada, separadas em entregues e com ocorrencia/devolucao. */
export function FinishedRouteInvoices({ route, headingLevel = "h3" }: { route: FinishedDriverData; headingLevel?: "h3" | "h4" }) {
  const Heading = headingLevel;
  const delivered = route.invoices.filter((inv) => inv.status === "delivered");
  const problems = route.invoices.filter((inv) => inv.status === "occurrence" || inv.status === "returned");

  if (delivered.length === 0 && problems.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">Nenhuma nota neste romaneio.</p>;
  }

  const groups = [
    { key: "problems", title: "Ocorrências e devoluções", items: problems },
    { key: "delivered", title: "Entregues", items: delivered },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <Heading className="text-sm font-semibold text-foreground">
            {group.title} <span className="font-data font-medium text-muted-foreground">({group.items.length})</span>
          </Heading>
          <InvoiceList
            items={group.items.map((invoice) => ({
              id: invoice.id,
              number: invoiceNumber(invoice.nfe_number, invoice.id),
              recipient: invoice.recipient_name,
              address: invoice.address_full,
              value: invoice.total_value,
              status: invoiceStatus(invoice.status, invoice.occurrence_type),
            }))}
          />
        </div>
      ))}
    </div>
  );
}

/** Rotas finalizadas hoje no painel: as 5 mais recentes, cada uma abre as notas. */
export function FinishedRoutesList({ data, onShowAll }: { data: FinishedDriverData[]; onShowAll: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <Card>
        <EmptyState
          compact
          icon={Flag}
          title="Nenhuma rota finalizada hoje ainda"
          description="Quando um motorista concluir o romaneio, ele aparece aqui com o resultado das entregas."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y">
        {data.slice(0, 5).map((route) => {
          const { driver, manifest, finishedAt, totalDeliveries, completedDeliveries, occurrences } = route;
          const isExpanded = expandedId === manifest.id;
          const panelId = `rota-${manifest.id}`;

          return (
            <li key={manifest.id}>
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={panelId}
                onClick={() => setExpandedId(isExpanded ? null : manifest.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
              >
                <DriverAvatar name={driver?.name} photo={driver?.photo_url || driver?.avatar} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 break-words font-medium text-foreground">{driver?.name || "Motorista"}</span>
                    <RouteResultBadge occurrences={occurrences} />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {plateLabel(driver?.vehicle_plate)} · {completedDeliveries} de {plural(totalDeliveries, "entrega", "entregas")} · terminou às{" "}
                    {formatTime(finishedAt)}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration ease-out", isExpanded && "rotate-180")}
                />
              </button>
              {isExpanded && (
                <div id={panelId} className="animate-fade-in border-t bg-muted/40 px-4 py-4 sm:px-5">
                  <FinishedRouteInvoices route={route} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {data.length > 5 && (
        <div className="border-t px-4 py-3 sm:px-5">
          <Button variant="ghost" size="sm" onClick={onShowAll}>
            <CheckCircle2 aria-hidden="true" />
            Ver as {data.length} rotas finalizadas
          </Button>
        </div>
      )}
    </Card>
  );
}
