import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Truck, FileText } from "lucide-react";
import { FormField, StatusBadge } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatCurrencyValue, parseDecimalInput } from "@/lib/formatCurrency";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";
import { manifestStatusInfo } from "./settlementConfig";

interface EditManifestDialogProps {
  manifest: DBManifest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (manifestId: string, newValue: number, observation: string) => Promise<boolean> | boolean | void;
}

export function EditManifestDialog({ manifest, open, onOpenChange, onSave }: EditManifestDialogProps) {
  const [value, setValue] = useState("");
  const [observation, setObservation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ value?: string; observation?: string }>({});

  // Reabrir a janela descarta o que foi digitado e nao salvo.
  useEffect(() => {
    if (manifest && open) {
      setValue(formatCurrencyValue(manifest.freight_value || 0));
      setObservation(manifest.observation ?? "");
      setErrors({});
    }
  }, [manifest, open]);

  const handleSave = async () => {
    if (!manifest) return;
    const numericValue = parseDecimalInput(value);
    const found: typeof errors = {};
    if (!value.trim()) found.value = "Informe o novo valor.";
    else if (numericValue === null || numericValue < 0) found.value = "Valor inválido. Use números, como 150,00.";
    if (!observation.trim()) found.observation = "Informe o motivo da alteração.";
    if (found.value || found.observation || numericValue === null) {
      setErrors(found);
      document.getElementById(found.value ? "manifest-value" : "manifest-observation")?.focus();
      return;
    }

    setIsSaving(true);
    const saved = await onSave(manifest.id, numericValue, observation);
    setIsSaving(false);
    if (saved === false) return;
    onOpenChange(false);

    toast({
      title: "Romaneio atualizado",
      description: `Valor alterado para ${formatCurrency(numericValue)}.`,
    });
  };

  if (!manifest) return null;

  const originalValue = manifest.freight_value;
  const newValue = parseDecimalInput(value) ?? 0;
  const difference = newValue - originalValue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar valor do romaneio</DialogTitle>
          <DialogDescription>O motivo fica registrado para consulta depois.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          {/* Dados do romaneio */}
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="font-data font-semibold">{formatManifestNumber(manifest)}</span>
              {manifest.is_own_fleet && (
                <Badge variant="default">
                  <Truck aria-hidden="true" />
                  Frota própria
                </Badge>
              )}
              {/* Mesmo rotulo da tabela de romaneios ("Em rota", "A pagar", "Pago"). */}
              <StatusBadge tone={manifestStatusInfo[manifest.status]?.tone ?? "neutral"}>
                {manifestStatusInfo[manifest.status]?.label ?? manifest.status}
              </StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(manifest.created_at), "dd/MM/yyyy", { locale: ptBR })} · {manifest.deliveries_count} entrega
              {manifest.deliveries_count === 1 ? "" : "s"} · <span className="font-medium text-foreground">{manifest.driver_name}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Valor atual</p>
              <p className="font-data font-semibold">{formatCurrency(originalValue)}</p>
            </div>
            <div className="rounded-lg border p-3" aria-live="polite">
              <p className="text-xs text-muted-foreground">Diferença</p>
              <p
                className={cn(
                  "font-data font-semibold",
                  difference > 0 ? "text-success" : difference < 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {difference > 0 ? "+" : ""}
                {formatCurrency(difference)}
              </p>
            </div>
          </div>

          <FormField id="manifest-value" label="Novo valor (R$)" required error={errors.value}>
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setErrors((prev) => ({ ...prev, value: undefined }));
                }}
                placeholder="0,00"
                className="font-data"
              />
            )}
          </FormField>

          <FormField
            id="manifest-observation"
            label="Motivo da alteração"
            required
            error={errors.observation}
            hint="Ajuda a entender a mudança numa conferência futura."
          >
            {(control) => (
              <Textarea
                {...control}
                value={observation}
                onChange={(e) => {
                  setObservation(e.target.value);
                  setErrors((prev) => ({ ...prev, observation: undefined }));
                }}
                placeholder="Ex.: valor ajustado conforme acordo com o motorista"
                rows={3}
              />
            )}
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {isSaving ? "Salvando..." : "Salvar valor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
