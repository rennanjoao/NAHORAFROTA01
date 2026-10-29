import { useState } from "react";
import { Building2, Car, FileText, Landmark, Loader2, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { VehicleType } from "@/contexts/LogisticsContext";
import { supabase } from "@/integrations/supabase/client";
import { describeCredentialsEmailResult, isValidContactEmail, sendDriverCredentialsEmail } from "@/lib/driverCredentials";
import { formatDocument, isValidCPF } from "@/lib/documentValidation";
import { requireCurrentTenantId } from "@/lib/tenant";
import { readEdgeFunctionError, toEmailLocalPart } from "@/lib/edgeFunctionError";
import { MAX_DRIVER_DOCUMENT_BYTES, uploadDriverDocument, type DriverDocumentType } from "@/lib/driverDocuments";
import { CNH_CATEGORIES, DRIVER_DOCUMENT_KEYS, DRIVER_DOCUMENT_LABELS, DRIVER_VEHICLE_TYPES } from "./driverConfig";
import { AppLoginFields, BankFields, DocumentSlot, DocumentSlotList, DriverKindChoice, invalidSelectClass, type BankValues } from "./DriverFormParts";
import { FieldGroup, FormField } from "./FormField";
import { TabErrorDot } from "./TabErrorDot";
import { useReturnFocus } from "./useReturnFocus";

interface DocumentFile {
  name: string;
  url: string;
  uploadedAt: Date;
  file: File;
}

type DriverDocuments = Partial<Record<DriverDocumentType, DocumentFile>>;

interface NewDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (driver?: any) => void;
  addDriver?: (driver: any) => Promise<any>;
}

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

const emptyForm = () => ({
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
  pixKeyValue: "",
});

type FormData = ReturnType<typeof emptyForm>;
type FieldKey = "name" | "cpf" | "phone" | "contactEmail" | "cnhNumber" | "vehicleType" | "vehiclePlate";
type FieldErrors = Partial<Record<FieldKey, string>>;

// Ordem de foco quando ha erro, e em que aba cada campo esta.
const FIELD_ORDER: { key: FieldKey; id: string; tab: "personal" | "vehicle" }[] = [
  { key: "name", id: "new-name", tab: "personal" },
  { key: "cpf", id: "new-cpf", tab: "personal" },
  { key: "phone", id: "new-phone", tab: "personal" },
  { key: "contactEmail", id: "new-email", tab: "personal" },
  { key: "cnhNumber", id: "new-cnh", tab: "personal" },
  { key: "vehicleType", id: "new-vehicle-type", tab: "vehicle" },
  { key: "vehiclePlate", id: "new-vehicle-plate", tab: "vehicle" },
];

export function NewDriverDialog({ open, onOpenChange, onSave, addDriver }: NewDriverDialogProps) {
  const [isOwnFleet, setIsOwnFleet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const returnFocus = useReturnFocus();
  const [activeTab, setActiveTab] = useState("personal");
  const [documents, setDocuments] = useState<DriverDocuments>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [createLogin, setCreateLogin] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  const update = (patch: Partial<FormData>) => {
    setFormData((current) => ({ ...current, ...patch }));
    const touched = Object.keys(patch) as FieldKey[];
    if (touched.some((key) => errors[key])) {
      setErrors((current) => {
        const next = { ...current };
        touched.forEach((key) => delete next[key]);
        return next;
      });
    }
  };

  const handleFileUpload = (type: DriverDocumentType, file: File) => {
    if (file.size > MAX_DRIVER_DOCUMENT_BYTES) {
      toast({
        title: "Arquivo muito grande",
        description: "Envie um arquivo de até 10 MB.",
        variant: "destructive",
      });
      return;
    }
    const url = URL.createObjectURL(file);
    setDocuments((prev) => ({
      ...prev,
      [type]: { name: file.name, url, uploadedAt: new Date(), file },
    }));
    toast({
      title: "Documento anexado",
      description: `${file.name} será enviado ao salvar o motorista.`,
    });
  };

  const handleRemoveDocument = (type: DriverDocumentType) => {
    setDocuments((prev) => {
      const newDocs = { ...prev };
      delete newDocs[type];
      return newDocs;
    });
  };

  // E-mail e senha do app gerados a partir do nome e do CPF.
  const generateDriverEmail = (name: string, cpf: string): string => {
    if (!name.trim()) return "";
    const parts = name.trim().split(/\s+/).map(toEmailLocalPart).filter(Boolean);
    const firstName = parts[0] || "motorista";
    const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] : "";
    const cpfDigits = cpf.replace(/\D/g, "");
    const cpfSuffix = cpfDigits.length >= 4 ? cpfDigits.slice(-4) : "";
    return `${firstName}${lastInitial}${cpfSuffix}@driver.nahorafrota.app`;
  };

  // Senha: 6 primeiros digitos do CPF + "Na".
  const generatePasswordFromCPF = (cpf: string): string => {
    const cleanCPF = cpf.replace(/\D/g, "");
    if (cleanCPF.length >= 6) {
      return cleanCPF.substring(0, 6) + "Na";
    }
    return "Mudar123Na";
  };

  const generatedEmail = generateDriverEmail(formData.name, formData.cpf);
  const generatedPassword = generatePasswordFromCPF(formData.cpf);
  const getLoginIdentifier = (): string => generatedEmail;

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!formData.name.trim()) next.name = "Informe o nome completo.";
    if (!formData.cpf.trim()) next.cpf = "Informe o CPF.";
    else if (!isValidCPF(formData.cpf)) next.cpf = "CPF inválido. Confira os números.";
    if (!formData.phone.trim()) next.phone = "Informe o telefone com DDD.";
    if (formData.contactEmail.trim() && !isValidContactEmail(formData.contactEmail)) {
      next.contactEmail = "E-mail inválido. Confira o endereço.";
    }
    if (!formData.cnhNumber.trim()) next.cnhNumber = "Informe o número da CNH.";
    if (!isOwnFleet) {
      if (!formData.vehicleType) next.vehicleType = "Escolha o tipo de veículo.";
      if (!formData.vehiclePlate.trim()) next.vehiclePlate = "Informe a placa do veículo.";
    }
    return next;
  };

  const showErrors = (found: FieldErrors) => {
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field.key]);
    if (!first) return;
    setActiveTab(first.tab);
    // Espera a aba aparecer para levar o foco ao primeiro campo com erro.
    window.setTimeout(() => document.getElementById(first.id)?.focus(), 60);
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setDocuments({});
    setErrors({});
    setIsOwnFleet(false);
    setActiveTab("personal");
    setCreateLogin(false);
  };

  const handleSave = async () => {
    if (isSaving) return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }

    // Sempre no formato 000.000.000-00: misturar com so digitos furava a checagem de CPF repetido.
    const cpfToSave = formatDocument(formData.cpf);

    setIsSaving(true);

    let createdUserId: string | null = null;
    let createdUserEmail: string | null = null;
    let createdDriverId: string | null = null;
    let loginEmailChanged = false;

    try {
      // Cria o login do app, se pedido.
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

        if (data?.error) {
          const errMsg = data.error;
          if (errMsg.includes("already been registered") || errMsg.includes("email_exists")) {
            toast({
              title: "Login já existe",
              description: "Este e-mail de acesso já está em uso. Confira se o motorista já foi cadastrado ou desligue Criar acesso ao aplicativo.",
              variant: "destructive",
            });
            setIsSaving(false);
            return;
          }
          toast({
            title: "Não foi possível criar o login",
            description: errMsg,
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }

        // Erro da funcao (resposta fora de 2xx).
        if (error) {
          const info = await readEdgeFunctionError(error, "Não foi possível criar o login do motorista.");
          const cpfTaken = info.code === "cpf_already_exists" || /cpf/i.test(info.message);
          toast({
            title: cpfTaken ? "CPF já cadastrado" : info.status === 409 ? "Login já existe" : "Não foi possível criar o login",
            description: cpfTaken
              ? "Este CPF já está ligado a outro motorista. Confira se o motorista já está na lista."
              : info.message,
            variant: "destructive",
          });
          if (cpfTaken) showErrors({ cpf: "Este CPF já está cadastrado." });
          console.error("Edge function error:", info, error);
          setIsSaving(false);
          return;
        }

        if (data?.user?.id) {
          createdUserId = data.user.id;
        }
        if (data?.user?.email) {
          createdUserEmail = data.user.email;
          loginEmailChanged = !!data.user.emailChanged || createdUserEmail !== getLoginIdentifier().trim().toLowerCase();
        }
        if (createdUserId) {
          toast({
            title: "Login criado",
            description: `Login: ${createdUserEmail || generatedEmail}`,
          });
        }
        if (!createdUserId) {
          toast({
            title: "Não foi possível criar o login",
            description: "A função respondeu, mas não retornou o ID do usuário criado.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      }

      // Grava o motorista.
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

      // Com login criado, liga/cria o motorista pela RPC existente.
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
        // Sem login: grava direto no Supabase.
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
            failed.push(DRIVER_DOCUMENT_LABELS[type]);
          }
        }
        if (failed.length > 0) {
          toast({
            title: "Documentos não enviados",
            description: `Motorista salvo, mas falhou o envio de: ${failed.join(", ")}. Envie de novo em Editar dados.`,
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

      resetForm();
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
        title: "Não foi possível cadastrar",
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
    setErrors({});
  };

  const bankValues: BankValues = {
    banco: formData.bankName,
    agencia: formData.agency,
    conta: formData.accountNumber,
    tipo_conta: formData.accountType,
    chave_pix: formData.pixKeyValue,
  };

  const personalHasError = Boolean(errors.name || errors.cpf || errors.phone || errors.contactEmail || errors.cnhNumber);
  const vehicleHasError = Boolean(errors.vehicleType || errors.vehiclePlate);

  const personalFields = (
    <div className="space-y-4">
      <FormField id="new-name" label="Nome completo" required error={errors.name}>
        {(control) => (
          <Input {...control} placeholder="Nome do motorista" autoComplete="off" value={formData.name} onChange={(e) => update({ name: e.target.value })} />
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="new-cpf" label="CPF" required error={errors.cpf}>
          {(control) => (
            <Input {...control} placeholder="000.000.000-00" inputMode="numeric" value={formData.cpf} onChange={(e) => update({ cpf: e.target.value })} />
          )}
        </FormField>
        <FormField id="new-phone" label="Telefone (WhatsApp)" required error={errors.phone}>
          {(control) => (
            <Input {...control} type="tel" placeholder="(11) 99999-0000" value={formData.phone} onChange={(e) => update({ phone: e.target.value })} />
          )}
        </FormField>
      </div>
      <FormField
        id="new-email"
        label="E-mail do motorista"
        optional
        error={errors.contactEmail}
        hint="Recebe por e-mail os dados do cadastro e o acesso ao aplicativo."
      >
        {(control) => (
          <Input {...control} type="email" placeholder="motorista@email.com" value={formData.contactEmail} onChange={(e) => update({ contactEmail: e.target.value })} />
        )}
      </FormField>
      <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-4">
        <FormField id="new-cnh" label="Número da CNH" required error={errors.cnhNumber}>
          {(control) => (
            <Input {...control} placeholder="Número da CNH" inputMode="numeric" value={formData.cnhNumber} onChange={(e) => update({ cnhNumber: e.target.value })} />
          )}
        </FormField>
        <FormField id="new-cnh-category" label="Categoria">
          {(control) => (
            <Select value={formData.cnhCategory} onValueChange={(value) => update({ cnhCategory: value })}>
              <SelectTrigger {...control}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CNH_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>
      <AppLoginFields
        enabled={createLogin}
        onEnabledChange={setCreateLogin}
        email={generatedEmail}
        password={generatedPassword}
        hasName={Boolean(formData.name.trim())}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent {...returnFocus} className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden sm:h-[min(90vh,50rem)] sm:max-h-[90vh] sm:max-w-2xl">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>Cadastrar motorista</DialogTitle>
          <DialogDescription>
            Preencha os dados do motorista. Depois do cadastro, ele passa pela aprovação de risco.
          </DialogDescription>
        </DialogHeader>

        <form
          id="new-driver-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
          className="-mx-5 min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5 sm:-mx-6 sm:px-6"
        >
          <FieldGroup title="Tipo de motorista">
            <DriverKindChoice isOwnFleet={isOwnFleet} onChange={setIsOwnFleet} />
          </FieldGroup>

          {isOwnFleet ? (
            <div className="space-y-4">
              <Alert variant="info">
                <Building2 aria-hidden="true" />
                <AlertDescription>
                  O motorista da casa escolhe um veículo da empresa ao começar cada rota. Veículo, documentos e dados bancários não são pedidos.
                </AlertDescription>
              </Alert>
              {personalFields}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="sticky top-0 z-10 grid h-auto w-full grid-cols-4 shadow-[0_0_0_4px_hsl(var(--popover))]">
                <TabsTrigger value="personal" className="h-8 gap-1.5 px-1.5 text-xs sm:text-sm">
                  <User className="hidden sm:block" aria-hidden="true" />
                  Pessoal
                  <TabErrorDot show={personalHasError} />
                </TabsTrigger>
                <TabsTrigger value="vehicle" className="h-8 gap-1.5 px-1.5 text-xs sm:text-sm">
                  <Car className="hidden sm:block" aria-hidden="true" />
                  Veículo
                  <TabErrorDot show={vehicleHasError} />
                </TabsTrigger>
                <TabsTrigger value="documents" className="h-8 gap-1.5 px-1.5 text-xs sm:text-sm">
                  <FileText className="hidden sm:block" aria-hidden="true" />
                  Documentos
                </TabsTrigger>
                <TabsTrigger value="banking" className="h-8 gap-1.5 px-1.5 text-xs sm:text-sm">
                  <Landmark className="hidden sm:block" aria-hidden="true" />
                  Pagamento
                </TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="mt-5">
                {personalFields}
              </TabsContent>

              <TabsContent value="vehicle" className="mt-5 space-y-4">
                <p className="text-sm text-muted-foreground">O veículo que o agregado usa nas entregas.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="new-vehicle-type" label="Tipo de veículo" required error={errors.vehicleType}>
                    {(control) => (
                      <Select value={formData.vehicleType} onValueChange={(value) => update({ vehicleType: value })}>
                        <SelectTrigger {...control} className={invalidSelectClass}>
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
                  <FormField id="new-vehicle-plate" label="Placa" required error={errors.vehiclePlate} hint="Placa antiga ou Mercosul.">
                    {(control) => (
                      <Input
                        {...control}
                        placeholder="ABC1D23"
                        autoComplete="off"
                        className="font-data uppercase tracking-wider"
                        value={formData.vehiclePlate}
                        onChange={(e) => update({ vehiclePlate: e.target.value.toUpperCase() })}
                      />
                    )}
                  </FormField>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="mt-5">
                <DocumentSlotList note={<p className="text-sm text-muted-foreground">Opcional. Os arquivos são enviados quando você salvar o motorista.</p>}>
                  {DRIVER_DOCUMENT_KEYS.map((type) => (
                    <DocumentSlot
                      key={type}
                      id={`new-doc-${type}`}
                      label={DRIVER_DOCUMENT_LABELS[type]}
                      pickLabel="Anexar"
                      file={documents[type]}
                      onFile={(file) => handleFileUpload(type, file)}
                      onOpen={documents[type] ? () => window.open(documents[type]?.url, "_blank") : undefined}
                      onRemove={documents[type] ? () => handleRemoveDocument(type) : undefined}
                    />
                  ))}
                </DocumentSlotList>
              </TabsContent>

              <TabsContent value="banking" className="mt-5 space-y-4">
                <p className="text-sm text-muted-foreground">Opcional. Usado para pagar o frete no acerto financeiro.</p>
                <BankFields
                  idPrefix="new-"
                  values={bankValues}
                  onChange={(patch) =>
                    update({
                      ...(patch.banco !== undefined && { bankName: patch.banco }),
                      ...(patch.agencia !== undefined && { agency: patch.agencia }),
                      ...(patch.conta !== undefined && { accountNumber: patch.conta }),
                      ...(patch.tipo_conta !== undefined && { accountType: patch.tipo_conta }),
                      ...(patch.chave_pix !== undefined && { pixKeyValue: patch.chave_pix }),
                    })
                  }
                />
              </TabsContent>
            </Tabs>
          )}
        </form>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" form="new-driver-form" disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isSaving ? "Salvando..." : "Cadastrar motorista"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
