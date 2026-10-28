import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Camera, Loader2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getProofStorageOwnerId, prepareImageForUpload, revokeObjectUrl } from "@/lib/driverApp";

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

const OCCURRENCE_TYPES = [
  { value: "cliente_ausente", label: "Cliente Ausente" },
  { value: "recusado", label: "Recusado pelo Cliente" },
  { value: "endereco_errado", label: "Endereco Errado/Nao Encontrado" },
  { value: "area_risco", label: "Area de Risco" },
  { value: "horario_restrito", label: "Fora do Horario de Entrega" },
  { value: "avaria", label: "Mercadoria Avariada" },
  { value: "extravio", label: "Mercadoria Extraviada" },
  { value: "outros", label: "Outros" },
];

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
  const [occurrenceType, setOccurrenceType] = useState("");
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
    if (!file) return;

    try {
      const preparedFile = await prepareImageForUpload(file);
      revokeObjectUrl(photoPreview);
      setPhotoFile(preparedFile);
      setPhotoPreview(URL.createObjectURL(preparedFile));
    } catch (error) {
      console.error("Error preparing occurrence image:", error);
      toast.error("Erro ao processar imagem. Tente outra foto ou use a galeria.");
    }
  };

  const handleSubmit = async () => {
    if (!occurrenceType) {
      toast.error("Selecione o tipo de ocorrencia");
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
        toast.warning("Ocorrencia registrada, mas a foto nao foi salva nos detalhes.");
      }

      const typeLabel = OCCURRENCE_TYPES.find((item) => item.value === occurrenceType)?.label || occurrenceType;
      toast.success(`Ocorrencia registrada: ${typeLabel}`);

      resetAndClose();
      onSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Erro ao registrar ocorrencia");
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    filePickerOpenRef.current = false;
    setOccurrenceType("");
    setDescription("");
    setPhotoFile(null);
    revokeObjectUrl(photoPreview);
    setPhotoPreview(null);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Registrar Ocorrencia
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm space-y-1 dark:border-orange-800 dark:bg-orange-900/20">
            <p>
              <span className="text-muted-foreground">NF-e: </span>
              <span className="font-mono font-semibold">{nfeNumber || "N/A"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Destinatario: </span>
              <span className="font-medium">{recipientName}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Ocorrencia *</Label>
            <Select value={occurrenceType} onValueChange={setOccurrenceType}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {OCCURRENCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="py-3">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descricao</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descreva o que aconteceu..."
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Foto (opcional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoCapture}
              className="hidden"
            />

            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Preview da ocorrencia" className="h-32 w-full rounded-lg object-cover" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 h-6 w-6"
                  onClick={() => {
                    setPhotoFile(null);
                    revokeObjectUrl(photoPreview);
                    setPhotoPreview(null);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full gap-2" onClick={openFilePicker}>
                <Camera className="h-4 w-4" />
                Anexar Foto
              </Button>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={resetAndClose} className="flex-1 h-12" disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !occurrenceType}
              className="flex-1 h-12 gap-2 bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Registrar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { OCCURRENCE_TYPES };
