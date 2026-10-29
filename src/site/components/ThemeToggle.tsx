import { Moon, Sun } from "lucide-react";
import { usePreferences } from "@/components/theme/PreferencesProvider";
import { cn } from "@/lib/utils";

/** Alterna claro/escuro. Le o tema real do <html> (o site pode estar claro sem escolha salva). */
export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme } = usePreferences();
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const label = isDark ? "Mudar para modo claro" : "Mudar para modo escuro";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 bg-card text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {isDark ? <Sun aria-hidden="true" className="h-[18px] w-[18px]" /> : <Moon aria-hidden="true" className="h-[18px] w-[18px]" />}
    </button>
  );
}
