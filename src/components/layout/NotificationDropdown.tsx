import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useOperationalAlerts, OperationalAlert } from "@/hooks/useOperationalAlerts";

const severityColors: Record<OperationalAlert["severity"], string> = {
  critical: "border-l-destructive",
  high: "border-l-warning",
  medium: "border-l-warning/60",
};

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Agora";
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  return `${diffDays}d atrás`;
}

export function NotificationDropdown() {
  const navigate = useNavigate();
  const { alerts, unreadCount, isUnread, markAsRead, markAllAsRead, enabled } = useOperationalAlerts();
  const [isOpen, setIsOpen] = useState(false);

  if (!enabled) return null;

  const openAlert = (alert: OperationalAlert) => {
    markAsRead(alert.id);
    setIsOpen(false);
    navigate(alert.href);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label={unreadCount > 0 ? `${unreadCount} alerta(s) não lido(s)` : "Alertas"}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex h-[1.125rem] min-w-[1.125rem] animate-pop-in items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-bold leading-none text-destructive-foreground ring-2 ring-background"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0" sideOffset={8}>
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 text-foreground">
          <div>
            <span className="block text-sm font-semibold">Alertas</span>
            <span className="block text-xs font-normal text-muted-foreground">Ocorrências das últimas 48 horas</span>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                markAllAsRead();
              }}
            >
              Marcar todas lidas
            </Button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <div className="max-h-[min(60vh,360px)] overflow-y-auto overscroll-contain">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/10 text-success">
                <Bell className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-foreground">Tudo tranquilo</p>
              <p className="text-xs text-muted-foreground">Nenhuma ocorrência nas últimas 48 horas.</p>
            </div>
          ) : (
            <div className="p-1">
              {alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => openAlert(alert)}
                  className={cn(
                    "relative mb-1 flex w-full gap-3 rounded-lg border-l-[3px] p-3 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    severityColors[alert.severity],
                    isUnread(alert) && "bg-primary/5",
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {alert.kind === "vehicle" ? (
                      <Truck className="h-4 w-4 text-destructive" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm font-medium leading-tight", isUnread(alert) && "text-foreground")}>
                        {alert.title}
                      </p>
                      {isUnread(alert) && <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-1" />}
                    </div>
                    {alert.message && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.message}</p>}
                    <p className="mt-1 text-[0.6875rem] text-muted-foreground">{formatTimeAgo(alert.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        <div className="p-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setIsOpen(false);
              navigate("/deliveries?status=occurrence");
            }}
          >
            Ver entregas com ocorrência
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
