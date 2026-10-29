import { useState, useMemo } from "react";
import { getTodayBrazil } from "@/lib/timezone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  MoreVertical,
  Printer,
  Calendar,
  CalendarDays,
  Truck,
  FileText,
  Eye,
  Trash2,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useManifestsDB, DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";
import { ManifestDetailSheet } from "@/components/deliveries/ManifestDetailSheet";
import { ManifestPrintPreview } from "@/components/deliveries/ManifestPrintPreview";
import { DeleteManifestDialog } from "@/components/deliveries/DeleteManifestDialog";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type TimeFilter = "daily" | "weekly" | "all";

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-100 text-amber-800" },
  in_progress: { label: "Em Rota", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Concluído", color: "bg-emerald-100 text-emerald-800" },
  paid: { label: "Pago", color: "bg-green-500 text-white" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

export function ManifestsTabDB() {
  const {
    manifests,
    isLoading,
    fetchManifests,
  } = useManifestsDB();

  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily");

  const [selectedManifest, setSelectedManifest] = useState<DBManifest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Filter manifests by time period and search
  const filteredManifests = useMemo(() => {
    // Get today's date in Brazil timezone
    const todayStr = getTodayBrazil();
    const today = new Date(todayStr + "T00:00:00-03:00");
    
    // Calculate date 7 days ago
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);

    return manifests.filter((m) => {
      // Compare date strings directly (YYYY-MM-DD format)
      const manifestDateStr = m.scheduled_date.slice(0, 10);

      let timeMatch = true;
      if (timeFilter === "daily") {
        // Exact match for today
        timeMatch = manifestDateStr === todayStr;
      } else if (timeFilter === "weekly") {
        // Within last 7 days
        timeMatch = manifestDateStr >= weekAgoStr && manifestDateStr <= todayStr;
      }
      // timeFilter === "all" keeps timeMatch = true

      if (!timeMatch) return false;

      if (!search) return true;

      const searchLower = search.toLowerCase();
      return (
        m.manifest_code.toLowerCase().includes(searchLower) ||
        m.driver_name.toLowerCase().includes(searchLower) ||
        (m.driver_cpf && m.driver_cpf.includes(search)) ||
        (m.vehicle_plate && m.vehicle_plate.toLowerCase().includes(searchLower))
      );
    });
  }, [manifests, timeFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayManifests = manifests.filter((m) => {
      const d = new Date(m.scheduled_date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekManifests = manifests.filter((m) => {
      const d = new Date(m.scheduled_date);
      return d >= weekStart;
    });

    return {
      today: todayManifests.length,
      todayValue: todayManifests.reduce((sum, m) => sum + (m.total_value || 0), 0),
      week: weekManifests.length,
      weekValue: weekManifests.reduce((sum, m) => sum + (m.total_value || 0), 0),
      completed: filteredManifests.filter((m) => m.status === "completed").length,
      pending: filteredManifests.filter((m) => m.status === "pending" || m.status === "in_progress").length,
    };
  }, [manifests, filteredManifests]);

  const handleOpenDetail = (manifest: DBManifest) => {
    setSelectedManifest(manifest);
    setIsDetailOpen(true);
  };

  const handlePrint = (manifest: DBManifest) => {
    setSelectedManifest(manifest);
    setIsPrintOpen(true);
  };

  const handleDelete = async (manifestId: string) => {
    try {
      // First, unlink all invoices from this manifest
      await supabase
        .from("invoices")
        .update({
          manifest_id: null,
          driver_id: null,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("manifest_id", manifestId);

      // Then delete the manifest
      const { error } = await supabase
        .from("manifests")
        .delete()
        .eq("id", manifestId);

      if (error) throw error;

      toast({
        title: "✅ Romaneio excluído",
        description: "As NFs voltaram para pendente.",
      });

      setIsDeleteOpen(false);
      setSelectedManifest(null);
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusLabels[status] || statusLabels.pending;
    return (
      <Badge className={cn("font-medium", config.color)}>{config.label}</Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Calendar className="h-4 w-4" />
            Hoje
          </div>
          <div className="text-2xl font-bold">{stats.today}</div>
          <div className="text-sm text-muted-foreground">
            {formatCurrency(stats.todayValue)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CalendarDays className="h-4 w-4" />
            Semana
          </div>
          <div className="text-2xl font-bold">{stats.week}</div>
          <div className="text-sm text-muted-foreground">
            {formatCurrency(stats.weekValue)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="h-4 w-4" />
            Em Aberto
          </div>
          <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          <div className="text-sm text-muted-foreground">Aguardando baixa</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Concluídos
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {stats.completed}
          </div>
          <div className="text-sm text-muted-foreground">Finalizados</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, motorista, CPF ou placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={timeFilter === "daily" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("daily")}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Hoje
          </Button>
          <Button
            variant={timeFilter === "weekly" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("weekly")}
            className="gap-2"
          >
            <CalendarDays className="h-4 w-4" />
            Semana
          </Button>
          <Button
            variant={timeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("all")}
            className="gap-2"
          >
            Todos
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Romaneio</TableHead>
              <TableHead>Motorista</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead className="text-center">NFs</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredManifests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  {manifests.length === 0
                    ? "Nenhum romaneio cadastrado."
                    : "Nenhum romaneio encontrado para o período selecionado."}
                </TableCell>
              </TableRow>
            ) : (
              filteredManifests.map((manifest) => (
                <TableRow
                  key={manifest.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleOpenDetail(manifest)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-bold text-primary">
                          Nº {formatManifestNumber(manifest)}
                        </span>
                        <div className="text-xs text-muted-foreground font-mono">
                          {manifest.manifest_code}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{manifest.driver_name}</div>
                      {manifest.driver_cpf && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {manifest.driver_cpf}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm">
                          {manifest.vehicle_type || "-"}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {manifest.vehicle_plate || "-"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{manifest.deliveries_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(manifest.total_value || 0)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(manifest.scheduled_date).toLocaleDateString(
                        "pt-BR"
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(manifest.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(manifest.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(manifest);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrint(manifest);
                          }}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Reimprimir
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedManifest(manifest);
                            setIsDeleteOpen(true);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Detail Sheet */}
      <ManifestDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        manifest={selectedManifest}
        onRefresh={fetchManifests}
      />

      {/* Print Preview */}
      <ManifestPrintPreview
        open={isPrintOpen}
        onOpenChange={setIsPrintOpen}
        manifest={null}
        deliveries={[]}
        dbManifest={selectedManifest}
      />

      {/* Delete Dialog */}
      <DeleteManifestDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        manifest={
          selectedManifest
            ? {
                id: selectedManifest.manifest_code,
                driverId: 0,
                driverName: selectedManifest.driver_name,
                driverCpf: selectedManifest.driver_cpf || "",
                driverPlate: selectedManifest.vehicle_plate || "",
                vehicleType: selectedManifest.vehicle_type || "",
                isOwnVehicle: selectedManifest.is_own_fleet,
                freightType: selectedManifest.freight_type as
                  | "fixed"
                  | "lumpsum"
                  | "per_km",
                calculatedTotal: selectedManifest.freight_value,
                deliveriesCount: selectedManifest.deliveries_count,
                deliveryIds: [],
                createdAt: new Date(selectedManifest.created_at),
                status: selectedManifest.status as "pending" | "paid",
              }
            : null
        }
        onConfirm={() => selectedManifest && handleDelete(selectedManifest.id)}
        canDelete={
          selectedManifest?.status !== "completed" &&
          selectedManifest?.status !== "paid"
        }
        blockReason={
          selectedManifest?.status === "completed" ||
          selectedManifest?.status === "paid"
            ? "Romaneios finalizados ou pagos não podem ser excluídos."
            : undefined
        }
      />
    </div>
  );
}
