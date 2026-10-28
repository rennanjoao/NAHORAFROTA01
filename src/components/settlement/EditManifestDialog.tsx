import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, Loader2, Truck, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatCurrency";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";

interface EditManifestDialogProps {
  manifest: DBManifest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (manifestId: string, newValue: number, observation: string) => void;
}

export function EditManifestDialog({ manifest, open, onOpenChange, onSave }: EditManifestDialogProps) {
  const [value, setValue] = useState("");
  const [observation, setObservation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (manifest) {
      setValue(manifest.freight_value.toString());
      setObservation(manifest.observation ?? "");
    }
  }, [manifest]);

  const handleSave = async () => {
    if (!manifest || !value) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o valor.",
        variant: "destructive",
      });
      return;
    }

    if (!observation.trim()) {
      toast({
        title: "Observação obrigatória",
        description: "Informe o motivo da alteração para registro.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const numericValue = parseFloat(value);
    onSave(manifest.id, numericValue, observation);
    
    setIsSaving(false);
    onOpenChange(false);

    toast({
      title: "✅ Romaneio atualizado",
      description: `Valor alterado para ${formatCurrency(numericValue)}`,
    });
  };

  if (!manifest) return null;

  const originalValue = manifest.freight_value;
  const newValue = parseFloat(value) || 0;
  const difference = newValue - originalValue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Romaneio
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Manifest Info */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono font-medium">{formatManifestNumber(manifest)}</span>
              {manifest.is_own_fleet && (
                <Badge variant="outline" className="border-primary text-primary gap-1 text-xs">
                  <Truck className="h-3 w-3" />
                  Casa
                </Badge>
              )}
              <Badge variant={manifest.status === "paid" ? "default" : "secondary"}>
                {manifest.status === "paid" ? "Pago" : "Pendente"}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <span>Data: {format(new Date(manifest.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
              <span className="mx-2">•</span>
              <span>{manifest.deliveries_count} entregas</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Motorista: <span className="font-medium text-foreground">{manifest.driver_name}</span>
            </div>
          </div>

          {/* Original Value */}
          <div className="flex items-center justify-between p-2 rounded bg-muted/30">
            <span className="text-sm text-muted-foreground">Valor Original:</span>
            <span className="font-mono font-medium">{formatCurrency(originalValue)}</span>
          </div>

          {/* New Value */}
          <div className="space-y-2">
            <Label htmlFor="value">Novo Valor (R$)</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
            />
          </div>

          {/* Difference */}
          {difference !== 0 && (
            <div className="flex items-center justify-between p-2 rounded bg-muted/30">
              <span className="text-sm text-muted-foreground">Diferença:</span>
              <span className={`font-mono font-medium ${difference > 0 ? "text-success" : "text-destructive"}`}>
                {difference > 0 ? "+" : ""}{formatCurrency(difference)}
              </span>
            </div>
          )}

          {/* Observation */}
          <div className="space-y-2">
            <Label htmlFor="observation">Observação / Motivo da Alteração *</Label>
            <Textarea
              id="observation"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: Ajuste de valor conforme acordo com motorista..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Informe o motivo da alteração para registro e auditoria.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !observation.trim()}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
