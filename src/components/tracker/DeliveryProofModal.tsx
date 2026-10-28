import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, X, ImageIcon } from "lucide-react";
import { SignatureCanvas } from "./SignatureCanvas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDriverTenantId, getProofStorageOwnerId, prepareImageForUpload, revokeObjectUrl } from "@/lib/driverApp";

interface DeliveryProofModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  driverId: string;
  latitude?: number;
  longitude?: number;
  onSuccess: () => void;
}

const DRAFT_KEY = (id: string) => `proof_draft_${id}`;

export function DeliveryProofModal({
  open,
  onClose,
  invoiceId,
  driverId,
  latitude,
  longitude,
  onSuccess,
}: DeliveryProofModalProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
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
        if (data.step) setStep(data.step);
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

  const saveDraft = () => {
    try {
      localStorage.setItem(
        DRAFT_KEY(invoiceId),
        JSON.stringify({
          receiverName,
          receiverDocument,
          step,
          timestamp: Date.now(),
        }),
      );
    } catch {
      // quota
    }
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

  const uploadToStorage = async (file: File | Blob, path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("delivery-proofs")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from("delivery-proofs")
      .createSignedUrl(data.path, 3600);

    if (signedError || !signedData?.signedUrl) return null;
    return signedData.signedUrl;
  };

  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  const handleSubmit = async () => {
    if (!photoFile) {
      toast.error("Capture uma foto primeiro");
      return;
    }

    setIsLoading(true);

    try {
      const tenantId = await getDriverTenantId(driverId);
      const ownerId = await getProofStorageOwnerId();
      const timestamp = Date.now();
      const photoPath = `${ownerId}/deliveries/${driverId}/${invoiceId}_photo_${timestamp}.jpg`;
      const photoUrl = await uploadToStorage(photoFile, photoPath);
      if (!photoUrl) throw new Error("Falha ao enviar foto");

      let signatureUrl: string | null = null;
      if (signatureDataUrl) {
        const signatureBlob = dataURLtoBlob(signatureDataUrl);
        const signaturePath = `${ownerId}/deliveries/${driverId}/${invoiceId}_signature_${timestamp}.png`;
        signatureUrl = await uploadToStorage(signatureBlob, signaturePath);
      }

      const { error: dbError } = await supabase.from("delivery_proofs").insert({
        invoice_id: invoiceId,
        driver_id: driverId,
        photo_url: photoUrl,
        signature_url: signatureUrl,
        receiver_name: receiverName || null,
        receiver_document: receiverDocument || null,
        latitude: latitude || null,
        longitude: longitude || null,
        delivered_at: new Date().toISOString(),
        tenant_id: tenantId,
      });
      if (dbError) throw dbError;

      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          status: "delivered",
          occurrence_type: null,
          receiver_name: receiverName || null,
          receiver_document: receiverDocument || null,
          delivered_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);
      if (invoiceError) throw invoiceError;

      localStorage.removeItem(DRAFT_KEY(invoiceId));
      toast.success("Entrega confirmada com sucesso!");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Erro ao salvar comprovante");
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    filePickerOpenRef.current = false;
    setStep(1);
    setPhotoFile(null);
    revokeObjectUrl(photoPreview);
    setPhotoPreview(null);
    setSignatureDataUrl(null);
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
          <DialogTitle className="flex items-center justify-between">
            <span>Comprovante de Entrega</span>
            <span className="text-sm font-normal text-muted-foreground">Passo {step} de 3</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Capture ou selecione uma foto do comprovante</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoCapture}
                className="hidden"
              />

              {isCompressing ? (
                <div className="w-full h-32 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Preparando imagem...</span>
                </div>
              ) : photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
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
                  className="w-full h-32 flex-col gap-2"
                  onClick={openFilePicker}
                >
                  <ImageIcon className="h-8 w-8" />
                  <span>Tirar Foto ou Escolher da Galeria</span>
                </Button>
              )}

              <Button onClick={() => setStep(2)} disabled={!photoPreview} className="w-full">
                Próximo
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Colete a assinatura do recebedor (opcional)</p>
              <SignatureCanvas onSignatureChange={setSignatureDataUrl} />
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="receiver-name">Nome do recebedor</Label>
                  <Input
                    id="receiver-name"
                    value={receiverName}
                    onChange={(event) => {
                      setReceiverName(event.target.value);
                      saveDraft();
                    }}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receiver-doc">Documento (RG/CPF)</Label>
                  <Input
                    id="receiver-doc"
                    value={receiverDocument}
                    onChange={(event) => {
                      setReceiverDocument(event.target.value);
                      saveDraft();
                    }}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1">
                  Próximo
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Revise os dados e confirme a entrega</p>
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Foto capturada</span>
                </div>
                {signatureDataUrl && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Assinatura coletada</span>
                  </div>
                )}
                {receiverName && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Recebedor: {receiverName}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1" disabled={isLoading}>
                  Voltar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Confirmar Entrega
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
