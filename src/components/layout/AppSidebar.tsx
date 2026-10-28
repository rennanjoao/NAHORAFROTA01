import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Settings,
  Package,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Star,
  ShieldCheck,
  X,
  Edit2,
  Truck,
  Check,
  Crown,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CyberLogo } from "@/components/ui/CyberLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useIsPlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useFeatureAccess, Feature } from "@/hooks/useFeatureAccess";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Feature gating per module path
const MODULE_FEATURE_MAP: Record<string, Feature> = {
  "/settlement": "financial_dashboard",
  "/reports": "reports",
};

const allModules = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: MapPin, label: "Áreas de Alerta", path: "/routes" },
  { icon: Users, label: "Motoristas", path: "/drivers" },
  { icon: Truck, label: "Veículos da Casa", path: "/vehicles" },
  { icon: Package, label: "Entregas", path: "/deliveries" },
  { icon: Wallet, label: "Acerto / Financeiro", path: "/settlement" },
  { icon: BarChart3, label: "Relatórios", path: "/reports" },
];

const bottomItems = [
  { icon: ShieldCheck, label: "Área Administrativa", path: "/admin" },
  { icon: Settings, label: "Configurações", path: "/settings" },
  { icon: Crown, label: "Painel Master", path: "/master", masterOnly: true },
];

const FAVORITES_STORAGE_KEY = "na-hora-favorites";

const getDefaultFavorites = () => [
  { icon: Package, label: "Entregas", path: "/deliveries" },
  { icon: Wallet, label: "Financeiro", path: "/settlement" },
];

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function AppSidebar({ 
  mobileOpen, 
  onMobileClose,
  collapsed: externalCollapsed,
  onCollapsedChange 
}: AppSidebarProps) {
  const { profile, roles, isAdmin } = useAuth();
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const { checkFeatureAccess, isLoading: planAccessLoading } = useFeatureAccess();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = externalCollapsed ?? internalCollapsed;
  
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((fav: { path: string; label: string }) => {
          const module = allModules.find(m => m.path === fav.path);
          return module || { ...fav, icon: Package };
        });
      } catch {
        return getDefaultFavorites();
      }
    }
    return getDefaultFavorites();
  });
  
  const [isEditingFavorites, setIsEditingFavorites] = useState(false);
  const [tempFavorites, setTempFavorites] = useState<string[]>([]);
  const location = useLocation();
  const getModuleAccess = (path: string) => {
    const featureKey = MODULE_FEATURE_MAP[path];
    if (!featureKey) return { allowed: true, upgradePlanLabel: "" };
    if (planAccessLoading) return { allowed: false, upgradePlanLabel: "" };
    return checkFeatureAccess(featureKey);
  };
  const visibleFavorites = favorites.filter((item) => getModuleAccess(item.path).allowed);

  useEffect(() => {
    const toSave = favorites.map((f: { path: string; label: string }) => ({ path: f.path, label: f.label }));
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(toSave));
  }, [favorites]);

  const handleCollapse = () => {
    const newValue = !collapsed;
    if (onCollapsedChange) {
      onCollapsedChange(newValue);
    } else {
      setInternalCollapsed(newValue);
    }
  };

  const openEditFavorites = () => {
    setTempFavorites(favorites.map((f: { path: string }) => f.path));
    setIsEditingFavorites(true);
  };

  const saveFavorites = () => {
    const newFavorites = tempFavorites.map(path => {
      const module = allModules.find(m => m.path === path);
      return module || { icon: Package, label: path, path };
    });
    setFavorites(newFavorites);
    setIsEditingFavorites(false);
    toast({
      title: "✅ Favoritos Atualizados",
      description: "Seus favoritos foram salvos com sucesso.",
    });
  };

  const toggleFavorite = (path: string) => {
    setTempFavorites(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-64",
          // Mobile: hidden by default, shown when mobileOpen
          "max-md:-translate-x-full max-md:w-64",
          mobileOpen && "max-md:translate-x-0"
        )}
      >
        {/* Logo - Cyber Branding Block */}
        <div className="relative flex flex-col items-center justify-center py-6 px-3">
          <CyberLogo collapsed={collapsed} />
          
          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden absolute top-2 right-2 text-sidebar-foreground hover:text-white"
            onClick={onMobileClose}
          >
            <X className="h-5 w-5" />
          </Button>
          
          {/* Neon divider line */}
          <div className="absolute bottom-0 left-0 w-full h-[1px] neon-divider" />
        </div>

        {/* Toggle button - desktop only */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCollapse}
          className="absolute -right-3 top-20 z-50 h-6 w-6 rounded-full border border-border bg-card hover:bg-muted text-foreground hidden md:flex"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>

        {/* Favorites Section */}
        {!collapsed && visibleFavorites.length > 0 && (
          <div className="px-3 pt-4 pb-2">
            <div className="flex items-center justify-between px-3 mb-2">
              <div className="flex items-center gap-2">
                <Star className="h-3 w-3 text-yellow-500" />
                <span className="text-xs font-medium text-sidebar-foreground uppercase tracking-wide">
                  Favoritos
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-sidebar-foreground hover:text-white"
                onClick={openEditFavorites}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {visibleFavorites.map((item: { path: string; label: string; icon: React.ComponentType<{ className?: string }> }) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={`fav-${item.path}`}
                    to={item.path}
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}

        {/* Divider */}
        {!collapsed && visibleFavorites.length > 0 && (
          <div className="px-6 py-2">
            <div className="border-t border-sidebar-border" />
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 mb-2">
              <span className="text-xs font-medium text-sidebar-foreground uppercase tracking-wide">
                Módulos
              </span>
            </div>
          )}
          {allModules.map((item) => {
            const isActive = location.pathname === item.path;
            const access = getModuleAccess(item.path);
            const isLocked = !access.allowed;
            if (isLocked) return null;

            const link = (
              <NavLink
                key={item.path}
                to={isLocked ? "#" : item.path}
                onClick={(e) => {
                  if (isLocked) {
                    e.preventDefault();
                    return;
                  }
                  onMobileClose?.();
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isLocked
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />}
                  </>
                )}
              </NavLink>
            );

            if (isLocked && !collapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="text-xs">Disponível no Plano {access.upgradePlanLabel}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return link;
          })}
        </nav>

        {/* Bottom items */}
        <div className="border-t border-sidebar-border px-3 py-4 space-y-1">
          {bottomItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isAdminLink = item.path === "/admin";
            const isMasterLink = (item as any).masterOnly;
            
            // Hide admin link from non-admins
            if (isAdminLink && !isAdmin()) return null;
            // Hide master link from non-platform-admins
            if (isMasterLink && !isPlatformAdmin) return null;
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isMasterLink
                    ? "text-amber-400 hover:bg-sidebar-accent hover:text-amber-300"
                    : isAdminLink
                    ? "text-yellow-400 hover:bg-sidebar-accent hover:text-yellow-300"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
                <span className="text-sm font-semibold text-primary-foreground">
                  {profile?.name
                    ? profile.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "U"}
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-white">
                  {profile?.name || "Usuário"}
                </p>
                <p className="truncate text-xs text-sidebar-foreground">
                  {roles.includes("admin")
                    ? "Administrador"
                    : roles.includes("fleet_manager")
                    ? "Gestor de Frota"
                    : roles.includes("dispatcher")
                    ? "Despachante"
                    : "Visualizador"}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Edit Favorites Dialog */}
      <Dialog open={isEditingFavorites} onOpenChange={setIsEditingFavorites}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Editar Favoritos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione os módulos que deseja fixar como favoritos para acesso rápido.
            </p>
            <div className="space-y-3">
              {allModules.filter((module) => getModuleAccess(module.path).allowed).map((module) => (
                <div key={module.path} className="flex items-center gap-3">
                  <Checkbox
                    id={module.path}
                    checked={tempFavorites.includes(module.path)}
                    onCheckedChange={() => toggleFavorite(module.path)}
                  />
                  <Label 
                    htmlFor={module.path} 
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <module.icon className="h-4 w-4" />
                    {module.label}
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setIsEditingFavorites(false)}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1 gap-2"
                onClick={saveFavorites}
              >
                <Check className="h-4 w-4" />
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
