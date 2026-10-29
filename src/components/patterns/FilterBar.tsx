import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Faixa de busca e filtros acima de listas. No celular empilha; no computador
 * fica em linha, com as acoes da lista (ex.: excluir selecionadas) a direita.
 */
export function FilterBar({ children, actions, className }: { children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div
      role="search"
      className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between", className)}
    >
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
