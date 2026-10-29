import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { trackFunnelEvent } from "@/lib/funnel";
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
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

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
      toast({ title: "E-mail inválido", description: "Digite o e-mail usado no login.", variant: "destructive" });
      return;
    }
    if (email.endsWith(DRIVER_LOGIN_DOMAIN)) {
      toast({
        title: "Login de motorista",
        description: "Peça ao gestor da sua transportadora para redefinir a sua senha no painel.",
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

    const normalizedEmail = loginEmail.trim().toLowerCase();
    const normalizedPassword = loginPassword.trim();

    const validation = loginSchema.safeParse({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (!validation.success) {
      toast({
        title: "Erro de validação",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(normalizedEmail, normalizedPassword);

    if (error) {
      let errorMessage = "Ocorreu um erro ao fazer login.";
      if (error.message.includes("Invalid login credentials")) {
        errorMessage = "E-mail ou senha incorretos.";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = "Confirme seu e-mail antes de fazer login.";
      } else if (error.message.includes("Too many requests")) {
        errorMessage = "Muitas tentativas. Aguarde alguns minutos.";
      }
      toast({ title: "Erro ao entrar", description: errorMessage, variant: "destructive" });
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
          toast({
            title: "Conta Pendente",
            description: "Sua empresa ainda está aguardando aprovação. Entraremos em contato em breve.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (tenant?.status === "blocked") {
          await supabase.auth.signOut();
          toast({
            title: "Conta Bloqueada",
            description: "O acesso da sua empresa foi suspenso. Entre em contato com o suporte.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Tenant check failed (non-blocking):", err);
    }

    toast({ title: "Login realizado", description: "Bem-vindo de volta." });
    setIsLoading(false);
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      {/* Linhas de rota a 45 graus (manual da marca, elementos graficos). */}
      <div className="absolute inset-0 nhf-routes pointer-events-none" aria-hidden="true" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo horizontal (versao principal) e assinatura */}
        <div className="mb-8 space-y-5">
          <BrandLogo arrangement="horizontal" className="w-[220px]" />
          <p className="font-heading text-2xl font-bold leading-tight tracking-tight">
            Gestão de frota em tempo real.
            <br />
            Entrega <span className="text-primary">sempre na hora.</span>
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl">
          <CardHeader className="pb-4">
            <h2 className="text-xl font-bold">Entrar na operação</h2>
            <p className="text-sm text-muted-foreground">Use o e-mail e a senha da sua conta.</p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="login-email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Senha</Label>
                  <button
                    type="button"
                    onClick={openResetDialog}
                    className="text-xs text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Lembrar meu e-mail
                </label>
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {isLoading ? "Entrando" : "Entrar"}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Precisa de acesso?
                </span>
              </div>
            </div>

            {/* Register link */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Ainda não tem conta?
              </p>
              <a href="/register" className="text-sm text-primary hover:underline font-medium">
                Cadastre sua empresa gratuitamente
              </a>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isResetOpen} onOpenChange={(open) => !isSendingReset && setIsResetOpen(open)}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSendReset}>
              <DialogHeader>
                <DialogTitle>Recuperar senha</DialogTitle>
                <DialogDescription>
                  Enviaremos um link para você criar uma nova senha. Motoristas devem pedir a redefinição ao gestor.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <Label htmlFor="reset-email">E-mail</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={isSendingReset}
                  autoFocus
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsResetOpen(false)} disabled={isSendingReset}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSendingReset}>
                  {isSendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} Na Hora Transporte. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
