import { forwardRef, useEffect, useRef, type ChangeEvent } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhotoFieldProps {
  id: string;
  label: string;
  /** Texto embaixo do rotulo (ex.: "Opcional"). */
  hint?: string;
  preview: string | null;
  /** Imagem sendo preparada (compressao). */
  preparing?: boolean;
  previewAlt: string;
  onPick: () => void;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}

/**
 * Campo de foto do app do motorista: botao grande para camera/galeria, previa
 * com "Trocar foto" e "Remover". O input de arquivo fica escondido; o modal
 * controla quando ele abre (para o Dialog nao fechar com o seletor aberto).
 */
export const PhotoField = forwardRef<HTMLInputElement, PhotoFieldProps>(
  ({ id, label, hint, preview, preparing, previewAlt, onPick, onChange, onRemove }, ref) => {
    const pickRef = useRef<HTMLButtonElement>(null);
    const removedRef = useRef(false);

    // "Remover foto" some da tela: o foco vai para o botao de tirar foto (nao cai no body).
    useEffect(() => {
      if (!preview && removedRef.current) {
        removedRef.current = false;
        pickRef.current?.focus();
      }
    }, [preview]);

    return (
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span id={`${id}-rotulo`} className="text-sm font-medium text-foreground">
            {label}
          </span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        <input
          ref={ref}
          id={id}
          type="file"
          accept="image/*"
          onChange={onChange}
          className="hidden"
          aria-labelledby={`${id}-rotulo`}
        />

        {preparing ? (
          <div
            role="status"
            className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground"
          >
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            Preparando a foto
          </div>
        ) : preview ? (
          <div className="animate-scale-in overflow-hidden rounded-lg border bg-muted">
            <img src={preview} alt={previewAlt} className="h-44 w-full object-cover" />
            <div className="grid grid-cols-2 gap-px border-t bg-border">
              <button
                type="button"
                onClick={onPick}
                className="flex h-12 items-center justify-center gap-2 bg-card text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                Trocar foto
              </button>
              <button
                type="button"
                onClick={() => {
                  removedRef.current = true;
                  onRemove();
                }}
                className="flex h-12 items-center justify-center gap-2 bg-card text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Remover foto
              </button>
            </div>
          </div>
        ) : (
          <Button
            ref={pickRef}
            type="button"
            variant="outline"
            onClick={onPick}
            aria-describedby={`${id}-rotulo`}
            className="h-28 w-full flex-col gap-2 border-2 border-dashed bg-muted/40 text-muted-foreground hover:text-foreground [&_svg]:size-7"
          >
            <Camera aria-hidden="true" />
            <span className="text-[0.9375rem] font-semibold">Tirar foto ou escolher da galeria</span>
          </Button>
        )}
      </div>
    );
  },
);
PhotoField.displayName = "PhotoField";
