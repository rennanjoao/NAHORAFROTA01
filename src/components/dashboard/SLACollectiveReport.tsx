/**
 * SLA COLLECTIVE REPORT WIDGET
 * Dashboard widget for collective SLA analysis with date range filter
 */

import { useState, useMemo } from "react";
import { 
  Calendar, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  ChevronDown,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import useSLA from "@/hooks/useSLA";
import { getSLAColorScheme, formatSLAScore } from "@/lib/slaCalculations";

type QuickPeriod = "today" | "week" | "month" | "quarter" | "custom";

export function SLACollectiveReport() {
  const { 
    getCollectiveSLAReport, 
    getAllDriversSLA, 
    getCriticalDrivers, 
    getAtRiskDrivers,
    fleetSLA 
  } = useSLA();

  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>("week");
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());

  // Handle quick period selection
  const handleQuickPeriod = (period: QuickPeriod) => {
    setQuickPeriod(period);
    const now = new Date();
    let start: Date;

    switch (period) {
      case "today":
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case "week":
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case "month":
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        break;
      case "quarter":
        start = new Date(now);
        start.setMonth(start.getMonth() - 3);
        break;
      default:
        return;
    }

    setStartDate(start);
    setEndDate(now);
  };

  const report = useMemo(() => {
    return getCollectiveSLAReport(startDate, endDate);
  }, [getCollectiveSLAReport, startDate, endDate]);

  const fleetColorScheme = getSLAColorScheme(fleetSLA);

  // Sort drivers by average score (worst first)
  const sortedDrivers = useMemo(() => {
    return [...report.driverBreakdown].sort((a, b) => a.averageScore - b.averageScore);
  }, [report]);

  const formatDateRange = () => {
    const options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
    return `${startDate.toLocaleDateString("pt-BR", options)} - ${endDate.toLocaleDateString("pt-BR", options)}`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Análise Coletiva de SLA
          </CardTitle>
          <Badge variant="outline" className={fleetColorScheme.textClass}>
            Frota: {formatSLAScore(fleetSLA)}%
          </Badge>
        </div>

        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Select value={quickPeriod} onValueChange={(v) => handleQuickPeriod(v as QuickPeriod)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Última Semana</SelectItem>
              <SelectItem value="month">Último Mês</SelectItem>
              <SelectItem value="quarter">Último Trimestre</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {quickPeriod === "custom" && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Calendar className="h-3 w-3 mr-1" />
                    {startDate.toLocaleDateString("pt-BR")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Calendar className="h-3 w-3 mr-1" />
                    {endDate.toLocaleDateString("pt-BR")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold font-data">{report.driverCount}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Users className="h-3 w-3" />
              Motoristas
            </div>
          </div>
          <div className={`p-3 rounded-lg text-center ${fleetColorScheme.bgClass}`}>
            <div className={`text-2xl font-bold font-data ${fleetColorScheme.textClass}`}>
              {formatSLAScore(report.averageScore)}%
            </div>
            <div className="text-xs text-muted-foreground">Média Geral</div>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 text-center">
            <div className="text-2xl font-bold font-data text-destructive">
              {getCriticalDrivers.length}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Críticos
            </div>
          </div>
        </div>

        {/* Fleet SLA Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">SLA da Frota</span>
            <span className={`font-semibold ${fleetColorScheme.textClass}`}>
              {fleetColorScheme.labelPt}
            </span>
          </div>
          <Progress value={fleetSLA} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span className="text-warning">75%</span>
            <span className="text-success">90%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Driver Breakdown */}
        <div>
          <h4 className="text-sm font-medium mb-2">Motoristas por SLA</h4>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {sortedDrivers.slice(0, 10).map((driver) => {
                const scheme = getSLAColorScheme(driver.averageScore);
                return (
                  <div 
                    key={driver.driverId}
                    className={`flex items-center justify-between p-2 rounded-lg border ${scheme.bgClass} ${scheme.borderClass}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${scheme.progressClass}`} />
                      <span className="text-sm font-medium truncate max-w-[120px]">
                        {driver.driverName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({driver.totalDeliveries} entr.)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold font-data ${scheme.textClass}`}>
                        {formatSLAScore(driver.averageScore)}%
                      </span>
                      {driver.averageScore < 75 && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
