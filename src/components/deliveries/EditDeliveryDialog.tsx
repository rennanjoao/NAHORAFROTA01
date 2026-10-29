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
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, CheckCircle, User, Warehouse } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { DeliveryStatus } from "./types";

interface Delivery {
  id: number;
  nfe: string;
  recipient: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  driver: string | null;
  status: DeliveryStatus;
  scheduledTime: string;
  scheduledDate: Date;
  weight: string;
  value: string;
  selected?: boolean;
  observation?: string;
  // New fields for manual confirmation
  deliveredAt?: Date;
  receiverName?: string;
  receiverDocument?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: Date;
}

interface EditDeliveryDialogProps {
  delivery: Delivery | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (delivery: Delivery) => Promise<void> | void;
  currentUser?: string; // Nome do usuário logado
}

const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function EditDeliveryDialog({ 
  delivery, 
  open, 
  onOpenChange, 
  onSave,
  currentUser = "Gestor"
}: EditDeliveryDialogProps) {
  const [formData, setFormData] = useState<Partial<Delivery>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isManualConfirm, setIsManualConfirm] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverDocument, setReceiverDocument] = useState("");
  const [errors, setErrors] = useState<{ time?: string; name?: string; document?: string }>({});

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

  useEffect(() => {
    if (delivery) {
      setFormData({ ...delivery });
      setIsManualConfirm(false);
      setDeliveryTime("");
      setReceiverName("");
      setReceiverDocument("");
      setErrors({});
    }
  }, [delivery]);

  const handleMarkAsReturned = async () => {
    if (!delivery || isSaving) return;

    setIsSaving(true);

    const updatedDelivery: Delivery = {
      ...delivery,
      ...formData,
      status: "returned",
      lastUpdatedBy: currentUser,
      lastUpdatedAt: new Date(),
    } as Delivery;

    try {
      await onSave(updatedDelivery);
    } catch (error) {
      setIsSaving(false);
      toast({
        title: "Não foi possível salvar",
        description: error instanceof Error ? error.message : "Confira os dados e tente de novo.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(false);
    onOpenChange(false);

    toast({
      title: "Nota marcada como devolvida",
      description: `NF ${updatedDelivery.nfe} está como devolvida.`,
      variant: "success",
    });
  };

  const handleSave = async () => {
    if (!delivery) return;

    setIsSaving(true);

    let updatedDelivery = { ...delivery, ...formData };

    // Se confirmação manual estiver ativa
    if (isManualConfirm) {
      // Mesmas regras de antes, agora com a mensagem embaixo de cada campo.
      const nextErrors: { time?: string; name?: string; document?: string } = {};
      if (!deliveryTime) nextErrors.time = "Informe o horário da entrega.";
      if (!receiverName) nextErrors.name = "Informe quem recebeu.";
      if (!receiverDocument.trim()) nextErrors.document = "Informe o CPF de quem recebeu.";
      else if (!isValidCpf(receiverDocument)) nextErrors.document = "CPF inválido. Confira os números.";
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        setIsSaving(false);
        return;
      }

      const [hours, minutes] = deliveryTime.split(':').map(Number);
      const deliveredAt = new Date();
      deliveredAt.setHours(hours, minutes, 0, 0);

      updatedDelivery = {
        ...updatedDelivery,
        status: "delivered",
        deliveredAt,
        receiverName,
        receiverDocument: formatCpf(receiverDocument),
        lastUpdatedBy: currentUser,
        lastUpdatedAt: new Date(),
      };
    } else {
      // Atualização normal - registrar quem editou
      updatedDelivery = {
        ...updatedDelivery,
        lastUpdatedBy: currentUser,
        lastUpdatedAt: new Date(),
      };
    }

    try {
      await onSave(updatedDelivery as Delivery);
    } catch (error) {
      setIsSaving(false);
      toast({
        title: "Não foi possível salvar",
        description: error instanceof Error ? error.message : "Confira os dados e tente de novo.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(false);
    onOpenChange(false);

    toast({
      title: isManualConfirm ? "Entrega confirmada" : "Nota atualizada",
      description: isManualConfirm
        ? `NF ${formData.nfe} marcada como entregue por ${currentUser}.`
        : `NF ${formData.nfe} atualizada.`,
      variant: "success",
    });
  };

  if (!delivery) return null;

  const field = (id: keyof Delivery, label: string, props: { placeholder?: string; inputMode?: "numeric" | "decimal" | "tel"; className?: string; autoComplete?: string } = {}) => (
    <div className={cn("space-y-1.5", props.className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={(formData[id] as string) || ""}
        onChange={(e) => setFormData({ ...formData, [id]: e.target.value })}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete ?? "off"}
      />
    </div>
  );

  const errorText = (id: string, message?: string) =>
    message ? (
      <p id={id} className="text-sm font-medium text-destructive">
        {message}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar NF {delivery.nfe}</DialogTitle>
          <DialogDescription>Corrija os dados da nota ou registre uma entrega feita sem o app.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Baixa manual */}
          <div
            className={cn(
              "space-y-4 rounded-lg border p-4 transition-colors duration",
              isManualConfirm ? "border-success/40 bg-success/5" : "bg-muted/30",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <Label htmlFor="manualConfirm" className="flex items-center gap-2 font-semibold">
                  <CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />
                  Confirmar entrega manualmente
                </Label>
                <p id="manualConfirm-hint" className="text-sm text-muted-foreground">
                  Use quando o motorista entregou mas não deu baixa pelo app.
                </p>
              </div>
              <Switch
                id="manualConfirm"
                checked={isManualConfirm}
                onCheckedChange={(checked) => {
                  setIsManualConfirm(checked);
                  setErrors({});
                }}
                aria-describedby="manualConfirm-hint"
              />
            </div>

            {isManualConfirm && (
              <div className="grid gap-4 border-t border-success/20 pt-4 animate-fade-in sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="deliveryTime">Horário da entrega</Label>
                  <Input
                    id="deliveryTime"
                    type="time"
                    value={deliveryTime}
                    onChange={(e) => {
                      setDeliveryTime(e.target.value);
                      if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
                    }}
                    aria-invalid={!!errors.time || undefined}
                    aria-describedby={errors.time ? "deliveryTime-error" : undefined}
                    required
                  />
                  {errorText("deliveryTime-error", errors.time)}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="receiverDocument">CPF de quem recebeu</Label>
                  <Input
                    id="receiverDocument"
                    value={receiverDocument}
                    onChange={(e) => {
                      setReceiverDocument(formatCpf(e.target.value));
                      if (errors.document) setErrors((prev) => ({ ...prev, document: undefined }));
                    }}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                    className="font-data"
                    aria-invalid={!!errors.document || undefined}
                    aria-describedby={errors.document ? "receiverDocument-error" : undefined}
                  />
                  {errorText("receiverDocument-error", errors.document)}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="receiverName">Nome de quem recebeu</Label>
                  <Input
                    id="receiverName"
                    value={receiverName}
                    onChange={(e) => {
                      setReceiverName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="Nome completo"
                    autoComplete="off"
                    aria-invalid={!!errors.name || undefined}
                    aria-describedby={errors.name ? "receiverName-error" : undefined}
                    required
                  />
                  {errorText("receiverName-error", errors.name)}
                </div>
              </div>
            )}
          </div>

          <fieldset className="space-y-4">
            <legend className="mb-3 text-sm font-semibold text-foreground">Nota e cliente</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("nfe", "Número da NF-e", { inputMode: "numeric" })}
              {field("phone", "Telefone do cliente", { placeholder: "(00) 00000-0000", inputMode: "tel" })}
              {field("recipient", "Cliente (destinatário)", { className: "sm:col-span-2" })}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-3 text-sm font-semibold text-foreground">Endereço de entrega</legend>
            <div className="grid grid-cols-6 gap-4">
              {field("address", "Rua e número", { className: "col-span-6", placeholder: "Ex.: Rua das Flores, 120" })}
              {field("city", "Cidade", { className: "col-span-6 sm:col-span-3" })}
              <div className="col-span-2 space-y-1.5 sm:col-span-1">
                <Label htmlFor="state">UF</Label>
                <Select
                  value={formData.state || ""}
                  onValueChange={(value) => setFormData({ ...formData, state: value })}
                >
                  <SelectTrigger id="state">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {brazilianStates.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {field("zipCode", "CEP", { className: "col-span-4 sm:col-span-2", placeholder: "00000-000", inputMode: "numeric" })}
            </div>
            <p className="text-sm text-muted-foreground">Mudou o endereço? A localização no mapa é refeita na próxima rota.</p>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-3 text-sm font-semibold text-foreground">Carga</legend>
            <div className="grid grid-cols-2 gap-4">
              {field("weight", "Peso", { placeholder: "Ex.: 5,2 kg", inputMode: "decimal" })}
              {field("value", "Valor da mercadoria", { placeholder: "R$ 0,00", inputMode: "decimal" })}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="observation">Observação para o motorista</Label>
            <Textarea
              id="observation"
              value={formData.observation || ""}
              onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
              placeholder="Ex.: Entregar na portaria lateral."
              rows={3}
            />
          </div>

          {delivery.lastUpdatedBy && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              Última alteração por {delivery.lastUpdatedBy}
              {delivery.lastUpdatedAt && ` em ${new Date(delivery.lastUpdatedAt).toLocaleString("pt-BR")}`}
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleMarkAsReturned}
            disabled={isSaving}
          >
            <Warehouse aria-hidden="true" />
            Marcar como devolvida
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {isSaving ? "Salvando…" : isManualConfirm ? "Confirmar entrega" : "Salvar alterações"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
