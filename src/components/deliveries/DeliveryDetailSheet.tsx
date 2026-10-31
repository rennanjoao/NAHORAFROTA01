import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readDeliveryOccurrences } from "@/lib/deliveryOccurrences";
import { withFreshProofPhotos } from "@/lib/proofPhotos";
import {
  Package,
  User,
  MapPin,
  Phone,
  Clock,
  Truck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  History,
  RotateCcw,
  Plus,
  Minus,
  Image as ImageIcon,
  ExternalLink,
  Pencil,
  Save,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { buildFullAddress } from "@/lib/nfeXmlParser";
import { FormField } from "@/components/patterns";
import { DeliveryStatusBadge, occurrenceLabel } from "./status";

const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

type AddressErrors = Partial<Record<"address" | "city" | "state" | "zipCode", string>>;

/** "Rua X, 120" -> rua e numero separados (o numero ficava duplicado ao salvar). */
function splitStreetNumber(text: string) {
  const match = text.match(/^(.*),\s*([^,]{1,10})$/);
  if (match && /\d|s\/?n/i.test(match[2])) return { street: match[1].trim(), number: match[2].trim() };
  return { street: text, number: "" };
}

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
  addressStreet?: string;
  addressNumber?: string;
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
  const [addressErrors, setAddressErrors] = useState<AddressErrors>({});
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
    setAddressErrors({});
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

  const hasOpenOccurrence =
    !!delivery.occurrenceType && ["occurrence", "delayed", "returning", "returned"].includes(delivery.status);

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
    const zipDigits = zipCode.replace(/\D/g, "");

    // Erro embaixo de cada campo (antes era so um aviso no canto da tela).
    const errors: AddressErrors = {};
    if (!address) errors.address = "Informe a rua e o número.";
    if (!city) errors.city = "Informe a cidade.";
    if (!state) errors.state = "Informe a UF.";
    else if (!UFS.has(state)) errors.state = "UF inválida. Use a sigla, como SP.";
    if (zipCode && zipDigits.length !== 8) errors.zipCode = "O CEP tem 8 números.";
    setAddressErrors(errors);
    const firstError = (["address", "city", "state", "zipCode"] as const).find((key) => errors[key]);
    if (firstError) {
      const ids = { address: "invoice-address", city: "invoice-city", state: "invoice-state", zipCode: "invoice-zip" };
      document.getElementById(ids[firstError])?.focus();
      return;
    }

    setIsSavingAddress(true);
    try {
      // Mesmo endereco de antes: mantem rua e numero como estavam.
      const { street, number } =
        address === delivery.address && delivery.addressStreet !== undefined
          ? { street: delivery.addressStreet || address, number: delivery.addressNumber || "" }
          : splitStreetNumber(address);
      const { data: current } = await supabase
        .from("invoices")
        .select("address_neighborhood")
        .eq("id", delivery.dbId)
        .maybeSingle();
      const addressFull = buildFullAddress(street, number, current?.address_neighborhood || "", city, state, zipDigits);

      const { error } = await supabase
        .from("invoices")
        .update({
          address_full: addressFull,
          address_street: street,
          address_number: number || null,
          address_city: city,
          address_state: state,
          address_zip: zipDigits || null,
          latitude: null,
          longitude: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.dbId);

      if (error) throw error;

      toast({
        title: "Endereço atualizado",
        description: "A localização no mapa será refeita na próxima rota.",
        variant: "success",
      });

      setIsEditingAddress(false);
      await onAddressUpdated?.();
    } catch (error: any) {
      console.error("Error updating invoice address:", error);
      toast({
        title: "Não foi possível salvar o endereço",
        description: "Confira a internet e tente de novo.",
        variant: "destructive",
      });
    } finally {
      setIsSavingAddress(false);
    }
  };

  const resetAddressForm = () => {
    setAddressForm({
      address: delivery.address || "",
      city: delivery.city || "",
      state: delivery.state || "",
      zipCode: delivery.zipCode || "",
    });
    setAddressErrors({});
    setIsEditingAddress(false);
  };

  const sectionTitle = (id: string, Icon: typeof User, title: string, extra?: ReactNode) => (
    <h3 id={id} className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      {title}
      {extra}
    </h3>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="space-y-2 border-b px-6 pb-5 pr-14 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="font-data text-xl">NF {delivery.nfe}</SheetTitle>
            <DeliveryStatusBadge status={delivery.status} live />
          </div>
          <SheetDescription>
            Importada em {delivery.scheduledDate.toLocaleDateString("pt-BR")}
            {delivery.manifestId ? ` · Romaneio ${delivery.manifestId}` : " · Sem romaneio"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-6 py-6">
            {/* Cliente */}
            <section aria-labelledby="detail-recipient" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                {sectionTitle("detail-recipient", User, "Cliente")}
                {!isEditingAddress && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditingAddress(true);
                      // Leva o foco ao primeiro campo (o botao some ao abrir o formulario).
                      window.setTimeout(() => document.getElementById("invoice-address")?.focus(), 0);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                    Corrigir endereço
                  </Button>
                )}
              </div>
              <div className="space-y-2 rounded-lg border p-4 text-sm">
                <p className="font-medium text-foreground">{delivery.recipient}</p>
                {isEditingAddress ? (
                  <div className="space-y-3 pt-1 animate-fade-in">
                    <FormField id="invoice-address" label="Rua e número" required error={addressErrors.address}>
                      {(field) => (
                        <Input
                          {...field}
                          value={addressForm.address}
                          onChange={(event) => {
                            setAddressForm((current) => ({ ...current, address: event.target.value }));
                            setAddressErrors((current) => ({ ...current, address: undefined }));
                          }}
                          placeholder="Ex.: Rua das Flores, 120"
                          autoComplete="off"
                        />
                      )}
                    </FormField>
                    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
                      <FormField id="invoice-city" label="Cidade" required error={addressErrors.city}>
                        {(field) => (
                          <Input
                            {...field}
                            value={addressForm.city}
                            onChange={(event) => {
                              setAddressForm((current) => ({ ...current, city: event.target.value }));
                              setAddressErrors((current) => ({ ...current, city: undefined }));
                            }}
                            autoComplete="off"
                          />
                        )}
                      </FormField>
                      <FormField id="invoice-state" label="UF" required error={addressErrors.state}>
                        {(field) => (
                          <Input
                            {...field}
                            value={addressForm.state}
                            onChange={(event) => {
                              setAddressForm((current) => ({ ...current, state: event.target.value.toUpperCase().slice(0, 2) }));
                              setAddressErrors((current) => ({ ...current, state: undefined }));
                            }}
                            placeholder="SP"
                            maxLength={2}
                            autoComplete="off"
                            className="uppercase"
                          />
                        )}
                      </FormField>
                    </div>
                    <FormField id="invoice-zip" label="CEP" optional error={addressErrors.zipCode}>
                      {(field) => (
                        <Input
                          {...field}
                          value={addressForm.zipCode}
                          onChange={(event) => {
                            setAddressForm((current) => ({ ...current, zipCode: event.target.value }));
                            setAddressErrors((current) => ({ ...current, zipCode: undefined }));
                          }}
                          placeholder="00000-000"
                          inputMode="numeric"
                          maxLength={9}
                          autoComplete="off"
                          className="font-data"
                        />
                      )}
                    </FormField>
                    <p className="text-xs text-muted-foreground">Ao salvar, a localização no mapa é refeita na próxima rota.</p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button type="button" variant="outline" onClick={resetAddressForm} disabled={isSavingAddress}>
                        Cancelar
                      </Button>
                      <Button type="button" onClick={handleSaveAddress} disabled={isSavingAddress}>
                        {isSavingAddress ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                        {isSavingAddress ? "Salvando…" : "Salvar endereço"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {delivery.address}
                      <br />
                      {delivery.city} - {delivery.state}
                      {delivery.zipCode ? `, ${delivery.zipCode}` : ""}
                    </span>
                  </p>
                )}
                {delivery.phone && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="font-data">{delivery.phone}</span>
                  </p>
                )}
              </div>
            </section>

            {/* Carga */}
            <section aria-labelledby="detail-cargo" className="space-y-3">
              {sectionTitle("detail-cargo", Package, "Carga")}
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <dt className="text-xs text-muted-foreground">Peso</dt>
                  <dd className="font-data text-base font-semibold text-foreground">{delivery.weight}</dd>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <dt className="text-xs text-muted-foreground">Valor</dt>
                  <dd className="font-data text-base font-semibold text-foreground">{delivery.value}</dd>
                </div>
              </dl>
            </section>

            {/* Entrega confirmada */}
            {delivery.status === "delivered" && (
              <section aria-labelledby="detail-proof" className="space-y-3">
                {sectionTitle("detail-proof", CheckCircle2, "Entrega confirmada")}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Recebido por</dt>
                    <dd className="font-medium text-foreground">{delivery.receivedBy || "Nome não informado"}</dd>
                  </div>
                  {delivery.receiverDocument && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Documento</dt>
                      <dd className="font-data text-foreground">{delivery.receiverDocument}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-muted-foreground">Data</dt>
                    {/* Sem data registrada mostra "—" (antes caia para a data de hoje). */}
                    <dd className="font-data text-foreground">{delivery.receivedAt?.toLocaleDateString("pt-BR") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Hora</dt>
                    <dd className="font-data text-foreground">
                      {delivery.receivedAt?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) || "—"}
                    </dd>
                  </div>
                  {delivery.driver && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Motorista</dt>
                      <dd className="text-foreground">{delivery.driver}</dd>
                    </div>
                  )}
                  {delivery.deliveryNotes && (
                    <div className="col-span-2 border-t border-success/20 pt-3">
                      <dt className="text-xs text-muted-foreground">Recado da entrega</dt>
                      <dd className="text-foreground">{delivery.deliveryNotes}</dd>
                    </div>
                  )}
                </dl>
                {proofImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {proofImages.map((image) => (
                      <a
                        key={image.url}
                        href={image.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="card-interactive block overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <img
                          src={image.url}
                          alt={image.label}
                          // Assinatura e papel: fundo claro nos dois temas.
                          className={cn("h-32 w-full", image.kind === "signature" ? "light bg-card object-contain" : "object-cover")}
                          onError={(event) => {
                            event.currentTarget.src = "/placeholder.svg";
                          }}
                        />
                        <span className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs text-muted-foreground">
                          {image.label}
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="sr-only">(abre em nova aba)</span>
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Romaneio atual */}
            {delivery.manifestId && (
              <section aria-labelledby="detail-manifest" className="space-y-3">
                {sectionTitle("detail-manifest", Truck, "Romaneio")}
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="font-data text-base font-semibold text-foreground">Romaneio {delivery.manifestId}</p>
                  {delivery.driver && (
                    <p className="mt-1 text-muted-foreground">
                      Motorista: <span className="font-medium text-foreground">{delivery.driver}</span>
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Ocorrencia (so enquanto a nota esta com problema; depois o motivo antigo fica no historico) */}
            {hasOpenOccurrence && (
              <section aria-labelledby="detail-occurrence" className="space-y-3">
                {sectionTitle("detail-occurrence", AlertTriangle, "Ocorrência registrada")}
                <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <p className="font-medium text-foreground">{occurrenceLabel(delivery.occurrenceType)}</p>
                  {delivery.observation && <p className="text-muted-foreground">{delivery.observation}</p>}
                  {occurrenceEntries.map((occurrence) => (
                    <div key={occurrence.id} className="space-y-2 rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">{occurrenceLabel(occurrence.type)}</span>
                        <span className="font-data text-xs text-muted-foreground">{formatDateTime(occurrence.created_at)}</span>
                      </div>
                      {occurrence.description && <p className="text-xs text-muted-foreground">{occurrence.description}</p>}
                      {occurrence.photo_url ? (
                        <a
                          href={occurrence.photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <img
                            src={occurrence.photo_url}
                            alt="Foto da ocorrência"
                            className="h-40 w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.src = "/placeholder.svg";
                            }}
                          />
                          <span className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-foreground">
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            Abrir ou baixar a foto
                            <span className="sr-only">(abre em nova aba)</span>
                          </span>
                        </a>
                      ) : (
                        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                          <ImageIcon className="h-4 w-4" aria-hidden="true" />
                          Nenhuma foto nesta ocorrência.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Observacoes */}
            {delivery.observation && !hasOpenOccurrence && (
              <section aria-labelledby="detail-observation" className="space-y-3">
                {sectionTitle("detail-observation", FileText, "Observação para o motorista")}
                <p className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">{delivery.observation}</p>
              </section>
            )}

            {/* Historico */}
            <section aria-labelledby="detail-history" className="space-y-3">
              {sectionTitle(
                "detail-history",
                History,
                "Histórico",
                auditLogs.length > 0 ? <Badge variant="secondary">{auditLogs.length}</Badge> : null,
              )}

              {isLoadingLogs ? (
                <div className="space-y-3" role="status" aria-label="Carregando histórico">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Nada registrado ainda para esta nota.
                </p>
              ) : (
                <ol className="space-y-0">
                  {auditLogs.map((log, idx) => {
                    const Icon = actionIcons[log.action_type as keyof typeof actionIcons] || RotateCcw;
                    const colorClass = actionColors[log.action_type as keyof typeof actionColors] || "text-primary";

                    return (
                      <li key={log.id} className="relative pb-4 pl-8 last:pb-0">
                        {idx < auditLogs.length - 1 && (
                          <span aria-hidden="true" className="absolute bottom-0 left-[11px] top-6 w-px bg-border" />
                        )}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border bg-card",
                            colorClass,
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <p className="text-sm font-medium text-foreground">{getDescription(log)}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-data">{formatDateTime(log.created_at)}</span> · por {getUserName(log)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {delivery.lastUpdatedAt && (
              <p className="flex items-center gap-1.5 border-t pt-4 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Última atualização em {delivery.lastUpdatedAt?.toLocaleString("pt-BR")}
              </p>
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

  const { data: byInvoice, error: byInvoiceError } = await readDeliveryOccurrences<Row>((typeColumn) =>
    supabase
      .from("delivery_occurrences")
      .select(`id, ${typeColumn}, description, photo_url, created_at`)
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false }),
  );

  if (byInvoiceError) console.warn("Error fetching delivery occurrences:", byInvoiceError);
  if (!byInvoiceError && byInvoice.length > 0) {
    return toEntries(byInvoice);
  }

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id")
    .eq("invoice_id", invoiceId);

  const deliveryIds = (deliveries || []).map((linkedDelivery) => linkedDelivery.id);
  if (deliveryIds.length === 0) return [];

  const { data: byDelivery, error: byDeliveryError } = await readDeliveryOccurrences<Row>((typeColumn) =>
    supabase
      .from("delivery_occurrences")
      .select(`id, ${typeColumn}, description, photo_url, created_at`)
      .in("delivery_id", deliveryIds)
      .order("created_at", { ascending: false }),
  );

  if (byDeliveryError) {
    console.warn("Error fetching delivery occurrence photos:", byDeliveryError);
    return [];
  }

  return toEntries(byDelivery);
}
