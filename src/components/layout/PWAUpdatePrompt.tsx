import { useRegisterSW } from "virtual:pwa-register/react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Confere de hora em hora se ha versao nova publicada (o app fica aberto o dia todo).
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Avisa quando ha uma versao nova do app. O service worker esta em modo "prompt"
 * e nada chamava a atualizacao: quem tinha o app instalado ficava na versao antiga.
 * O cartao fica acima das barras inferiores (painel no celular e app do motorista).
 */
export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      window.setInterval(() => {
        registration.update().catch(() => undefined);
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  // A regiao "ao vivo" existe sempre; so o cartao entra e sai (o leitor de tela anuncia).
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[900] mx-auto max-w-sm sm:inset-x-auto sm:right-6 sm:mx-0 sm:w-[22rem]"
    >
      {needRefresh && (
        <div className="flex animate-fade-in items-start gap-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-[0.9375rem] font-semibold leading-snug">Nova versão disponível</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Atualize para usar as últimas melhorias e correções. Leva só um instante.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void updateServiceWorker(true)}>Atualizar agora</Button>
              <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
                Depois
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
