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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Pencil, Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { parseDecimalInput } from "@/lib/formatCurrency";

interface LocalAdjustment {
  id: string;
  date: Date;
  description: string;
  value: number;
  type: "credit" | "debit";
  category?: "discount" | "bonus" | "unloading" | "toll" | "fuel" | "other";
  observation?: string;
}

interface EditTransactionDialogProps {
  transaction: LocalAdjustment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (transaction: LocalAdjustment) => Promise<boolean> | boolean | void;
}

const categoryLabels: Record<string, string> = {
  discount: "Desconto",
  bonus: "Bônus",
  unloading: "Descarga",
  toll: "Pedágio",
  fuel: "Combustível",
  other: "Outros",
};

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
      setValue(Math.abs(transaction.value).toString());
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
      title: "✅ Lançamento atualizado",
      description: `${description} foi atualizado com sucesso.`,
    });
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Lançamento
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Type */}
          <div className="space-y-3">
            <Label>Tipo de Lançamento</Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as "credit" | "debit")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="credit" id="credit" />
                <Label htmlFor="credit" className="cursor-pointer text-success font-medium">
                  Crédito (+)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="debit" id="debit" />
                <Label htmlFor="debit" className="cursor-pointer text-destructive font-medium">
                  Débito (-)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Ajuste de combustível, Bônus por desempenho..."
            />
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="value">Valor (R$)</Label>
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

          {/* Observation */}
          <div className="space-y-2">
            <Label htmlFor="observation">Observação / Motivo</Label>
            <Textarea
              id="observation"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: Desconto referente a avaria na NF 12345..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
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
