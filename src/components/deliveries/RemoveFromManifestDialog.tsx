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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Unlink, AlertTriangle } from "lucide-react";
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
          <AlertDialogTitle className="flex items-center gap-2">
            <Unlink className="h-5 w-5 text-destructive" />
            Remover do Romaneio
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Você está prestes a remover a <strong>NF {deliveryNfe}</strong> do
                romaneio <strong className="font-mono">{manifestId}</strong>.
              </p>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-2 mb-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Atenção!
                </div>
                <p className="text-sm">
                  Esta ação irá desvincular a NF do romaneio atual e retornar
                  seu status para <strong>Pendente</strong>. Um registro será
                  criado no histórico.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Motivo da Remoção</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Informe o motivo da remoção (ex: Erro na atribuição, Mercadoria não localizada...)"
                  rows={2}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirmar Remoção
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
