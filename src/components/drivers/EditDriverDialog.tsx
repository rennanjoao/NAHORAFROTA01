import { useState, useEffect } from "react";
import { Car, FileText, Landmark, Loader2, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Driver, VehicleType } from "@/contexts/LogisticsContext";
import { supabase } from "@/integrations/supabase/client";
import { useDriverDocumentsAccess } from "@/hooks/useDriverDocumentsAccess";
import { formatDocument, isValidCPF, onlyDigits } from "@/lib/documentValidation";
import { isValidContactEmail } from "@/lib/driverCredentials";
import {
  DRIVER_DOCUMENT_KEYS,
  DRIVER_DOCUMENT_LABELS,
  DRIVER_STATUS,
  DRIVER_VEHICLE_TYPES,
  focusField,
  formatPhone,
  isCpfTaken,
  isValidPhone,
  isValidPlate,
  normalizePlate,
  PENDING_PLATE,
  PHONE_ERROR,
  plainError,
  PLATE_ERROR,
  type DriverDocumentKey,
} from "./driverConfig";
import {
  BankFields,
  DocumentSlot,
  DocumentSlotList,
  DriverKindChoice,
  RestrictedDocumentsNote,
  type BankValues,
} from "./DriverFormParts";
import { FieldGroup, FormField } from "@/components/patterns/FormField";
import { TabErrorDot } from "./TabErrorDot";
import { useReturnFocus } from "@/hooks/useReturnFocus";

type DriverDocuments = Partial<Record<DriverDocumentKey, { id?: string; name: string; url?: string; path?: string; uploadedAt: Date }>>;

interface EditDriverDialogProps {
  driver: Driver | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (driver: Driver) => Promise<boolean> | boolean;
}

const DRIVER_DOCUMENTS_BUCKET = "driver-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

type FieldKey = "cpf" | "phone" | "email" | "vehiclePlate";
type FieldErrors = Partial<Record<FieldKey, string>>;

// Ordem de foco quando ha erro, e em que aba cada campo esta.
const FIELD_ORDER: { key: FieldKey; id: string; tab: "personal" | "vehicle" }[] = [
  { key: "cpf", id: "edit-cpf", tab: "personal" },
  { key: "phone", id: "phone", tab: "personal" },
  { key: "email", id: "contact-email", tab: "personal" },
  { key: "vehiclePlate", id: "edit-vehicle-plate", tab: "vehicle" },
];

// Avatar de iniciais gerado pelo sistema: nao e uma foto escolhida pela empresa.
const isGeneratedAvatar = (url?: string | null) => !url || url.includes("api.dicebear.com");
const initialsAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || "Motorista")}`;

export function EditDriverDialog({ driver, open, onOpenChange, onSave }: EditDriverDialogProps) {
  const [formData, setFormData] = useState<Partial<Driver>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [documents, setDocuments] = useState<DriverDocuments>({});
  const [uploadingDoc, setUploadingDoc] = useState<DriverDocumentKey | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Ao fechar, o foco volta para o botao que abriu (a folha de detalhe fica aberta por baixo).
  const returnFocus = useReturnFocus();
  // Abrir/baixar arquivo e exclusivo do Super Admin; a empresa so envia/substitui.
  const { canViewDocuments } = useDriverDocumentsAccess();

  // Dados bancarios ficam a parte (ainda nao fazem parte do Driver).
  const [bankingInfo, setBankingInfo] = useState<BankValues>({
    banco: "",
    agencia: "",
    conta: "",
    tipo_conta: "",
    chave_pix: "",
  });

  useEffect(() => {
    if (driver) {
      // Campo de foto e placa vazios quando nao ha foto propria / placa ainda.
      setFormData({
        ...driver,
        photo: isGeneratedAvatar(driver.photo) ? "" : driver.photo,
        vehiclePlate: driver.vehiclePlate === PENDING_PLATE ? "" : driver.vehiclePlate,
      });
      setErrors({});
      const driverAny = driver as any;
      setBankingInfo({
        banco: driverAny.banco || "",
        agencia: driverAny.agencia || "",
        conta: driverAny.conta || "",
        tipo_conta: driverAny.tipo_conta || "",
        chave_pix: driverAny.chave_pix || "",
      });
    }
  }, [driver]);

  // Recarrega quando a permissao de abrir documentos termina de carregar.
  useEffect(() => {
    if (!driver) return;
    setDocuments({});
    loadDriverDocuments(driver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, canViewDocuments]);

  // Abre sempre na primeira aba.
  useEffect(() => {
    if (open) setActiveTab("personal");
  }, [open]);

  const getDriverDbId = (driverRecord: Driver | null = driver) => {
    return (driverRecord as any)?._dbId || (typeof driverRecord?.id === "string" ? driverRecord.id : null);
  };

  const getDriverTenantId = (driverRecord: Driver | null = driver) => {
    return (driverRecord as any)?.tenant_id || null;
  };

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from(DRIVER_DOCUMENTS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    return data.signedUrl;
  };

  const loadDriverDocuments = async (driverRecord: Driver) => {
    const driverDbId = getDriverDbId(driverRecord);
    if (!driverDbId) return;

    const { data, error } = await (supabase as any)
      .from("driver_documents")
      .select("id, document_type, file_name, file_path, created_at")
      .eq("driver_id", driverDbId);

    if (error) {
      console.warn("Error loading driver documents:", error);
      return;
    }

    const nextDocuments: DriverDocuments = {};
    await Promise.all(
      (data || []).map(async (doc: any) => {
        try {
          const url = canViewDocuments ? await getSignedUrl(doc.file_path) : undefined;
          nextDocuments[doc.document_type as DriverDocumentKey] = {
            id: doc.id,
            name: doc.file_name,
            path: doc.file_path,
            url,
            uploadedAt: new Date(doc.created_at),
          };
        } catch (signedUrlError) {
          console.warn("Error creating driver document URL:", signedUrlError);
        }
      }),
    );
    setDocuments(nextDocuments);
  };

  const handleFileUpload = async (type: DriverDocumentKey, file: File) => {
    const driverDbId = getDriverDbId();
    if (!driverDbId) {
      toast({
        title: "Não foi possível enviar o documento",
        description: "Não foi possível identificar o motorista selecionado.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Envie um arquivo de até 10 MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingDoc(type);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const path = `${driverDbId}/${type}/${Date.now()}-${safeName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(DRIVER_DOCUMENTS_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (uploadError) throw uploadError;

      const { error: upsertError } = await (supabase as any)
        .from("driver_documents")
        .upsert(
          {
            driver_id: driverDbId,
            document_type: type,
            file_name: file.name,
            file_path: uploadData.path,
            mime_type: file.type || null,
            file_size: file.size,
            tenant_id: getDriverTenantId(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "driver_id,document_type" },
        );

      if (upsertError) throw upsertError;

      const url = canViewDocuments ? await getSignedUrl(uploadData.path) : undefined;
      setDocuments((prev) => ({
        ...prev,
        [type]: { name: file.name, url, path: uploadData.path, uploadedAt: new Date() },
      }));
      toast({
        title: "Documento salvo",
        description: `${file.name} foi enviado para os documentos do motorista.`,
      });
    } catch (error: any) {
      console.error("Driver document upload error:", error);
      toast({
        title: "Não foi possível enviar o documento",
        description: plainError(error, "Confira o arquivo e tente de novo."),
        variant: "destructive",
      });
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleRemoveDocument = async (type: DriverDocumentKey) => {
    const document = documents[type];
    if (document?.path) {
      // remove() nao acusa erro quando a politica bloqueia: confere o que foi apagado.
      const { data: removed, error: removeError } = await supabase.storage
        .from(DRIVER_DOCUMENTS_BUCKET)
        .remove([document.path]);
      if (removeError || !removed?.length) {
        toast({
          title: "Não foi possível remover",
          description: removeError?.message || "Somente o Super Admin pode apagar documentos do motorista.",
          variant: "destructive",
        });
        return;
      }
      await (supabase as any)
        .from("driver_documents")
        .delete()
        .eq("driver_id", getDriverDbId())
        .eq("document_type", type);
    }
    setDocuments((prev) => {
      const newDocs = { ...prev };
      delete newDocs[type];
      return newDocs;
    });
    toast({
      title: "Documento removido",
      description: "O documento foi removido.",
    });
  };

  const handleDownloadDocument = (type: DriverDocumentKey) => {
    const document = documents[type];
    if (!document?.url) {
      toast({
        title: "Documento indisponível",
        description: "Não foi possível gerar o link para download.",
        variant: "destructive",
      });
      return;
    }

    const link = window.document.createElement("a");
    link.href = document.url;
    link.download = document.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const showErrors = (found: FieldErrors) => {
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field.key]);
    if (!first) return;
    setActiveTab(first.tab);
    // Espera a aba aparecer para levar o foco ao primeiro campo com erro.
    window.setTimeout(() => focusField(first.id), 60);
  };

  const handleSave = async () => {
    if (!driver) return;

    const found: FieldErrors = {};
    if (formData.cpf && !isValidCPF(formData.cpf)) found.cpf = "CPF inválido. Confira os números.";
    if (formData.phone?.trim() && !isValidPhone(formData.phone)) found.phone = PHONE_ERROR;
    if (formData.email?.trim() && !isValidContactEmail(formData.email)) found.email = "E-mail inválido. Confira o endereço.";
    if (formData.vehiclePlate?.trim() && !isValidPlate(formData.vehiclePlate)) found.vehiclePlate = PLATE_ERROR;
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }

    setIsSaving(true);

    // CPF trocado: confere se ja nao e de outro motorista (o banco aceita repetido).
    const cpfChanged = formData.cpf && onlyDigits(formData.cpf) !== onlyDigits(driver.cpf || "");
    if (cpfChanged && (await isCpfTaken(formData.cpf as string, getDriverDbId()))) {
      setIsSaving(false);
      showErrors({ cpf: "Este CPF já está cadastrado em outro motorista." });
      return;
    }

    const name = formData.name?.trim() || driver.name;
    const plate = normalizePlate(formData.vehiclePlate || "");

    // Dados bancarios vao junto no salvar.
    const saveSucceeded = await onSave({
      ...driver,
      ...formData,
      name,
      cpf: formData.cpf ? formatDocument(formData.cpf) : driver.cpf,
      phone: formData.phone?.trim() ? formatPhone(formData.phone) : "",
      vehiclePlate: plate || PENDING_PLATE,
      // Sem foto propria (ou campo apagado): avatar de iniciais com o nome atual.
      photo: formData.photo?.trim() || initialsAvatar(name),
      banco: bankingInfo.banco,
      agencia: bankingInfo.agencia,
      conta: bankingInfo.conta,
      tipo_conta: bankingInfo.tipo_conta,
      chave_pix: bankingInfo.chave_pix,
    } as Driver);
    setIsSaving(false);
    if (!saveSucceeded) return;
    onOpenChange(false);
  };

  if (!driver) return null;

  const updateField = (patch: Partial<Driver>) => {
    setFormData((current) => ({ ...current, ...patch }));
    const touched = (Object.keys(patch) as FieldKey[]).filter((key) => errors[key]);
    if (touched.length > 0) {
      setErrors((current) => {
        const next = { ...current };
        touched.forEach((key) => delete next[key]);
        return next;
      });
    }
  };

  // Em rota a situacao muda sozinha ao fim do romaneio; "Em rota" nao e escolha manual.
  const isInRoute = driver.status === "in_route";
  const statusOptions = Object.entries(DRIVER_STATUS).filter(
    ([value]) => value === "active" || value === "inactive" || value === driver.status,
  );

  const tabTriggerClass = "h-8 gap-1.5 px-1.5 text-xs sm:text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden sm:h-[min(90vh,42rem)] sm:max-h-[90vh] sm:max-w-2xl"
        {...returnFocus}
      >
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>Editar motorista</DialogTitle>
          <DialogDescription>
            Altere os dados de {driver.name}. As mudanças valem em todo o sistema.
          </DialogDescription>
        </DialogHeader>

        <form
          id="edit-driver-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
          className="-mx-5 min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:-mx-6 sm:px-6"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="sticky top-0 z-10 grid h-auto w-full grid-cols-4 shadow-[0_0_0_4px_hsl(var(--popover))]">
              <TabsTrigger value="personal" className={tabTriggerClass}>
                <User className="hidden sm:block" aria-hidden="true" />
                Pessoal
                <TabErrorDot show={Boolean(errors.cpf || errors.phone || errors.email)} />
              </TabsTrigger>
              <TabsTrigger value="vehicle" className={tabTriggerClass}>
                <Car className="hidden sm:block" aria-hidden="true" />
                Veículo
                <TabErrorDot show={Boolean(errors.vehiclePlate)} />
              </TabsTrigger>
              <TabsTrigger value="documents" className={tabTriggerClass}>
                <FileText className="hidden sm:block" aria-hidden="true" />
                Documentos
              </TabsTrigger>
              <TabsTrigger value="banking" className={tabTriggerClass}>
                <Landmark className="hidden sm:block" aria-hidden="true" />
                Pagamento
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="mt-5 space-y-4">
              <FormField id="edit-name" label="Nome completo">
                {(control) => <Input {...control} autoComplete="off" value={formData.name || ""} onChange={(e) => updateField({ name: e.target.value })} />}
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="edit-cpf" label="CPF" error={errors.cpf}>
                  {(control) => (
                    <Input {...control} inputMode="numeric" placeholder="000.000.000-00" value={formData.cpf || ""} onChange={(e) => updateField({ cpf: e.target.value })} />
                  )}
                </FormField>
                <FormField id="phone" label="Telefone (WhatsApp)" error={errors.phone}>
                  {(control) => (
                    <Input {...control} type="tel" value={formData.phone || ""} onChange={(e) => updateField({ phone: e.target.value })} placeholder="(00) 00000-0000" />
                  )}
                </FormField>
              </div>

              <FormField id="contact-email" label="E-mail de contato" error={errors.email} hint="Recebe os dados de acesso ao aplicativo.">
                {(control) => (
                  <Input
                    {...control}
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => updateField({ email: e.target.value })}
                    placeholder="motorista@email.com"
                  />
                )}
              </FormField>

              <FormField
                id="edit-status"
                label="Situação"
                hint={
                  isInRoute
                    ? "Em rota: volta a ficar disponível quando o romaneio terminar."
                    : "Inativo não aparece na escolha de motorista dos romaneios."
                }
              >
                {(control) => (
                  <Select
                    value={formData.status || ""}
                    onValueChange={(value) => updateField({ status: value as Driver["status"] })}
                    disabled={isInRoute}
                  >
                    <SelectTrigger {...control}>
                      <SelectValue placeholder="Escolha a situação" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField id="edit-photo" label="Foto" optional hint="Endereço (link) de uma imagem na internet. Sem foto, mostramos as iniciais do nome.">
                {(control) => (
                  <Input {...control} type="url" value={formData.photo || ""} onChange={(e) => updateField({ photo: e.target.value })} placeholder="https://..." />
                )}
              </FormField>
            </TabsContent>

            <TabsContent value="vehicle" className="mt-5 space-y-5">
              <FieldGroup title="Tipo de motorista" description="Motoristas da casa não geram valores a pagar no acerto financeiro.">
                <DriverKindChoice idPrefix="edit-" isOwnFleet={Boolean(formData.isOwnFleet)} onChange={(isOwnFleet) => updateField({ isOwnFleet })} />
              </FieldGroup>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="edit-vehicle-type" label="Tipo de veículo">
                  {(control) => (
                    <Select value={formData.vehicleType || ""} onValueChange={(value) => updateField({ vehicleType: value as VehicleType })}>
                      <SelectTrigger {...control}>
                        <SelectValue placeholder="Escolha o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {DRIVER_VEHICLE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField
                  id="edit-vehicle-plate"
                  label="Placa"
                  error={errors.vehiclePlate}
                  hint={formData.isOwnFleet ? "Opcional para motorista da casa." : "Placa antiga ou Mercosul."}
                >
                  {(control) => (
                    <Input
                      {...control}
                      autoComplete="off"
                      placeholder="ABC1D23"
                      className="font-data uppercase tracking-wider"
                      value={formData.vehiclePlate || ""}
                      onChange={(e) => updateField({ vehiclePlate: normalizePlate(e.target.value) })}
                    />
                  )}
                </FormField>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="mt-5">
              <DocumentSlotList note={!canViewDocuments ? <RestrictedDocumentsNote /> : undefined}>
                {DRIVER_DOCUMENT_KEYS.map((type) => {
                  const document = documents[type];
                  return (
                    <DocumentSlot
                      key={type}
                      id={`edit-doc-${type}`}
                      label={DRIVER_DOCUMENT_LABELS[type]}
                      file={document}
                      uploading={uploadingDoc === type}
                      locked={!canViewDocuments}
                      onFile={(file) => handleFileUpload(type, file)}
                      onOpen={canViewDocuments && document ? () => window.open(document.url, "_blank") : undefined}
                      onDownload={canViewDocuments && document ? () => handleDownloadDocument(type) : undefined}
                      // Apagar o arquivo e exclusivo do Super Admin (regra do storage)
                      onRemove={canViewDocuments && document ? () => handleRemoveDocument(type) : undefined}
                    />
                  );
                })}
              </DocumentSlotList>
            </TabsContent>

            <TabsContent value="banking" className="mt-5 space-y-4">
              <p className="text-sm text-muted-foreground">Usado para pagar o frete no acerto financeiro.</p>
              <BankFields idPrefix="edit-" values={bankingInfo} onChange={(patch) => setBankingInfo((current) => ({ ...current, ...patch }))} />
            </TabsContent>
          </Tabs>
        </form>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-driver-form" disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
