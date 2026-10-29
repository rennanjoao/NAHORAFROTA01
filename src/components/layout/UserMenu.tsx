import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, HelpCircle, Keyboard, LogOut, Settings, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeMenuRadio } from "@/components/theme/ThemeToggle";
import { toast } from "@/hooks/use-toast";
import { initials, roleLabel } from "@/lib/user";
import { cn } from "@/lib/utils";
import { useShell } from "./ShellContext";

export function UserAvatar({ name, className }: { name?: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

interface UserMenuProps {
  /** "full": nome e papel visiveis (menu lateral aberto). "avatar": so a bolinha. */
  variant?: "full" | "avatar";
  side?: "top" | "bottom" | "right";
  align?: "start" | "end";
}

export function UserMenu({ variant = "avatar", side = "bottom", align = "end" }: UserMenuProps) {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const { openPanel } = useShell();
  const name = profile?.name || "Usuário";
  // A acao roda depois que o menu devolve o foco ao botao: assim a ajuda e os
  // atalhos devolvem o foco para ele ao fechar, e a tela nova recebe o foco.
  const pending = useRef<(() => void) | null>(null);
  const afterClose = (action: () => void) => () => {
    pending.current = action;
  };

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Você saiu", description: "Sessão encerrada." });
    navigate("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex items-center gap-3 rounded-lg text-left outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring",
          variant === "full" ? "w-full p-2 hover:bg-sidebar-accent" : "rounded-full p-0.5 hover:bg-accent",
        )}
        aria-label={`Menu da conta de ${name}`}
      >
        <UserAvatar name={profile?.name} />
        {variant === "full" && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{name}</span>
              <span className="block truncate text-xs text-sidebar-foreground">{roleLabel(roles)}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align={align}
        className="w-64"
        sideOffset={8}
        onCloseAutoFocus={() => {
          const action = pending.current;
          pending.current = null;
          if (action) window.setTimeout(action, 0);
        }}
      >
        <DropdownMenuLabel className="flex items-center gap-3 py-2 text-foreground">
          <UserAvatar name={profile?.name} className="h-9 w-9" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{profile?.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="pb-1 font-medium">Tema</DropdownMenuLabel>
        <ThemeMenuRadio className="mx-1.5 mb-1.5" />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={afterClose(() => navigate("/settings?tab=profile"))}>
          <UserRound />
          Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={afterClose(() => navigate("/settings"))}>
          <Settings />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={afterClose(() => openPanel("help"))}>
          <HelpCircle />
          Ajuda
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={afterClose(() => openPanel("shortcuts"))} className="hidden md:flex">
          <Keyboard />
          Atalhos do teclado
          <span className="kbd ml-auto">?</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
          <LogOut />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
