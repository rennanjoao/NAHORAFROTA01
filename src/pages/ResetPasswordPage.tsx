import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Circle, KeyRound, Link2Off, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField, PasswordInput } from "@/components/auth/AuthFields";
import { cn } from "@/lib/utils";

const MIN_PASSWORD_LENGTH = 8;

// Lido ao carregar o modulo: o supabase-js limpa o token da URL logo depois de
// processa-lo. Sem um link de recuperacao, quem ja esta logado nao troca a
// senha por aqui sem a senha atual (isso fica em Configuracoes > Seguranca).
const OPENED_FROM_RECOVERY_LINK =
  typeof window !== "undefined" &&
  (/type=recovery/.test(window.location.hash) || new URLSearchParams(window.location.search).has("code"));

/**
 * Destino do link "Esqueci minha senha". O supabase-js le o token do link e
 * abre uma sessao de recuperacao; aqui o usuario define a nova senha.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const linkError = new URLSearchParams(window.location.hash.slice(1)).get("error_description");

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && OPENED_FROM_RECOVERY_LINK)) setStatus("ready");
    });

    // O token pode ja ter sido processado antes deste efeito.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && OPENED_FROM_RECOVERY_LINK) setStatus("ready");
      else if (linkError || !OPENED_FROM_RECOVERY_LINK) setStatus("invalid");
    });

    const timeout = window.setTimeout(() => {
      setStatus((current) => (current === "checking" ? "invalid" : current));
    }, 4000);

    return () => {
      listener.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrors({ password: `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` });
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirm) {
      setErrors({ confirm: "As duas senhas estão diferentes. Digite a mesma senha nos dois campos." });
      confirmRef.current?.focus();
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSaving(false);

    if (error) {
      const sameAsOld = /different from the old|same password/i.test(error.message);
      if (sameAsOld) {
        setErrors({ password: "A senha nova precisa ser diferente da anterior." });
        passwordRef.current?.focus();
        return;
      }
      toast({ title: "Não foi possível alterar a senha", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Senha alterada", description: "Você já entrou com a senha nova." });
    navigate("/", { replace: true });
  };

  const rules = [
    { ok: password.length >= MIN_PASSWORD_LENGTH, label: `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres` },
    { ok: password.length > 0 && password === confirm, label: "As duas senhas iguais" },
  ];

  return (
    <AuthLayout>
      <span aria-hidden="true" className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border bg-card text-primary shadow-xs">
        {status === "invalid" ? <Link2Off className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
      </span>

      {status === "checking" && (
        <div role="status" className="space-y-2">
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">Criar nova senha</h1>
          <p className="flex items-center gap-2 text-[0.9375rem] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Conferindo o link do e-mail
          </p>
        </div>
      )}

      {status === "invalid" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">Este link não vale mais</h1>
            <p className="text-[0.9375rem] text-muted-foreground">
              O link de recuperação é inválido ou expirou. Peça um novo na tela de entrar, em "Esqueci minha senha".
            </p>
          </div>
          <Button asChild size="lg" className="w-full">
            <Link to="/login">Voltar para entrar</Link>
          </Button>
        </div>
      )}

      {status === "ready" && (
        <>
          <div className="space-y-2">
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">Criar nova senha</h1>
            <p className="text-[0.9375rem] text-muted-foreground">Escolha uma senha que você lembre. Depois disso, você já entra no sistema.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
            <AuthField id="new-password" label="Nova senha" error={errors.password}>
              {(a11y) => (
                <PasswordInput
                  {...a11y}
                  ref={passwordRef}
                  visible={showPassword}
                  onVisibleChange={setShowPassword}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  autoComplete="new-password"
                  disabled={isSaving}
                  required
                />
              )}
            </AuthField>

            <AuthField id="confirm-new-password" label="Repita a nova senha" error={errors.confirm}>
              {(a11y) => (
                <PasswordInput
                  {...a11y}
                  ref={confirmRef}
                  visible={showPassword}
                  onVisibleChange={setShowPassword}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={isSaving}
                  required
                />
              )}
            </AuthField>

            <ul aria-label="Requisitos da senha" className="space-y-1.5 text-sm">
              {rules.map((rule) => (
                <li key={rule.label} className={cn("flex items-center gap-2", rule.ok ? "text-success" : "text-muted-foreground")}>
                  {rule.ok ? (
                    <Check className="h-4 w-4 animate-pop-in" strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <Circle className="h-4 w-4" aria-hidden="true" />
                  )}
                  {rule.label}
                  <span className="sr-only">{rule.ok ? ": ok" : ": falta"}</span>
                </li>
              ))}
            </ul>

            <Button type="submit" size="lg" className="w-full" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
              Salvar nova senha
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
