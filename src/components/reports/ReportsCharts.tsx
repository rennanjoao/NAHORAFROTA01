import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSLA } from "@/lib/formatSLA";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface SLADataPoint {
  month: string;
  sla: number;
}

interface IssueDataPoint {
  reason: string;
  count: number;
  percentage: number;
}

interface ReportsChartsProps {
  slaData: SLADataPoint[];
  issuesData: IssueDataPoint[];
  isLoading?: boolean;
}

// Custom Tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="font-medium text-sm mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? 
            (entry.name === "SLA" ? `${formatSLA(entry.value)}%` : entry.value.toLocaleString()) 
            : entry.value}
        </p>
      ))}
    </div>
  );
}

// Empty State
function EmptyState({ message = "Nenhum dado encontrado para este filtro" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Package className="h-16 w-16 mb-4 opacity-30" />
      <p className="text-sm font-medium">{message}</p>
      <p className="text-xs mt-1">Tente ajustar os filtros selecionados</p>
    </div>
  );
}

export function ReportsCharts({ slaData, issuesData, isLoading }: ReportsChartsProps) {
  // Get colors for Pareto chart bars
  const getBarColor = (index: number) => {
    const colors = [
      "hsl(var(--destructive))",
      "hsl(var(--warning))", 
      "hsl(var(--info))",
      "hsl(var(--primary))",
      "hsl(var(--muted-foreground))",
    ];
    return colors[index] || colors[colors.length - 1];
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="h-[350px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="h-[350px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-6", slaData.length > 0 ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
      {/* SLA Evolution Area Chart - only if data provided */}
      {slaData.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Evolução do SLA</h3>
                <p className="text-sm text-muted-foreground">Tendência mensal</p>
              </div>
            </div>
            <Badge variant="outline" className="text-success border-success/30">
              {formatSLA(slaData[slaData.length - 1]?.sla || 0)}% atual
            </Badge>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={slaData}>
              <defs>
                <linearGradient id="slaGradientNew" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                domain={[80, 100]} 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="sla"
                name="SLA"
                stroke="hsl(var(--success))"
                strokeWidth={3}
                fill="url(#slaGradientNew)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Pareto of Issues Bar Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold">Pareto de Ocorrências</h3>
              <p className="text-sm text-muted-foreground">Ordenado por frequência</p>
            </div>
          </div>
          {issuesData.length > 0 && (
            <Badge variant="outline" className="text-warning border-warning/30">
              {issuesData.reduce((acc, d) => acc + d.count, 0)} total
            </Badge>
          )}
        </div>

        {issuesData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={issuesData} 
              layout="vertical"
              margin={{ left: 20, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
              <XAxis 
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                type="category"
                dataKey="reason"
                width={120}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="count" 
                name="Ocorrências"
                radius={[0, 4, 4, 0]}
              >
                {issuesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState />
        )}
      </Card>
    </div>
  );
}
