import { useEffect, useState } from "react";
import { Search, RefreshCw, Menu, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotificationDropdown } from "./NotificationDropdown";
import { GlobalSearch } from "./GlobalSearch";
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

interface TopBarProps {
  onMenuToggle?: () => void;
  showMenuButton?: boolean;
}

export function TopBar({ onMenuToggle, showMenuButton }: TopBarProps) {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  // O selo "Sistema Online" era fixo; agora acompanha a conexao do aparelho.
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

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
    if (roles.includes("fleet_manager")) return "Gestor de Frota";
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
        <GlobalSearch className="hidden sm:block w-48 md:w-80" />
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden text-muted-foreground"
          onClick={() => setMobileSearchOpen(true)}
          aria-label="Buscar"
        >
          <Search className="h-5 w-5" />
        </Button>
        <Dialog open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
          <DialogContent className="top-4 translate-y-0 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Buscar</DialogTitle>
            </DialogHeader>
            <GlobalSearch autoFocus onNavigate={() => setMobileSearchOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Marcador de hora do manual: o ponto so pulsa quando esta online. */}
        {isOnline ? (
          <span className="nhf-live hidden md:inline-flex">Sistema online</span>
        ) : (
          <span className="nhf-live nhf-live--off">Sem conexão</span>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => window.location.reload()}
          title="Atualizar dados"
          aria-label="Atualizar dados"
        >
          <RefreshCw className="h-5 w-5" />
        </Button>

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
