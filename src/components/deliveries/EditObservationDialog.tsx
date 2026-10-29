import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface EditObservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: number;
  deliveryNfe: string;
  currentObservation?: string;
  onSave: (deliveryId: number, observation: string) => Promise<boolean> | boolean | void;
}

export function EditObservationDialog({
  open,
  onOpenChange,
  deliveryId,
  deliveryNfe,
  currentObservation = "",
  onSave,
}: EditObservationDialogProps) {
  const [observation, setObservation] = useState(currentObservation);
  const [isSaving, setIsSaving] = useState(false);

  // Recarrega o texto ao abrir para outra NF.
  useEffect(() => {
    if (open) setObservation(currentObservation);
  }, [open, currentObservation, deliveryId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await onSave(deliveryId, observation);
      if (result === false) {
        toast({
          title: "Não foi possível salvar a observação",
          description: "Confira a internet e tente de novo.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Observação salva",
        description: `NF ${deliveryNfe} atualizada.`,
        variant: "success",
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Observação da NF {deliveryNfe}</DialogTitle>
          <DialogDescription>O motorista vê este recado no app, junto com a entrega.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="observation-text">Observação</Label>
          <Textarea
            id="observation-text"
            placeholder="Ex.: Entregar na portaria lateral. Cliente pediu entrega de manhã."
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={4}
            className="resize-none text-base sm:text-sm"
            aria-describedby="observation-hint"
          />
          <p id="observation-hint" className="text-sm text-muted-foreground">
            Deixe em branco para apagar a observação.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isSaving ? "Salvando…" : "Salvar observação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
