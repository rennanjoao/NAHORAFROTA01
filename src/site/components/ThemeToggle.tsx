import { Moon, Sun } from "lucide-react";
import type { MouseEvent } from "react";
import { usePreferences } from "@/components/theme/PreferencesProvider";
import { cn } from "@/lib/utils";

/** Alterna claro/escuro no site. Mesma preferencia do painel (nhf-prefs). */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = usePreferences();
  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Mudar para modo claro" : "Mudar para modo escuro";
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTheme(isDark ? "light" : "dark", { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded border border-border text-foreground/80 transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {isDark ? <Sun aria-hidden="true" className="h-[18px] w-[18px]" /> : <Moon aria-hidden="true" className="h-[18px] w-[18px]" />}
    </button>
  );
}
