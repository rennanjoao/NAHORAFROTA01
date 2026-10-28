import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Shield, UserCog } from "lucide-react";
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
  { value: "in_route", label: "Em Rota" },
  { value: "inactive", label: "Inativo" },
  { value: "pending_approval", label: "Pendente" },
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

  const getFunctionErrorMessage = async (error: unknown, fallback = "Erro ao salvar alteracoes") => {
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

  const handleSave = async () => {
    if (!target || isSaving) return;

    const targetUserId = target.type === "user" ? target.record.user_id : target.record.user_id;
    if (!targetUserId) {
      toast({
        title: "Motorista sem login",
        description: "Este motorista ainda nao possui usuario de acesso vinculado.",
        variant: "destructive",
      });
      return;
    }

    if (!name.trim() || !email.trim()) {
      toast({
        title: "Campos obrigatorios",
        description: "Informe nome e e-mail.",
        variant: "destructive",
      });
      return;
    }

    if (password.trim() && password.trim().length < 8) {
      toast({
        title: "Senha muito curta",
        description: "A nova senha precisa ter pelo menos 8 caracteres. Exemplo: 123456Na",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error("Sessao expirada. Faca login novamente.");
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
      if (!data?.success) throw new Error(data?.error || "Erro ao salvar alteracoes");

      toast({
        title: "Acesso atualizado",
        description: "As configuracoes foram salvas.",
      });

      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Nao foi possivel salvar.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isDriver = target?.type === "driver";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            {isDriver ? "Editar Acesso do Motorista" : "Editar Usuário"}
          </DialogTitle>
          <DialogDescription>
            Altere e-mail, senha e configuracoes de acesso. Senha em branco mantém a atual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome</Label>
            <Input id="edit-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">E-mail de Login</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-password">Nova Senha</Label>
            <Input
              id="edit-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Deixe em branco para manter"
            />
          </div>

          {!isDriver && (
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={(value) => setRole(value as SystemUser["role"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {item.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isDriver && (
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-cpf">CPF</Label>
                <Input id="edit-cpf" value={cpf} onChange={(event) => setCpf(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input id="edit-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-plate">Placa</Label>
                <Input
                  id="edit-plate"
                  value={vehiclePlate}
                  onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())}
                  className="uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger>
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
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
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
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
