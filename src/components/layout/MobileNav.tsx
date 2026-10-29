import { NavLink, useNavigate } from "react-router-dom";
import { CircleHelp, LayoutGrid, LogOut, Search } from "lucide-react";
import { MOBILE_PRIMARY_PATHS } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigation } from "@/hooks/useNavigation";
import { ThemeSegmented } from "@/components/theme/ThemeToggle";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { roleLabel } from "@/lib/user";
import { cn } from "@/lib/utils";
import { useShell } from "./ShellContext";
import { UserAvatar } from "./UserMenu";

/** Barra inferior do celular: as 4 telas mais usadas + "Mais". */
export function MobileBottomNav() {
  const { items, isActive, current } = useNavigation();
  const { panel, openPanel } = useShell();
  const primary = MOBILE_PRIMARY_PATHS.map((path) => items.find((item) => item.path === path)).filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
  const moreActive = panel === "more" || (!!current && !primary.some((item) => item.path === current.path));

  const tabClass = (active: boolean) =>
    cn(
      "group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg pt-2 pb-1.5 text-[0.6875rem] font-medium outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring",
      active ? "text-foreground" : "text-muted-foreground",
    );

  const pill = (active: boolean) =>
    cn(
      "flex h-8 w-14 items-center justify-center rounded-full transition-all duration ease-out",
      active ? "bg-primary/15 text-primary" : "group-active:bg-accent",
    );

  return (
    <nav
      aria-label="Navegação principal"
      className="surface-glass fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-bottom-nav max-w-lg items-stretch px-1 min-[360px]:px-2">
        {primary.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <li key={item.path} className="flex min-w-0 flex-1">
              <NavLink to={item.path} className={tabClass(active)} aria-current={active ? "page" : undefined}>
                <span className={pill(active)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {/* Sem respiro lateral: "Motoristas" cabe inteiro em 320px. */}
                <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
              </NavLink>
            </li>
          );
        })}
        <li className="flex min-w-0 flex-1">
          <button
            type="button"
            onClick={() => openPanel("more")}
            className={tabClass(moreActive)}
            aria-haspopup="dialog"
            aria-expanded={panel === "more"}
          >
            <span className={pill(moreActive)}>
              <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>Mais</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** Folha "Mais": todas as telas em grade, tema, ajuda e sair. */
export function MobileMoreSheet() {
  const { groups, isActive } = useNavigation();
  const { panel, closePanel, openPanel, restoreFocus } = useShell();
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <Sheet open={panel === "more"} onOpenChange={(open) => !open && closePanel()}>
      <SheetContent side="bottom" onCloseAutoFocus={restoreFocus} className="overflow-y-auto px-4 pt-3">
        <div aria-hidden="true" className="mx-auto -mt-1 mb-1 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
        <SheetHeader className="flex-row items-center gap-3 space-y-0 pr-10">
          <UserAvatar name={profile?.name} className="h-10 w-10" />
          <div className="min-w-0 text-left">
            <SheetTitle className="truncate text-base">{profile?.name || "Usuário"}</SheetTitle>
            <SheetDescription className="truncate">{roleLabel(roles)}</SheetDescription>
          </div>
        </SheetHeader>

        <button
          type="button"
          onClick={() => openPanel("palette")}
          className="mt-4 flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Buscar telas, motoristas, placas, notas…
        </button>

        <div className="mt-5 space-y-5">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`mais-${group.id}`}>
              <h2 id={`mais-${group.id}`} className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.label}
              </h2>
              <ul className="grid grid-cols-3 gap-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        // Escolheu uma tela: o foco vai para o conteudo dela.
                        onClick={() => closePanel({ focusMain: true })}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-full min-h-[5.25rem] flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center text-xs font-medium transition-colors duration-fast active:scale-[0.97]",
                          active ? "border-primary/40 bg-primary/10 text-foreground" : "bg-card text-foreground",
                        )}
                      >
                        <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                        <span className="leading-tight">{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <section aria-labelledby="mais-tema">
            <h2 id="mais-tema" className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Tema
            </h2>
            <ThemeSegmented />
          </section>

          <div className="grid grid-cols-2 gap-2 pb-2">
            <button
              type="button"
              onClick={() => openPanel("help")}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border bg-card text-sm font-medium"
            >
              <CircleHelp className="h-4 w-4" aria-hidden="true" />
              Ajuda
            </button>
            <button
              type="button"
              onClick={async () => {
                closePanel();
                await signOut();
                navigate("/login");
              }}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border bg-card text-sm font-medium text-destructive"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
