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
import { CheckCircle2, Loader2 } from "lucide-react";

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
      newErrors.name = "Informe quem recebeu.";
    } else if (receiverName.trim().length < 3) {
      newErrors.name = "Escreva o nome com pelo menos 3 letras.";
    }

    if (!receiverDocument.trim()) {
      newErrors.document = "Informe o CPF de quem recebeu.";
    } else if (!isValidCpf(receiverDocument)) {
      newErrors.document = "CPF inválido. Confira os números.";
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
          <DialogTitle>Confirmar entrega da NF {nfeNumber}</DialogTitle>
          <DialogDescription>
            Baixa manual para {recipientName || "o cliente"}. Informe quem recebeu a mercadoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="receiver-name">Nome de quem recebeu</Label>
            <Input
              id="receiver-name"
              placeholder="Nome completo"
              autoComplete="off"
              value={receiverName}
              onChange={(e) => {
                setReceiverName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              aria-invalid={!!errors.name || undefined}
              aria-describedby={errors.name ? "receiver-name-error" : undefined}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p id="receiver-name-error" className="text-sm font-medium text-destructive">
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receiver-document">CPF de quem recebeu</Label>
            <Input
              id="receiver-document"
              placeholder="000.000.000-00"
              value={receiverDocument}
              onChange={(e) => {
                setReceiverDocument(formatCpf(e.target.value));
                if (errors.document) setErrors((prev) => ({ ...prev, document: undefined }));
              }}
              aria-invalid={!!errors.document || undefined}
              aria-describedby={errors.document ? "receiver-document-error" : "receiver-document-hint"}
              disabled={isSubmitting}
              inputMode="numeric"
              maxLength={14}
              className="font-data"
            />
            {errors.document ? (
              <p id="receiver-document-error" className="text-sm font-medium text-destructive">
                {errors.document}
              </p>
            ) : (
              <p id="receiver-document-hint" className="text-sm text-muted-foreground">
                Só números; os pontos entram sozinhos.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
            {isSubmitting ? "Salvando…" : "Confirmar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
