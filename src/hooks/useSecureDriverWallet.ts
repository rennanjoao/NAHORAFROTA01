// Secure wrapper for driver wallet with role-based write protection
// SECURITY: Enforces admin-only write access at application level
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { getCurrentTenantId, requireCurrentTenantId } from "@/lib/tenant";

export interface WalletTransaction {
  id: string;
  driver_id: string;
  description: string;
  amount: number;
  date: string;
  status: string;
  route_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useSecureDriverWallet(driverId?: string) {
  const { isAdmin } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch transactions for a driver
  const fetchTransactions = useCallback(async (targetDriverId?: string) => {
    const id = targetDriverId || driverId;
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setTransactions([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("driver_wallet")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("driver_id", id)
        .order("date", { ascending: false });

      if (fetchError) throw fetchError;
      setTransactions((data as WalletTransaction[]) || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (driverId) {
      fetchTransactions(driverId);
    }
  }, [driverId, fetchTransactions]);

  // SECURITY: Admin-only write operation
  const addTransaction = useCallback(
    async (
      targetDriverId: string,
      description: string,
      amount: number,
      date?: string
    ): Promise<boolean> => {
      if (!isAdmin()) {
        toast({
          title: "⛔ Acesso Negado",
          description: "Apenas administradores podem adicionar transações.",
          variant: "destructive",
        });
        return false;
      }

      try {
        const tenantId = await requireCurrentTenantId();
        const { error } = await supabase.from("driver_wallet").insert({
          tenant_id: tenantId,
          driver_id: targetDriverId,
          description,
          amount,
          date: date || new Date().toISOString().split("T")[0],
          status: "pending",
        });

        if (error) throw error;

        toast({
          title: "✅ Transação Adicionada",
          description: `${description}: R$ ${amount.toFixed(2)}`,
        });

        // Refresh if same driver
        if (targetDriverId === driverId) {
          fetchTransactions(driverId);
        }

        return true;
      } catch (err: any) {
        toast({
          title: "❌ Erro ao adicionar transação",
          description: err.message,
          variant: "destructive",
        });
        return false;
      }
    },
    [isAdmin, driverId, fetchTransactions]
  );

  // SECURITY: Admin-only write operation
  const updateTransactionStatus = useCallback(
    async (transactionId: string, status: string): Promise<boolean> => {
      if (!isAdmin()) {
        toast({
          title: "⛔ Acesso Negado",
          description: "Apenas administradores podem atualizar transações.",
          variant: "destructive",
        });
        return false;
      }

      try {
        const { error } = await supabase
          .from("driver_wallet")
          .update({ status })
          .eq("id", transactionId);

        if (error) throw error;

        // Refresh transactions
        if (driverId) {
          fetchTransactions(driverId);
        }

        return true;
      } catch (err: any) {
        toast({
          title: "❌ Erro ao atualizar transação",
          description: err.message,
          variant: "destructive",
        });
        return false;
      }
    },
    [isAdmin, driverId, fetchTransactions]
  );

  // SECURITY: Admin-only delete operation
  const deleteTransaction = useCallback(
    async (transactionId: string): Promise<boolean> => {
      if (!isAdmin()) {
        toast({
          title: "⛔ Acesso Negado",
          description: "Apenas administradores podem excluir transações.",
          variant: "destructive",
        });
        return false;
      }

      try {
        const { error } = await supabase
          .from("driver_wallet")
          .delete()
          .eq("id", transactionId);

        if (error) throw error;

        // Refresh transactions
        if (driverId) {
          fetchTransactions(driverId);
        }

        return true;
      } catch (err: any) {
        toast({
          title: "❌ Erro ao excluir transação",
          description: err.message,
          variant: "destructive",
        });
        return false;
      }
    },
    [isAdmin, driverId, fetchTransactions]
  );

  // Calculate totals
  const totals = {
    pending: transactions
      .filter((t) => t.status === "pending")
      .reduce((sum, t) => sum + t.amount, 0),
    completed: transactions
      .filter((t) => t.status === "completed" || t.status === "paid")
      .reduce((sum, t) => sum + t.amount, 0),
  };

  return {
    transactions,
    isLoading,
    error,
    fetchTransactions,
    addTransaction,
    updateTransactionStatus,
    deleteTransaction,
    totals,
    canWrite: isAdmin(),
  };
}
