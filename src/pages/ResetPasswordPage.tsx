import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Loader2, Check, AlertCircle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Cta } from "@/site/components/Cta";

/**
 * /redefinir-senha
 * - Sem sessão de recuperação: pede o e-mail e envia o link.
 * - Com sessão de recuperação (link do e-mail): pede a nova senha.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [p1, setP1] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Redefinir senha — Na Hora Frota";
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setMode("update");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setBusy(false);
    if (err) {
      setError("Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos.");
      return;
    }
    setDone(true);
  };

  const update = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (p1.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: p1, data: { must_change_password: false } });
    setBusy(false);
    if (err) return setError("Link expirado ou inválido. Peça um novo e-mail de redefinição.");
    navigate("/", { replace: true });
  };

  if (mode === "update") {
    return (
      <AuthShell title="Escolha a nova senha." subtitle="Depois de salvar, você entra direto no painel.">
        <form onSubmit={update} className="space-y-5" noValidate>
          <div>
            <label htmlFor="p1" className="mb-1.5 block text-sm font-semibold">Nova senha</label>
            <div className="relative">
              <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input id="p1" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} className="h-12 w-full rounded border border-input bg-background pl-10 pr-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required minLength={8} />
            </div>
          </div>
          {error && <p role="alert" className="flex items-center gap-2 rounded border border-nhf-late/50 bg-nhf-late/10 p-3 text-sm"><AlertCircle aria-hidden="true" className="h-4 w-4 text-late" /> {error}</p>}
          <Cta type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Salvando…</> : <><Check aria-hidden="true" className="h-4 w-4" /> Salvar nova senha</>}
          </Cta>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Esqueceu a senha?" subtitle="Informe o e-mail da sua conta. Enviamos um link para criar outra.">
      {done ? (
        <div role="status" className="rounded border border-brand/50 bg-brand/10 p-4 text-sm">
          <p className="font-semibold">Se existir uma conta com este e-mail, o link já está a caminho.</p>
          <p className="mt-1 text-muted-foreground">Confira a caixa de entrada e o spam. O link vale por uma hora.</p>
          <Link to="/login" className="mt-3 inline-block font-semibold text-brand hover:underline">Voltar para o login</Link>
        </div>
      ) : (
        <form onSubmit={request} className="space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">E-mail</label>
            <div className="relative">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 w-full rounded border border-input bg-background pl-10 pr-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required />
            </div>
          </div>
          {error && <p role="alert" className="flex items-center gap-2 rounded border border-nhf-late/50 bg-nhf-late/10 p-3 text-sm"><AlertCircle aria-hidden="true" className="h-4 w-4 text-late" /> {error}</p>}
          <Cta type="submit" size="lg" className="w-full" disabled={busy} arrow={!busy}>
            {busy ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Enviando…</> : "Enviar link"}
          </Cta>
          <p className="text-center text-sm text-muted-foreground">
            Lembrou? <Link to="/login" className="font-semibold text-brand hover:underline">Entrar</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
