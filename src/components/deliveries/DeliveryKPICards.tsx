import { Clock, Truck, CheckCircle2, AlertTriangle, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

export type KPIStatusFilter = "all" | "pending" | "in_transit" | "delivered" | "occurrence" | "returned";

interface KPIStats {
  pending: number;
  in_transit: number;
  delivered: number;
  occurrence: number;
  returned: number;
}

interface DeliveryKPICardsProps {
  stats: KPIStats;
  activeFilter: KPIStatusFilter;
  onFilterChange: (filter: KPIStatusFilter) => void;
}

const kpiConfig = [
  {
    key: "pending" as const,
    label: "Pendentes",
    icon: Clock,
    bgColor: "bg-muted",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    activeRing: "ring-border",
    valueBg: "bg-idle",
  },
  {
    key: "in_transit" as const,
    label: "Em Rota",
    icon: Truck,
    bgColor: "bg-info/10",
    iconBg: "bg-info/15",
    iconColor: "text-info",
    activeRing: "ring-info",
    valueBg: "bg-info",
  },
  {
    key: "delivered" as const,
    label: "Entregue",
    icon: CheckCircle2,
    bgColor: "bg-success/10",
    iconBg: "bg-success/15",
    iconColor: "text-success",
    activeRing: "ring-success",
    valueBg: "bg-success",
  },
  {
    key: "occurrence" as const,
    label: "Ocorrência",
    icon: AlertTriangle,
    bgColor: "bg-warning/10",
    iconBg: "bg-warning/15",
    iconColor: "text-warning",
    activeRing: "ring-warning",
    valueBg: "bg-warning",
  },
  {
    key: "returned" as const,
    label: "Devolvido",
    icon: Warehouse,
    bgColor: "bg-muted",
    iconBg: "bg-idle",
    iconColor: "text-muted-foreground",
    activeRing: "ring-border",
    valueBg: "bg-secondary",
  },
];

export function DeliveryKPICards({ stats, activeFilter, onFilterChange }: DeliveryKPICardsProps) {
  const handleClick = (key: KPIStatusFilter) => {
    // Toggle filter: if same filter is clicked, clear it
    onFilterChange(activeFilter === key ? "all" : key);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {kpiConfig.map((config) => {
        const Icon = config.icon;
        const count = stats[config.key] || 0;
        const isActive = activeFilter === config.key;

        return (
          <button
            key={config.key}
            onClick={() => handleClick(config.key)}
            className={cn(
              "relative p-4 rounded-xl transition-all duration-200",
              "hover:scale-[1.02] active:scale-[0.98]",
              "text-left w-full",
              config.bgColor,
              isActive && `ring-2 ring-offset-2 ${config.activeRing} shadow-lg`
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={cn("p-2 rounded-lg", config.iconBg)}>
                <Icon className={cn("h-5 w-5", config.iconColor)} />
              </div>
              <div className={cn(
                "text-2xl font-bold font-data px-3 py-1 rounded-full min-w-[3rem] text-center",
                config.valueBg === "bg-secondary" ? "text-foreground" : "text-nhf-ink",
                config.valueBg
              )}>
                {count}
              </div>
            </div>
            <p className={cn(
              "text-sm font-medium",
              config.iconColor
            )}>
              {config.label}
            </p>
            {isActive && (
              <div className="absolute top-2 right-2">
                <div className={cn("w-2 h-2 rounded-full animate-pulse", config.valueBg)} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
