/**
 * Notas carregadas hoje (que entraram em romaneio).
 */

import { Package } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/patterns";
import { DashboardInvoice } from "@/hooks/useDashboardKPIs";
import { formatCurrency } from "@/lib/formatCurrency";
import { DetailSheet } from "./DetailPanel";
import { InvoiceList } from "./InvoiceList";
import { invoiceNumber, invoiceStatus, plural } from "./status";

// Resumo no topo: "3 entregues", "1 com ocorrência".
const SUMMARY_LABEL: Record<string, [string, string]> = {
  pending: ["pendente", "pendentes"],
  in_transit: ["em rota", "em rota"],
  delivered: ["entregue", "entregues"],
  occurrence: ["com ocorrência", "com ocorrência"],
  returned: ["devolvida", "devolvidas"],
};

interface TodayLoadedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardInvoice[];
}

export function TodayLoadedModal({ open, onOpenChange, data }: TodayLoadedModalProps) {
  const totalValue = data.reduce((sum, inv) => sum + (inv.total_value || 0), 0);

  // Resumo por situacao
  const statusCounts = data.reduce(
    (acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={Package}
      title="Notas carregadas hoje"
      description={`${plural(data.length, "nota entrou", "notas entraram")} em romaneio hoje · ${formatCurrency(totalValue)}`}
      bodyLabel="Notas carregadas hoje"
      summary={
        Object.keys(statusCounts).length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Resumo por situação">
            {Object.entries(statusCounts).map(([status, count]) => {
              const info = invoiceStatus(status);
              const [one, many] = SUMMARY_LABEL[status] ?? [info.label, info.label];
              return (
                <li key={status}>
                  <StatusBadge tone={info.tone}>{plural(count, one, many)}</StatusBadge>
                </li>
              );
            })}
          </ul>
        )
      }
    >
      {data.length === 0 ? (
        <EmptyState
          compact
          icon={Package}
          title="Nenhuma nota carregada hoje"
          description="As notas aparecem aqui quando entram em um romaneio."
        />
      ) : (
        <InvoiceList
          items={data.map((invoice) => ({
            id: invoice.id,
            number: invoiceNumber(invoice.nfe_number, invoice.id),
            recipient: invoice.recipient_name,
            address: invoice.address_full,
            value: invoice.total_value,
            weight: invoice.total_weight,
            status: invoiceStatus(invoice.status, invoice.occurrence_type),
          }))}
        />
      )}
    </DetailSheet>
  );
}
