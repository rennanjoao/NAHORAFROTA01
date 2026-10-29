import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, Eye, EyeOff, Shield, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { readEdgeFunctionError } from "@/lib/edgeFunctionError";

const ROLES = [
  { value: "dispatcher", label: "Despachante", description: "Importa notas e cria romaneios" },
  { value: "fleet_manager", label: "Gestor de Frota", description: "Gerencia motoristas e frota" },
  { value: "admin", label: "Administrador", description: "Acesso total ao sistema" },
] as const;

interface CreateUserDialogProps {
  onUserCreated?: () => void;
}

const isEdgeTransportError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { name?: string; message?: string };

  return (
    maybeError.name === "FunctionsFetchError" ||
    maybeError.message === "Failed to send a request to the Edge Function"
  );
};

export function CreateUserDialog({ onUserCreated }: CreateUserDialogProps) {
  const { canAddUser, limits, plan, planLabels } = usePlanLimits();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("dispatcher");

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setName("");
      setEmail("");
      setPassword("");
      setRole("dispatcher");
      setCreated(false);
      setCopied(false);
    }

    setOpen(newOpen);
  };

  const handleCreate = async () => {
    if (!canAddUser) {
      toast.error(`Limite de ${limits.max_users} usuário(s) atingido no plano ${planLabels[plan] || plan}. Faça upgrade.`);
      return;
    }

    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Nome, e-mail e senha são obrigatórios");
      return;
    }

    if (password.trim().length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres");
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const payload = {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role,
        password: password.trim(),
      };

      let { data, error } = await supabase.functions.invoke("create-user", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: payload,
      });

      if (error && isEdgeTransportError(error)) {
        console.warn("create-user transport failed, retrying with invite-user", error);

        const fallback = await supabase.functions.invoke("invite-user", {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
          body: payload,
        });

        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error("Create user error:", error);
        if (isEdgeTransportError(error)) {
          toast.error("Não foi possível conectar à função de criação de usuários. Verifique o deploy das Edge Functions e a liberação de domínio/CORS.");
        } else {
          const info = await readEdgeFunctionError(error, "Erro ao criar usuário");
          toast.error(info.message);
        }
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || "Erro ao criar usuário");
        return;
      }

      setCreated(true);
      toast.success(`Usuário ${name.trim()} criado com sucesso!`);
      onUserCreated?.();
    } catch (err: any) {
      console.error("Error creating user:", err);
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const text = `Acesso ao Na Hora Frota:\nE-mail: ${email.trim().toLowerCase()}\nSenha: ${password.trim()}\n\nAcesse: ${window.location.origin}/login`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Credenciais copiadas!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" disabled={!canAddUser}>
          <UserPlus className="h-4 w-4" />
          Criar Usuário
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Criar Usuário Manual
          </DialogTitle>
          <DialogDescription>
            Cadastre um novo colaborador definindo e-mail, senha e nível de acesso
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
              <p className="flex items-center gap-2 font-semibold text-emerald-400">
                <Check className="h-5 w-5" />
                Usuário criado com sucesso!
              </p>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>{" "}
                  <span className="font-medium">{name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">E-mail:</span>{" "}
                  <span className="font-mono font-medium">{email.trim().toLowerCase()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Senha:</span>{" "}
                  <span className="font-mono font-medium">{password}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Perfil:</span>{" "}
                  <span className="font-medium">{ROLES.find((r) => r.value === role)?.label || role}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Compartilhe essas credenciais com o colaborador. Ele pode alterar a senha depois.
              </p>
            </div>

            <Button onClick={handleCopy} className="w-full gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar Credenciais"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="createName">Nome Completo *</Label>
              <Input
                id="createName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do colaborador"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="createEmail">E-mail *</Label>
              <Input
                id="createEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colaborador@empresa.com.br"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="createPassword">Senha *</Label>
              <div className="relative">
                <Input
                  id="createPassword"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 8 caracteres"
                  disabled={isLoading}
                  className="pr-10"
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                O usuário poderá alterar a senha depois no seu perfil
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="createRole">Nível de Acesso</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <div>
                          <span className="font-medium">{r.label}</span>
                          <span className="ml-2 text-xs text-muted-foreground">- {r.description}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {created ? (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Criar Usuário
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
