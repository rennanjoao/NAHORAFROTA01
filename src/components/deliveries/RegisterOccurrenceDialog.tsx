import { useState } from "react";
import {
  Dialog,
  DialogContent,
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
import { AlertTriangle, Save, Loader2 } from "lucide-react";
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
  { value: "cliente_ausente", label: "Cliente Ausente" },
  { value: "endereco_nao_encontrado", label: "Endereço Não Encontrado" },
  { value: "recusa_recebimento", label: "Recusa de Recebimento" },
  { value: "avaria_mercadoria", label: "Avaria na Mercadoria" },
  { value: "falta_mercadoria", label: "Falta de Mercadoria" },
  { value: "documentacao_incorreta", label: "Documentação Incorreta" },
  { value: "area_risco", label: "Área de Risco" },
  { value: "horario_restrito", label: "Horário Restrito" },
  { value: "veiculo_quebrado", label: "Veículo Quebrado" },
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

  const handleSave = async () => {
    if (!occurrenceType) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione o tipo de ocorrência.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    onSave(deliveryId, occurrenceType, observation);

    toast({
      title: "Ocorrência Registrada",
      description: `Ocorrência registrada na NF ${deliveryNfe} por ${currentUser}.`,
    });

    setIsSaving(false);
    setOccurrenceType("");
    setObservation("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setOccurrenceType("");
    setObservation("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Registrar Ocorrência
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <span className="text-muted-foreground">Nota Fiscal: </span>
            <span className="font-mono font-semibold">{deliveryNfe}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="occurrenceType">Tipo de Ocorrência *</Label>
            <Select value={occurrenceType} onValueChange={setOccurrenceType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {occurrenceTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observation">Observação</Label>
            <Textarea
              id="observation"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Detalhes adicionais sobre a ocorrência..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-warning hover:bg-warning/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Registrar Ocorrência
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { occurrenceTypes };
