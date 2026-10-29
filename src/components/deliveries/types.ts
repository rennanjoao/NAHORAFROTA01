/** Tipos compartilhados da tela de Entregas (notas fiscais e romaneios). */

export type DeliveryStatus =
  | "pending"
  | "in_transit"
  | "delivered"
  | "delayed"
  | "occurrence"
  | "returning"
  | "returned";

/** Nota fiscal no formato usado pela lista (vem de useInvoicesDB). */
export interface Delivery {
  id: number;
  nfe: string;
  recipient: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  driver: string | null;
  status: DeliveryStatus;
  scheduledTime: string;
  scheduledDate: Date;
  weight: string;
  value: string;
  selected?: boolean;
  observation?: string;
  manifestId?: string; // Numero do romaneio ("1/2026") quando ja esta em um
  occurrenceType?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: Date;
  receivedBy?: string;
  receivedAt?: Date;
  receiverDocument?: string;
  eventDate?: Date; // Entrega/ocorrencia finalizada ou importacao
  dbId?: string; // UUID da NF no banco
  manifestUuid?: string; // UUID do romaneio
  addressStreet?: string; // Logradouro sem numero (edicao)
  addressNumber?: string;
  regiao_logistica?: string;
}

/** Periodo rapido da lista de notas. */
export type TimeFilter = "daily" | "weekly" | "monthly";

/** Acoes de uma nota (menu "Acoes" da tabela e dos cartoes). */
export interface InvoiceActionHandlers {
  onEdit: (delivery: Delivery) => void;
  onDetail: (delivery: Delivery) => void;
  onObservation: (delivery: Delivery) => void;
  onAddToManifest: (delivery: Delivery) => void;
  onOccurrence: (delivery: Delivery) => void;
  onConfirmDelivery: (delivery: Delivery) => void;
  onConfirmReturn: (delivery: Delivery) => void;
  onRemoveFromManifest: (delivery: Delivery) => void;
  onReRoute: (delivery: Delivery) => void;
  onDelete: (delivery: Delivery) => void;
}
