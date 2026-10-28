import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, DollarSign, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";

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

  const totalPending = items
    .filter((i) => i.status === "pending")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const totalPaid = items
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const statusConfig = {
    pending: { label: "Pendente", icon: Clock, color: "bg-yellow-500/10 text-yellow-500" },
    paid: { label: "Pago", icon: CheckCircle, color: "bg-green-500/10 text-green-500" },
    cancelled: { label: "Cancelado", icon: DollarSign, color: "bg-red-500/10 text-red-500" },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className="text-xs text-yellow-500">A Receber</span>
          </div>
          <p className="text-xl font-bold font-space-grotesk text-yellow-500">
            {formatCurrency(totalPending)}
          </p>
        </Card>

        <Card className="p-4 bg-green-500/10 border-green-500/30">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-green-500">Recebido</span>
          </div>
          <p className="text-xl font-bold font-space-grotesk text-green-500">
            {formatCurrency(totalPaid)}
          </p>
        </Card>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Histórico
        </h3>

        {items.length === 0 ? (
          <Card className="p-6 text-center">
            <Wallet className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma transação encontrada</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.pending;
              const StatusIcon = config.icon;

              return (
                <Card key={item.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-sm font-bold font-space-grotesk">
                        {formatCurrency(item.amount)}
                      </span>
                      <Badge variant="secondary" className={config.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
