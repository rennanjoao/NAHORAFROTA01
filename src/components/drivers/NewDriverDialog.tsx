import { useState, useRef, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Building2, 
  User, 
  Car, 
  FileText, 
  Landmark,
  Upload,
  X,
  Eye,
  Loader2,
  KeyRound,
  Mail,
  Phone,
  Copy,
  Eye as EyeIcon,
  EyeOff,
  RefreshCw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { VehicleType } from "@/contexts/LogisticsContext";
import { supabase } from "@/integrations/supabase/client";
import { describeCredentialsEmailResult, isValidContactEmail, sendDriverCredentialsEmail } from "@/lib/driverCredentials";
import { formatDocument, isValidCPF } from "@/lib/documentValidation";
import { requireCurrentTenantId } from "@/lib/tenant";
import { readEdgeFunctionError, toEmailLocalPart } from "@/lib/edgeFunctionError";
import { MAX_DRIVER_DOCUMENT_BYTES, uploadDriverDocument, type DriverDocumentType } from "@/lib/driverDocuments";

interface DocumentFile {
  name: string;
  url: string;
  uploadedAt: Date;
  file: File;
}

interface DriverDocuments {
  cnh?: DocumentFile;
  addressProof?: DocumentFile;
  vehicleDoc?: DocumentFile;
  trailerDoc?: DocumentFile;
}

interface NewDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (driver?: any) => void;
  addDriver?: (driver: any) => Promise<any>;
}

// Removed login method options - now only uses auto-generated email

const VEHICLE_TYPES: VehicleType[] = ["Fiorino", "VUC", "Toco", "Truck", "Carreta", "Van", "Moto"];

const vehicleTypeLabels: Record<string, VehicleType> = {
  fiorino: "Fiorino",
  vuc: "VUC",
  toco: "Toco",
  truck: "Truck",
  carreta: "Carreta",
  van: "Van",
  moto: "Moto",
};

const isVehicleTypeConstraintError = (message?: string | null) =>
  !!message && message.includes("drivers_vehicle_type_check");

const getVehicleTypeCandidates = (dbValue: string, displayValue: string) =>
  Array.from(new Set([dbValue, displayValue, displayValue.toUpperCase()]));

const getVehicleTypeConstraintMessage = () =>
  "Tipo de veículo não aceito pelo banco de dados. Aplique a migration mais recente de tipos de veículo e tente novamente.";

const getDriverSaveErrorMessage = (message?: string | null) => {
  if (isVehicleTypeConstraintError(message)) {
    return "O banco ainda nao aceita este tipo de veiculo. Aplique a migration 20260427090000_fix_driver_vehicle_type_rpc.sql no Supabase e tente novamente.";
  }

  return message || "Erro ao cadastrar motorista";
};

export function NewDriverDialog({ open, onOpenChange, onSave, addDriver }: NewDriverDialogProps) {
  const [isOwnFleet, setIsOwnFleet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [documents, setDocuments] = useState<DriverDocuments>({});
  
  // Login creation state
  const [createLogin, setCreateLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form fields
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    phone: "",
    contactEmail: "",
    cnhNumber: "",
    cnhCategory: "d",
    vehicleType: "",
    vehiclePlate: "",
    bankName: "",
    agency: "",
    accountNumber: "",
    accountType: "corrente",
    pixKeyType: "",
    pixKeyValue: "",
  });

  // File input refs
  const cnhInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);
  const trailerInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = (type: keyof DriverDocuments, file: File) => {
    if (file.size > MAX_DRIVER_DOCUMENT_BYTES) {
      toast({
        title: "Arquivo muito grande",
        description: "Envie um arquivo de até 10MB.",
        variant: "destructive",
      });
      return;
    }
    const url = URL.createObjectURL(file);
    setDocuments(prev => ({
      ...prev,
      [type]: { name: file.name, url, uploadedAt: new Date(), file }
    }));
    toast({
      title: "📄 Documento anexado",
      description: `${file.name} será enviado ao salvar o motorista.`,
    });
  };

  const handleRemoveDocument = (type: keyof DriverDocuments) => {
    setDocuments(prev => {
      const newDocs = { ...prev };
      delete newDocs[type];
      return newDocs;
    });
  };

  // Auto-generate email and password from name and CPF
  const generateDriverEmail = (name: string, cpf: string): string => {
    if (!name.trim()) return "";
    const parts = name.trim().split(/\s+/).map(toEmailLocalPart).filter(Boolean);
    const firstName = parts[0] || "motorista";
    const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] : "";
    const cpfDigits = cpf.replace(/\D/g, "");
    const cpfSuffix = cpfDigits.length >= 4 ? cpfDigits.slice(-4) : "";
    return `${firstName}${lastInitial}${cpfSuffix}@driver.nahorafrota.app`;
  };
  
  // Generate password from CPF: first 6 digits + "Na"
  const generatePasswordFromCPF = (cpf: string): string => {
    const cleanCPF = cpf.replace(/\D/g, ''); // Remove non-digits
    if (cleanCPF.length >= 6) {
      return cleanCPF.substring(0, 6) + 'Na';
    }
    // Fallback if CPF is incomplete
    return 'Mudar123Na';
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "✅ Copiado!",
        description: `${label} copiado para a área de transferência.`,
      });
    } catch (err) {
      toast({
        title: "❌ Erro ao copiar",
        description: "Não foi possível copiar. Copie manualmente.",
        variant: "destructive",
      });
    }
  };
  
  const generatedEmail = generateDriverEmail(formData.name, formData.cpf);
  const generatedPassword = generatePasswordFromCPF(formData.cpf);

  // Generate login identifier - now always uses auto-generated email
  const getLoginIdentifier = (): string => {
    return generatedEmail;
  };

  const handleSave = async () => {
    if (isSaving) return;

    // Validate required fields
    if (!formData.name || !formData.cpf || !formData.phone || !formData.cnhNumber) {
      toast({
        title: "⚠️ Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios na aba Pessoal.",
        variant: "destructive",
      });
      setActiveTab("personal");
      return;
    }

    if (!isValidCPF(formData.cpf)) {
      toast({
        title: "⚠️ CPF inválido",
        description: "Confira os números do CPF do motorista.",
        variant: "destructive",
      });
      setActiveTab("personal");
      return;
    }

    // Sempre no formato 000.000.000-00: misturar com so digitos furava a checagem de CPF repetido.
    const cpfToSave = formatDocument(formData.cpf);

    if (formData.contactEmail.trim() && !isValidContactEmail(formData.contactEmail)) {
      toast({
        title: "⚠️ E-mail inválido",
        description: "Confira o e-mail do motorista que vai receber os dados de acesso.",
        variant: "destructive",
      });
      setActiveTab("personal");
      return;
    }

    if (!isOwnFleet && (!formData.vehicleType || !formData.vehiclePlate)) {
      toast({
        title: "⚠️ Dados do veículo",
        description: "Para motoristas terceiros, informe o tipo e placa do veículo.",
        variant: "destructive",
      });
      setActiveTab("vehicle");
      return;
    }

    // Validate login fields if creating login
    if (createLogin) {
      if (!generatedEmail) {
        toast({
          title: "⚠️ Nome obrigatório",
          description: "Preencha o nome para gerar o e-mail de login.",
          variant: "destructive",
        });
        return;
      }
      // Password is auto-generated from CPF format (6 primeiros dígitos + "Na")
    }

    setIsSaving(true);

    let createdUserId: string | null = null;
    let createdUserEmail: string | null = null;
    let createdDriverId: string | null = null;
    let loginEmailChanged = false;

    try {
      // Create login if enabled
      if (createLogin) {
        const loginIdentifier = getLoginIdentifier();

        const normalizedEmail = loginIdentifier.trim().toLowerCase();
        const normalizedPassword = generatedPassword.trim();
        const normalizedName = formData.name.trim();
        const normalizedPhone = formData.phone.trim() ? formData.phone.trim() : null;
        const normalizedCpf = cpfToSave;

        const { data, error } = await supabase.functions.invoke("create-user", {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: {
            email: normalizedEmail,
            password: normalizedPassword,
            name: normalizedName,
            phone: normalizedPhone,
            cpf: normalizedCpf,
            role: "viewer",
          },
        });

        // Check for error in response body
        if (data?.error) {
          const errMsg = data.error;
          if (errMsg.includes("already been registered") || errMsg.includes("email_exists")) {
            toast({
              title: "❌ Login já existe",
              description: "Este e-mail ou identificador já está cadastrado no sistema. Use outro e-mail ou desmarque 'Criar Login de Acesso'.",
              variant: "destructive",
            });
            setIsSaving(false);
            return;
          }
          // Show error with details
          toast({
            title: "❌ Erro ao criar login",
            description: errMsg,
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }

        // Check for function invocation error (non-2xx responses)
        if (error) {
          const info = await readEdgeFunctionError(error, "Não foi possível criar o login do motorista.");
          const cpfTaken = info.code === "cpf_already_exists" || /cpf/i.test(info.message);
          toast({
            title: cpfTaken ? "CPF já cadastrado" : info.status === 409 ? "Login já existe" : "Erro ao criar login",
            description: cpfTaken
              ? "Este CPF já está vinculado a outro motorista. Verifique se o motorista já existe na lista."
              : info.message,
            variant: "destructive",
          });
          console.error("Edge function error:", info, error);
          setIsSaving(false);
          return;
        }

        // Store the created user ID so the driver can be linked below.
        if (data?.user?.id) {
          createdUserId = data.user.id;
        }
        if (data?.user?.email) {
          createdUserEmail = data.user.email;
          loginEmailChanged = !!data.user.emailChanged || createdUserEmail !== getLoginIdentifier().trim().toLowerCase();
        }
        if (createdUserId) {
        toast({
          title: "✅ Login criado",
          description: `Login: ${createdUserEmail || generatedEmail}`,
        });
        }
        if (!createdUserId) {
          toast({
            title: "Erro ao criar login",
            description: "A função respondeu, mas não retornou o ID do usuário criado.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      }

      // Save driver to database
      const tenantId = await requireCurrentTenantId();
      const normalizedVehicleType = (() => {
        const vt = (formData.vehicleType || "").toLowerCase();
        if (vt.includes("fiorino")) return "fiorino";
        if (vt.includes("vuc")) return "vuc";
        if (vt.includes("toco")) return "toco";
        if (vt.includes("truck")) return "truck";
        if (vt.includes("carreta")) return "carreta";
        if (vt.includes("moto")) return "moto";
        return "van";
      })();
      const displayVehicleType = vehicleTypeLabels[normalizedVehicleType] || "Van";

      const driverData: any = {
        name: formData.name,
        cpf: cpfToSave,
        phone: formData.phone,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formData.name)}`,
        vehicle_plate: formData.vehiclePlate || "PENDENTE",
        vehicle_type: normalizedVehicleType,
        cnh: formData.cnhNumber,
        cnh_category: formData.cnhCategory.toUpperCase(),
        status: "active",
        is_own_fleet: isOwnFleet,
        daily_sla: 100,
        individual_sla: 100,
        deliveries_completed: 0,
        total_deliveries: 0,
        current_delay: 0,
        tenant_id: tenantId,
        banco: formData.bankName || null,
        agencia: formData.agency || null,
        conta: formData.accountNumber || null,
        tipo_conta: formData.accountType || "corrente",
        chave_pix: formData.pixKeyValue || null,
      };
      const vehicleTypeCandidates = getVehicleTypeCandidates(driverData.vehicle_type, displayVehicleType);
      const insertDriverDirectly = async () => {
        let lastVehicleTypeError: any = null;

        for (const vehicleType of vehicleTypeCandidates) {
          const { data, error } = await supabase
            .from("drivers")
            .insert({
              ...driverData,
              vehicle_type: vehicleType,
            })
            .select()
            .single();

          if (!error) return data;

          if (!isVehicleTypeConstraintError(error.message)) {
            throw error;
          }

          lastVehicleTypeError = error;
        }

        throw lastVehicleTypeError || new Error("Tipo de veículo não aceito pelo banco de dados");
      };

      // If login was created, link/create the driver row using the existing RPC.
      if (createdUserId) {
        const completeDriver = (vehicleType: string) =>
          supabase.rpc("create_driver_complete", {
            p_email: createdUserEmail || getLoginIdentifier().trim().toLowerCase(),
            p_name: driverData.name,
            p_phone: driverData.phone,
            p_cpf: driverData.cpf,
            p_vehicle_plate: driverData.vehicle_plate,
            p_vehicle_type: vehicleType,
          });

        let rpcResult: { success?: boolean; error?: string; driver_id?: string } | null = null;
        let persistedVehicleType = vehicleTypeCandidates[0];
        let lastVehicleTypeRpcError: Error | null = null;

        for (const vehicleType of vehicleTypeCandidates) {
          const { data: rpcData, error: rpcError } = await completeDriver(vehicleType);
          if (rpcError) {
            if (isVehicleTypeConstraintError(rpcError.message)) {
              lastVehicleTypeRpcError = new Error(rpcError.message);
              continue;
            }
            throw new Error(rpcError.message);
          }

          rpcResult = rpcData as { success?: boolean; error?: string; driver_id?: string } | null;
          persistedVehicleType = vehicleType;
          if (rpcResult?.success) break;
          if (isVehicleTypeConstraintError(rpcResult?.error)) {
            lastVehicleTypeRpcError = new Error(rpcResult.error);
            continue;
          }
          break;
        }

        if (!rpcResult?.success || !rpcResult.driver_id) {
          throw lastVehicleTypeRpcError || new Error(rpcResult?.error || "Falha ao concluir cadastro do motorista");
        }

        createdDriverId = rpcResult.driver_id;

        let updatedDriverData: any = null;
        let lastUpdateVehicleTypeError: any = null;

        for (const vehicleType of getVehicleTypeCandidates(persistedVehicleType, displayVehicleType)) {
          const { data: updatedDriver, error: dbError } = await supabase
            .from("drivers")
            .update({
              name: driverData.name,
              phone: driverData.phone,
              cpf: driverData.cpf,
              vehicle_plate: driverData.vehicle_plate,
              vehicle_type: vehicleType,
              avatar: driverData.avatar,
              cnh: driverData.cnh,
              cnh_category: driverData.cnh_category,
              is_own_fleet: driverData.is_own_fleet,
              banco: driverData.banco,
              agencia: driverData.agencia,
              conta: driverData.conta,
              tipo_conta: driverData.tipo_conta,
              chave_pix: driverData.chave_pix,
            })
            .eq("id", createdDriverId)
            .select("id, vehicle_type")
            .maybeSingle();

          if (!dbError) {
            updatedDriverData = updatedDriver;
            break;
          }

          if (!isVehicleTypeConstraintError(dbError.message)) {
            throw new Error(dbError.message);
          }

          lastUpdateVehicleTypeError = dbError;
        }

        if (!updatedDriverData) {
          throw new Error(lastUpdateVehicleTypeError?.message || getVehicleTypeConstraintMessage());
        }
      } else if (addDriver) {
        const savedDriver = await insertDriverDirectly();
        if (!savedDriver) {
          throw new Error("Falha ao salvar motorista no banco de dados");
        }
        createdDriverId = savedDriver.id;
      } else {
        // Fallback: save directly via Supabase (no login - insert new driver)
        const savedDriver = await insertDriverDirectly();
        createdDriverId = savedDriver?.id ?? null;
      }
      
      // Documentos anexados no cadastro (antes eram descartados ao salvar)
      const pendingDocuments = Object.entries(documents) as Array<[DriverDocumentType, DocumentFile]>;
      if (createdDriverId && pendingDocuments.length > 0) {
        const failed: string[] = [];
        for (const [type, doc] of pendingDocuments) {
          try {
            await uploadDriverDocument({ driverId: createdDriverId, tenantId, type, file: doc.file });
          } catch (uploadError) {
            console.error("Driver document upload error:", uploadError);
            failed.push(documentLabels[type]);
          }
        }
        if (failed.length > 0) {
          toast({
            title: "Documentos não enviados",
            description: `Motorista salvo, mas falhou o envio de: ${failed.join(", ")}. Envie novamente em Editar motorista.`,
            variant: "destructive",
          });
        }
      }

      onSave();

      // Dispara o e-mail com os dados de cadastro para o motorista
      if (createdDriverId && formData.contactEmail.trim()) {
        const emailResult = await sendDriverCredentialsEmail({
          driverId: createdDriverId,
          contactEmail: formData.contactEmail,
          password: createLogin ? generatedPassword : null,
        });
        const feedback = describeCredentialsEmailResult(emailResult);
        if (feedback) {
          toast({
            title: feedback.title,
            description: feedback.description,
            variant: feedback.kind === "error" ? "destructive" : undefined,
          });
        }
      }
      if (createLogin) {
        toast({
          title: loginEmailChanged ? "Motorista cadastrado com login ajustado" : "Motorista cadastrado com login",
          description: `Login: ${createdUserEmail || generatedEmail} | Senha: ${generatedPassword}`,
        });
      } else {
        toast({
          title: "Motorista cadastrado",
          description: `${driverData.name} foi adicionado e está disponível em todo o sistema.`,
        });
      }
      
      // Reset form
      setFormData({
        name: "",
        cpf: "",
        phone: "",
        contactEmail: "",
        cnhNumber: "",
        cnhCategory: "d",
        vehicleType: "",
        vehiclePlate: "",
        bankName: "",
        agency: "",
        accountNumber: "",
        accountType: "corrente",
        pixKeyType: "",
        pixKeyValue: "",
      });
      setDocuments({});
      setIsOwnFleet(false);
      setActiveTab("personal");
      setCreateLogin(false);
    } catch (err: any) {
      console.error("Error saving driver:", err);
      // Login criado mas cadastro do motorista falhou: remove o login para nao
      // deixar um acesso solto (e liberar o e-mail para a proxima tentativa).
      if (createdUserId && !createdDriverId) {
        const { data: rollback, error: rollbackError } = await supabase.rpc("delete_user_complete", {
          p_user_id: createdUserId,
        });
        if (rollbackError || !(rollback as { success?: boolean } | null)?.success) {
          console.error("Rollback do login do motorista falhou:", rollbackError || rollback);
        }
      }
      const errorMessage = getDriverSaveErrorMessage(err?.message);
      if (isVehicleTypeConstraintError(err?.message)) {
        setActiveTab("vehicle");
      }
      toast({
        title: "❌ Erro ao cadastrar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setActiveTab("personal");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="top-[5dvh] flex max-h-[90dvh] min-h-0 w-[calc(100vw-2rem)] translate-y-0 flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Cadastrar Novo Motorista
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do motorista. Após o cadastro, ele será enviado para aprovação de risco.
          </DialogDescription>
        </DialogHeader>

        {/* Driver Type Toggle - Always visible */}
        <div className="flex shrink-0 items-center justify-between rounded-lg border bg-secondary/30 p-3">
          <div className="space-y-0.5">
            <Label htmlFor="new-own-fleet-toggle" className="text-sm cursor-pointer font-medium">
              Motorista da Casa (CLT)
            </Label>
            <p className="text-xs text-muted-foreground">
              {isOwnFleet 
                ? "Utilizará veículos da frota própria" 
                : "Agregado/terceiro com veículo próprio"}
            </p>
          </div>
          <Switch
            id="new-own-fleet-toggle"
            checked={isOwnFleet}
            onCheckedChange={setIsOwnFleet}
          />
        </div>

        {isOwnFleet ? (
          // CLT Driver - Simple form without vehicle/documents
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
              <div className="flex items-center gap-2 text-primary font-medium">
                <Building2 className="h-4 w-4" />
                Motorista CLT selecionado
              </div>
              <p className="text-muted-foreground mt-1">
                Este motorista selecionará um veículo da frota ao iniciar uma rota.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input 
                placeholder="Nome do motorista" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input 
                  placeholder="000.000.000-00" 
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input 
                  placeholder="(11) 99999-0000" 
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-mail do motorista</Label>
              <Input 
                type="email"
                placeholder="motorista@email.com" 
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Recebe por e-mail os dados do cadastro e o acesso ao app.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNH *</Label>
                <Input 
                  placeholder="Número da CNH" 
                  value={formData.cnhNumber}
                  onChange={(e) => setFormData({ ...formData, cnhNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select 
                  value={formData.cnhCategory} 
                  onValueChange={(v) => setFormData({ ...formData, cnhCategory: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="a">A</SelectItem>
                    <SelectItem value="b">B</SelectItem>
                    <SelectItem value="c">C</SelectItem>
                    <SelectItem value="d">D</SelectItem>
                    <SelectItem value="e">E</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Login Creation Section for CLT */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-0.5">
                  <Label htmlFor="create-login-clt" className="text-sm font-medium flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Criar Login de Acesso
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Permite que o motorista acesse o app
                  </p>
                </div>
                <Switch
                  id="create-login-clt"
                  checked={createLogin}
                  onCheckedChange={setCreateLogin}
                />
              </div>

              {createLogin && (
                <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                  {/* Auto-generated email display */}
                  <div className="space-y-2">
                    <Label className="text-sm">E-mail de Login</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        value={generatedEmail}
                        disabled
                        className="bg-muted font-mono flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(generatedEmail, "E-mail")}
                        title="Copiar e-mail"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gerado automaticamente a partir do nome e CPF
                    </p>
                  </div>

                  {/* Password (CPF-based) */}
                  <div className="space-y-2">
                    <Label className="text-sm">Senha padrão (CPF)</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={generatedPassword}
                          disabled
                          className="pr-10 bg-muted font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(generatedPassword, "Senha")}
                        title="Copiar senha"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Formato: 6 primeiros dígitos do CPF + "Na" (ex: 123456Na)
                    </p>
                  </div>

                  {!formData.name && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                      <p className="text-amber-600 dark:text-amber-400">
                        ⚠️ Preencha o nome para gerar o e-mail de login
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Third-party Driver - Full form with tabs
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TabsList className="grid shrink-0 grid-cols-4">
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

            <div className="min-h-0 flex-1 overflow-y-auto py-4 pr-1">
              {/* Personal Data */}
              <TabsContent value="personal" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input 
                    placeholder="Nome do motorista" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CPF *</Label>
                    <Input 
                      placeholder="000.000.000-00" 
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone *</Label>
                    <Input 
                      placeholder="(11) 99999-0000" 
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>E-mail do motorista</Label>
                  <Input 
                    type="email"
                    placeholder="motorista@email.com" 
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Recebe por e-mail os dados do cadastro e o acesso ao app.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CNH *</Label>
                    <Input 
                      placeholder="Número da CNH" 
                      value={formData.cnhNumber}
                      onChange={(e) => setFormData({ ...formData, cnhNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select 
                      value={formData.cnhCategory} 
                      onValueChange={(v) => setFormData({ ...formData, cnhCategory: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="a">A</SelectItem>
                        <SelectItem value="b">B</SelectItem>
                        <SelectItem value="c">C</SelectItem>
                        <SelectItem value="d">D</SelectItem>
                        <SelectItem value="e">E</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Login Creation Section for Third-party */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="create-login-third" className="text-sm font-medium flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-primary" />
                        Criar Login de Acesso
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Permite que o motorista acesse o app
                      </p>
                    </div>
                    <Switch
                      id="create-login-third"
                      checked={createLogin}
                      onCheckedChange={setCreateLogin}
                    />
                  </div>

                  {createLogin && (
                    <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                      {/* Auto-generated email display */}
                      <div className="space-y-2">
                        <Label className="text-sm">E-mail de Login</Label>
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            value={generatedEmail}
                            disabled
                            className="bg-muted font-mono flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(generatedEmail, "E-mail")}
                            title="Copiar e-mail"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Gerado automaticamente a partir do nome e CPF
                        </p>
                      </div>

                      {/* Password (CPF-based) */}
                      <div className="space-y-2">
                        <Label className="text-sm">Senha padrão (CPF)</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={generatedPassword}
                              disabled
                              className="pr-10 bg-muted font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                            </button>
                           </div>
                           <Button
                             type="button"
                             variant="outline"
                             size="icon"
                             onClick={() => copyToClipboard(generatedPassword, "Senha")}
                             title="Copiar senha"
                           >
                             <Copy className="h-4 w-4" />
                           </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Formato: 6 primeiros dígitos do CPF + "Na" (ex: 123456Na)
                        </p>
                      </div>

                      {!formData.name && (
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                          <p className="text-amber-600 dark:text-amber-400">
                            ⚠️ Preencha o nome para gerar o e-mail de login
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Vehicle Data */}
              <TabsContent value="vehicle" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Veículo *</Label>
                  <Select 
                    value={formData.vehicleType} 
                    onValueChange={(v) => setFormData({ ...formData, vehicleType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {VEHICLE_TYPES.map((vt) => (
                        <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Placa do Veículo *</Label>
                  <Input 
                    placeholder="ABC-1234" 
                    value={formData.vehiclePlate}
                    onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })}
                    className="uppercase"
                  />
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
                    
                    <input
                      type="file"
                      ref={documentRefs[docType]}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(docType, file);
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
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(documents[docType]?.url, '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => documentRefs[docType].current?.click()}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveDocument(docType)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={() => documentRefs[docType].current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Fazer Upload
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
                  <Label>Nome do Banco</Label>
                  <Input
                    placeholder="Ex: Banco do Brasil, Itaú..."
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input
                      placeholder="1234"
                      value={formData.agency}
                      onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta (com dígito)</Label>
                    <Input
                      placeholder="56789-0"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Conta</Label>
                  <Select
                    value={formData.accountType}
                    onValueChange={(v) => setFormData({ ...formData, accountType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de conta" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="corrente">Conta Corrente</SelectItem>
                      <SelectItem value="poupanca">Conta Poupanca</SelectItem>
                      <SelectItem value="salario">Conta Salario</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t border-border pt-4 mt-2">
                  <h5 className="text-sm font-medium text-muted-foreground mb-3">Dados PIX</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Tipo de Chave</Label>
                      <Select
                        value={formData.pixKeyType}
                        onValueChange={(v) => setFormData({ ...formData, pixKeyType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="phone">Telefone</SelectItem>
                          <SelectItem value="random">Chave Aleatória</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Chave PIX</Label>
                      <Input
                        placeholder="Sua chave PIX"
                        value={formData.pixKeyValue}
                        onChange={(e) => setFormData({ ...formData, pixKeyValue: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        )}

        <DialogFooter className="shrink-0 border-t border-border pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Cadastrar Motorista"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
