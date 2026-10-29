import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, FileWarning, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ListSkeleton, StatusBadge } from "@/components/patterns";
import { useInvoicesDB } from "@/hooks/useInvoicesDB";
import { useOnline } from "@/components/layout/useOnline";
import { DetailSheet } from "./DetailPanel";
import { InvoiceList } from "./InvoiceList";
import { invoiceStatus, plural } from "./status";

interface UnroutedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Notas pendentes ou devolvidas que ainda nao entraram em romaneio. */
export function UnroutedSheet({ open, onOpenChange }: UnroutedSheetProps) {
  const { invoices, isLoading, error, refetch } = useInvoicesDB();
  const navigate = useNavigate();
  const online = useOnline();

  // Atualiza ao abrir e quando a internet volta
  useEffect(() => {
    if (open && online) {
      refetch();
    }
  }, [open, online, refetch]);

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
      {/* Sem internet a busca volta vazia: sem isso dizia "Todas as notas já estão em romaneio". */}
      {!online && unroutedInvoices.length > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-foreground">
          <WifiOff className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          Sem internet: esta é a última lista carregada.
        </p>
      )}
      {!online && unroutedInvoices.length === 0 ? (
        <EmptyState compact icon={WifiOff} title="Sem internet" description="A lista de notas volta assim que a conexão voltar." />
      ) : error ? (
        <EmptyState
          compact
          icon={AlertTriangle}
          title="Não foi possível carregar as notas"
          description="Confira a internet e tente de novo."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw aria-hidden="true" />
              Tentar de novo
            </Button>
          }
        />
      ) : isLoading ? (
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
