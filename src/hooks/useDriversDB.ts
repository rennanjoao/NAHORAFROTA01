// Hook for driver database operations with realtime sync
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { toast } from "@/hooks/use-toast";
import { getCurrentTenantId, requireCurrentTenantId } from "@/lib/tenant";
import { friendlyError } from "@/lib/errors";

export interface DBDriver {
  id: string;
  user_id?: string;
  tenant_id?: string | null;
  name: string;
  email?: string | null;
  contact_email?: string | null;
  cpf: string;
  phone: string;
  avatar: string;
  photo?: string;
  photo_url?: string | null;
  vehicle_photo_url?: string | null;
  address?: string;
  vehicle_plate: string;
  vehicle_type: string;
  cnh: string;
  cnh_category: string;
  status: string;
  current_delay?: number;
  individual_sla?: number;
  daily_sla?: number;
  deliveries_completed?: number;
  total_deliveries?: number;
  is_own_fleet?: boolean;
  finished_time?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta?: string;
  chave_pix?: string;
  created_at: string;
  updated_at: string;
}

type DriverUpdatePayload = Partial<DBDriver> & {
  id: string;
};

const DRIVER_ADMIN_PERMISSION_MESSAGE =
  "Você não tem permissão para esta tarefa";

export function useDriversDB() {
  const [drivers, setDrivers] = useState<DBDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setDrivers([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("drivers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        if (fetchError.code === "PGRST116" || fetchError.message.includes("permission denied")) {
          const { data: opData, error: opError } = await supabase
            .from("vw_drivers_operational")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false });

          if (opError) throw opError;

          const mappedDrivers: DBDriver[] = (opData || []).map((d: any) => ({
            id: d.id,
            tenant_id: d.tenant_id,
            name: d.name || "",
            cpf: "",
            phone: "",
            avatar: d.avatar || "",
            photo: d.photo_url,
            vehicle_plate: d.vehicle_plate || "",
            vehicle_type: d.vehicle_type || "",
            cnh: "",
            cnh_category: "",
            status: d.status || "active",
            current_delay: d.current_delay,
            individual_sla: d.individual_sla,
            daily_sla: d.daily_sla,
            deliveries_completed: d.deliveries_completed,
            total_deliveries: d.total_deliveries,
            is_own_fleet: d.is_own_fleet,
            finished_time: d.finished_time,
            created_at: d.created_at,
            updated_at: d.updated_at,
          }));

          setDrivers(mappedDrivers);
          return;
        }

        throw fetchError;
      }

      setDrivers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();

    const channel = supabase
      .channel(uniqueChannelName("drivers-realtime-sync"))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drivers",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newDriver = payload.new as DBDriver;
            setDrivers((prev) => [newDriver, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedDriver = payload.new as DBDriver;
            setDrivers((prev) =>
              prev.map((driver) => (driver.id === updatedDriver.id ? updatedDriver : driver))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any).id;
            setDrivers((prev) => prev.filter((driver) => driver.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDrivers]);

  const addDriver = async (driver: Omit<DBDriver, "id" | "created_at" | "updated_at">): Promise<DBDriver | null> => {
    try {
      const tenantId = await requireCurrentTenantId();
      const { data, error } = await supabase
        .from("drivers")
        .insert({ ...driver, tenant_id: driver.tenant_id ?? tenantId })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Motorista cadastrado",
        description: `${driver.name} foi adicionado e está disponível em todo o sistema.`,
      });

      return data;
    } catch (err: any) {
      console.error("Error adding driver:", err);
      throw err;
    }
  };

  const updateDriver = async (id: string, updates: Partial<DBDriver>): Promise<DBDriver | null> => {
    try {
      const { data, error } = await supabase
        .from("drivers")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;

      let updatedDriver = data as DBDriver | null;

      if (!updatedDriver) {
        const { data: rpcDriver, error: rpcError } = await supabase.rpc("update_driver_details", {
          p_driver: {
            id,
            ...updates,
          } as DriverUpdatePayload,
        });

        if (rpcError && rpcError.code !== "PGRST202") throw rpcError;
        updatedDriver = Array.isArray(rpcDriver) ? (rpcDriver[0] as DBDriver | undefined) ?? null : (rpcDriver as DBDriver | null);
      }

      if (!updatedDriver) {
        throw new Error(DRIVER_ADMIN_PERMISSION_MESSAGE);
      }

      setDrivers((prev) =>
        prev.map((driver) => (driver.id === id ? { ...driver, ...updatedDriver } : driver))
      );

      toast({
        title: "Motorista atualizado",
        description: "Os dados foram sincronizados em todo o sistema.",
      });

      return updatedDriver;
    } catch (err: any) {
      console.error("Error updating driver:", err);
      const message = String(err?.message || "");
      const isPermissionError =
        message.includes("permission") ||
        message.includes("permiss") ||
        message.includes("row-level security") ||
        message.includes("Usuario sem permissao") ||
        message.includes("Nao foi possivel confirmar");

      toast({
        title: "Erro ao atualizar",
        description: isPermissionError
          ? DRIVER_ADMIN_PERMISSION_MESSAGE
          : friendlyError(err, "Não foi possível atualizar o motorista."),
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteDriver = async (id: string, driverName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("drivers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Motorista removido",
        description: `${driverName} foi removido do sistema.`,
      });

      return true;
    } catch (err: any) {
      console.error("Error deleting driver:", err);
      toast({
        title: "Erro ao remover",
        description: friendlyError(err, "Não foi possível remover o motorista."),
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    drivers,
    isLoading,
    error,
    fetchDrivers,
    addDriver,
    updateDriver,
    deleteDriver,
  };
}
