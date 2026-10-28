 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Users, Truck, Building2, UserCheck } from "lucide-react";
 import { useManifestsDB } from "@/hooks/useManifestsDB";
 import { formatCurrency } from "@/lib/formatCurrency";
 import { Skeleton } from "@/components/ui/skeleton";
 
 export function FleetMonitoringCards() {
   const { todayFleetStats, isLoading } = useManifestsDB();
 
   if (isLoading) {
     return (
       <div className="grid gap-4 md:grid-cols-2">
         <Skeleton className="h-32" />
         <Skeleton className="h-32" />
       </div>
     );
   }
 
   return (
     <div className="grid gap-4 md:grid-cols-2">
       {/* Motoristas da Casa em Rota */}
       <Card className="border-l-4 border-l-primary">
         <CardHeader className="pb-2">
           <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
             <Building2 className="h-4 w-4" />
             Frota Própria Hoje
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="flex items-center justify-between">
             <div>
               <p className="text-3xl font-bold text-primary">
                 {todayFleetStats.ownFleetCount}
               </p>
               <p className="text-xs text-muted-foreground">
                 motoristas CLT em rota
               </p>
             </div>
             <div className="text-right">
               <Badge variant="secondary" className="bg-primary/10 text-primary">
                 <Truck className="h-3 w-3 mr-1" />
                 {todayFleetStats.ownFleetManifests} romaneios
               </Badge>
             </div>
           </div>
         </CardContent>
       </Card>
 
       {/* Motoristas Terceiros em Rota */}
       <Card className="border-l-4 border-l-warning">
         <CardHeader className="pb-2">
           <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
             <UserCheck className="h-4 w-4" />
             Terceiros/Agregados Hoje
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="flex items-center justify-between">
             <div>
               <p className="text-3xl font-bold text-warning">
                 {todayFleetStats.thirdPartyCount}
               </p>
               <p className="text-xs text-muted-foreground">
                 motoristas terceiros em rota
               </p>
             </div>
             <div className="text-right space-y-1">
               <Badge variant="secondary" className="bg-warning/10 text-warning">
                 <Truck className="h-3 w-3 mr-1" />
                 {todayFleetStats.thirdPartyManifests} romaneios
               </Badge>
               <p className="text-xs font-mono text-muted-foreground">
                 {formatCurrency(todayFleetStats.totalFreight)} em frete
               </p>
             </div>
           </div>
         </CardContent>
       </Card>
     </div>
   );
 }