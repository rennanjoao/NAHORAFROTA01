import { useState, useEffect } from "react";
import { getOccurrenceLabel } from "@/hooks/useSLADB";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/patterns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  Truck,
  Package,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Printer,
  Clock,
  MapPin,
  History,
  Flag,
  Loader2,
  MessageCircle,
  Phone,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";
import { DBInvoice } from "@/hooks/useInvoicesDB";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ManifestPrintPreview } from "./ManifestPrintPreview";
import { DeliveryProofViewer } from "./DeliveryProofViewer";
import { whatsappUrl } from "@/lib/whatsapp";
import { recalculateManifestTotals } from "@/lib/manifestTotals";
import { DeliveryStatusBadge, ManifestStatusBadge, getDeliveryStatus, vehicleTypeLabel } from "./status";

interface ManifestDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifest: DBManifest | null;
  onRefresh: () => void;
}

interface ManifestInvoice extends DBInvoice {
  delivered_at: string | null;
}

const OCCURRENCE_TYPES = [
  { value: "ausente", label: "Cliente ausente" },
  { value: "recusado", label: "Recusado pelo cliente" },
  { value: "endereco_nao_localizado", label: "Endereço não localizado" },
  { value: "avaria", label: "Mercadoria avariada" },
  { value: "extravio", label: "Mercadoria extraviada" },
  { value: "area_risco", label: "Área de risco" },
  { value: "fora_horario", label: "Fora do horário" },
  { value: "outro", label: "Outro" },
];

export function ManifestDetailSheet({
  open,
  onOpenChange,
  manifest,
  onRefresh,
}: ManifestDetailSheetProps) {
  const [invoices, setInvoices] = useState<ManifestInvoice[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Dialogs state
  const [deliveryDialog, setDeliveryDialog] = useState<{
    open: boolean;
    invoice: ManifestInvoice | null;
  }>({ open: false, invoice: null });
  const [receiverName, setReceiverName] = useState("");
  const [receiverDocument, setReceiverDocument] = useState("");
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  const [occurrenceDialog, setOccurrenceDialog] = useState<{
    open: boolean;
    invoice: ManifestInvoice | null;
  }>({ open: false, invoice: null });
  const [occurrenceType, setOccurrenceType] = useState("");
  const [occurrenceNotes, setOccurrenceNotes] = useState("");
  const [occurrenceError, setOccurrenceError] = useState<string | null>(null);

  // Remove invoice dialog state
  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean;
    invoice: ManifestInvoice | null;
  }>({ open: false, invoice: null });
  const [removeReason, setRemoveReason] = useState("");

  const [finalizeDialog, setFinalizeDialog] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  // Status atual do romaneio (o recebido por props e uma foto de quando a lista carregou;
  // ele pode ter sido finalizado sozinho depois da ultima entrega).
  const [currentStatus, setCurrentStatus] = useState<DBManifest["status"] | null>(null);

  // Proof viewer state
  const [proofViewerInvoice, setProofViewerInvoice] = useState<ManifestInvoice | null>(null);

  // Fetch invoices for this manifest
  useEffect(() => {
    if (open && manifest) {
      fetchInvoices();
      fetchAuditLogs();
    }
  }, [open, manifest?.id]);

  const fetchInvoices = async () => {
    if (!manifest) return;
    setIsLoading(true);

    const [{ data, error }, { data: freshManifest }] = await Promise.all([
      supabase.from("invoices").select("*").eq("manifest_id", manifest.id),
      supabase.from("manifests").select("status").eq("id", manifest.id).maybeSingle(),
    ]);
    setCurrentStatus((freshManifest?.status as DBManifest["status"] | undefined) ?? manifest.status);

    if (error) {
      console.error("Error fetching invoices:", error);
    } else {
      // Ordem das paradas da roteirizacao, depois destinatario.
      const ordered = [...((data as ManifestInvoice[]) || [])].sort(
        (a, b) =>
          ((a as { route_sequence?: number | null }).route_sequence ?? Number.MAX_SAFE_INTEGER) -
            ((b as { route_sequence?: number | null }).route_sequence ?? Number.MAX_SAFE_INTEGER) ||
          (a.recipient_name || "").localeCompare(b.recipient_name || "", "pt-BR"),
      );
      setInvoices(ordered);
    }
    setIsLoading(false);
  };

  const fetchAuditLogs = async () => {
    if (!manifest) return;

    const { data, error } = await supabase
      .from("manifest_audit_logs")
      .select("*")
      .eq("manifest_id", manifest.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setAuditLogs(data);
    }
  };

  // Get current user's full name from profiles
  const getCurrentUserFullName = async (): Promise<string> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) return "Sistema";

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userData.user.id)
        .single();

      return profile?.name || userData.user.email?.split("@")[0] || "Sistema";
    } catch {
      return "Sistema";
    }
  };

  const logAudit = async (
    actionType: string,
    invoiceId: string | null,
    details: any,
    notes?: string
  ) => {
    if (!manifest) return;

    const { data: userData } = await supabase.auth.getUser();
    const userFullName = await getCurrentUserFullName();
    const manifestDisplayNumber = formatManifestNumber(manifest);

    await supabase.from("manifest_audit_logs").insert({
      manifest_id: manifest.id,
      action_type: actionType,
      invoice_id: invoiceId,
      performed_by: userData.user?.id || null,
      performed_by_name: userFullName,
      user_full_name: userFullName,
      details: {
        ...details,
        manifest_number: manifestDisplayNumber,
      },
      notes: notes ? `${userFullName} ${notes}` : `${userFullName} realizou ação: ${actionType}`,
    });
  };

  // Confirm delivery
  const handleConfirmDelivery = async () => {
    if (!deliveryDialog.invoice || !receiverName.trim()) {
      setDeliveryError("Informe quem recebeu.");
      return;
    }

    const invoice = deliveryDialog.invoice;

    const { error } = await supabase
      .from("invoices")
      .update({
        status: "delivered",
        receiver_name: receiverName.trim(),
        receiver_document: receiverDocument.trim() || null,
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (error) {
      toast({
        title: "Não foi possível confirmar a entrega",
        description: "Confira a internet e tente de novo.",
        variant: "destructive",
      });
      return;
    }

    await logAudit(
      "delivery_confirmed",
      invoice.id,
      { receiver_name: receiverName, receiver_document: receiverDocument },
      `NF ${invoice.nfe_number} entregue para ${receiverName}`
    );

    toast({
      title: "Entrega confirmada",
      description: `NF ${invoice.nfe_number} marcada como entregue.`,
    });

    setDeliveryDialog({ open: false, invoice: null });
    setReceiverName("");
    setReceiverDocument("");
    fetchInvoices();
    fetchAuditLogs();
  };

  // Register occurrence
  const handleRegisterOccurrence = async () => {
    if (!occurrenceDialog.invoice || !occurrenceType) {
      setOccurrenceError("Escolha o que aconteceu.");
      return;
    }

    const invoice = occurrenceDialog.invoice;
    const occurrenceLabel = OCCURRENCE_TYPES.find(t => t.value === occurrenceType)?.label || occurrenceType;

    const { error } = await supabase
      .from("invoices")
      .update({
        status: "occurrence",
        occurrence_type: occurrenceType,
        observation: occurrenceNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (error) {
      toast({
        title: "Não foi possível registrar a ocorrência",
        description: "Confira a internet e tente de novo.",
        variant: "destructive",
      });
      return;
    }

    await logAudit(
      "occurrence_registered",
      invoice.id,
      { 
        occurrence_type: occurrenceType,
        occurrence_label: occurrenceLabel,
        nfe_number: invoice.nfe_number,
        observation: occurrenceNotes || null,
      },
      `registrou ocorrência na NF ${invoice.nfe_number} - Tipo: ${occurrenceLabel}${occurrenceNotes ? ` - Obs: ${occurrenceNotes}` : ''}`
    );

    toast({
      title: "Ocorrência registrada",
      description: `NF ${invoice.nfe_number} marcada com ocorrência.`,
    });

    setOccurrenceDialog({ open: false, invoice: null });
    setOccurrenceType("");
    setOccurrenceNotes("");
    fetchInvoices();
    fetchAuditLogs();
  };

  // Open remove dialog with reason field
  const handleRemoveInvoice = (invoice: ManifestInvoice) => {
    setRemoveDialog({ open: true, invoice });
    setRemoveReason("");
  };

  // Execute removal with reason and audit log
  const executeRemoveInvoice = async () => {
    if (!removeDialog.invoice || !manifest) return;
    
    const invoice = removeDialog.invoice;
    const reason = removeReason.trim() || "Remoção manual do romaneio";
    const userFullName = await getCurrentUserFullName();
    const { data: userData } = await supabase.auth.getUser();
    const manifestDisplayNumber = formatManifestNumber(manifest);

    const { error } = await supabase
      .from("invoices")
      .update({
        manifest_id: null,
        driver_id: null,
        status: "pending",
        route_sequence: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (error) {
      toast({
        title: "Não foi possível remover a nota",
        description: "Confira a internet e tente de novo.",
        variant: "destructive",
      });
      return;
    }

    // Update manifest totals
    await updateManifestTotals();

    // Create audit log with reason
    await supabase.from("manifest_audit_logs").insert({
      manifest_id: manifest.id,
      invoice_id: invoice.id,
      action_type: "invoice_removed",
      performed_by: userData.user?.id || null,
      performed_by_name: userFullName,
      user_full_name: userFullName,
      notes: `${userFullName} retirou a NF ${invoice.nfe_number} do Romaneio nº ${manifestDisplayNumber} - Motivo: ${reason}`,
      details: {
        nfe_number: invoice.nfe_number,
        invoice_value: invoice.total_value,
        manifest_number: manifestDisplayNumber,
        removal_reason: reason,
      },
    });

    toast({
      title: "NF removida",
      description: `NF ${invoice.nfe_number} removida do romaneio.`,
    });

    setRemoveDialog({ open: false, invoice: null });
    setRemoveReason("");
    fetchInvoices();
    fetchAuditLogs();
    onRefresh();
  };

  // Update manifest totals
  const updateManifestTotals = async () => {
    if (!manifest) return;
    await recalculateManifestTotals(manifest.id);
  };

  // Finalize manifest
  const handleFinalizeManifest = async () => {
    if (!manifest) return;

    // Check for invoices with occurrences
    const occurrenceInvoices = invoices.filter(
      (inv) => inv.status === "occurrence"
    );

    if (occurrenceInvoices.length > 0) {
      // Show warning first
      setFinalizeDialog(true);
      return;
    }

    await executeFinalization();
  };

  const executeFinalization = async () => {
    if (!manifest || isFinalizing) return;
    setIsFinalizing(true);
    try {
      const { data, error } = await supabase.rpc("finalize_manifest", { p_manifest_id: manifest.id });
      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        already_completed?: boolean;
        delivered_count?: number;
        returned_count?: number;
      } | null;

      if (!result?.success) {
        toast({
          title: "Não foi possível finalizar",
          description: result?.error || "Tente novamente.",
          variant: "destructive",
        });
        await fetchInvoices();
        return;
      }

      if (result.already_completed) {
        toast({ title: "Romaneio já finalizado", description: "Ele foi concluído automaticamente ou por outro usuário." });
      } else {
        const delivered = result.delivered_count ?? 0;
        const returned = result.returned_count ?? 0;
        await logAudit(
          "finalized",
          null,
          { delivered_count: delivered, occurrence_count: returned },
          `Romaneio finalizado - ${delivered} entregas, ${returned} ocorrências`
        );
        toast({
          title: "Romaneio finalizado",
          description: `${delivered} entrega(s) concluída(s); ${returned} nota(s) voltaram para a fila de romaneio.`,
          variant: "success",
        });
      }

      setFinalizeDialog(false);
      onRefresh();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erro ao finalizar",
        description: err instanceof Error ? err.message : "Não foi possível finalizar o romaneio.",
        variant: "destructive",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  // Stats
  const stats = {
    total: invoices.length,
    delivered: invoices.filter((inv) => inv.status === "delivered").length,
    occurrence: invoices.filter((inv) => inv.status === "occurrence").length,
    inTransit: invoices.filter((inv) => inv.status === "in_transit").length,
    totalValue: invoices.reduce((sum, inv) => sum + (inv.total_value || 0), 0),
    totalWeight: invoices.reduce(
      (sum, inv) => sum + (inv.total_weight || 0),
      0
    ),
  };

  if (!manifest) return null;

  const status = currentStatus ?? manifest.status;
  const canFinalize = !["completed", "paid", "cancelled"].includes(status);
  const createdAt = new Date(manifest.created_at);

  const closeDeliveryDialog = () => {
    setDeliveryDialog({ open: false, invoice: null });
    setDeliveryError(null);
  };
  const closeOccurrenceDialog = () => {
    setOccurrenceDialog({ open: false, invoice: null });
    setOccurrenceError(null);
  };
  const closeRemoveDialog = () => {
    setRemoveDialog({ open: false, invoice: null });
    setRemoveReason("");
  };

  const statTiles = [
    { label: "Notas", value: String(stats.total), tone: "text-foreground" },
    { label: "Entregues", value: String(stats.delivered), tone: "text-success" },
    { label: "Ocorrências", value: String(stats.occurrence), tone: stats.occurrence > 0 ? "text-destructive" : "text-foreground" },
    { label: "Valor", value: formatCurrency(stats.totalValue), tone: "text-foreground" },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {/* Cabecalho */}
          <div className="space-y-4 border-b px-6 pb-5 pt-6">
            <SheetHeader className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="font-data text-xl">Romaneio {formatManifestNumber(manifest)}</SheetTitle>
                <ManifestStatusBadge status={status} live />
              </div>
              <SheetDescription>
                <span className="font-data">{manifest.manifest_code}</span> · criado em {createdAt.toLocaleDateString("pt-BR")} às{" "}
                {createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="inline-flex min-w-0 items-center gap-2 rounded-full border bg-card px-3 py-1.5">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate font-medium text-foreground">{manifest.driver_name}</span>
                {manifest.driver_cpf && <span className="font-data text-xs text-muted-foreground">{manifest.driver_cpf}</span>}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5">
                <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="font-medium text-foreground">{vehicleTypeLabel(manifest.vehicle_type)}</span>
                <span className="font-data text-xs text-muted-foreground">{manifest.vehicle_plate || "sem placa"}</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setIsPrintOpen(true)} className="flex-1 sm:flex-none">
                <Printer aria-hidden="true" />
                Imprimir romaneio
              </Button>
              {canFinalize && (
                <Button onClick={handleFinalizeManifest} disabled={isFinalizing} className="flex-1 sm:flex-none">
                  {isFinalizing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Flag aria-hidden="true" />}
                  Finalizar romaneio
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-6 p-6">
              <dl className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
                {statTiles.map((tile) => (
                  <div key={tile.label} className="rounded-lg border bg-card p-3 shadow-xs">
                    <dt className="text-xs font-medium text-muted-foreground">{tile.label}</dt>
                    <dd className={cn("mt-1 break-words font-data text-xl font-semibold", tile.tone)}>{tile.value}</dd>
                  </div>
                ))}
              </dl>

              {/* Notas do romaneio */}
              <section aria-labelledby="manifest-invoices-title" className="space-y-3">
                <h3 id="manifest-invoices-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Paradas, na ordem da rota
                </h3>

                {isLoading && invoices.length === 0 ? (
                  <div className="space-y-3" role="status" aria-label="Carregando notas">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                ) : invoices.length === 0 ? (
                  <EmptyState compact icon={Package} title="Nenhuma nota neste romaneio" className="rounded-lg border border-dashed" />
                ) : (
                  <ol className="space-y-3">
                    {invoices.map((invoice, index) => {
                      // Telefone formatado e link do WhatsApp
                      const rawPhone = invoice.recipient_phone?.replace(/\D/g, '') || '';
                      const hasPhone = rawPhone.length >= 10;
                      const formattedPhone = hasPhone
                        ? rawPhone.length === 11
                          ? `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 7)}-${rawPhone.slice(7)}`
                          : `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 6)}-${rawPhone.slice(6)}`
                        : null;
                      const whatsappLink = hasPhone ? whatsappUrl(rawPhone) : null;
                      const tone = getDeliveryStatus(invoice.status).tone;

                      return (
                        <li
                          key={invoice.id}
                          className={cn(
                            "rounded-lg border bg-card p-4 shadow-xs",
                            tone === "danger" && "shadow-[inset_3px_0_0_hsl(var(--destructive))]",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              aria-hidden="true"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted font-data text-xs font-bold text-foreground"
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-data font-semibold text-foreground">
                                  <span className="sr-only">Parada {index + 1}: </span>NF {invoice.nfe_number}
                                </span>
                                <DeliveryStatusBadge status={invoice.status} />
                                <span className="ml-auto font-data text-sm font-semibold text-foreground">{formatCurrency(invoice.total_value)}</span>
                              </div>
                              <p className="text-sm font-medium text-foreground">{invoice.recipient_name}</p>
                              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="break-words">{invoice.address_full || invoice.address_city}</span>
                              </p>

                              {invoice.arrived_at && (
                                <p className="flex items-center gap-1.5 text-xs font-medium text-info">
                                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  Motorista chegou às{" "}
                                  {new Date(invoice.arrived_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                  {invoice.arrival_distance_m != null && ` (a ${Math.round(Number(invoice.arrival_distance_m))} m)`}
                                </p>
                              )}

                              {hasPhone && (
                                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span className="font-data">{formattedPhone}</span>
                                  <a
                                    href={whatsappLink!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-success transition-colors hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                    WhatsApp
                                    <span className="sr-only">de {invoice.recipient_name} (abre em nova aba)</span>
                                  </a>
                                </p>
                              )}

                              {invoice.status === "delivered" && invoice.receiver_name && (
                                <p className="flex items-center gap-1.5 text-sm text-success">
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Recebido por <span className="font-medium">{invoice.receiver_name}</span>
                                </p>
                              )}

                              {invoice.status === "occurrence" && invoice.occurrence_type && (
                                <p className="flex items-center gap-1.5 text-sm text-destructive">
                                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                  {OCCURRENCE_TYPES.find(t => t.value === invoice.occurrence_type)?.label || getOccurrenceLabel(invoice.occurrence_type)}
                                </p>
                              )}

                              {(invoice.status === "delivered" || invoice.status === "occurrence" || invoice.status === "in_transit") && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                  {(invoice.status === "delivered" || invoice.status === "occurrence") && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setProofViewerInvoice(invoice)}
                                      aria-label={`Ver comprovante da NF ${invoice.nfe_number}`}
                                    >
                                      <Eye aria-hidden="true" />
                                      Ver comprovante
                                    </Button>
                                  )}
                                  {invoice.status === "in_transit" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="soft"
                                        onClick={() => setDeliveryDialog({ open: true, invoice })}
                                        aria-label={`Confirmar entrega da NF ${invoice.nfe_number}`}
                                      >
                                        <CheckCircle2 aria-hidden="true" />
                                        Entregue
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setOccurrenceDialog({ open: true, invoice })}
                                        aria-label={`Registrar ocorrência na NF ${invoice.nfe_number}`}
                                      >
                                        <AlertTriangle aria-hidden="true" />
                                        Ocorrência
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRemoveInvoice(invoice)}
                                        aria-label={`Remover a NF ${invoice.nfe_number} do romaneio`}
                                        className="text-muted-foreground"
                                      >
                                        <Minus aria-hidden="true" />
                                        Remover
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              {/* Historico */}
              {auditLogs.length > 0 && (
                <section aria-labelledby="manifest-history-title" className="space-y-3">
                  <h3 id="manifest-history-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Histórico de alterações
                  </h3>
                  <ol className="space-y-2">
                    {auditLogs.map((log) => (
                      <li key={log.id} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Clock className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">{log.performed_by_name || "Sistema"}</p>
                          <p className="break-words text-xs text-muted-foreground">
                            <span className="font-data">{new Date(log.created_at).toLocaleString("pt-BR")}</span> · {log.notes || log.action_type}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Confirmar entrega */}
      <Dialog open={deliveryDialog.open} onOpenChange={(isOpen) => (isOpen ? setDeliveryDialog((prev) => ({ ...prev, open: true })) : closeDeliveryDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar entrega da NF {deliveryDialog.invoice?.nfe_number}</DialogTitle>
            <DialogDescription>{deliveryDialog.invoice?.recipient_name}. Informe quem recebeu a mercadoria.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="receiver_name">Nome de quem recebeu</Label>
              <Input
                id="receiver_name"
                value={receiverName}
                onChange={(e) => {
                  setReceiverName(e.target.value);
                  setDeliveryError(null);
                }}
                placeholder="Nome completo"
                autoComplete="off"
                aria-invalid={!!deliveryError || undefined}
                aria-describedby={deliveryError ? "receiver_name-error" : undefined}
              />
              {deliveryError && (
                <p id="receiver_name-error" className="text-sm font-medium text-destructive">
                  {deliveryError}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receiver_document">Documento (RG ou CPF, opcional)</Label>
              <Input
                id="receiver_document"
                value={receiverDocument}
                onChange={(e) => setReceiverDocument(e.target.value)}
                placeholder="Número do documento"
                autoComplete="off"
                className="font-data"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeliveryDialog}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmDelivery}>
              <CheckCircle2 aria-hidden="true" />
              Confirmar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar ocorrencia */}
      <Dialog open={occurrenceDialog.open} onOpenChange={(isOpen) => (isOpen ? setOccurrenceDialog((prev) => ({ ...prev, open: true })) : closeOccurrenceDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar ocorrência na NF {occurrenceDialog.invoice?.nfe_number}</DialogTitle>
            <DialogDescription>{occurrenceDialog.invoice?.recipient_name}. Conte o que impediu a entrega.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="manifest-occurrence-type">O que aconteceu</Label>
              <Select
                value={occurrenceType}
                onValueChange={(value) => {
                  setOccurrenceType(value);
                  setOccurrenceError(null);
                }}
              >
                <SelectTrigger
                  id="manifest-occurrence-type"
                  aria-invalid={!!occurrenceError || undefined}
                  aria-describedby={occurrenceError ? "manifest-occurrence-error" : undefined}
                  className={occurrenceError ? "border-destructive" : undefined}
                >
                  <SelectValue placeholder="Escolher o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {OCCURRENCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {occurrenceError && (
                <p id="manifest-occurrence-error" className="text-sm font-medium text-destructive">
                  {occurrenceError}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="occurrence_notes">Detalhes (opcional)</Label>
              <Textarea
                id="occurrence_notes"
                value={occurrenceNotes}
                onChange={(e) => setOccurrenceNotes(e.target.value)}
                placeholder="Ex.: Portão fechado, ninguém atendeu."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeOccurrenceDialog}>
              Cancelar
            </Button>
            <Button onClick={handleRegisterOccurrence}>
              <AlertTriangle aria-hidden="true" />
              Registrar ocorrência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aviso antes de finalizar com ocorrencias */}
      <AlertDialog open={finalizeDialog} onOpenChange={setFinalizeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar romaneio com ocorrências?</AlertDialogTitle>
            <AlertDialogDescription>
              Este romaneio tem {stats.occurrence} nota(s) com ocorrência. Elas ficam como devolvidas e voltam para a fila
              de romaneio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert variant="warning">
            <AlertTriangle aria-hidden="true" />
            <AlertDescription className="text-foreground">
              <span className="font-semibold">Confira antes:</span> a mercadoria dessas notas já voltou para o galpão?
            </AlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeFinalization}>
              Sim, finalizar romaneio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remover nota do romaneio (com motivo) */}
      <Dialog open={removeDialog.open} onOpenChange={(isOpen) => { if (!isOpen) closeRemoveDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tirar a NF {removeDialog.invoice?.nfe_number} do romaneio?</DialogTitle>
            <DialogDescription>
              {removeDialog.invoice?.recipient_name}. A nota volta para pendente e a mudança fica no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="remove_reason">Motivo (opcional)</Label>
            <Textarea
              id="remove_reason"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="Ex.: Não coube no veículo, mercadoria avariada."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRemoveDialog}>
              Cancelar
            </Button>
            <Button onClick={executeRemoveInvoice} variant="destructive">
              <Minus aria-hidden="true" />
              Remover do romaneio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Preview */}
      <ManifestPrintPreview
        open={isPrintOpen}
        onOpenChange={setIsPrintOpen}
        manifest={null}
        deliveries={[]}
        dbManifest={manifest}
      />

      {/* Delivery Proof Viewer */}
      {proofViewerInvoice && (
        <DeliveryProofViewer
          open={!!proofViewerInvoice}
          onOpenChange={(open) => !open && setProofViewerInvoice(null)}
          invoiceId={proofViewerInvoice.id}
          nfeNumber={proofViewerInvoice.nfe_number}
          recipientName={proofViewerInvoice.recipient_name}
          status={proofViewerInvoice.status}
        />
      )}
    </>
  );
}
