import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, User, Mail, Loader2, ArrowRight, CircleCheck, Gift, CreditCard, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField, AuthInput, PasswordInput } from "@/components/auth/AuthFields";
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
  // Campo vazio pede o CNPJ; so diz "invalido" quando a pessoa digitou algo.
  cnpj: z
    .string()
    .min(1, "Digite o CNPJ da empresa.")
    .refine((v) => isValidCNPJ(v), "CNPJ inválido. Confira os 14 números."),
  razaoSocial: z.string().min(3, "Digite a razão social (pelo menos 3 letras)."),
  name: z.string().min(2, "Digite o seu nome."),
  email: z.string().email("Digite um e-mail válido, como nome@empresa.com.br."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
});

type RegisterField = keyof z.infer<typeof registerSchema> | "billingDocument";
type RegisterErrors = Partial<Record<RegisterField, string>>;
// Ordem dos campos na tela (o foco vai para o primeiro com erro).
const FIELD_IDS: Record<RegisterField, string> = {
  cnpj: "cnpj",
  billingDocument: "billing-document",
  razaoSocial: "razao",
  name: "name",
  email: "email",
  password: "password",
};
const FIELD_ORDER: RegisterField[] = ["cnpj", "billingDocument", "razaoSocial", "name", "email", "password"];

const TRIAL_POINTS = [
  { icon: Gift, title: `${TRIAL_DAYS} dias grátis`, text: "Use tudo, sem cartão de crédito e sem compromisso." },
  { icon: Clock, title: "Pronto em 2 minutos", text: "Cadastre a empresa e já comece a importar as notas." },
  { icon: ShieldCheck, title: "Seus dados protegidos", text: "Cada empresa só vê os próprios motoristas e entregas." },
];

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const err = error as { message?: string; context?: Response } | null;
  const fallback = err?.message || "Não foi possível concluir o cadastro. Confira a internet e tente de novo.";
  const response = err?.context;

  if (!response || typeof response.clone !== "function") {
    return fallback;
  }

  try {
    const payload = await response.clone().json();
    if (payload?.code === "trial_already_used") {
      return "Este CNPJ/CPF já utilizou o teste grátis. Fale com a equipe Na Hora Frota para contratar um plano.";
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
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formError) formErrorRef.current?.focus();
  }, [formError]);

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

  const showErrors = (next: RegisterErrors) => {
    setErrors(next);
    const first = FIELD_ORDER.find((field) => next[field]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  };

  // Limpa o erro do campo assim que a pessoa corrige.
  const clearError = (field: RegisterField) => {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});
    setFormError(null);

    const cleanCnpj = cnpj.replace(/\D/g, "");
    const cleanBillingDocument = useOtherBillingDocument ? onlyDigits(billingDocument) : cleanCnpj;

    if (useOtherBillingDocument && !detectDocumentType(cleanBillingDocument)) {
      showErrors({ billingDocument: "Digite um CPF ou CNPJ válido para a cobrança." });
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
      const fieldErrors: RegisterErrors = {};
      validation.error.errors.forEach((issue) => {
        const field = issue.path[0] as RegisterField;
        fieldErrors[field] ??= issue.message;
      });
      showErrors(fieldErrors);
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
        setFormError(await getFunctionErrorMessage(error));
        setIsLoading(false);
        return;
      }

      if (data?.error) {
        setFormError(data.error);
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
          title: `Teste grátis de ${TRIAL_DAYS} dias liberado`,
          description: "Bem-vindo ao Na Hora Frota. Seu teste já começou.",
        });
        navigate("/dashboard", { replace: true });
        return;
      }

      setSuccess(true);
    } catch (err) {
      setFormError(await getFunctionErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout variant="centered" pageTitle="Teste grátis liberado">
        <div className="space-y-4 text-center">
          <span aria-hidden="true" className="mx-auto flex h-16 w-16 animate-pop-in items-center justify-center rounded-full bg-success text-success-foreground">
            <CircleCheck className="h-8 w-8" />
          </span>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">Teste grátis liberado</h1>
          <p className="text-[0.9375rem] text-muted-foreground">
            Sua empresa foi cadastrada. Você pode usar o Na Hora Frota por {TRIAL_DAYS} dias sem pagar nada.
          </p>
          {trialEndsAt && (
            <p className="text-sm text-muted-foreground">
              O teste vai até <span className="font-data font-medium text-foreground">{new Date(trialEndsAt).toLocaleDateString("pt-BR")}</span>.
            </p>
          )}
          <Button onClick={() => navigate("/login")} size="lg" className="mt-2 w-full">
            Entrar agora
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      width="md"
      pageTitle="Cadastrar empresa"
      points={TRIAL_POINTS}
      headline={
        <>
          Sua frota organizada <span className="text-primary">a partir de hoje.</span>
        </>
      }
    >
      <div className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Gift className="h-3.5 w-3.5" aria-hidden="true" />
          {TRIAL_DAYS} dias grátis, sem cartão de crédito
        </span>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">Cadastre sua empresa</h1>
        <p className="text-[0.9375rem] text-muted-foreground">Leva uns 2 minutos. Depois você já entra no sistema.</p>
      </div>

      <form onSubmit={handleSubmit} onChange={markStarted} noValidate className="mt-8 space-y-8">
        {formError && (
          <Alert ref={formErrorRef} tabIndex={-1} variant="destructive" className="animate-fade-in outline-none">
            <p className="mb-1 font-semibold leading-snug text-foreground">Não foi possível concluir o cadastro</p>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <fieldset className="space-y-5" disabled={isLoading}>
          <legend className="nhf-label text-muted-foreground">Sua empresa</legend>

          <AuthField id="cnpj" label="CNPJ" icon={Building2} error={errors.cnpj}>
            {(a11y) => (
              <AuthInput
                {...a11y}
                withIcon
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => {
                  setCnpj(formatCNPJ(e.target.value));
                  clearError("cnpj");
                }}
                required
                maxLength={18}
              />
            )}
          </AuthField>

          <AuthField id="razao" label="Razão social" error={errors.razaoSocial}>
            {(a11y) => (
              <AuthInput
                {...a11y}
                placeholder="Nome da empresa LTDA"
                autoComplete="organization"
                value={razaoSocial}
                onChange={(e) => {
                  setRazaoSocial(e.target.value);
                  clearError("razaoSocial");
                }}
                required
              />
            )}
          </AuthField>

          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="other-billing" className="flex items-center gap-2.5 font-normal">
                <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Cobrar em outro CNPJ ou CPF
              </Label>
              <Switch
                id="other-billing"
                checked={useOtherBillingDocument}
                onCheckedChange={(checked) => {
                  markStarted();
                  setUseOtherBillingDocument(checked);
                  clearError("billingDocument");
                }}
              />
            </div>
            {useOtherBillingDocument ? (
              <div className="animate-fade-in">
                <AuthField id="billing-document" label="CPF ou CNPJ da cobrança" error={errors.billingDocument}>
                  {(a11y) => (
                    <AuthInput
                      {...a11y}
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={billingDocument}
                      onChange={(e) => {
                        setBillingDocument(formatDocument(e.target.value));
                        clearError("billingDocument");
                      }}
                      maxLength={18}
                      required
                    />
                  )}
                </AuthField>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">A cobrança sai no CNPJ da empresa.</p>
            )}
            <p className="text-xs text-muted-foreground">O teste grátis vale uma vez por CNPJ ou CPF.</p>
          </div>
        </fieldset>

        <fieldset className="space-y-5" disabled={isLoading}>
          <legend className="nhf-label text-muted-foreground">Seu acesso</legend>

          <AuthField id="name" label="Seu nome" icon={User} error={errors.name}>
            {(a11y) => (
              <AuthInput
                {...a11y}
                withIcon
                placeholder="Nome e sobrenome"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                required
              />
            )}
          </AuthField>

          <AuthField id="email" label="E-mail" icon={Mail} error={errors.email} hint="Você vai usar este e-mail para entrar.">
            {(a11y) => (
              <AuthInput
                {...a11y}
                withIcon
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nome@empresa.com.br"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError("email");
                }}
                required
              />
            )}
          </AuthField>

          <AuthField id="password" label="Crie uma senha" error={errors.password} hint="Pelo menos 8 caracteres.">
            {(a11y) => (
              <PasswordInput
                {...a11y}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError("password");
                }}
                required
                minLength={8}
              />
            )}
          </AuthField>
        </fieldset>

        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          {isLoading ? "Cadastrando" : `Começar teste grátis de ${TRIAL_DAYS} dias`}
        </Button>
      </form>

      <p className="mt-8 border-t pt-6 text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
