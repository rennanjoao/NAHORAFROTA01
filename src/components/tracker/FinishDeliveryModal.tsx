import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDriverTenantId, getProofStorageOwnerId, prepareImageForUpload, revokeObjectUrl } from "@/lib/driverApp";
import { PhotoField } from "./PhotoField";

interface FinishDeliveryModalProps {
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

const DRAFT_KEY = (id: string) => `delivery_draft_${id}`;

export function FinishDeliveryModal({
  open,
  onClose,
  invoiceId,
  nfeNumber,
  recipientName,
  driverId,
  latitude,
  longitude,
  onSuccess,
}: FinishDeliveryModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [receiverDocument, setReceiverDocument] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filePickerOpenRef = useRef(false);

  useEffect(() => {
    if (!open || !invoiceId) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY(invoiceId));
      if (saved) {
        const data = JSON.parse(saved);
        if (data.receiverName) setReceiverName(data.receiverName);
        if (data.receiverDocument) setReceiverDocument(data.receiverDocument);
        toast.info("Recuperamos o que você já tinha digitado.");
      }
    } catch {
      // ignore invalid draft
    }
  }, [open, invoiceId]);

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

  const saveDraft = (name: string, doc: string) => {
    try {
      localStorage.setItem(
        DRAFT_KEY(invoiceId),
        JSON.stringify({
          receiverName: name,
          receiverDocument: doc,
          timestamp: Date.now(),
        }),
      );
    } catch {
      // quota exceeded
    }
  };

  const handleReceiverNameChange = (value: string) => {
    setReceiverName(value);
    saveDraft(value, receiverDocument);
  };

  const handleReceiverDocChange = (value: string) => {
    setReceiverDocument(value);
    saveDraft(receiverName, value);
  };

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    filePickerOpenRef.current = false;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const preparedFile = await prepareImageForUpload(file);
      revokeObjectUrl(photoPreview);
      setPhotoFile(preparedFile);
      setPhotoPreview(URL.createObjectURL(preparedFile));
    } catch (error) {
      console.error("Compression error:", error);
      toast.error("Não foi possível preparar a foto. Vamos enviar a original.");
      revokeObjectUrl(photoPreview);
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    } finally {
      setIsCompressing(false);
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const timestamp = Date.now();
    const ownerId = await getProofStorageOwnerId();
    const path = `${ownerId}/deliveries/${driverId}/${invoiceId}_${timestamp}.jpg`;

    const { data, error } = await supabase.storage
      .from("delivery-proofs")
      .upload(path, file, { upsert: true, contentType: "image/jpeg" });

    if (error) {
      console.error("Delivery proof upload error:", error);
      throw new Error(error.message || "Falha ao enviar foto");
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from("delivery-proofs")
      .createSignedUrl(data.path, 86400);

    if (signedError || !signedData?.signedUrl) {
      console.error("Delivery proof signed URL error:", signedError);
      throw new Error(signedError?.message || "Falha ao gerar URL da foto");
    }
    return signedData.signedUrl;
  };

  const handleSubmit = async () => {
    if (!receiverName.trim()) {
      toast.error("Digite o nome de quem recebeu");
      return;
    }

    if (!receiverDocument.trim()) {
      toast.error("Digite o documento de quem recebeu");
      return;
    }

    setIsLoading(true);
    try {
      const tenantId = await getDriverTenantId(driverId);
      let photoUrl: string | null = null;
      if (photoFile) photoUrl = await uploadPhoto(photoFile);

      const deliveryTimestamp = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          status: "delivered",
          occurrence_type: null,
          receiver_name: receiverName.trim(),
          receiver_document: receiverDocument.trim() || null,
          delivered_at: deliveryTimestamp,
          updated_at: deliveryTimestamp,
        })
        .eq("id", invoiceId);

      if (updateError) throw updateError;

      const { data: existingDelivery } = await supabase
        .from("deliveries")
        .select("id")
        .eq("invoice_id", invoiceId)
        .maybeSingle();

      if (existingDelivery) {
        await supabase
          .from("deliveries")
          .update({
            recipient_name: receiverName.trim(),
            recipient_doc: receiverDocument.trim() || null,
            proof_photo_url: photoUrl,
            status: "delivered",
            delivered_at: deliveryTimestamp,
            tenant_id: tenantId,
          })
          .eq("id", existingDelivery.id);
      } else {
        const { error: deliveryError } = await supabase.from("deliveries").insert({
          invoice_id: invoiceId,
          driver_id: driverId,
          recipient_name: receiverName.trim(),
          recipient_doc: receiverDocument.trim() || null,
          proof_photo_url: photoUrl,
          status: "delivered",
          delivered_at: deliveryTimestamp,
          tenant_id: tenantId,
        });
        if (deliveryError) console.error("Delivery insert error (non-fatal):", deliveryError);
      }

      const { error: proofError } = await supabase.from("delivery_proofs").insert({
        invoice_id: invoiceId,
        driver_id: driverId,
        photo_url: photoUrl,
        receiver_name: receiverName.trim(),
        receiver_document: receiverDocument.trim() || null,
        latitude: latitude || null,
        longitude: longitude || null,
        delivered_at: deliveryTimestamp,
        tenant_id: tenantId,
      });
      if (proofError) console.error("Proof insert error (non-fatal):", proofError);

      localStorage.removeItem(DRAFT_KEY(invoiceId));

      toast.success("Entrega finalizada", { description: `${recipientName} recebeu a mercadoria.` });
      resetAndClose();
      onSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Não foi possível finalizar. Confira a internet e tente de novo.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    filePickerOpenRef.current = false;
    setPhotoFile(null);
    revokeObjectUrl(photoPreview);
    setPhotoPreview(null);
    setReceiverName("");
    setReceiverDocument("");
    onClose();
  };

  const removePhoto = () => {
    setPhotoFile(null);
    revokeObjectUrl(photoPreview);
    setPhotoPreview(null);
  };

  const missingFields = !receiverName.trim() || !receiverDocument.trim();

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
          <DialogTitle>Finalizar entrega</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{recipientName}</span>
            {nfeNumber && <span className="font-data"> · NF-e: {nfeNumber}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <PhotoField
            ref={fileInputRef}
            id="delivery-proof-photo"
            label="Foto do comprovante"
            hint="Opcional"
            preview={photoPreview}
            preparing={isCompressing}
            previewAlt="Foto do comprovante de entrega"
            onPick={openFilePicker}
            onChange={handlePhotoCapture}
            onRemove={removePhoto}
          />

          <div className="space-y-2">
            <Label htmlFor="receiver-name">Nome de quem recebeu</Label>
            <Input
              id="receiver-name"
              value={receiverName}
              onChange={(event) => handleReceiverNameChange(event.target.value)}
              placeholder="Nome completo"
              autoComplete="off"
              aria-required="true"
              className="h-12 text-base"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiver-doc">Documento de quem recebeu</Label>
            <Input
              id="receiver-doc"
              value={receiverDocument}
              onChange={(event) => handleReceiverDocChange(event.target.value)}
              placeholder="000.000.000-00"
              inputMode="numeric"
              autoComplete="off"
              aria-required="true"
              aria-describedby="receiver-doc-hint"
              className="h-12 text-base"
              disabled={isLoading}
            />
            <p id="receiver-doc-hint" className="text-xs text-muted-foreground">
              RG ou CPF. Só os números já bastam.
            </p>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 sm:flex">
          <Button variant="outline" size="lg" onClick={resetAndClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={isLoading || missingFields}
            aria-describedby={missingFields ? "finish-missing" : undefined}
            className="bg-success text-success-foreground hover:bg-success/90"
          >
            {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            {isLoading ? "Enviando" : "Confirmar entrega"}
          </Button>
        </DialogFooter>
        {missingFields && (
          <p id="finish-missing" className="-mt-2 text-center text-xs text-muted-foreground">
            Preencha o nome e o documento para confirmar.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
