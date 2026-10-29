import { useEffect, type ReactNode } from "react";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";
import { applyPreferences, PREFERENCES_STORAGE_KEY, readPreferences } from "@/lib/preferences";

/** Sem tema escolhido, o site e claro (o index.html ja faz isso antes da pintura; aqui garante na navegacao interna). */
function useSiteLightDefault() {
  useEffect(() => {
    let chosen = false;
    try {
      chosen = !!localStorage.getItem(PREFERENCES_STORAGE_KEY);
    } catch {
      chosen = false;
    }
    if (chosen) return;
    const root = document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", "#F9FAFB"));
    return () => applyPreferences(readPreferences());
  }, []);
}

export function SiteLayout({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  useSiteLightDefault();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <Nav />
      <main id="conteudo" className="flex-1">{children}</main>
      {footer && <Footer />}
    </div>
  );
}
