 import { useMemo } from "react";
 import { Card } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { MapPin, TrendingUp, TrendingDown, AlertTriangle, Package, DollarSign, Percent } from "lucide-react";
 import { cn } from "@/lib/utils";
 import { calculateRegiaoLogistica, getRegionColor, LOGISTICS_REGIONS } from "@/lib/cepRegionMapping";
 import { formatCurrency } from "@/lib/formatCurrency";
 import {
   BarChart,
   Bar,
   XAxis,
   YAxis,
   CartesianGrid,
   Tooltip,
   ResponsiveContainer,
   Cell,
   PieChart,
   Pie,
   Legend,
 } from "recharts";
 
 interface Invoice {
   id: string;
   status: string;
   regiao_logistica: string | null;
   address_zip?: string | null;
   total_value: number;
   occurrence_type: string | null;
 }
 
 interface RegionalEfficiencyDashboardProps {
   invoices: Invoice[];
   isLoading?: boolean;
 }
 
 interface RegionStats {
   region: string;
   total: number;
   delivered: number;
   occurrences: number;
   pending: number;
   inTransit: number;
   totalValue: number;
   deliveredValue: number;
   successRate: number;
 }
 
 // Cores para o gráfico de pizza
 const CHART_COLORS = [
   'hsl(var(--primary))',
   'hsl(var(--success))',
   'hsl(var(--warning))',
   'hsl(var(--destructive))',
   // Sem paleta categorica no manual: variacoes das cores da marca.
   'hsl(var(--info))',
   'hsl(var(--muted-foreground))',
   'hsl(162 81% 23%)',
   'hsl(0 0% 100%)',
   'hsl(162 100% 35%)',
   'hsl(210 100% 78%)',
 ];
 
 function CustomTooltip({ active, payload, label }: any) {
   if (!active || !payload || !payload.length) return null;
   
   return (
     <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
       <p className="font-medium text-sm mb-2">{label}</p>
       {payload.map((entry: any, index: number) => (
         <p key={index} className="text-xs" style={{ color: entry.color }}>
           {entry.name}: {typeof entry.value === 'number' ? 
             (entry.name.includes('R$') ? formatCurrency(entry.value) : entry.value.toLocaleString()) 
             : entry.value}
         </p>
       ))}
     </div>
   );
 }

 function resolveInvoiceRegion(invoice: Invoice): string {
   const storedRegion = invoice.regiao_logistica?.trim();
   if (storedRegion && storedRegion !== 'Sem Região' && storedRegion !== 'Sem RegiÃ£o') {
     return storedRegion;
   }

   return calculateRegiaoLogistica(invoice.address_zip);
 }
 
 export function RegionalEfficiencyDashboard({ invoices, isLoading }: RegionalEfficiencyDashboardProps) {
   // Calcula estatísticas por região
   const regionStats = useMemo(() => {
     const stats: Record<string, RegionStats> = {};
     
     invoices.forEach(inv => {
       const region = resolveInvoiceRegion(inv);
       
       if (!stats[region]) {
         stats[region] = {
           region,
           total: 0,
           delivered: 0,
           occurrences: 0,
           pending: 0,
           inTransit: 0,
           totalValue: 0,
           deliveredValue: 0,
           successRate: 0,
         };
       }
       
       stats[region].total++;
       stats[region].totalValue += inv.total_value || 0;
       
       if (inv.status === 'delivered') {
         stats[region].delivered++;
         stats[region].deliveredValue += inv.total_value || 0;
       } else if (inv.status === 'occurrence' || inv.occurrence_type) {
         stats[region].occurrences++;
       } else if (inv.status === 'pending') {
         stats[region].pending++;
       } else if (inv.status === 'in_transit' || inv.status === 'in_route') {
         stats[region].inTransit++;
       }
     });
     
     // Calcula taxa de sucesso
     Object.values(stats).forEach(s => {
       const completed = s.delivered + s.occurrences;
       s.successRate = completed > 0 ? (s.delivered / completed) * 100 : 0;
     });
     
     return Object.values(stats).sort((a, b) => b.total - a.total);
   }, [invoices]);
 
   // Dados para gráfico de barras (Top 10 regiões por volume)
   const barChartData = useMemo(() => {
     return regionStats.slice(0, 10).map(s => ({
       name: s.region.replace('Interior - ', '').replace('GSP - ', '').replace('SP - ', ''),
       fullName: s.region,
       entregues: s.delivered,
       ocorrencias: s.occurrences,
     }));
   }, [regionStats]);
 
   // Dados para gráfico de pizza (Distribuição por categoria)
   const pieChartData = useMemo(() => {
     const categories: Record<string, number> = {
       'Capital SP': 0,
       'Grande SP': 0,
       'Interior': 0,
       'Litoral': 0,
       'Outras': 0,
     };
     
     regionStats.forEach(s => {
       if (s.region.startsWith('SP -')) categories['Capital SP'] += s.total;
       else if (s.region.startsWith('GSP')) categories['Grande SP'] += s.total;
       else if (s.region.startsWith('Interior')) categories['Interior'] += s.total;
       else if (s.region.startsWith('Litoral')) categories['Litoral'] += s.total;
       else categories['Outras'] += s.total;
     });
     
     return Object.entries(categories)
       .filter(([_, value]) => value > 0)
       .map(([name, value]) => ({ name, value }));
   }, [regionStats]);
 
   // KPIs gerais
   const totalDelivered = regionStats.reduce((acc, s) => acc + s.delivered, 0);
   const totalOccurrences = regionStats.reduce((acc, s) => acc + s.occurrences, 0);
   const totalValue = regionStats.reduce((acc, s) => acc + s.totalValue, 0);
   const overallSuccessRate = (totalDelivered + totalOccurrences) > 0 
     ? (totalDelivered / (totalDelivered + totalOccurrences)) * 100 
     : 0;
 
   if (isLoading) {
     return (
       <div className="space-y-6">
         <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
           {[1, 2, 3, 4].map(i => (
             <Card key={i} className="p-4 animate-pulse">
               <div className="h-20 bg-muted rounded" />
             </Card>
           ))}
         </div>
       </div>
     );
   }
 
   return (
     <div className="space-y-6">
       {/* KPIs */}
       <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
         <Card className="p-4">
           <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-primary/10">
               <MapPin className="h-5 w-5 text-primary" />
             </div>
             <div>
               <p className="text-sm text-muted-foreground">Regiões Ativas</p>
               <p className="text-2xl font-bold">{regionStats.length}</p>
             </div>
           </div>
         </Card>
         
         <Card className="p-4">
           <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-success/10">
               <Package className="h-5 w-5 text-success" />
             </div>
             <div>
               <p className="text-sm text-muted-foreground">NFs Entregues</p>
               <p className="text-2xl font-bold">{totalDelivered.toLocaleString()}</p>
             </div>
           </div>
         </Card>
         
         <Card className="p-4">
           <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-warning/10">
               <AlertTriangle className="h-5 w-5 text-warning" />
             </div>
             <div>
               <p className="text-sm text-muted-foreground">Ocorrências</p>
               <p className="text-2xl font-bold">{totalOccurrences.toLocaleString()}</p>
             </div>
           </div>
         </Card>
         
         <Card className="p-4">
           <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-accent/50">
               <Percent className="h-5 w-5 text-accent-foreground" />
             </div>
             <div>
               <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
               <p className="text-2xl font-bold">{overallSuccessRate.toFixed(1).replace(".", ",")}%</p>
             </div>
           </div>
         </Card>
       </div>
 
       {/* Gráficos */}
       <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
         {/* Gráfico de Barras - Entregas vs Ocorrências */}
         <Card className="p-6">
           <div className="flex items-center justify-between mb-6">
             <div>
               <h3 className="font-semibold">Entregas vs Ocorrências por Região</h3>
               <p className="text-sm text-muted-foreground">Top 10 regiões por volume</p>
             </div>
           </div>
           
           {barChartData.length > 0 ? (
             <ResponsiveContainer width="100%" height={300}>
               <BarChart data={barChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                 <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                 <YAxis 
                   type="category" 
                   dataKey="name" 
                   width={120}
                   tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                 />
                 <Tooltip content={<CustomTooltip />} />
                 <Legend />
                 <Bar dataKey="entregues" name="Entregues" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
                 <Bar dataKey="ocorrencias" name="Ocorrências" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
               </BarChart>
             </ResponsiveContainer>
           ) : (
             <div className="flex items-center justify-center h-[300px] text-muted-foreground">
               <p>Nenhum dado disponível</p>
             </div>
           )}
         </Card>
 
         {/* Gráfico de Pizza - Distribuição por Categoria */}
         <Card className="p-6">
           <div className="flex items-center justify-between mb-6">
             <div>
               <h3 className="font-semibold">Distribuição por Categoria</h3>
               <p className="text-sm text-muted-foreground">Volume total de NFs</p>
             </div>
           </div>
           
           {pieChartData.length > 0 ? (
             <ResponsiveContainer width="100%" height={300}>
               <PieChart>
                 <Pie
                   data={pieChartData}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={100}
                   paddingAngle={2}
                   dataKey="value"
                   label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0).replace(".", ",")}%)`}
                   labelLine={false}
                 >
                   {pieChartData.map((_, index) => (
                     <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip content={<CustomTooltip />} />
                 <Legend />
               </PieChart>
             </ResponsiveContainer>
           ) : (
             <div className="flex items-center justify-center h-[300px] text-muted-foreground">
               <p>Nenhum dado disponível</p>
             </div>
           )}
         </Card>
       </div>
 
       {/* Tabela de Ranking por Região */}
       <Card className="p-6">
         <div className="flex items-center justify-between mb-6">
           <div>
             <h3 className="font-semibold">Ranking de Eficiência por Região</h3>
             <p className="text-sm text-muted-foreground">Ordenado por taxa de sucesso</p>
           </div>
         </div>
         
         <div className="overflow-x-auto">
           <table className="w-full text-sm">
             <thead>
               <tr className="border-b">
                 <th className="text-left py-3 px-2">Região</th>
                 <th className="text-right py-3 px-2">Total NFs</th>
                 <th className="text-right py-3 px-2">Entregues</th>
                 <th className="text-right py-3 px-2">Ocorrências</th>
                 <th className="text-right py-3 px-2">Taxa Sucesso</th>
                 <th className="text-right py-3 px-2">Valor Total</th>
               </tr>
             </thead>
             <tbody>
               {regionStats.slice(0, 15).map((stat, index) => (
                 <tr key={stat.region} className="border-b hover:bg-muted/50">
                   <td className="py-3 px-2">
                     <div className="flex items-center gap-2">
                       <div className={cn("w-3 h-3 rounded-full", getRegionColor(stat.region))} />
                       <span className="font-medium">{stat.region}</span>
                     </div>
                   </td>
                   <td className="text-right py-3 px-2">{stat.total}</td>
                   <td className="text-right py-3 px-2 text-success">{stat.delivered}</td>
                   <td className="text-right py-3 px-2 text-destructive">{stat.occurrences}</td>
                   <td className="text-right py-3 px-2">
                     <Badge 
                       variant={stat.successRate >= 90 ? "default" : stat.successRate >= 70 ? "secondary" : "destructive"}
                       className="font-mono"
                     >
                       {stat.successRate.toFixed(1).replace(".", ",")}%
                     </Badge>
                   </td>
                   <td className="text-right py-3 px-2 font-mono">
                     {formatCurrency(stat.totalValue)}
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </Card>
     </div>
   );
 }
