import { LucideIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
  onClick?: () => void;
  clickable?: boolean;
}

const variantStyles = {
  default: {
    card: "",
    icon: "bg-muted text-muted-foreground",
  },
  success: {
    card: "",
    icon: "bg-success/10 text-success",
  },
  warning: {
    card: "",
    icon: "bg-warning/10 text-warning",
  },
  danger: {
    card: "bg-destructive/5 border-destructive/30",
    icon: "bg-destructive/10 text-destructive",
  },
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
  onClick,
  clickable = false,
}: MetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={cn(
        "metric-card relative overflow-hidden",
        styles.card,
        (clickable || onClick) && "cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform",
        className
      )}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn(
              "mt-2 text-3xl font-bold tracking-tight",
              variant === "danger" ? "text-destructive" : "text-foreground"
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn("rounded-xl p-3", styles.icon)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>

        {trend && (
          <div className="mt-4 flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}
            >
              {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
            </span>
            <span className="text-sm text-muted-foreground">vs. ontem</span>
          </div>
        )}

        {(clickable || onClick) && (
          <div className="mt-3 text-xs text-primary font-medium">
            Clique para ver detalhes →
          </div>
        )}
      </div>
    </div>
  );
}
