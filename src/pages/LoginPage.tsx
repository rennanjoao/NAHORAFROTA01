import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Mail, ArrowRight, Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { trackFunnelEvent } from "@/lib/funnel";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField, AuthInput, PasswordInput } from "@/components/auth/AuthFields";
import { BrandedLoader } from "@/components/auth/BrandedLoader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const REMEMBERED_EMAIL_KEY = "nahora:remembered-email";
// Logins de motorista usam um e-mail interno que nao recebe mensagens.
const DRIVER_LOGIN_DOMAIN = "@driver.nahorafrota.app";

const readRememberedEmail = (): string => {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
  } catch {
    return "";
  }
};

// Validation schema
const loginSchema = z.object({
  email: z.string().email("Digite um e-mail válido, como nome@empresa.com.br."),
  password: z.string().min(1, "Digite sua senha."),
});

type LoginErrors = Partial<Record<"email" | "password", string>>;
type FormError = { title: string; description: string };

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, session, roles, loading: authLoading, isDriverUser } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!readRememberedEmail());
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState(readRememberedEmail);
  const [loginPassword, setLoginPassword] = useState("");
  // Erros aparecem embaixo de cada campo; falhas do login, no topo do formulario.
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);

  // O botao fica desabilitado durante o envio e o foco se perde: leva para o aviso.
  useEffect(() => {
    if (formError) formErrorRef.current?.focus();
  }, [formError]);

  useEffect(() => {
    trackFunnelEvent("page_view");
  }, []);

  // Redirect if already authenticated. Espera o envio do formulario terminar:
  // antes o redirecionamento acontecia no meio da checagem da empresa e um
  // usuario de empresa bloqueada entrava no painel por um instante.
  useEffect(() => {
    if (session && !authLoading && !isLoading) {
      // CRITICAL: Use isDriverUser from context for immediate detection
      if (isDriverUser) {
        console.log("[LOGIN] Driver user detected, redirecting to /tracker");
        navigate("/tracker", { replace: true });
      } else {
        const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";
        navigate(from, { replace: true });
      }
    }
  }, [session, authLoading, navigate, location, isDriverUser, isLoading]);

  const openResetDialog = () => {
    setResetEmail(loginEmail.trim().toLowerCase());
    setIsResetOpen(true);
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = resetEmail.trim().toLowerCase();
    if (!z.string().email().safeParse(email).success) {
      toast({ title: "E-mail inválido", description: "Digite o e-mail que você usa para entrar.", variant: "destructive" });
      return;
    }
    if (email.endsWith(DRIVER_LOGIN_DOMAIN)) {
      toast({
        title: "Login de motorista",
        description: "Peça ao gestor da sua transportadora para criar uma senha nova para você no painel.",
      });
      return;
    }

    setIsSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsSendingReset(false);

    if (error) {
      const rateLimited = /rate limit|too many|seconds/i.test(error.message);
      toast({
        title: "Não foi possível enviar o link",
        description: rateLimited ? "Muitas tentativas. Aguarde alguns minutos e tente de novo." : error.message,
        variant: "destructive",
      });
      return;
    }

    setIsResetOpen(false);
    // Mesma resposta para e-mail cadastrado ou nao (nao revela quem tem conta).
    toast({
      title: "Verifique seu e-mail",
      description: `Se ${email} tiver conta, enviamos um link para criar uma nova senha.`,
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});
    setFormError(null);

    const normalizedEmail = loginEmail.trim().toLowerCase();
    const normalizedPassword = loginPassword.trim();

    const validation = loginSchema.safeParse({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (!validation.success) {
      const fieldErrors: LoginErrors = {};
      validation.error.errors.forEach((issue) => {
        const field = issue.path[0] as keyof LoginErrors;
        fieldErrors[field] ??= issue.message;
      });
      setErrors(fieldErrors);
      (fieldErrors.email ? emailRef : passwordRef).current?.focus();
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(normalizedEmail, normalizedPassword);

    if (error) {
      let errorMessage = "Não foi possível entrar agora. Confira a internet e tente de novo.";
      if (error.message.includes("Invalid login credentials")) {
        errorMessage = "E-mail ou senha não conferem. Confira e tente de novo.";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = "Confirme seu e-mail antes de entrar. Veja a mensagem que enviamos.";
      } else if (error.message.includes("Too many requests")) {
        errorMessage = "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
      }
      setFormError({ title: "Não foi possível entrar", description: errorMessage });
      setIsLoading(false);
      return;
    }

    try {
      if (rememberMe) localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } catch {
      // Sem armazenamento local: so nao lembra o e-mail.
    }

    // Check tenant status after successful auth
    try {
      const { data: membership } = await supabase
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .maybeSingle();

      if (membership?.tenant_id) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("status, razao_social")
          .eq("id", membership.tenant_id)
          .maybeSingle();

        if (tenant?.status === "inactive") {
          await supabase.auth.signOut();
          setFormError({
            title: "Cadastro em análise",
            description: "Sua empresa ainda está aguardando aprovação. Vamos entrar em contato em breve.",
          });
          setIsLoading(false);
          return;
        }

        if (tenant?.status === "blocked") {
          await supabase.auth.signOut();
          setFormError({
            title: "Acesso suspenso",
            description: "O acesso da sua empresa foi suspenso. Fale com o suporte para resolver.",
          });
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Tenant check failed (non-blocking):", err);
    }

    toast({ title: "Você entrou", description: "Bem-vindo de volta." });
    setIsLoading(false);
  };

  // Show loading while checking auth state
  if (authLoading) {
    return <BrandedLoader label="Conferindo seu acesso" />;
  }

  return (
    <AuthLayout>
      <div className="space-y-2">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">Entrar</h1>
        <p className="text-[0.9375rem] text-muted-foreground">
          Acompanhe a frota e as entregas em tempo real. Use o e-mail e a senha da sua conta.
        </p>
      </div>

      <form onSubmit={handleLogin} noValidate className="mt-8 space-y-5" aria-describedby={formError ? "login-erro" : undefined}>
        {formError && (
          <Alert id="login-erro" ref={formErrorRef} tabIndex={-1} variant="destructive" className="animate-fade-in outline-none">
            <p className="mb-1 font-semibold leading-snug text-foreground">{formError.title}</p>
            <AlertDescription>{formError.description}</AlertDescription>
          </Alert>
        )}

        <AuthField id="login-email" label="E-mail" icon={Mail} error={errors.email}>
          {(a11y) => (
            <AuthInput
              {...a11y}
              ref={emailRef}
              withIcon
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nome@empresa.com.br"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          )}
        </AuthField>

        <AuthField
          id="login-password"
          label="Senha"
          error={errors.password}
          labelAction={
            <button
              type="button"
              onClick={openResetDialog}
              className="min-h-6 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Esqueci minha senha
            </button>
          }
        >
          {(a11y) => (
            <PasswordInput
              {...a11y}
              ref={passwordRef}
              autoComplete="current-password"
              placeholder="Sua senha"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          )}
        </AuthField>

        <div className="flex min-h-11 items-center gap-3">
          <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(!!checked)} />
          <Label htmlFor="remember" className="cursor-pointer font-normal text-muted-foreground">
            Lembrar meu e-mail neste aparelho
          </Label>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          {isLoading ? "Entrando" : "Entrar"}
        </Button>
      </form>

      <div className="mt-8 space-y-4 border-t pt-6 text-sm">
        <p className="flex items-start gap-2.5 text-muted-foreground">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>É motorista? Entre com o e-mail e a senha que a sua empresa passou para você.</span>
        </p>
        <p className="text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link to="/register" className="font-semibold text-primary underline-offset-4 hover:underline">
            Cadastre sua empresa grátis
          </Link>
        </p>
      </div>

      <Dialog open={isResetOpen} onOpenChange={(open) => !isSendingReset && setIsResetOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSendReset} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Recuperar senha</DialogTitle>
              <DialogDescription>
                Vamos enviar um link para você criar uma senha nova. Motoristas pedem a senha nova ao gestor da empresa.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-mail da sua conta</Label>
              <Input
                id="reset-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="nome@empresa.com.br"
                disabled={isSendingReset}
                className="h-12 text-[0.9375rem]"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setIsResetOpen(false)} disabled={isSendingReset}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={isSendingReset}>
                {isSendingReset && <Loader2 className="animate-spin" aria-hidden="true" />}
                Enviar link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AuthLayout>
  );
}
