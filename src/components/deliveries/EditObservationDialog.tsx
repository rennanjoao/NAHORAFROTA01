import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
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
  onSave: (deliveryId: number, observation: string) => void;
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

  // iOS Fix: Bloquear scroll do body quando dialog abre
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      document.body.classList.add('dialog-open');
      document.body.style.top = `-${scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.classList.remove('dialog-open');
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    return () => {
      document.body.classList.remove('dialog-open');
      document.body.style.top = '';
    };
  }, [open]);

  const handleSave = () => {
    onSave(deliveryId, observation);
    toast({
      title: "✅ Observação salva",
      description: `Observação atualizada para ${deliveryNfe}.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Editar Observação
          </DialogTitle>
          <DialogDescription>
            Adicione ou edite observações para a entrega {deliveryNfe}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="observation">Observação</Label>
            <Textarea
              id="observation"
              placeholder="Ex: Cliente pediu para entregar no vizinho, agendar para período da manhã..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Essas informações ficarão visíveis para o motorista.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} style={{ fontSize: '16px' }}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} style={{ fontSize: '16px' }}>
            Salvar Observação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
