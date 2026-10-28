// Secure wrapper for settlements with role-based write protection
// SECURITY: Enforces admin-only write access at application level
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettlementsDB, DBSettlementItem } from "./useSettlementsDB";
import { toast } from "@/hooks/use-toast";

export function useSecureSettlements() {
  const { isAdmin } = useAuth();
  const settlementsDB = useSettlementsDB();

  // SECURITY: Admin-only write operation
  const markAsPaid = useCallback(
    async (settlementId: string, paymentMethod: string, paymentReference?: string): Promise<boolean> => {
      if (!isAdmin()) {
        toast({
          title: "⛔ Acesso Negado",
          description: "Apenas administradores podem registrar pagamentos.",
          variant: "destructive",
        });
        return false;
      }
      return settlementsDB.markAsPaid(settlementId, paymentMethod, paymentReference);
    },
    [isAdmin, settlementsDB]
  );

  // SECURITY: Admin-only write operation
  const addAdjustmentItem = useCallback(
    async (
      settlementId: string,
      itemType: DBSettlementItem["item_type"],
      description: string,
      amount: number,
      isDeduction: boolean
    ): Promise<boolean> => {
      if (!isAdmin()) {
        toast({
          title: "⛔ Acesso Negado",
          description: "Apenas administradores podem adicionar lançamentos.",
          variant: "destructive",
        });
        return false;
      }
      return settlementsDB.addAdjustmentItem(settlementId, itemType, description, amount, isDeduction);
    },
    [isAdmin, settlementsDB]
  );

  // SECURITY: Admin-only write operation
  const revertToPending = useCallback(
    async (settlementId: string): Promise<boolean> => {
      if (!isAdmin()) {
        toast({
          title: "⛔ Acesso Negado",
          description: "Apenas administradores podem estornar acertos.",
          variant: "destructive",
        });
        return false;
      }
      return settlementsDB.revertToPending(settlementId);
    },
    [isAdmin, settlementsDB]
  );

  // Expose read-only operations unchanged, write operations with guards
  return {
    // Read operations (unchanged)
    settlements: settlementsDB.settlements,
    openSettlements: settlementsDB.openSettlements,
    isLoading: settlementsDB.isLoading,
    error: settlementsDB.error,
    fetchSettlements: settlementsDB.fetchSettlements,
    fetchSettlementItems: settlementsDB.fetchSettlementItems,
    fetchSettlementWithItems: settlementsDB.fetchSettlementWithItems,
    getSettlementsByDriver: settlementsDB.getSettlementsByDriver,
    totalPending: settlementsDB.totalPending,
    totalPaid: settlementsDB.totalPaid,
    // Write operations (secured)
    markAsPaid,
    addAdjustmentItem,
    revertToPending,
    // Helper to check if current user can write
    canWrite: isAdmin(),
  };
}
