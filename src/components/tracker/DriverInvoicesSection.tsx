import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Pencil, Plus, Trash2, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, StatusBadge } from "@/components/patterns";
import { ProviderInvoiceDialog } from "@/components/invoices/ProviderInvoiceDialog";
import { toast } from "@/hooks/use-toast";
import { useProviderInvoices } from "@/hooks/useProviderInvoices";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { INVOICE_STATUS, deleteInvoice, workDaysLabel, type ProviderInvoice } from "@/lib/providerInvoices";

interface PaymentProfile {
  driver_id: string;
  tenant_id: string;
  is_own_fleet: boolean;
  pays_only_with_invoice: boolean;
  carrier_name: string | null;
}

/**
 * Carteira > Notas fiscais (empresa que so paga mediante nota): o agregado escolhe os
 * dias que trabalhou e anexa a nota que emitiu fora do app. Enquanto a empresa nao
 * aprova, ele corrige ou exclui. Motorista de transportadora so ve o aviso.
 */
export function DriverInvoicesSection({ driverId }: { driverId: string }) {
  const profileQuery = useQuery({
    queryKey: ["payment-profile", driverId],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PaymentProfile | null> => {
      const { data, error } = await supabase.rpc("get_my_payment_profile");
      // Banco sem a atualizacao: sem a secao de notas.
      if (error || !data) return null;
      return data as unknown as PaymentProfile;
    },
  });
  const { invoices, refresh } = useProviderInvoices({ driverId });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderInvoice | null>(null);
  const [removing, setRemoving] = useState<ProviderInvoice | null>(null);
  const [busy, setBusy] = useState(false);
  const profile = profileQuery.data;

  if (!profile || profile.is_own_fleet) return null;

  if (profile.carrier_name) {
    return (
      <section aria-labelledby="notas-titulo" className="flex items-start gap-3 rounded-xl border bg-card p-4">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/15 text-info">
          <Warehouse className="h-5 w-5" />
        </span>
        <div>
          <h2 id="notas-titulo" className="font-semibold text-foreground">
            Você recebe pela transportadora
          </h2>
          <p className="text-sm text-muted-foreground">
            O pagamento sai para a <span className="font-medium text-foreground">{profile.carrier_name}</span>, e ela envia a nota fiscal. Você não precisa anexar nota.
          </p>
        </div>
      </section>
    );
  }

  if (!profile.pays_only_with_invoice) return null;

  const open = (invoice: ProviderInvoice | null) => {
    setEditing(invoice);
    setFormOpen(true);
  };

  return (
    <section aria-labelledby="notas-titulo" className="space-y-3">
      <div>
        <h2 id="notas-titulo" className="text-lg font-semibold text-foreground">
          Notas fiscais
        </h2>
        <p className="text-sm text-muted-foreground">A empresa só paga depois que a nota for aprovada. Escolha os dias que trabalhou e anexe a nota que você emitiu.</p>
      </div>

      <Button size="lg" className="h-14 w-full text-base" onClick={() => open(null)}>
        <Plus aria-hidden="true" />
        Enviar nota fiscal
      </Button>

      {invoices.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {invoices.map((invoice) => {
            const status = INVOICE_STATUS[invoice.status];
            const editable = invoice.status === "pending" || invoice.status === "rejected";
            return (
              <li key={invoice.id} className="space-y-2 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-data text-base font-semibold text-foreground">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      NF {invoice.invoice_number}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">Dias {workDaysLabel(invoice.work_dates)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-data text-base font-semibold text-foreground">{formatCurrency(invoice.amount)}</span>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </div>
                </div>
                {invoice.status === "rejected" && invoice.review_note && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Motivo: {invoice.review_note}</p>
                )}
                {editable && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-11" onClick={() => open(invoice)}>
                      <Pencil aria-hidden="true" />
                      Corrigir
                    </Button>
                    <Button variant="outline" className="h-11 text-destructive hover:text-destructive" onClick={() => setRemoving(invoice)}>
                      <Trash2 aria-hidden="true" />
                      Excluir
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ProviderInvoiceDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={profile.tenant_id}
        payee={{ driverId }}
        payeeName="Você"
        invoice={editing}
        variant="app"
        onSaved={() => void refresh()}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={`Excluir a NF ${removing?.invoice_number ?? ""}?`}
        description="Ela sai da lista. Você pode enviar outra quando quiser."
        confirmLabel="Excluir nota"
        tone="danger"
        loading={busy}
        onConfirm={async () => {
          if (!removing) return;
          setBusy(true);
          try {
            await deleteInvoice(removing.id);
            toast({ title: "Nota excluída" });
            setRemoving(null);
            void refresh();
          } catch (error) {
            toast({ title: "Não foi possível excluir", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
