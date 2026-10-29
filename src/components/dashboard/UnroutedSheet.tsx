import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ListSkeleton, StatusBadge } from "@/components/patterns";
import { useInvoicesDB } from "@/hooks/useInvoicesDB";
import { DetailSheet } from "./DetailPanel";
import { InvoiceList } from "./InvoiceList";
import { invoiceStatus, plural } from "./status";

interface UnroutedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Notas pendentes ou devolvidas que ainda nao entraram em romaneio. */
export function UnroutedSheet({ open, onOpenChange }: UnroutedSheetProps) {
  const { invoices, isLoading, refetch } = useInvoicesDB();
  const navigate = useNavigate();

  // Atualiza ao abrir
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  // Pendentes ou devolvidas e fora de romaneio
  const unroutedInvoices = useMemo(() => {
    return invoices.filter((inv) => (inv.status === "pending" || inv.status === "returned") && inv.manifest_id === null);
  }, [invoices]);

  const pendingCount = unroutedInvoices.filter((inv) => inv.status === "pending").length;
  const returnedCount = unroutedInvoices.filter((inv) => inv.status === "returned").length;

  const handleNavigateToDeliveries = () => {
    onOpenChange(false);
    navigate("/deliveries?filter=unrouted");
  };

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={FileWarning}
      tone="warning"
      title="Notas sem romaneio"
      description="Notas que ainda precisam entrar em um romaneio para sair para entrega."
      bodyLabel="Notas sem romaneio"
      summary={
        !isLoading &&
        unroutedInvoices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingCount > 0 && <StatusBadge tone="warning">{plural(pendingCount, "pendente", "pendentes")}</StatusBadge>}
            {returnedCount > 0 && <StatusBadge tone="danger">{plural(returnedCount, "devolvida", "devolvidas")}</StatusBadge>}
          </div>
        )
      }
      footer={
        unroutedInvoices.length > 0 && (
          <Button className="w-full" onClick={handleNavigateToDeliveries}>
            Gerar romaneio em Entregas
            <ArrowRight aria-hidden="true" />
          </Button>
        )
      }
    >
      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : unroutedInvoices.length === 0 ? (
        <EmptyState compact icon={CheckCircle2} title="Todas as notas já estão em romaneio" description="Nada pendente por aqui." />
      ) : (
        <InvoiceList
          items={unroutedInvoices.map((invoice) => {
            const isReturned = invoice.status === "returned";
            const place = [`${invoice.address_city}/${invoice.address_state}`, invoice.regiao_logistica].filter(Boolean).join(" · ");
            return {
              id: invoice.id,
              number: `NF ${invoice.nfe_number || "sem número"}`,
              recipient: invoice.recipient_name,
              address: place,
              value: invoice.total_value,
              weight: invoice.total_weight,
              // "Pendente", o mesmo nome do resto do painel (antes "Nova").
              status: isReturned ? { tone: "danger" as const, label: "Devolvida" } : { tone: "warning" as const, label: "Pendente" },
              meta: [
                // Nova: data da importacao (antes mostrava a ultima alteracao).
                isReturned
                  ? `Devolvida em ${new Date(invoice.updated_at).toLocaleDateString("pt-BR")}`
                  : `Importada em ${new Date(invoice.imported_at || invoice.updated_at).toLocaleDateString("pt-BR")}`,
                invoice.occurrence_type ? `Ocorrência: ${invoiceStatus("occurrence", invoice.occurrence_type).label}` : null,
              ]
                .filter(Boolean)
                .join(" · "),
            };
          })}
        />
      )}
    </DetailSheet>
  );
}
