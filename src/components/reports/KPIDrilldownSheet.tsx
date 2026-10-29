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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatSLA } from "@/lib/formatSLA";
import { useInvoicesDB } from "@/hooks/useInvoicesDB";
import { useEffect, useMemo, useState } from "react";

export type DrilldownType = "sla" | "ontime" | "delayed" | "returns" | "cost" | "volume";

interface KPIDrilldownSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiType: DrilldownType | null;
}

const configs: Record<DrilldownType, { title: string; description: string }> = {
  sla: {
    title: "Detalhamento do SLA",
    description: "Entregas finalizadas que impactaram o indicador de SLA",
  },
  ontime: {
    title: "Entregas no Prazo",
    description: "Entregas realizadas com sucesso",
  },
  delayed: {
    title: "Entregas com Ocorrência",
    description: "Entregas que tiveram algum tipo de ocorrência",
  },
  returns: {
    title: "Devoluções",
    description: "Entregas que foram devolvidas",
  },
  cost: {
    title: "Detalhamento de Custos",
    description: "Composição dos valores de notas fiscais no período",
  },
  volume: {
    title: "Volume de Entregas",
    description: "Todas as notas fiscais processadas no período",
  },
};

export function KPIDrilldownSheet({ open, onOpenChange, kpiType }: KPIDrilldownSheetProps) {
  const { invoices } = useInvoicesDB();
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    setStatusFilter("all");
  }, [kpiType, open]);

  const baseItems = useMemo(() => {
    if (!kpiType) return [];

    switch (kpiType) {
      case "sla":
        return invoices.filter(
          (inv) =>
            inv.status === "entregue" ||
            inv.status === "delivered" ||
            inv.status === "occurrence" ||
            inv.status === "devolvido"
        );
      case "ontime":
        return invoices.filter(
          (inv) => inv.status === "entregue" || inv.status === "delivered"
        );
      case "delayed":
        return invoices.filter((inv) => !!inv.occurrence_type);
      case "returns":
        return invoices.filter((inv) => inv.status === "devolvido");
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

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "destructive" | "secondary" }> = {
      entregue: { label: "Entregue", variant: "default" },
      delivered: { label: "Entregue", variant: "default" },
      pending: { label: "Pendente", variant: "secondary" },
      in_transit: { label: "Em Rota", variant: "secondary" },
      occurrence: { label: "Ocorrência", variant: "destructive" },
      devolvido: { label: "Devolvido", variant: "destructive" },
    };
    const info = map[status] || { label: status, variant: "secondary" as const };
    return (
      <Badge variant={info.variant} className="text-xs">
        {info.label}
      </Badge>
    );
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      entregue: "Entregue",
      delivered: "Entregue",
      pending: "Pendente",
      in_transit: "Em Rota",
      occurrence: "Ocorrencia",
      devolvido: "Devolvido",
      returned: "Devolvido",
      returning: "Em Devolucao",
      delayed: "Atrasado",
    };
    return map[status] || status;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="text-xl">{config.title}</SheetTitle>
          <SheetDescription>{config.description}</SheetDescription>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Badge variant="outline" className="text-xs">
              {filteredItems.length} registros
            </Badge>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {getStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 mt-4">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum registro encontrado</p>
              <p className="text-xs mt-1">Não há dados reais para este indicador</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NF-e</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  {(kpiType === "delayed" || kpiType === "returns") && (
                    <TableHead>Motivo</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">
                      {inv.nfe_number || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(inv.imported_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-[180px]">
                      {inv.recipient_name}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(inv.total_value)}
                    </TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                    {(kpiType === "delayed" || kpiType === "returns") && (
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[120px]">
                        {inv.occurrence_type || "—"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
