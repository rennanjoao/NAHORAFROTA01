import { useState } from "react";
import { Check, FileText, Paperclip, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog, EmptyState, Section, StatusBadge } from "@/components/patterns";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  INVOICE_STATUS,
  deleteInvoice,
  openInvoiceFile,
  reviewInvoice,
  workDaysLabel,
  type ProviderInvoice,
} from "@/lib/providerInvoices";
import { ProviderInvoiceDialog } from "./ProviderInvoiceDialog";

interface ProviderInvoicesPanelProps {
  invoices: ProviderInvoice[];
  driverId: string;
  driverName: string;
  tenantId: string;
  /** Administrador: edita e exclui nota ja aprovada. */
  isAdmin: boolean;
  /** A empresa so paga mediante nota (muda o texto de ajuda). */
  required: boolean;
  onChanged: () => void;
}

const dateBR = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");

/**
 * Acerto > notas fiscais do agregado TAC: conferir o arquivo, aprovar ou recusar (com
 * motivo), corrigir e anexar a nota pela equipe.
 */
export function ProviderInvoicesPanel({ invoices, driverId, driverName, tenantId, isAdmin, required, onChanged }: ProviderInvoicesPanelProps) {
  const [editing, setEditing] = useState<ProviderInvoice | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rejecting, setRejecting] = useState<ProviderInvoice | null>(null);
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState<ProviderInvoice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<void>, done: string) => {
    setBusy(id);
    try {
      await action();
      toast({ title: done });
      onChanged();
      return true;
    } catch (error) {
      toast({ title: "Não foi possível concluir", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const canEdit = (invoice: ProviderInvoice) => invoice.status !== "paid" && (invoice.status !== "approved" || isAdmin);
  const pendingCount = invoices.filter((invoice) => invoice.status === "pending").length;

  return (
    <Section
      id="notas-fiscais"
      title="Notas fiscais"
      description={
        required
          ? "A empresa só paga mediante nota fiscal: aprove a nota para liberar o pagamento dos romaneios dos dias dela."
          : "Notas enviadas para estes romaneios. A empresa não exige nota para pagar."
      }
      actions={
        <Button
          variant="outline"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Paperclip aria-hidden="true" />
          Anexar nota
        </Button>
      }
    >
      {invoices.length === 0 ? (
        <EmptyState
          compact
          icon={FileText}
          title="Nenhuma nota enviada"
          description="Quando o motorista enviar a nota pelo app, ela aparece aqui para aprovar."
        />
      ) : (
        <ul className="space-y-3" aria-label={pendingCount ? `${pendingCount} nota(s) aguardando aprovação` : "Notas fiscais"}>
          {invoices.map((invoice) => {
            const status = INVOICE_STATUS[invoice.status];
            const diff = invoice.amount - invoice.expected_amount;
            return (
              <li key={invoice.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-data text-base font-semibold text-foreground">NF {invoice.invoice_number}</h3>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </div>
                      <p className="text-sm text-foreground">
                        Dias trabalhados: <span className="font-medium">{workDaysLabel(invoice.work_dates)}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Valor da nota <span className="font-data font-semibold text-foreground">{formatCurrency(invoice.amount)}</span>
                        {" · "}frete dos romaneios <span className="font-data">{formatCurrency(invoice.expected_amount)}</span>
                        {Math.abs(diff) >= 0.01 && (
                          <span className="ml-1 font-medium text-warning"> (diferença de {formatCurrency(Math.abs(diff))})</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Emitida em {dateBR(invoice.issue_date)} · enviada em {dateBR(invoice.created_at)}
                        {invoice.paid_at && ` · paga em ${dateBR(invoice.paid_at)}`}
                      </p>
                      {invoice.status === "rejected" && invoice.review_note && (
                        <p className="text-sm text-destructive">Motivo da recusa: {invoice.review_note}</p>
                      )}
                      {invoice.status === "approved" && invoice.expected_amount === 0 && (
                        <p className="text-sm text-warning">Nenhum romaneio finalizado nestes dias ainda.</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openInvoiceFile(invoice.file_path).catch((e) => toast({ title: e.message, variant: "destructive" }))}>
                        <FileText aria-hidden="true" />
                        Ver nota
                      </Button>
                      {invoice.status === "pending" && (
                        <>
                          <Button size="sm" disabled={busy === invoice.id} onClick={() => void run(invoice.id, () => reviewInvoice(invoice.id, true), `NF ${invoice.invoice_number} aprovada`)}>
                            <Check aria-hidden="true" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === invoice.id}
                            onClick={() => {
                              setReason("");
                              setRejecting(invoice);
                            }}
                          >
                            <X aria-hidden="true" />
                            Recusar
                          </Button>
                        </>
                      )}
                      {canEdit(invoice) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Corrigir NF ${invoice.invoice_number}`}
                          onClick={() => {
                            setEditing(invoice);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil aria-hidden="true" />
                          Corrigir
                        </Button>
                      )}
                      {canEdit(invoice) && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Excluir NF ${invoice.invoice_number}`} onClick={() => setRemoving(invoice)}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ProviderInvoiceDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={tenantId}
        driverId={driverId}
        driverName={driverName}
        invoice={editing}
        onSaved={onChanged}
      />

      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={`Recusar a NF ${rejecting?.invoice_number ?? ""}?`}
        description="O motorista vê o motivo no app e pode corrigir e enviar de novo."
        confirmLabel="Recusar nota"
        tone="danger"
        loading={!!rejecting && busy === rejecting.id}
        onConfirm={() => {
          if (!rejecting) return;
          void run(rejecting.id, () => reviewInvoice(rejecting.id, false, reason), `NF ${rejecting.invoice_number} recusada`).then((ok) => ok && setRejecting(null));
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="motivo-recusa">Motivo da recusa</Label>
          <Textarea id="motivo-recusa" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: valor diferente do frete dos dias" rows={3} />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Excluir a NF ${removing?.invoice_number ?? ""}?`}
        description="Os romaneios dos dias dela voltam a ficar sem nota."
        confirmLabel="Excluir nota"
        tone="danger"
        loading={!!removing && busy === removing.id}
        onConfirm={() => {
          if (!removing) return;
          void run(removing.id, () => deleteInvoice(removing.id), `NF ${removing.invoice_number} excluída`).then((ok) => ok && setRemoving(null));
        }}
      />
    </Section>
  );
}
