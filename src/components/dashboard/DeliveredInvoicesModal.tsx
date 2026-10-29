import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatCurrency";
import { DashboardInvoice } from "@/hooks/useDashboardKPIs";
import { DetailDialog } from "./DetailPanel";
import { InvoiceList } from "./InvoiceList";
import { formatTime, invoiceNumber, plural } from "./status";

interface DeliveredInvoicesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardInvoice[];
}

export function DeliveredInvoicesModal({ open, onOpenChange, data }: DeliveredInvoicesModalProps) {
  const totalValue = data.reduce((sum, inv) => sum + (inv.total_value || 0), 0);

  return (
    <DetailDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={CheckCircle2}
      tone="success"
      title="Entregas feitas hoje"
      description={`${plural(data.length, "nota entregue", "notas entregues")} · ${formatCurrency(totalValue)} no total`}
      bodyLabel="Notas entregues hoje"
    >
      {data.length === 0 ? (
        <EmptyState
          compact
          icon={CheckCircle2}
          title="Nenhuma entrega feita hoje ainda"
          description="Cada baixa feita pelo motorista no aplicativo aparece aqui."
        />
      ) : (
        <InvoiceList
          items={data.map((invoice) => ({
            id: invoice.id,
            number: invoiceNumber(invoice.nfe_number, invoice.id),
            recipient: invoice.recipient_name,
            address: invoice.address_full,
            value: invoice.total_value,
            status: { tone: "success", label: "Entregue" },
            meta: invoice.delivered_at ? `Entregue às ${formatTime(invoice.delivered_at)}` : undefined,
          }))}
        />
      )}
    </DetailDialog>
  );
}
