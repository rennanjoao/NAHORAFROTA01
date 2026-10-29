import { useSyncExternalStore } from "react";

// Conexao do aparelho (so para avisar; nada muda no envio).
const subscribeOnline = (callback: () => void) => {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};

export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
