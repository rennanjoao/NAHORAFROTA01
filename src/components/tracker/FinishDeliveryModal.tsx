import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Check, Loader2, X, User, FileText, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDriverTenantId, getProofStorageOwnerId, prepareImageForUpload, revokeObjectUrl } from "@/lib/driverApp";

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
        toast.info("Rascunho restaurado da sessão anterior.");
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
      toast.error("Erro ao processar imagem. Tente outra foto ou use a galeria.");
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
      toast.error("Nome de quem recebeu é obrigatório");
      return;
    }

    if (!receiverDocument.trim()) {
      toast.error("Documento do recebedor é obrigatório");
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

      toast.success("Entrega finalizada com sucesso!");
      resetAndClose();
      onSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Erro ao finalizar entrega. Tente novamente.");
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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen || filePickerOpenRef.current) return;
        resetAndClose();
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <Check className="h-5 w-5" />
            Finalizar Entrega
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">NF-e: </span>
              <span className="font-mono font-semibold">{nfeNumber || "N/A"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Destinatário: </span>
              <span className="font-medium">{recipientName}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Foto do Comprovante
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoCapture}
              className="hidden"
            />

            {isCompressing ? (
              <div className="w-full h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Preparando imagem...</span>
              </div>
            ) : photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Comprovante" className="w-full h-40 object-cover rounded-lg border" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => {
                    setPhotoFile(null);
                    revokeObjectUrl(photoPreview);
                    setPhotoPreview(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-24 flex-col gap-2 border-dashed border-2"
                onClick={openFilePicker}
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="text-muted-foreground">Tirar Foto ou Escolher da Galeria</span>
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiver-name" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Nome de Quem Recebeu *
            </Label>
            <Input
              id="receiver-name"
              value={receiverName}
              onChange={(event) => handleReceiverNameChange(event.target.value)}
              placeholder="Nome completo"
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiver-doc" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documento (RG/CPF) *
            </Label>
            <Input
              id="receiver-doc"
              value={receiverDocument}
              onChange={(event) => handleReceiverDocChange(event.target.value)}
              placeholder="000.000.000-00"
              className="h-12"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={resetAndClose} className="flex-1 h-12" disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !receiverName.trim() || !receiverDocument.trim()}
              className="flex-1 h-12 gap-2 bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" /> Confirmar
                </>
              )}
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground">
            Foto opcional. Nome e documento do recebedor são obrigatórios.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
