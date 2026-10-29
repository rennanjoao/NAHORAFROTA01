import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Save, Loader2, User, Car, Landmark, FileText, Upload, X, Eye, Download, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Driver, VehicleType } from "@/contexts/LogisticsContext";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useDriverDocumentsAccess } from "@/hooks/useDriverDocumentsAccess";
import { formatDocument, isValidCPF } from "@/lib/documentValidation";
import { isValidContactEmail } from "@/lib/driverCredentials";

interface DriverDocuments {
  cnh?: { id?: string; name: string; url?: string; path?: string; uploadedAt: Date };
  addressProof?: { id?: string; name: string; url?: string; path?: string; uploadedAt: Date };
  vehicleDoc?: { id?: string; name: string; url?: string; path?: string; uploadedAt: Date };
  trailerDoc?: { id?: string; name: string; url?: string; path?: string; uploadedAt: Date };
}

interface EditDriverDialogProps {
  driver: Driver | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (driver: Driver) => Promise<boolean> | boolean;
}

const VEHICLE_TYPES: VehicleType[] = ["Fiorino", "VUC", "Toco", "Truck", "Carreta", "Van", "Moto"];
const DRIVER_DOCUMENTS_BUCKET = "driver-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

export function EditDriverDialog({ driver, open, onOpenChange, onSave }: EditDriverDialogProps) {
  const [formData, setFormData] = useState<Partial<Driver>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [documents, setDocuments] = useState<DriverDocuments>({});
  const [uploadingDoc, setUploadingDoc] = useState<keyof DriverDocuments | null>(null);
  // Abrir/baixar arquivo e exclusivo do Super Admin; a empresa so envia/substitui.
  const { canViewDocuments } = useDriverDocumentsAccess();
  
  // File input refs
  const cnhInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);
  const trailerInputRef = useRef<HTMLInputElement>(null);

  // Banking info stored separately (not part of Driver interface yet)
  const [bankingInfo, setBankingInfo] = useState({
    banco: "",
    agencia: "",
    conta: "",
    tipo_conta: "",
    chave_pix: "",
  });

  useEffect(() => {
    if (driver) {
      setFormData({ ...driver });
      // Load banking info from driver record
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
  }, [driver, canViewDocuments]);

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
          nextDocuments[doc.document_type as keyof DriverDocuments] = {
            id: doc.id,
            name: doc.file_name,
            path: doc.file_path,
            url,
            uploadedAt: new Date(doc.created_at),
          };
        } catch (signedUrlError) {
          console.warn("Error creating driver document URL:", signedUrlError);
        }
      })
    );
    setDocuments(nextDocuments);
  };

  const handleFileUpload = async (type: keyof DriverDocuments, file: File) => {
    const driverDbId = getDriverDbId();
    if (!driverDbId) {
      toast({
        title: "Erro ao enviar documento",
        description: "Não foi possível identificar o motorista selecionado.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Envie um arquivo de até 10MB.",
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
          { onConflict: "driver_id,document_type" }
        );

      if (upsertError) throw upsertError;

      const url = canViewDocuments ? await getSignedUrl(uploadData.path) : undefined;
      setDocuments(prev => ({
        ...prev,
        [type]: { name: file.name, url, path: uploadData.path, uploadedAt: new Date() }
      }));
      toast({
        title: "Documento salvo",
        description: `${file.name} foi enviado para os documentos do motorista.`,
      });
    } catch (error: any) {
      console.error("Driver document upload error:", error);
      toast({
        title: "Erro ao enviar documento",
        description: error.message || "Não foi possível salvar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleLocalFileUpload = (type: keyof DriverDocuments, file: File) => {
    // Create object URL for preview (in production, upload to storage)
    const url = URL.createObjectURL(file);
    setDocuments(prev => ({
      ...prev,
      [type]: { name: file.name, url, uploadedAt: new Date() }
    }));
    toast({
      title: "📄 Documento carregado",
      description: `${file.name} foi adicionado com sucesso.`,
    });
  };

  const handleRemoveDocument = async (type: keyof DriverDocuments) => {
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
    setDocuments(prev => {
      const newDocs = { ...prev };
      delete newDocs[type];
      return newDocs;
    });
    toast({
      title: "🗑️ Documento removido",
      description: "O documento foi removido.",
    });
  };

  const handleDownloadDocument = (type: keyof DriverDocuments) => {
    const document = documents[type];
    if (!document?.url) {
      toast({
        title: "Documento indisponivel",
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

  const handleSave = async () => {
    if (!driver) return;

    if (formData.cpf && !isValidCPF(formData.cpf)) {
      toast({ title: "CPF inválido", description: "Confira os números do CPF.", variant: "destructive" });
      setActiveTab("personal");
      return;
    }
    if (formData.email?.trim() && !isValidContactEmail(formData.email)) {
      toast({ title: "E-mail inválido", description: "Confira o e-mail de contato do motorista.", variant: "destructive" });
      setActiveTab("personal");
      return;
    }

    setIsSaving(true);

    // Include banking info in the save
    const saveSucceeded = await onSave({
      ...driver,
      ...formData,
      cpf: formData.cpf ? formatDocument(formData.cpf) : driver.cpf,
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

  const documentLabels: Record<keyof DriverDocuments, string> = {
    cnh: "CNH",
    addressProof: "Comprovante de Endereço",
    vehicleDoc: "Documento do Veículo (CRLV)",
    trailerDoc: "Documento da Carreta",
  };

  const documentRefs: Record<keyof DriverDocuments, React.RefObject<HTMLInputElement>> = {
    cnh: cnhInputRef,
    addressProof: addressInputRef,
    vehicleDoc: vehicleInputRef,
    trailerDoc: trailerInputRef,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Motorista
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="personal" className="flex items-center gap-1.5 text-xs">
              <User className="h-4 w-4" />
              Pessoal
            </TabsTrigger>
            <TabsTrigger value="vehicle" className="flex items-center gap-1.5 text-xs">
              <Car className="h-4 w-4" />
              Veículo
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-1.5 text-xs">
              <FileText className="h-4 w-4" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="banking" className="flex items-center gap-1.5 text-xs">
              <Landmark className="h-4 w-4" />
              Bancário
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
            {/* Personal Data */}
            <TabsContent value="personal" className="mt-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf || ""}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email">E-mail de contato</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="motorista@email.com"
                />
                <p className="text-xs text-muted-foreground">Recebe os dados de acesso ao app.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status || ""}
                  onValueChange={(value) => setFormData({ ...formData, status: value as Driver["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="in_route">Em Rota</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="pending_approval">Pendente de Aprovação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">URL da Foto</Label>
                <Input
                  id="photo"
                  value={formData.photo || ""}
                  onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </TabsContent>

            {/* Vehicle Data */}
            <TabsContent value="vehicle" className="mt-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Tipo de Veículo</Label>
                <Select
                  value={formData.vehicleType || ""}
                  onValueChange={(value) => setFormData({ ...formData, vehicleType: value as VehicleType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((vt) => (
                      <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehiclePlate">Placa</Label>
                <Input
                  id="vehiclePlate"
                  value={formData.vehiclePlate || ""}
                  onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })}
                  className="uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label>Vínculo do Veículo</Label>
                <Select
                  value={formData.isOwnFleet ? "own" : "third"}
                  onValueChange={(value) => setFormData({ ...formData, isOwnFleet: value === "own" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o vínculo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own">🏢 Frota Própria (não gera valor a receber)</SelectItem>
                    <SelectItem value="third">🚚 Terceiro / Agregado (gera valor a receber)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Motoristas de frota própria não geram valores a pagar no acerto financeiro.
                </p>
              </div>
            </TabsContent>

            {/* Documents */}
            <TabsContent value="documents" className="mt-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Faça upload dos documentos do motorista e veículo.
              </p>

              {(Object.keys(documentLabels) as Array<keyof DriverDocuments>).map((docType) => (
                <div key={docType} className="space-y-2">
                  <Label>{documentLabels[docType]}</Label>
                  
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={documentRefs[docType]}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await handleFileUpload(docType, file);
                      e.target.value = "";
                    }}
                  />

                  {documents[docType] ? (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">
                            {documents[docType]?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Enviado em {documents[docType]?.uploadedAt.toLocaleDateString('pt-BR')}
                          </p>
                          {documents[docType]?.path && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                              Storage: driver-documents/{documents[docType]?.path}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {canViewDocuments ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(documents[docType]?.url, '_blank')}
                              title="Abrir documento"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadDocument(docType)}
                              title="Baixar documento"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <span
                            className="flex items-center gap-1 px-2 text-[10px] text-muted-foreground"
                            title="Somente o Super Admin pode abrir os documentos do motorista"
                          >
                            <Lock className="h-3 w-3" />
                            Restrito
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => documentRefs[docType].current?.click()}
                          disabled={uploadingDoc === docType}
                          title="Substituir documento"
                        >
                          {uploadingDoc === docType ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </Button>
                        {/* Apagar o arquivo e exclusivo do Super Admin (regra do storage) */}
                        {canViewDocuments && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveDocument(docType)}
                            title="Remover documento"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => documentRefs[docType].current?.click()}
                      disabled={uploadingDoc === docType}
                    >
                      {uploadingDoc === docType ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {uploadingDoc === docType ? "Enviando..." : "Fazer Upload"}
                    </Button>
                  )}
                </div>
              ))}

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: PDF, JPG, PNG. Tamanho máximo: 10MB
                </p>
              </div>
            </TabsContent>

            {/* Banking Data */}
            <TabsContent value="banking" className="mt-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="banco">Nome do Banco</Label>
                <Input
                  id="banco"
                  value={bankingInfo.banco}
                  onChange={(e) => setBankingInfo({ ...bankingInfo, banco: e.target.value })}
                  placeholder="Ex: Banco do Brasil, Itaú..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="agencia">Agência</Label>
                  <Input
                    id="agencia"
                    value={bankingInfo.agencia}
                    onChange={(e) => setBankingInfo({ ...bankingInfo, agencia: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conta">Conta (com dígito)</Label>
                  <Input
                    id="conta"
                    value={bankingInfo.conta}
                    onChange={(e) => setBankingInfo({ ...bankingInfo, conta: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-2">
                <h5 className="text-sm font-medium text-muted-foreground mb-3">Dados PIX</h5>
                <div className="space-y-2">
                  <Label htmlFor="chave_pix">Chave PIX</Label>
                  <Input
                    id="chave_pix"
                    value={bankingInfo.chave_pix}
                    onChange={(e) => setBankingInfo({ ...bankingInfo, chave_pix: e.target.value })}
                    placeholder="CPF, e-mail, telefone ou chave aleatória"
                  />
                  <p className="text-xs text-muted-foreground">
                    Insira a chave PIX completa (CPF, e-mail, telefone ou chave aleatória)
                  </p>
                </div>
                <div className="space-y-2 mt-3">
                  <Label htmlFor="tipo_conta">Tipo de Conta</Label>
                  <Select
                    value={bankingInfo.tipo_conta}
                    onValueChange={(value) => setBankingInfo({ ...bankingInfo, tipo_conta: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta Corrente</SelectItem>
                      <SelectItem value="poupanca">Conta Poupança</SelectItem>
                      <SelectItem value="salario">Conta Salário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
