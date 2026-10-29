import type { ReactNode } from "react";
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
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Diga o que vai acontecer e se da para desfazer. */
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" para excluir/cancelar (botao vermelho). */
  tone?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
  /** "lg": botoes de 48px (app do motorista, toque com luva). */
  size?: "default" | "lg";
}

/** Confirmacao padrao antes de acoes que nao tem volta. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "default",
  loading,
  onConfirm,
  children,
  size = "default",
}: ConfirmDialogProps) {
  const large = size === "lg";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} className={cn(large && "h-12 text-[0.9375rem]")}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            className={cn(tone === "danger" && buttonVariants({ variant: "destructive" }), large && "h-12 text-[0.9375rem]")}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
