import { CheckCircle2, MessageCircle, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";
import { formatCurrency } from "@/lib/formatCurrency";
import { openWhatsApp } from "@/lib/whatsapp";
import { FREIGHT_TYPE_LABELS, plateText, vehicleTypeLabel } from "./status";

interface ManifestSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifest: DBManifest | null;
  /** Telefone do motorista para abrir a conversa direto no WhatsApp. */
  driverPhone?: string | null;
  /** Abre a impressao do romaneio (de onde o navegador tambem salva em PDF). */
  onPrint?: () => void;
  /** Para onde o foco vai ao fechar (o botao que abriu o assistente). */
  returnFocusTo?: () => HTMLElement | null;
}

export function ManifestSuccessDialog({
  open,
  onOpenChange,
  manifest,
  driverPhone,
  onPrint,
  returnFocusTo,
}: ManifestSuccessDialogProps) {
  if (!manifest) return null;

  const handleSendWhatsApp = () => {
    // Sem ponto de exclamacao; frota propria nao tem frete a informar.
    const message =
      `Olá, ${manifest.driver_name}.\n\n` +
      `Seu romaneio ${formatManifestNumber(manifest)} foi gerado:\n` +
      `- Código: ${manifest.manifest_code}\n` +
      `- Entregas: ${manifest.deliveries_count}\n` +
      (manifest.is_own_fleet ? "" : `- Frete: ${formatCurrency(manifest.freight_value)}\n`) +
      `\nAs entregas já estão no app do motorista. Boas entregas.`;

    const hasPhone = openWhatsApp(driverPhone, message);
    if (!hasPhone) openWhatsApp(null, message);

    toast({
      title: "WhatsApp aberto",
      description: hasPhone
        ? `Conversa com ${manifest.driver_name} pronta para enviar.`
        : "Telefone do motorista não cadastrado: escolha o contato para enviar.",
    });
  };

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Código", value: manifest.manifest_code, mono: true },
    { label: "Motorista", value: manifest.driver_name },
    { label: "CPF", value: manifest.driver_cpf || "—", mono: true },
    { label: "Veículo", value: `${vehicleTypeLabel(manifest.vehicle_type)} · ${plateText(manifest.vehicle_plate) || "sem placa"}` },
    { label: "Tipo de frete", value: manifest.is_own_fleet ? "Frota própria" : FREIGHT_TYPE_LABELS[manifest.freight_type] || manifest.freight_type },
    { label: "Entregas", value: String(manifest.deliveries_count) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => {
          const target = returnFocusTo?.();
          if (target?.isConnected) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
      >
        <DialogHeader className="items-center pr-0 text-center">
          <span
            aria-hidden="true"
            className="mb-2 flex h-16 w-16 animate-pop-in items-center justify-center rounded-full bg-success/10 text-success"
          >
            <CheckCircle2 className="h-9 w-9" />
          </span>
          <DialogTitle className="text-xl">Romaneio {formatManifestNumber(manifest)} gerado</DialogTitle>
          <DialogDescription className="text-center">
            As entregas já aparecem no app do motorista. Avise o motorista ou imprima o romaneio.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border">
          <dl className="divide-y">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className={`min-w-0 break-words text-right text-sm font-medium text-foreground ${row.mono ? "font-data" : ""}`}>
                  {row.value}
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 bg-muted/40 px-4 py-3">
              <dt className="text-sm font-medium text-foreground">Valor do frete</dt>
              {manifest.is_own_fleet ? (
                <dd className="text-right text-sm font-medium text-muted-foreground">Sem acerto (frota própria)</dd>
              ) : (
                <dd className="font-data text-lg font-semibold text-primary">{formatCurrency(manifest.freight_value)}</dd>
              )}
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button type="button" size="lg" onClick={handleSendWhatsApp} className="w-full">
            <MessageCircle aria-hidden="true" />
            Enviar para o motorista
          </Button>
          {onPrint && (
            <Button type="button" variant="outline" onClick={onPrint} className="w-full">
              <Printer aria-hidden="true" />
              Imprimir / salvar PDF
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
