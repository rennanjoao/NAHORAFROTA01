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
    bgColor: "bg-slate-100 dark:bg-slate-800",
    iconBg: "bg-slate-200 dark:bg-slate-700",
    iconColor: "text-slate-600 dark:text-slate-300",
    activeRing: "ring-slate-400",
    valueBg: "bg-slate-500",
  },
  {
    key: "in_transit" as const,
    label: "Em Rota",
    icon: Truck,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
    iconColor: "text-blue-600 dark:text-blue-400",
    activeRing: "ring-blue-400",
    valueBg: "bg-blue-500",
  },
  {
    key: "delivered" as const,
    label: "Entregue",
    icon: CheckCircle2,
    bgColor: "bg-green-50 dark:bg-green-950/30",
    iconBg: "bg-green-100 dark:bg-green-900/50",
    iconColor: "text-green-600 dark:text-green-400",
    activeRing: "ring-green-400",
    valueBg: "bg-green-500",
  },
  {
    key: "occurrence" as const,
    label: "Ocorrência",
    icon: AlertTriangle,
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    iconBg: "bg-orange-100 dark:bg-orange-900/50",
    iconColor: "text-orange-600 dark:text-orange-400",
    activeRing: "ring-orange-400",
    valueBg: "bg-orange-500",
  },
  {
    key: "returned" as const,
    label: "Devolvido",
    icon: Warehouse,
    bgColor: "bg-slate-200 dark:bg-slate-700",
    iconBg: "bg-slate-300 dark:bg-slate-600",
    iconColor: "text-slate-700 dark:text-slate-200",
    activeRing: "ring-slate-500",
    valueBg: "bg-slate-600",
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
                "text-2xl font-bold text-white px-3 py-1 rounded-full min-w-[3rem] text-center",
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
