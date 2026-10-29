import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useNavigation } from "@/hooks/useNavigation";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import { BillingReminderDialog } from "./BillingReminderDialog";
import { CommandPalette } from "./CommandPalette";
import { HelpSheet, ShortcutsDialog } from "./HelpPanels";
import { MobileBottomNav, MobileMoreSheet } from "./MobileNav";
import { ShellProvider, useShell } from "./ShellContext";
import { TopBar } from "./TopBar";

/**
 * Estrutura fixa do painel (rota-pai em App.tsx): menu lateral, barra do topo,
 * navegacao do celular, busca, ajuda. So o conteudo (<Outlet />) troca entre
 * telas, com animacao de entrada.
 */
export function AppShell() {
  return (
    <ShellProvider>
      <ShellLayout />
    </ShellProvider>
  );
}

function ShellLayout() {
  const { sidebarCollapsed } = useShell();
  const { current } = useNavigation();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const [announcement, setAnnouncement] = useState("");

  // Titulo da aba, aviso para leitor de tela e foco no conteudo a cada tela nova.
  useEffect(() => {
    document.title = current ? `${current.label} · Na Hora Frota` : "Na Hora Frota";
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setAnnouncement(`Tela ${current?.label ?? ""} aberta`);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    mainRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>

      <AppSidebar />

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-slow ease-out",
          sidebarCollapsed ? "md:pl-[var(--sidebar-width-collapsed)]" : "md:pl-[var(--sidebar-width)]",
        )}
      >
        <TopBar />
        <main
          id="conteudo"
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pt-5 outline-none sm:px-6 md:pb-12 md:pt-8 lg:px-8 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+1.5rem)]"
        >
          <div key={location.pathname} className="page-enter mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileBottomNav />
      <MobileMoreSheet />
      <CommandPalette />
      <HelpSheet />
      <ShortcutsDialog />
      <BillingReminderDialog />

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
