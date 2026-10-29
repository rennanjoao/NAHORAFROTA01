import {
  AlertTriangle,
  Ban,
  CarFront,
  Clock,
  MapPinX,
  MessageSquareText,
  PackageX,
  PackageSearch,
  ShieldAlert,
  UserX,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/components/patterns";

export interface OccurrenceOption {
  /** Valor gravado no banco (nao mudar). */
  value: string;
  label: string;
  /** Frase curta embaixo do nome, no bloco de opcao. */
  hint?: string;
  icon: LucideIcon;
  tone: Tone;
}

/** Ocorrencias do motorista (aba Reportar): nao ligadas a uma entrega. */
export const DRIVER_OCCURRENCE_TYPES: OccurrenceOption[] = [
  { value: "accident", label: "Acidente", hint: "Batida ou alguém se machucou", icon: CarFront, tone: "danger" },
  { value: "delay", label: "Atraso", hint: "Trânsito, fila ou espera", icon: Clock, tone: "warning" },
  { value: "mechanical", label: "Problema no veículo", hint: "Pneu, motor, freio", icon: Wrench, tone: "warning" },
  { value: "other", label: "Outro", hint: "Qualquer outro problema", icon: MessageSquareText, tone: "info" },
];

export const driverOccurrenceType = (value: string) =>
  DRIVER_OCCURRENCE_TYPES.find((option) => option.value === value) ??
  DRIVER_OCCURRENCE_TYPES[DRIVER_OCCURRENCE_TYPES.length - 1];

/** Problemas numa entrega (cartao da entrega > Reportar problema). */
export const DELIVERY_OCCURRENCE_TYPES: OccurrenceOption[] = [
  { value: "cliente_ausente", label: "Cliente ausente", icon: UserX, tone: "warning" },
  { value: "recusado", label: "Cliente recusou", icon: Ban, tone: "danger" },
  { value: "endereco_errado", label: "Endereço não encontrado", icon: MapPinX, tone: "warning" },
  { value: "area_risco", label: "Área de risco", icon: ShieldAlert, tone: "danger" },
  { value: "horario_restrito", label: "Fora do horário", icon: Clock, tone: "warning" },
  { value: "avaria", label: "Mercadoria avariada", icon: PackageX, tone: "danger" },
  { value: "extravio", label: "Mercadoria extraviada", icon: PackageSearch, tone: "danger" },
  { value: "outros", label: "Outro motivo", icon: AlertTriangle, tone: "neutral" },
];
