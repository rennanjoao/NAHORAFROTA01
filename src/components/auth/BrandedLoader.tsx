import { BrandLogo } from "@/components/brand/BrandLogo";
import { cn } from "@/lib/utils";

interface BrandedLoaderProps {
  /** O que esta acontecendo, em linguagem simples ("Conferindo seu acesso"). */
  label: string;
  /** Tela cheia (antes do app abrir) ou dentro de um bloco. */
  fullScreen?: boolean;
}

/** Carregamento calmo com o simbolo da marca. Anunciado ao leitor de tela. */
export function BrandedLoader({ label, fullScreen = true }: BrandedLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-5 bg-background px-6 text-center",
        fullScreen ? "min-h-dvh" : "min-h-[50vh]",
      )}
    >
      <span aria-hidden="true" className="flex h-16 w-16 animate-scale-in items-center justify-center rounded-2xl border bg-card shadow-md">
        <BrandLogo arrangement="simbolo" className="w-9" />
      </span>
      <span aria-hidden="true" className="skeleton-shimmer block h-1.5 w-28 rounded-full" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
