import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { openWhatsApp } from "@/lib/whatsapp";
import type { Driver } from "@/contexts/LogisticsContext";
import type { DriverExtras } from "./driverConfig";

export type DriverRecord = Driver & DriverExtras;

/** Id do banco (uuid) do motorista; cai no id numerico da lista se faltar. */
export function driverDbId(driver: DriverRecord): string {
  return driver._dbId || driver.id.toString();
}

/** Acoes rapidas usadas na lista e na folha de detalhe. */
export function useDriverQuickActions() {
  const navigate = useNavigate();

  const callOnWhatsApp = useCallback((driver: DriverRecord) => {
    if (!openWhatsApp(driver.phone)) {
      toast({ title: "Telefone inválido", description: "Cadastre o telefone do motorista com DDD.", variant: "destructive" });
    }
  }, []);

  // Abre o Inicio com o mapa focado no motorista.
  const showOnMap = useCallback(
    (driver: DriverRecord) => navigate(`/?focusDriver=${driverDbId(driver)}`),
    [navigate],
  );

  return { callOnWhatsApp, showOnMap };
}
