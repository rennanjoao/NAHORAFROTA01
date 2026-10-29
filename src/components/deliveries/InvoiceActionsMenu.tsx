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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/** Menu "Acoes" de uma nota fiscal: so mostra o que faz sentido no status atual. */
export function InvoiceActionsMenu({ delivery, actions }: InvoiceActionsMenuProps) {
  const canAddToManifest = delivery.status === "pending" && !delivery.manifestId;
  const canRegisterOccurrence = delivery.status === "pending" || delivery.status === "in_transit";
  const canConfirmDelivery = delivery.status === "in_transit" && !!delivery.dbId;
  const canConfirmReturn = delivery.status === "returning";
  const canRemove = canRemoveFromManifest(delivery);
  const canSendBack = canReRoute(delivery);
  const hasOperation = canAddToManifest || canRegisterOccurrence || canConfirmDelivery || canConfirmReturn || canRemove || canSendBack;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Ações da NF ${delivery.nfe}`} className="text-muted-foreground hover:text-foreground">
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>NF {delivery.nfe}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => actions.onDetail(delivery)}>
          <FileText className="text-muted-foreground" aria-hidden="true" />
          Ver detalhes
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.onEdit(delivery)}>
          <Pencil className="text-muted-foreground" aria-hidden="true" />
          Editar dados da nota
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.onObservation(delivery)}>
          <MessageSquare className="text-muted-foreground" aria-hidden="true" />
          Editar observação
        </DropdownMenuItem>

        {hasOperation && <DropdownMenuSeparator />}

        {canAddToManifest && (
          <DropdownMenuItem onSelect={() => actions.onAddToManifest(delivery)}>
            <Plus className="text-primary" aria-hidden="true" />
            Adicionar a romaneio existente
          </DropdownMenuItem>
        )}
        {canRegisterOccurrence && (
          <DropdownMenuItem onSelect={() => actions.onOccurrence(delivery)}>
            <AlertTriangle className="text-warning" aria-hidden="true" />
            Registrar ocorrência
          </DropdownMenuItem>
        )}
        {canConfirmDelivery && (
          <DropdownMenuItem onSelect={() => actions.onConfirmDelivery(delivery)}>
            <CheckCircle2 className="text-success" aria-hidden="true" />
            Confirmar entrega
          </DropdownMenuItem>
        )}
        {canConfirmReturn && (
          <DropdownMenuItem onSelect={() => actions.onConfirmReturn(delivery)}>
            <Warehouse className="text-warning" aria-hidden="true" />
            Confirmar retorno ao galpão
          </DropdownMenuItem>
        )}
        {canRemove && (
          <DropdownMenuItem onSelect={() => actions.onRemoveFromManifest(delivery)}>
            <Unlink className="text-destructive" aria-hidden="true" />
            Remover do romaneio
          </DropdownMenuItem>
        )}
        {canSendBack && (
          <DropdownMenuItem onSelect={() => actions.onReRoute(delivery)}>
            <RefreshCw className="text-primary" aria-hidden="true" />
            Voltar para a fila de romaneio
          </DropdownMenuItem>
        )}

        {delivery.dbId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => actions.onDelete(delivery)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 aria-hidden="true" />
              Excluir nota
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
