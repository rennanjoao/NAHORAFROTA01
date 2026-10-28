import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { endOfDay, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useInvoicesDB } from "@/hooks/useInvoicesDB";
import { getInvoiceEventDate } from "@/lib/reportFilters";
import { useManifestsDB, DBManifest } from "@/hooks/useManifestsDB";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Package,
  Upload,
  FileText,
  Route,
  Search,
  MoreVertical,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Truck,
  Warehouse,
  Filter,
  Calendar,
  CalendarDays,
  CalendarRange,
  CalendarIcon,
  MessageSquare,
  Pencil,
  RefreshCw,
  Lock,
  History,
  Unlink,
  ClipboardList,
  Plus,
  FileUp,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FreightDialog, FreightData } from "@/components/deliveries/FreightDialog";
import { EditObservationDialog } from "@/components/deliveries/EditObservationDialog";
import { EditDeliveryDialog } from "@/components/deliveries/EditDeliveryDialog";
import { ManifestPrintPreview } from "@/components/deliveries/ManifestPrintPreview";
import { RegisterOccurrenceDialog, occurrenceTypes } from "@/components/deliveries/RegisterOccurrenceDialog";
import { RemoveFromManifestDialog } from "@/components/deliveries/RemoveFromManifestDialog";
import { AddToManifestDialog } from "@/components/deliveries/AddToManifestDialog";
import { ManifestsTabDB } from "@/components/deliveries/ManifestsTabDB";
import { DeliveryDetailSheet } from "@/components/deliveries/DeliveryDetailSheet";
import { XMLImportDialog } from "@/components/deliveries/XMLImportDialog";
import { ManifestRecord, manifestStore } from "@/stores/manifestStore";
import { formatCurrency, parseDecimalInput } from "@/lib/formatCurrency";
import { buildFullAddress } from "@/lib/nfeXmlParser";
import { RegionFilter } from "@/components/deliveries/RegionFilter";
import { calculateRegiaoLogistica, getRegionColor } from "@/lib/cepRegionMapping";
import { DeleteInvoiceDialog } from "@/components/deliveries/DeleteInvoiceDialog";
import { ConfirmDeliveryDialog } from "@/components/deliveries/ConfirmDeliveryDialog";
import { DeliveryKPICards, KPIStatusFilter } from "@/components/deliveries/DeliveryKPICards";
import { Trash2 } from "lucide-react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Histórico de romaneios anteriores
interface ManifestHistoryEntry {
  manifestId: string;
  driverName: string;
  vehicleType: string;
  date: Date;
  reason: string; // Motivo do re-romaneamento (ex: "Ocorrência - Cliente ausente")
}

interface Delivery {
  id: number;
  nfe: string;
  recipient: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  driver: string | null;
  status: "pending" | "in_transit" | "delivered" | "delayed" | "occurrence" | "returning" | "returned";
  scheduledTime: string;
  scheduledDate: Date;
  weight: string;
  value: string;
  selected?: boolean;
  observation?: string;
  manifestId?: string; // ID do romaneio se já foi romaneada
  manifestHistory?: ManifestHistoryEntry[]; // Histórico de romaneios anteriores
  occurrenceType?: string; // Tipo de ocorrência cadastrada
  lastUpdatedBy?: string; // Usuário que fez última alteração
  lastUpdatedAt?: Date; // Data/hora da última alteração
  receivedBy?: string; // Nome do recebedor
  receivedAt?: Date; // Data/hora da entrega
  receiverDocument?: string; // Documento do recebedor
  eventDate?: Date; // Entrega/ocorrencia finalizada ou importacao
  dbId?: string; // UUID da NF no banco
  manifestUuid?: string; // UUID do romaneio
  addressStreet?: string; // Logradouro sem numero (edicao)
  addressNumber?: string;
  regiao_logistica?: string;
}

// NFs ainda em operacao aparecem em qualquer periodo rapido.
const OPEN_STATUSES = new Set<string>(["pending", "in_transit", "delayed", "occurrence", "returning"]);

// Empty initial state - all data comes from database
const initialDeliveries: Delivery[] = [];

const statusConfig = {
  pending: { label: "Pendente", icon: Clock, color: "bg-slate-500 text-white", rowColor: "" },
  in_transit: { label: "Em Rota", icon: Truck, color: "bg-blue-500 text-white", rowColor: "bg-blue-50/50 dark:bg-blue-950/20" },
  delivered: { label: "Entregue", icon: CheckCircle2, color: "bg-green-500 text-white", rowColor: "bg-green-50/50 dark:bg-green-950/20" },
  delayed: { label: "Atrasado", icon: AlertTriangle, color: "bg-destructive text-destructive-foreground", rowColor: "bg-destructive/5" },
  occurrence: { label: "Ocorrência", icon: AlertTriangle, color: "bg-orange-500 text-white", rowColor: "bg-orange-50 dark:bg-orange-950/20" },
  returning: { label: "Em Devolução", icon: RotateCcw, color: "bg-purple-500 text-white", rowColor: "bg-purple-50 dark:bg-purple-950/20" },
  returned: { label: "Devolvido", icon: Warehouse, color: "bg-slate-600 text-white", rowColor: "bg-slate-100 dark:bg-slate-900/30" },
};

type TimeFilter = "daily" | "weekly" | "monthly";
type StatusFilter = "all" | Delivery["status"] | "db_pending";

export default function DeliveriesPage() {
  const { checkFeatureAccess } = useFeatureAccess();
  const batchAccess = checkFeatureAccess('batch_import');
  // Local state for mock data compatibility
  const [localDeliveries, setLocalDeliveries] = useState<Delivery[]>(initialDeliveries);
  // Selection state for DB invoices (by UUID)
  const [selectedDbIds, setSelectedDbIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isXmlDialogOpen, setIsXmlDialogOpen] = useState(false);
  const [isFreightDialogOpen, setIsFreightDialogOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily");
  const [periodFilter, setPeriodFilter] = useState<{ from?: Date; to?: Date }>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  
  // Observation dialog state
  const [isObservationDialogOpen, setIsObservationDialogOpen] = useState(false);
  const [selectedDeliveryForObservation, setSelectedDeliveryForObservation] = useState<Delivery | null>(null);
  
  // Edit delivery dialog state
  const [isEditDeliveryDialogOpen, setIsEditDeliveryDialogOpen] = useState(false);
  const [selectedDeliveryForEdit, setSelectedDeliveryForEdit] = useState<Delivery | null>(null);
  
  // Print preview state
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [manifestForPreview, setManifestForPreview] = useState<ManifestRecord | null>(null);
  const [dbManifestForPreview, setDbManifestForPreview] = useState<DBManifest | null>(null);

  // Re-route confirmation dialog state
  const [isReRouteDialogOpen, setIsReRouteDialogOpen] = useState(false);
  const [deliveryForReRoute, setDeliveryForReRoute] = useState<Delivery | null>(null);

  // Occurrence dialog state
  const [isOccurrenceDialogOpen, setIsOccurrenceDialogOpen] = useState(false);
  const [deliveryForOccurrence, setDeliveryForOccurrence] = useState<Delivery | null>(null);

  // Remove from manifest dialog state
  const [isRemoveManifestDialogOpen, setIsRemoveManifestDialogOpen] = useState(false);
  const [deliveryForRemove, setDeliveryForRemove] = useState<Delivery | null>(null);

  // Add to manifest dialog state
  const [isAddToManifestDialogOpen, setIsAddToManifestDialogOpen] = useState(false);
  const [deliveryForAddToManifest, setDeliveryForAddToManifest] = useState<Delivery | null>(null);

  // Detail sheet state
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [deliveryForDetail, setDeliveryForDetail] = useState<Delivery | null>(null);

  // Delete invoice dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deliveryForDelete, setDeliveryForDelete] = useState<Delivery | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Confirm delivery dialog state
  const [isConfirmDeliveryDialogOpen, setIsConfirmDeliveryDialogOpen] = useState(false);
  const [deliveryForConfirm, setDeliveryForConfirm] = useState<Delivery | null>(null);

  // Current user (in a real app, this would come from auth context)
  const currentUser = "Gestor";

  // Region filter state
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  // Database hooks for real persistence
  const { 
    invoices: dbInvoices, 
    removeFromManifest: dbRemoveFromManifest,
    assignToManifest: dbAssignToManifest,
    refetch: refetchInvoices,
    deleteInvoice: dbDeleteInvoice,
    updateInvoice: dbUpdateInvoice,
    updateInvoiceStatus: dbUpdateInvoiceStatus
  } = useInvoicesDB();
  const { 
    manifests: dbManifests,
    removeInvoiceFromManifest: dbRemoveInvoiceFromManifest,
    updateManifestTotals: dbUpdateManifestTotals,
    addInvoiceToManifest: dbAddInvoiceToManifest,
  } = useManifestsDB();

  // URL params for filter
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = searchParams.get('filter');
  const urlStatus = searchParams.get('status');

  // "?filter=unrouted" (atalho do dashboard): guarda o filtro na tela. Antes o
  // parametro era apagado na hora e o filtro nunca chegava a ser aplicado.
  const [unroutedOnly, setUnroutedOnly] = useState(urlFilter === 'unrouted');

  // Apply filters from URL on mount
  useEffect(() => {
    if (urlFilter === 'unrouted') {
      setUnroutedOnly(true);
      // Clear only the filter param
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('filter');
      setSearchParams(newParams, { replace: true });
    }
    if (urlStatus && ['pending', 'in_transit', 'delivered', 'occurrence', 'returned'].includes(urlStatus)) {
      setStatusFilter(urlStatus as StatusFilter);
    }
  }, [urlFilter, urlStatus]);

  // Persist status filter to URL when it changes
  const handleStatusFilterChange = (newFilter: KPIStatusFilter) => {
    setStatusFilter(newFilter as StatusFilter);
    const newParams = new URLSearchParams(searchParams);
    if (newFilter === 'all') {
      newParams.delete('status');
    } else {
      newParams.set('status', newFilter);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Id numerico estavel por NF: antes era a posicao na lista, e uma recarga em
  // segundo plano (realtime) podia fazer uma acao cair em outra NF.
  const stableIdsRef = useRef<Map<string, number>>(new Map());
  const getStableId = (dbId: string) => {
    const ids = stableIdsRef.current;
    let id = ids.get(dbId);
    if (id === undefined) {
      id = 10000 + ids.size;
      ids.set(dbId, id);
    }
    return id;
  };

  // Convert DB invoices to Delivery format for unified display
  const dbDeliveries: Delivery[] = useMemo(() => {
    return dbInvoices.map((inv, idx) => {
      // Format manifest number as "N/YYYY"
      const manifestYear = inv.manifest_created_at 
        ? new Date(inv.manifest_created_at).getFullYear() 
        : new Date().getFullYear();
      const formattedManifestNumber = inv.manifest_number 
        ? `${inv.manifest_number}/${manifestYear}` 
        : inv.manifest_id;
      
      return {
        id: getStableId(inv.id),
        dbId: inv.id, // Store actual UUID
        nfe: inv.nfe_number || inv.access_key?.slice(-8) || `DB-${idx}`,
        recipient: inv.recipient_name,
        address: inv.address_street
          ? [inv.address_street, inv.address_number].filter(Boolean).join(', ')
          : inv.address_full?.split(' - ')[0] || '',
        addressStreet: inv.address_street || '',
        addressNumber: inv.address_number || '',
        city: inv.address_city || '',
        state: inv.address_state || '',
        zipCode: inv.address_zip || '',
        phone: inv.recipient_phone || undefined,
        driver: inv.driver_name || (inv.manifest_driver_name || (inv.driver_id ? 'Atribuído' : null)),
        status: inv.status as Delivery["status"],
        scheduledTime: format(new Date(getInvoiceEventDate(inv)), "dd/MM HH:mm"),
        scheduledDate: new Date(inv.imported_at),
        weight: inv.total_weight ? `${inv.total_weight}kg` : '-',
        value: formatCurrency(inv.total_value),
        selected: selectedDbIds.has(inv.id),
        observation: inv.observation || undefined,
        manifestId: formattedManifestNumber || undefined,
        manifestUuid: inv.manifest_id || undefined, // Keep actual UUID for queries
        occurrenceType: inv.occurrence_type || undefined,
        regiao_logistica: inv.regiao_logistica || calculateRegiaoLogistica(inv.address_zip),
        lastUpdatedAt: inv.updated_at ? new Date(inv.updated_at) : undefined,
        receivedBy: inv.receiver_name || undefined,
        receivedAt: inv.delivered_at ? new Date(inv.delivered_at) : undefined,
        receiverDocument: inv.receiver_document || undefined,
        eventDate: new Date(getInvoiceEventDate(inv)),
      };
    }) as any[];
  }, [dbInvoices, selectedDbIds]);

  // Combined deliveries: DB invoices take priority
  const deliveries = useMemo(() => {
    // Always use DB data as source of truth
    return dbDeliveries;
  }, [dbDeliveries]);

  // Wrapper to maintain API compatibility
  const setDeliveries = (updater: Delivery[] | ((prev: Delivery[]) => Delivery[])) => {
    if (dbInvoices.length > 0) {
      // For DB mode, we only handle selection changes through selectedDbIds
      // Other changes should go through the DB hooks
      console.log("DB mode - use DB hooks for updates");
    } else {
      setLocalDeliveries(updater as any);
    }
  };

  const hasPeriodRange = !!periodFilter.from || !!periodFilter.to;

  // Periodo rapido (Diario/Semanal/Mensal), contado a partir de agora. Fica de
  // lado quando ha um intervalo de datas escolhido.
  const filterByTime = (delivery: Delivery) => {
    if (hasPeriodRange) return true;
    if (OPEN_STATUSES.has(delivery.status)) return true;

    const eventDate = delivery.eventDate ?? new Date(delivery.scheduledDate);
    const now = new Date();
    const since =
      timeFilter === "daily"
        ? startOfDay(now)
        : startOfDay(new Date(now.getTime() - (timeFilter === "weekly" ? 6 : 29) * 24 * 60 * 60 * 1000));
    return eventDate >= since;
  };

  const filterByPeriod = (delivery: Delivery) => {
    if (!hasPeriodRange) return true;

    const deliveryDate = delivery.eventDate ?? new Date(delivery.scheduledDate);

    if (periodFilter.from && deliveryDate < startOfDay(periodFilter.from)) {
      return false;
    }

    if (periodFilter.to && deliveryDate > endOfDay(periodFilter.to)) {
      return false;
    }

    return true;
  };

  const selectQuickPeriod = (value: TimeFilter) => {
    setTimeFilter(value);
    setPeriodFilter({});
  };

  // Filter by status
  const filterByStatus = (delivery: Delivery) => {
    if (statusFilter === "all") return true;
    return delivery.status === statusFilter;
  };

  // Filter by region
  const filterByRegion = (delivery: any) => {
    if (selectedRegions.length === 0) return true;
    const deliveryRegion = delivery.regiao_logistica || calculateRegiaoLogistica(delivery.zipCode);
    return selectedRegions.includes(deliveryRegion);
  };

  // Filter for unrouted items (from URL param)
  const filterByUnrouted = (delivery: any) => {
    if (!unroutedOnly) return true;
    // Unrouted = (pending OR returned) AND no manifest
    return (delivery.status === 'pending' || delivery.status === 'returned') && !delivery.manifestId;
  };

  const filteredDeliveries = useMemo(() => {
    return deliveries
      .filter(filterByTime)
      .filter(filterByPeriod)
      .filter(filterByStatus)
      .filter(filterByRegion)
      .filter(filterByUnrouted)
      .filter(d => 
        d.recipient.toLowerCase().includes(search.toLowerCase()) ||
        d.nfe.toLowerCase().includes(search.toLowerCase()) ||
        d.address.toLowerCase().includes(search.toLowerCase())
      );
  }, [deliveries, search, timeFilter, periodFilter, statusFilter, selectedRegions, unroutedOnly]);

  // Count only selected items that are currently visible (filtered)
  const filteredIds = useMemo(() => new Set(filteredDeliveries.map(d => d.id)), [filteredDeliveries]);
  const selectableFilteredDeliveries = useMemo(
    () => filteredDeliveries.filter((delivery) => !delivery.manifestId),
    [filteredDeliveries]
  );
  const allSelectableChecked =
    selectableFilteredDeliveries.length > 0 && selectableFilteredDeliveries.every((delivery) => delivery.selected);
  const someSelectableChecked = selectableFilteredDeliveries.some((delivery) => delivery.selected);
  const headerCheckboxState: boolean | "indeterminate" = allSelectableChecked
    ? true
    : someSelectableChecked
      ? "indeterminate"
      : false;
  const hasActiveFilters =
    statusFilter !== "all" || selectedRegions.length > 0 || !!periodFilter.from || !!periodFilter.to || unroutedOnly;

  // Stats for current filter
  const filteredStats = useMemo(() => {
    const filtered = deliveries
      .filter(filterByTime)
      .filter(filterByPeriod)
      .filter(filterByRegion)
      .filter(filterByUnrouted);
    return Object.keys(statusConfig).reduce((acc, key) => {
      acc[key as Delivery["status"]] = filtered.filter(d => d.status === key).length;
      return acc;
    }, {} as Record<Delivery["status"], number>);
  }, [deliveries, timeFilter, periodFilter, selectedRegions, unroutedOnly]);

  const pendingDeliveries = filteredStats.pending + filteredStats.in_transit;

  const handleSelectAll = (checked: boolean) => {
    if (dbInvoices.length > 0) {
      // DB mode: update selectedDbIds set
      if (checked) {
        const newSelected = new Set(selectedDbIds);
        filteredDeliveries.forEach(d => {
          if (!d.manifestId && (d as any).dbId) {
            newSelected.add((d as any).dbId);
          }
        });
        setSelectedDbIds(newSelected);
      } else {
        setSelectedDbIds(new Set());
      }
    } else {
      // Local mode: only select/deselect items that are currently visible (filtered) and NOT already romaneadas
      setLocalDeliveries(prev => prev.map(d => 
        filteredIds.has(d.id) && !d.manifestId ? { ...d, selected: checked } : d
      ));
    }
  };

  const handleSelect = (id: number, checked: boolean) => {
    const delivery = deliveries.find(d => d.id === id);
    
    // Check if this is a DB delivery
    const dbId = (delivery as any)?.dbId;
    
    if (delivery?.manifestId) {
      toast({
        title: "NF já romaneada",
        description: `Esta NF já foi incluída no romaneio ${delivery.manifestId}. Não é possível selecionar novamente.`,
        variant: "destructive",
      });
      return;
    }
    
    if (dbId) {
      // DB mode
      setSelectedDbIds(prev => {
        const newSet = new Set(prev);
        if (checked) {
          newSet.add(dbId);
        } else {
          newSet.delete(dbId);
        }
        return newSet;
      });
    } else {
      // Local mode
      setLocalDeliveries(prev => prev.map(d => d.id === id ? { ...d, selected: checked } : d));
    }
  };

  // Count selected items correctly for both modes - only count NFs without manifest
  const selectedCount = useMemo(() => {
    if (dbInvoices.length > 0) {
      // Count only selected IDs that don't have a manifest yet
      return Array.from(selectedDbIds).filter(id => {
        const inv = dbInvoices.find(i => i.id === id);
        return inv && !inv.manifest_id && (inv.status === 'pending' || inv.status === 'returned');
      }).length;
    }
    return localDeliveries.filter(d => d.selected && filteredIds.has(d.id)).length;
  }, [dbInvoices, selectedDbIds, localDeliveries, filteredIds]);

  const selectedDeletableDbIds = useMemo(() => {
    if (dbInvoices.length === 0) return [];

    return Array.from(selectedDbIds).filter(id => {
      const inv = dbInvoices.find(i => i.id === id);
      return inv && !inv.manifest_id;
    });
  }, [dbInvoices, selectedDbIds]);

  const handleGenerateRomaneio = () => {
    if (selectedCount === 0) {
      toast({
        title: "Nenhuma entrega selecionada",
        description: "Selecione pelo menos uma entrega para gerar o romaneio.",
        variant: "destructive",
      });
      return;
    }
    // Open freight dialog instead of generating directly
    setIsFreightDialogOpen(true);
  };

  const handleOpenBulkDelete = () => {
    if (selectedDeletableDbIds.length === 0) {
      toast({
        title: "Nenhuma NF elegível",
        description: "Selecione NFs sem romaneio para excluir.",
        variant: "destructive",
      });
      return;
    }

    setIsBulkDeleteDialogOpen(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedDeletableDbIds.length === 0) {
      setIsBulkDeleteDialogOpen(false);
      return;
    }

    setIsBulkDeleting(true);

    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .in("id", selectedDeletableDbIds);

      if (error) throw error;

      setSelectedDbIds((prev) => {
        const next = new Set(prev);
        selectedDeletableDbIds.forEach((id) => next.delete(id));
        return next;
      });

      await refetchInvoices();

      toast({
        title: "NFs excluídas",
        description: `${selectedDeletableDbIds.length} nota(s) fiscal(is) excluída(s) com sucesso.`,
      });

      setIsBulkDeleteDialogOpen(false);
    } catch (error: any) {
      console.error("Error bulk deleting invoices:", error);
      toast({
        title: "Erro ao excluir NFs",
        description: error.message || "Não foi possível excluir as notas selecionadas.",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleFreightConfirm = (freightData: FreightData, manifest: ManifestRecord, dbManifest?: DBManifest | null) => {
    // Guarda o romaneio criado; a impressao abre pelo botao do dialogo de sucesso
    // (antes abria junto e ficava por cima dele).
    setManifestForPreview(manifest);
    setDbManifestForPreview(dbManifest || null);
    
    // Clear selections
    if (dbInvoices.length > 0) {
      setSelectedDbIds(new Set());
    } else {
      setLocalDeliveries(prev => prev.map(d => {
        if (d.selected) {
          return { 
            ...d, 
            selected: false, 
            status: "in_transit" as const,
            driver: freightData.driver?.name || null,
            manifestId: manifest.id,
          };
        }
        return d;
      }));
    }

    // Refetch DB invoices to sync state after manifest creation
    refetchInvoices();
  };

  // Handler to open re-route confirmation dialog
  const handleOpenReRoute = (delivery: Delivery) => {
    setDeliveryForReRoute(delivery);
    setIsReRouteDialogOpen(true);
  };

  // Volta a NF para pendente, fora do romaneio, para poder ser romaneada de novo.
  const handleConfirmReRoute = async () => {
    if (!deliveryForReRoute) return;

    const statusReasons: Record<string, string> = {
      occurrence: "Ocorrência registrada",
      returning: "Em processo de devolução",
      returned: "Devolvido ao estoque",
    };
    const reason = statusReasons[deliveryForReRoute.status] || "Re-romaneamento solicitado";
    const dbId = deliveryForReRoute.dbId;
    const manifestUuid = deliveryForReRoute.manifestUuid;

    if (!dbId || !manifestUuid) {
      toast({ title: "NF sem romaneio", description: "Esta NF já está disponível para romaneamento.", variant: "destructive" });
      setIsReRouteDialogOpen(false);
      setDeliveryForReRoute(null);
      return;
    }

    const success = await dbRemoveInvoiceFromManifest(manifestUuid, dbId, `Voltar para romaneamento: ${reason}`);
    if (!success) return;

    await refetchInvoices();
    toast({
      title: "✅ NF liberada para romaneamento",
      description: `NF ${deliveryForReRoute.nfe} pode ser romaneada novamente.`,
    });

    setIsReRouteDialogOpen(false);
    setDeliveryForReRoute(null);
  };

  // Check if delivery can be re-routed (has occurrence-related status)
  const canReRoute = (delivery: Delivery) => {
    return delivery.manifestId && ["occurrence", "returning", "returned"].includes(delivery.status);
  };

  // Check if delivery can be removed from manifest (is in manifest but not yet delivered)
  const canRemoveFromManifest = (delivery: Delivery) => {
    return delivery.manifestId && !["delivered", "returned"].includes(delivery.status);
  };

  // Handler to open occurrence dialog
  const handleOpenOccurrence = (delivery: Delivery) => {
    setDeliveryForOccurrence(delivery);
    setIsOccurrenceDialogOpen(true);
  };

  // Handler to save occurrence - persists to database with audit log
  const handleSaveOccurrence = async (deliveryId: number, occurrenceType: string, observation: string) => {
    const occurrenceLabel = occurrenceTypes.find(t => t.value === occurrenceType)?.label || occurrenceType;
    
    // Find the DB invoice by the delivery ID (which is offset by 10000)
    const delivery = deliveries.find(d => d.id === deliveryId);
    const dbId = (delivery as any)?.dbId;
    
    if (dbId) {
      // Persist to database
      await dbUpdateInvoiceStatus(dbId, "occurrence", occurrenceType, observation);
      
      // Create audit log for the occurrence if invoice is linked to a manifest
      const invoice = dbInvoices.find(inv => inv.id === dbId);
      if (invoice?.manifest_id) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", userData.user?.id || "")
            .single();
          
          const userFullName = profile?.name || userData.user?.email?.split("@")[0] || "Sistema";
          
          await supabase.from("manifest_audit_logs").insert({
            manifest_id: invoice.manifest_id,
            invoice_id: dbId,
            action_type: "occurrence_registered",
            performed_by: userData.user?.id || null,
            performed_by_name: userFullName,
            user_full_name: userFullName,
            notes: `${userFullName} registrou ocorrência na NF ${invoice.nfe_number} - Tipo: ${occurrenceLabel}${observation ? ` - Obs: ${observation}` : ''}`,
            details: {
              nfe_number: invoice.nfe_number,
              occurrence_type: occurrenceType,
              occurrence_label: occurrenceLabel,
              observation: observation || null,
            },
          });
        } catch (error) {
          console.error("Error creating occurrence audit log:", error);
        }
      }
      
      // Refetch to update the UI
      refetchInvoices();
    }
    
    setDeliveryForOccurrence(null);
  };

  // Handler to open remove from manifest dialog
  const handleOpenRemoveManifest = (delivery: Delivery) => {
    setDeliveryForRemove(delivery);
    setIsRemoveManifestDialogOpen(true);
  };

  // Handler to confirm removal from manifest
  const handleConfirmRemoveManifest = async (reason: string) => {
    if (!deliveryForRemove) return;

    const dbId = deliveryForRemove.dbId;
    const manifestUuid = deliveryForRemove.manifestUuid;
    if (!dbId || !manifestUuid) {
      toast({ title: "NF sem romaneio", description: "Esta NF não está em nenhum romaneio.", variant: "destructive" });
      return;
    }

    const success = await dbRemoveInvoiceFromManifest(manifestUuid, dbId, reason);
    if (!success) return;

    await refetchInvoices();
    setIsRemoveManifestDialogOpen(false);
    setDeliveryForRemove(null);
  };

  // Add to existing manifest handlers
  const handleOpenAddToManifest = (delivery: Delivery) => {
    setDeliveryForAddToManifest(delivery);
    setIsAddToManifestDialogOpen(true);
  };

  const handleConfirmAddToManifest = async (manifestId: string, action: "print" | "resend" | "none") => {
    if (!deliveryForAddToManifest) return;
    
    // Get the database UUID from the delivery
    const dbId = (deliveryForAddToManifest as any)?.dbId;
    if (!dbId) {
      toast({
        title: "Erro",
        description: "ID da nota fiscal não encontrado.",
        variant: "destructive",
      });
      return;
    }

    // Use the database function to add the invoice with audit logging (user name fetched inside)
    const success = await dbAddInvoiceToManifest(manifestId, dbId);
    
    if (!success) {
      return; // Toast already shown by the hook
    }
    
    // Find the updated manifest for actions
    const manifest = dbManifests.find(m => m.id === manifestId);
    
    // Handle action
    if (action === "print" && manifest) {
      setDbManifestForPreview(manifest);
      setIsPrintPreviewOpen(true);
    } else if (action === "resend" && manifest) {
      toast({
        title: "✅ Romaneio atualizado no app",
        description: `A NF já aparece na lista de entregas de ${manifest.driver_name} no app do motorista.`,
      });
    }

    await refetchInvoices();
    setIsAddToManifestDialogOpen(false);
    setDeliveryForAddToManifest(null);
  };

  // Handler to open delivery detail sheet
  const handleOpenDetail = (delivery: Delivery) => {
    setDeliveryForDetail(delivery);
    setIsDetailSheetOpen(true);
  };

  // Handler to open delete confirmation dialog
  const handleOpenDeleteInvoice = (delivery: Delivery) => {
    setDeliveryForDelete(delivery);
    setIsDeleteDialogOpen(true);
  };

  // Handler to confirm deletion
  const handleConfirmDeleteInvoice = async () => {
    if (!deliveryForDelete) return;
    
    const dbId = (deliveryForDelete as any)?.dbId;
    if (!dbId) {
      toast({
        title: "Erro",
        description: "ID da nota fiscal não encontrado.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      if (await dbDeleteInvoice(dbId)) {
        setSelectedDbIds((prev) => {
          const next = new Set(prev);
          next.delete(dbId);
          return next;
        });
        setIsDeleteDialogOpen(false);
        setDeliveryForDelete(null);
      }
    } catch (error) {
      console.error("Error deleting invoice:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler to open confirm delivery dialog
  const handleOpenConfirmDelivery = (delivery: Delivery) => {
    setDeliveryForConfirm(delivery);
    setIsConfirmDeliveryDialogOpen(true);
  };

  // Handler to confirm manual delivery with receiver data
  const handleConfirmDelivery = async (receiverName: string, receiverDocument: string) => {
    if (!deliveryForConfirm) return;
    
    const dbId = (deliveryForConfirm as any)?.dbId;
    if (!dbId) {
      toast({
        title: "Erro",
        description: "ID da nota fiscal não encontrado.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get current user info for audit
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userData.user?.id || "")
        .single();
      
      const userFullName = profile?.name || userData.user?.email?.split("@")[0] || "Sistema";

      // Update invoice status to delivered with receiver info
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          status: "delivered",
          occurrence_type: null,
          receiver_name: receiverName,
          receiver_document: receiverDocument,
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updated_by: userData.user?.id || null,
        })
        .eq("id", dbId);

      if (updateError) throw updateError;

      // Get invoice info for audit log
      const invoice = dbInvoices.find(inv => inv.id === dbId);
      
      // Create audit log if invoice is linked to a manifest
      if (invoice?.manifest_id) {
        await supabase.from("manifest_audit_logs").insert({
          manifest_id: invoice.manifest_id,
          invoice_id: dbId,
          action_type: "manual_delivery",
          performed_by: userData.user?.id || null,
          performed_by_name: userFullName,
          user_full_name: userFullName,
          notes: `${userFullName} realizou baixa manual da NF ${invoice.nfe_number || deliveryForConfirm.nfe} - Recebedor: ${receiverName} (Doc: ${receiverDocument})`,
          details: {
            nfe_number: invoice.nfe_number,
            receiver_name: receiverName,
            receiver_document: receiverDocument,
            delivered_at: new Date().toISOString(),
          },
        });
      }

      toast({
        title: "✅ Entrega Confirmada",
        description: `NF ${deliveryForConfirm.nfe} marcada como entregue.`,
      });

      // Refetch to update UI
      refetchInvoices();
      
      setIsConfirmDeliveryDialogOpen(false);
      setDeliveryForConfirm(null);
    } catch (error: any) {
      console.error("Error confirming delivery:", error);
      toast({
        title: "Erro ao confirmar entrega",
        description: error.message || "Ocorreu um erro ao salvar a baixa.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleOpenObservation = (delivery: Delivery) => {
    setSelectedDeliveryForObservation(delivery);
    setIsObservationDialogOpen(true);
  };

  const handleSaveObservation = async (deliveryId: number, observation: string): Promise<boolean> => {
    const dbId = deliveries.find((d) => d.id === deliveryId)?.dbId;
    if (!dbId) return false;
    const success = await dbUpdateInvoice(dbId, { observation: observation.trim() || null }, { silent: true });
    if (success) await refetchInvoices();
    return success;
  };

  const handleOpenEditDelivery = (delivery: Delivery) => {
    setSelectedDeliveryForEdit(delivery);
    setIsEditDeliveryDialogOpen(true);
  };

  const handleSaveDelivery = async (updatedDelivery: Delivery) => {
    const dbId = updatedDelivery.dbId;
    if (!dbId) throw new Error("ID da nota fiscal não encontrado.");

    const original = deliveries.find((d) => d.dbId === dbId);
    const invoice = dbInvoices.find((inv) => inv.id === dbId);

    const invoiceUpdates: Record<string, any> = {
      nfe_number: updatedDelivery.nfe,
      recipient_name: updatedDelivery.recipient,
      recipient_phone: updatedDelivery.phone || null,
      address_city: updatedDelivery.city,
      address_state: updatedDelivery.state,
      address_zip: updatedDelivery.zipCode,
      observation: updatedDelivery.observation || null,
      status: updatedDelivery.status,
      updated_at: new Date().toISOString(),
    };

    const weight = parseDecimalInput(updatedDelivery.weight);
    if (updatedDelivery.weight !== original?.weight && weight !== null) invoiceUpdates.total_weight = weight;
    const value = parseDecimalInput(updatedDelivery.value);
    if (updatedDelivery.value !== original?.value && value !== null) invoiceUpdates.total_value = value;

    // Endereco exibido = "logradouro, numero"; so regrava (e pede nova geolocalizacao)
    // quando algo do endereco mudou.
    const addressChanged =
      updatedDelivery.address !== original?.address ||
      updatedDelivery.city !== original?.city ||
      updatedDelivery.state !== original?.state ||
      updatedDelivery.zipCode !== original?.zipCode;
    if (addressChanged) {
      let street = updatedDelivery.address.trim();
      let number = "";
      if (updatedDelivery.address === original?.address) {
        street = original?.addressStreet || street;
        number = original?.addressNumber || "";
      } else {
        const match = street.match(/^(.*),\s*([^,]{1,10})$/);
        if (match && /\d|s\/?n/i.test(match[2])) {
          street = match[1].trim();
          number = match[2].trim();
        }
      }
      invoiceUpdates.address_street = street;
      invoiceUpdates.address_number = number || null;
      invoiceUpdates.address_full = buildFullAddress(
        street,
        number,
        invoice?.address_neighborhood || "",
        updatedDelivery.city,
        updatedDelivery.state,
        updatedDelivery.zipCode,
      );
      invoiceUpdates.latitude = null;
      invoiceUpdates.longitude = null;
    }

    if (updatedDelivery.status === "delivered") {
      invoiceUpdates.receiver_name = (updatedDelivery as any).receiverName || updatedDelivery.receivedBy || null;
      invoiceUpdates.receiver_document = (updatedDelivery as any).receiverDocument || updatedDelivery.receiverDocument || null;
      invoiceUpdates.delivered_at =
        ((updatedDelivery as any).deliveredAt as Date | undefined)?.toISOString() ||
        updatedDelivery.receivedAt?.toISOString() ||
        new Date().toISOString();
      invoiceUpdates.occurrence_type = null;
    } else if (updatedDelivery.status === "returned") {
      invoiceUpdates.occurrence_type = null;
      invoiceUpdates.receiver_name = null;
      invoiceUpdates.receiver_document = null;
      invoiceUpdates.delivered_at = null;
    }

    const { error } = await supabase
      .from("invoices")
      .update(invoiceUpdates)
      .eq("id", dbId);

    if (error) throw error;

    if (invoice?.manifest_id && ("total_weight" in invoiceUpdates || "total_value" in invoiceUpdates)) {
      await dbUpdateManifestTotals(invoice.manifest_id);
    }

    await refetchInvoices();
  };

  // Mercadoria voltou ao galpao: fica "Devolvido" no romaneio (historico) e pode
  // ser liberada para outro romaneio em "Voltar para romaneamento".
  const handleConfirmReturn = async (id: number) => {
    const delivery = deliveries.find((d) => d.id === id);
    if (!delivery?.dbId) return;

    const success = await dbUpdateInvoiceStatus(delivery.dbId, "returned");
    if (!success) return;

    if (delivery.manifestUuid) {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userData.user?.id || "")
        .maybeSingle();
      const userFullName = profile?.name || userData.user?.email?.split("@")[0] || "Sistema";
      const { error: auditError } = await supabase.from("manifest_audit_logs").insert({
        manifest_id: delivery.manifestUuid,
        invoice_id: delivery.dbId,
        action_type: "returned_to_warehouse",
        performed_by: userData.user?.id || null,
        performed_by_name: userFullName,
        user_full_name: userFullName,
        notes: `${userFullName} confirmou o retorno ao galpão da NF ${delivery.nfe}`,
        details: { nfe_number: delivery.nfe },
      });
      if (auditError) console.error("Error creating return audit log:", auditError);
    }

    await refetchInvoices();
    toast({
      title: "✅ Retorno Confirmado",
      description: `NF ${delivery.nfe} marcada como devolvida ao galpão.`,
    });
  };

  const timeFilterOptions = [
    { value: "daily", label: "Diario", icon: Calendar },
    { value: "weekly", label: "Semanal", icon: CalendarDays },
    { value: "monthly", label: "Mensal", icon: CalendarRange },
  ];

  const timeFilterLabels: Record<TimeFilter, string> = {
    daily: "Diario",
    weekly: "Semanal",
    monthly: "Mensal",
  };
  const periodLabel = "Periodo:";
  const startLabel = "Inicio";
  const endLabel = "Fim";
  const untilLabel = "ate";
  const clearPeriodLabel = "Limpar periodo";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-7 w-7 text-primary" />
              Entregas
            </h1>
            <p className="text-muted-foreground">{pendingDeliveries} entregas em andamento</p>
          </div>
        </div>

        {/* Main Tabs - NFs and Romaneios */}
        <Tabs defaultValue="nfs" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="nfs" className="gap-2">
              <FileText className="h-4 w-4" />
              Notas Fiscais
            </TabsTrigger>
            <TabsTrigger value="romaneios" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Romaneios
            </TabsTrigger>
          </TabsList>

          {/* NFs Tab Content */}
          <TabsContent value="nfs" className="space-y-6">
            {/* Period filters must always be visible, regardless of role or plan */}
            <div className="flex flex-wrap items-center gap-4">
              <span className="mr-2 whitespace-nowrap text-sm text-muted-foreground">{periodLabel}</span>
              <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
                {timeFilterOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => selectQuickPeriod(option.value as TimeFilter)}
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                        timeFilter === option.value && !hasPeriodRange
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {timeFilterLabels[option.value as TimeFilter]}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[140px] justify-start whitespace-nowrap text-left font-normal",
                        !periodFilter.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodFilter.from ? format(periodFilter.from, "dd/MM/yy", { locale: ptBR }) : startLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={periodFilter.from}
                      onSelect={(date) => setPeriodFilter((prev) => ({ ...prev, from: date }))}
                      disabled={(date) => date > new Date() || (periodFilter.to ? date > periodFilter.to : false)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <span className="whitespace-nowrap text-sm text-muted-foreground">{untilLabel}</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[140px] justify-start whitespace-nowrap text-left font-normal",
                        !periodFilter.to && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodFilter.to ? format(periodFilter.to, "dd/MM/yy", { locale: ptBR }) : endLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={periodFilter.to}
                      onSelect={(date) => setPeriodFilter((prev) => ({ ...prev, to: date }))}
                      disabled={(date) => date > new Date() || (periodFilter.from ? date < periodFilter.from : false)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                {(periodFilter.from || periodFilter.to) && (
                  <Button variant="ghost" size="sm" className="whitespace-nowrap" onClick={() => setPeriodFilter({})}>
                    {clearPeriodLabel}
                  </Button>
                )}
              </div>

              <RegionFilter
                selectedRegions={selectedRegions}
                onRegionsChange={setSelectedRegions}
              />
            </div>

            {/* Import and Generate Buttons */}
            <div className="flex gap-3 justify-end">
              {batchAccess.allowed ? (
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => setIsXmlDialogOpen(true)}
                >
                  <FileUp className="h-4 w-4" />
                  Importar XML/NF-e
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" className="gap-2 opacity-50 cursor-not-allowed" disabled>
                      <Lock className="h-4 w-4" />
                      Importar XML/NF-e
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Importação em Lote disponível no Plano {batchAccess.upgradePlanLabel}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Button 
                className="gap-2" 
                disabled={selectedCount === 0}
                onClick={handleGenerateRomaneio}
              >
                <Route className="h-4 w-4" />
                Gerar Romaneio Roteirizado
                {selectedCount > 0 && <Badge variant="secondary" className="ml-1">{selectedCount}</Badge>}
              </Button>
            </div>

            {/* XML Import Dialog */}
            <XMLImportDialog
              open={isXmlDialogOpen}
              onOpenChange={setIsXmlDialogOpen}
              onImportComplete={(imported, duplicates) => {
                toast({
                  title: "Importação concluída",
                  description: `${imported} NFs importadas, ${duplicates} ignoradas por duplicidade.`,
                });
                void refetchInvoices();
              }}
            />

        {false && (
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-muted-foreground mr-2">Período:</span>
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
            {timeFilterOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => selectQuickPeriod(option.value as TimeFilter)}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    timeFilter === option.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {timeFilterLabels[option.value as TimeFilter]}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-[140px] justify-start whitespace-nowrap text-left font-normal",
                    !periodFilter.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {periodFilter.from ? format(periodFilter.from, "dd/MM/yy", { locale: ptBR }) : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <CalendarComponent
                  mode="single"
                  selected={periodFilter.from}
                  onSelect={(date) => setPeriodFilter((prev) => ({ ...prev, from: date }))}
                  disabled={(date) => date > new Date() || (periodFilter.to ? date > periodFilter.to : false)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <span className="text-sm text-muted-foreground">até</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-[140px] justify-start whitespace-nowrap text-left font-normal",
                    !periodFilter.to && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {periodFilter.to ? format(periodFilter.to, "dd/MM/yy", { locale: ptBR }) : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <CalendarComponent
                  mode="single"
                  selected={periodFilter.to}
                  onSelect={(date) => setPeriodFilter((prev) => ({ ...prev, to: date }))}
                  disabled={(date) => date > new Date() || (periodFilter.from ? date < periodFilter.from : false)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {(periodFilter.from || periodFilter.to) && (
              <Button variant="ghost" size="sm" onClick={() => setPeriodFilter({})}>
                Limpar período
              </Button>
            )}
          </div>

          {/* Region Filter */}
          <RegionFilter
            selectedRegions={selectedRegions}
            onRegionsChange={setSelectedRegions}
          />
        </div>
        )}

        {/* KPI Cards - Filtros Rápidos */}
        <DeliveryKPICards
          stats={{
            pending: filteredStats.pending || 0,
            in_transit: filteredStats.in_transit || 0,
            delivered: filteredStats.delivered || 0,
            occurrence: filteredStats.occurrence || 0,
            returned: filteredStats.returned || 0,
          }}
          activeFilter={statusFilter as KPIStatusFilter}
          onFilterChange={handleStatusFilterChange}
        />

        {/* Active Filter Indicator */}
        {(statusFilter !== "all" || selectedRegions.length > 0 || periodFilter.from || periodFilter.to || unroutedOnly) && (
          <div className="flex items-center gap-2 flex-wrap">
            {unroutedOnly && (
              <Badge variant="secondary" className="gap-1">
                Só não roteirizadas
                <button onClick={() => setUnroutedOnly(false)} className="ml-1 hover:text-destructive" aria-label="Remover filtro">
                  ✕
                </button>
              </Badge>
            )}
            {statusFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Status: {statusConfig[statusFilter as keyof typeof statusConfig]?.label || statusFilter}
                <button 
                  onClick={() => handleStatusFilterChange("all")}
                  className="ml-1 hover:text-destructive"
                >
                  ✕
                </button>
              </Badge>
            )}
            {(periodFilter.from || periodFilter.to) && (
              <Badge variant="secondary" className="gap-1">
                Período: {periodFilter.from ? format(periodFilter.from, "dd/MM/yyyy", { locale: ptBR }) : "..."} até{" "}
                {periodFilter.to ? format(periodFilter.to, "dd/MM/yyyy", { locale: ptBR }) : "..."}
                <button
                  onClick={() => setPeriodFilter({})}
                  className="ml-1 hover:text-destructive"
                >
                  ✕
                </button>
              </Badge>
            )}
            {selectedRegions.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-sm text-muted-foreground">Regiões:</span>
                {selectedRegions.slice(0, 3).map(region => (
                  <Badge key={region} variant="outline" className="gap-1 text-xs">
                    <div className={cn("w-2 h-2 rounded-full", getRegionColor(region))} />
                    {region.replace('Interior - ', '').replace('GSP - ', '').replace('SP - ', '')}
                    <button 
                      onClick={() => setSelectedRegions(selectedRegions.filter(r => r !== region))}
                      className="ml-1 hover:text-destructive"
                    >
                      ✕
                    </button>
                  </Badge>
                ))}
                {selectedRegions.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{selectedRegions.length - 3}
                  </Badge>
                )}
                <button 
                  onClick={() => setSelectedRegions([])}
                  className="text-xs text-muted-foreground hover:text-destructive ml-1"
                >
                  Limpar regiões
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por NF, destinatário ou endereço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Popover open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "shrink-0",
                  hasActiveFilters && "border-primary bg-primary/5 text-primary"
                )}
                aria-label="Abrir filtros de periodo"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(92vw,720px)] p-4">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Filtrar entregas</h3>
                    <p className="text-xs text-muted-foreground">
                      Escolha um período específico para atualizar a lista.
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPeriodFilter({});
                        setSelectedRegions([]);
                        handleStatusFilterChange("all");
                      }}
                    >
                      Limpar
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Período rápido:</span>
                  {timeFilterOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = timeFilter === option.value && !hasPeriodRange;
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        className="gap-2"
                        onClick={() => selectQuickPeriod(option.value as TimeFilter)}
                      >
                        <Icon className="h-4 w-4" />
                        {timeFilterLabels[option.value as TimeFilter]}
                      </Button>
                    );
                  })}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Data inicial</div>
                    <div className="rounded-md border">
                      <CalendarComponent
                        mode="single"
                        selected={periodFilter.from}
                        onSelect={(date) => setPeriodFilter((prev) => ({ ...prev, from: date }))}
                        disabled={(date) => date > new Date() || (periodFilter.to ? date > periodFilter.to : false)}
                        className="p-3 pointer-events-auto"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Data final</div>
                    <div className="rounded-md border">
                      <CalendarComponent
                        mode="single"
                        selected={periodFilter.to}
                        onSelect={(date) => setPeriodFilter((prev) => ({ ...prev, to: date }))}
                        disabled={(date) => date > new Date() || (periodFilter.from ? date < periodFilter.from : false)}
                        className="p-3 pointer-events-auto"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {periodFilter.from ? format(periodFilter.from, "dd/MM/yyyy", { locale: ptBR }) : "Sem data inicial"}
                  </span>
                  <span>{untilLabel}</span>
                  <span>
                    {periodFilter.to ? format(periodFilter.to, "dd/MM/yyyy", { locale: ptBR }) : "Sem data final"}
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="ml-auto">
            <Button
              variant="destructive"
              className="gap-2"
              disabled={selectedDeletableDbIds.length === 0}
              onClick={handleOpenBulkDelete}
            >
              <Trash2 className="h-4 w-4" />
              Excluir Selecionadas
              {selectedDeletableDbIds.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedDeletableDbIds.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={headerCheckboxState}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    aria-label="Selecionar todas as entregas visiveis"
                    className="border-primary/60 data-[state=checked]:border-primary"
                  />
                </TableHead>
                <TableHead>NF-e</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead title="Entrega/ocorrência ou, se ainda aberta, a importação">Data/Hora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nenhuma entrega encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeliveries.map((delivery) => {
                  const config = statusConfig[delivery.status];
                  const Icon = config.icon;
                  return (
                    <TableRow key={delivery.id} className={cn(config.rowColor, delivery.manifestId && "opacity-75")}>
                      <TableCell>
                        {delivery.manifestId ? (
                          <div className="flex items-center gap-1" title={`Romaneio: ${delivery.manifestId}`}>
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ) : (
                          <Checkbox 
                            checked={delivery.selected || false}
                            onCheckedChange={(checked) => handleSelect(delivery.id, !!checked)}
                            aria-label={`Selecionar NF ${delivery.nfe}`}
                            className="border-primary/60 data-[state=checked]:border-primary"
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {delivery.nfe}
                          {delivery.manifestId && (
                            <Badge variant="outline" className="text-xs">
                              Romaneada
                            </Badge>
                          )}
                          {delivery.manifestHistory && delivery.manifestHistory.length > 0 && (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <History className="h-4 w-4 text-amber-500" />
                                </Button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80" align="start">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <History className="h-4 w-4 text-primary" />
                                    <span className="font-semibold text-sm">Histórico de Romaneios</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {delivery.manifestHistory.length}x
                                    </Badge>
                                  </div>
                                  <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {delivery.manifestHistory.map((entry, idx) => (
                                      <div 
                                        key={idx} 
                                        className="p-2 rounded-lg bg-muted/50 border text-xs space-y-1"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono font-medium">{entry.manifestId}</span>
                                          <span className="text-muted-foreground">
                                            {entry.date.toLocaleDateString('pt-BR', {
                                              day: '2-digit',
                                              month: '2-digit',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                          <Truck className="h-3 w-3" />
                                          {entry.driverName}
                                        </div>
                                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                          <AlertTriangle className="h-3 w-3" />
                                          {entry.reason}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{delivery.recipient}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {delivery.address}
                      </TableCell>
                      <TableCell>{delivery.driver || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{delivery.scheduledTime}</TableCell>
                      <TableCell>
                        <Badge className={cn("gap-1", config.color)}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleOpenEditDelivery(delivery)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar Entrega
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenDetail(delivery)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenObservation(delivery)}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Editar/Observação
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            {/* Adicionar a Romaneio Existente - para pendentes sem romaneio */}
                            {delivery.status === "pending" && !delivery.manifestId && (
                              <DropdownMenuItem 
                                onClick={() => handleOpenAddToManifest(delivery)} 
                                className="text-primary"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar a Romaneio Existente
                              </DropdownMenuItem>
                            )}
                            
                            {/* Registrar Ocorrência - para pendentes ou em rota */}
                            {(delivery.status === "pending" || delivery.status === "in_transit") && (
                              <DropdownMenuItem 
                                onClick={() => handleOpenOccurrence(delivery)} 
                                className="text-orange-600"
                              >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Registrar Ocorrência
                              </DropdownMenuItem>
                            )}
                            
                            {/* Confirmar Entrega - baixa manual para NFs em rota */}
                            {delivery.status === "in_transit" && (delivery as any).dbId && (
                              <DropdownMenuItem 
                                onClick={() => handleOpenConfirmDelivery(delivery)} 
                                className="text-green-600"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Confirmar Entrega
                              </DropdownMenuItem>
                            )}
                            
                            {/* Confirmar retorno ao galpão */}
                            {delivery.status === "returning" && (
                              <DropdownMenuItem onClick={() => handleConfirmReturn(delivery.id)}>
                                <Warehouse className="h-4 w-4 mr-2" />
                                Confirmar Retorno ao Galpão
                              </DropdownMenuItem>
                            )}
                            
                            {/* Remover do Romaneio - para NFs que ainda podem ser removidas */}
                            {canRemoveFromManifest(delivery) && (
                              <DropdownMenuItem 
                                onClick={() => handleOpenRemoveManifest(delivery)} 
                                className="text-destructive"
                              >
                                <Unlink className="h-4 w-4 mr-2" />
                                Remover do Romaneio
                              </DropdownMenuItem>
                            )}
                            
                            {/* Voltar para romaneamento - para NFs com ocorrência que já retornaram */}
                            {canReRoute(delivery) && (
                              <DropdownMenuItem onClick={() => handleOpenReRoute(delivery)} className="text-primary">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Voltar para Romaneamento
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />
                            
                            {/* Excluir NF - apenas para notas do banco de dados */}
                            {(delivery as any).dbId && (
                              <DropdownMenuItem 
                                onClick={() => handleOpenDeleteInvoice(delivery)} 
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir Nota Fiscal
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
          </TabsContent>

          {/* Romaneios Tab Content */}
          <TabsContent value="romaneios">
            <ManifestsTabDB />
          </TabsContent>
        </Tabs>
      </div>

      {/* Freight Dialog */}
      <FreightDialog
        open={isFreightDialogOpen}
        onOpenChange={setIsFreightDialogOpen}
        onPrint={() => setIsPrintPreviewOpen(true)}
        selectedCount={selectedCount}
        selectedDeliveryIds={
          dbInvoices.length > 0 
            ? Array.from(selectedDbIds).map((_, i) => i + 1)
            : localDeliveries.filter(d => d.selected && filteredIds.has(d.id)).map(d => d.id)
        }
        dbInvoiceIds={
          // CRITICAL: Only pass IDs of invoices that don't have a manifest yet
          dbInvoices.length > 0
            ? Array.from(selectedDbIds).filter(id => {
                const inv = dbInvoices.find(i => i.id === id);
                return inv && !inv.manifest_id && (inv.status === 'pending' || inv.status === 'returned');
              })
            : []
        }
        onConfirm={handleFreightConfirm}
      />

      {/* Observation Dialog */}
      <EditObservationDialog
        open={isObservationDialogOpen}
        onOpenChange={setIsObservationDialogOpen}
        deliveryId={selectedDeliveryForObservation?.id || 0}
        deliveryNfe={selectedDeliveryForObservation?.nfe || ""}
        currentObservation={selectedDeliveryForObservation?.observation}
        onSave={handleSaveObservation}
      />

      {/* Print Preview */}
      <ManifestPrintPreview
        open={isPrintPreviewOpen}
        onOpenChange={setIsPrintPreviewOpen}
        manifest={manifestForPreview}
        deliveries={[]}
        dbManifest={dbManifestForPreview}
      />

      {/* Edit Delivery Dialog */}
      <EditDeliveryDialog
        delivery={selectedDeliveryForEdit}
        open={isEditDeliveryDialogOpen}
        onOpenChange={setIsEditDeliveryDialogOpen}
        onSave={handleSaveDelivery}
      />

      {/* Re-Route Confirmation Dialog */}
      <AlertDialog open={isReRouteDialogOpen} onOpenChange={setIsReRouteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Voltar para Romaneamento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              <span className="block mb-4">
                Você está prestes a liberar a <strong>NF {deliveryForReRoute?.nfe}</strong> para ser romaneada novamente.
              </span>
              <span className="block p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200">
                <strong className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Atenção!
                </strong>
                Você já conferiu se essa mercadoria chegou na empresa?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReRoute}>
              Sim, já conferi. Liberar NF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Register Occurrence Dialog */}
      <RegisterOccurrenceDialog
        open={isOccurrenceDialogOpen}
        onOpenChange={setIsOccurrenceDialogOpen}
        deliveryNfe={deliveryForOccurrence?.nfe || ""}
        deliveryId={deliveryForOccurrence?.id || 0}
        onSave={handleSaveOccurrence}
        currentUser={currentUser}
      />

      {/* Remove from Manifest Dialog */}
      <RemoveFromManifestDialog
        open={isRemoveManifestDialogOpen}
        onOpenChange={setIsRemoveManifestDialogOpen}
        deliveryNfe={deliveryForRemove?.nfe || ""}
        manifestId={deliveryForRemove?.manifestId}
        onConfirm={handleConfirmRemoveManifest}
      />

      {/* Add to Manifest Dialog */}
      <AddToManifestDialog
        open={isAddToManifestDialogOpen}
        onOpenChange={setIsAddToManifestDialogOpen}
        deliveryNfe={deliveryForAddToManifest?.nfe || ""}
        invoiceId={(deliveryForAddToManifest as any)?.dbId || ""}
        manifests={dbManifests}
        onConfirm={handleConfirmAddToManifest}
      />

      {/* Delivery Detail Sheet */}
      <DeliveryDetailSheet
        delivery={deliveryForDetail}
        open={isDetailSheetOpen}
        onOpenChange={setIsDetailSheetOpen}
        onAddressUpdated={async () => {
          await refetchInvoices();
          setDeliveryForDetail(null);
          setIsDetailSheetOpen(false);
        }}
      />

      {/* Delete Invoice Dialog */}
      <DeleteInvoiceDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        invoiceNfe={deliveryForDelete?.nfe || ""}
        isLinkedToManifest={!!deliveryForDelete?.manifestId}
        onConfirm={handleConfirmDeleteInvoice}
        isDeleting={isDeleting}
      />

      {/* Confirm Delivery Dialog */}
      <ConfirmDeliveryDialog
        open={isConfirmDeliveryDialogOpen}
        onOpenChange={setIsConfirmDeliveryDialogOpen}
        nfeNumber={deliveryForConfirm?.nfe || ""}
        recipientName={deliveryForConfirm?.recipient || ""}
        onConfirm={handleConfirmDelivery}
      />

      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir notas fiscais selecionadas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá {selectedDeletableDbIds.length} NF(s) selecionada(s) que ainda não estão em romaneio.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? "Excluindo..." : "Excluir selecionadas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

