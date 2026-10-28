/**
 * SLA DRILL-DOWN MODAL
 * Two-level hierarchy: Drivers → Invoices
 * Level 1: List of drivers sorted by SLA (worst first)
 * Level 2: Click driver to see invoices causing SLA drop
 */

import { useState } from "react";
import { 
  AlertTriangle, 
  AlertCircle, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2, 
  MessageCircle,
  FileText,
  Package,
  ArrowLeft
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatSLA } from "@/lib/formatSLA";
import { 
  DriverSLAStats, 
  OrphanInvoice,
  InvoiceOccurrence,
  OCCURRENCE_LABELS, 
  getSLAColorScheme, 
  isSLACritical, 
  isSLAAttention, 
  SLA_THRESHOLDS,
  SLA_OCCURRENCE_WEIGHTS,
  SLAInvoiceItem
} from "@/hooks/useSLADB";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatCurrency";
import { DeliveryDetailSheet, DeliveryWithHistory } from "@/components/deliveries/DeliveryDetailSheet";
import { openWhatsApp } from "@/lib/whatsapp";

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

export function SLADrilldownModal({
  open,
  onOpenChange,
  title,
  subtitle,
  drivers,
  orphanInvoices = [],
  fleetSLA,
  mode,
}: SLADrilldownModalProps) {
  const [selectedDriver, setSelectedDriver] = useState<DriverSLAStats | null>(null);
  const [view, setView] = useState<"drivers" | "invoices">("drivers");
  const [selectedInvoice, setSelectedInvoice] = useState<DeliveryWithHistory | null>(null);
  const [isInvoiceDetailOpen, setIsInvoiceDetailOpen] = useState(false);

  // Get the appropriate SLA based on mode
  const getDriverSLA = (driver: DriverSLAStats) => 
    mode === "weekly" ? driver.weeklySLA : driver.todaySLA;
  
  const getDriverTotal = (driver: DriverSLAStats) => 
    mode === "weekly" ? driver.weeklyTotalInvoices : driver.todayTotalInvoices;
  
  const getDriverDelivered = (driver: DriverSLAStats) => 
    mode === "weekly" ? driver.weeklyDeliveredCount : driver.todayDeliveredCount;
  
  const getDriverOccurrences = (driver: DriverSLAStats) => 
    mode === "weekly" ? driver.weeklyOccurrenceCount : driver.todayOccurrenceCount;

  // Sort drivers by SLA (worst first)
  const sortedDrivers = [...drivers]
    .filter(d => getDriverTotal(d) > 0)
    .sort((a, b) => getDriverSLA(a) - getDriverSLA(b));
  
  // Group by severity
  const criticalDrivers = sortedDrivers.filter(d => isSLACritical(getDriverSLA(d)));
  const attentionDrivers = sortedDrivers.filter(d => isSLAAttention(getDriverSLA(d)));
  const goodDrivers = sortedDrivers.filter(d => getDriverSLA(d) >= SLA_THRESHOLDS.GOOD && getDriverSLA(d) < SLA_THRESHOLDS.EXCELLENT);
  const healthyDrivers = sortedDrivers.filter(d => getDriverSLA(d) >= SLA_THRESHOLDS.EXCELLENT);

  const fleetColorScheme = getSLAColorScheme(fleetSLA);
  const hasProblems = criticalDrivers.length > 0 || attentionDrivers.length > 0 || goodDrivers.length > 0 || orphanInvoices.length > 0;

  const handleDriverSelect = (driver: DriverSLAStats) => {
    setSelectedDriver(driver);
    setView("invoices");
  };

  const handleBack = () => {
    setSelectedDriver(null);
    setView("drivers");
  };

  const handleWhatsApp = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    const cleanPhone = phone.replace(/\D/g, "");
    openWhatsApp(cleanPhone);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state when closing
    setTimeout(() => {
      setSelectedDriver(null);
      setView("drivers");
      setSelectedInvoice(null);
      setIsInvoiceDetailOpen(false);
    }, 200);
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
      weight: invoice.totalWeight ? `${invoice.totalWeight}kg` : "-",
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          {view === "drivers" ? (
            <>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className={cn("h-5 w-5", fleetColorScheme.textClass)} />
                {title}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </>
          ) : (
            <>
              <DialogTitle className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0 mr-2">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                Detalhes: {selectedDriver?.driver_name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Notas fiscais e ocorrências que impactaram o SLA
              </p>
            </>
          )}
        </DialogHeader>

        {/* Fleet Summary */}
        {view === "drivers" && (
          <div className={cn(
            "rounded-lg p-4 border-2 mb-4",
            fleetColorScheme.borderClass,
            fleetColorScheme.bgClass
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">SLA da Frota</p>
                <p className={cn("text-3xl font-bold font-mono", fleetColorScheme.textClass)}>
                  {formatSLA(fleetSLA)}%
                </p>
              </div>
              <div className="text-right">
                <Badge className={cn(
                  "text-white font-bold",
                  fleetColorScheme.badgeBgClass
                )}>
                  {fleetColorScheme.labelPt}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Meta: {SLA_THRESHOLDS.EXCELLENT}%
                </p>
              </div>
            </div>
            <Progress value={fleetSLA} className={cn("h-2 mt-3", fleetColorScheme.progressClass)} />
          </div>
        )}

        <ScrollArea className="flex-1 pr-2">
          {view === "drivers" ? (
            <DriversListView
              criticalDrivers={criticalDrivers}
              attentionDrivers={attentionDrivers}
              goodDrivers={goodDrivers}
              healthyDrivers={healthyDrivers}
              orphanInvoices={orphanInvoices}
              hasProblems={hasProblems}
              mode={mode}
              getDriverSLA={getDriverSLA}
              getDriverTotal={getDriverTotal}
              getDriverDelivered={getDriverDelivered}
              getDriverOccurrences={getDriverOccurrences}
              onDriverSelect={handleDriverSelect}
              onWhatsApp={handleWhatsApp}
            />
          ) : selectedDriver ? (
            <DriverInvoicesView
              driver={selectedDriver}
              mode={mode}
              onInvoiceOpen={(invoice) => openInvoiceDetail(invoice, selectedDriver.driver_name)}
            />
          ) : null}
        </ScrollArea>
        <DeliveryDetailSheet
          delivery={selectedInvoice}
          open={isInvoiceDetailOpen}
          onOpenChange={setIsInvoiceDetailOpen}
        />
      </DialogContent>
    </Dialog>
  );
}

// Level 1: Drivers List View
function DriversListView({
  criticalDrivers,
  attentionDrivers,
  goodDrivers,
  healthyDrivers,
  orphanInvoices,
  hasProblems,
  mode,
  getDriverSLA,
  getDriverTotal,
  getDriverDelivered,
  getDriverOccurrences,
  onDriverSelect,
  onWhatsApp,
}: {
  criticalDrivers: DriverSLAStats[];
  attentionDrivers: DriverSLAStats[];
  goodDrivers: DriverSLAStats[];
  healthyDrivers: DriverSLAStats[];
  orphanInvoices: OrphanInvoice[];
  hasProblems: boolean;
  mode: "weekly" | "today";
  getDriverSLA: (d: DriverSLAStats) => number;
  getDriverTotal: (d: DriverSLAStats) => number;
  getDriverDelivered: (d: DriverSLAStats) => number;
  getDriverOccurrences: (d: DriverSLAStats) => number;
  onDriverSelect: (driver: DriverSLAStats) => void;
  onWhatsApp: (e: React.MouseEvent, phone: string) => void;
}) {
  if (!hasProblems && healthyDrivers.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-muted-foreground">Nenhuma entrega finalizada no período</p>
      </div>
    );
  }

  if (!hasProblems && healthyDrivers.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-success" />
        <p className="text-lg font-semibold text-success mb-2">
          Operação Saudável! 🎉
        </p>
        <p className="text-muted-foreground">
          Todos os motoristas estão acima da meta de {SLA_THRESHOLDS.EXCELLENT}%
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!hasProblems && (
        <div className="text-center py-4">
          <CheckCircle2 className="h-14 w-14 mx-auto mb-3 text-success" />
          <p className="text-lg font-semibold text-success mb-2">
            Operação Saudável!
          </p>
          <p className="text-muted-foreground">
            Todos os motoristas estão acima da meta de {SLA_THRESHOLDS.EXCELLENT}%
          </p>
        </div>
      )}

      {/* Orphan Invoices */}
      {orphanInvoices.length > 0 && (
        <DriverSection
          title="NFs Sem Motorista Associado"
          icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
          count={orphanInvoices.length}
          colorClass="text-orange-500"
          bgClass="bg-orange-500/10"
          borderClass="border-orange-500/30"
        >
          {orphanInvoices.map((invoice) => (
            <OrphanInvoiceRow key={invoice.id} invoice={invoice} />
          ))}
        </DriverSection>
      )}

      {/* Critical Drivers (<75%) */}
      {criticalDrivers.length > 0 && (
        <DriverSection
          title={`Estado Crítico (<${SLA_THRESHOLDS.ATTENTION}%)`}
          subtitle="Mudança imediata necessária"
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          count={criticalDrivers.length}
          colorClass="text-destructive"
          bgClass="bg-destructive/10"
          borderClass="border-destructive/30"
        >
          {criticalDrivers.map((driver, index) => (
            <DriverRow
              key={driver.driver_id}
              driver={driver}
              index={index}
              type="critical"
              sla={getDriverSLA(driver)}
              total={getDriverTotal(driver)}
              delivered={getDriverDelivered(driver)}
              occurrences={getDriverOccurrences(driver)}
              onClick={() => onDriverSelect(driver)}
              onWhatsApp={(e) => onWhatsApp(e, driver.phone)}
            />
          ))}
        </DriverSection>
      )}

      {/* Attention Drivers (75-89%) */}
      {attentionDrivers.length > 0 && (
        <DriverSection
          title={`Atenção (${SLA_THRESHOLDS.ATTENTION}-${SLA_THRESHOLDS.GOOD - 0.1}%)`}
          subtitle="Requer orientação"
          icon={<AlertCircle className="h-4 w-4 text-warning" />}
          count={attentionDrivers.length}
          colorClass="text-warning"
          bgClass="bg-warning/10"
          borderClass="border-warning/30"
        >
          {attentionDrivers.map((driver, index) => (
            <DriverRow
              key={driver.driver_id}
              driver={driver}
              index={criticalDrivers.length + index}
              type="attention"
              sla={getDriverSLA(driver)}
              total={getDriverTotal(driver)}
              delivered={getDriverDelivered(driver)}
              occurrences={getDriverOccurrences(driver)}
              onClick={() => onDriverSelect(driver)}
              onWhatsApp={(e) => onWhatsApp(e, driver.phone)}
            />
          ))}
        </DriverSection>
      )}

      {goodDrivers.length > 0 && (
        <DriverSection
          title={`Bom, abaixo da meta (${SLA_THRESHOLDS.GOOD}-${SLA_THRESHOLDS.EXCELLENT - 0.1}%)`}
          subtitle="Clique para ver as NFs"
          icon={<AlertCircle className="h-4 w-4 text-blue-600" />}
          count={goodDrivers.length}
          colorClass="text-blue-600"
          bgClass="bg-blue-500/10"
          borderClass="border-blue-500/30"
        >
          {goodDrivers.map((driver, index) => (
            <DriverRow
              key={driver.driver_id}
              driver={driver}
              index={criticalDrivers.length + attentionDrivers.length + index}
              type="good"
              sla={getDriverSLA(driver)}
              total={getDriverTotal(driver)}
              delivered={getDriverDelivered(driver)}
              occurrences={getDriverOccurrences(driver)}
              onClick={() => onDriverSelect(driver)}
              onWhatsApp={(e) => onWhatsApp(e, driver.phone)}
            />
          ))}
        </DriverSection>
      )}

      {healthyDrivers.length > 0 && (
        <DriverSection
          title={hasProblems ? "Motoristas acima da meta" : "Motoristas no período"}
          icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          count={healthyDrivers.length}
          colorClass="text-success"
          bgClass="bg-success/10"
          borderClass="border-success/30"
        >
          {healthyDrivers.map((driver, index) => (
            <DriverRow
              key={driver.driver_id}
              driver={driver}
              index={criticalDrivers.length + attentionDrivers.length + goodDrivers.length + index}
              type="healthy"
              sla={getDriverSLA(driver)}
              total={getDriverTotal(driver)}
              delivered={getDriverDelivered(driver)}
              occurrences={getDriverOccurrences(driver)}
              onClick={() => onDriverSelect(driver)}
              onWhatsApp={(e) => onWhatsApp(e, driver.phone)}
            />
          ))}
        </DriverSection>
      )}
    </div>
  );
}

function DriverSection({
  title,
  subtitle,
  icon,
  count,
  colorClass,
  bgClass,
  borderClass,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  count: number;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={cn("flex items-center gap-2 mb-3 p-2 rounded-lg", bgClass)}>
        {icon}
        <div className="flex-1">
          <span className={cn("font-semibold", colorClass)}>{title}</span>
          {subtitle && <span className="text-xs text-muted-foreground ml-2">• {subtitle}</span>}
        </div>
        <Badge variant="outline" className={cn(bgClass, colorClass, borderClass)}>
          {count}
        </Badge>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function DriverRow({
  driver,
  index,
  type,
  sla,
  total,
  delivered,
  occurrences,
  onClick,
  onWhatsApp,
}: {
  driver: DriverSLAStats;
  index: number;
  type: "critical" | "attention" | "good" | "healthy";
  sla: number;
  total: number;
  delivered: number;
  occurrences: number;
  onClick: () => void;
  onWhatsApp: (e: React.MouseEvent) => void;
}) {
  const colorScheme = getSLAColorScheme(sla);
  const isCritical = type === "critical";
  const isHealthy = type === "healthy";
  const isGood = type === "good";

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all group",
        "hover:shadow-md",
        isCritical
          ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
          : isHealthy
          ? "border-success/30 bg-success/5 hover:bg-success/10"
          : isGood
          ? "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10"
          : "border-warning/30 bg-warning/5 hover:bg-warning/10"
      )}
    >
      {/* Rank */}
      <div className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shrink-0",
        isCritical ? "bg-destructive" : isHealthy ? "bg-success" : isGood ? "bg-blue-600" : "bg-warning"
      )}>
        {index + 1}
      </div>

      {/* Avatar */}
      {driver.photo_url ? (
        <img
          src={driver.photo_url}
          alt={driver.driver_name}
          className={cn(
            "h-10 w-10 rounded-full object-cover border-2 shrink-0",
            isCritical ? "border-destructive" : isHealthy ? "border-success" : isGood ? "border-blue-600" : "border-warning"
          )}
        />
      ) : (
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center border-2 shrink-0 text-sm font-bold",
          isCritical
            ? "bg-destructive/10 border-destructive"
            : isHealthy
            ? "bg-success/10 border-success"
            : isGood
            ? "bg-blue-500/10 border-blue-600"
            : "bg-warning/10 border-warning"
        )}>
          {driver.driver_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{driver.driver_name}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{delivered} entregas</span>
          <span>{total} NFs</span>
          <span className={isCritical ? "text-destructive" : isHealthy ? "text-success" : isGood ? "text-blue-600" : "text-warning"}>
            {occurrences} ocorrências
          </span>
        </div>
      </div>

      {/* SLA */}
      <div className="text-right shrink-0">
        <span className={cn("text-xl font-bold font-mono", colorScheme.textClass)}>
          {formatSLA(sla)}%
        </span>
      </div>

      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-success hover:text-success shrink-0"
        onClick={onWhatsApp}
      >
        <MessageCircle className="h-4 w-4" />
      </Button>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}

function OrphanInvoiceRow({ invoice }: { invoice: OrphanInvoice }) {
  const isZeroWeight = invoice.weight === 0;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      isZeroWeight
        ? "border-destructive/30 bg-destructive/5"
        : "border-orange-500/30 bg-orange-500/5"
    )}>
      <div className={cn(
        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
        isZeroWeight ? "bg-destructive/10" : "bg-orange-500/10"
      )}>
        <FileText className={cn("h-5 w-5", isZeroWeight ? "text-destructive" : "text-orange-500")} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">NF {invoice.nfeNumber}</p>
        <p className="text-xs text-muted-foreground truncate">{invoice.recipientName}</p>
      </div>

      <div className="text-right shrink-0">
        <Badge variant="outline" className={cn(
          "text-xs",
          isZeroWeight ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-orange-500/10 text-orange-500 border-orange-500/30"
        )}>
          {OCCURRENCE_LABELS[invoice.occurrenceType] || invoice.occurrenceType}
        </Badge>
        <p className="text-xs text-muted-foreground mt-1">
          Peso: {(invoice.weight * 100).toFixed(0)}%
        </p>
      </div>
    </div>
  );
}

// Level 2: Driver Invoices View
function DriverInvoicesView({
  driver,
  mode,
  onInvoiceOpen,
}: {
  driver: DriverSLAStats;
  mode: "weekly" | "today";
  onInvoiceOpen: (invoice: SLAInvoiceItem) => void;
}) {
  const sla = mode === "weekly" ? driver.weeklySLA : driver.todaySLA;
  const total = mode === "weekly" ? driver.weeklyTotalInvoices : driver.todayTotalInvoices;
  const delivered = mode === "weekly" ? driver.weeklyDeliveredCount : driver.todayDeliveredCount;
  const occurrenceCount = mode === "weekly" ? driver.weeklyOccurrenceCount : driver.todayOccurrenceCount;
  const occurrences = mode === "weekly" ? driver.weeklyOccurrences : driver.todayOccurrences;
  const invoices = mode === "weekly" ? driver.weeklyInvoices : driver.todayInvoices;

  const colorScheme = getSLAColorScheme(sla);

  // Hidden from the UI; kept here only to avoid changing the existing SLA math.
  const deliveredWeight = delivered * 1.0;
  const occurrenceWeight = occurrences.reduce((sum, occ) => sum + occ.weight, 0);
  const totalWeight = deliveredWeight + occurrenceWeight;

  return (
    <div className="space-y-4">
      {/* Driver Header */}
      <div className={cn(
        "rounded-lg p-4 border-2",
        colorScheme.borderClass,
        colorScheme.bgClass
      )}>
        <div className="flex items-center gap-4">
          {driver.photo_url ? (
            <img
              src={driver.photo_url}
              alt={driver.driver_name}
              className="h-16 w-16 rounded-full object-cover border-2 border-muted"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold">
              {driver.driver_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <p className="text-lg font-semibold">{driver.driver_name}</p>
            <Badge variant="outline" className="text-xs">{driver.vehicle_plate}</Badge>
          </div>
          <div className="text-right">
            <p className={cn("text-3xl font-bold font-mono", colorScheme.textClass)}>
              {formatSLA(sla)}%
            </p>
            <Badge className={cn(
              "text-white font-bold",
              colorScheme.badgeBgClass
            )}>
              {colorScheme.labelPt}
            </Badge>
          </div>
        </div>
      </div>

      {/* Calculation Breakdown */}
      <div className="hidden">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Cálculo do SLA (Média Ponderada)
        </h4>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Entregas realizadas:</span>
            <span className="font-mono">{delivered} × 1.0 = {deliveredWeight.toFixed(1)}</span>
          </div>
          {occurrences.map((occ, idx) => (
            <div key={idx} className="flex justify-between text-muted-foreground">
              <span className="truncate flex-1 mr-2">
                {OCCURRENCE_LABELS[occ.occurrenceType] || occ.occurrenceType} (NF {occ.nfeNumber}):
              </span>
              <span className={cn("font-mono", occ.weight === 0 ? "text-destructive" : "")}>
                {occ.weight.toFixed(1)}
              </span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex justify-between font-medium">
            <span>Soma dos pesos:</span>
            <span className="font-mono">{totalWeight.toFixed(1)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total de NFs:</span>
            <span className="font-mono">{total}</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>SLA:</span>
            <span className={cn("font-mono", colorScheme.textClass)}>
              ({totalWeight.toFixed(1)} / {total}) × 100 = {formatSLA(sla)}%
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-center">
          <p className="text-2xl font-bold text-success font-mono">{delivered}</p>
          <p className="text-xs text-muted-foreground">Entregas</p>
        </div>
        <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-center">
          <p className="text-2xl font-bold text-warning font-mono">{occurrenceCount}</p>
          <p className="text-xs text-muted-foreground">Ocorrências</p>
        </div>
        <div className={cn("rounded-lg p-3 text-center", colorScheme.bgClass, `border ${colorScheme.borderClass}`)}>
          <p className={cn("text-2xl font-bold font-mono", colorScheme.textClass)}>{total}</p>
          <p className="text-xs text-muted-foreground">Total NFs</p>
        </div>
      </div>

      {invoices.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Notas fiscais do período
          </h4>
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <InvoiceItemCard
                key={invoice.invoiceId}
                invoice={invoice}
                onClick={() => onInvoiceOpen(invoice)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Occurrences List */}
      {occurrences.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Ocorrências que impactaram o SLA
          </h4>
          <div className="space-y-2">
            {occurrences.map((occ, idx) => (
              <InvoiceOccurrenceCard key={idx} occurrence={occ} />
            ))}
          </div>
        </div>
      )}

      {/* Weight Reference Table */}
      <div className="hidden">
        <h4 className="font-medium mb-3">Tabela de Pesos por Tipo de Ocorrência</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(SLA_OCCURRENCE_WEIGHTS).map(([key, weight]) => (
            <div key={key} className="flex justify-between p-1.5 rounded bg-muted/50">
              <span className="text-muted-foreground">{OCCURRENCE_LABELS[key] || key}:</span>
              <span className={cn(
                "font-mono font-medium",
                weight === 0 ? "text-destructive" :
                weight < 0.9 ? "text-warning" :
                "text-success"
              )}>
                {weight.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InvoiceItemCard({ invoice, onClick }: { invoice: SLAInvoiceItem; onClick: () => void }) {
  const isDelivered = invoice.status === "delivered";
  const isZeroWeight = invoice.weight === 0;
  const isCritical = invoice.weight < 0.8;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-md",
        isDelivered
          ? "border-success/30 bg-success/5 hover:bg-success/10"
          : isZeroWeight
          ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
          : isCritical
          ? "border-warning/30 bg-warning/5 hover:bg-warning/10"
          : "border-border bg-muted/30 hover:bg-muted/50"
      )}
    >
      <div className={cn(
        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
        isDelivered ? "bg-success/10" : isZeroWeight ? "bg-destructive/10" : isCritical ? "bg-warning/10" : "bg-muted"
      )}>
        <FileText className={cn(
          "h-5 w-5",
          isDelivered ? "text-success" : isZeroWeight ? "text-destructive" : isCritical ? "text-warning" : "text-muted-foreground"
        )} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">NF {invoice.nfeNumber}</span>
          <Badge variant="outline" className={cn(
            "text-xs",
            isDelivered
              ? "bg-success/10 text-success border-success/30"
              : isZeroWeight
              ? "bg-destructive/10 text-destructive border-destructive/30"
              : "bg-warning/10 text-warning border-warning/30"
          )}>
            {isDelivered ? "Entregue" : OCCURRENCE_LABELS[invoice.occurrenceType || "outros"] || invoice.occurrenceType}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{invoice.recipientName}</p>
      </div>

      <div className="text-right shrink-0">
        <span className={cn(
          "text-lg font-bold font-mono",
          isDelivered ? "text-success" : isZeroWeight ? "text-destructive" : isCritical ? "text-warning" : "text-foreground"
        )}>
          {(invoice.weight * 100).toFixed(0)}%
        </span>
        <p className="text-xs text-muted-foreground">peso</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function InvoiceOccurrenceCard({ occurrence }: { occurrence: DriverSLAStats["todayOccurrences"][0] }) {
  const isZeroWeight = occurrence.weight === 0;
  const isCritical = occurrence.weight < 0.8;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      isZeroWeight
        ? "border-destructive/30 bg-destructive/5"
        : isCritical
        ? "border-warning/30 bg-warning/5"
        : "border-border bg-muted/30"
    )}>
      <div className={cn(
        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
        isZeroWeight ? "bg-destructive/10" : isCritical ? "bg-warning/10" : "bg-muted"
      )}>
        <FileText className={cn(
          "h-5 w-5",
          isZeroWeight ? "text-destructive" : isCritical ? "text-warning" : "text-muted-foreground"
        )} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">NF {occurrence.nfeNumber}</span>
          <Badge variant="outline" className={cn(
            "text-xs",
            isZeroWeight ? "bg-destructive/10 text-destructive border-destructive/30" :
            isCritical ? "bg-warning/10 text-warning border-warning/30" :
            "bg-muted"
          )}>
            {OCCURRENCE_LABELS[occurrence.occurrenceType] || occurrence.occurrenceType}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{occurrence.recipientName}</p>
      </div>

      <div className="text-right shrink-0">
        <span className={cn(
          "text-lg font-bold font-mono",
          isZeroWeight ? "text-destructive" : isCritical ? "text-warning" : "text-foreground"
        )}>
          {(occurrence.weight * 100).toFixed(0)}%
        </span>
        <p className="text-xs text-muted-foreground">impacto</p>
      </div>
    </div>
  );
}
