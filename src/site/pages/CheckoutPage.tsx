import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Check, Lock, Loader2, AlertCircle, Building2, User, Mail, Phone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, PLAN_BY_ID, isPlanId, formatBRL, type PlanId } from "@/config/plans";
import { formatCNPJ, validateCNPJ, formatPhone } from "@/lib/cnpjValidation";
import { createCheckout, rememberOrder, CheckoutError } from "@/lib/checkout";
import { SiteLayout } from "../SiteLayout";
import { Cta } from "../components/Cta";

const schema = z.object({
  company_name: z.string().trim().min(3, "Informe a razão social (mínimo 3 letras)."),
  cnpj: z.string().refine((v) => validateCNPJ(v), "CNPJ inválido. Confira os 14 dígitos."),
  contact_name: z.string().trim().min(2, "Informe o seu nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido. Ele será o seu login."),
  whatsapp: z.string().refine((v) => {
    const d = v.replace(/\D/g, "");
    return d.length === 10 || d.length === 11;
  }, "WhatsApp com DDD, 10 ou 11 dígitos."),
});

type Form = z.infer<typeof schema>;
type Errors = Partial<Record<keyof Form, string>>;

const DRAFT_KEY = "nhf:checkout:draft";

function Field({ id, label, icon: Icon, error, hint, children }: { id: string; label: string; icon: React.ElementType; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <Icon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {children}
      </div>
      {error ? (
        <p id={`${id}-erro`} className="mt-1.5 flex items-center gap-1.5 text-sm text-late" role="alert">
          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-dica`} className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded border border-input bg-background pl-10 pr-3 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-nhf-late";

export default function CheckoutPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const canceled = params.get("canceled") === "1";
  const plan = isPlanId(planId) ? PLAN_BY_ID[planId] : null;

  const [form, setForm] = useState<Form>(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) return { company_name: "", cnpj: "", contact_name: "", email: "", whatsapp: "", ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { company_name: "", cnpj: "", contact_name: "", email: "", whatsapp: "" };
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) return;
    document.title = `Assinar ${plan.name} — Na Hora Frota`;
    window.scrollTo({ top: 0 });
  }, [plan]);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: k === "cnpj" ? formatCNPJ(v) : k === "whatsapp" ? formatPhone(v) : v }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const validate = (): Form | null => {
    const r = schema.safeParse(form);
    if (r.success) {
      setErrors({});
      return r.data;
    }
    const next: Errors = {};
    for (const issue of r.error.issues) {
      const k = issue.path[0] as keyof Form;
      if (!next[k]) next[k] = issue.message;
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    document.getElementById(first)?.focus();
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    setServerError(null);
    const data = validate();
    if (!data) return;
    setSubmitting(true);
    try {
      const session = await createCheckout({
        plan: plan.id,
        company_name: data.company_name,
        cnpj: data.cnpj.replace(/\D/g, ""),
        contact_name: data.contact_name,
        email: data.email,
        whatsapp: data.whatsapp.replace(/\D/g, ""),
      });
      rememberOrder(session);
      if (session.mode === "sandbox" && session.checkout_url.startsWith("/")) {
        navigate(session.checkout_url);
      } else {
        window.location.assign(session.checkout_url);
      }
    } catch (err) {
      const msg = err instanceof CheckoutError ? err.message : "Não foi possível iniciar o pagamento. Tente de novo.";
      setServerError(msg);
      setSubmitting(false);
    }
  };

  const included = useMemo(() => (plan ? plan.features.slice(0, 4) : []), [plan]);

  if (!plan) {
    return (
      <SiteLayout>
        <div className="container py-32 text-center">
          <h1 className="font-heading text-3xl font-bold">Plano não encontrado.</h1>
          <p className="mt-3 text-muted-foreground">Escolha um dos três planos para continuar.</p>
          <div className="mt-8 flex justify-center">
            <Cta to="/#planos" arrow>Ver planos</Cta>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout footer={false}>
      <div className="container grid gap-10 pb-20 pt-28 lg:grid-cols-[1.2fr_1fr] lg:gap-14 lg:pt-32">
        <div>
          <p className="label-caps text-brand">Passo 1 de 2 · Seus dados</p>
          <h1 className="mt-3 text-balance font-heading text-3xl font-bold leading-tight sm:text-4xl">
            Quase lá. <span className="text-brand">Liberamos o acesso</span> assim que o pagamento confirmar.
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-muted-foreground">
            O e-mail abaixo vira o seu login de administrador. A senha temporária chega nele e aparece na tela de confirmação.
          </p>

          {canceled && (
            <div role="status" className="mt-6 flex items-start gap-3 rounded border border-nhf-alert/50 bg-nhf-alert/10 p-4 text-sm">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-alert" />
              <p>O pagamento não foi concluído. Seus dados continuam aqui: revise e tente de novo quando quiser.</p>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5" aria-describedby={serverError ? "erro-servidor" : undefined}>
            <fieldset className="space-y-5">
              <legend className="label-caps mb-1 text-muted-foreground">Empresa</legend>
              <Field id="company_name" label="Razão social" icon={Building2} error={errors.company_name}>
                <input id="company_name" name="company_name" autoComplete="organization" className={inputClass} placeholder="Transportes Exemplo LTDA" value={form.company_name} onChange={set("company_name")} aria-invalid={!!errors.company_name} aria-describedby={errors.company_name ? "company_name-erro" : undefined} required />
              </Field>
              <Field id="cnpj" label="CNPJ" icon={ShieldCheck} error={errors.cnpj}>
                <input id="cnpj" name="cnpj" inputMode="numeric" className={inputClass} placeholder="00.000.000/0000-00" value={form.cnpj} onChange={set("cnpj")} maxLength={18} aria-invalid={!!errors.cnpj} aria-describedby={errors.cnpj ? "cnpj-erro" : undefined} required />
              </Field>
            </fieldset>

            <fieldset className="space-y-5">
              <legend className="label-caps mb-1 text-muted-foreground">Administrador da conta</legend>
              <Field id="contact_name" label="Seu nome" icon={User} error={errors.contact_name}>
                <input id="contact_name" name="contact_name" autoComplete="name" className={inputClass} placeholder="Nome e sobrenome" value={form.contact_name} onChange={set("contact_name")} aria-invalid={!!errors.contact_name} aria-describedby={errors.contact_name ? "contact_name-erro" : undefined} required />
              </Field>
              <Field id="email" label="E-mail (será o seu login)" icon={Mail} error={errors.email} hint="Enviamos a senha temporária para este e-mail.">
                <input id="email" name="email" type="email" autoComplete="email" className={inputClass} placeholder="voce@empresa.com.br" value={form.email} onChange={set("email")} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-erro" : "email-dica"} required />
              </Field>
              <Field id="whatsapp" label="WhatsApp" icon={Phone} error={errors.whatsapp} hint="Para avisos sobre a sua conta. Não mandamos propaganda.">
                <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel-national" className={inputClass} placeholder="(11) 99999-9999" value={form.whatsapp} onChange={set("whatsapp")} maxLength={15} aria-invalid={!!errors.whatsapp} aria-describedby={errors.whatsapp ? "whatsapp-erro" : "whatsapp-dica"} required />
              </Field>
            </fieldset>

            {serverError && (
              <div id="erro-servidor" role="alert" className="flex items-start gap-3 rounded border border-nhf-late/50 bg-nhf-late/10 p-4 text-sm">
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-late" />
                <p>{serverError}</p>
              </div>
            )}

            <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
              <Cta type="submit" size="lg" disabled={submitting} className="sm:min-w-[260px]" arrow={!submitting}>
                {submitting ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Abrindo o pagamento…
                  </>
                ) : (
                  <>Ir para o pagamento · {formatBRL(plan.amountCents)}</>
                )}
              </Cta>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock aria-hidden="true" className="h-3.5 w-3.5" /> Pagamento seguro. Cancele quando quiser.
              </p>
            </div>
          </form>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start" aria-labelledby="resumo-title">
          <div className="rounded border border-border bg-card p-6">
            <h2 id="resumo-title" className="label-caps text-muted-foreground">Resumo</h2>

            <div role="radiogroup" aria-label="Escolha o plano" className="mt-4 grid grid-cols-3 gap-2">
              {PLANS.map((p) => (
                <Link
                  key={p.id}
                  to={`/comprar/${p.id}`}
                  replace
                  role="radio"
                  aria-checked={p.id === plan.id}
                  className={cn(
                    "rounded border px-2 py-2 text-center text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    p.id === plan.id ? "border-brand bg-brand/10 text-brand" : "border-border text-foreground/70 hover:border-foreground/40",
                  )}
                >
                  {p.name}
                </Link>
              ))}
            </div>

            <div className="mt-6 flex items-baseline justify-between">
              <p className="font-heading text-2xl font-bold">{plan.name}</p>
              <p className="font-data text-2xl font-bold tabular-nums">
                {formatBRL(plan.amountCents)}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

            <ul className="mt-5 space-y-2.5 text-sm">
              {included.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                  <span className="text-foreground/85">{f}</span>
                </li>
              ))}
              {plan.features.length > included.length && (
                <li className="pl-6 text-muted-foreground">+ {plan.features.length - included.length} itens</li>
              )}
            </ul>

            <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Cobrança</dt><dd>Mensal, no cartão</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Acesso</dt><dd className="text-brand">Liberado na hora</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Fidelidade</dt><dd>Nenhuma</dd></div>
            </dl>

            <ol className="mt-6 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <li className="flex gap-2"><span className="font-data font-bold text-brand">1</span> Você confirma o pagamento.</li>
              <li className="flex gap-2"><span className="font-data font-bold text-brand">2</span> Criamos sua empresa e seu usuário administrador.</li>
              <li className="flex gap-2"><span className="font-data font-bold text-brand">3</span> Login e senha chegam no seu e-mail e aparecem na tela.</li>
            </ol>
          </div>
        </aside>
      </div>
    </SiteLayout>
  );
}
