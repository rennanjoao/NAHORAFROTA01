import { AlertTriangle, CircleCheck, Clock, Navigation, Package, Undo2, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/patterns";
import type { DriverDelivery } from "@/hooks/useDriverManifest";

/** Status da nota no app do motorista: texto simples + cor com significado. */
export const DELIVERY_STATUS: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  pending: { label: "Aguardando", tone: "neutral", icon: Clock },
  in_transit: { label: "Em rota", tone: "info", icon: Navigation },
  loaded: { label: "No veículo", tone: "info", icon: Package },
  delivered: { label: "Entregue", tone: "success", icon: CircleCheck },
  occurrence: { label: "Com problema", tone: "danger", icon: AlertTriangle },
  returned: { label: "Devolvida", tone: "warning", icon: Undo2 },
};

export const deliveryStatus = (status: string) => DELIVERY_STATUS[status] ?? DELIVERY_STATUS.pending;

export const isDelivered = (delivery: DriverDelivery) => delivery.status === "delivered";
export const hasProblem = (delivery: DriverDelivery) =>
  delivery.status === "occurrence" || delivery.status === "returned";
/** Entrega que ainda pede acao do motorista. */
export const isOpen = (delivery: DriverDelivery) => !isDelivered(delivery) && !hasProblem(delivery);

/** Rua e numero (ou o comeco do endereco completo). */
export function streetLine(delivery: DriverDelivery): string {
  if (delivery.address_street && delivery.address_number) {
    return `${delivery.address_street}, ${delivery.address_number}`;
  }
  return delivery.address_full?.split(",").slice(0, 2).join(",").trim() || "Endereço não informado";
}

export const formatHour = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
