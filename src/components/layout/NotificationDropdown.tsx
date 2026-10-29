import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  if (diffMins < 60) return `Há ${diffMins} min`;
  if (diffHours < 24) return `Há ${diffHours} h`;
  return diffDays === 1 ? "Há 1 dia" : `Há ${diffDays} dias`;
}

export function NotificationDropdown() {
  const navigate = useNavigate();
  const { alerts, unreadCount, isUnread, markAsRead, markAllAsRead, enabled } = useOperationalAlerts();
  const [isOpen, setIsOpen] = useState(false);
  // Navega depois que o menu fecha e devolve o foco ao sino; assim a tela nova
  // recebe o foco (antes o sino roubava o foco de volta).
  const pending = useRef<string | null>(null);

  if (!enabled) return null;

  const openAlert = (alert: OperationalAlert) => {
    markAsRead(alert.id);
    pending.current = alert.href;
  };

  const unreadLabel =
    unreadCount === 0 ? "Alertas" : unreadCount === 1 ? "Alertas: 1 não lido" : `Alertas: ${unreadCount} não lidos`;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground" aria-label={unreadLabel}>
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex h-[1.125rem] min-w-[1.125rem] animate-pop-in items-center justify-center rounded-full bg-destructive px-1 text-[0.6875rem] font-bold leading-none text-destructive-foreground ring-2 ring-background"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[min(22rem,calc(100vw-1.5rem))] p-0"
        sideOffset={8}
        aria-label="Alertas"
        onCloseAutoFocus={() => {
          const href = pending.current;
          pending.current = null;
          if (href) window.setTimeout(() => navigate(href), 0);
        }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <DropdownMenuLabel className="p-0 text-foreground">
            <span className="block text-sm font-semibold">Alertas</span>
            <span className="block text-xs font-normal text-muted-foreground">Ocorrências das últimas 48 horas</span>
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <DropdownMenuItem
              className="h-9 shrink-0 px-2.5 text-xs font-medium text-muted-foreground focus:text-foreground"
              onSelect={(event) => {
                // Fica aberto: a pessoa ve os alertas marcados.
                event.preventDefault();
                markAllAsRead();
              }}
            >
              Marcar todos como lidos
            </DropdownMenuItem>
          )}
        </div>

        <DropdownMenuSeparator className="mx-0 my-0" />

        <div className="max-h-[min(60vh,360px)] overflow-y-auto overscroll-contain">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/10 text-success">
                <Bell className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-foreground">Tudo tranquilo</p>
              <p className="text-xs text-muted-foreground">Nenhuma ocorrência nas últimas 48 horas.</p>
            </div>
          ) : (
            <div className="p-1">
              {alerts.map((alert) => {
                const unread = isUnread(alert);
                return (
                  <DropdownMenuItem
                    key={alert.id}
                    onSelect={() => openAlert(alert)}
                    className={cn(
                      "mb-1 items-start gap-3 rounded-lg border-l-[3px] p-3 last:mb-0",
                      severityColors[alert.severity],
                      unread && "bg-primary/5",
                    )}
                  >
                    <span className="mt-0.5 shrink-0" aria-hidden="true">
                      {alert.kind === "vehicle" ? (
                        <Truck className="h-4 w-4 text-destructive" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={cn("text-sm font-medium leading-tight", unread && "text-foreground")}>{alert.title}</span>
                        {unread && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary">
                            <span className="sr-only">Não lido</span>
                          </span>
                        )}
                      </span>
                      {alert.message && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{alert.message}</span>}
                      <span className="mt-1 block text-xs text-muted-foreground">{formatTimeAgo(alert.createdAt)}</span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="mx-0 my-0" />

        <div className="p-2">
          <DropdownMenuItem
            onSelect={() => {
              pending.current = "/deliveries?status=occurrence";
            }}
            className="h-9 justify-center rounded-md border border-input bg-background text-xs font-medium shadow-xs"
          >
            Ver entregas com ocorrência
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
