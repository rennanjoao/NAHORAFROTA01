import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withFreshProofPhotos } from "@/lib/proofPhotos";
import {
  Package,
  User,
  MapPin,
  Phone,
  Calendar,
  Clock,
  Truck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  History,
  UserCheck,
  RotateCcw,
  Plus,
  Minus,
  Weight,
  DollarSign,
  Image as ImageIcon,
  ExternalLink,
  Pencil,
  Save,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { getOccurrenceLabel } from "@/hooks/useSLADB";

interface AuditLogEntry {
  id: string;
  action_type: string;
  created_at: string;
  performed_by_name: string | null;
  user_full_name: string | null;
  notes: string | null;
  details: any;
}

interface DeliveryOccurrenceEntry {
  id: string;
  type: string;
  description: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface DeliveryWithHistory {
  id: number;
  dbId?: string;
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
  observation?: string;
  manifestId?: string;
  manifestUuid?: string;
  occurrenceType?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: Date;
  receivedBy?: string;
  receivedAt?: Date;
  receiverDocument?: string;
  signatureUrl?: string;
  deliveryNotes?: string;
}

interface DeliveryDetailSheetProps {
  delivery: DeliveryWithHistory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddressUpdated?: () => void | Promise<void>;
}

const statusConfig = {
  pending: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  in_transit: { label: "Em Rota", color: "bg-info text-info-foreground" },
  delivered: { label: "Entregue", color: "bg-success text-success-foreground" },
  delayed: { label: "Atrasado", color: "bg-destructive text-destructive-foreground" },
  occurrence: { label: "Ocorrência", color: "bg-warning text-warning-foreground" },
  returning: { label: "Em Devolução", color: "bg-info text-info-foreground" },
  returned: { label: "Devolvido", color: "bg-idle text-idle-foreground" },
};

const actionIcons = {
  invoice_added: Plus,
  invoice_removed: Minus,
  manifest_finalized: CheckCircle2,
  status_change: RotateCcw,
  occurrence: AlertTriangle,
};

const actionColors = {
  invoice_added: "text-success",
  invoice_removed: "text-destructive",
  manifest_finalized: "text-success",
  status_change: "text-primary",
  occurrence: "text-warning",
};

const actionLabels: Record<string, string> = {
  invoice_added: "Vinculada ao romaneio",
  invoice_removed: "Removida do romaneio",
  manifest_finalized: "Romaneio finalizado",
  status_change: "Status alterado",
  occurrence: "Ocorrência registrada",
};

export function DeliveryDetailSheet({ delivery, open, onOpenChange, onAddressUpdated }: DeliveryDetailSheetProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [occurrenceEntries, setOccurrenceEntries] = useState<DeliveryOccurrenceEntry[]>([]);
  const [proofImages, setProofImages] = useState<ProofImage[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    address: "",
    city: "",
    state: "",
    zipCode: "",
  });

  useEffect(() => {
    if (!delivery) return;

    setAddressForm({
      address: delivery.address || "",
      city: delivery.city || "",
      state: delivery.state || "",
      zipCode: delivery.zipCode || "",
    });
    setIsEditingAddress(false);
    setIsSavingAddress(false);
  }, [delivery?.id, delivery?.address, delivery?.city, delivery?.state, delivery?.zipCode]);

  // Fetch audit logs when sheet opens
  useEffect(() => {
    async function fetchAuditLogs() {
      if (!open || !delivery?.dbId) {
        setAuditLogs([]);
        setOccurrenceEntries([]);
        setProofImages([]);
        return;
      }

      setIsLoadingLogs(true);
      try {
        const [auditResult, occurrenceResult, proofResult] = await Promise.all([
          supabase
            .from('manifest_audit_logs')
            .select('*')
            .eq('invoice_id', delivery.dbId)
            .order('created_at', { ascending: false }),
          fetchOccurrenceEntries(delivery.dbId),
          fetchProofImages(delivery.dbId),
        ]);

        const { data, error } = auditResult;
        if (error) throw error;
        setAuditLogs(data || []);
        setOccurrenceEntries(occurrenceResult);
        setProofImages(proofResult);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        setAuditLogs([]);
        setOccurrenceEntries([]);
        setProofImages([]);
      } finally {
        setIsLoadingLogs(false);
      }
    }

    fetchAuditLogs();
  }, [open, delivery?.dbId]);

  if (!delivery) return null;

  const status = statusConfig[delivery.status];

  // Format date for display
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get user name from audit log
  const getUserName = (log: AuditLogEntry): string => {
    return log.user_full_name || log.performed_by_name || 'Sistema';
  };

  // Get description from audit log
  const getDescription = (log: AuditLogEntry): string => {
    if (log.notes) return log.notes;
    const baseAction = actionLabels[log.action_type] || log.action_type;
    if (log.details?.manifest_number) {
      return `${baseAction} nº ${log.details.manifest_number}`;
    }
    return baseAction;
  };

  const handleSaveAddress = async () => {
    if (!delivery?.dbId) {
      toast({
        title: "Não foi possível editar",
        description: "Esta nota ainda não possui identificador no banco.",
        variant: "destructive",
      });
      return;
    }

    const address = addressForm.address.trim();
    const city = addressForm.city.trim();
    const state = addressForm.state.trim().toUpperCase();
    const zipCode = addressForm.zipCode.trim();

    if (!address || !city || !state) {
      toast({
        title: "Endereço incompleto",
        description: "Preencha endereço, cidade e UF antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingAddress(true);
    try {
      const addressFull = [address, `${city} - ${state}${zipCode ? `, ${zipCode}` : ""}`]
        .filter(Boolean)
        .join(", ");

      const { error } = await supabase
        .from("invoices")
        .update({
          address_full: addressFull,
          address_street: address,
          address_city: city,
          address_state: state,
          address_zip: zipCode || null,
          latitude: null,
          longitude: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.dbId);

      if (error) throw error;

      toast({
        title: "Endereço atualizado",
        description: "As coordenadas antigas foram limpas para recalculo da rota.",
      });

      setIsEditingAddress(false);
      await onAddressUpdated?.();
    } catch (error: any) {
      console.error("Error updating invoice address:", error);
      toast({
        title: "Erro ao salvar endereço",
        description: error.message || "Não foi possível atualizar o endereço.",
        variant: "destructive",
      });
    } finally {
      setIsSavingAddress(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Detalhes da Nota Fiscal
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-6">
            {/* Header Info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-lg font-bold">{delivery.nfe}</p>
                <p className="text-sm text-muted-foreground">
                  Importada em {delivery.scheduledDate.toLocaleDateString('pt-BR')}
                </p>
              </div>
              <Badge className={cn("gap-1", status.color)}>
                {status.label}
              </Badge>
            </div>

            <Separator />

            {/* Recipient Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Destinatário
              </h4>
              {isEditingAddress ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAddressForm({
                        address: delivery.address || "",
                        city: delivery.city || "",
                        state: delivery.state || "",
                        zipCode: delivery.zipCode || "",
                      });
                      setIsEditingAddress(false);
                    }}
                    disabled={isSavingAddress}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" onClick={handleSaveAddress} disabled={isSavingAddress}>
                    {isSavingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar
                  </Button>
                </div>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => setIsEditingAddress(true)}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
              )}
              </div>
              <div className="pl-6 space-y-2 text-sm">
                <p className="font-medium">{delivery.recipient}</p>
                {isEditingAddress ? (
                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="invoice-address">Endereço</Label>
                      <Input
                        id="invoice-address"
                        value={addressForm.address}
                        onChange={(event) => setAddressForm((current) => ({ ...current, address: event.target.value }))}
                        placeholder="Rua, avenida, número e complemento"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_72px] gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="invoice-city">Cidade</Label>
                        <Input
                          id="invoice-city"
                          value={addressForm.city}
                          onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))}
                          placeholder="Cidade"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="invoice-state">UF</Label>
                        <Input
                          id="invoice-state"
                          value={addressForm.state}
                          onChange={(event) => setAddressForm((current) => ({ ...current, state: event.target.value.toUpperCase().slice(0, 2) }))}
                          placeholder="SP"
                          maxLength={2}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invoice-zip">CEP</Label>
                      <Input
                        id="invoice-zip"
                        value={addressForm.zipCode}
                        onChange={(event) => setAddressForm((current) => ({ ...current, zipCode: event.target.value }))}
                        placeholder="00000-000"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p>{delivery.address}</p>
                      <p>{delivery.city} - {delivery.state}, {delivery.zipCode}</p>
                    </div>
                  </div>
                )}
                {delivery.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <p>{delivery.phone}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Package Info */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Dados da Carga
              </h4>
              <div className="pl-6 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Weight className="h-4 w-4 text-muted-foreground" />
                  <span>Peso: <strong>{delivery.weight}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>Valor: <strong>{delivery.value}</strong></span>
                </div>
              </div>
            </div>

            {/* Delivery Confirmation - if delivered */}
            {delivery.status === "delivered" && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmação de Entrega
                  </h4>
                  <div className="pl-6 space-y-2 text-sm bg-success/10 rounded-lg p-3 border border-success/20">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-success" />
                      <span>Recebido por: <strong>{delivery.receivedBy || "Nome não informado"}</strong></span>
                    </div>
                    {(delivery as any).receiverDocument && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Documento: <strong>{(delivery as any).receiverDocument}</strong></span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {/* Sem data registrada mostra "—" (antes caia para a data de hoje). */}
                      <span>Data: <strong>{delivery.receivedAt?.toLocaleDateString('pt-BR') || "—"}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Hora: <strong>{delivery.receivedAt?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || "—"}</strong></span>
                    </div>
                    {delivery.driver && (
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span>Motorista: <strong>{delivery.driver}</strong></span>
                      </div>
                    )}
                    {delivery.deliveryNotes && (
                      <div className="mt-2 pt-2 border-t border-success/20">
                        <p className="text-muted-foreground">{delivery.deliveryNotes}</p>
                      </div>
                    )}
                  </div>
                  {proofImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      {proofImages.map((image) => (
                        <a
                          key={image.url}
                          href={image.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block overflow-hidden rounded-lg border"
                          title={`Abrir ${image.label.toLowerCase()}`}
                        >
                          <img
                            src={image.url}
                            alt={image.label}
                            className={cn("h-32 w-full", image.kind === "signature" ? "object-contain bg-white" : "object-cover")}
                            onError={(event) => {
                              event.currentTarget.src = "/placeholder.svg";
                            }}
                          />
                          <p className="px-2 py-1 text-xs text-muted-foreground">{image.label}</p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Current Manifest */}
            {delivery.manifestId && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    Romaneio Atual
                  </h4>
                  <div className="pl-6 text-sm bg-primary/10 rounded-lg p-3 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg">Romaneio nº {delivery.manifestId}</span>
                      <Badge variant="outline">Em Rota</Badge>
                    </div>
                    {delivery.driver && (
                      <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Motorista: <strong className="text-foreground">{delivery.driver}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Occurrence Info */}
            {delivery.occurrenceType && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    Ocorrência Registrada
                  </h4>
                  <div className="pl-6 space-y-2 text-sm bg-warning/10 rounded-lg p-3 border border-warning/30">
                    <p className="font-medium">{getOccurrenceLabel(delivery.occurrenceType)}</p>
                    {delivery.observation && (
                      <p className="text-muted-foreground">{delivery.observation}</p>
                    )}
                    {occurrenceEntries.length > 0 && (
                      <div className="space-y-3 pt-2">
                        {occurrenceEntries.map((occurrence) => (
                          <div key={occurrence.id} className="space-y-2 rounded-lg border border-warning/30 bg-background p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-warning">
                                {getOccurrenceLabel(occurrence.type)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatDateTime(occurrence.created_at)}
                              </span>
                            </div>

                            {occurrence.description && (
                              <p className="text-xs text-muted-foreground">{occurrence.description}</p>
                            )}

                            {occurrence.photo_url ? (
                              <a
                                href={occurrence.photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group block overflow-hidden rounded-lg border"
                              >
                                <div className="relative">
                                  <img
                                    src={occurrence.photo_url}
                                    alt="Foto da ocorrência"
                                    className="h-40 w-full object-cover"
                                    onError={(event) => {
                                      event.currentTarget.src = "/placeholder.svg";
                                    }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                                    <ExternalLink className="h-5 w-5 text-white" />
                                  </div>
                                </div>
                              </a>
                            ) : (
                              <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                                <ImageIcon className="h-4 w-4" />
                                Nenhuma foto anexada nesta ocorrência.
                              </div>
                            )}
                            {occurrence.photo_url && (
                              <a
                                href={occurrence.photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Abrir ou baixar imagem
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Complete History Timeline - from Database */}
            <Separator />
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Histórico de Movimentação
                {auditLogs.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{auditLogs.length}</Badge>
                )}
              </h4>
              
              {isLoadingLogs ? (
                <div className="pl-6 space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="pl-6 text-sm text-muted-foreground">
                  Nenhum histórico registrado para esta nota fiscal.
                </div>
              ) : (
                <div className="pl-6 space-y-1">
                  {auditLogs.map((log, idx) => {
                    const Icon = actionIcons[log.action_type as keyof typeof actionIcons] || RotateCcw;
                    const colorClass = actionColors[log.action_type as keyof typeof actionColors] || "text-primary";
                    
                    return (
                      <div key={log.id} className="relative pl-6 pb-4 last:pb-0">
                        {/* Timeline line */}
                        {idx < auditLogs.length - 1 && (
                          <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-border" />
                        )}
                        
                        {/* Timeline dot */}
                        <div className={cn(
                          "absolute left-0 top-1 w-[18px] h-[18px] rounded-full bg-background border-2 flex items-center justify-center",
                          colorClass
                        )}>
                          <Icon className="h-3 w-3" />
                        </div>
                        
                        {/* Content */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{getDescription(log)}</p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(log.created_at)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Por: <strong>{getUserName(log)}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Observation */}
            {delivery.observation && !delivery.occurrenceType && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Observações</h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {delivery.observation}
                  </p>
                </div>
              </>
            )}

            {/* Audit Footer */}
            {delivery.lastUpdatedAt && (
              <div className="text-xs text-muted-foreground pt-4 border-t flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última atualização em {delivery.lastUpdatedAt?.toLocaleString('pt-BR')}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}


interface ProofImage {
  url: string;
  kind: "photo" | "signature";
  label: string;
}

/** Foto e assinatura do comprovante de entrega (links assinados na hora). */
async function fetchProofImages(invoiceId: string): Promise<ProofImage[]> {
  const { data, error } = await supabase
    .from("delivery_proofs")
    .select("photo_url, signature_url, created_at")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.warn("Error fetching delivery proof:", error);
    return [];
  }
  const proof = data?.[0];
  if (!proof) return [];

  const [fresh] = await withFreshProofPhotos([proof], ["photo_url", "signature_url"]);
  const images: ProofImage[] = [];
  if (fresh.photo_url) images.push({ url: fresh.photo_url, kind: "photo", label: "Foto do comprovante" });
  if (fresh.signature_url) images.push({ url: fresh.signature_url, kind: "signature", label: "Assinatura" });
  return images;
}

async function fetchOccurrenceEntries(invoiceId: string): Promise<DeliveryOccurrenceEntry[]> {
  const columns = "id, occurrence_type, description, photo_url, created_at";
  type Row = { id: string; occurrence_type: string; description: string | null; photo_url: string | null; created_at: string | null };
  const toEntries = async (rows: Row[]) =>
    withFreshProofPhotos(
      rows.map((row) => ({
        id: row.id,
        type: row.occurrence_type,
        description: row.description,
        photo_url: row.photo_url,
        created_at: row.created_at || "",
      })),
      ["photo_url"],
    );

  const { data: byInvoice, error: byInvoiceError } = await supabase
    .from("delivery_occurrences")
    .select(columns)
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  if (byInvoiceError) console.warn("Error fetching delivery occurrences:", byInvoiceError);
  if (!byInvoiceError && byInvoice && byInvoice.length > 0) {
    return toEntries(byInvoice as Row[]);
  }

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id")
    .eq("invoice_id", invoiceId);

  const deliveryIds = (deliveries || []).map((linkedDelivery) => linkedDelivery.id);
  if (deliveryIds.length === 0) return [];

  const { data: byDelivery, error: byDeliveryError } = await supabase
    .from("delivery_occurrences")
    .select(columns)
    .in("delivery_id", deliveryIds)
    .order("created_at", { ascending: false });

  if (byDeliveryError) {
    console.warn("Error fetching delivery occurrence photos:", byDeliveryError);
    return [];
  }

  return toEntries((byDelivery || []) as Row[]);
}
