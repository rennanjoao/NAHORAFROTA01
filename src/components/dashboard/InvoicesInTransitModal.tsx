/**
 * Notas em transito (acumuladas de todos os dias).
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Truck } from "lucide-react";
import { EmptyState } from "@/components/patterns";
import { DashboardInvoice } from "@/hooks/useDashboardKPIs";
import { formatCurrency } from "@/lib/formatCurrency";
import { DetailSheet } from "./DetailPanel";
import { InvoiceList } from "./InvoiceList";
import { invoiceNumber, plural } from "./status";

interface InvoicesInTransitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardInvoice[];
}

export function InvoicesInTransitModal({ open, onOpenChange, data }: InvoicesInTransitModalProps) {
  const totalValue = data.reduce((sum, inv) => sum + (inv.total_value || 0), 0);

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={Truck}
      tone="info"
      title="Notas em trânsito"
      description={`${plural(data.length, "nota a caminho do cliente", "notas a caminho do cliente")} · ${formatCurrency(totalValue)}`}
      bodyLabel="Notas em trânsito"
    >
      {data.length === 0 ? (
        <EmptyState compact icon={Truck} title="Nenhuma nota em trânsito" description="As notas aparecem aqui quando o romaneio sai para entrega." />
      ) : (
        <InvoiceList
          items={data.map((invoice) => ({
            id: invoice.id,
            number: invoiceNumber(invoice.nfe_number, invoice.id),
            recipient: invoice.recipient_name,
            address: invoice.address_full,
            value: invoice.total_value,
            weight: invoice.total_weight,
            status: { tone: "info", label: "Em rota" },
            meta: `Importada em ${format(new Date(invoice.imported_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
          }))}
        />
      )}
    </DetailSheet>
  );
}
