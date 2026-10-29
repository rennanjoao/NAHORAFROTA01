import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { Cta } from "@/site/components/Cta";

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

/** Troca da senha temporária no primeiro login (obrigatória para contas criadas pelo checkout). */
export default function PrimeiroAcessoPage() {
  const navigate = useNavigate();
  const { session, user, loading, isDriverUser } = useAuth();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Crie sua senha — Na Hora Frota";
    if (!loading && !session) navigate("/login", { replace: true });
  }, [loading, session, navigate]);

  const s = strength(p1);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (p1.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (s < 2) return setError("Misture letras maiúsculas, minúsculas e números.");
    if (p1 !== p2) return setError("As duas senhas não são iguais.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: p1, data: { must_change_password: false } });
    setBusy(false);
    if (err) {
      setError(err.message.includes("same") ? "Escolha uma senha diferente da temporária." : "Não conseguimos salvar a senha. Tente de novo.");
      return;
    }
    navigate(isDriverUser ? "/tracker" : "/", { replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Carregando" />
      </div>
    );
  }

  return (
    <AuthShell title="Crie a sua senha definitiva." subtitle={`Você entrou com a senha temporária de ${user?.email ?? "sua conta"}. Escolha uma senha só sua para continuar.`}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="p1" className="mb-1.5 block text-sm font-semibold">Nova senha</label>
          <div className="relative">
            <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input id="p1" type={show ? "text" : "password"} autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} className="h-12 w-full rounded border border-input bg-background pl-10 pr-11 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required minLength={8} aria-describedby="p1-dica" />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={show ? "Ocultar senha" : "Mostrar senha"} aria-pressed={show}>
              {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < s ? (s <= 1 ? "bg-nhf-late" : s === 2 ? "bg-nhf-alert" : "bg-brand") : "bg-foreground/10"}`} />
            ))}
          </div>
          <p id="p1-dica" className="mt-1.5 text-xs text-muted-foreground">Mínimo de 8 caracteres. Misture maiúsculas, minúsculas e números.</p>
        </div>
        <div>
          <label htmlFor="p2" className="mb-1.5 block text-sm font-semibold">Repita a senha</label>
          <div className="relative">
            <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input id="p2" type={show ? "text" : "password"} autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} className="h-12 w-full rounded border border-input bg-background pl-10 pr-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required />
          </div>
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded border border-nhf-late/50 bg-nhf-late/10 p-3 text-sm">
            <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-late" /> {error}
          </p>
        )}
        <Cta type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Salvando…</> : <><Check aria-hidden="true" className="h-4 w-4" /> Salvar e entrar</>}
        </Cta>
      </form>
    </AuthShell>
  );
}
