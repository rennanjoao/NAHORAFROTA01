import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useUrlSearchTerm } from "@/hooks/useUrlSearchTerm";
import { useQueryAction } from "@/hooks/useQueryAction";
import { useIsMobile } from "@/hooks/use-mobile";
import { endOfDay, format, startOfDay } from "date-fns";
import { useInvoicesDB } from "@/hooks/useInvoicesDB";
import { getInvoiceEventDate } from "@/lib/reportFilters";
import { useManifestsDB, DBManifest } from "@/hooks/useManifestsDB";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CardsSkeleton,
  ConfirmDialog,
  EmptyState,
  ListSkeleton,
  PageHeader,
} from "@/components/patterns";
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  FileUp,
  Lock,
  Package,
  Route,
  SearchX,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
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
import { DeleteInvoiceDialog } from "@/components/deliveries/DeleteInvoiceDialog";
import { ConfirmDeliveryDialog } from "@/components/deliveries/ConfirmDeliveryDialog";
import { DeliveryKPICards, KPIStatusFilter } from "@/components/deliveries/DeliveryKPICards";
import { DeliveriesToolbar, ActiveFilterChips, describePeriod, type FilterChip } from "@/components/deliveries/DeliveriesToolbar";
import { InvoiceList } from "@/components/deliveries/InvoiceList";
import { SelectionBar } from "@/components/deliveries/SelectionBar";
import { DELIVERY_STATUS } from "@/components/deliveries/status";
import type { Delivery, InvoiceActionHandlers, TimeFilter } from "@/components/deliveries/types";
import { ManifestRecord } from "@/stores/manifestStore";
import { formatCurrency, parseDecimalInput } from "@/lib/formatCurrency";
import { buildFullAddress } from "@/lib/nfeXmlParser";
import { calculateRegiaoLogistica } from "@/lib/cepRegionMapping";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

// NFs ainda em operacao aparecem em qualquer periodo rapido.
const OPEN_STATUSES = new Set<string>(["pending", "in_transit", "delayed", "occurrence", "returning"]);

// Empty initial state - all data comes from database
const initialDeliveries: Delivery[] = [];

type StatusFilter = "all" | Delivery["status"] | "db_pending";
type DeliveriesTab = "nfs" | "romaneios";

export default function DeliveriesPage() {
  const { checkFeatureAccess, isLoading: isPlanLoading } = useFeatureAccess();
  const batchAccess = checkFeatureAccess('batch_import');
  const isMobile = useIsMobile();
  // Local state for mock data compatibility
  const [localDeliveries, setLocalDeliveries] = useState<Delivery[]>(initialDeliveries);
  // Selection state for DB invoices (by UUID)
  const [selectedDbIds, setSelectedDbIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  // URL params for filter
  const [searchParams, setSearchParams] = useSearchParams();
  // "?tab=romaneios" abre direto na aba de romaneios (busca, alertas, links).
  const [activeTab, setActiveTab] = useState<DeliveriesTab>(searchParams.get("tab") === "romaneios" ? "romaneios" : "nfs");
  const [manifestSearch, setManifestSearch] = useState<{ term: string; nonce: number } | null>(null);
  const [isXmlDialogOpen, setIsXmlDialogOpen] = useState(false);
  const [isFreightDialogOpen, setIsFreightDialogOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily");
  const [periodFilter, setPeriodFilter] = useState<{ from?: Date; to?: Date }>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
  const [isReRouting, setIsReRouting] = useState(false);

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
    isLoading: isLoadingInvoices,
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

  const urlFilter = searchParams.get('filter');

  // Busca geral do topo: "?q=" (e "?tab=romaneios" para romaneio).
  useUrlSearchTerm((term, params) => {
    if (params.get("tab") === "romaneios") {
      setActiveTab("romaneios");
      setManifestSearch({ term, nonce: Date.now() });
    } else {
      setActiveTab("nfs");
      setStatusFilter("all");
      setSearch(term);
    }
  }, ["tab"]);
  const urlStatus = searchParams.get('status');

  // Busca (Ctrl K) > "Importar notas": abre a importacao de XML.
  useQueryAction(
    "import",
    () => {
      setActiveTab("nfs");
      if (batchAccess.allowed) {
        setIsXmlDialogOpen(true);
      } else {
        toast({
          title: "Importação de notas indisponível no seu plano",
          description: `A importação em lote faz parte do plano ${batchAccess.upgradePlanLabel}.`,
        });
      }
    },
    !isPlanLoading,
  );

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

  // Link com "?tab=romaneios" com a tela ja aberta (alertas, busca).
  const urlTab = searchParams.get("tab");
  useEffect(() => {
    if (urlTab === "romaneios") setActiveTab("romaneios");
  }, [urlTab]);

  // Aba atual fica na URL ("?tab=romaneios"): recarregar ou voltar mantem a aba.
  const handleTabChange = (value: string) => {
    const tab = value as DeliveriesTab;
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    if (tab === "romaneios") newParams.set("tab", "romaneios");
    else newParams.delete("tab");
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
        weight: inv.total_weight ? `${String(inv.total_weight).replace(".", ",")} kg` : '-',
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

  const hasPeriodRange = !!periodFilter.from || !!periodFilter.to;

  // Periodo rapido (Diario/Semanal/Mensal), contado a partir de agora. Fica de
  // lado quando ha um intervalo de datas escolhido.
  const filterByTime = (delivery: Delivery) => {
    // Com busca digitada procura em todos os periodos (NF antiga nao sumia sem aviso).
    if (hasPeriodRange || search.trim()) return true;
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
    return Object.keys(DELIVERY_STATUS).reduce((acc, key) => {
      acc[key as Delivery["status"]] = filtered.filter(d => d.status === key).length;
      return acc;
    }, {} as Record<Delivery["status"], number>);
  }, [deliveries, timeFilter, periodFilter, selectedRegions, unroutedOnly]);

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
        title: "Nenhuma nota selecionada",
        description: "Marque as notas na lista e depois toque em Gerar romaneio.",
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
        title: "Nenhuma nota para excluir",
        description: "Só dá para excluir notas que ainda não estão em romaneio.",
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
        title: "Notas excluídas",
        description: `${selectedDeletableDbIds.length} nota(s) fiscal(is) excluída(s).`,
      });

      setIsBulkDeleteDialogOpen(false);
    } catch (error: any) {
      console.error("Error bulk deleting invoices:", error);
      toast({
        title: "Não foi possível excluir as notas",
        description: error.message || "Tente de novo em instantes.",
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

    if (!dbId) {
      setIsReRouteDialogOpen(false);
      setDeliveryForReRoute(null);
      return;
    }

    // Fora de romaneio: so volta o status para pendente. Em romaneio: sai dele tambem.
    const success = manifestUuid
      ? await dbRemoveInvoiceFromManifest(manifestUuid, dbId, `Voltar para romaneamento: ${reason}`)
      : await dbUpdateInvoice(dbId, { status: "pending" }, { silent: true });
    if (!success) return;

    await refetchInvoices();
    toast({
      title: "NF liberada para romaneamento",
      description: `NF ${deliveryForReRoute.nfe} pode ser romaneada novamente.`,
    });

    setIsReRouteDialogOpen(false);
    setDeliveryForReRoute(null);
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
        title: "Romaneio atualizado no app",
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
        title: "Entrega Confirmada",
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
      title: "Retorno Confirmado",
      description: `NF ${delivery.nfe} marcada como devolvida ao galpão.`,
    });
  };

  // Acoes do menu de cada nota (tabela e cartoes).
  const invoiceActions: InvoiceActionHandlers = {
    onEdit: handleOpenEditDelivery,
    onDetail: handleOpenDetail,
    onObservation: handleOpenObservation,
    onAddToManifest: handleOpenAddToManifest,
    onOccurrence: handleOpenOccurrence,
    onConfirmDelivery: handleOpenConfirmDelivery,
    onConfirmReturn: (delivery) => handleConfirmReturn(delivery.id),
    onRemoveFromManifest: handleOpenRemoveManifest,
    onReRoute: handleOpenReRoute,
    onDelete: handleOpenDeleteInvoice,
  };

  // Botao principal do topo: leva para a aba de notas se preciso.
  const handleHeaderGenerate = () => {
    if (activeTab !== "nfs") handleTabChange("nfs");
    handleGenerateRomaneio();
  };

  const clearAllFilters = () => {
    setPeriodFilter({});
    setSelectedRegions([]);
    setUnroutedOnly(false);
    handleStatusFilterChange("all");
  };

  const filterChips: FilterChip[] = [];
  if (unroutedOnly) {
    filterChips.push({ key: "unrouted", label: "Só notas sem romaneio", onRemove: () => setUnroutedOnly(false) });
  }
  if (statusFilter !== "all" && statusFilter !== "db_pending") {
    filterChips.push({
      key: "status",
      label: `Status: ${DELIVERY_STATUS[statusFilter]?.label || statusFilter}`,
      onRemove: () => handleStatusFilterChange("all"),
    });
  }
  if (hasPeriodRange) {
    filterChips.push({ key: "period", label: describePeriod(periodFilter), onRemove: () => setPeriodFilter({}) });
  }
  if (selectedRegions.length > 3) {
    filterChips.push({ key: "regions", label: `${selectedRegions.length} regiões`, onRemove: () => setSelectedRegions([]) });
  } else {
    selectedRegions.forEach((region) =>
      filterChips.push({
        key: `region-${region}`,
        label: region.replace("Interior - ", "").replace("GSP - ", "").replace("SP - ", ""),
        onRemove: () => setSelectedRegions(selectedRegions.filter((r) => r !== region)),
      }),
    );
  }

  const searching = !!search.trim();
  const isFirstLoad = isLoadingInvoices && deliveries.length === 0;
  const hasNoInvoices = !isLoadingInvoices && deliveries.length === 0;
  const resultLabel = filteredDeliveries.length === 1 ? "1 nota" : `${filteredDeliveries.length.toLocaleString("pt-BR")} notas`;

  const importButton = batchAccess.allowed ? (
    <Button variant="outline" onClick={() => setIsXmlDialogOpen(true)}>
      <FileUp aria-hidden="true" />
      Importar notas
    </Button>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Button variant="outline" disabled className="w-full" tabIndex={-1}>
            <Lock aria-hidden="true" />
            Importar notas
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Importação em lote disponível no plano {batchAccess.upgradePlanLabel}</TooltipContent>
    </Tooltip>
  );

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <PageHeader
          icon={Package}
          title="Entregas"
          description="Importe as notas fiscais, monte o romaneio do motorista e acompanhe cada entrega."
          actions={
            <>
              {importButton}
              <Button onClick={handleHeaderGenerate}>
                <Route aria-hidden="true" />
                Gerar romaneio
                {selectedCount > 0 && (
                  <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 font-data text-xs">
                    {selectedCount}
                    <span className="sr-only"> notas selecionadas</span>
                  </span>
                )}
              </Button>
            </>
          }
        >
          <TabsList className="grid h-12 w-full grid-cols-2 sm:inline-flex sm:h-10 sm:w-auto">
            <TabsTrigger value="nfs" className="h-10 sm:h-8 sm:px-4">
              <FileText aria-hidden="true" />
              Notas fiscais
            </TabsTrigger>
            <TabsTrigger value="romaneios" className="h-10 sm:h-8 sm:px-4">
              <ClipboardList aria-hidden="true" />
              Romaneios
            </TabsTrigger>
          </TabsList>
        </PageHeader>

        {/* Aba: notas fiscais */}
        <TabsContent value="nfs" tabIndex={-1} className="mt-0 space-y-6 focus-visible:ring-0 focus-visible:ring-offset-0">
          <h2 className="sr-only">Notas fiscais</h2>

          {isFirstLoad ? (
            <div role="status" aria-label="Carregando notas" className="space-y-6">
              <CardsSkeleton count={5} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5" />
              <ListSkeleton rows={6} />
            </div>
          ) : hasNoInvoices ? (
            <EmptyState
              icon={FileUp}
              title="Nenhuma nota ainda"
              description="Importe os arquivos XML das notas fiscais. Depois é só marcar as notas e gerar o romaneio do motorista."
              action={batchAccess.allowed ? (
                <Button onClick={() => setIsXmlDialogOpen(true)}>
                  <FileUp aria-hidden="true" />
                  Importar notas
                </Button>
              ) : importButton}
            />
          ) : (
            <>
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

              <div className="space-y-3">
                <DeliveriesToolbar
                  search={search}
                  onSearchChange={setSearch}
                  timeFilter={timeFilter}
                  periodFilter={periodFilter}
                  onQuickPeriod={selectQuickPeriod}
                  onPeriodChange={setPeriodFilter}
                  selectedRegions={selectedRegions}
                  onRegionsChange={setSelectedRegions}
                  isMobile={isMobile}
                />
                <ActiveFilterChips chips={filterChips} onClearAll={clearAllFilters} />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    <span className="font-semibold text-foreground">{resultLabel}</span>
                    {searching && !hasPeriodRange && " · buscando em todos os períodos"}
                  </p>
                  {!searching && !hasPeriodRange && (
                    <p className="text-xs text-muted-foreground">Notas ainda em aberto aparecem em qualquer período.</p>
                  )}
                </div>

                {filteredDeliveries.length === 0 ? (
                  <Card>
                    <EmptyState
                      compact
                      icon={SearchX}
                      title="Nenhuma nota encontrada"
                      description={
                        searching || hasActiveFilters
                          ? "Nada bate com a busca e os filtros escolhidos. Tente outro termo ou limpe os filtros."
                          : "Não há notas finalizadas neste período. Escolha um período maior."
                      }
                      action={
                        searching || hasActiveFilters ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSearch("");
                              clearAllFilters();
                            }}
                          >
                            Limpar busca e filtros
                          </Button>
                        ) : timeFilter !== "monthly" ? (
                          <Button variant="outline" onClick={() => selectQuickPeriod("monthly")}>
                            Ver últimos 30 dias
                          </Button>
                        ) : undefined
                      }
                    />
                  </Card>
                ) : (
                  <InvoiceList
                    deliveries={filteredDeliveries}
                    isMobile={isMobile}
                    headerCheckboxState={headerCheckboxState}
                    canSelectAny={selectableFilteredDeliveries.length > 0}
                    onSelectAll={handleSelectAll}
                    onSelect={handleSelect}
                    actions={invoiceActions}
                  />
                )}
              </div>

              <SelectionBar
                count={selectedDeletableDbIds.length}
                onGenerate={handleGenerateRomaneio}
                onDelete={handleOpenBulkDelete}
                onClear={() => setSelectedDbIds(new Set())}
              />
            </>
          )}
        </TabsContent>

        {/* Aba: romaneios */}
        <TabsContent value="romaneios" tabIndex={-1} className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
          <h2 className="sr-only">Romaneios</h2>
          <ManifestsTabDB externalSearch={manifestSearch} onCreateManifest={() => handleTabChange("nfs")} />
        </TabsContent>
      </Tabs>

      {/* XML Import Dialog */}
      <XMLImportDialog
        open={isXmlDialogOpen}
        onOpenChange={setIsXmlDialogOpen}
        onImportComplete={() => {
          // O dialogo ja avisa o resultado; aqui so atualiza a lista.
          void refetchInvoices();
        }}
      />

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

      {/* Voltar para a fila de romaneio */}
      <ConfirmDialog
        open={isReRouteDialogOpen}
        onOpenChange={setIsReRouteDialogOpen}
        title="Voltar a nota para a fila de romaneio?"
        description={
          deliveryForReRoute?.manifestId ? (
            <>
              A NF {deliveryForReRoute.nfe} sai do romaneio {deliveryForReRoute.manifestId} e volta a ficar pendente,
              pronta para entrar em outro romaneio.
            </>
          ) : (
            <>A NF {deliveryForReRoute?.nfe} volta a ficar pendente, pronta para entrar em um romaneio.</>
          )
        }
        confirmLabel="Sim, já conferi. Liberar nota"
        loading={isReRouting}
        onConfirm={async () => {
          setIsReRouting(true);
          try {
            await handleConfirmReRoute();
          } finally {
            setIsReRouting(false);
          }
        }}
      >
        <Alert variant="warning">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-foreground">
            <span className="font-semibold">Confira antes:</span> a mercadoria já voltou para a empresa?
          </AlertDescription>
        </Alert>
      </ConfirmDialog>

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
        invoiceId={deliveryForAddToManifest?.dbId || ""}
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

      {/* Excluir notas selecionadas */}
      <ConfirmDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        tone="danger"
        title={
          selectedDeletableDbIds.length === 1
            ? "Excluir 1 nota fiscal?"
            : `Excluir ${selectedDeletableDbIds.length} notas fiscais?`
        }
        description="As notas marcadas que ainda não estão em romaneio serão apagadas, com os arquivos XML. Não dá para desfazer."
        confirmLabel={isBulkDeleting ? "Excluindo…" : "Excluir notas"}
        loading={isBulkDeleting}
        onConfirm={handleConfirmBulkDelete}
      />
    </>
  );
}
