import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import nahoraFrotaLogo from "@/assets/nahora-frota-logo.png";

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
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast({ title: "Senha muito curta", description: `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`, variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "As senhas não conferem", description: "Digite a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSaving(false);

    if (error) {
      const sameAsOld = /different from the old|same password/i.test(error.message);
      toast({
        title: "Não foi possível alterar a senha",
        description: sameAsOld ? "A nova senha precisa ser diferente da anterior." : error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "✅ Senha alterada", description: "Você já está conectado com a nova senha." });
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={nahoraFrotaLogo} alt="NAHORA FROTA" className="w-48 h-auto object-contain" />
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="pb-4 text-center">
            <h2 className="text-xl font-semibold flex items-center justify-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Definir nova senha
            </h2>
          </CardHeader>
          <CardContent>
            {status === "checking" && (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Validando o link...
              </div>
            )}

            {status === "invalid" && (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Este link de recuperação é inválido ou expirou. Peça um novo link na tela de login.
                </p>
                <Button asChild className="w-full">
                  <Link to="/login">Voltar para o login</Link>
                </Button>
              </div>
            )}

            {status === "ready" && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                      autoComplete="new-password"
                      className="pr-10"
                      disabled={isSaving}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-new-password"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    disabled={isSaving}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
