import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { NAV_ITEMS } from "@/config/navigation";

export type ShellPanel = "palette" | "help" | "shortcuts" | "more" | null;

interface ShellContextValue {
  panel: ShellPanel;
  openPanel: (panel: Exclude<ShellPanel, null>) => void;
  closePanel: () => void;
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

  const openPanel = useCallback((next: Exclude<ShellPanel, null>) => setPanel(next), []);
  const closePanel = useCallback(() => setPanel(null), []);

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
        setPanel((current) => (current === "palette" ? null : "palette"));
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;

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
        setPanel("palette");
      } else if (event.key === "?") {
        event.preventDefault();
        setPanel("shortcuts");
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
  }, [navigate, toggleSidebar]);

  const value = useMemo(
    () => ({ panel, openPanel, closePanel, sidebarCollapsed, toggleSidebar }),
    [panel, openPanel, closePanel, sidebarCollapsed, toggleSidebar],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) throw new Error("useShell precisa estar dentro de <ShellProvider>");
  return context;
}
