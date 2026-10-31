import { Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/patterns";
import { carrierName, type Carrier } from "@/hooks/useCarriers";
import { formatCNPJ } from "@/lib/cnpjValidation";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { PixCopyButton } from "./PixCopyButton";

function Amount({ label, value, hint, highlight }: { label: string; value: number; hint: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-4", highlight ? "border-primary/30 bg-primary/5" : "bg-muted/40")}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-data text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(value)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Cabecalho da transportadora escolhida no acerto: dados, Pix e quanto falta pagar. */
export function CarrierSummaryCard({
  carrier,
  drivers,
  stats,
  periodLabel,
  onOpenBankDetails,
}: {
  carrier: Carrier;
  drivers: string[];
  stats: { paid: number; pending: number };
  periodLabel: string;
  onOpenBankDetails: () => void;
}) {
  return (
    <Card className="animate-fade-in space-y-5 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-info/15 text-info ring-2 ring-info/40">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <h2 id="acerto-transportadora" tabIndex={-1} className="truncate rounded-sm text-lg font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {carrierName(carrier)}
            </h2>
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <dt>CNPJ</dt>
                <dd className="font-data text-foreground">{formatCNPJ(carrier.cnpj)}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt>IE</dt>
                <dd className="font-data text-foreground">{carrier.ie_isento ? "Isenta" : carrier.inscricao_estadual || "—"}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Motoristas</dt>
                <dd>
                  <StatusBadge tone="info">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {drivers.length === 1 ? "1 motorista" : `${drivers.length} motoristas`}
                  </StatusBadge>
                </dd>
              </div>
            </dl>
            {drivers.length > 0 && <p className="text-xs text-muted-foreground">{drivers.join(", ")}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
          <PixCopyButton pixKey={carrier.chave_pix ?? undefined} compact />
          <Button variant="outline" onClick={onOpenBankDetails}>
            <Building2 aria-hidden="true" />
            Ver dados bancários
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Amount label="Pago no período" value={stats.paid} hint={periodLabel} />
        <Amount label="Saldo a pagar" value={stats.pending} hint="Romaneios dos motoristas dela ainda não pagos" highlight />
      </div>
    </Card>
  );
}
