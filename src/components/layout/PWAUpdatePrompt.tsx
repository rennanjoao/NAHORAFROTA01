import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

// Confere de hora em hora se ha versao nova publicada (o app fica aberto o dia todo).
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_TOAST_ID = "pwa-update";

/**
 * Avisa quando ha uma versao nova do app. O service worker esta em modo "prompt"
 * e nada chamava a atualizacao: quem tinha o app instalado ficava na versao antiga.
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

  useEffect(() => {
    if (!needRefresh) return;
    toast("Nova versão disponível", {
      id: UPDATE_TOAST_ID,
      description: "Atualize para usar as últimas correções.",
      duration: Infinity,
      action: {
        label: "Atualizar",
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
      cancel: {
        label: "Depois",
        onClick: () => setNeedRefresh(false),
      },
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
