import { useEffect, useState } from "react";
import { formatBrazilDateTime } from "@/lib/timezone";

/**
 * Abertura do dashboard no estilo do manual da marca: linhas de rota ao fundo,
 * marcador de hora "ao vivo" e titulo com uma unica palavra em verde.
 */
export function WelcomeBanner() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 md:p-8">
      <div className="absolute inset-0 nhf-routes opacity-70 pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 space-y-4">
        <span className="nhf-live">Ao vivo · {formatBrazilDateTime(now.toISOString(), "HH:mm")}</span>
        <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight">
          O pátio inteiro <span className="text-primary">numa tela.</span>
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-[62ch]">
          Quem está em rota, quem atrasou e o que precisa de atenção, em tempo real.
        </p>
      </div>
    </div>
  );
}
