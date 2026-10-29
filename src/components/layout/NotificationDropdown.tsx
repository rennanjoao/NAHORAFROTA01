import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useOperationalAlerts, OperationalAlert } from "@/hooks/useOperationalAlerts";

const severityColors: Record<OperationalAlert["severity"], string> = {
  critical: "border-l-destructive bg-destructive/5",
  high: "border-l-warning bg-warning/5",
  medium: "border-l-orange-500 bg-warning/5",
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
            <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive p-0 text-xs flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 bg-popover border border-border shadow-lg" sideOffset={8}>
        <DropdownMenuLabel className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="font-semibold">Ocorrências (48h)</span>
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

        <ScrollArea className="h-[320px]">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma ocorrência nas últimas 48h</p>
            </div>
          ) : (
            <div className="p-1">
              {alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => openAlert(alert)}
                  className={cn(
                    "relative flex w-full gap-3 p-3 rounded-lg border-l-4 mb-2 text-left transition-colors hover:bg-muted/50",
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
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{formatTimeAgo(alert.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

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
