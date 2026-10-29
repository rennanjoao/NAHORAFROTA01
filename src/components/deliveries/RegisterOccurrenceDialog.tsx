import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FormField } from "@/components/patterns";
import { OCCURRENCE_TYPES } from "./status";

interface RegisterOccurrenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryNfe: string;
  deliveryId: number;
  /** Devolve false quando nao gravou (a janela fica aberta para tentar de novo). */
  onSave: (deliveryId: number, occurrenceType: string, observation: string) => Promise<boolean> | boolean | void;
}

const occurrenceTypes = OCCURRENCE_TYPES;

export function RegisterOccurrenceDialog({
  open,
  onOpenChange,
  deliveryNfe,
  deliveryId,
  onSave,
}: RegisterOccurrenceDialogProps) {
  const [occurrenceType, setOccurrenceType] = useState("");
  const [observation, setObservation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!occurrenceType) {
      setTypeError("Escolha o que aconteceu.");
      document.getElementById("occurrenceType")?.focus();
      return;
    }

    // So avisa sucesso e fecha depois que o banco confirmou (antes fechava mesmo com erro).
    setIsSaving(true);
    try {
      const saved = await onSave(deliveryId, occurrenceType, observation.trim());
      if (saved === false) {
        toast({
          title: "Não foi possível registrar a ocorrência",
          description: "Confira a internet e tente de novo.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Ocorrência registrada",
        description: `A NF ${deliveryNfe} ficou marcada como ocorrência.`,
        variant: "success",
      });
      setOccurrenceType("");
      setObservation("");
      setTypeError(null);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setOccurrenceType("");
    setObservation("");
    setTypeError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar ocorrência na NF {deliveryNfe}</DialogTitle>
          <DialogDescription>Conte o que impediu a entrega. A nota fica marcada como ocorrência.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField id="occurrenceType" label="O que aconteceu" required error={typeError}>
            {(field) => (
              <Select
                value={occurrenceType}
                onValueChange={(value) => {
                  setOccurrenceType(value);
                  setTypeError(null);
                }}
              >
                <SelectTrigger {...field} className={typeError ? "border-destructive" : undefined}>
                  <SelectValue placeholder="Escolher o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {occurrenceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            id="occurrence-observation"
            label="Detalhes"
            optional
            hint="O texto fica salvo na observação da nota."
          >
            {(field) => (
              <Textarea
                {...field}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex.: Portão fechado, ninguém atendeu o interfone."
                rows={3}
                className="resize-none"
              />
            )}
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
            {isSaving ? "Salvando…" : "Registrar ocorrência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { occurrenceTypes };
