import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Navigation, MapPin, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ActivityLog {
  id: string;
  driver_id: string;
  manifest_id: string | null;
  activity_type: "displacement_start" | "arrival" | "delivery_complete" | "occurrence";
  client_name: string | null;
  occurrence_type: string | null;
  notes: string | null;
  created_at: string;
}

interface DriverActivityFeedProps {
  driverId: string;
  maxHeight?: string;
}

const activityConfig = {
  displacement_start: {
    icon: Navigation,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    label: "Deslocamento",
  },
  arrival: {
    icon: MapPin,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    label: "Chegada",
  },
  delivery_complete: {
    icon: CheckCircle2,
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
    label: "Entrega",
  },
  occurrence: {
    icon: AlertTriangle,
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/30",
    label: "Ocorrência",
  },
};

function formatActivityMessage(log: ActivityLog): string {
  const time = format(new Date(log.created_at), "HH:mm", { locale: ptBR });
  
  switch (log.activity_type) {
    case "displacement_start":
      return `Iniciou deslocamento para ${log.client_name || "cliente"} às ${time}.`;
    case "arrival":
      return `Chegou ao destino: ${log.client_name || "cliente"} às ${time}.`;
    case "delivery_complete":
      const occType = log.occurrence_type ? `[${log.occurrence_type}]` : "";
      return `Finalizou entrega ${occType} no Cliente ${log.client_name || ""}.`;
    case "occurrence":
      return `Registrou ocorrência: ${log.occurrence_type || "N/A"} - ${log.client_name || ""}.`;
    default:
      return "Atividade registrada.";
  }
}

export function DriverActivityFeed({ driverId, maxHeight = "200px" }: DriverActivityFeedProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch initial logs
    const fetchLogs = async () => {
      setIsLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("driver_activity_logs")
        .select("*")
        .eq("driver_id", driverId)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        setLogs(data as ActivityLog[]);
      }
      setIsLoading(false);
    };

    fetchLogs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(uniqueChannelName(`driver-activity-${driverId}`))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "driver_activity_logs",
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const newLog = payload.new as ActivityLog;
          setLogs((prev) => [newLog, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Clock className="h-4 w-4 mr-2 animate-spin" />
        <span className="text-sm">Carregando atividades...</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Nenhuma atividade registrada hoje</p>
      </div>
    );
  }

  return (
    <ScrollArea className="pr-2" style={{ maxHeight }}>
      <div className="relative pl-6 space-y-3">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
        
        {logs.map((log, index) => {
          const config = activityConfig[log.activity_type];
          const Icon = config.icon;
          const time = format(new Date(log.created_at), "HH:mm");
          
          return (
            <div key={log.id} className="relative flex gap-3 items-start">
              {/* Timeline dot */}
              <div
                className={cn(
                  "absolute -left-6 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center",
                  config.bgColor,
                  "border",
                  config.borderColor
                )}
              >
                <Icon className={cn("h-3 w-3", config.color)} />
              </div>
              
              {/* Content */}
              <div className={cn(
                "flex-1 rounded-lg p-2.5 border",
                config.bgColor,
                config.borderColor
              )}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-xs font-semibold uppercase tracking-wide", config.color)}>
                    {config.label}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{time}</span>
                </div>
                <p className="text-sm text-foreground leading-snug">
                  {formatActivityMessage(log)}
                </p>
                {log.notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    {log.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
