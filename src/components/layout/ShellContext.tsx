import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { NAV_ITEMS } from "@/config/navigation";

export type ShellPanel = "palette" | "help" | "shortcuts" | "more" | null;

interface ClosePanelOptions {
  /** Foco vai para o conteudo da tela (escolheu uma tela), nao para quem abriu. */
  focusMain?: boolean;
}

interface ShellContextValue {
  panel: ShellPanel;
  openPanel: (panel: Exclude<ShellPanel, null>) => void;
  closePanel: (options?: ClosePanelOptions) => void;
  /** onCloseAutoFocus dos paineis do shell: devolve o foco a quem abriu o primeiro painel. */
  restoreFocus: (event: Event) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

const COLLAPSED_KEY = "nhf-sidebar-collapsed";

const readCollapsed = () => {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved !== null) return saved === "1";
  } catch {
    // sem armazenamento: decide pela largura
  }
  return window.innerWidth < 1280;
};

const focusedElement = () => {
  const element = document.activeElement;
  return element instanceof HTMLElement && element !== document.body ? element : null;
};

/** O usuario esta digitando (atalhos de uma tecla nao podem disparar). */
const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
};

export function ShellProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [panel, setPanel] = useState<ShellPanel>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsed);
  const pendingGo = useRef<number | null>(null);
  // Painel aberto agora (sem esperar o render) e quem abriu o primeiro painel.
  // Trocar de painel (Ajuda > Abrir a busca) mantem quem abriu: ao fechar o
  // ultimo, o foco volta para la (antes caia no <body>).
  const panelRef = useRef<ShellPanel>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const focusMainRef = useRef(false);

  const changePanel = useCallback((next: ShellPanel, options?: ClosePanelOptions) => {
    if (panelRef.current === null && next !== null) {
      openerRef.current = focusedElement();
      focusMainRef.current = false;
    }
    if (next === null) focusMainRef.current = Boolean(options?.focusMain);
    panelRef.current = next;
    setPanel(next);
  }, []);

  const openPanel = useCallback((next: Exclude<ShellPanel, null>) => changePanel(next), [changePanel]);
  const closePanel = useCallback((options?: ClosePanelOptions) => changePanel(null, options), [changePanel]);

  const restoreFocus = useCallback((event: Event) => {
    // Outro painel abriu no lugar: ele cuida do foco.
    if (panelRef.current !== null) {
      event.preventDefault();
      return;
    }
    const opener = openerRef.current;
    openerRef.current = null;
    if (focusMainRef.current) {
      focusMainRef.current = false;
      event.preventDefault();
      document.getElementById("conteudo")?.focus({ preventScroll: true });
      return;
    }
    if (opener?.isConnected) {
      event.preventDefault();
      opener.focus({ preventScroll: true });
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignora
      }
      return next;
    });
  }, []);

  // Atalhos: Ctrl/Cmd K e "/" abrem a busca; "?" mostra os atalhos;
  // "g" seguido da letra da tela navega (g e = Entregas). "[" recolhe o menu.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        changePanel(panelRef.current === "palette" ? null : "palette");
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      // Janela aberta bloqueia os atalhos; a que esta fechando (animacao de saida) nao.
      if (document.querySelector(':is([role="dialog"], [role="alertdialog"]):not([data-state="closed"])')) return;

      if (pendingGo.current !== null) {
        window.clearTimeout(pendingGo.current);
        pendingGo.current = null;
        const item = NAV_ITEMS.find((nav) => nav.shortcut === event.key.toLowerCase());
        if (item) {
          event.preventDefault();
          navigate(item.path);
        }
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        changePanel("palette");
      } else if (event.key === "?") {
        event.preventDefault();
        changePanel("shortcuts");
      } else if (event.key === "[") {
        event.preventDefault();
        toggleSidebar();
      } else if (event.key.toLowerCase() === "g") {
        pendingGo.current = window.setTimeout(() => {
          pendingGo.current = null;
        }, 1200);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, toggleSidebar, changePanel]);

  const value = useMemo(
    () => ({ panel, openPanel, closePanel, restoreFocus, sidebarCollapsed, toggleSidebar }),
    [panel, openPanel, closePanel, restoreFocus, sidebarCollapsed, toggleSidebar],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) throw new Error("useShell precisa estar dentro de <ShellProvider>");
  return context;
}
