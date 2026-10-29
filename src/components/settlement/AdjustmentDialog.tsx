import { useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/patterns";
import { parseDecimalInput } from "@/lib/formatCurrency";
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

type FieldErrors = Partial<Record<"description" | "value", string>>;

/** Descricao e valor obrigatorios; valor maior que zero. Usado tambem na edicao. */
export function validateAdjustment(description: string, value: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!description.trim()) errors.description = "Informe a descrição.";
  const parsed = parseDecimalInput(value);
  if (!value.trim()) errors.value = "Informe o valor.";
  else if (parsed === null || parsed === 0) errors.value = "Informe um valor maior que zero, como 35,50.";
  return errors;
}

/** Novo credito ou debito no extrato do motorista. */
export function AdjustmentDialog({ open, onOpenChange, driverName, saving, onSubmit }: AdjustmentDialogProps) {
  const [values, setValues] = useState<AdjustmentFormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = <K extends keyof AdjustmentFormValues>(key: K, value: AdjustmentFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // Ao fechar sem salvar, o que foi digitado fica; ao salvar, limpa.
  const handleSubmit = async () => {
    const found = validateAdjustment(values.description, values.value);
    if (found.description || found.value) {
      setErrors(found);
      document.getElementById(found.description ? "adj-description" : "adj-value")?.focus();
      return;
    }
    const saved = await onSubmit(values);
    if (saved) {
      setValues(EMPTY);
      setErrors({});
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setErrors({});
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar lançamento</DialogTitle>
          <DialogDescription>
            Um crédito ou débito no extrato{driverName ? ` de ${driverName}` : " do motorista"}. Ele entra no saldo a pagar.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          noValidate
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

          <FormField id="adj-category" label="Categoria">
            {(control) => (
              <Select value={values.category} onValueChange={(v) => set("category", v as AdjustmentCategory)}>
                <SelectTrigger {...control}>
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
            )}
          </FormField>

          <FormField id="adj-description" label="Descrição" required error={errors.description}>
            {(control) => (
              <Input
                {...control}
                placeholder="Ex.: Vale combustível, avaria na NF 12345"
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
              />
            )}
          </FormField>

          <FormField id="adj-value" label="Valor (R$)" required error={errors.value}>
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                placeholder="0,00"
                value={values.value}
                onChange={(e) => set("value", e.target.value)}
                className="font-data"
              />
            )}
          </FormField>

          <FormField id="adj-observation" label="Motivo" optional>
            {(control) => (
              <Textarea
                {...control}
                placeholder="Ex.: desconto pela avaria na NF 12345, mercadoria danificada no transporte"
                value={values.observation}
                onChange={(e) => set("observation", e.target.value)}
                rows={2}
              />
            )}
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {saving ? "Salvando..." : "Adicionar lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
