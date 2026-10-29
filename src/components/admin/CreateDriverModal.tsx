import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { readEdgeFunctionError, toEmailLocalPart } from "@/lib/edgeFunctionError";
import { z } from "zod";
import { isValidCPF } from "@/lib/documentValidation";
import { describeCredentialsEmailResult, isValidContactEmail, sendDriverCredentialsEmail } from "@/lib/driverCredentials";
import { FormField } from "@/components/patterns/FormField";

function generatePasswordFromCPF(cpf: string): string {
  const cleanCPF = cpf.replace(/\D/g, "");
  if (cleanCPF.length >= 6) {
    return cleanCPF.substring(0, 6) + "Na";
  }

  return "Mudar123Na";
}

function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

function normalizeVehiclePlate(plate: string): string {
  return plate.replace(/\s+/g, "").toUpperCase();
}

const VEHICLE_TYPES = [
  { value: "moto", label: "Moto" },
  { value: "fiorino", label: "Fiorino" },
  { value: "van", label: "Van" },
  { value: "vuc", label: "VUC" },
  { value: "toco", label: "Toco" },
  { value: "truck", label: "Truck" },
  { value: "carreta", label: "Carreta" },
] as const;

const createDriverSchema = z.object({
  name: z.string().min(2, "Digite o nome completo (pelo menos 2 letras).").max(100),
  email: z.string().email("E-mail inválido").max(255),
  phone: z.string().optional(),
  cpf: z
    .string()
    .transform((value) => normalizeCPF(value))
    .refine((value) => value.length === 11, "O CPF precisa ter 11 números.")
    .refine((value) => isValidCPF(value), "CPF inválido. Confira os números."),
  vehiclePlate: z
    .string()
    .optional()
    .transform((value) => normalizeVehiclePlate(value || "")),
  vehicleType: z.string().optional(),
});

type FieldKey = "name" | "cpf" | "contactEmail";
// Ordem dos campos na tela (para focar o primeiro com erro).
const FIELD_IDS: Record<FieldKey, string> = { name: "driver-name", cpf: "driver-cpf", contactEmail: "driver-contact-email" };

interface CreateDriverModalProps {
  onUserCreated?: () => void;
}

export function CreateDriverModal({ onUserCreated }: CreateDriverModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleType, setVehicleType] = useState<string>("van");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const password = generatePasswordFromCPF(cpf);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setContactEmail("");
    setCpf("");
    setVehiclePlate("");
    setVehicleType("van");
    setShowPassword(false);
    setErrors({});
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      resetForm();
    }
    setOpen(newOpen);
  };

  useEffect(() => {
    if (!name) {
      setEmail("");
      return;
    }

    const nameParts = name.trim().split(/\s+/).map(toEmailLocalPart).filter(Boolean);
    const firstName = nameParts[0] || "motorista";
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const autoEmail = lastName
      ? `${firstName}.${lastName}@driver.nahorafrota.app`
      : `${firstName}@driver.nahorafrota.app`;
    setEmail(autoEmail);
  }, [name]);

  const showErrors = (next: Partial<Record<FieldKey, string>>) => {
    setErrors(next);
    const first = (Object.keys(FIELD_IDS) as FieldKey[]).find((key) => next[key]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  };

  const clearError = (key: FieldKey) => errors[key] && setErrors((prev) => ({ ...prev, [key]: undefined }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const validation = createDriverSchema.safeParse({
      name,
      email,
      phone: phone || undefined,
      cpf,
      vehiclePlate,
      vehicleType,
    });

    if (!validation.success) {
      const next: Partial<Record<FieldKey, string>> = {};
      for (const issue of validation.error.errors) {
        const key = issue.path[0];
        if ((key === "name" || key === "cpf") && !next[key]) next[key] = issue.message;
      }
      // O e-mail de login e gerado pelo nome: erro nele = nome invalido.
      if (!next.name && !next.cpf) next.name = validation.error.errors[0].message;
      showErrors(next);
      return;
    }

    if (contactEmail.trim() && !isValidContactEmail(contactEmail)) {
      showErrors({ contactEmail: "Confira o e-mail do motorista. Exemplo: nome@email.com" });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPassword = password.trim();
      const normalizedName = name.trim();
      const normalizedPhone = phone.trim() ? phone.trim() : null;
      const normalizedCpf = validation.data.cpf;
      const normalizedVehiclePlate = validation.data.vehiclePlate || null;
      const normalizedVehicleType = validation.data.vehicleType || "van";

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        toast.error("Sessão expirada. Entre de novo para continuar.");
        return;
      }

      const { data: edgeData, error: edgeError } = await supabase.functions.invoke("create-driver", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: {
          email: normalizedEmail,
          password: normalizedPassword,
          name: normalizedName,
          phone: normalizedPhone,
          cpf: normalizedCpf,
          vehiclePlate: normalizedVehiclePlate,
          vehicleType: normalizedVehicleType,
        },
      });

      if (edgeError) {
        const info = await readEdgeFunctionError(edgeError, "Erro ao salvar motorista");
        console.error("create-driver error:", info, edgeError);
        toast.error(info.message);
        return;
      }

      if (!edgeData?.success) {
        toast.error(edgeData?.error || "Erro ao salvar motorista");
        return;
      }

      const finalEmail = edgeData.user?.email || normalizedEmail;
      if (edgeData.user?.emailChanged) {
        toast.info(`O login ficou ${finalEmail}, porque o e-mail original já existia.`);
      }

      if (!edgeData.driver?.id) {
        toast.error("Erro: cadastro retornou sem o ID do motorista");
        return;
      }

      toast.success(
        edgeData.updated
          ? `Motorista ${normalizedName} atualizado.`
          : `Motorista ${normalizedName} cadastrado.`,
      );

      // Dispara o e-mail com os dados de cadastro para o motorista
      if (contactEmail.trim()) {
        const emailResult = await sendDriverCredentialsEmail({
          driverId: edgeData.driver.id,
          contactEmail,
          password: normalizedPassword,
        });
        const feedback = describeCredentialsEmailResult(emailResult);
        if (feedback) {
          const notify = feedback.kind === "success" ? toast.success : feedback.kind === "warning" ? toast.warning : toast.error;
          notify(feedback.title, { description: feedback.description });
        }
      }

      resetForm();
      setOpen(false);
      onUserCreated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar motorista";
      console.error("Error creating driver:", err);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden="true" />
          Cadastrar motorista
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar motorista</DialogTitle>
          <DialogDescription>O motorista recebe um login para usar o aplicativo no celular.</DialogDescription>
        </DialogHeader>

        <form id="create-driver-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField id="driver-name" label="Nome completo" error={errors.name}>
            {(control) => (
              <Input
                {...control}
                value={name}
                autoComplete="off"
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                placeholder="Nome do motorista"
                disabled={isLoading}
              />
            )}
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="driver-cpf" label="CPF" error={errors.cpf}>
              {(control) => (
                <Input
                  {...control}
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => {
                    setCpf(e.target.value);
                    clearError("cpf");
                  }}
                  placeholder="000.000.000-00"
                  disabled={isLoading}
                />
              )}
            </FormField>

            <FormField id="driver-phone" label="Telefone" optional>
              {(control) => (
                <Input
                  {...control}
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  disabled={isLoading}
                />
              )}
            </FormField>
          </div>

          <FormField
            id="driver-contact-email"
            label="E-mail do motorista"
            optional
            error={errors.contactEmail}
            hint="Se preencher, ele recebe os dados de acesso por e-mail."
          >
            {(control) => (
              <Input
                {...control}
                type="email"
                inputMode="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  clearError("contactEmail");
                }}
                placeholder="motorista@email.com"
                disabled={isLoading}
              />
            )}
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="driver-plate" label="Placa" optional>
              {(control) => (
                <Input
                  {...control}
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="ABC1D23"
                  className="uppercase"
                  disabled={isLoading}
                />
              )}
            </FormField>

            <FormField id="driver-vehicle-type" label="Tipo de veículo">
              {(control) => (
                <Select value={vehicleType} onValueChange={setVehicleType} disabled={isLoading}>
                  <SelectTrigger {...control}>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>

          {/* Login do app: gerado sozinho a partir do nome e do CPF */}
          <section aria-labelledby="driver-login-titulo" className="rounded-lg border bg-muted/40 p-4">
            <p id="driver-login-titulo" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
              Login do aplicativo
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">E-mail de login</dt>
                <dd className="min-w-0 break-all font-data text-foreground">{email || "Aparece ao digitar o nome"}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Senha</dt>
                <dd className="flex items-center gap-1">
                  <span className="font-data text-foreground">{showPassword ? password : "••••••••"}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              A senha é formada pelos 6 primeiros números do CPF e as letras “Na” (exemplo: 123456Na).
            </p>
          </section>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="create-driver-form" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
            {isLoading ? "Salvando..." : "Salvar motorista"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
