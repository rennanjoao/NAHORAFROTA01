 import { useState, useMemo } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Calendar } from "@/components/ui/calendar";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
 import { 
   BarChart, 
   Bar, 
   XAxis, 
   YAxis, 
   CartesianGrid, 
   Tooltip, 
   Legend, 
   ResponsiveContainer,
   PieChart,
   Pie,
   Cell
 } from "recharts";
 import { 
   CalendarIcon, 
   Building2, 
   UserCheck, 
   TrendingUp, 
   Truck,
   DollarSign
 } from "lucide-react";
 import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { cn } from "@/lib/utils";
 import { useManifestsDB } from "@/hooks/useManifestsDB";
 import { formatCurrency } from "@/lib/formatCurrency";
 import { Skeleton } from "@/components/ui/skeleton";
 
 const COLORS = {
   ownFleet: "hsl(var(--primary))",
   thirdParty: "hsl(var(--warning))",
 };
 
 export function FleetUsageReport() {
   const { getFleetUsageReport, isLoading } = useManifestsDB();
   
   // Date range state - default to current month
   const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
     from: startOfMonth(new Date()),
     to: endOfMonth(new Date()),
   });
 
   // Get report data
   const reportData = useMemo(() => {
     const startDate = format(dateRange.from, "yyyy-MM-dd");
     const endDate = format(dateRange.to, "yyyy-MM-dd");
     return getFleetUsageReport(startDate, endDate);
   }, [dateRange, getFleetUsageReport]);
 
   // Chart data for drivers comparison
   const driversChartData = [
     {
       name: "Frota Própria",
       motoristas: reportData.ownFleet.driversCount,
       romaneios: reportData.ownFleet.manifestsCount,
       entregas: reportData.ownFleet.totalDeliveries,
     },
     {
       name: "Terceiros",
       motoristas: reportData.thirdParty.driversCount,
       romaneios: reportData.thirdParty.manifestsCount,
       entregas: reportData.thirdParty.totalDeliveries,
     },
   ];
 
   // Pie chart data
   const pieData = [
     { name: "Frota Própria", value: reportData.ownFleet.driversCount, color: COLORS.ownFleet },
     { name: "Terceiros", value: reportData.thirdParty.driversCount, color: COLORS.thirdParty },
   ];
 
   // Quick period selectors
   const setPeriod = (months: number) => {
     const now = new Date();
     if (months === 0) {
       setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
     } else {
       const start = startOfMonth(subMonths(now, months));
       const end = endOfMonth(subMonths(now, months === 1 ? 1 : 1));
       setDateRange({ from: start, to: months === 1 ? endOfMonth(subMonths(now, 1)) : now });
     }
   };
 
   if (isLoading) {
     return (
       <Card>
         <CardHeader>
           <Skeleton className="h-8 w-64" />
         </CardHeader>
         <CardContent className="space-y-4">
           <Skeleton className="h-64" />
         </CardContent>
       </Card>
     );
   }
 
   const totalDrivers = reportData.ownFleet.driversCount + reportData.thirdParty.driversCount;
   const ownFleetPercentage = totalDrivers > 0 
     ? ((reportData.ownFleet.driversCount / totalDrivers) * 100).toFixed(1) 
     : "0";
   const thirdPartyPercentage = totalDrivers > 0 
     ? ((reportData.thirdParty.driversCount / totalDrivers) * 100).toFixed(1) 
     : "0";
 
   return (
     <Card>
       <CardHeader>
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <CardTitle className="flex items-center gap-2">
             <TrendingUp className="h-5 w-5 text-primary" />
             Uso de Frota: Própria vs. Agregada
           </CardTitle>
           
           <div className="flex items-center gap-2 flex-wrap">
             {/* Quick period buttons */}
             <div className="flex gap-1">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setPeriod(0)}
               >
                 Este Mês
               </Button>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setPeriod(1)}
               >
                 Mês Anterior
               </Button>
             </div>
 
             {/* Date Range Picker */}
             <Popover>
               <PopoverTrigger asChild>
                 <Button variant="outline" size="sm" className="gap-2">
                   <CalendarIcon className="h-4 w-4" />
                   {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0" align="end">
                 <Calendar
                   mode="range"
                   selected={{ from: dateRange.from, to: dateRange.to }}
                   onSelect={(range) => {
                     if (range?.from && range?.to) {
                       setDateRange({ from: range.from, to: range.to });
                     }
                   }}
                   locale={ptBR}
                   numberOfMonths={2}
                 />
               </PopoverContent>
             </Popover>
           </div>
         </div>
       </CardHeader>
       <CardContent className="space-y-6">
         {/* KPI Summary */}
         <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
           <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
             <div className="flex items-center gap-2 text-primary mb-2">
               <Building2 className="h-4 w-4" />
               <span className="text-sm font-medium">Frota Própria</span>
             </div>
             <p className="text-2xl font-bold">{reportData.ownFleet.driversCount}</p>
             <p className="text-xs text-muted-foreground">motoristas trabalharam</p>
             <Badge variant="outline" className="mt-2 text-xs">
               {ownFleetPercentage}% do total
             </Badge>
           </div>
 
           <div className="p-4 rounded-lg bg-warning/5 border border-warning/20">
             <div className="flex items-center gap-2 text-warning mb-2">
               <UserCheck className="h-4 w-4" />
               <span className="text-sm font-medium">Terceiros</span>
             </div>
             <p className="text-2xl font-bold">{reportData.thirdParty.driversCount}</p>
             <p className="text-xs text-muted-foreground">motoristas trabalharam</p>
             <Badge variant="outline" className="mt-2 text-xs">
               {thirdPartyPercentage}% do total
             </Badge>
           </div>
 
           <div className="p-4 rounded-lg bg-muted/50 border">
             <div className="flex items-center gap-2 text-muted-foreground mb-2">
               <Truck className="h-4 w-4" />
               <span className="text-sm font-medium">Total Romaneios</span>
             </div>
             <p className="text-2xl font-bold">
               {reportData.ownFleet.manifestsCount + reportData.thirdParty.manifestsCount}
             </p>
             <p className="text-xs text-muted-foreground">no período</p>
           </div>
 
           <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
             <div className="flex items-center gap-2 text-destructive mb-2">
               <DollarSign className="h-4 w-4" />
               <span className="text-sm font-medium">Frete Terceiros</span>
             </div>
             <p className="text-2xl font-bold font-mono">
               {formatCurrency(reportData.thirdParty.totalFreight)}
             </p>
             <p className="text-xs text-muted-foreground">a pagar no período</p>
           </div>
         </div>
 
         {/* Charts */}
         <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
           {/* Bar Chart - Comparison */}
           <div className="p-4 rounded-lg border">
             <h4 className="text-sm font-medium mb-4">Comparativo de Utilização</h4>
             <ResponsiveContainer width="100%" height={250}>
               <BarChart data={driversChartData}>
                 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                 <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                 <YAxis tick={{ fontSize: 12 }} />
                 <Tooltip 
                   contentStyle={{ 
                     backgroundColor: "hsl(var(--background))",
                     border: "1px solid hsl(var(--border))",
                     borderRadius: "8px"
                   }}
                 />
                 <Legend />
                 <Bar dataKey="motoristas" fill={COLORS.ownFleet} name="Motoristas" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="romaneios" fill={COLORS.thirdParty} name="Romaneios" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
 
           {/* Pie Chart - Distribution */}
           <div className="p-4 rounded-lg border">
             <h4 className="text-sm font-medium mb-4">Distribuição de Motoristas</h4>
             <ResponsiveContainer width="100%" height={250}>
               <PieChart>
                 <Pie
                   data={pieData}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={90}
                   paddingAngle={5}
                   dataKey="value"
                   label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                   labelLine={false}
                 >
                   {pieData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.color} />
                   ))}
                 </Pie>
                 <Tooltip 
                   formatter={(value) => [`${value} motoristas`, ""]}
                   contentStyle={{ 
                     backgroundColor: "hsl(var(--background))",
                     border: "1px solid hsl(var(--border))",
                     borderRadius: "8px"
                   }}
                 />
               </PieChart>
             </ResponsiveContainer>
           </div>
         </div>
 
         {/* Note */}
         <p className="text-xs text-muted-foreground text-center">
           * Apenas motoristas que tiveram romaneios vinculados no período são contabilizados
         </p>
       </CardContent>
     </Card>
   );
 }