import { useState, useEffect } from "react";
import { WalletCards } from "lucide-react";
import { EmptyState, StatusBadge, type Tone } from "@/components/patterns";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatDateOnly } from "@/lib/timezone";
import { ScreenHeader } from "./ScreenHeader";

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

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "A receber", tone: "warning" },
  paid: { label: "Pago", tone: "success" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

export function WalletTab({ driverId }: WalletTabProps) {
  const [items, setItems] = useState<WalletItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWallet();
  }, [driverId]);

  const fetchWallet = async () => {
    try {
      const { data, error } = await supabase
        .from("driver_wallet")
        .select("*")
        .eq("driver_id", driverId)
        .order("date", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error("Error fetching wallet:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const pendingItems = items.filter((i) => i.status === "pending");
  const totalPending = pendingItems.reduce((sum, i) => sum + Number(i.amount), 0);

  const totalPaid = items
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <>
      <ScreenHeader title="Carteira" description="O que você tem para receber e o que já foi pago." />

      {isLoading ? (
        <div role="status" aria-label="Carregando a carteira" className="space-y-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="saldo-titulo" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="relative p-5">
              <div aria-hidden="true" className="nhf-routes pointer-events-none absolute inset-0 opacity-60" />
              <div className="relative">
                <h2 id="saldo-titulo" className="nhf-label text-muted-foreground">
                  A receber
                </h2>
                <p className="mt-2 font-data text-[2.5rem] font-semibold leading-none tracking-tight text-foreground">
                  {formatCurrency(totalPending)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {pendingItems.length === 0
                    ? "Nada pendente agora."
                    : `${pendingItems.length} ${pendingItems.length === 1 ? "lançamento aguardando" : "lançamentos aguardando"} pagamento`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-5 py-4">
              <span className="text-sm font-medium text-muted-foreground">Já recebido</span>
              <span className="font-data text-xl font-semibold text-foreground">{formatCurrency(totalPaid)}</span>
            </div>
          </section>

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
                  const status = STATUS[item.status] ?? STATUS.pending;
                  return (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.9375rem] font-medium text-foreground">{item.description}</p>
                        <p className="font-data text-xs text-muted-foreground">{formatDateOnly(item.date)}</p>
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
