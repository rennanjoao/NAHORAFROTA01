import { Monitor, Moon, Sun } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/preferences";
import { usePreferences } from "./PreferencesProvider";

const clickOrigin = (event: MouseEvent<HTMLElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

/** Um clique alterna claro/escuro. Fica no topo da tela. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = usePreferences();
  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Mudar para o tema claro" : "Mudar para o tema escuro";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative text-muted-foreground hover:text-foreground", className)}
          onClick={(event) => setTheme(isDark ? "light" : "dark", clickOrigin(event))}
          aria-label={label}
        >
          <Sun
            className={cn(
              "absolute transition-all duration-slow ease-out",
              isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
            )}
            aria-hidden="true"
          />
          <Moon
            className={cn(
              "absolute transition-all duration-slow ease-out",
              isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
            )}
            aria-hidden="true"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Automático", icon: Monitor },
];

/** Escolha completa (claro, escuro, automatico) para menus e Configuracoes.
 *  size="lg": botoes de 48px (app do motorista, toque com luva). */
export function ThemeSegmented({ className, size = "default" }: { className?: string; size?: "default" | "lg" }) {
  const { theme, setTheme } = usePreferences();

  return (
    <div role="radiogroup" aria-label="Tema" className={cn("grid grid-cols-3 gap-1 rounded-lg bg-muted p-1", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={(event) => setTheme(value, clickOrigin(event))}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 font-medium transition-all duration ease-out",
              size === "lg" ? "min-h-12 text-sm" : "min-h-9 text-xs",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
