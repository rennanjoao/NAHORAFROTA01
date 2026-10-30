import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CameraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** "user": camera da frente (foto do motorista). "environment": de tras (veiculo). */
  facing?: "user" | "environment";
  onCapture: (photo: File) => void;
}

function cameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "O navegador bloqueou a câmera. Libere o acesso no cadeado ao lado do endereço e tente de novo.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Nenhuma câmera encontrada neste aparelho.";
  if (name === "NotReadableError") return "A câmera está sendo usada por outro programa. Feche-o e tente de novo.";
  return "Não foi possível abrir a câmera.";
}

/** Tira foto pela webcam do computador ou pela camera do celular, direto no navegador. */
export function CameraDialog({ open, onOpenChange, title, facing = "user", onCapture }: CameraDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState(facing);
  const [state, setState] = useState<"starting" | "ready" | "error">("starting");
  const [error, setError] = useState("");
  const [hasManyCameras, setHasManyCameras] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setHasManyCameras(devices.filter((device) => device.kind === "videoinput").length > 1);
      setState("ready");
    } catch (err) {
      setError(cameraError(err));
      setState("error");
    }
  }, [mode, stop]);

  useEffect(() => {
    if (open) void start();
    else stop();
    return stop;
  }, [open, start, stop]);

  useEffect(() => setMode(facing), [facing]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    // Camera da frente aparece espelhada na tela; a foto sai do jeito certo.
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onOpenChange(false);
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Enquadre e toque em Tirar foto. O navegador pode pedir permissão para usar a câmera.</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Imagem da câmera"
            className={mode === "user" ? "h-full w-full -scale-x-100 object-cover" : "h-full w-full object-cover"}
          />
          {state === "starting" && (
            <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              Abrindo a câmera
            </div>
          )}
          {state === "error" && (
            <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white">
              <p>{error}</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => void start()}>
                <RefreshCw aria-hidden="true" />
                Tentar de novo
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {hasManyCameras ? (
            <Button type="button" variant="outline" onClick={() => setMode((current) => (current === "user" ? "environment" : "user"))}>
              <SwitchCamera aria-hidden="true" />
              Trocar câmera
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={capture} disabled={state !== "ready"}>
            <Camera aria-hidden="true" />
            Tirar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
