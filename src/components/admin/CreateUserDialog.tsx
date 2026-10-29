import { useRef, useState, type FormEvent } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { readEdgeFunctionError } from "@/lib/edgeFunctionError";
import { FormField } from "@/components/settings/FormField";
import { CredentialsCard } from "./CredentialsCard";
import { INVITE_ROLES, looksLikeEmail } from "./roleOptions";

interface CreateUserDialogProps {
  onUserCreated?: () => void;
}

type FieldKey = "name" | "email" | "password";

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
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("dispatcher");
  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setName("");
      setEmail("");
      setPassword("");
      setRole("dispatcher");
      setCreated(false);
      setErrors({});
      setShowPassword(false);
    }

    setOpen(newOpen);
  };

  const validate = () => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!name.trim()) next.name = "Digite o nome da pessoa.";
    if (!email.trim()) next.email = "Digite o e-mail que a pessoa vai usar para entrar.";
    else if (!looksLikeEmail(email)) next.email = "Confira o e-mail. Exemplo: nome@empresa.com.br";
    if (!password.trim()) next.password = "Crie uma senha para o primeiro acesso.";
    else if (password.trim().length < 8) next.password = "A senha precisa ter pelo menos 8 caracteres.";
    setErrors(next);
    const first = (["name", "email", "password"] as FieldKey[]).find((key) => next[key]);
    if (first) refs[first].current?.focus();
    return !first;
  };

  const handleCreate = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canAddUser) {
      toast.error(`Limite de ${limits.max_users} usuário(s) atingido no plano ${planLabels[plan] || plan}. Fale com a equipe para mudar de plano.`);
      return;
    }

    if (!validate()) return;

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        toast.error("Sessão expirada. Entre de novo para continuar.");
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
      toast.success(`Usuário ${name.trim()} criado.`);
      onUserCreated?.();
    } catch (err: any) {
      console.error("Error creating user:", err);
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = (key: FieldKey) => errors[key] && setErrors((prev) => ({ ...prev, [key]: undefined }));
  const selectedRole = INVITE_ROLES.find((r) => r.value === role);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={!canAddUser}>
          <UserPlus aria-hidden="true" />
          Criar usuário
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{created ? "Usuário criado" : "Criar usuário"}</DialogTitle>
          <DialogDescription>
            {created
              ? "Passe estes dados para a pessoa. Ela pode trocar a senha depois, em Configurações."
              : "Cadastre uma pessoa da equipe com e-mail, senha e nível de acesso."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <CredentialsCard
            title="Acesso pronto"
            rows={[
              { label: "Nome", value: name },
              { label: "E-mail", value: email.trim().toLowerCase(), mono: true },
              { label: "Senha", value: password, mono: true },
              { label: "Nível", value: selectedRole?.label || role },
            ]}
            copyText={`Acesso ao Na Hora Frota:\nE-mail: ${email.trim().toLowerCase()}\nSenha: ${password.trim()}\n\nAcesse: ${window.location.origin}/login`}
          />
        ) : (
          <form id="create-user-form" onSubmit={handleCreate} noValidate className="space-y-4">
            <FormField id="createName" label="Nome completo" error={errors.name}>
              {(control) => (
                <Input
                  {...control}
                  ref={refs.name}
                  value={name}
                  autoComplete="off"
                  onChange={(e) => {
                    setName(e.target.value);
                    clearError("name");
                  }}
                  placeholder="Nome do colaborador"
                  disabled={isLoading}
                />
              )}
            </FormField>

            <FormField id="createEmail" label="E-mail" error={errors.email} hint="Será o login da pessoa no painel.">
              {(control) => (
                <Input
                  {...control}
                  ref={refs.email}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError("email");
                  }}
                  placeholder="colaborador@empresa.com.br"
                  disabled={isLoading}
                />
              )}
            </FormField>

            <FormField
              id="createPassword"
              label="Senha"
              error={errors.password}
              hint="Mínimo de 8 caracteres. A pessoa pode trocar depois."
            >
              {(control) => (
                <div className="relative">
                  <Input
                    {...control}
                    ref={refs.password}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError("password");
                    }}
                    disabled={isLoading}
                    className="pr-11"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 rounded-l-none text-muted-foreground hover:bg-transparent hover:text-foreground active:scale-100"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </div>
              )}
            </FormField>

            <FormField id="createRole" label="Nível de acesso" hint={selectedRole?.description}>
              {(control) => (
                <Select value={role} onValueChange={setRole} disabled={isLoading}>
                  <SelectTrigger {...control}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </form>
        )}

        <DialogFooter>
          {created ? (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" form="create-user-form" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
                {isLoading ? "Criando..." : "Criar usuário"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
