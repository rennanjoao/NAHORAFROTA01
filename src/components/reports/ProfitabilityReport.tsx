import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Crown, CalendarIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, isWithinInterval, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

type PeriodType = "day" | "month" | "year";

interface ManifestRow {
  id: string;
  driver_name: string;
  manifest_code: string;
  freight_value: number;
  is_own_fleet: boolean | null;
  total_value: number | null;
  created_at: string;
}

interface MonthlyPoint {
  label: string;
  date: Date;
  thirdPartyFreight: number;
  totalCargo: number;
  percentage: number;
}

// ========== LOCKED STATE ==========
function LockedState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Lock className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Relatório de Rentabilidade
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Analise a eficiência dos seus custos com agregados ao longo do tempo. 
        Identifique tendências e otimize sua operação.
      </p>
      <div className="inline-flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-5 py-3">
        <Crown className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium text-primary">
          Upgrade para Plano Controle: Libere relatórios de rentabilidade histórica
        </span>
      </div>
    </div>
  );
}

// ========== MINI GAUGE (reused from dashboard) ==========
function EfficiencyGauge({ percentage }: { percentage: number }) {
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const radius = 50;
  const strokeWidth = 10;
  const cx = 60;
  const cy = 60;
  const circumference = Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const color =
    clamped <= 20 ? "hsl(var(--success))" : clamped <= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

  return (
    <svg width="120" height="72" viewBox="0 0 120 72" className="shrink-0">
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: "20px", fontWeight: 700, fontFamily: "Space Grotesk, sans-serif" }}
      >
        {clamped.toFixed(1).replace(".", ",")}%
      </text>
    </svg>
  );
}

// ========== MAIN COMPONENT ==========

interface ProfitabilityReportProps {
  allowed: boolean;
  upgradePlanLabel: string;
}

export function ProfitabilityReport({ allowed, upgradePlanLabel }: ProfitabilityReportProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedYear, setSelectedYear] = useState(() => format(new Date(), "yyyy"));
  const [manifests, setManifests] = useState<ManifestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch manifests (RLS ensures tenant isolation)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("manifests")
        .select("id, driver_name, manifest_code, freight_value, is_own_fleet, total_value, created_at")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      setManifests((data as ManifestRow[]) ?? []);
    } catch (err) {
      console.error("Error fetching profitability data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) fetchData();
  }, [allowed, fetchData]);

  // Date range based on period type
  const dateRange = useMemo(() => {
    if (periodType === "day") {
      return { from: startOfDay(selectedDate), to: endOfDay(selectedDate) };
    }
    if (periodType === "month") {
      const [y, m] = selectedMonth.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return { from: startOfMonth(d), to: endOfMonth(d) };
    }
    const d = new Date(Number(selectedYear), 0, 1);
    return { from: startOfYear(d), to: endOfYear(d) };
  }, [periodType, selectedDate, selectedMonth, selectedYear]);

  // Filtered manifests for current period
  const filtered = useMemo(() => {
    return manifests.filter((m) => {
      const d = new Date(m.created_at);
      return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
    });
  }, [manifests, dateRange]);

  // Calculations
  const thirdPartyManifests = useMemo(() => filtered.filter((m) => m.is_own_fleet === false), [filtered]);
  const thirdPartyFreight = useMemo(() => thirdPartyManifests.reduce((s, m) => s + (m.freight_value || 0), 0), [thirdPartyManifests]);
  const totalCargo = useMemo(() => filtered.reduce((s, m) => s + (m.total_value || 0), 0), [filtered]);
  const percentage = totalCargo > 0 ? (thirdPartyFreight / totalCargo) * 100 : 0;

  // Monthly evolution data (last 12 months)
  const evolutionData = useMemo((): MonthlyPoint[] => {
    const points: MonthlyPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const mStart = startOfMonth(d);
      const mEnd = endOfMonth(d);
      const monthManifests = manifests.filter((m) => {
        const md = new Date(m.created_at);
        return isWithinInterval(md, { start: mStart, end: mEnd });
      });
      const tp = monthManifests.filter((m) => m.is_own_fleet === false).reduce((s, m) => s + (m.freight_value || 0), 0);
      const tc = monthManifests.reduce((s, m) => s + (m.total_value || 0), 0);
      points.push({
        label: format(d, "MMM/yy", { locale: ptBR }),
        date: mStart,
        thirdPartyFreight: tp,
        totalCargo: tc,
        percentage: tc > 0 ? (tp / tc) * 100 : 0,
      });
    }
    return points;
  }, [manifests]);

  // Trend
  const lastTwo = evolutionData.slice(-2);
  const trend = lastTwo.length === 2 ? lastTwo[1].percentage - lastTwo[0].percentage : 0;

  if (!allowed) return <LockedState />;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
  });

  const yearOptions = Array.from({ length: 3 }, (_, i) => {
    const y = new Date().getFullYear() - i;
    return { value: String(y), label: String(y) };
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Dia Específico</SelectItem>
            <SelectItem value="month">Mês / Ano</SelectItem>
            <SelectItem value="year">Ano Completo</SelectItem>
          </SelectContent>
        </Select>

        {periodType === "day" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        )}

        {periodType === "month" && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {periodType === "year" && (
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Gauge Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Eficiência do Custo Frete
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <EfficiencyGauge percentage={percentage} />
            <div>
              <p className="text-3xl font-bold font-mono" style={{ color: "hsl(var(--foreground))" }}>
                {percentage.toFixed(1).replace(".", ",")}%
              </p>
              <div className="flex items-center gap-1 mt-1">
                {trend > 0.5 ? (
                  <TrendingUp className="h-3 w-3 text-destructive" />
                ) : trend < -0.5 ? (
                  <TrendingDown className="h-3 w-3 text-success" />
                ) : (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={cn("text-xs font-medium",
                  trend > 0.5 ? "text-destructive" : trend < -0.5 ? "text-success" : "text-muted-foreground"
                )}>
                  {trend > 0 ? "+" : ""}{trend.toFixed(1).replace(".", ",")}pp vs. mês anterior
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Cargo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Total das Cargas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-foreground">
              {formatCurrency(totalCargo)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {filtered.length} romaneio(s) no período
            </p>
          </CardContent>
        </Card>

        {/* Third Party Cost */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo com Agregados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-warning">
              {formatCurrency(thirdPartyFreight)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {thirdPartyManifests.length} romaneio(s) de terceiros
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução da Eficiência do Custo Frete</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${value.toFixed(1).replace(".", ",")}%`, "Custo Agregados / Cargas"]}
                />
                <ReferenceLine y={20} stroke="hsl(var(--success))" strokeDasharray="5 5" label={{ value: "Meta 20%", fontSize: 10, fill: "hsl(var(--success))" }} />
                <Line
                  type="monotone"
                  dataKey="percentage"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por Romaneio (Agregados)</CardTitle>
        </CardHeader>
        <CardContent>
          {thirdPartyManifests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum romaneio de agregado encontrado no período selecionado.
            </p>
          ) : (
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Romaneio</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor Carga</TableHead>
                    <TableHead className="text-right">Frete Pago</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {thirdPartyManifests.map((m) => {
                    const pct = (m.total_value || 0) > 0 ? ((m.freight_value || 0) / (m.total_value || 1)) * 100 : 0;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.manifest_code}</TableCell>
                        <TableCell className="truncate max-w-[160px]">{m.driver_name}</TableCell>
                        <TableCell className="text-xs">{format(new Date(m.created_at), "dd/MM/yy")}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatCurrency(m.total_value || 0)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-warning">{formatCurrency(m.freight_value || 0)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={cn(
                            "text-xs",
                            pct <= 20 ? "bg-success/10 text-success border-success/30" :
                            pct <= 40 ? "bg-warning/10 text-warning border-warning/30" :
                            "bg-destructive/10 text-destructive border-destructive/30"
                          )}>
                            {pct.toFixed(1).replace(".", ",")}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(totalCargo)}</TableCell>
                    <TableCell className="text-right font-mono text-warning">{formatCurrency(thirdPartyFreight)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="default" className="text-xs">
                        {percentage.toFixed(1).replace(".", ",")}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
