 // Hook for settlement database operations with realtime sync
 import { useState, useEffect, useCallback, useMemo } from "react";
 import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
 import { toast } from "@/hooks/use-toast";
 import { getCurrentTenantId, requireCurrentTenantId } from "@/lib/tenant";
 
 export interface DBSettlement {
   id: string;
   driver_id: string;
   driver_name: string;
   period_start: string;
   period_end: string | null;
   status: "open" | "closed" | "paid" | "disputed";
   total_freight: number;
   total_deductions: number;
   total_additions: number;
   net_amount: number;
   paid_amount: number | null;
   paid_at: string | null;
   paid_by: string | null;
   payment_method: string | null;
   payment_reference: string | null;
   observation: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export interface DBSettlementItem {
   id: string;
   settlement_id: string;
   manifest_id: string | null;
   item_type: "freight" | "bonus" | "discount" | "advance" | "toll" | "fuel" | "unloading" | "other";
   description: string;
   amount: number;
   is_deduction: boolean;
   created_by: string | null;
   created_at: string;
 }
 
 export interface SettlementWithItems extends DBSettlement {
   items: DBSettlementItem[];
 }
 
 export function useSettlementsDB() {
   const [settlements, setSettlements] = useState<DBSettlement[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
   // Fetch all settlements
   const fetchSettlements = useCallback(async () => {
     setIsLoading(true);
     setError(null);
 
     try {
       const tenantId = await getCurrentTenantId();
       if (!tenantId) {
         setSettlements([]);
         return;
       }

       const { data, error: fetchError } = await supabase
         .from("settlements")
         .select("*")
         .eq("tenant_id", tenantId)
         .order("created_at", { ascending: false });
 
       if (fetchError) throw fetchError;
       setSettlements((data as DBSettlement[]) || []);
     } catch (err: any) {
       setError(err.message);
     } finally {
       setIsLoading(false);
     }
   }, []);
 
   // Fetch settlement items for a specific settlement
   const fetchSettlementItems = async (settlementId: string): Promise<DBSettlementItem[]> => {
   const { data, error } = await supabase
     .from("settlement_items")
     .select("*")
     .eq("settlement_id", settlementId)
       .order("created_at", { ascending: false });
 
     if (error) throw error;
     return (data as DBSettlementItem[]) || [];
   };
 
   // Fetch full settlement with items
   const fetchSettlementWithItems = async (settlementId: string): Promise<SettlementWithItems | null> => {
     const settlement = settlements.find(s => s.id === settlementId);
     if (!settlement) return null;
 
     const items = await fetchSettlementItems(settlementId);
     return { ...settlement, items };
   };
 
   // Subscribe to realtime changes
   useEffect(() => {
     fetchSettlements();
 
     const channel = supabase
       .channel(uniqueChannelName("settlements-realtime"))
       .on(
         "postgres_changes",
         { event: "*", schema: "public", table: "settlements" },
         (payload) => {
           if (payload.eventType === "INSERT") {
             setSettlements((prev) => [payload.new as DBSettlement, ...prev]);
           } else if (payload.eventType === "UPDATE") {
             setSettlements((prev) =>
               prev.map((s) => (s.id === (payload.new as DBSettlement).id ? (payload.new as DBSettlement) : s))
             );
           } else if (payload.eventType === "DELETE") {
             setSettlements((prev) => prev.filter((s) => s.id !== (payload.old as any).id));
           }
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [fetchSettlements]);
 
   // Get open settlements only (for pending payments)
   const openSettlements = useMemo(() => {
     return settlements.filter((s) => s.status === "open");
   }, [settlements]);
 
   // Get settlement by driver
   const getSettlementsByDriver = useCallback(
     (driverId: string) => {
       return settlements.filter((s) => s.driver_id === driverId);
     },
     [settlements]
   );
 
   // Mark settlement as paid
   const markAsPaid = async (
     settlementId: string,
     paymentMethod: string,
     paymentReference?: string
   ): Promise<boolean> => {
     try {
       const settlement = settlements.find((s) => s.id === settlementId);
       if (!settlement) throw new Error("Acerto não encontrado");
 
       const { error } = await supabase
         .from("settlements")
         .update({
           status: "paid",
           paid_at: new Date().toISOString(),
           paid_amount: settlement.net_amount,
           payment_method: paymentMethod,
           payment_reference: paymentReference || null,
         })
         .eq("id", settlementId);
 
       if (error) throw error;
 
       toast({
         title: "Acerto Finalizado.",
         description: `Pagamento registrado com sucesso.`,
       });
       return true;
     } catch (err: any) {
       toast({
         title: "Erro ao finalizar acerto",
         description: err.message,
         variant: "destructive",
       });
       return false;
     }
   };
 
   // Add adjustment item (bonus, discount, etc.)
   const addAdjustmentItem = async (
     settlementId: string,
     itemType: DBSettlementItem["item_type"],
     description: string,
     amount: number,
     isDeduction: boolean
   ): Promise<boolean> => {
     try {
       const tenantId = await requireCurrentTenantId();
       // Insert item
       const { error: itemError } = await supabase.from("settlement_items").insert({
         tenant_id: tenantId,
         settlement_id: settlementId,
         item_type: itemType,
         description,
         amount: Math.abs(amount),
         is_deduction: isDeduction,
       });
 
       if (itemError) throw itemError;
 
       // Update settlement totals
       const settlement = settlements.find((s) => s.id === settlementId);
       if (settlement) {
         const updateField = isDeduction ? "total_deductions" : "total_additions";
         const currentValue = isDeduction ? settlement.total_deductions : settlement.total_additions;
 
         const { error: updateError } = await supabase
           .from("settlements")
           .update({ [updateField]: currentValue + Math.abs(amount) })
           .eq("id", settlementId);
 
         if (updateError) throw updateError;
       }
 
       toast({
         title: isDeduction ? "Desconto adicionado" : "Crédito adicionado",
         description: `${description}: R$ ${Math.abs(amount).toFixed(2)}`,
       });
       return true;
     } catch (err: any) {
       toast({
         title: "Erro ao adicionar lançamento",
         description: err.message,
         variant: "destructive",
       });
       return false;
     }
   };
 
   // Totals
   const totals = useMemo(() => {
     const open = openSettlements.reduce((sum, s) => sum + (s.net_amount || 0), 0);
     const paid = settlements
       .filter((s) => s.status === "paid")
       .reduce((sum, s) => sum + (s.paid_amount || 0), 0);
     return { totalPending: open, totalPaid: paid };
   }, [settlements, openSettlements]);
 
  // Revert settlement from paid to open (for reversal/estorno)
  const revertToPending = async (settlementId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("settlements")
        .update({
          status: "open",
          paid_at: null,
          paid_amount: null,
          payment_method: null,
          payment_reference: null,
        })
        .eq("id", settlementId);

      if (error) throw error;

      return true;
    } catch (err: any) {
      toast({
        title: "Erro ao estornar",
        description: err.message,
        variant: "destructive",
      });
      return false;
    }
  };

   return {
     settlements,
     openSettlements,
     isLoading,
     error,
     fetchSettlements,
     fetchSettlementItems,
     fetchSettlementWithItems,
     getSettlementsByDriver,
     markAsPaid,
     addAdjustmentItem,
     revertToPending,
     ...totals,
   };
 }
