import { useState, useMemo } from "react";
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Search,
  MoreVertical,
  Printer,
  Send,
  Calendar,
  CalendarDays,
  Truck,
  FileText,
  AlertCircle,
  User,
  Clock,
  Trash2,
} from "lucide-react";
import { ManifestRecord, manifestStore } from "@/stores/manifestStore";
import { ManifestPrintPreview } from "@/components/deliveries/ManifestPrintPreview";
import { DeleteManifestDialog } from "@/components/deliveries/DeleteManifestDialog";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type TimeFilter = "daily" | "weekly";

const vehicleTypeLabels: Record<string, string> = {
  Fiorino: "Fiorino",
  Van: "Van/VUC",
  VUC: "VUC",
  Toco: "Toco",
  Truck: "Truck",
  Carreta: "Carreta",
};

interface ManifestsTabProps {
  deliveries: Array<{
    id: number;
    nfe: string;
    recipient: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    phone?: string;
    weight: string;
    value: string;
    observation?: string;
    status?: string;
  }>;
}

export function ManifestsTab({ deliveries }: ManifestsTabProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily");
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [selectedManifest, setSelectedManifest] = useState<ManifestRecord | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [manifestToDelete, setManifestToDelete] = useState<ManifestRecord | null>(null);
  const [deleteCanProceed, setDeleteCanProceed] = useState(true);
  const [deleteBlockReason, setDeleteBlockReason] = useState<string | undefined>();
  const [deleteCompletedCount, setDeleteCompletedCount] = useState<number | undefined>();

  const allManifests = manifestStore.getAll();

  // Get IDs of completed deliveries (status = "delivered" or "entregue")
  const completedDeliveryIds = useMemo(() => {
    return deliveries
      .filter(d => d.status === "delivered" || d.status === "entregue")
      .map(d => String(d.id));
  }, [deliveries]);

  // Filter manifests by time period
  const filteredManifests = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allManifests.filter((m) => {
      const manifestDate = new Date(m.createdAt);
      manifestDate.setHours(0, 0, 0, 0);
      
      const diffTime = today.getTime() - manifestDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const timeMatch = timeFilter === "daily" ? diffDays === 0 : diffDays <= 7;
      
      if (!timeMatch) return false;
      
      if (!search) return true;
      
      const searchLower = search.toLowerCase();
      return (
        m.id.toLowerCase().includes(searchLower) ||
        m.driverName.toLowerCase().includes(searchLower) ||
        m.driverCpf.includes(search) ||
        m.driverPlate.toLowerCase().includes(searchLower)
      );
    });
  }, [allManifests, timeFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayManifests = allManifests.filter((m) => {
      const d = new Date(m.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);
    
    const weekManifests = allManifests.filter((m) => {
      const d = new Date(m.createdAt);
      return d >= weekStart;
    });
    
    return {
      today: todayManifests.length,
      todayValue: todayManifests.reduce((sum, m) => sum + m.calculatedTotal, 0),
      week: weekManifests.length,
      weekValue: weekManifests.reduce((sum, m) => sum + m.calculatedTotal, 0),
      modified: filteredManifests.filter((m) => m.modifiedBy).length,
    };
  }, [allManifests, filteredManifests]);

  const handlePrint = (manifest: ManifestRecord) => {
    setSelectedManifest(manifest);
    setIsPrintPreviewOpen(true);
  };

  const handleResendToDriver = (manifest: ManifestRecord) => {
    // Simulate sending notification to driver app
    const now = new Date();
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    
    // Update manifest with modification info
    manifestStore.updateManifest(manifest.id, {
      lastSentToDriver: now,
      modifiedBy: "Gestor",
      modifiedAt: now,
    });
    
    toast({
      title: "Romaneio reenviado",
      description: `${manifest.driverName} será notificado pelo app às ${timeStr}.`,
    });
  };

  // Handle delete manifest click
  const handleDeleteClick = (manifest: ManifestRecord) => {
    const { canDelete, reason, completedCount } = manifestStore.canDeleteManifest(
      manifest.id,
      completedDeliveryIds
    );
    
    setManifestToDelete(manifest);
    setDeleteCanProceed(canDelete);
    setDeleteBlockReason(reason);
    setDeleteCompletedCount(completedCount);
    setIsDeleteDialogOpen(true);
  };

  // Handle confirm delete
  const handleConfirmDelete = (manifestId: string) => {
    const result = manifestStore.deleteManifest(manifestId);
    
    if (result.success) {
      const nfCount = result.deliveryIds.length;
      
      toast({
        title: "Romaneio excluído com sucesso",
        description: `${nfCount} Notas fiscais retornaram para a fila de planejamento.`,
      });
      
      // Redirect to deliveries page (NF management)
      setTimeout(() => {
        navigate("/deliveries");
      }, 1500);
    } else {
      toast({
        title: "Erro ao excluir",
        description: result.error || "Não foi possível excluir o romaneio.",
        variant: "destructive",
      });
    }
    
    setIsDeleteDialogOpen(false);
    setManifestToDelete(null);
  };

  // Get deliveries for a manifest
  const getManifestDeliveries = (manifest: ManifestRecord) => {
    return deliveries.filter((d) => manifest.deliveryIds.includes(d.id));
  };

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
          <div className="text-sm text-muted-foreground">{formatCurrency(stats.todayValue)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CalendarDays className="h-4 w-4" />
            Semana
          </div>
          <div className="text-2xl font-bold">{stats.week}</div>
          <div className="text-sm text-muted-foreground">{formatCurrency(stats.weekValue)}</div>
        </Card>
        <Card className="p-4 col-span-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertCircle className="h-4 w-4" />
            Modificados
          </div>
          <div className="text-2xl font-bold text-warning">{stats.modified}</div>
          <div className="text-sm text-muted-foreground">Romaneios com alterações</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, motorista, CPF ou placa..."
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
              <TableHead className="text-right">Valor Frete</TableHead>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredManifests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum romaneio encontrado para o período selecionado.
                </TableCell>
              </TableRow>
            ) : (
              filteredManifests.map((manifest) => (
                <TableRow
                  key={manifest.id}
                  className={cn(manifest.modifiedBy && "bg-warning/5")}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono font-medium">{manifest.id}</span>
                      {manifest.modifiedBy && (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <Badge
                              variant="outline"
                              className="text-xs bg-warning/10 text-warning border-warning/30 cursor-help"
                            >
                              Modificado
                            </Badge>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-64">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <User className="h-4 w-4" />
                                Romaneio modificado por:
                              </div>
                              <div className="text-sm font-semibold text-warning">
                                {manifest.modifiedBy}
                              </div>
                              {manifest.modifiedAt && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {new Date(manifest.modifiedAt).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              )}
                              {manifest.lastSentToDriver && (
                                <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                                  Último envio ao motorista:{" "}
                                  {new Date(manifest.lastSentToDriver).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              )}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{manifest.driverName}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {manifest.driverCpf}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm">
                          {vehicleTypeLabels[manifest.vehicleType] || manifest.vehicleType}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {manifest.driverPlate}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{manifest.deliveriesCount}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(manifest.calculatedTotal)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(manifest.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(manifest.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={manifest.status === "paid" ? "default" : "outline"}
                      className={cn(
                        manifest.status === "paid" && "bg-success text-success-foreground"
                      )}
                    >
                      {manifest.status === "paid" ? "Pago" : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePrint(manifest)}>
                          <Printer className="h-4 w-4 mr-2" />
                          Reimprimir Romaneio
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleResendToDriver(manifest)}>
                          <Send className="h-4 w-4 mr-2" />
                          Reenviar para Motorista
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteClick(manifest)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir Romaneio
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

      {/* Print Preview Dialog */}
      <ManifestPrintPreview
        open={isPrintPreviewOpen}
        onOpenChange={setIsPrintPreviewOpen}
        manifest={selectedManifest}
        deliveries={selectedManifest ? getManifestDeliveries(selectedManifest) : []}
      />

      {/* Delete Manifest Dialog */}
      <DeleteManifestDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        manifest={manifestToDelete}
        onConfirm={handleConfirmDelete}
        canDelete={deleteCanProceed}
        blockReason={deleteBlockReason}
        completedCount={deleteCompletedCount}
      />
    </div>
  );
}
