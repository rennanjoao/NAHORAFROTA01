import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField, PasswordInput } from "@/components/auth/AuthFields";
import { BrandedLoader } from "@/components/auth/BrandedLoader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/** 0 a 4: tamanho, maiusculas+minusculas, numero, simbolo. */
function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

const STRENGTH_LABEL = ["", "Fraca", "Razoável", "Boa", "Forte"];

/**
 * Troca da senha temporaria no primeiro login. Obrigatoria para contas criadas
 * pelo checkout (user_metadata.must_change_password); ProtectedRoute manda para ca.
 */
export default function PrimeiroAcessoPage() {
  const navigate = useNavigate();
  const { session, user, loading, isDriverUser } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !session) navigate("/login", { replace: true });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (formError) formErrorRef.current?.focus();
  }, [formError]);

  const score = strength(password);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const next: typeof errors = {};
    if (password.length < 8) next.password = "A senha precisa ter pelo menos 8 caracteres.";
    else if (score < 2) next.password = "Misture letras maiúsculas, minúsculas e números.";
    if (!next.password && confirm !== password) next.confirm = "As duas senhas não são iguais.";
    setErrors(next);
    if (next.password) return passwordRef.current?.focus();
    if (next.confirm) return confirmRef.current?.focus();

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    setBusy(false);
    if (error) {
      setFormError(
        /same|different/i.test(error.message)
          ? "Escolha uma senha diferente da temporária."
          : "Não conseguimos salvar a senha. Confira a internet e tente de novo.",
      );
      return;
    }
    navigate(isDriverUser ? "/tracker" : "/dashboard", { replace: true });
  };

  if (loading || !session) {
    return <BrandedLoader label="Conferindo seu acesso" />;
  }

  return (
    <AuthLayout variant="centered" pageTitle="Crie sua senha">
      <div className="space-y-2">
        <p className="nhf-label text-primary">Primeiro acesso</p>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">Crie a sua senha definitiva</h1>
        <p className="text-[0.9375rem] text-muted-foreground">
          Você entrou com a senha temporária de <strong className="font-medium text-foreground">{user?.email}</strong>. Escolha uma senha só sua para continuar.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5" aria-describedby={formError ? "senha-erro" : undefined}>
        {formError && (
          <Alert id="senha-erro" ref={formErrorRef} tabIndex={-1} variant="destructive" className="animate-fade-in outline-none">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <AuthField id="nova-senha" label="Nova senha" error={errors.password} hint="Mínimo de 8 caracteres. Misture maiúsculas, minúsculas e números.">
          {(a11y) => (
            <PasswordInput
              {...a11y}
              ref={passwordRef}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              visible={visible}
              onVisibleChange={setVisible}
              disabled={busy}
              required
              minLength={8}
            />
          )}
        </AuthField>

        {/* Forca da senha: barras + texto (o texto e o que o leitor de tela le). */}
        <div className="-mt-1 space-y-1.5" aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i < score ? (score <= 1 ? "bg-destructive" : score === 2 ? "bg-warning" : "bg-success") : "bg-foreground/10",
                )}
              />
            ))}
          </div>
          {password && <p className="text-xs text-muted-foreground">Força da senha: {STRENGTH_LABEL[score] || "Fraca"}</p>}
        </div>

        <AuthField id="repita-senha" label="Repita a senha" error={errors.confirm}>
          {(a11y) => (
            <PasswordInput
              {...a11y}
              ref={confirmRef}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              visible={visible}
              onVisibleChange={setVisible}
              disabled={busy}
              required
            />
          )}
        </AuthField>

        <Button type="submit" size="lg" className="w-full" aria-disabled={busy || undefined}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Salvando…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" aria-hidden="true" /> Salvar e entrar
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
