import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigation } from "@/hooks/useNavigation";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { useShell } from "./ShellContext";
import { UserMenu } from "./UserMenu";

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.path}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium outline-none transition-colors duration-fast",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        collapsed && "justify-center px-0",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
      )}
    >
      {/* Indicador da tela atual: barrinha verde que desliza para dentro. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand transition-all duration ease-out",
          active ? "opacity-100" : "h-0 opacity-0",
        )}
      />
      <Icon
        aria-hidden="true"
        className={cn(
          "h-[1.125rem] w-[1.125rem] shrink-0 transition-colors duration-fast",
          active ? "text-primary" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground",
        )}
      />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Menu lateral (tablet e computador). No celular a navegacao fica embaixo. */
export function AppSidebar() {
  const { groups, isActive } = useNavigation();
  const { sidebarCollapsed: collapsed, toggleSidebar } = useShell();
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Abrir menu lateral" : "Recolher menu lateral";

  return (
    <aside
      aria-label="Menu principal"
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-slow ease-out md:flex",
        collapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]",
      )}
    >
      <div className={cn("flex h-topbar shrink-0 items-center", collapsed ? "justify-center px-2" : "justify-between pl-5 pr-2")}>
        <NavLink
          to="/"
          // Area de toque de 40px tambem com o menu recolhido (so o simbolo).
          className={cn(
            "inline-flex h-10 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            collapsed && "w-10 justify-center",
          )}
          aria-label="Na Hora Frota, ir para o início"
        >
          {collapsed ? (
            <BrandLogo arrangement="simbolo" className="w-8" />
          ) : (
            <BrandLogo arrangement="horizontal" className="w-[132px]" />
          )}
        </NavLink>
        {!collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={toggleLabel}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <ToggleIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {toggleLabel} <span className="kbd ml-1 border-background/20 bg-background/10 text-background">[</span>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <nav aria-label="Telas do sistema" className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-2">
        {groups.map((group, index) => (
          <div key={group.id} className={cn(index > 0 && "mt-5")}>
            {collapsed ? (
              index > 0 && <div aria-hidden="true" className="mx-2 mb-3 h-px bg-sidebar-border" />
            ) : (
              <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/80">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.path}>
                  <SidebarLink item={item} active={isActive(item)} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label={toggleLabel}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                  <ToggleIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{toggleLabel}</TooltipContent>
            </Tooltip>
            <UserMenu variant="avatar" side="right" align="end" />
          </div>
        ) : (
          <UserMenu variant="full" side="top" align="start" />
        )}
      </div>
    </aside>
  );
}
