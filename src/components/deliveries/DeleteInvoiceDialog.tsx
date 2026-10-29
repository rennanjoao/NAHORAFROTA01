import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmDialog } from "@/components/patterns";

interface DeleteInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNfe: string;
  isLinkedToManifest: boolean;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteInvoiceDialog({
  open,
  onOpenChange,
  invoiceNfe,
  isLinkedToManifest,
  onConfirm,
  isDeleting = false,
}: DeleteInvoiceDialogProps) {
  // Nota em romaneio nao pode ser apagada: explica o caminho.
  if (isLinkedToManifest) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não dá para excluir a NF {invoiceNfe} agora</AlertDialogTitle>
            <AlertDialogDescription>
              Ela está em um romaneio. Primeiro use “Remover do romaneio” no menu Ações da nota e depois exclua.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      title={`Excluir a NF ${invoiceNfe}?`}
      description="A nota e os arquivos dela (XML e PDF) serão apagados de vez. Não dá para desfazer."
      confirmLabel={isDeleting ? "Excluindo…" : "Excluir nota"}
      loading={isDeleting}
      onConfirm={onConfirm}
    />
  );
}
