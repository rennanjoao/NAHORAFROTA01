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
import { Label } from "@/components/ui/label";
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

interface RegisterOccurrenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryNfe: string;
  deliveryId: number;
  onSave: (deliveryId: number, occurrenceType: string, observation: string) => void;
  currentUser?: string;
}

const occurrenceTypes = [
  { value: "cliente_ausente", label: "Cliente ausente" },
  { value: "endereco_nao_encontrado", label: "Endereço não encontrado" },
  { value: "recusa_recebimento", label: "Recusa de recebimento" },
  { value: "avaria_mercadoria", label: "Avaria na mercadoria" },
  { value: "falta_mercadoria", label: "Falta de mercadoria" },
  { value: "documentacao_incorreta", label: "Documentação incorreta" },
  { value: "area_risco", label: "Área de risco" },
  { value: "horario_restrito", label: "Horário restrito" },
  { value: "veiculo_quebrado", label: "Veículo quebrado" },
  { value: "outros", label: "Outros" },
];

export function RegisterOccurrenceDialog({
  open,
  onOpenChange,
  deliveryNfe,
  deliveryId,
  onSave,
  currentUser = "Gestor",
}: RegisterOccurrenceDialogProps) {
  const [occurrenceType, setOccurrenceType] = useState("");
  const [observation, setObservation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!occurrenceType) {
      setTypeError("Escolha o que aconteceu.");
      return;
    }

    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    onSave(deliveryId, occurrenceType, observation);

    toast({
      title: "Ocorrência registrada",
      description: `NF ${deliveryNfe}, registrada por ${currentUser}.`,
    });

    setIsSaving(false);
    setOccurrenceType("");
    setObservation("");
    onOpenChange(false);
  };

  const handleClose = () => {
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
          <div className="space-y-1.5">
            <Label htmlFor="occurrenceType">O que aconteceu</Label>
            <Select
              value={occurrenceType}
              onValueChange={(value) => {
                setOccurrenceType(value);
                setTypeError(null);
              }}
            >
              <SelectTrigger
                id="occurrenceType"
                aria-invalid={!!typeError || undefined}
                aria-describedby={typeError ? "occurrenceType-error" : undefined}
                className={typeError ? "border-destructive" : undefined}
              >
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
            {typeError && (
              <p id="occurrenceType-error" className="text-sm font-medium text-destructive">
                {typeError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="occurrence-observation">Detalhes (opcional)</Label>
            <Textarea
              id="occurrence-observation"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex.: Portão fechado, ninguém atendeu o interfone."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
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
