import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Copy, Eye, EyeOff, Loader2, Mail, MessageCircle, AlertCircle, Smartphone, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_BY_ID } from "@/config/plans";
import { getOrder, recallOrder, buildWhatsAppLink, type OrderPublic } from "@/lib/checkout";
import { SiteLayout } from "../SiteLayout";
import { Cta } from "../components/Cta";

const SUPPORT_EMAIL = "suporte@nahorafrota.com.br";

type StepState = "done" | "active" | "todo" | "error";

function Step({ n, label, state }: { n: number; label: string; state: StepState }) {
  return (
    <li className="flex items-center gap-3" aria-current={state === "active" ? "step" : undefined}>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-data text-sm font-bold",
          state === "done" && "border-brand bg-brand text-nhf-ink",
          state === "active" && "border-brand text-brand",
          state === "todo" && "border-border text-muted-foreground",
          state === "error" && "border-nhf-late text-late",
        )}
      >
        {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : state === "active" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : n}
      </span>
      <span className={cn("text-sm font-medium", state === "todo" && "text-muted-foreground")}>
        {label}
        <span className="sr-only">{state === "done" ? " (concluído)" : state === "active" ? " (em andamento)" : state === "error" ? " (falhou)" : ""}</span>
      </span>
    </li>
  );
}

export default function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const remembered = recallOrder();
  const orderId = params.get("order") || remembered?.order_id || "";
  const token = params.get("t") || remembered?.access_token || "";

  const [order, setOrder] = useState<OrderPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [copied, setCopied] = useState<"email" | "pass" | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    document.title = "Acesso liberado — Na Hora Frota";
    if (!orderId || !token) {
      setError("Não encontramos o seu pedido. Se você já pagou, verifique o e-mail ou fale com o suporte.");
      return;
    }
    let stop = false;
    let timer = 0;
    const tick = async () => {
      try {
        const o = await getOrder(orderId, token);
        if (stop) return;
        setOrder(o);
        if (o.status === "provisioned" || o.status === "failed" || o.status === "canceled") return;
        tries.current += 1;
        if (tries.current > 90) {
          setError("O pagamento está demorando para confirmar. Assim que confirmar, o acesso chega no seu e-mail.");
          return;
        }
        timer = window.setTimeout(tick, 2000);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "Não foi possível consultar o pedido.");
      }
    };
    tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [orderId, token]);

  const copy = async (what: "email" | "pass", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard bloqueado: o campo continua selecionável */
    }
  };

  const status = order?.status;
  const steps: StepState[] =
    status === "provisioned"
      ? ["done", "done", "done"]
      : status === "paid"
        ? ["done", "active", "todo"]
        : status === "failed"
          ? ["done", "error", "todo"]
          : ["active", "todo", "todo"];

  const plan = order ? PLAN_BY_ID[order.plan] : null;
  const loginUrl = order?.login_url || `${window.location.origin}/login`;
  // Conversão do teste grátis com o mesmo login: a senha da pessoa continua a mesma.
  const existingUser = !!order?.existing_user;
  const conversion = order?.kind === "conversion";
  const waText = order
    ? `Acesso Na Hora Frota\nEmpresa: ${order.company_name}\nLogin: ${order.email}\n${existingUser ? "Senha: a mesma que você já usa" : `Senha temporária: ${order.temp_password ?? "(enviada por e-mail)"}`}\nEntrar: ${loginUrl}`
    : "";

  return (
    <SiteLayout footer={false}>
      <div className="container max-w-3xl pb-20 pt-28 lg:pt-32">
        {error && !order && (
          <div role="alert" className="flex items-start gap-3 rounded border border-nhf-late/50 bg-nhf-late/10 p-4 text-sm">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-late" />
            <p>{error} <a className="font-semibold underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
          </div>
        )}

        <p className="label-caps text-brand">{status === "provisioned" ? "Tudo pronto" : "Confirmando"}</p>
        <h1 className="mt-3 text-balance font-heading text-3xl font-bold leading-tight sm:text-4xl" aria-live="polite">
          {status === "provisioned" ? (
            existingUser ? (
              <>Pagamento confirmado. <span className="text-brand">Sua assinatura está ativa.</span></>
            ) : (
              <>Pagamento confirmado. <span className="text-brand">Seu acesso está pronto.</span></>
            )
          ) : status === "failed" ? (
            <>Pagamento confirmado, mas <span className="text-late">algo travou na criação da conta.</span></>
          ) : (
            <>Confirmando o pagamento e <span className="text-brand">preparando o seu acesso</span>…</>
          )}
        </h1>

        <ol className="mt-8 grid gap-3 rounded border border-border bg-card p-5 sm:grid-cols-3" aria-label="Etapas">
          <Step n={1} label="Pagamento confirmado" state={steps[0]} />
          <Step n={2} label={conversion ? "Assinatura ativada na empresa" : "Empresa e usuário criados"} state={steps[1]} />
          <Step n={3} label={existingUser ? "Confirmação enviada por e-mail" : "Acesso enviado por e-mail"} state={steps[2]} />
        </ol>

        {status === "failed" && (
          <div role="alert" className="mt-6 rounded border border-nhf-late/50 bg-nhf-late/10 p-5 text-sm">
            <p className="font-semibold">Não se preocupe: o pagamento está registrado.</p>
            <p className="mt-1 text-muted-foreground">{order?.error || "Nossa equipe vai concluir a criação manualmente."} Escreva para <a className="font-semibold underline" href={`mailto:${SUPPORT_EMAIL}?subject=Pedido%20${orderId}`}>{SUPPORT_EMAIL}</a> informando o pedido <span className="font-data">{orderId.slice(0, 8)}</span>.</p>
          </div>
        )}

        {status === "provisioned" && order && plan && (
          <>
            <section aria-labelledby="acesso-title" className="mt-6 rounded border border-brand bg-card p-6 glow-brand">
              <h2 id="acesso-title" className="font-heading text-xl font-bold">{existingUser ? "Sua assinatura está ativa" : "Seu acesso de administrador"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {existingUser ? (
                  <>A <strong className="text-foreground">{order.company_name}</strong> saiu do teste grátis e está no plano <strong className="text-foreground">{plan.name}</strong>. Nada muda no seu login: entre com a senha que você já usa.</>
                ) : conversion ? (
                  <>A <strong className="text-foreground">{order.company_name}</strong> já estava no Na Hora Frota e agora está no plano <strong className="text-foreground">{plan.name}</strong>, com você como administrador. Guarde estes dados: a senha temporária é trocada no primeiro login.</>
                ) : (
                  <>Plano <strong className="text-foreground">{plan.name}</strong> para <strong className="text-foreground">{order.company_name}</strong>. Guarde estes dados: a senha temporária é trocada no primeiro login.</>
                )}
              </p>

              <dl className="mt-5 space-y-3">
                <div className="rounded border border-border bg-background p-3">
                  <dt className="label-caps text-muted-foreground">Login (e-mail)</dt>
                  <dd className="mt-1 flex items-center justify-between gap-3">
                    <code className="select-all break-all font-data text-base">{order.email}</code>
                    <button type="button" onClick={() => copy("email", order.email)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-border px-2.5 text-xs font-semibold hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Copiar e-mail">
                      {copied === "email" ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-brand" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />} {copied === "email" ? "Copiado" : "Copiar"}
                    </button>
                  </dd>
                </div>
                <div className="rounded border border-border bg-background p-3">
                  <dt className="label-caps text-muted-foreground">{existingUser ? "Senha" : "Senha temporária"}</dt>
                  <dd className="mt-1 flex items-center justify-between gap-3">
                    {existingUser ? (
                      <span className="text-base">
                        A mesma que você já usa.{" "}
                        <Link to="/login" state={{ email: order.email, fromCheckout: true, existingUser: true }} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
                          Esqueceu? Redefina na tela de entrada
                        </Link>
                      </span>
                    ) : (
                    <code className="select-all font-data text-base tracking-wider" aria-label={showPass ? `Senha temporária ${order.temp_password}` : "Senha temporária oculta"}>
                      {order.temp_password ? (showPass ? order.temp_password : "•".repeat(order.temp_password.length)) : "enviada por e-mail"}
                    </code>
                    )}
                    <span className="flex shrink-0 gap-2">
                      {order.temp_password && (
                        <button type="button" onClick={() => setShowPass((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded border border-border px-2.5 text-xs font-semibold hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-pressed={showPass} aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}>
                          {showPass ? <EyeOff aria-hidden="true" className="h-3.5 w-3.5" /> : <Eye aria-hidden="true" className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      {order.temp_password && (
                        <button type="button" onClick={() => copy("pass", order.temp_password!)} className="inline-flex h-9 items-center gap-1.5 rounded border border-border px-2.5 text-xs font-semibold hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Copiar senha temporária">
                          {copied === "pass" ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-brand" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />} {copied === "pass" ? "Copiada" : "Copiar"}
                        </button>
                      )}
                    </span>
                  </dd>
                </div>
              </dl>

              <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground" role="status">
                <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                {order.access_email_status === "sent" && <span>Enviamos {existingUser ? "a confirmação" : "também"} para <strong className="text-foreground">{order.email}</strong>. Se não aparecer em 2 minutos, confira o spam.</span>}
                {order.access_email_status === "pending" && <span>Enviando para <strong className="text-foreground">{order.email}</strong>…</span>}
                {order.access_email_status === "failed" && <span>Não conseguimos enviar o e-mail. Anote os dados acima; eles também valem para entrar.</span>}
                {order.access_email_status === "not_configured" && <span>Anote os dados acima: eles são o seu acesso. (Envio de e-mail não configurado neste ambiente.)</span>}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Cta size="lg" arrow onClick={() => navigate("/login", { state: { email: order.email, fromCheckout: true, existingUser } })}>
                  Entrar agora
                </Cta>
                {order.whatsapp && (
                  <a
                    href={buildWhatsAppLink(order.whatsapp, waText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-14 items-center justify-center gap-2 rounded border border-border px-5 font-heading font-semibold hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MessageCircle aria-hidden="true" className="h-4 w-4" /> Salvar no meu WhatsApp
                  </a>
                )}
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Próximos passos">
              <div className="rounded border border-border bg-card p-5">
                <p className="label-caps text-brand">Primeiros 10 minutos</p>
                <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2"><span className="font-data font-bold text-foreground">1</span> {existingUser ? "Entre com a sua senha de sempre." : "Entre e crie a sua senha definitiva."}</li>
                  <li className="flex gap-2"><span className="font-data font-bold text-foreground">2</span> {conversion ? "Confira motoristas e veículos já cadastrados." : "Cadastre motoristas e veículos."}</li>
                  <li className="flex gap-2"><span className="font-data font-bold text-foreground">3</span> Importe o XML das notas de hoje e monte o primeiro romaneio.</li>
                </ol>
              </div>
              <div className="rounded border border-border bg-card p-5">
                <p className="label-caps flex items-center gap-1.5 text-brand"><Smartphone aria-hidden="true" className="h-3.5 w-3.5" /> App do motorista</p>
                <p className="mt-3 text-sm text-muted-foreground">Cada motorista recebe o próprio login ao ser cadastrado. No celular, ele abre o link e instala como app.</p>
                <Link to="/install" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  Ver instruções de instalação <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </SiteLayout>
  );
}
