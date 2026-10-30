import { useId, useRef, useState, type ChangeEvent } from "react";
import { Camera, ImageUp, Loader2, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ACCEPTED_IMAGES, canUseCamera, uploadTenantImage, type TenantMediaKind } from "@/lib/tenantMedia";
import { cn } from "@/lib/utils";
import { CameraDialog } from "./CameraDialog";

interface PhotoPickerProps {
  kind: TenantMediaKind;
  label: string;
  hint?: string;
  /** Link da foto atual (ou null). */
  value: string | null;
  /** Recebe o link novo assim que a foto termina de subir (null ao remover). */
  onChange: (url: string | null) => void;
  /** Icone quando nao ha foto. */
  placeholderIcon: LucideIcon;
  /** Redonda (pessoa) ou retangular (veiculo, logo). */
  shape?: "circle" | "rect";
  /** Camera usada no "Tirar foto". */
  facing?: "user" | "environment";
  disabled?: boolean;
}

/**
 * Foto com previa: "Enviar foto" (arquivo do computador ou galeria do celular) e
 * "Tirar foto" (webcam ou camera do celular, direto no navegador). A foto sobe na
 * hora para a pasta da empresa; o cadastro grava o link ao salvar.
 */
export function PhotoPicker({ kind, label, hint, value, onChange, placeholderIcon: Placeholder, shape = "circle", facing = "user", disabled }: PhotoPickerProps) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraAvailable = canUseCamera();

  const send = async (file: File) => {
    setUploading(true);
    try {
      onChange(await uploadTenantImage(kind, file));
    } catch (error) {
      toast({ title: "Não foi possível usar essa foto", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void send(file);
  };

  const preview = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden border bg-muted text-muted-foreground",
    shape === "circle" ? "h-20 w-20 rounded-full" : "h-20 w-32 rounded-lg",
  );

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium text-foreground">
          {label}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className={preview}>
          {value ? <img src={value} alt={`${label} atual`} className="h-full w-full object-cover" /> : <Placeholder className="h-8 w-8" aria-hidden="true" />}
          {uploading && (
            <div role="status" className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin text-foreground" aria-hidden="true" />
              <span className="sr-only">Enviando foto</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-label`}>
          {/* No celular o "Enviar foto" tambem oferece a camera; "Tirar foto" abre a camera direto. */}
          <input ref={fileRef} type="file" accept={ACCEPTED_IMAGES} onChange={handleFile} className="hidden" tabIndex={-1} aria-hidden="true" />
          <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => fileRef.current?.click()}>
            <ImageUp aria-hidden="true" />
            Enviar foto
          </Button>
          {cameraAvailable && (
            <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => setCameraOpen(true)}>
              <Camera aria-hidden="true" />
              Tirar foto
            </Button>
          )}
          {value && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || uploading} onClick={() => onChange(null)} className="text-destructive hover:text-destructive">
              <Trash2 aria-hidden="true" />
              Remover
            </Button>
          )}
        </div>
      </div>
      {cameraAvailable && (
        <CameraDialog open={cameraOpen} onOpenChange={setCameraOpen} title={label} facing={facing} onCapture={(file) => void send(file)} />
      )}
    </div>
  );
}
