import { useRef, useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, KeyRound, Laptop, Loader2, LogOut, MonitorSmartphone, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, StatusBadge } from "@/components/patterns";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { FormField } from "./FormField";
import { SettingsCard } from "./SettingsCard";

const MIN_PASSWORD_LENGTH = 8;

type PasswordKey = "current" | "next" | "confirm";

/** Navegador e sistema do aparelho atual, para a lista de sessoes. */
function describeThisDevice(): { label: string; mobile: boolean } {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Navegador";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return { label: os ? `${browser} no ${os}` : browser, mobile: /Android|iPhone|iPad/.test(ua) };
}

/** Configuracoes > Seguranca: troca de senha e sessoes em outros aparelhos. */
export function SecuritySettings() {
  const { user } = useAuth();
  const [passwordForm, setPasswordForm] = useState<Record<PasswordKey, string>>({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<PasswordKey, string>>>({});
  const [showPasswords, setShowPasswords] = useState<Record<PasswordKey, boolean>>({
    current: false,
    next: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const refs = {
    current: useRef<HTMLInputElement>(null),
    next: useRef<HTMLInputElement>(null),
    confirm: useRef<HTMLInputElement>(null),
  };
  const device = describeThisDevice();
  const DeviceIcon = device.mobile ? Smartphone : Laptop;

  const fail = (key: PasswordKey, message: string) => {
    setErrors({ [key]: message });
    refs[key].current?.focus();
  };

  // Antes o botao so mostrava "Senha alterada" sem mudar nada.
  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    const email = user?.email;
    if (!email) {
      toast({ title: "Sessão expirada", description: "Entre de novo para trocar a senha.", variant: "destructive" });
      return;
    }
    if (!passwordForm.current) return fail("current", "Digite a senha que você usa hoje.");
    if (passwordForm.next.length < MIN_PASSWORD_LENGTH)
      return fail("next", `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    if (passwordForm.next !== passwordForm.confirm)
      return fail("confirm", "As senhas estão diferentes. Digite a nova senha igual nos dois campos.");
    if (passwordForm.next === passwordForm.current) return fail("next", "Escolha uma senha diferente da atual.");

    setErrors({});
    setIsChangingPassword(true);
    try {
      // Confere a senha atual antes de trocar.
      const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: passwordForm.current });
      if (checkError) {
        fail("current", "Senha atual incorreta. Confira e tente de novo.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: passwordForm.next });
      if (error) {
        toast({ title: "Não foi possível alterar a senha", description: error.message, variant: "destructive" });
        return;
      }

      setPasswordForm({ current: "", next: "", confirm: "" });
      toast({ title: "Senha alterada", description: "Use a nova senha no próximo acesso.", variant: "success" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOutOthers = async () => {
    setIsSigningOutOthers(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setIsSigningOutOthers(false);
    setConfirmSignOut(false);
    if (error) {
      toast({ title: "Não foi possível encerrar as sessões", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Sessões encerradas",
      description: "Os outros aparelhos conectados a esta conta foram desconectados.",
      variant: "success",
    });
  };

  const passwordInput = (key: PasswordKey, id: string, label: string, autoComplete: string, hint?: string) => (
    <FormField id={id} label={label} hint={hint} error={errors[key]}>
      {(control) => (
        <div className="relative">
          <Input
            {...control}
            ref={refs[key]}
            type={showPasswords[key] ? "text" : "password"}
            className="pr-11"
            autoComplete={autoComplete}
            aria-required="true"
            value={passwordForm[key]}
            onChange={(e) => {
              setPasswordForm((prev) => ({ ...prev, [key]: e.target.value }));
              if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 rounded-l-none text-muted-foreground hover:bg-transparent hover:text-foreground active:scale-100"
            onClick={() => setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }))}
            aria-label={showPasswords[key] ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
            aria-pressed={showPasswords[key]}
          >
            {showPasswords[key] ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </div>
      )}
    </FormField>
  );

  const longEnough = passwordForm.next.length >= MIN_PASSWORD_LENGTH;

  return (
    <div className="space-y-6">
      <SettingsCard
        icon={KeyRound}
        title="Senha"
        description="Troque a senha que você usa para entrar no Na Hora Frota."
        onSubmit={handleChangePassword}
        footerHint="Depois de trocar, use a nova senha no próximo acesso."
        footer={
          <Button type="submit" disabled={isChangingPassword}>
            {isChangingPassword ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
            {isChangingPassword ? "Alterando..." : "Alterar senha"}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2 sm:max-w-[calc(50%-0.625rem)]">
            {passwordInput("current", "current-password", "Senha atual", "current-password")}
          </div>
          <div className="space-y-2">
            {passwordInput("next", "new-password", "Nova senha", "new-password")}
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors duration-fast",
                longEnough ? "text-success" : "text-muted-foreground",
              )}
            >
              <Check className={cn("h-3.5 w-3.5", !longEnough && "opacity-40")} aria-hidden="true" />
              Pelo menos {MIN_PASSWORD_LENGTH} caracteres
              <span className="sr-only">{longEnough ? ", ok" : ", ainda não"}</span>
            </p>
          </div>
          {passwordInput("confirm", "confirm-password", "Confirmar nova senha", "new-password")}
        </div>
      </SettingsCard>

      <SettingsCard
        icon={MonitorSmartphone}
        title="Aparelhos conectados"
        description="Onde sua conta está aberta agora."
        footerHint="Use se você entrou em um computador de outra pessoa ou perdeu o celular."
        footer={
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmSignOut(true)}
            disabled={isSigningOutOthers}
          >
            <LogOut aria-hidden="true" />
            Encerrar sessões em outros aparelhos
          </Button>
        }
      >
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            <DeviceIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Este aparelho</p>
            <p className="truncate text-sm text-muted-foreground">{device.label}</p>
          </div>
          <StatusBadge tone="success">Ativo agora</StatusBadge>
        </div>
      </SettingsCard>

      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={(open) => !isSigningOutOthers && setConfirmSignOut(open)}
        title="Encerrar sessões em outros aparelhos?"
        description="Quem estiver com a sua conta aberta em outro computador ou celular vai precisar entrar de novo. Este aparelho continua conectado."
        confirmLabel="Encerrar sessões"
        tone="danger"
        loading={isSigningOutOthers}
        onConfirm={handleSignOutOthers}
      />
    </div>
  );
}
