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
import nahoraFrotaLogo from "@/assets/nahora-frota-logo.png";

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
  const [rememberMe, setRememberMe] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (session && !authLoading) {
      // CRITICAL: Use isDriverUser from context for immediate detection
      if (isDriverUser) {
        console.log("[LOGIN] Driver user detected, redirecting to /tracker");
        navigate("/tracker", { replace: true });
      } else {
        const from = (location.state as any)?.from?.pathname || "/";
        navigate(from, { replace: true });
      }
    }
  }, [session, authLoading, navigate, location, isDriverUser]);

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

    toast({ title: "✅ Login realizado", description: "Bem-vindo de volta!" });
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={nahoraFrotaLogo}
            alt="NAHORA FROTA"
            className="w-56 h-auto object-contain"
            style={{
              filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))",
            }}
          />
          <p className="text-muted-foreground mt-3 text-sm">Gestão completa para sua frota</p>
        </div>

        {/* Login Card */}
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="pb-4 text-center">
            <h2 className="text-xl font-semibold">Acesse sua conta</h2>
            <p className="text-sm text-muted-foreground">
              Entre com suas credenciais para continuar
            </p>
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
                    onClick={() => {
                      toast({
                        title: "Recuperação de senha",
                        description: "Entre em contato com o administrador para recuperar sua senha.",
                      });
                    }}
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
                  Lembrar de mim
                </label>
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {isLoading ? "Entrando..." : "Entrar"}
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

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2024 Na Hora Transporte. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
