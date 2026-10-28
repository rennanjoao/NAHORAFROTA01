import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  User,
  Truck,
  Package,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  Printer,
  Clock,
  MapPin,
  DollarSign,
  Scale,
  History,
  Flag,
  MessageCircle,
  Phone,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";
import { DBInvoice } from "@/hooks/useInvoicesDB";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ManifestPrintPreview } from "./ManifestPrintPreview";
import { DeliveryProofViewer } from "./DeliveryProofViewer";

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
  { value: "ausente", label: "Cliente Ausente" },
  { value: "recusado", label: "Recusado pelo Cliente" },
  { value: "endereco_nao_localizado", label: "Endereço Não Localizado" },
  { value: "avaria", label: "Mercadoria Avariada" },
  { value: "extravio", label: "Mercadoria Extraviada" },
  { value: "area_risco", label: "Área de Risco" },
  { value: "fora_horario", label: "Fora do Horário" },
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
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({ open: false, title: "", description: "", action: async () => {} });

  const [deliveryDialog, setDeliveryDialog] = useState<{
    open: boolean;
    invoice: ManifestInvoice | null;
  }>({ open: false, invoice: null });
  const [receiverName, setReceiverName] = useState("");
  const [receiverDocument, setReceiverDocument] = useState("");

  const [occurrenceDialog, setOccurrenceDialog] = useState<{
    open: boolean;
    invoice: ManifestInvoice | null;
  }>({ open: false, invoice: null });
  const [occurrenceType, setOccurrenceType] = useState("");
  const [occurrenceNotes, setOccurrenceNotes] = useState("");

  // Remove invoice dialog state
  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean;
    invoice: ManifestInvoice | null;
  }>({ open: false, invoice: null });
  const [removeReason, setRemoveReason] = useState("");

  const [finalizeDialog, setFinalizeDialog] = useState(false);

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

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("manifest_id", manifest.id)
      .order("recipient_name", { ascending: true });

    if (error) {
      console.error("Error fetching invoices:", error);
    } else {
      setInvoices((data as ManifestInvoice[]) || []);
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
      toast({
        title: "Campos obrigatórios",
        description: "Nome do recebedor é obrigatório.",
        variant: "destructive",
      });
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
        title: "Erro",
        description: "Não foi possível confirmar a entrega.",
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
      title: "✅ Entrega confirmada",
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
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o tipo de ocorrência.",
        variant: "destructive",
      });
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
        title: "Erro",
        description: "Não foi possível registrar a ocorrência.",
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
      title: "⚠️ Ocorrência registrada",
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover a NF.",
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
      title: "✅ NF removida",
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

    const { data: remainingInvoices } = await supabase
      .from("invoices")
      .select("total_value, total_weight")
      .eq("manifest_id", manifest.id);

    const count = remainingInvoices?.length || 0;
    const totalValue =
      remainingInvoices?.reduce((sum, inv) => sum + (inv.total_value || 0), 0) ||
      0;
    const totalWeight =
      remainingInvoices?.reduce(
        (sum, inv) => sum + (inv.total_weight || 0),
        0
      ) || 0;

    await supabase
      .from("manifests")
      .update({
        deliveries_count: count,
        total_value: totalValue,
        total_weight: totalWeight,
        updated_at: new Date().toISOString(),
      })
      .eq("id", manifest.id);
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
    if (!manifest) return;

    // Get invoices with occurrence - set them back to pending (returned)
    const occurrenceInvoices = invoices.filter(
      (inv) => inv.status === "occurrence"
    );
    const deliveredInvoices = invoices.filter(
      (inv) => inv.status === "delivered"
    );

    // Update occurrence invoices to "returned" status
    if (occurrenceInvoices.length > 0) {
      const occurrenceIds = occurrenceInvoices.map((inv) => inv.id);
      await supabase
        .from("invoices")
        .update({
          status: "returned",
          manifest_id: null,
          driver_id: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", occurrenceIds);
    }

    // Update manifest status to completed
    await supabase
      .from("manifests")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", manifest.id);

    // Update driver status to available (for ALL driver types - CLT and third-party)
    if (manifest.driver_id) {
      await supabase
        .from("drivers")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", manifest.driver_id);
    }

    // Update vehicle status to available (if own fleet)
    if (manifest.company_vehicle_id) {
      await supabase
        .from("company_vehicles")
        .update({ status: "available", updated_at: new Date().toISOString() })
        .eq("id", manifest.company_vehicle_id);
    }

    await logAudit(
      "finalized",
      null,
      {
        delivered_count: deliveredInvoices.length,
        occurrence_count: occurrenceInvoices.length,
      },
      `Romaneio finalizado - ${deliveredInvoices.length} entregas, ${occurrenceInvoices.length} ocorrências`
    );

    toast({
      title: "✅ Romaneio Finalizado",
      description: `${deliveredInvoices.length} entrega(s) concluída(s), ${occurrenceInvoices.length} NF(s) retornaram para roteirização.`,
    });

    setFinalizeDialog(false);
    onRefresh();
    onOpenChange(false);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return (
          <Badge className="bg-success text-success-foreground">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Entregue
          </Badge>
        );
      case "occurrence":
        return (
          <Badge className="bg-warning text-warning-foreground">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Ocorrência
          </Badge>
        );
      case "in_transit":
        return (
          <Badge className="bg-primary text-primary-foreground">
            <Truck className="h-3 w-3 mr-1" />
            Em Rota
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-muted text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case "returned":
        return (
          <Badge className="bg-secondary text-secondary-foreground">
            <Package className="h-3 w-3 mr-1" />
            Devolvido
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground">
            <Truck className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  if (!manifest) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-3xl p-0 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border p-6">
            <SheetHeader className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-xl">
                    Romaneio nº <span className="text-primary font-bold">{formatManifestNumber(manifest)}</span>
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    <span className="font-mono">{manifest.manifest_code}</span> • Criado em{" "}
                    {new Date(manifest.created_at).toLocaleDateString("pt-BR")} às{" "}
                    {new Date(manifest.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Driver & Vehicle Info - Compact */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-lg border border-border">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{manifest.driver_name}</span>
                {manifest.driver_cpf && (
                  <span className="text-xs text-muted-foreground font-mono">({manifest.driver_cpf})</span>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-lg border border-border">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{manifest.vehicle_type || "Veículo"}</span>
                <span className="text-xs text-muted-foreground font-mono">{manifest.vehicle_plate || "-"}</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total NFs</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                </div>
                <div className="p-4 rounded-xl border border-success/30 bg-success/5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-xs text-success font-medium uppercase tracking-wide">Entregues</span>
                  </div>
                  <div className="text-2xl font-bold text-success">{stats.delivered}</div>
                </div>
                <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="text-xs text-warning font-medium uppercase tracking-wide">Ocorrências</span>
                  </div>
                  <div className="text-2xl font-bold text-warning">{stats.occurrence}</div>
                </div>
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-xs text-primary font-medium uppercase tracking-wide">Valor</span>
                  </div>
                  <div className="text-lg font-bold text-primary font-mono">{formatCurrency(stats.totalValue)}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPrintOpen(true)}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Reimprimir
                </Button>
                {manifest.status !== "completed" &&
                  manifest.status !== "paid" && (
                    <Button
                      size="sm"
                      className="bg-success hover:bg-success/90 text-success-foreground gap-2"
                      onClick={handleFinalizeManifest}
                    >
                      <Flag className="h-4 w-4" />
                      Finalizar Romaneio
                    </Button>
                  )}
              </div>

              <Separator />

              {/* Invoices List - Card Layout */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-foreground">
                  <Package className="h-5 w-5 text-primary" />
                  Notas Fiscais
                  <Badge variant="secondary" className="ml-auto">
                    {stats.total} NFs
                  </Badge>
                </h3>

                <div className="space-y-3">
                  {invoices.map((invoice) => {
                    // Format phone for display and WhatsApp link
                    const rawPhone = invoice.recipient_phone?.replace(/\D/g, '') || '';
                    const hasPhone = rawPhone.length >= 10;
                    const formattedPhone = hasPhone
                      ? rawPhone.length === 11
                        ? `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 7)}-${rawPhone.slice(7)}`
                        : `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 6)}-${rawPhone.slice(6)}`
                      : null;
                    const whatsappLink = hasPhone ? `https://wa.me/55${rawPhone}` : null;

                    return (
                      <div
                        key={invoice.id}
                        className={cn(
                          "p-4 rounded-xl border bg-card transition-all hover:shadow-md",
                          invoice.status === "delivered" && "border-success/30 bg-success/5",
                          invoice.status === "occurrence" && "border-warning/30 bg-warning/5",
                          invoice.status === "in_transit" && "border-primary/30 bg-primary/5"
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          {/* Main Info */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-foreground">
                                NF {invoice.nfe_number}
                              </span>
                              {getStatusBadge(invoice.status)}
                              <span className="font-mono text-sm font-semibold text-primary ml-auto sm:ml-0">
                                {formatCurrency(invoice.total_value)}
                              </span>
                            </div>
                            
                            <p className="text-sm font-medium text-foreground">
                              {invoice.recipient_name}
                            </p>

                            {invoice.arrived_at && (
                              <p className="text-xs font-medium text-blue-600 flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                Motorista chegou às{" "}
                                {new Date(invoice.arrived_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                {invoice.arrival_distance_m != null && ` (a ${Math.round(Number(invoice.arrival_distance_m))} m)`}
                              </p>
                            )}
                            
                            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                              <span className="break-words">{invoice.address_full || invoice.address_city}</span>
                            </p>

                            {hasPhone && (
                              <div className="flex items-center gap-2 text-xs">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-mono text-muted-foreground">{formattedPhone}</span>
                                <a
                                  href={whatsappLink!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded-md bg-success/10 hover:bg-success/20 transition-colors"
                                  title="Abrir WhatsApp"
                                >
                                  <MessageCircle className="h-3.5 w-3.5 text-success" />
                                </a>
                              </div>
                            )}

                            {invoice.status === "delivered" && invoice.receiver_name && (
                              <p className="text-xs text-success flex items-center gap-1.5 pt-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Recebido por: <span className="font-medium">{invoice.receiver_name}</span>
                              </p>
                            )}

                            {invoice.status === "occurrence" && invoice.occurrence_type && (
                              <p className="text-xs text-warning flex items-center gap-1.5 pt-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {OCCURRENCE_TYPES.find(t => t.value === invoice.occurrence_type)?.label || invoice.occurrence_type}
                              </p>
                            )}

                            {/* View Proof Button for delivered or occurrence invoices */}
                            {(invoice.status === "delivered" || invoice.status === "occurrence") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 mt-2 gap-1.5 text-xs"
                                onClick={() => setProofViewerInvoice(invoice)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Ver Comprovante
                              </Button>
                            )}
                          </div>

                          {/* Actions */}
                          {invoice.status === "in_transit" && (
                            <div className="flex sm:flex-col gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-border sm:pl-3">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 px-3 text-success hover:bg-success/10 hover:text-success gap-1.5"
                                onClick={() => setDeliveryDialog({ open: true, invoice })}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-xs">Entregar</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                                onClick={() => setOccurrenceDialog({ open: true, invoice })}
                              >
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-xs">Ocorrência</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 px-3 hover:bg-muted gap-1.5"
                                onClick={() => handleRemoveInvoice(invoice)}
                              >
                                <Minus className="h-4 w-4" />
                                <span className="text-xs">Remover</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {invoices.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground">
                      Nenhuma nota fiscal neste romaneio
                    </div>
                  )}
                </div>
              </div>

              {/* Audit Log */}
              {auditLogs.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-foreground">
                      <History className="h-5 w-5 text-muted-foreground" />
                      Histórico de Alterações
                    </h3>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 text-sm p-3 bg-muted/30 rounded-lg border border-border/50"
                        >
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground">
                              {log.performed_by_name || "Sistema"}
                            </div>
                            <div className="text-xs text-muted-foreground break-words">
                              {new Date(log.created_at).toLocaleString("pt-BR")} - {log.notes || log.action_type}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Confirm Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await confirmDialog.action();
                setConfirmDialog((prev) => ({ ...prev, open: false }));
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delivery Confirmation Dialog */}
      <Dialog
        open={deliveryDialog.open}
        onOpenChange={(open) =>
          setDeliveryDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Confirmar Entrega
            </DialogTitle>
            <DialogDescription>
              NF: {deliveryDialog.invoice?.nfe_number} -{" "}
              {deliveryDialog.invoice?.recipient_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="receiver_name">Nome do Recebedor *</Label>
              <Input
                id="receiver_name"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Nome completo de quem recebeu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receiver_document">Documento (RG/CPF)</Label>
              <Input
                id="receiver_document"
                value={receiverDocument}
                onChange={(e) => setReceiverDocument(e.target.value)}
                placeholder="CPF ou RG do recebedor"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeliveryDialog({ open: false, invoice: null })}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDelivery}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              Confirmar Entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Occurrence Dialog */}
      <Dialog
        open={occurrenceDialog.open}
        onOpenChange={(open) =>
          setOccurrenceDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Registrar Ocorrência
            </DialogTitle>
            <DialogDescription>
              NF: {occurrenceDialog.invoice?.nfe_number} -{" "}
              {occurrenceDialog.invoice?.recipient_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Ocorrência *</Label>
              <Select value={occurrenceType} onValueChange={setOccurrenceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {OCCURRENCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="occurrence_notes">Descrição</Label>
              <Textarea
                id="occurrence_notes"
                value={occurrenceNotes}
                onChange={(e) => setOccurrenceNotes(e.target.value)}
                placeholder="Detalhes adicionais sobre a ocorrência..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setOccurrenceDialog({ open: false, invoice: null })
              }
            >
              Cancelar
            </Button>
            <Button onClick={handleRegisterOccurrence} variant="destructive">
              Registrar Ocorrência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Warning Dialog */}
      <AlertDialog open={finalizeDialog} onOpenChange={setFinalizeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Romaneio com Ocorrências
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Este romaneio possui{" "}
                <strong>{stats.occurrence} NF(s) com ocorrência</strong>.
              </p>
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning">
                <strong>Certifique-se de que a mercadoria voltou para o galpão</strong>{" "}
                antes de finalizar.
              </div>
              <p className="text-sm">
                As NFs com ocorrência serão marcadas como "Devolvidas" e voltarão
                para a fila de roteirização.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeFinalization}
              className="bg-warning hover:bg-warning/90 text-warning-foreground"
            >
              Confirmar Finalização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Invoice Dialog with Reason */}
      <Dialog
        open={removeDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveDialog({ open: false, invoice: null });
            setRemoveReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Minus className="h-5 w-5" />
              Remover NF do Romaneio
            </DialogTitle>
            <DialogDescription>
              NF: {removeDialog.invoice?.nfe_number} - {removeDialog.invoice?.recipient_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm">
              <div className="flex items-center gap-2 mb-1 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Atenção
              </div>
              <p>
                Esta ação irá desvincular a NF do romaneio e retornar seu status para
                <strong> Pendente</strong>. Um registro será criado no histórico.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="remove_reason">Motivo da Remoção</Label>
              <Textarea
                id="remove_reason"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder="Ex: Não coube no veículo, Mercadoria avariada, Erro na atribuição..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveDialog({ open: false, invoice: null });
                setRemoveReason("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={executeRemoveInvoice} variant="destructive">
              Confirmar Remoção
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
