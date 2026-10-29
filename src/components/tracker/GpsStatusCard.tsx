import { useEffect, useRef } from "react";
import { LocateFixed, LocateOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnline } from "./useOnline";

interface GpsStatusCardProps {
  isTracking: boolean;
  speed?: number;
  accuracy?: number;
  /** Aviso de sinal fraco (nao bloqueia o app). */
  warning?: string | null;
  onStart: () => void;
  onStop: () => void;
}

/**
 * GPS ligado: linha discreta com "Pausar". GPS pausado: aviso amarelo com o
 * botao grande para ligar de novo (a base deixa de ver o motorista).
 */
export function GpsStatusCard({ isTracking, speed, accuracy, warning, onStart, onStop }: GpsStatusCardProps) {
  const online = useOnline();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const toggledRef = useRef(false);

  // Pausar/ligar troca o botao: o foco vai para o novo, em vez de cair no body.
  useEffect(() => {
    if (!toggledRef.current) return;
    toggledRef.current = false;
    toggleRef.current?.focus();
  }, [isTracking]);

  const toggle = (action: () => void) => () => {
    toggledRef.current = true;
    action();
  };

  if (!isTracking) {
    return (
      <section aria-labelledby="gps-titulo" className="animate-fade-in rounded-xl border border-warning/40 bg-warning/10 p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
            <LocateOff className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="gps-titulo" className="text-base font-semibold text-foreground">
              GPS pausado
            </h2>
            <p className="text-sm text-muted-foreground">A base não está vendo onde você está.</p>
          </div>
        </div>
        <Button ref={toggleRef} size="lg" onClick={toggle(onStart)} className="mt-3 h-14 w-full text-base">
          <LocateFixed aria-hidden="true" />
          Ligar GPS
        </Button>
      </section>
    );
  }

  // Precisao fica no title (quem precisar ve); na tela, so o que o motorista entende.
  const details = online
    ? ["A base vê você no mapa", speed != null ? `${Math.round(speed).toLocaleString("pt-BR")} km/h` : null].filter(Boolean).join(" · ")
    : "Sem internet. A base vê o último lugar enviado.";
  const precision = accuracy != null ? `Precisão do GPS: ${Math.round(accuracy).toLocaleString("pt-BR")} m` : undefined;
  const attention = Boolean(warning) || !online;

  return (
    // flex-wrap: em tela estreita ou letra grande o botao desce para a linha de baixo.
    <section aria-labelledby="gps-titulo" className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 pl-4 shadow-sm">
      <span
        aria-hidden="true"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          attention ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
        )}
      >
        <LocateFixed className="h-5 w-5" />
      </span>
      <div className="min-w-[9rem] flex-1">
        <h2 id="gps-titulo" className="text-[0.9375rem] font-semibold text-foreground">
          {warning ? "GPS com sinal fraco" : "GPS ligado"}
        </h2>
        <p className={cn("text-sm", attention ? "text-warning" : "text-muted-foreground")} title={precision}>
          {warning || details}
        </p>
      </div>
      <Button ref={toggleRef} variant="outline" onClick={toggle(onStop)} className="ml-auto h-12 shrink-0 px-4">
        Pausar GPS
      </Button>
    </section>
  );
}
