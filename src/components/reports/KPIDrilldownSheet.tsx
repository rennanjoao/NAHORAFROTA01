import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Truck } from "lucide-react";
import { EmptyState, StatusBadge, type Tone } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatCurrency";
import { getOccurrenceLabel } from "@/hooks/useSLADB";
import type { DBInvoice } from "@/hooks/useInvoicesDB";
import { getInvoiceEventDate, hasOccurrence, isDeliveredStatus, isReturnedStatus } from "@/lib/reportFilters";
import { useEffect, useMemo, useState } from "react";

export type DrilldownType = "sla" | "ontime" | "delayed" | "returns" | "cost" | "volume";

/** Romaneio de agregado que entra no custo medio por entrega. */
export interface CostManifestRow {
  id: string;
  code: string;
  driver: string;
  date: string;
  freight: number;
}

interface KPIDrilldownSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiType: DrilldownType | null;
  /** NFs ja filtradas pelos filtros da tela de Relatorios. */
  invoices: DBInvoice[];
  /** Custo medio: romaneios de agregados do periodo e a conta do indicador. */
  cost?: { manifests: CostManifestRow[]; totalFreight: number; delivered: number; avgCost: number };
}

const configs: Record<DrilldownType, { title: string; description: string }> = {
  sla: {
    title: "O que entrou no SLA",
    description: "Entregas finalizadas no período que contam para o SLA.",
  },
  ontime: {
    title: "Entregas no prazo",
    description: "Entregas feitas com sucesso.",
  },
  delayed: {
    title: "Entregas com ocorrência",
    description: "Entregas que tiveram algum tipo de ocorrência.",
  },
  returns: {
    title: "Devoluções",
    description: "Entregas que voltaram para a empresa.",
  },
  cost: {
    title: "Como sai o custo médio por entrega",
    description: "Frete pago aos agregados no período dividido pelas entregas feitas.",
  },
  volume: {
    title: "Notas do período",
    description: "Todas as notas fiscais do período, com a situação de cada uma.",
  },
};

// Situacao da nota: texto + cor com significado.
const STATUS_INFO: Record<string, { label: string; tone: Tone }> = {
  entregue: { label: "Entregue", tone: "success" },
  delivered: { label: "Entregue", tone: "success" },
  pending: { label: "Pendente", tone: "neutral" },
  in_transit: { label: "Em rota", tone: "info" },
  in_route: { label: "Em rota", tone: "info" },
  occurrence: { label: "Ocorrência", tone: "danger" },
  devolvido: { label: "Devolvido", tone: "danger" },
  returned: { label: "Devolvido", tone: "danger" },
  returning: { label: "Em devolução", tone: "warning" },
  delayed: { label: "Atrasado", tone: "danger" },
};

const statusInfo = (status: string) => STATUS_INFO[status] ?? { label: status, tone: "neutral" as Tone };

const eventDay = (inv: DBInvoice) => new Date(getInvoiceEventDate(inv)).toLocaleDateString("pt-BR");
const dayOf = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("pt-BR");

/** Custo medio: a conta em cima e os romaneios de agregados que entram nela. */
function CostBreakdown({ cost }: { cost: NonNullable<KPIDrilldownSheetProps["cost"]> }) {
  return (
    <div className="space-y-4 pb-4">
      <dl className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Frete de agregados</dt>
          <dd className="font-data text-lg font-semibold text-foreground">{formatCurrency(cost.totalFreight)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Entregas feitas</dt>
          <dd className="font-data text-lg font-semibold text-foreground">{cost.delivered.toLocaleString("pt-BR")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Custo médio por entrega</dt>
          <dd className="font-data text-lg font-semibold text-foreground">{formatCurrency(cost.avgCost)}</dd>
        </div>
      </dl>
      {cost.manifests.length === 0 ? (
        <EmptyState
          compact
          icon={Truck}
          title="Nenhum romaneio de agregado no período"
          description="Com frota própria não há frete a pagar, então o custo médio fica em zero."
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {cost.manifests.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground" title={m.driver}>
                  {m.driver}
                </p>
                <p className="font-data text-xs text-muted-foreground">
                  Romaneio {m.code} · {dayOf(m.date)}
                </p>
              </div>
              <span className="shrink-0 font-data font-semibold text-foreground">{formatCurrency(m.freight)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function KPIDrilldownSheet({ open, onOpenChange, kpiType, invoices, cost }: KPIDrilldownSheetProps) {
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    setStatusFilter("all");
  }, [kpiType, open]);

  const baseItems = useMemo(() => {
    if (!kpiType) return [];

    switch (kpiType) {
      case "sla":
        return invoices.filter(
          (inv) => isDeliveredStatus(inv.status) || inv.status === "occurrence" || isReturnedStatus(inv.status)
        );
      case "ontime":
        return invoices.filter((inv) => isDeliveredStatus(inv.status));
      case "delayed":
        return invoices.filter((inv) => hasOccurrence(inv));
      case "returns":
        return invoices.filter((inv) => isReturnedStatus(inv.status));
      case "cost":
      case "volume":
      default:
        return invoices;
    }
  }, [invoices, kpiType]);

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return baseItems;
    return baseItems.filter((inv) => inv.status === statusFilter);
  }, [baseItems, statusFilter]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(baseItems.map((inv) => inv.status).filter(Boolean))).sort();
  }, [baseItems]);

  if (!kpiType) return null;

  const config = configs[kpiType];

  const showReason = kpiType === "delayed" || kpiType === "returns";
  const showCost = kpiType === "cost" && !!cost;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-2xl">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>{config.title}</SheetTitle>
          <SheetDescription>{config.description}</SheetDescription>
          {!showCost && (
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Badge variant="secondary" className="w-fit font-data">
                {filteredItems.length.toLocaleString("pt-BR")} nota{filteredItems.length === 1 ? "" : "s"}
              </Badge>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[12rem]" aria-label="Filtrar por situação">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusInfo(status).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </SheetHeader>

        {/* Rolavel pelo teclado (a lista nao tem itens focaveis). */}
        <div
          tabIndex={0}
          aria-label={`Lista: ${config.title}`}
          className="-mx-6 flex-1 overflow-y-auto overscroll-contain px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {showCost && cost ? (
            <CostBreakdown cost={cost} />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              compact
              icon={Package}
              title="Nenhuma nota encontrada"
              description="Não há notas para este indicador no período. Mude o período ou os filtros da tela."
              className="py-16"
            />
          ) : (
            <>
              {/* Computador */}
              <div className="hidden overflow-hidden rounded-lg border sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NF-e</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Situação</TableHead>
                      {showReason && <TableHead>Motivo</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-data text-xs">{inv.nfe_number || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{eventDay(inv)}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm" title={inv.recipient_name}>
                          {inv.recipient_name}
                        </TableCell>
                        <TableCell className="text-right font-data font-medium">{formatCurrency(inv.total_value)}</TableCell>
                        <TableCell>
                          <StatusBadge tone={statusInfo(inv.status).tone}>{statusInfo(inv.status).label}</StatusBadge>
                        </TableCell>
                        {showReason && (
                          <TableCell
                            className="max-w-[140px] truncate text-sm text-muted-foreground"
                            title={inv.occurrence_type ? getOccurrenceLabel(inv.occurrence_type) : undefined}
                          >
                            {inv.occurrence_type ? getOccurrenceLabel(inv.occurrence_type) : "—"}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Celular */}
              <ul className="space-y-2 pb-4 sm:hidden">
                {filteredItems.map((inv) => (
                  <li key={inv.id} className="space-y-2 rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" title={inv.recipient_name}>
                          {inv.recipient_name}
                        </p>
                        <p className="font-data text-xs text-muted-foreground">
                          NF {inv.nfe_number || "—"} · {eventDay(inv)}
                        </p>
                      </div>
                      <StatusBadge tone={statusInfo(inv.status).tone}>{statusInfo(inv.status).label}</StatusBadge>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {showReason && inv.occurrence_type ? getOccurrenceLabel(inv.occurrence_type) : ""}
                      </span>
                      <span className="font-data font-semibold">{formatCurrency(inv.total_value)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
