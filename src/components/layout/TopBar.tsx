import { Search, Menu, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotificationDropdown } from "./NotificationDropdown";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/site/components/ThemeToggle";

interface TopBarProps {
  onMenuToggle?: () => void;
  showMenuButton?: boolean;
}

export function TopBar({ onMenuToggle, showMenuButton }: TopBarProps) {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Você saiu",
      description: "Sessão encerrada com sucesso.",
    });
    navigate("/login");
  };

  const getRoleLabel = (roles: string[]) => {
    if (roles.includes("admin")) return "Administrador";
    if (roles.includes("fleet_manager")) return "Gerente de Frota";
    if (roles.includes("dispatcher")) return "Despachante";
    return "Visualizador";
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b border-border bg-card px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        {showMenuButton && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuToggle}>
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar motorista, veículo, rota..."
            className="w-48 md:w-80 bg-secondary border-0 pl-10"
          />
        </div>
        <Button variant="ghost" size="icon" className="sm:hidden text-muted-foreground">
          <Search className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden md:flex items-center gap-2 rounded-lg bg-success/10 px-3 py-1.5 border border-success/20">
          <div className="status-dot status-dot-success" />
          <span className="text-sm font-medium text-success">Sistema Online</span>
        </div>

        <ThemeToggle className="h-9 w-9 border-0" />

        <NotificationDropdown />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-xs font-semibold text-primary-foreground">
                  {getInitials(profile?.name)}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium">{profile?.name || "Usuário"}</p>
                <p className="text-xs text-muted-foreground">{getRoleLabel(roles)}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{profile?.name || "Usuário"}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {profile?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <User className="mr-2 h-4 w-4" />
              Minha Conta
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
