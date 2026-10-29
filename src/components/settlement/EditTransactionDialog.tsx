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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Minus, Plus, Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { parseDecimalInput } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { categoryLabels, type LocalAdjustment } from "./settlementConfig";

interface EditTransactionDialogProps {
  transaction: LocalAdjustment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (transaction: LocalAdjustment) => Promise<boolean> | boolean | void;
}

export function EditTransactionDialog({ transaction, open, onOpenChange, onSave }: EditTransactionDialogProps) {
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState<"credit" | "debit">("debit");
  const [category, setCategory] = useState<string>("other");
  const [observation, setObservation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description);
      setValue(String(Math.abs(transaction.value)).replace(".", ","));
      setType(transaction.type);
      setCategory(transaction.category || "other");
      setObservation(transaction.observation || "");
    }
  }, [transaction]);

  const handleSave = async () => {
    if (!transaction || !description || !value) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a descrição e o valor.",
        variant: "destructive",
      });
      return;
    }

    const numericValue = parseDecimalInput(value);
    if (numericValue === null || numericValue === 0) {
      toast({ title: "Valor inválido", description: "Informe um valor maior que zero.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const updatedTransaction: LocalAdjustment = {
      ...transaction,
      description,
      value: type === "credit" ? Math.abs(numericValue) : -Math.abs(numericValue),
      type,
      category: category as LocalAdjustment["category"],
      observation,
    };

    const saved = await onSave(updatedTransaction);
    setIsSaving(false);
    if (saved === false) return;
    onOpenChange(false);

    toast({
      title: "Lançamento atualizado",
      description: `${description} foi atualizado.`,
    });
  };

  if (!transaction) return null;

  const typeOptions = [
    { value: "debit", id: "tx-debit", label: "Débito", hint: "Desconta do motorista", icon: Minus, tone: "text-destructive" },
    { value: "credit", id: "tx-credit", label: "Crédito", hint: "Soma para o motorista", icon: Plus, tone: "text-success" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>Corrija o tipo, a categoria, a descrição ou o valor.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Tipo</legend>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as "credit" | "debit")}
              className="grid grid-cols-2 gap-3"
            >
              {typeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <Label
                    key={option.value}
                    htmlFor={option.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-fast hover:bg-accent",
                      type === option.value && "border-primary/50 bg-primary/5",
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
            <Label htmlFor="tx-category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="tx-category">
                <SelectValue placeholder="Escolha a categoria" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-description">Descrição</Label>
            <Input
              id="tx-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: ajuste de combustível, bônus por desempenho"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-value">Valor (R$)</Label>
            <Input
              id="tx-value"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              className="font-data"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-observation">
              Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="tx-observation"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: desconto pela avaria na NF 12345"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {isSaving ? "Salvando" : "Salvar lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
