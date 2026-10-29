import { useEffect, useState, type FormEvent } from "react";
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
import { Loader2, Save } from "lucide-react";
import { FormField } from "@/components/settings/FormField";
import { looksLikeEmail } from "./roleOptions";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SystemUser } from "@/hooks/useSystemUsers";
import { DBDriver } from "@/hooks/useDriversDB";

type EditTarget =
  | { type: "user"; record: SystemUser }
  | { type: "driver"; record: DBDriver };

interface EditAccessDialogProps {
  target: EditTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "fleet_manager", label: "Gestor de Frota" },
  { value: "dispatcher", label: "Despachante" },
] as const;

const DRIVER_STATUS = [
  { value: "active", label: "Disponível" },
  { value: "in_route", label: "Em rota" },
  { value: "inactive", label: "Inativo" },
  { value: "pending_approval", label: "Aguardando aprovação" },
] as const;

const VEHICLE_TYPES = [
  { value: "moto", label: "Moto" },
  { value: "fiorino", label: "Fiorino" },
  { value: "van", label: "Van" },
  { value: "vuc", label: "VUC" },
  { value: "toco", label: "Toco" },
  { value: "truck", label: "Truck" },
  { value: "carreta", label: "Carreta" },
] as const;

export function EditAccessDialog({ target, open, onOpenChange, onSaved }: EditAccessDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SystemUser["role"]>("viewer");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleType, setVehicleType] = useState("van");
  const [status, setStatus] = useState("active");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  const getFunctionErrorMessage = async (error: unknown, fallback = "Erro ao salvar alterações") => {
    const anyError = error as {
      message?: string;
      context?: Response | { body?: string; response?: string };
    };

    const context = anyError?.context;

    try {
      if (context instanceof Response) {
        const payload = await context.clone().json();
        return payload?.error || payload?.message || fallback;
      }

      const rawBody =
        typeof context?.body === "string"
          ? context.body
          : typeof context?.response === "string"
            ? context.response
            : null;

      if (rawBody) {
        const payload = JSON.parse(rawBody);
        return payload?.error || payload?.message || rawBody;
      }
    } catch {
      // Fall through to the generic message below.
    }

    return anyError?.message || fallback;
  };

  useEffect(() => {
    if (!target) return;

    setPassword("");
    setErrors({});

    if (target.type === "user") {
      setName(target.record.name || "");
      setEmail(target.record.email || "");
      setRole(target.record.role || "viewer");
      setCpf("");
      setPhone("");
      setVehiclePlate("");
      setVehicleType("van");
      setStatus("active");
      return;
    }

    setName(target.record.name || "");
    setEmail(target.record.email || "");
    setRole("viewer");
    setCpf(target.record.cpf || "");
    setPhone(target.record.phone || "");
    setVehiclePlate(target.record.vehicle_plate || "");
    setVehicleType((target.record.vehicle_type || "van").toLowerCase());
    setStatus(target.record.status || "active");
  }, [target]);

  const handleSave = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!target || isSaving) return;

    const targetUserId = target.type === "user" ? target.record.user_id : target.record.user_id;
    if (!targetUserId) {
      toast({
        title: "Motorista sem login",
        description: "Este motorista ainda não possui usuário de acesso vinculado.",
        variant: "destructive",
      });
      return;
    }

    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = "Digite o nome.";
    if (!email.trim()) nextErrors.email = "Digite o e-mail de login.";
    else if (!looksLikeEmail(email)) nextErrors.email = "Confira o e-mail. Exemplo: nome@empresa.com.br";
    if (password.trim() && password.trim().length < 8)
      nextErrors.password = "A nova senha precisa ter pelo menos 8 caracteres. Exemplo: 123456Na";
    setErrors(nextErrors);
    const firstError = (["name", "email", "password"] as const).find((key) => nextErrors[key]);
    if (firstError) {
      document.getElementById(`edit-${firstError}`)?.focus();
      return;
    }

    setIsSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const body =
        target.type === "user"
          ? {
              userId: targetUserId,
              name: name.trim(),
              email: email.trim().toLowerCase(),
              password: password.trim() || undefined,
              role,
            }
          : {
              userId: targetUserId,
              name: name.trim(),
              email: email.trim().toLowerCase(),
              password: password.trim() || undefined,
              role: "viewer",
              driver: {
                id: target.record.id,
                cpf,
                phone,
                vehiclePlate,
                vehicleType,
                status,
              },
            };

      const { data, error } = await supabase.functions.invoke("update-user-access", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body,
      });

      if (error) throw new Error(await getFunctionErrorMessage(error));
      if (!data?.success) throw new Error(data?.error || "Erro ao salvar alterações");

      toast({
        title: "Acesso atualizado",
        description: "As alterações foram salvas.",
        variant: "success",
      });

      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Não foi possível salvar.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isDriver = target?.type === "driver";
  const clearError = (key: keyof typeof errors) => errors[key] && setErrors((prev) => ({ ...prev, [key]: undefined }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isDriver ? "Editar acesso do motorista" : "Editar usuário"}</DialogTitle>
          <DialogDescription>
            Troque nome, e-mail de login ou senha. Deixe a senha em branco para manter a atual.
          </DialogDescription>
        </DialogHeader>

        <form id="edit-access-form" onSubmit={handleSave} noValidate className="space-y-4">
          <FormField id="edit-name" label="Nome" error={errors.name}>
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearError("name");
                }}
              />
            )}
          </FormField>

          <FormField id="edit-email" label="E-mail de login" error={errors.email}>
            {(control) => (
              <Input
                {...control}
                type="email"
                inputMode="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearError("email");
                }}
              />
            )}
          </FormField>

          <FormField
            id="edit-password"
            label="Nova senha"
            optional
            error={errors.password}
            hint="Em branco, a senha atual continua valendo."
          >
            {(control) => (
              <Input
                {...control}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError("password");
                }}
              />
            )}
          </FormField>

          {!isDriver && (
            <FormField id="edit-role" label="Nível de acesso">
              {(control) => (
                <Select value={role} onValueChange={(value) => setRole(value as SystemUser["role"])}>
                  <SelectTrigger {...control}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}

          {isDriver && (
            <fieldset className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
              <legend className="sr-only">Dados do motorista</legend>
              <FormField id="edit-cpf" label="CPF">
                {(control) => (
                  <Input {...control} inputMode="numeric" value={cpf} onChange={(event) => setCpf(event.target.value)} />
                )}
              </FormField>

              <FormField id="edit-phone" label="Telefone" optional>
                {(control) => (
                  <Input {...control} type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
                )}
              </FormField>

              <FormField id="edit-plate" label="Placa" optional>
                {(control) => (
                  <Input
                    {...control}
                    value={vehiclePlate}
                    onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())}
                    className="uppercase"
                  />
                )}
              </FormField>

              <FormField id="edit-vehicle-type" label="Tipo de veículo">
                {(control) => (
                  <Select value={vehicleType} onValueChange={setVehicleType}>
                    <SelectTrigger {...control}>
                      <SelectValue />
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

              <FormField id="edit-status" label="Situação" className="sm:col-span-2">
                {(control) => (
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger {...control}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DRIVER_STATUS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </fieldset>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-access-form" disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
