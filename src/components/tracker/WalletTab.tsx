import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw, WalletCards } from "lucide-react";
import { EmptyState, StatusBadge, type Tone } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatDateOnly } from "@/lib/timezone";
import { ScreenHeader } from "./ScreenHeader";
import { DriverInvoicesSection } from "./DriverInvoicesSection";

interface WalletItem {
  id: string;
  amount: number;
  description: string;
  status: string;
  date: string;
}

interface WalletTabProps {
  driverId: string;
}

// Valor negativo = desconto (vale, adiantamento): texto proprio, para nao parecer "recebido".
const CREDIT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "A receber", tone: "warning" },
  paid: { label: "Pago", tone: "success" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};
const DEBIT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "A descontar", tone: "warning" },
  paid: { label: "Descontado", tone: "neutral" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

const statusOf = (item: WalletItem) => {
  const map = Number(item.amount) < 0 ? DEBIT_STATUS : CREDIT_STATUS;
  return map[item.status] ?? map.pending;
};

export function WalletTab({ driverId }: WalletTabProps) {
  const [items, setItems] = useState<WalletItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchWallet = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("driver_wallet")
        .select("*")
        .eq("driver_id", driverId)
        .order("date", { ascending: false });

      if (error) throw error;
      setItems(data || []);
      setFailed(false);
    } catch (err) {
      console.error("Error fetching wallet:", err);
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const pendingItems = items.filter((i) => i.status === "pending");
  const totalPending = pendingItems.reduce((sum, i) => sum + Number(i.amount), 0);
  const paidItems = items.filter((i) => i.status === "paid");
  // Antes somava os descontos pagos aqui e aparecia "Ja recebido -R$ 20,00".
  const totalPaid = paidItems.filter((i) => Number(i.amount) > 0).reduce((sum, i) => sum + Number(i.amount), 0);
  const totalDiscounted = paidItems.filter((i) => Number(i.amount) < 0).reduce((sum, i) => sum - Number(i.amount), 0);

  return (
    <>
      <ScreenHeader title="Carteira" description="O que você tem para receber e o que já foi pago." />

      {isLoading && items.length === 0 && !failed ? (
        <div role="status" aria-label="Carregando a carteira" className="space-y-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : failed && items.length === 0 ? (
        <EmptyState
          icon={CloudOff}
          title="Não foi possível abrir a carteira"
          description="Confira a internet do celular e tente de novo."
          action={
            <Button size="lg" onClick={fetchWallet} aria-busy={isLoading}>
              <RefreshCw className={isLoading ? "animate-spin" : undefined} aria-hidden="true" />
              Tentar de novo
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="saldo-titulo" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="relative p-5">
              <div aria-hidden="true" className="nhf-routes pointer-events-none absolute inset-0 opacity-60" />
              <div className="relative">
                <h2 id="saldo-titulo" className="nhf-label text-muted-foreground">
                  A receber
                </h2>
                <p className="mt-2 break-words font-data text-[2.5rem] font-semibold leading-none tracking-tight text-foreground">
                  {formatCurrency(totalPending)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {pendingItems.length === 0
                    ? "Nada pendente agora."
                    : `Soma de ${pendingItems.length} ${pendingItems.length === 1 ? "lançamento" : "lançamentos"} em aberto.`}
                </p>
              </div>
            </div>
            <dl className="divide-y border-t bg-muted/40">
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <dt className="text-sm font-medium text-muted-foreground">Já recebido</dt>
                <dd className="font-data text-xl font-semibold text-foreground">{formatCurrency(totalPaid)}</dd>
              </div>
              {totalDiscounted > 0 && (
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <dt className="text-sm font-medium text-muted-foreground">Já descontado</dt>
                  <dd className="font-data text-base font-semibold text-foreground">{formatCurrency(totalDiscounted)}</dd>
                </div>
              )}
            </dl>
          </section>

          <DriverInvoicesSection driverId={driverId} />

          <section aria-labelledby="historico-titulo" className="space-y-3">
            <h2 id="historico-titulo" className="text-lg font-semibold text-foreground">
              Histórico
            </h2>

            {items.length === 0 ? (
              <EmptyState
                icon={WalletCards}
                title="Nenhum lançamento ainda"
                description="Fretes, ajudas de custo e vales aparecem aqui quando a base lançar."
              />
            ) : (
              <ul className="stagger divide-y overflow-hidden rounded-xl border bg-card">
                {items.map((item) => {
                  const status = statusOf(item);
                  return (
                    <li key={item.id} className="flex items-start gap-3 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        {/* Texto inteiro (sem "..."): o motorista precisa saber de que e o valor. */}
                        <p className="break-words text-[0.9375rem] font-medium leading-snug text-foreground">{item.description}</p>
                        <p className="mt-0.5 font-data text-xs text-muted-foreground">{formatDateOnly(item.date)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-data text-base font-semibold text-foreground">{formatCurrency(Number(item.amount))}</span>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
