import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, User, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, CheckCircle, Receipt, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import nahoraFrotaLogo from "@/assets/nahora-frota-logo.png";
import { detectDocumentType, formatDocument, isValidCNPJ, onlyDigits } from "@/lib/documentValidation";
import { TRIAL_DAYS } from "@/lib/billingStatus";
import { getVisitorId, trackFunnelEvent } from "@/lib/funnel";

function formatCNPJ(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 14);
  return cleaned
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const registerSchema = z.object({
  cnpj: z.string().refine((v) => isValidCNPJ(v), "CNPJ inválido"),
  razaoSocial: z.string().min(3, "Razão Social deve ter ao menos 3 caracteres"),
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

async function getFunctionErrorMessage(error: any): Promise<string> {
  const fallback = error?.message || "Erro ao processar cadastro";
  const response = error?.context;

  if (!response || typeof response.clone !== "function") {
    return fallback;
  }

  try {
    const payload = await response.clone().json();
    if (payload?.code === "trial_already_used") {
      return "Este CNPJ/CPF já utilizou o teste grátis. Fale com a equipe NaHora Frota para contratar um plano.";
    }
    return payload?.error || payload?.message || fallback;
  } catch {
    try {
      const text = await response.clone().text();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [useOtherBillingDocument, setUseOtherBillingDocument] = useState(false);
  const [billingDocument, setBillingDocument] = useState("");
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const startedTrackingRef = useRef(false);

  useEffect(() => {
    trackFunnelEvent("page_view");
    trackFunnelEvent("register_view");
  }, []);

  // Primeira interacao com o formulario conta como "iniciou cadastro".
  const markStarted = () => {
    if (startedTrackingRef.current) return;
    startedTrackingRef.current = true;
    trackFunnelEvent("register_started");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const cleanCnpj = cnpj.replace(/\D/g, "");
    const cleanBillingDocument = useOtherBillingDocument ? onlyDigits(billingDocument) : cleanCnpj;

    if (useOtherBillingDocument && !detectDocumentType(cleanBillingDocument)) {
      toast({
        title: "Erro de validação",
        description: "Informe um CPF ou CNPJ de cobrança válido.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const validation = registerSchema.safeParse({
      cnpj: cleanCnpj,
      razaoSocial: razaoSocial.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
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

    trackFunnelEvent("register_submitted", { billing_document_type: detectDocumentType(cleanBillingDocument) || "" });

    try {
      const { data, error } = await supabase.functions.invoke("register-tenant", {
        body: {
          cnpj: cleanCnpj,
          razao_social: razaoSocial.trim(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          billing_document: cleanBillingDocument,
          visitor_id: getVisitorId(),
        },
      });

      if (error) {
        toast({
          title: "Erro no cadastro",
          description: await getFunctionErrorMessage(error),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (data?.error) {
        toast({
          title: "Erro no cadastro",
          description: data.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setTrialEndsAt(data?.trial_ends_at ?? null);

      // O teste comeca na hora: entra direto no sistema.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (!signInError) {
        toast({
          title: `🎉 Teste grátis de ${TRIAL_DAYS} dias liberado`,
          description: "Bem-vindo ao NaHora Frota! Explore à vontade.",
        });
        navigate("/", { replace: true });
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      toast({
        title: "Erro",
        description: await getFunctionErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Teste grátis liberado!</h2>
            <p className="text-muted-foreground text-sm">
              Sua empresa foi cadastrada e você já pode usar o NaHora Frota por {TRIAL_DAYS} dias sem custo.
            </p>
            {trialEndsAt && (
              <p className="text-muted-foreground text-xs">
                Seu teste vai até {new Date(trialEndsAt).toLocaleDateString("pt-BR")}.
              </p>
            )}
            <Button onClick={() => navigate("/login")} className="w-full mt-4">
              Entrar agora
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-6">
          <img
            src={nahoraFrotaLogo}
            alt="NAHORA FROTA"
            className="w-48 h-auto object-contain"
            style={{
              filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))",
            }}
          />
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="pb-3 text-center">
            <h2 className="text-xl font-semibold">Cadastre sua Empresa</h2>
            <p className="text-sm text-muted-foreground">
              Preencha os dados para criar sua conta
            </p>
            <div className="mt-2 inline-flex self-center items-center justify-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Gift className="h-3.5 w-3.5" />
              {TRIAL_DAYS} dias grátis, sem cartão de crédito
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} onChange={markStarted} className="space-y-4">
              {/* CNPJ */}
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                    className="pl-10"
                    disabled={isLoading}
                    required
                    maxLength={18}
                  />
                </div>
              </div>

              {/* Documento de cobrança */}
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="other-billing" className="flex items-center gap-2 text-sm font-normal">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    Cobrar em outro CNPJ/CPF
                  </Label>
                  <Switch
                    id="other-billing"
                    checked={useOtherBillingDocument}
                    onCheckedChange={(checked) => {
                      markStarted();
                      setUseOtherBillingDocument(checked);
                    }}
                    disabled={isLoading}
                  />
                </div>
                {useOtherBillingDocument ? (
                  <Input
                    id="billing-document"
                    placeholder="CPF ou CNPJ de cobrança"
                    value={billingDocument}
                    onChange={(e) => setBillingDocument(formatDocument(e.target.value))}
                    disabled={isLoading}
                    maxLength={18}
                    required
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">A cobrança será feita no CNPJ da empresa.</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  O teste grátis é liberado uma única vez por CNPJ/CPF.
                </p>
              </div>

              {/* Razão Social */}
              <div className="space-y-1.5">
                <Label htmlFor="razao">Razão Social</Label>
                <Input
                  id="razao"
                  placeholder="Nome da Empresa LTDA"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Nome do Responsável */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome do Responsável</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="empresa@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={isLoading}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {isLoading ? "Cadastrando..." : `Começar teste grátis de ${TRIAL_DAYS} dias`}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Já tem conta?</span>
              </div>
            </div>

            <div className="text-center">
              <Link to="/login" className="text-sm text-primary hover:underline">
                Fazer login
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2024 Na Hora Transporte. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
