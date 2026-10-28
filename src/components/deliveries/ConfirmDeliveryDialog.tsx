import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, User, CreditCard } from "lucide-react";

interface ConfirmDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nfeNumber: string;
  recipientName: string;
  onConfirm: (receiverName: string, receiverDocument: string) => Promise<void>;
}

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const isValidCpf = (value: string) => {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;

  return digit === Number(cpf[10]);
};

export function ConfirmDeliveryDialog({
  open,
  onOpenChange,
  nfeNumber,
  recipientName,
  onConfirm,
}: ConfirmDeliveryDialogProps) {
  const [receiverName, setReceiverName] = useState("");
  const [receiverDocument, setReceiverDocument] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; document?: string }>({});

  const validateForm = () => {
    const newErrors: { name?: string; document?: string } = {};

    if (!receiverName.trim()) {
      newErrors.name = "Nome do recebedor é obrigatório";
    } else if (receiverName.trim().length < 3) {
      newErrors.name = "Nome deve ter pelo menos 3 caracteres";
    }

    if (!receiverDocument.trim()) {
      newErrors.document = "CPF é obrigatório";
    } else if (!isValidCpf(receiverDocument)) {
      newErrors.document = "CPF inválido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(receiverName.trim(), formatCpf(receiverDocument));
      setReceiverName("");
      setReceiverDocument("");
      setErrors({});
      onOpenChange(false);
    } catch (error) {
      console.error("Error confirming delivery:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReceiverName("");
      setReceiverDocument("");
      setErrors({});
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Confirmar Entrega
          </DialogTitle>
          <DialogDescription>
            Confirmar baixa manual da NF <span className="font-mono font-semibold">{nfeNumber}</span>
            <br />
            <span className="text-xs">Destinatario: {recipientName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="receiver-name" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Nome do Recebedor *
            </Label>
            <Input
              id="receiver-name"
              placeholder="Nome completo de quem recebeu"
              value={receiverName}
              onChange={(e) => {
                setReceiverName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={errors.name ? "border-destructive" : ""}
              disabled={isSubmitting}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiver-document" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              CPF do Recebedor *
            </Label>
            <Input
              id="receiver-document"
              placeholder="000.000.000-00"
              value={receiverDocument}
              onChange={(e) => {
                setReceiverDocument(formatCpf(e.target.value));
                if (errors.document) setErrors((prev) => ({ ...prev, document: undefined }));
              }}
              className={errors.document ? "border-destructive" : ""}
              disabled={isSubmitting}
              inputMode="numeric"
              maxLength={14}
            />
            {errors.document && <p className="text-xs text-destructive">{errors.document}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2 bg-success hover:bg-success/90 text-success-foreground"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Entrega
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
