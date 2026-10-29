import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, AlertTriangle, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDriverTenantId, getProofStorageOwnerId, prepareImageForUpload, revokeObjectUrl } from "@/lib/driverApp";

interface OccurrenceModalProps {
  open: boolean;
  onClose: () => void;
  driverId: string;
  latitude?: number;
  longitude?: number;
  onSuccess: () => void;
}

const occurrenceTypes = [
  { value: "accident", label: "Acidente" },
  { value: "delay", label: "Atraso" },
  { value: "mechanical", label: "Problema Mecânico" },
  { value: "other", label: "Outro" },
];

export function OccurrenceModal({
  open,
  onClose,
  driverId,
  latitude,
  longitude,
  onSuccess,
}: OccurrenceModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [type, setType] = useState<string>("");
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
    if (!type) {
      toast.error("Selecione o tipo de ocorrência");
      return;
    }

    setIsLoading(true);

    try {
      const tenantId = await getDriverTenantId(driverId);
      const ownerId = await getProofStorageOwnerId();
      let photoUrl: string | null = null;

      if (photoFile) {
        const timestamp = Date.now();
        const path = `${ownerId}/occurrences/${driverId}/${timestamp}.jpg`;

        const { data, error } = await supabase.storage
          .from("delivery-proofs")
          .upload(path, photoFile, { upsert: true, contentType: "image/jpeg" });

        if (error) {
          console.error("Driver occurrence upload error:", error);
          throw error;
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from("delivery-proofs")
          .createSignedUrl(data.path, 3600);

        if (signedError) {
          console.error("Driver occurrence signed URL error:", signedError);
          throw signedError;
        }

        photoUrl = signedData?.signedUrl || null;
      }

      const { error: dbError } = await supabase.from("driver_occurrences").insert({
        driver_id: driverId,
        type,
        description: description || null,
        photo_url: photoUrl,
        latitude: latitude || null,
        longitude: longitude || null,
        tenant_id: tenantId,
      });

      if (dbError) throw dbError;

      toast.success("Ocorrência registrada com sucesso.");
      resetAndClose();
      onSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Erro ao registrar ocorrência");
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    filePickerOpenRef.current = false;
    setType("");
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
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Registrar Ocorrência
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tipo de ocorrência *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {occurrenceTypes.map((occurrence) => (
                  <SelectItem key={occurrence.value} value={occurrence.value}>
                    {occurrence.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descreva o que aconteceu..."
              rows={3}
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
                <img src={photoPreview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
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
                Tirar Foto ou Escolher da Galeria
              </Button>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={resetAndClose} className="flex-1" disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading || !type} className="flex-1 gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Registrar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
