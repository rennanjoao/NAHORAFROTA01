import { useState, useEffect } from "react";
import { Bell, AlertTriangle, Truck, Clock, CheckCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, FleetAlert } from "@/stores/notificationStore";

const alertIcons: Record<string, React.ReactNode> = {
  breakdown: <Truck className="h-4 w-4 text-destructive" />,
  delay: <Clock className="h-4 w-4 text-warning" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" />,
  info: <Info className="h-4 w-4 text-info" />,
  success: <CheckCircle className="h-4 w-4 text-success" />,
};

const severityColors: Record<string, string> = {
  critical: "border-l-destructive bg-destructive/5",
  high: "border-l-warning bg-warning/5",
  medium: "border-l-orange-500 bg-orange-500/5",
  low: "border-l-muted-foreground bg-muted/30",
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return "Agora";
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  return `${diffDays}d atrás`;
}

export function NotificationDropdown() {
  const { recentAlerts, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive p-0 text-xs flex items-center justify-center animate-pulse"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-80 bg-popover border border-border shadow-lg z-50"
        sideOffset={8}
      >
        <DropdownMenuLabel className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="font-semibold">Alertas do Sistema</span>
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
          {recentAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">Nenhum alerta recente</p>
            </div>
          ) : (
            <div className="p-1">
              {recentAlerts.map((alert) => (
                <AlertItem 
                  key={alert.id} 
                  alert={alert} 
                  onMarkRead={() => markAsRead(alert.id)}
                />
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
            onClick={() => setIsOpen(false)}
          >
            Ver todos os alertas
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface AlertItemProps {
  alert: FleetAlert;
  onMarkRead: () => void;
}

function AlertItem({ alert, onMarkRead }: AlertItemProps) {
  return (
    <div
      className={cn(
        "relative flex gap-3 p-3 rounded-lg border-l-4 mb-2 cursor-pointer transition-colors hover:bg-muted/50",
        severityColors[alert.severity],
        !alert.read && "bg-primary/5"
      )}
      onClick={onMarkRead}
    >
      <div className="flex-shrink-0 mt-0.5">
        {alertIcons[alert.type]}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            "text-sm font-medium truncate",
            !alert.read && "text-foreground",
            alert.read && "text-muted-foreground"
          )}>
            {alert.title}
          </p>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {formatTimeAgo(alert.createdAt)}
          </span>
        </div>
        
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {alert.message}
        </p>
      </div>
      
      {!alert.read && (
        <div className="absolute right-2 top-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
}
