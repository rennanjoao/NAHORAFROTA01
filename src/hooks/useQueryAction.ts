import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Atalhos da busca (Ctrl K) abrem telas ja com uma acao: "/drivers?action=new"
 * abre o cadastro de motorista. A tela chama este hook com o nome da acao; o
 * parametro sai da URL depois de usado (voltar nao reabre o formulario).
 *
 *   useQueryAction("new", () => setIsAddOpen(true));
 */
export function useQueryAction(action: string, handler: () => void, enabled = true) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("action");

  useEffect(() => {
    if (!enabled || requested !== action) return;
    handler();
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, action, enabled]);
}
