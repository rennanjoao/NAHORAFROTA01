import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronRight, CircleHelp, Search } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigation } from "@/hooks/useNavigation";
import { isMac } from "@/lib/platform";
import { NotificationDropdown } from "./NotificationDropdown";
import { useShell } from "./ShellContext";
import { UserMenu } from "./UserMenu";

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function TopBar() {
  const { current, currentGroup } = useNavigation();
  const { openPanel } = useShell();
  const online = useOnline();

  return (
    <header className="surface-glass sticky top-0 z-30 flex h-topbar items-center gap-2 border-b px-3 sm:px-4 md:gap-3 md:px-6">
      {/* Celular: simbolo + nome da tela. Computador: caminho "Grupo > Tela". */}
      <NavLink
        to="/"
        className="-ml-1.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        aria-label="Ir para o início"
      >
        <BrandLogo arrangement="simbolo" className="w-7" />
      </NavLink>
      <p className="min-w-0 truncate font-heading text-base font-semibold md:hidden">{current?.label ?? "Na Hora Frota"}</p>

      <nav aria-label="Você está em" className="hidden min-w-0 md:block">
        <ol className="flex items-center gap-1.5 text-sm">
          {currentGroup && current?.path !== "/" && (
            <>
              <li className="text-muted-foreground">{currentGroup.label}</li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
              </li>
            </>
          )}
          <li aria-current="page" className="truncate font-medium text-foreground">
            {current?.label ?? "Na Hora Frota"}
          </li>
        </ol>
      </nav>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => openPanel("palette")}
        className="group hidden h-9 w-full max-w-[22rem] items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors duration-fast hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
        aria-label="Buscar telas, motoristas, placas e notas"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left">Buscar ou ir para…</span>
        <span className="kbd" aria-hidden="true">{isMac() ? "⌘ K" : "Ctrl K"}</span>
      </button>

      <div className="flex items-center gap-0.5 sm:gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground sm:hidden"
          onClick={() => openPanel("palette")}
          aria-label="Buscar"
        >
          <Search className="h-5 w-5" />
        </Button>

        {online ? (
          <span className="nhf-live mx-1 hidden xl:inline-flex" title="Os dados chegam em tempo real">
            Ao vivo
          </span>
        ) : (
          <span className="nhf-live nhf-live--off mx-1" role="status">
            Sem internet
          </span>
        )}

        <ThemeToggle className="hidden md:inline-flex" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
              onClick={() => openPanel("help")}
              aria-label="Ajuda desta tela"
            >
              <CircleHelp className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ajuda desta tela</TooltipContent>
        </Tooltip>

        <NotificationDropdown />

        <div className="ml-1 md:hidden">
          <UserMenu variant="avatar" />
        </div>
      </div>
    </header>
  );
}
