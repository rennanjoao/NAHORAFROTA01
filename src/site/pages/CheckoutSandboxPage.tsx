import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FlaskConical, Loader2, QrCode, CreditCard, AlertCircle } from "lucide-react";
import { formatBRL, PLAN_BY_ID } from "@/config/plans";
import { getOrder, confirmSandboxPayment, type OrderPublic } from "@/lib/checkout";
import { SiteLayout } from "../SiteLayout";
import { Cta } from "../components/Cta";

/** QR falso (padrão determinístico) só para a tela de teste. */
function FakeQr({ seed }: { seed: string }) {
  const cells: boolean[] = [];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < 21 * 21; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    cells.push(((h >>> 16) & 1) === 1);
  }
  return (
    <svg viewBox="0 0 21 21" className="h-44 w-44 rounded bg-white p-2" aria-hidden="true">
      {cells.map((on, i) => (on ? <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#080808" /> : null))}
      {[[0, 0], [14, 0], [0, 14]].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <rect x={x} y={y} width="7" height="7" fill="#080808" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="#080808" />
        </g>
      ))}
    </svg>
  );
}

export default function CheckoutSandboxPage() {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approved" | "declined" | null>(null);

  useEffect(() => {
    document.title = "Pagamento (ambiente de teste) — Na Hora Frota";
    if (!orderId || !token) {
      setError("Link de pagamento inválido.");
      return;
    }
    getOrder(orderId, token)
      .then(setOrder)
      .catch((e) => setError(e.message));
  }, [orderId, token]);

  const act = async (outcome: "approved" | "declined") => {
    if (!orderId) return;
    setBusy(outcome);
    setError(null);
    try {
      await confirmSandboxPayment(orderId, token, outcome);
      if (outcome === "approved") navigate(`/comprar/sucesso?order=${orderId}&t=${token}`);
      else navigate(`/comprar/${order?.plan ?? "control"}?canceled=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível confirmar. Tente de novo.");
      setBusy(null);
    }
  };

  const plan = order ? PLAN_BY_ID[order.plan] : null;

  return (
    <SiteLayout footer={false}>
      <div className="container max-w-2xl pb-20 pt-28 lg:pt-32">
        <div className="mb-6 flex items-center gap-2 rounded border border-nhf-alert/50 bg-nhf-alert/10 px-4 py-3 text-sm">
          <FlaskConical aria-hidden="true" className="h-4 w-4 text-alert" />
          <p>
            <strong>Ambiente de teste.</strong> Nenhuma cobrança real. Em produção esta etapa é a página de pagamento do Stripe.
          </p>
        </div>

        <p className="label-caps text-brand">Passo 2 de 2 · Pagamento</p>
        <h1 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">Confirme o pagamento.</h1>

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded border border-nhf-late/50 bg-nhf-late/10 p-4 text-sm">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-late" />
            <p>{error}</p>
          </div>
        )}

        {!order && !error && (
          <p className="mt-8 flex items-center gap-2 text-muted-foreground"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Carregando o pedido…</p>
        )}

        {order && plan && (
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_auto]">
            <div className="rounded border border-border bg-card p-6">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Empresa</dt><dd className="font-semibold">{order.company_name}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Plano</dt><dd className="font-semibold">{plan.name}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Login</dt><dd className="font-semibold">{order.email}</dd></div>
                <div className="flex justify-between border-t border-border pt-3 text-base"><dt>Total hoje</dt><dd className="font-data font-bold text-brand">{formatBRL(order.amount_cents)}</dd></div>
              </dl>
              <div className="mt-6 flex flex-col gap-3">
                <Cta onClick={() => act("approved")} disabled={!!busy} size="lg" arrow={!busy}>
                  {busy === "approved" ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Confirmando…</> : <><CreditCard aria-hidden="true" className="h-4 w-4" /> Simular pagamento aprovado</>}
                </Cta>
                <Cta onClick={() => act("declined")} disabled={!!busy} variant="outline">
                  Simular pagamento recusado
                </Cta>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 rounded border border-border bg-card p-6">
              <FakeQr seed={order.id} />
              <p className="flex items-center gap-1.5 font-data text-xs uppercase tracking-wider text-muted-foreground"><QrCode aria-hidden="true" className="h-3.5 w-3.5" /> Pix ilustrativo</p>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
