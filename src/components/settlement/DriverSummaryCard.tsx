import { Building2, Plus, Truck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/patterns";
import type { DBDriver } from "@/hooks/useDBDrivers";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatSLA } from "@/lib/formatSLA";
import { cn } from "@/lib/utils";
import { DriverAvatar } from "./DriverAvatar";
import { PixCopyButton } from "./PixCopyButton";

interface DriverSummaryCardProps {
  driver: DBDriver;
  stats: { paid: number; pending: number; balance: number };
  periodLabel: string;
  onOpenBankDetails: () => void;
  onAddAdjustment: () => void;
}

function Amount({ label, value, hint, highlight }: { label: string; value: number; hint: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-4", highlight ? "border-primary/30 bg-primary/5" : "bg-muted/40")}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-data text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(value)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Cabecalho do motorista escolhido: dados, PIX, atalhos e quanto falta pagar. */
export function DriverSummaryCard({ driver, stats, periodLabel, onOpenBankDetails, onAddAdjustment }: DriverSummaryCardProps) {
  const sla = driver.individual_sla || 100;

  return (
    <Card className="space-y-5 p-5 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <DriverAvatar name={driver.name} src={driver.photo || driver.avatar} className="h-12 w-12 ring-2 ring-primary/40" />
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">{driver.name}</h2>
              {driver.is_own_fleet && (
                <Badge variant="default">
                  <Truck aria-hidden="true" />
                  Frota própria
                </Badge>
              )}
            </div>
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <dt>CPF</dt>
                <dd className="font-data text-foreground">{driver.cpf || "—"}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt>Placa</dt>
                <dd className="font-data text-foreground">{driver.vehicle_plate || "—"}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt>SLA</dt>
                <dd>
                  <StatusBadge tone={sla >= 95 ? "success" : "warning"}>{formatSLA(sla)}%</StatusBadge>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {!driver.is_own_fleet && (
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
            <PixCopyButton pixKey={driver.chave_pix ?? undefined} cpf={driver.cpf} compact />
            <Button variant="outline" onClick={onOpenBankDetails}>
              <Building2 aria-hidden="true" />
              Ver dados bancários
            </Button>
            <Button variant="outline" onClick={onAddAdjustment}>
              <Plus aria-hidden="true" />
              Adicionar lançamento
            </Button>
          </div>
        )}
      </div>

      {driver.is_own_fleet ? (
        <Alert variant="info">
          <Truck aria-hidden="true" />
          <AlertTitle>Motorista da frota própria</AlertTitle>
          <AlertDescription>
            Este motorista é da empresa e não tem frete a receber no acerto. Aqui aparecem só os custos da operação,
            como combustível e pedágio.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Amount label="Pago no período" value={stats.paid} hint={periodLabel} />
          <Amount label="Romaneios pendentes" value={stats.pending} hint="Ainda não pagos" />
          <Amount label="Saldo a pagar" value={stats.balance} hint="Pendentes + créditos e débitos em aberto" highlight />
        </div>
      )}
    </Card>
  );
}
