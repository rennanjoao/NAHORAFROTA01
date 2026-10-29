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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Unlink } from "lucide-react";
import { useState } from "react";

interface RemoveFromManifestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryNfe: string;
  manifestId?: string;
  onConfirm: (reason: string) => void;
}

export function RemoveFromManifestDialog({
  open,
  onOpenChange,
  deliveryNfe,
  manifestId,
  onConfirm,
}: RemoveFromManifestDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason || "Remoção manual do romaneio");
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tirar a NF {deliveryNfe} do romaneio?</AlertDialogTitle>
          <AlertDialogDescription>
            A nota sai do romaneio {manifestId} e volta para pendente. O motorista deixa de ver esta entrega no app e
            a mudança fica no histórico.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="remove-reason">Motivo (opcional)</Label>
          <Textarea
            id="remove-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: Não coube no veículo, mercadoria não localizada."
            rows={2}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className={buttonVariants({ variant: "destructive" })}>
            <Unlink aria-hidden="true" />
            Remover do romaneio
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
