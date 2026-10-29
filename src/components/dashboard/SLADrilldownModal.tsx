/**
 * DETALHE DO SLA
 * Dois niveis: motoristas (pior primeiro) e, ao tocar em um, as notas que
 * mexeram no SLA dele. Cada nota abre o detalhe da entrega.
 */

import { useState, type ReactNode } from "react";
import { ArrowLeft, ChevronRight, MessageCircle, Package, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusBadge, toneDot, toneText, type Tone } from "@/components/patterns";
import { formatSLA } from "@/lib/formatSLA";
import {
  DriverSLAStats,
  OrphanInvoice,
  isSLACritical,
  isSLAAttention,
  SLA_THRESHOLDS,
  SLAInvoiceItem,
  getOccurrenceLabel,
} from "@/hooks/useSLADB";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatCurrency";
import { openWhatsApp } from "@/lib/whatsapp";
import { DeliveryDetailSheet, DeliveryWithHistory } from "@/components/deliveries/DeliveryDetailSheet";
import { DetailDialog } from "./DetailPanel";
import { DriverAvatar } from "./DriverAvatar";
import { InvoiceList, type InvoiceRowData } from "./InvoiceList";
import { SLABar } from "./SLAParts";
import { plural, slaStatus, pct } from "./status";

interface SLADrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  drivers: DriverSLAStats[];
  orphanInvoices?: OrphanInvoice[];
  fleetSLA: number;
  mode: "weekly" | "today";
}

type Mode = SLADrilldownModalProps["mode"];

const driverSLA = (d: DriverSLAStats, mode: Mode) => (mode === "weekly" ? d.weeklySLA : d.todaySLA);
const driverTotal = (d: DriverSLAStats, mode: Mode) => (mode === "weekly" ? d.weeklyTotalInvoices : d.todayTotalInvoices);
const driverDelivered = (d: DriverSLAStats, mode: Mode) => (mode === "weekly" ? d.weeklyDeliveredCount : d.todayDeliveredCount);
const driverOccurrences = (d: DriverSLAStats, mode: Mode) => (mode === "weekly" ? d.weeklyOccurrenceCount : d.todayOccurrenceCount);

/** Quanto a nota conta no SLA (1 = entrega cheia, 0 = perda total). */
function weightTone(weight: number, delivered = false): string {
  if (delivered || weight >= 0.8) return "text-foreground";
  return weight === 0 ? "text-destructive" : "text-warning";
}

function WeightAside({ weight, delivered }: { weight: number; delivered?: boolean }) {
  return (
    <>
      <p className={cn("font-data text-sm font-semibold", weightTone(weight, delivered))}>{(weight * 100).toFixed(0)}%</p>
      <p className="text-xs text-muted-foreground">conta no SLA</p>
    </>
  );
}

export function SLADrilldownModal({ open, onOpenChange, title, subtitle, drivers, orphanInvoices = [], fleetSLA, mode }: SLADrilldownModalProps) {
  const [selectedDriver, setSelectedDriver] = useState<DriverSLAStats | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<DeliveryWithHistory | null>(null);
  const [isInvoiceDetailOpen, setIsInvoiceDetailOpen] = useState(false);

  // Pior SLA primeiro
  const sortedDrivers = [...drivers].filter((d) => driverTotal(d, mode) > 0).sort((a, b) => driverSLA(a, mode) - driverSLA(b, mode));

  // Faixas
  const criticalDrivers = sortedDrivers.filter((d) => isSLACritical(driverSLA(d, mode)));
  const attentionDrivers = sortedDrivers.filter((d) => isSLAAttention(driverSLA(d, mode)));
  const nearGoalDrivers = sortedDrivers.filter((d) => driverSLA(d, mode) >= SLA_THRESHOLDS.GOOD && driverSLA(d, mode) < SLA_THRESHOLDS.EXCELLENT);
  const healthyDrivers = sortedDrivers.filter((d) => driverSLA(d, mode) >= SLA_THRESHOLDS.EXCELLENT);

  const fleetStatus = slaStatus(fleetSLA);
  const hasProblems = criticalDrivers.length > 0 || attentionDrivers.length > 0 || nearGoalDrivers.length > 0 || orphanInvoices.length > 0;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      // Volta para a lista depois que a janela fecha
      setTimeout(() => {
        setSelectedDriver(null);
        setSelectedInvoice(null);
        setIsInvoiceDetailOpen(false);
      }, 200);
    }
  };

  const openInvoiceDetail = (invoice: SLAInvoiceItem, driverName: string | null) => {
    const delivery: DeliveryWithHistory = {
      id: Number.parseInt(invoice.invoiceId.slice(0, 8), 16) || 0,
      dbId: invoice.invoiceId,
      nfe: invoice.nfeNumber,
      recipient: invoice.recipientName,
      address: invoice.addressStreet || invoice.addressFull?.split(",")[0] || "",
      city: invoice.addressCity || "",
      state: invoice.addressState || "",
      zipCode: invoice.addressZip || "",
      phone: invoice.recipientPhone || undefined,
      driver: driverName,
      status: invoice.status as DeliveryWithHistory["status"],
      scheduledTime: "08:00",
      scheduledDate: new Date(invoice.importedAt || invoice.updatedAt),
      weight: invoice.totalWeight ? `${String(invoice.totalWeight).replace(".", ",")} kg` : "-",
      value: formatCurrency(invoice.totalValue || 0),
      observation: invoice.observation || undefined,
      manifestUuid: invoice.manifestId || undefined,
      occurrenceType: invoice.occurrenceType || undefined,
      lastUpdatedAt: invoice.updatedAt ? new Date(invoice.updatedAt) : undefined,
      receivedBy: invoice.receiverName || undefined,
      receivedAt: invoice.deliveredAt ? new Date(invoice.deliveredAt) : undefined,
      receiverDocument: invoice.receiverDocument || undefined,
    };

    setSelectedInvoice(delivery);
    setIsInvoiceDetailOpen(true);
  };

  const invoiceSheet = <DeliveryDetailSheet delivery={selectedInvoice} open={isInvoiceDetailOpen} onOpenChange={setIsInvoiceDetailOpen} />;

  // Nivel 2: notas de um motorista
  if (selectedDriver) {
    const sla = driverSLA(selectedDriver, mode);
    const status = slaStatus(sla);
    return (
      <DetailDialog
        open={open}
        onOpenChange={handleOpenChange}
        leading={
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => setSelectedDriver(null)}>
            <ArrowLeft aria-hidden="true" />
            Voltar para os motoristas
          </Button>
        }
        title={selectedDriver.driver_name}
        description="Notas e ocorrências que mexeram no SLA deste motorista."
        bodyLabel={`Notas de ${selectedDriver.driver_name}`}
        summary={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={cn("font-data text-3xl font-semibold leading-none", toneText[status.tone])}>{formatSLA(sla)}%</span>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {selectedDriver.vehicle_plate && <Badge variant="outline">{selectedDriver.vehicle_plate}</Badge>}
          </div>
        }
      >
        <DriverInvoicesView driver={selectedDriver} mode={mode} onInvoiceOpen={(invoice) => openInvoiceDetail(invoice, selectedDriver.driver_name)} />
        {invoiceSheet}
      </DetailDialog>
    );
  }

  // Nivel 1: motoristas
  const groups: { key: string; title: string; hint?: string; tone: Tone; drivers: DriverSLAStats[] }[] = [
    { key: "critical", title: `Estado crítico (abaixo de ${pct(SLA_THRESHOLDS.ATTENTION)})`, hint: "Converse com o motorista hoje", tone: "danger", drivers: criticalDrivers },
    { key: "attention", title: `Atenção (${pct(SLA_THRESHOLDS.ATTENTION)} a ${pct(SLA_THRESHOLDS.GOOD - 0.1)})`, hint: "Precisa de orientação", tone: "warning", drivers: attentionDrivers },
    { key: "near", title: `Perto da meta (${pct(SLA_THRESHOLDS.GOOD)} a ${pct(SLA_THRESHOLDS.EXCELLENT - 0.1)})`, tone: "warning", drivers: nearGoalDrivers },
    { key: "healthy", title: hasProblems ? "Acima da meta" : "Motoristas no período", tone: "success", drivers: healthyDrivers },
  ];

  return (
    <DetailDialog
      open={open}
      onOpenChange={handleOpenChange}
      icon={TrendingUp}
      tone={fleetStatus.tone}
      title={title}
      description={subtitle}
      bodyLabel="Motoristas"
      summary={
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">SLA da frota</p>
              <p className="font-data text-3xl font-semibold leading-tight text-foreground">{formatSLA(fleetSLA)}%</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge tone={fleetStatus.tone}>{fleetStatus.label}</StatusBadge>
              <span className="text-xs text-muted-foreground">Meta {pct(SLA_THRESHOLDS.EXCELLENT)}</span>
            </div>
          </div>
          <SLABar value={fleetSLA} tone={fleetStatus.tone} goal={SLA_THRESHOLDS.EXCELLENT} className="mt-3" />
        </div>
      }
    >
      {sortedDrivers.length === 0 && orphanInvoices.length === 0 ? (
        <EmptyState compact icon={Package} title="Nenhuma entrega finalizada no período" description="O SLA aparece assim que os motoristas baixarem as entregas." />
      ) : (
        <>
          {!hasProblems && (
            <p className="flex items-start gap-2.5 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-foreground">
              <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-success" />
              Operação saudável. Todos os motoristas estão acima da meta de {pct(SLA_THRESHOLDS.EXCELLENT)}.
            </p>
          )}

          {orphanInvoices.length > 0 && (
            <DriverGroup title="Notas com ocorrência sem motorista" tone="warning" count={orphanInvoices.length}>
              <InvoiceList
                items={orphanInvoices.map((invoice) => ({
                  id: invoice.id,
                  number: `NF ${invoice.nfeNumber}`,
                  recipient: invoice.recipientName,
                  status: { tone: "danger", label: getOccurrenceLabel(invoice.occurrenceType) },
                  aside: <WeightAside weight={invoice.weight} />,
                }))}
              />
            </DriverGroup>
          )}

          {groups
            .filter((group) => group.drivers.length > 0)
            .map((group) => (
              <DriverGroup key={group.key} title={group.title} hint={group.hint} tone={group.tone} count={group.drivers.length}>
                <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                  {group.drivers.map((driver) => (
                    <DriverRow key={driver.driver_id} driver={driver} mode={mode} onClick={() => setSelectedDriver(driver)} />
                  ))}
                </ul>
              </DriverGroup>
            ))}
        </>
      )}
      {invoiceSheet}
    </DetailDialog>
  );
}

function DriverGroup({ title, hint, tone, count, children }: { title: string; hint?: string; tone: Tone; count: number; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-foreground">
        <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", toneDot[tone])} />
        {title}
        <span className="font-data font-medium text-muted-foreground">({count})</span>
        {hint && <span className="text-xs font-normal text-muted-foreground">· {hint}</span>}
      </h3>
      {children}
    </section>
  );
}

function DriverRow({ driver, mode, onClick }: { driver: DriverSLAStats; mode: Mode; onClick: () => void }) {
  const sla = driverSLA(driver, mode);
  const status = slaStatus(sla);
  const phone = driver.phone?.replace(/\D/g, "");

  return (
    <li className="flex items-center gap-1 pr-2">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <DriverAvatar name={driver.driver_name} photo={driver.photo_url} tone={status.tone} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">{driver.driver_name}</span>
          <span className="block text-xs text-muted-foreground">
            {plural(driverDelivered(driver, mode), "entrega", "entregas")} · {plural(driverTotal(driver, mode), "nota", "notas")} ·{" "}
            {plural(driverOccurrences(driver, mode), "ocorrência", "ocorrências")}
          </span>
        </span>
        <span className={cn("shrink-0 font-data text-base font-semibold", toneText[status.tone])}>{formatSLA(sla)}%</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {phone && (
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 text-muted-foreground hover:text-success"
          onClick={() => openWhatsApp(phone)}
          aria-label={`Chamar ${driver.driver_name} no WhatsApp`}
          title={`Chamar ${driver.driver_name} no WhatsApp`}
        >
          <MessageCircle aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

function DriverInvoicesView({ driver, mode, onInvoiceOpen }: { driver: DriverSLAStats; mode: Mode; onInvoiceOpen: (invoice: SLAInvoiceItem) => void }) {
  const total = driverTotal(driver, mode);
  const delivered = driverDelivered(driver, mode);
  const occurrenceCount = driverOccurrences(driver, mode);
  const occurrences = mode === "weekly" ? driver.weeklyOccurrences : driver.todayOccurrences;
  const invoices = mode === "weekly" ? driver.weeklyInvoices : driver.todayInvoices;

  const invoiceRows: InvoiceRowData[] = invoices.map((invoice) => {
    const isDelivered = invoice.status === "delivered";
    return {
      id: invoice.invoiceId,
      number: `NF ${invoice.nfeNumber}`,
      recipient: invoice.recipientName,
      status: isDelivered ? { tone: "success", label: "Entregue" } : { tone: "danger", label: getOccurrenceLabel(invoice.occurrenceType) },
      aside: <WeightAside weight={invoice.weight} delivered={isDelivered} />,
      onClick: () => onInvoiceOpen(invoice),
    };
  });

  return (
    <>
      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: "Entregas", value: delivered },
          { label: "Ocorrências", value: occurrenceCount },
          { label: "Total de notas", value: total },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-3">
            <dt className="text-xs font-medium text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 font-data text-2xl font-semibold leading-none text-foreground">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {invoiceRows.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Notas do período</h3>
          <p className="text-xs text-muted-foreground">Toque em uma nota para ver o comprovante e o histórico.</p>
          <InvoiceList items={invoiceRows} />
        </section>
      )}

      {occurrences.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Ocorrências que baixaram o SLA</h3>
          <InvoiceList
            items={occurrences.map((occ, idx) => ({
              id: `${occ.invoiceId}-${idx}`,
              number: `NF ${occ.nfeNumber}`,
              recipient: occ.recipientName,
              status: { tone: "danger", label: getOccurrenceLabel(occ.occurrenceType) },
              aside: <WeightAside weight={occ.weight} />,
            }))}
          />
        </section>
      )}
    </>
  );
}
