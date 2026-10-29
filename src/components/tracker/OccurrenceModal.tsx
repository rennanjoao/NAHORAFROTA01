import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDriverTenantId, getProofStorageOwnerId, prepareImageForUpload, revokeObjectUrl } from "@/lib/driverApp";
import { DRIVER_OCCURRENCE_TYPES } from "./occurrenceTypes";
import { OptionTiles } from "./OptionTiles";
import { PhotoField } from "./PhotoField";

interface OccurrenceModalProps {
  open: boolean;
  onClose: () => void;
  driverId: string;
  latitude?: number;
  longitude?: number;
  onSuccess: () => void;
  /** Tipo ja escolhido no bloco da aba Reportar. */
  defaultType?: string;
}

export function OccurrenceModal({
  open,
  onClose,
  driverId,
  latitude,
  longitude,
  onSuccess,
  defaultType,
}: OccurrenceModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [typeError, setTypeError] = useState<string | undefined>();
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
    if (open && defaultType) setType(defaultType);
  }, [open, defaultType]);

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
    if (!type) {
      setTypeError("Escolha o que aconteceu para enviar.");
      document.querySelector<HTMLInputElement>('input[name="tipo-ocorrencia"]')?.focus();
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

      toast.success("Problema enviado para a base");
      resetAndClose();
      onSuccess();
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Não foi possível enviar o problema", { description: "Confira a internet e tente de novo." });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    filePickerOpenRef.current = false;
    setType("");
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
          <DialogTitle>Reportar problema</DialogTitle>
          <DialogDescription>
            Conte o que aconteceu. A base recebe na hora{latitude != null ? ", junto com a sua localização" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <OptionTiles
            name="tipo-ocorrencia"
            legend="O que aconteceu?"
            options={DRIVER_OCCURRENCE_TYPES}
            value={type}
            onChange={(value) => {
              setType(value);
              setTypeError(undefined);
            }}
            disabled={isLoading}
            error={typeError}
          />

          <div className="space-y-2">
            <Label htmlFor="occurrence-description">
              Explique em poucas palavras <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="occurrence-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex.: pneu furou na Marginal, já chamei o socorro"
              rows={3}
              className="resize-none text-base"
              disabled={isLoading}
            />
          </div>

          <PhotoField
            ref={fileInputRef}
            id="occurrence-photo"
            label="Foto"
            hint="Opcional"
            preview={photoPreview}
            previewAlt="Foto do problema"
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
            {isLoading ? "Enviando" : "Enviar para a base"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
