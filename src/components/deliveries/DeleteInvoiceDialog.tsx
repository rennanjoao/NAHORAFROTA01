import { useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

interface DangerConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  /** Onde o foco fica depois de excluir (a linha ou a barra que abriu somem). */
  focusFallback?: () => HTMLElement | null;
}

/**
 * Confirmacao de exclusao (mesmo visual do ConfirmDialog "danger"). Se o botao que
 * abriu sumiu junto com a nota, o foco vai para o resumo da lista, nao para o topo.
 */
export function DangerConfirm({ open, onOpenChange, title, description, confirmLabel, loading, onConfirm, focusFallback }: DangerConfirmProps) {
  const openerRef = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onOpenAutoFocus={() => {
          const active = document.activeElement;
          openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
        }}
        onCloseAutoFocus={(event) => {
          if (openerRef.current?.isConnected) return;
          const target = focusFallback?.();
          if (target) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            className={buttonVariants({ variant: "destructive" })}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNfe: string;
  isLinkedToManifest: boolean;
  onConfirm: () => void;
  isDeleting?: boolean;
  focusFallback?: () => HTMLElement | null;
}

export function DeleteInvoiceDialog({
  open,
  onOpenChange,
  invoiceNfe,
  isLinkedToManifest,
  onConfirm,
  isDeleting = false,
  focusFallback,
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
    <DangerConfirm
      open={open}
      onOpenChange={onOpenChange}
      title={`Excluir a NF ${invoiceNfe}?`}
      description="A nota e os arquivos dela (XML e PDF) serão apagados de vez. Não dá para desfazer."
      confirmLabel={isDeleting ? "Excluindo…" : "Excluir nota"}
      loading={isDeleting}
      onConfirm={onConfirm}
      focusFallback={focusFallback}
    />
  );
}
