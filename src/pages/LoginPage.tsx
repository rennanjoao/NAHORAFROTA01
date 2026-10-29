import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { Cta } from "@/site/components/Cta";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, session, loading: authLoading, isDriverUser, user } = useAuth();
  const state = (location.state as { email?: string; fromCheckout?: boolean; from?: { pathname: string } } | null) || null;

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(state?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Entrar — Na Hora Frota";
  }, []);

  useEffect(() => {
    if (session && !authLoading) {
      if (user?.user_metadata?.must_change_password) {
        navigate("/primeiro-acesso", { replace: true });
      } else if (isDriverUser) {
        navigate("/tracker", { replace: true });
      } else {
        navigate(state?.from?.pathname || "/", { replace: true });
      }
    }
  }, [session, authLoading, navigate, state, isDriverUser, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const validation = loginSchema.safeParse({ email: normalizedEmail, password: normalizedPassword });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }
    setIsLoading(true);
    const { error: err } = await signIn(normalizedEmail, normalizedPassword);
    if (err) {
      let msg = "Não conseguimos entrar. Tente de novo.";
      if (err.message.includes("Invalid login credentials")) msg = "E-mail ou senha incorretos.";
      else if (err.message.includes("Email not confirmed")) msg = "Confirme o seu e-mail antes de entrar.";
      else if (err.message.includes("Too many requests")) msg = "Muitas tentativas. Aguarde alguns minutos.";
      setError(msg);
      setIsLoading(false);
      return;
    }

    try {
      const userId = (await supabase.auth.getUser()).data.user?.id || "";
      const { data: membership } = await supabase.from("tenant_memberships").select("tenant_id").eq("user_id", userId).maybeSingle();
      if (membership?.tenant_id) {
        const { data: tenant } = await supabase.from("tenants").select("status").eq("id", membership.tenant_id).maybeSingle();
        if (tenant?.status === "inactive") {
          await supabase.auth.signOut();
          setError("Sua empresa ainda está aguardando liberação. Entraremos em contato em breve.");
          setIsLoading(false);
          return;
        }
        if (tenant?.status === "blocked") {
          await supabase.auth.signOut();
          setError("O acesso da sua empresa está suspenso. Fale com o suporte: suporte@nahorafrota.com.br.");
          setIsLoading(false);
          return;
        }
      }
    } catch (err2) {
      console.warn("Tenant check failed (non-blocking):", err2);
    }
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Verificando sessão" />
      </div>
    );
  }

  return (
    <AuthShell title="Entrar no painel." subtitle="Use o e-mail e a senha da sua conta.">
      {state?.fromCheckout && (
        <p role="status" className="mb-5 flex items-start gap-2 rounded border border-brand/50 bg-brand/10 p-3 text-sm">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span>Conta criada. Entre com a senha temporária e crie a sua senha definitiva.</span>
        </p>
      )}
      <form onSubmit={handleLogin} className="space-y-5" noValidate>
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold">E-mail</label>
          <div className="relative">
            <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input id="login-email" type="email" autoComplete="email" placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} required className="h-12 w-full rounded border border-input bg-background pl-10 pr-3 text-base placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-semibold">Senha</label>
            <Link to="/redefinir-senha" className="text-xs font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Esqueci minha senha</Link>
          </div>
          <div className="relative">
            <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} required className="h-12 w-full rounded border border-input bg-background pl-10 pr-11 text-base placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword}>
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded border border-nhf-late/50 bg-nhf-late/10 p-3 text-sm">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-late" /> {error}
          </p>
        )}

        <Cta type="submit" size="lg" className="w-full" disabled={isLoading} arrow={!isLoading}>
          {isLoading ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Entrando…</> : "Entrar"}
        </Cta>
      </form>

      <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        <p>
          Ainda não tem conta? <Link to="/#planos" className="font-semibold text-brand hover:underline">Ver planos</Link>
        </p>
        <p className="mt-2">
          Motorista? Peça o seu login ao gestor da frota e <Link to="/install" className="font-semibold text-brand hover:underline">instale o app</Link>.
        </p>
      </div>
    </AuthShell>
  );
}
