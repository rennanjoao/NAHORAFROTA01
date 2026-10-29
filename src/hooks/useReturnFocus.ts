import { useCallback, useEffect, useMemo, useRef } from "react";

const focusedElement = () => {
  const element = document.activeElement;
  return element instanceof HTMLElement && element !== document.body ? element : null;
};

/**
 * Janelas abertas por codigo (sem DialogTrigger) nao devolvem o foco ao fechar:
 * o Radix so volta para o proprio Trigger. Espalhe estas props no
 * DialogContent/SheetContent para o foco voltar ao botao que abriu.
 */
export function useReturnFocus() {
  const target = useRef<HTMLElement | null>(null);
  return useMemo(
    () => ({
      onOpenAutoFocus: () => {
        target.current = focusedElement();
      },
      onCloseAutoFocus: (event: Event) => {
        const element = target.current;
        target.current = null;
        if (element?.isConnected) {
          event.preventDefault();
          element.focus();
        }
      },
    }),
    [],
  );
}

/**
 * Mesma ideia para janelas que nao aceitam essas props (ex.: ConfirmDialog):
 * chame capture() ao abrir; o foco volta quando `open` passa a false.
 */
export function useReturnFocusOnClose(open: boolean) {
  const target = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (wasOpen.current && !open) {
      const element = target.current;
      target.current = null;
      if (element?.isConnected) element.focus();
    }
    wasOpen.current = open;
  }, [open]);

  return useCallback(() => {
    target.current = focusedElement();
  }, []);
}
