 // Hook for manifest database operations with realtime sync
 import { useState, useEffect, useCallback, useMemo } from "react";
 import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
 import { fetchAllPages } from "@/lib/supabasePaging";
import { recalculateManifestTotals } from "@/lib/manifestTotals";
 import { toast } from "@/hooks/use-toast";
 import { getTodayBrazil } from "@/lib/timezone";
 import { getCurrentTenantId } from "@/lib/tenant";
import { friendlyError } from "@/lib/errors";
 
export interface DBManifest {
  id: string;
  manifest_code: string;
  manifest_number: number | null; // Sequential number auto-generated
  driver_id: string | null;
  driver_name: string;
  driver_cpf: string | null;
  vehicle_plate: string | null;
  vehicle_type: string | null;
  is_own_fleet: boolean;
  company_vehicle_id: string | null;
  freight_type: "fixed" | "lumpsum" | "per_km";
  freight_value: number;
  per_km_value: number | null;
  estimated_distance: number | null;
  deliveries_count: number;
  total_weight: number;
  total_value: number;
  scheduled_date: string;
  status: "pending" | "in_progress" | "completed" | "paid" | "cancelled";
  observation: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

// Helper to format manifest number as "N/YYYY"
export const formatManifestNumber = (manifest: DBManifest): string => {
  if (!manifest.manifest_number) return manifest.manifest_code;
  const year = new Date(manifest.created_at).getFullYear();
  return `${manifest.manifest_number}/${year}`;
};
 
 export interface CreateManifestInput {
   driver_id: string;
   driver_name: string;
   driver_cpf?: string;
   vehicle_plate?: string;
   vehicle_type?: string;
   is_own_fleet: boolean;
   company_vehicle_id?: string;
   freight_type: "fixed" | "lumpsum" | "per_km";
   freight_value: number;
   per_km_value?: number;
   estimated_distance?: number;
   scheduled_date?: string;
   observation?: string;
 }
 
 // Generate unique manifest code
 const generateManifestCode = () => {
   const date = new Date();
   const dateStr = date.toISOString().slice(2, 10).replace(/-/g, "");
   const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
   return `ROM-${dateStr}-${rand}`;
 };
 
 export function useManifestsDB() {
   const [manifests, setManifests] = useState<DBManifest[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
   // Fetch all manifests
   const fetchManifests = useCallback(async () => {
     setIsLoading(true);
     setError(null);
 
     try {
       const tenantId = await getCurrentTenantId();
       if (!tenantId) {
         setManifests([]);
         return;
       }

       // Paginado: o Supabase devolve no maximo 1000 linhas por requisicao
       const data = await fetchAllPages((from, to) =>
         supabase
           .from("manifests")
           .select("*")
           .eq("tenant_id", tenantId)
           .order("created_at", { ascending: false })
           .order("id", { ascending: true })
           .range(from, to)
       );
       setManifests((data as DBManifest[]) || []);
     } catch (err: any) {
       setError(err.message);
     } finally {
       setIsLoading(false);
     }
   }, []);
 
   // Subscribe to realtime changes
   useEffect(() => {
     fetchManifests();
 
     const channel = supabase
       .channel(uniqueChannelName("manifests-realtime"))
       .on(
         "postgres_changes",
         { event: "*", schema: "public", table: "manifests" },
         (payload) => {
           if (payload.eventType === "INSERT") {
             setManifests((prev) => [payload.new as DBManifest, ...prev]);
           } else if (payload.eventType === "UPDATE") {
             setManifests((prev) =>
               prev.map((m) => (m.id === (payload.new as DBManifest).id ? (payload.new as DBManifest) : m))
             );
           } else if (payload.eventType === "DELETE") {
             setManifests((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
           }
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [fetchManifests]);
 
  const fetchManifestById = async (manifestId: string): Promise<DBManifest | null> => {
    const { data, error: fetchError } = await supabase.from("manifests").select("*").eq("id", manifestId).maybeSingle();
    if (fetchError) throw fetchError;
    return (data as DBManifest | null) ?? null;
  };

  // Create new manifest using transactional RPC function
  // This ensures atomicity: either everything succeeds or nothing changes
  const createManifest = async (input: CreateManifestInput, invoiceIds: string[]): Promise<DBManifest | null> => {
    try {
      // Use the transactional RPC function
      const { data, error: rpcError } = await supabase.rpc('create_manifest_with_invoices', {
        p_driver_id: input.driver_id,
        p_driver_name: input.driver_name,
        p_driver_cpf: input.driver_cpf || null,
        p_vehicle_plate: input.vehicle_plate || null,
        p_vehicle_type: input.vehicle_type || null,
        p_is_own_fleet: input.is_own_fleet,
        p_company_vehicle_id: input.company_vehicle_id || null,
        p_freight_type: input.freight_type,
        p_freight_value: input.freight_value,
        p_per_km_value: input.per_km_value || null,
        p_estimated_distance: input.estimated_distance || null,
        p_scheduled_date: input.scheduled_date || getTodayBrazil(),
        p_observation: input.observation || null,
        p_invoice_ids: invoiceIds,
      });

      if (rpcError) throw rpcError;

      // Parse the JSON response from RPC
      const result = data as {
        success: boolean;
        manifest_id?: string;
        manifest_code?: string;
        invoices_linked?: number;
        total_value?: number;
        total_weight?: number;
        error?: string;
        message?: string;
      };

      // Check if the RPC returned success
      if (!result.success) {
        throw new Error(result.error || result.message || 'Erro desconhecido ao criar romaneio');
      }

      // Fetch the complete manifest record to return
      const { data: manifestData, error: fetchError } = await supabase
        .from("manifests")
        .select("*")
        .eq("id", result.manifest_id)
        .single();

      if (fetchError) throw fetchError;

      // O sucesso e mostrado pela janela de confirmacao de quem chamou.
      return manifestData as DBManifest;
    } catch (err: any) {
      toast({
        title: "Erro ao criar romaneio",
        description: friendlyError(err, "As notas não foram alteradas. Tente novamente."),
        variant: "destructive",
      });
      return null;
    }
  };
 
   // Get manifests by driver
   const getManifestsByDriver = useCallback(
     (driverId: string) => {
       return manifests.filter((m) => m.driver_id === driverId);
     },
     [manifests]
   );
 
   // Get today's manifests (Brazil timezone)
   const todayManifests = useMemo(() => {
     const today = getTodayBrazil();
     return manifests.filter((m) => m.scheduled_date === today);
   }, [manifests]);
 
   // Fleet stats for today
   const todayFleetStats = useMemo(() => {
     const ownFleet = todayManifests.filter((m) => m.is_own_fleet === true);
     const thirdParty = todayManifests.filter((m) => m.is_own_fleet === false);
 
     // Count unique drivers
     const ownFleetDrivers = new Set(ownFleet.map((m) => m.driver_id)).size;
     const thirdPartyDrivers = new Set(thirdParty.map((m) => m.driver_id)).size;
 
     return {
       ownFleetCount: ownFleetDrivers,
       thirdPartyCount: thirdPartyDrivers,
       ownFleetManifests: ownFleet.length,
       thirdPartyManifests: thirdParty.length,
       totalFreight: thirdParty.reduce((sum, m) => sum + (m.freight_value || 0), 0),
     };
   }, [todayManifests]);
 
   // Get manifests by date range
   const getManifestsByDateRange = useCallback(
     (startDate: string, endDate: string) => {
       return manifests.filter((m) => m.scheduled_date >= startDate && m.scheduled_date <= endDate);
     },
     [manifests]
   );
 
   // Fleet usage report by period
   const getFleetUsageReport = useCallback(
     (startDate: string, endDate: string) => {
       const filtered = getManifestsByDateRange(startDate, endDate);
 
       const ownFleet = filtered.filter((m) => m.is_own_fleet === true);
       const thirdParty = filtered.filter((m) => m.is_own_fleet === false);
 
       // Unique drivers who worked
       const ownFleetDriverIds = new Set(ownFleet.map((m) => m.driver_id));
       const thirdPartyDriverIds = new Set(thirdParty.map((m) => m.driver_id));
 
       return {
         period: { start: startDate, end: endDate },
         ownFleet: {
           driversCount: ownFleetDriverIds.size,
           manifestsCount: ownFleet.length,
           totalDeliveries: ownFleet.reduce((sum, m) => sum + m.deliveries_count, 0),
         },
         thirdParty: {
           driversCount: thirdPartyDriverIds.size,
           manifestsCount: thirdParty.length,
           totalDeliveries: thirdParty.reduce((sum, m) => sum + m.deliveries_count, 0),
           totalFreight: thirdParty.reduce((sum, m) => sum + (m.freight_value || 0), 0),
         },
       };
     },
     [getManifestsByDateRange]
   );
 
  // Remove an invoice from manifest and recalculate totals
  // Creates audit log with user name and reason
  const removeInvoiceFromManifest = async (
    manifestId: string,
    invoiceId: string,
    reason?: string
  ): Promise<boolean> => {
    try {
      // 1. Get current manifest data
      const manifest = manifests.find((m) => m.id === manifestId) ?? (await fetchManifestById(manifestId));
      if (!manifest) throw new Error("Romaneio não encontrado");

      // 2. Get invoice data for audit log
      const { data: invoiceData, error: invoiceFetchError } = await supabase
        .from("invoices")
        .select("nfe_number, total_value, total_weight")
        .eq("id", invoiceId)
        .single();

      if (invoiceFetchError) throw invoiceFetchError;

      // 3. Get current user's full name for audit
      const userFullName = await getCurrentUserFullName();
      const { data: userData } = await supabase.auth.getUser();
      const manifestDisplayNumber = formatManifestNumber(manifest);

      // 4. Clear manifest_id and driver_id from the invoice, set status back to pending
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          manifest_id: null,
          driver_id: null,
          status: "pending",
          route_sequence: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      if (invoiceError) throw invoiceError;

      // 5-7. Recalculate manifest totals from the invoices still linked
      if (!(await updateManifestTotals(manifestId))) {
        throw new Error("NF removida, mas os totais do romaneio não foram recalculados.");
      }

      // 8. Create audit log entry with user's full name and reason
      const removalReason = reason || "Remoção manual do romaneio";
      const { error: auditError } = await supabase
        .from("manifest_audit_logs")
        .insert({
          manifest_id: manifestId,
          invoice_id: invoiceId,
          action_type: "invoice_removed",
          performed_by: userData.user?.id || null,
          performed_by_name: userFullName,
          user_full_name: userFullName,
          notes: `${userFullName} retirou a NF ${invoiceData.nfe_number || invoiceId.slice(0, 8)} do Romaneio nº ${manifestDisplayNumber} - Motivo: ${removalReason}`,
          details: {
            nfe_number: invoiceData.nfe_number,
            invoice_value: invoiceData.total_value,
            invoice_weight: invoiceData.total_weight,
            manifest_number: manifestDisplayNumber,
            removal_reason: removalReason,
          },
        });

      if (auditError) {
        console.error("Error creating audit log:", auditError);
        // Don't fail the operation if audit log fails
      }

      toast({
        title: "NF removida do romaneio",
        description: `A nota foi desvinculada e voltou para pendente.`,
      });

      void fetchManifests();
      return true;
    } catch (err: any) {
      toast({
        title: "Erro ao remover NF",
        description: friendlyError(err),
        variant: "destructive",
      });
      return false;
    }
  };

  // Recalcula quantidade, valor e peso (e o frete fixo por NF) pelas NFs vinculadas.
  const updateManifestTotals = (manifestId: string): Promise<boolean> => recalculateManifestTotals(manifestId);

  // Get current user's full name from profiles
  const getCurrentUserFullName = async (): Promise<string> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) return "Sistema";

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userData.user.id)
        .single();

      return profile?.name || userData.user.email?.split("@")[0] || "Sistema";
    } catch {
      return "Sistema";
    }
  };

  // Add an invoice to an existing manifest (only if status is pending or in_progress)
  // Creates an audit log entry for the action
  const addInvoiceToManifest = async (
    manifestId: string,
    invoiceId: string
  ): Promise<boolean> => {
    try {
      // 1. Verify manifest exists and is in an active status (status atual do banco:
      // o romaneio pode ter sido finalizado sozinho depois que a lista carregou)
      const manifest = await fetchManifestById(manifestId);
      if (!manifest) {
        throw new Error("Romaneio não encontrado");
      }

      // Block if manifest is finalized
      const activeStatuses = ["pending", "in_progress"];
      if (!activeStatuses.includes(manifest.status)) {
        toast({
          title: "Operação bloqueada",
          description: `Não é possível adicionar NFs a um romaneio ${manifest.status === "completed" ? "concluído" : manifest.status === "paid" ? "pago" : "cancelado"}.`,
          variant: "destructive",
        });
        return false;
      }

      // 2. Get invoice data to calculate new totals
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("total_value, total_weight, nfe_number")
        .eq("id", invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // 3. Get current user's full name for audit
      const userFullName = await getCurrentUserFullName();

      // 4. Update the invoice with manifest_id and driver_id (vai para o fim da rota)
      const { data: lastStop } = await supabase
        .from("invoices")
        .select("route_sequence")
        .eq("manifest_id", manifestId)
        .not("route_sequence", "is", null)
        .order("route_sequence", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          manifest_id: manifestId,
          driver_id: manifest.driver_id,
          status: "in_transit",
          route_sequence: (lastStop?.route_sequence ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      if (updateError) throw updateError;

      // 5. Update manifest totals
      if (!(await updateManifestTotals(manifestId))) {
        throw new Error("NF vinculada, mas os totais do romaneio não foram recalculados.");
      }
      const newTotalValue = (Number(manifest.total_value) || 0) + (invoice.total_value || 0);

      // 6. Create audit log entry with user's full name
      const manifestDisplayNumber = formatManifestNumber(manifest);
      const { data: userData } = await supabase.auth.getUser();

      const { error: auditError } = await supabase
        .from("manifest_audit_logs")
        .insert({
          manifest_id: manifestId,
          invoice_id: invoiceId,
          action_type: "invoice_added",
          performed_by: userData.user?.id || null,
          performed_by_name: userFullName,
          user_full_name: userFullName,
          notes: `${userFullName} adicionou a NF ${invoice.nfe_number || invoiceId.slice(0, 8)} ao Romaneio nº ${manifestDisplayNumber}`,
          details: {
            invoice_value: invoice.total_value,
            invoice_weight: invoice.total_weight,
            new_manifest_total: newTotalValue,
            manifest_number: manifestDisplayNumber,
          },
        });

      if (auditError) {
        console.error("Error creating audit log:", auditError);
        // Don't fail the operation if audit log fails
      }

      toast({
        title: "NF adicionada ao romaneio",
        description: `A nota foi vinculada ao Romaneio nº ${manifestDisplayNumber}.`,
      });

      void fetchManifests();
      return true;
    } catch (err: any) {
      toast({
        title: "Erro ao adicionar NF",
        description: friendlyError(err),
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    manifests,
    isLoading,
    error,
    fetchManifests,
    createManifest,
    getManifestsByDriver,
    todayManifests,
    todayFleetStats,
    getManifestsByDateRange,
    getFleetUsageReport,
    removeInvoiceFromManifest,
    updateManifestTotals,
    addInvoiceToManifest,
  };
}
