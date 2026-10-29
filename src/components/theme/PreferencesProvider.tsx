import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  applyPreferences,
  prefersReducedMotion,
  readPreferences,
  resolveTheme,
  writePreferences,
  type Preferences,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/preferences";

interface PreferencesContextValue extends Preferences {
  resolvedTheme: ResolvedTheme;
  /** Troca o tema. Com a origem do clique, revela o novo tema em circulo. */
  setTheme: (theme: ThemePreference, origin?: { x: number; y: number }) => void;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(() => readPreferences());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(prefs.theme));

  const commit = useCallback((next: Preferences) => {
    applyPreferences(next);
    writePreferences(next);
    setPrefs(next);
    setResolvedTheme(resolveTheme(next.theme));
  }, []);

  // Garante o estado do <html> (o script do index.html ja aplicou antes da pintura).
  useEffect(() => {
    applyPreferences(prefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Automatico" acompanha o sistema em tempo real.
  useEffect(() => {
    if (prefs.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyPreferences(prefs);
      setResolvedTheme(resolveTheme("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [prefs]);

  // Outra aba mudou as preferencias.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "nhf-prefs") return;
      const next = readPreferences();
      applyPreferences(next);
      setPrefs(next);
      setResolvedTheme(resolveTheme(next.theme));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback<PreferencesContextValue["setTheme"]>(
    (theme, origin) => {
      const next = { ...prefs, theme };
      const doc = document as ViewTransitionDocument;
      const changes = resolveTheme(theme) !== resolveTheme(prefs.theme);
      if (!changes || !doc.startViewTransition || prefersReducedMotion(prefs)) {
        commit(next);
        return;
      }

      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? 0;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      const transition = doc.startViewTransition(() => {
        flushSync(() => commit(next));
      });
      transition.ready
        .then(() => {
          document.documentElement.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 480, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
          );
        })
        .catch(() => undefined);
    },
    [commit, prefs],
  );

  const setPreference = useCallback<PreferencesContextValue["setPreference"]>(
    (key, value) => commit({ ...prefs, [key]: value }),
    [commit, prefs],
  );

  const reset = useCallback(() => {
    commit({ theme: prefs.theme, textSize: "normal", motion: "system", contrast: "normal" });
  }, [commit, prefs.theme]);

  const value = useMemo(
    () => ({ ...prefs, resolvedTheme, setTheme, setPreference, reset }),
    [prefs, resolvedTheme, setTheme, setPreference, reset],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

/** Tema efetivo sem exigir o provider (cai na classe do <html>). */
export function useResolvedTheme(): ResolvedTheme {
  const context = useContext(PreferencesContext);
  if (context) return context.resolvedTheme;
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences precisa estar dentro de <PreferencesProvider>");
  return context;
}
