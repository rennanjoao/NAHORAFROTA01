import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { readEdgeFunctionError } from "@/lib/edgeFunctionError";
import { FormField } from "@/components/patterns/FormField";
import { CredentialsCard } from "./CredentialsCard";
import { INVITE_ROLES, looksLikeEmail } from "./roleOptions";
import { friendlyServerMessage, isDuplicateEmail } from "./serverMessages";

const FALLBACK_ERROR = "Não foi possível gerar o acesso. Confira os dados e tente de novo.";
const DUPLICATE = "Este e-mail já está cadastrado. Use outro e-mail.";

interface InviteUserDialogProps {
  onUserInvited?: () => void;
}

type FieldKey = "name" | "email";

export function InviteUserDialog({ onUserInvited }: InviteUserDialogProps) {
  const { canAddUser, limits, plan, planLabels } = usePlanLimits();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  // O campo fica desabilitado enquanto envia: o foco vai para o e-mail quando ele volta.
  const [focusEmail, setFocusEmail] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("dispatcher");
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusEmail && !isLoading) {
      emailRef.current?.focus();
      setFocusEmail(false);
    }
  }, [focusEmail, isLoading]);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setName("");
      setEmail("");
      setRole("dispatcher");
      setInviteResult(null);
      setErrors({});
    }
    setOpen(newOpen);
  };

  const handleInvite = async (event?: FormEvent) => {
    event?.preventDefault();
    // O botao continua focavel enquanto gera (aria-disabled): evita gerar duas vezes.
    if (isLoading) return;
    if (!canAddUser) {
      toast.error(
        `O plano ${planLabels[plan] || plan} permite até ${limits.max_users} ${limits.max_users === 1 ? "usuário" : "usuários"}. Fale com a equipe para mudar de plano.`,
      );
      return;
    }

    const next: Partial<Record<FieldKey, string>> = {};
    if (!name.trim()) next.name = "Digite o nome da pessoa.";
    if (!email.trim()) next.email = "Digite o e-mail que a pessoa vai usar para entrar.";
    else if (!looksLikeEmail(email)) next.email = "Confira o e-mail. Exemplo: nome@empresa.com.br";
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.email) return emailRef.current?.focus();

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        toast.error("Sessão expirada. Entre de novo para continuar.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("invite-user", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: { email: email.trim().toLowerCase(), name: name.trim(), role },
      });

      if (error) {
        console.error("Invite error:", error);
        const info = await readEdgeFunctionError(error, FALLBACK_ERROR);
        if (isDuplicateEmail(info.message, info.code)) {
          setErrors({ email: DUPLICATE });
          setFocusEmail(true);
          return;
        }
        toast.error(friendlyServerMessage(info.message, FALLBACK_ERROR));
        return;
      }

      if (!data?.success) {
        if (isDuplicateEmail(data?.error, data?.code)) {
          setErrors({ email: DUPLICATE });
          setFocusEmail(true);
          return;
        }
        toast.error(friendlyServerMessage(data?.error, FALLBACK_ERROR));
        return;
      }

      setInviteResult({ email: data.user.email, tempPassword: data.tempPassword });
      toast.success(`Acesso criado para ${data.user.email}.`);
      onUserInvited?.();
    } catch (err) {
      console.error("Error inviting:", err);
      toast.error(friendlyServerMessage(err instanceof Error ? err.message : "", FALLBACK_ERROR));
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRole = INVITE_ROLES.find((r) => r.value === role);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!canAddUser}>
          {!canAddUser ? (
            <>
              <Lock aria-hidden="true" />
              Limite de usuários
            </>
          ) : (
            <>
              <Mail aria-hidden="true" />
              Convidar usuário
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{inviteResult ? "Acesso criado" : "Convidar usuário"}</DialogTitle>
          <DialogDescription>
            {inviteResult
              ? "Nenhum e-mail é enviado sozinho: passe estes dados para a pessoa."
              : "Gera um acesso com senha temporária para você repassar à pessoa."}
          </DialogDescription>
        </DialogHeader>

        {inviteResult ? (
          <CredentialsCard
            title="Acesso pronto"
            rows={[
              { label: "E-mail", value: inviteResult.email, mono: true },
              { label: "Senha temporária", value: inviteResult.tempPassword, mono: true },
            ]}
            note="A pessoa pode trocar a senha em Configurações, na aba Segurança."
            copyText={`Acesso ao Na Hora Frota:\nE-mail: ${inviteResult.email}\nSenha temporária: ${inviteResult.tempPassword}\n\nAcesse: ${window.location.origin}/login`}
          />
        ) : (
          <form id="invite-user-form" onSubmit={handleInvite} noValidate className="space-y-4">
            <FormField id="inviteName" label="Nome completo" error={errors.name}>
              {(control) => (
                <Input
                  {...control}
                  ref={nameRef}
                  value={name}
                  autoComplete="off"
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="Nome do colaborador"
                  disabled={isLoading}
                />
              )}
            </FormField>

            <FormField id="inviteEmail" label="E-mail" error={errors.email} hint="Será o login da pessoa no painel.">
              {(control) => (
                <Input
                  {...control}
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="colaborador@empresa.com.br"
                  disabled={isLoading}
                />
              )}
            </FormField>

            <FormField id="inviteRole" label="Nível de acesso" hint={selectedRole?.description}>
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
          {inviteResult ? (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" form="invite-user-form" aria-disabled={isLoading || undefined} className="aria-disabled:pointer-events-none aria-disabled:opacity-60">
                {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Mail aria-hidden="true" />}
                {isLoading ? "Gerando..." : "Gerar acesso"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
