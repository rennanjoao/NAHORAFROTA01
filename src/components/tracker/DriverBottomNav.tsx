import { House, Settings, TriangleAlert, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DriverTab = "home" | "wallet" | "report" | "settings";

const DRIVER_TABS: { id: DriverTab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Início", icon: House },
  { id: "wallet", label: "Carteira", icon: Wallet },
  { id: "report", label: "Reportar", icon: TriangleAlert },
  { id: "settings", label: "Config", icon: Settings },
];

interface DriverBottomNavProps {
  active: DriverTab;
  onChange: (tab: DriverTab) => void;
}

/**
 * Barra inferior do app do motorista (alcance do polegar). A "pilula" verde
 * desliza ate a aba escolhida; com movimento reduzido ela so troca de lugar.
 */
export function DriverBottomNav({ active, onChange }: DriverBottomNavProps) {
  const activeIndex = Math.max(
    0,
    DRIVER_TABS.findIndex((tab) => tab.id === active),
  );

  return (
    <nav
      aria-label="Menu do app"
      className="surface-glass fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="relative mx-auto grid h-[4.5rem] w-full max-w-2xl grid-cols-4 px-2">
        {/* Indicador da aba ativa (1/4 da largura, desliza com transform). */}
        <li
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-2 flex w-[calc((100%-1rem)/4)] justify-center pt-2 transition-transform duration-slow ease-out"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        >
          <span className="h-9 w-16 rounded-full bg-primary/15" />
        </li>
        {DRIVER_TABS.map((tab) => {
          const Icon = tab.icon;
          const selected = tab.id === active;
          return (
            <li key={tab.id} className="relative flex">
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex w-full flex-col items-center justify-start gap-1 rounded-xl pt-2 text-xs font-semibold outline-none transition-colors duration-fast",
                  "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:scale-[0.97]",
                  selected ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="flex h-9 w-16 items-center justify-center">
                  <Icon
                    className={cn("h-6 w-6 transition-transform duration ease-spring", selected && "scale-110")}
                    strokeWidth={selected ? 2.4 : 2}
                    aria-hidden="true"
                  />
                </span>
                <span className={cn(selected ? "text-foreground" : undefined)}>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
