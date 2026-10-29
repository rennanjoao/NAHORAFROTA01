import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { readEdgeFunctionError, toEmailLocalPart } from "@/lib/edgeFunctionError";
import { z } from "zod";
import { isValidCPF } from "@/lib/documentValidation";
import { describeCredentialsEmailResult, isValidContactEmail, sendDriverCredentialsEmail } from "@/lib/driverCredentials";

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
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("E-mail inválido").max(255),
  phone: z.string().optional(),
  cpf: z
    .string()
    .transform((value) => normalizeCPF(value))
    .refine((value) => value.length === 11, "CPF deve ter 11 dígitos")
    .refine((value) => isValidCPF(value), "CPF inválido"),
  vehiclePlate: z
    .string()
    .optional()
    .transform((value) => normalizeVehiclePlate(value || "")),
  vehicleType: z.string().optional(),
});

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

  const handleSubmit = async (e: React.FormEvent) => {
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
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (contactEmail.trim() && !isValidContactEmail(contactEmail)) {
      toast.error("E-mail do motorista inválido");
      return;
    }

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
        toast.error("Sessão expirada. Faça login novamente.");
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
        toast.info(`Email alterado para ${finalEmail} (email original já existia)`);
      }

      if (!edgeData.driver?.id) {
        toast.error("Erro: cadastro retornou sem o ID do motorista");
        return;
      }

      toast.success(
        edgeData.updated
          ? `Motorista ${normalizedName} atualizado com sucesso!`
          : `Motorista ${normalizedName} criado com sucesso!`,
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
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Criar Motorista
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Criar Novo Motorista
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do motorista"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail (auto-gerado)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              placeholder="Gerado automaticamente"
              required
              disabled={isLoading}
              readOnly
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha (baseada no CPF)</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                readOnly
                className="bg-muted pr-10 font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Formato: 6 primeiros dígitos do CPF + &quot;Na&quot; (ex: 123456Na)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">E-mail do motorista (recebe os dados de acesso)</Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="motorista@email.com"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehiclePlate">Placa</Label>
              <Input
                id="vehiclePlate"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="ABC1D23"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicleType">Tipo de veículo</Label>
              <Select value={vehicleType} onValueChange={setVehicleType} disabled={isLoading}>
                <SelectTrigger id="vehicleType">
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
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Salvar Motorista
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
