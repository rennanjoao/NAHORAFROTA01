import { MapPinOff, RefreshCw } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

interface GPSEnforcerProps {
  error: string;
  onRetry: () => void;
}

const STEPS = [
  "Abra as configurações do celular.",
  "Toque em Localização e deixe ligada.",
  "Permita a localização para o navegador ou para o app Na Hora Frota.",
  "Volte aqui e toque em Tentar novamente.",
];

/** Tela cheia quando a localizacao foi negada: o app so funciona com GPS. */
export function GPSEnforcer({ error, onRetry }: GPSEnforcerProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] text-foreground">
      <header className="mx-auto flex h-16 w-full max-w-md items-center px-5">
        <BrandLogo arrangement="linha" className="w-[132px]" />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 flex-col justify-center py-6 animate-fade-in">
          <span
            aria-hidden="true"
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-destructive/30 bg-destructive/10 text-destructive"
          >
            <MapPinOff className="h-10 w-10" />
          </span>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">Ligue a localização para continuar</h1>
          <p className="mt-2 text-base text-muted-foreground">
            A base precisa saber onde você está para acompanhar as entregas.
          </p>

          <p role="alert" className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
            {error}
          </p>

          <h2 className="mt-7 text-base font-semibold">Como ligar</h2>
          <ol className="mt-3 space-y-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-[0.9375rem]">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-data text-sm font-semibold text-primary"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <Button onClick={onRetry} size="lg" className="h-14 w-full text-base [&_svg]:size-5">
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      </main>
    </div>
  );
}
