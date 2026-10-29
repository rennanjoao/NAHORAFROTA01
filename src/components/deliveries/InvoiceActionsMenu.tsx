import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Unlink,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionMenu, type ActionMenuItem } from "@/components/patterns";
import type { Delivery, InvoiceActionHandlers } from "./types";

// Regras de quais acoes valem para cada nota (iguais as de antes).
export const canRemoveFromManifest = (delivery: Delivery) =>
  !!delivery.manifestId && !["delivered", "returned"].includes(delivery.status);

// Com ou sem romaneio: uma nota com ocorrencia ainda fora de romaneio tambem precisa
// voltar para a fila (antes ela ficava presa, so dava para excluir).
export const canReRoute = (delivery: Delivery) => ["occurrence", "returning", "returned"].includes(delivery.status);

interface InvoiceActionsMenuProps {
  delivery: Delivery;
  actions: InvoiceActionHandlers;
}

/**
 * Menu "Acoes" de uma nota fiscal: so mostra o que faz sentido no status atual.
 * Usa o ActionMenu: a janela so abre depois que o menu devolve o foco ao botao,
 * entao ao fechar a janela o foco volta para o "..." da mesma nota.
 */
export function InvoiceActionsMenu({ delivery, actions }: InvoiceActionsMenuProps) {
  const canAddToManifest = delivery.status === "pending" && !delivery.manifestId;
  const canRegisterOccurrence = delivery.status === "pending" || delivery.status === "in_transit";
  const canConfirmDelivery = delivery.status === "in_transit" && !!delivery.dbId;
  const canConfirmReturn = delivery.status === "returning";
  const canRemove = canRemoveFromManifest(delivery);
  const canSendBack = canReRoute(delivery);

  const items: ActionMenuItem[] = [
    { label: "Ver detalhes", icon: FileText, onSelect: () => actions.onDetail(delivery) },
    { label: "Editar dados da nota", icon: Pencil, onSelect: () => actions.onEdit(delivery) },
    { label: "Editar observação", icon: MessageSquare, onSelect: () => actions.onObservation(delivery) },
  ];
  const operations: ActionMenuItem[] = [];
  if (canAddToManifest) operations.push({ label: "Adicionar a romaneio existente", icon: Plus, onSelect: () => actions.onAddToManifest(delivery) });
  if (canRegisterOccurrence) operations.push({ label: "Registrar ocorrência", icon: AlertTriangle, onSelect: () => actions.onOccurrence(delivery) });
  if (canConfirmDelivery) operations.push({ label: "Confirmar entrega", icon: CheckCircle2, onSelect: () => actions.onConfirmDelivery(delivery) });
  if (canConfirmReturn) operations.push({ label: "Confirmar retorno ao galpão", icon: Warehouse, onSelect: () => actions.onConfirmReturn(delivery) });
  if (canRemove) operations.push({ label: "Remover do romaneio", icon: Unlink, onSelect: () => actions.onRemoveFromManifest(delivery) });
  if (canSendBack) operations.push({ label: "Voltar para a fila de romaneio", icon: RefreshCw, onSelect: () => actions.onReRoute(delivery) });
  if (operations.length > 0) operations[0].separatorBefore = true;
  items.push(...operations);
  if (delivery.dbId) {
    items.push({ label: "Excluir nota", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => actions.onDelete(delivery) });
  }

  return (
    <ActionMenu
      title={`NF ${delivery.nfe}`}
      className="w-64"
      items={items}
      trigger={
        <Button variant="ghost" size="icon" aria-label={`Ações da NF ${delivery.nfe}`} className="text-muted-foreground hover:text-foreground">
          <MoreHorizontal aria-hidden="true" />
        </Button>
      }
    />
  );
}
