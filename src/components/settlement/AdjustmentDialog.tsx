import { useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { categoryLabels, type AdjustmentCategory } from "./settlementConfig";

export interface AdjustmentFormValues {
  type: "credit" | "debit";
  category: AdjustmentCategory;
  description: string;
  value: string;
  observation: string;
}

interface AdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverName?: string;
  saving: boolean;
  /** Devolve true quando salvou (o formulario e limpo). */
  onSubmit: (values: AdjustmentFormValues) => Promise<boolean>;
}

const EMPTY: AdjustmentFormValues = { type: "debit", category: "other", description: "", value: "", observation: "" };

const TYPE_OPTIONS = [
  { value: "debit", id: "adj-debit", label: "Débito", hint: "Desconta do motorista", icon: Minus, tone: "text-destructive" },
  { value: "credit", id: "adj-credit", label: "Crédito", hint: "Soma para o motorista", icon: Plus, tone: "text-success" },
] as const;

/** Novo credito ou debito no extrato do motorista. */
export function AdjustmentDialog({ open, onOpenChange, driverName, saving, onSubmit }: AdjustmentDialogProps) {
  const [values, setValues] = useState<AdjustmentFormValues>(EMPTY);
  const set = <K extends keyof AdjustmentFormValues>(key: K, value: AdjustmentFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  // Ao fechar sem salvar, o que foi digitado fica; ao salvar, limpa.
  const handleSubmit = async () => {
    const saved = await onSubmit(values);
    if (saved) setValues(EMPTY);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar lançamento</DialogTitle>
          <DialogDescription>
            Um crédito ou débito no extrato{driverName ? ` de ${driverName}` : " do motorista"}. Ele entra no saldo a pagar.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Tipo</legend>
            <RadioGroup
              value={values.type}
              onValueChange={(v) => set("type", v as "credit" | "debit")}
              className="grid grid-cols-2 gap-3"
            >
              {TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <Label
                    key={option.value}
                    htmlFor={option.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-fast hover:bg-accent",
                      values.type === option.value && "border-primary/50 bg-primary/5",
                    )}
                  >
                    <RadioGroupItem value={option.value} id={option.id} className="mt-0.5" />
                    <span className="space-y-0.5">
                      <span className={cn("flex items-center gap-1 font-semibold", option.tone)}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {option.label}
                      </span>
                      <span className="block text-xs font-normal text-muted-foreground">{option.hint}</span>
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="adj-category">Categoria</Label>
            <Select value={values.category} onValueChange={(v) => set("category", v as AdjustmentCategory)}>
              <SelectTrigger id="adj-category">
                <SelectValue placeholder="Escolha a categoria" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-description">Descrição</Label>
            <Input
              id="adj-description"
              placeholder="Ex: Vale combustível, avaria na NF 12345"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-value">Valor (R$)</Label>
            <Input
              id="adj-value"
              inputMode="decimal"
              placeholder="0,00"
              value={values.value}
              onChange={(e) => set("value", e.target.value)}
              className="font-data"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-observation">
              Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="adj-observation"
              placeholder="Ex: desconto pela avaria na NF 12345, mercadoria danificada no transporte"
              value={values.observation}
              onChange={(e) => set("observation", e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {saving ? "Salvando" : "Adicionar lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
