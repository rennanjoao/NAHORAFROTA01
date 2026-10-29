import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Aplica o termo "?q=" vindo da busca geral do topo no campo de busca da tela e
 * tira o parametro da URL (a busca continua editavel pelo usuario).
 */
export function useUrlSearchTerm(apply: (term: string, params: URLSearchParams) => void, extraParams: string[] = []) {
  const [searchParams, setSearchParams] = useSearchParams();
  const term = searchParams.get("q");

  useEffect(() => {
    if (term === null) return;
    apply(term, searchParams);
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    extraParams.forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);
}
