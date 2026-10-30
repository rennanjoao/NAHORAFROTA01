import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getProofStorageOwnerId, prepareImageForUpload, revokeObjectUrl } from "@/lib/driverApp";
import { useOccurrenceReasons } from "@/hooks/useOccurrenceReasons";
import { deliveryReasonOptions } from "./occurrenceTypes";
import { OptionTiles } from "./OptionTiles";
import { PhotoField } from "./PhotoField";

interface DeliveryOccurrenceModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  nfeNumber: string | null;
  recipientName: string;
  driverId: string;
  latitude?: number;
  longitude?: number;
  onSuccess: () => void;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

export function DeliveryOccurrenceModal({
  open,
  onClose,
  invoiceId,
  nfeNumber,
  recipientName,
  driverId,
  onSuccess,
}: DeliveryOccurrenceModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [typeError, setTypeError] = useState<string | undefined>();
  const [occurrenceType, setOccurrenceType] = useState("");
  // So os motivos que a empresa cadastrou (Configuracoes > Ocorrencias); a observacao e livre.
  const { active: reasons, labelFor } = useOccurrenceReasons();
  const reasonOptions = deliveryReasonOptions(reasons);
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filePickerOpenRef = useRef(false);

  useEffect(() => {
    return () => revokeObjectUrl(photoPreview);
  }, [photoPreview]);

  useEffect(() => {
    const handleWindowFocus = () => {
      window.setTimeout(() => {
        filePickerOpenRef.current = false;
      }, 300);
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);

  const openFilePicker = () => {
    filePickerOpenRef.current = true;
    fileInputRef.current?.click();
  };

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    filePickerOpenRef.current = false;
    const file = event.target.files?.[0];
    // Limpa o campo: escolher a mesma foto de novo (depois de remover) volta a funcionar.
    event.target.value = "";
    if (!file) return;

    try {
      const preparedFile = await prepareImageForUpload(file);
      revokeObjectUrl(photoPreview);
      setPhotoFile(preparedFile);
      setPhotoPreview(URL.createObjectURL(preparedFile));
    } catch (error) {
      console.error("Error preparing occurrence image:", error);
      toast.error("Não foi possível usar essa foto. Tente outra ou escolha da galeria.");
    }
  };

  const handleSubmit = async () => {
    if (isLoading) return;
    // Antes o botao ficava apagado; agora diz o que falta e leva o foco para as opcoes.
    if (!occurrenceType) {
      setTypeError("Escolha o que aconteceu para enviar.");
      document.querySelector<HTMLInputElement>('input[name="tipo-problema-entrega"]')?.focus();
      return;
    }

    setIsLoading(true);

    try {
      const ownerId = await getProofStorageOwnerId();
      let photoUrl: string | null = null;

      if (photoFile) {
        const timestamp = Date.now();
        const path = `${ownerId}/occurrences/${driverId}/${invoiceId}_${timestamp}.jpg`;

        const { data, error } = await supabase.storage
          .from("delivery-proofs")
          .upload(path, photoFile, { upsert: true, contentType: "image/jpeg" });

        if (error) {
          console.error("Delivery occurrence upload error:", error);
          throw error;
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from("delivery-proofs")
          .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);

        if (signedError) {
          console.error("Delivery occurrence signed URL error:", signedError);
          throw signedError;
        }
        photoUrl = signedData?.signedUrl || null;
      }

      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          status: "occurrence",
          occurrence_type: occurrenceType,
          observation: description.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      if (updateError) throw updateError;

      let deliveryId: string | null = null;

      try {
        const { data: existingDelivery } = await supabase
          .from("deliveries")
          .select("id")
          .eq("invoice_id", invoiceId)
          .maybeSingle();

        if (existingDelivery) {
          deliveryId = existingDelivery.id;
          await supabase
            .from("deliveries")
            .update({
              status: "OCORRENCIA",
            })
            .eq("id", deliveryId);
        } else {
          const { data: newDelivery } = await supabase
            .from("deliveries")
            .insert({
              invoice_id: invoiceId,
              driver_id: driverId,
              status: "OCORRENCIA",
            })
            .select("id")
            .single();

          deliveryId = newDelivery?.id || null;
        }
      } catch (deliveryError) {
        console.warn("Delivery record creation failed (non-fatal):", deliveryError);
      }

      const occurrencePayload = {
        invoice_id: invoiceId,
        delivery_id: deliveryId,
        driver_id: driverId,
        occurrence_type: occurrenceType,
        description: description.trim() || null,
        photo_url: photoUrl,
      };

      const { error: occurrenceError } = await supabase.from("delivery_occurrences").insert(occurrencePayload);

      if (occurrenceError) {
        console.warn("Occurrence record failed after invoice status update:", occurrenceError);
        toast.warning("A entrega ficou com problema, mas o detalhe não foi salvo. Avise a base.");
      }

      const typeLabel = labelFor(occurrenceType);
      toast.success(`Problema registrado: ${typeLabel}`);

      resetAndClose();
      onSuccess();
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Não foi possível registrar o problema", { description: "Confira a internet e tente de novo." });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    filePickerOpenRef.current = false;
    setOccurrenceType("");
    setDescription("");
    setTypeError(undefined);
    setPhotoFile(null);
    revokeObjectUrl(photoPreview);
    setPhotoPreview(null);
    onClose();
  };

  const removePhoto = () => {
    setPhotoFile(null);
    revokeObjectUrl(photoPreview);
    setPhotoPreview(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen || filePickerOpenRef.current) return;
        resetAndClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar problema na entrega</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{recipientName}</span>
            {nfeNumber && <span className="font-data"> · NF-e: {nfeNumber}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <OptionTiles
            name="tipo-problema-entrega"
            legend="Por que não deu para entregar?"
            options={reasonOptions}
            value={occurrenceType}
            onChange={(value) => {
              setOccurrenceType(value);
              setTypeError(undefined);
            }}
            disabled={isLoading}
            error={typeError}
          />

          <div className="space-y-2">
            <Label htmlFor="delivery-occurrence-description">
              Observação <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="delivery-occurrence-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex.: portão fechado, ninguém atendeu"
              rows={3}
              className="resize-none text-base"
              disabled={isLoading}
            />
          </div>

          <PhotoField
            ref={fileInputRef}
            id="delivery-occurrence-photo"
            label="Foto"
            hint="Opcional"
            preview={photoPreview}
            previewAlt="Foto do problema na entrega"
            onPick={openFilePicker}
            onChange={handlePhotoCapture}
            onRemove={removePhoto}
          />
        </div>

        <DialogFooter className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 sm:flex">
          <Button variant="outline" size="lg" onClick={resetAndClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button size="lg" onClick={handleSubmit} aria-disabled={isLoading || undefined}>
            {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {isLoading ? "Registrando" : "Registrar problema"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
