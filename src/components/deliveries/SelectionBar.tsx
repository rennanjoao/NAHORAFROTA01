import { Route, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelectionBarProps {
  /** Notas marcadas que ainda nao estao em romaneio. */
  count: number;
  onGenerate: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * Barra que aparece so quando ha notas marcadas. Fica presa no rodape da tela
 * (acima da barra do celular) com as acoes em lote.
 */
export function SelectionBar({ count, onGenerate, onDelete, onClear }: SelectionBarProps) {
  if (count === 0) return null;
  const label = count === 1 ? "1 nota selecionada" : `${count.toLocaleString("pt-BR")} notas selecionadas`;

  return (
    <div className="pointer-events-none sticky bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+0.75rem)] z-30 flex justify-center md:bottom-6">
      <div
        role="region"
        aria-label="Ações das notas selecionadas"
        className="pointer-events-auto flex w-full max-w-xl animate-fade-in items-center gap-2 rounded-xl border bg-popover p-2 pl-4 text-popover-foreground shadow-xl"
      >
        <p className="min-w-0 flex-1 truncate text-sm font-semibold" aria-live="polite">
          {label}
        </p>
        <Button size="sm" onClick={onGenerate} className="h-10 sm:h-9">
          <Route aria-hidden="true" />
          Gerar romaneio
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          aria-label="Excluir notas selecionadas"
          className="h-10 w-10 px-0 text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:w-auto sm:px-3"
        >
          <Trash2 aria-hidden="true" />
          <span className="hidden sm:inline">Excluir</span>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClear}
          aria-label="Limpar seleção"
          className="h-10 w-10 text-muted-foreground sm:h-9 sm:w-9"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
