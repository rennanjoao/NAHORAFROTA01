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
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Save, Loader2, CheckCircle, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
  status: "pending" | "in_transit" | "delivered" | "delayed" | "occurrence" | "returning" | "returned";
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
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível atualizar a entrega.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(false);
    onOpenChange(false);

    toast({
      title: "Entrega marcada como devolvida",
      description: `NF ${updatedDelivery.nfe} movida para devolvido.`,
    });
  };

  const handleSave = async () => {
    if (!delivery) return;

    setIsSaving(true);

    let updatedDelivery = { ...delivery, ...formData };

    // Se confirmação manual estiver ativa
    if (isManualConfirm) {
      if (!deliveryTime || !receiverName) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha o horário e nome do recebedor.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      if (!receiverDocument.trim()) {
        toast({
          title: "CPF obrigatório",
          description: "Informe o CPF do recebedor para confirmar a entrega.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      if (!isValidCpf(receiverDocument)) {
        toast({
          title: "CPF inválido",
          description: "Digite um CPF válido no formato 000.000.000-00.",
          variant: "destructive",
        });
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
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível atualizar a entrega.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(false);
    onOpenChange(false);

    toast({
      title: isManualConfirm ? "Entrega confirmada manualmente" : "Entrega atualizada",
      description: isManualConfirm 
        ? `NF ${formData.nfe} marcada como entregue por ${currentUser}.`
        : `NF ${formData.nfe} foi atualizada com sucesso.`,
    });
  };

  if (!delivery) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Entrega
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Manual Confirmation Section */}
          <div className="p-4 rounded-lg bg-success/5 border border-success/20">
            <div className="flex items-center gap-3 mb-3">
              <Checkbox
                id="manualConfirm"
                checked={isManualConfirm}
                onCheckedChange={(checked) => setIsManualConfirm(checked === true)}
              />
              <Label htmlFor="manualConfirm" className="flex items-center gap-2 cursor-pointer font-medium">
                <CheckCircle className="h-4 w-4 text-success" />
                Confirmar entrega manualmente
              </Label>
            </div>

            {isManualConfirm && (
              <div className="space-y-3 pt-2 border-t border-success/20">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="deliveryTime">Horário da Entrega *</Label>
                    <Input
                      id="deliveryTime"
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receiverDocument">CPF do Recebedor *</Label>
                    <Input
                      id="receiverDocument"
                      value={receiverDocument}
                      onChange={(e) => setReceiverDocument(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      maxLength={14}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverName">Nome do Recebedor *</Label>
                  <Input
                    id="receiverName"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Nome completo de quem recebeu"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* NF-e Number */}
          <div className="space-y-2">
            <Label htmlFor="nfe">Número da NF-e</Label>
            <Input
              id="nfe"
              value={formData.nfe || ""}
              onChange={(e) => setFormData({ ...formData, nfe: e.target.value })}
            />
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Destinatário</Label>
            <Input
              id="recipient"
              value={formData.recipient || ""}
              onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone || ""}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={formData.address || ""}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          {/* City / State / ZIP */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-1">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city || ""}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">UF</Label>
              <Select
                value={formData.state || ""}
                onValueChange={(value) => setFormData({ ...formData, state: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {brazilianStates.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">CEP</Label>
              <Input
                id="zipCode"
                value={formData.zipCode || ""}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              />
            </div>
          </div>

          {/* Weight / Value */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="weight">Peso</Label>
              <Input
                id="weight"
                value={formData.weight || ""}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                placeholder="Ex: 5.2kg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Valor Declarado</Label>
              <Input
                id="value"
                value={formData.value || ""}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="R$ 0,00"
              />
            </div>
          </div>

          {/* Observation */}
          <div className="space-y-2">
            <Label htmlFor="observation">Observação</Label>
            <Textarea
              id="observation"
              value={formData.observation || ""}
              onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
              placeholder="Instruções especiais de entrega..."
              rows={3}
            />
          </div>

          {/* Last Update Info */}
          {delivery.lastUpdatedBy && (
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>Última atualização por <strong>{delivery.lastUpdatedBy}</strong></span>
              </div>
              {delivery.lastUpdatedAt && (
                <span> em {new Date(delivery.lastUpdatedAt).toLocaleString('pt-BR')}</span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={handleMarkAsReturned}
            disabled={isSaving}
            className="mr-auto"
          >
            Devolvido
          </Button>
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
                {isManualConfirm ? "Confirmar Entrega" : "Salvar Alterações"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
