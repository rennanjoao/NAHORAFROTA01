import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Pause, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DriverProfileModal } from "./DriverProfileModal";
import { getFinishedStatusConfig, FinishedRouteStatus, DriverBase } from "@/lib/driverUtils";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { openWhatsApp } from "@/lib/whatsapp";

const statusConfig = {
  finalizada: {
    label: "Finalizada",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
  finalizada_ocorrencia: {
    label: "Finalizada com Ocorrência",
    icon: AlertCircle,
    className: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  },
  interrompida: {
    label: "Interrompida",
    icon: Pause,
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  },
};

interface FinishedDriver {
  driver: DriverBase;
  status: FinishedRouteStatus;
  finishedTime: string;
  totalDeliveries: number;
  completedDeliveries: number;
  occurrences?: number;
}

export function RecentDeliveries() {
  const [selectedDriver, setSelectedDriver] = useState<DriverBase | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [finishedDrivers, setFinishedDrivers] = useState<FinishedDriver[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch finished drivers from Supabase
  // Uses vw_drivers_operational view to avoid exposing sensitive PII (CPF, bank details, PIX keys)
  useEffect(() => {
    const fetchFinishedDrivers = async () => {
      const { data, error } = await supabase
        .from('vw_drivers_operational')
        .select('*')
        .not('finished_time', 'is', null)
        .order('finished_time', { ascending: false })
        .limit(10);
      
      if (data && !error) {
        const finished: FinishedDriver[] = data.map((d: any) => {
          // Determine status based on deliveries
          let status: FinishedRouteStatus = "finalizada";
          const completed = d.deliveries_completed || 0;
          const total = d.total_deliveries || 0;
          
          if (total > 0 && completed < total) {
            if (completed < total * 0.7) {
              status = "interrompida";
            } else {
              status = "finalizada_ocorrencia";
            }
          }

          // Map operational view data to DriverBase interface
          const driverBase: DriverBase = {
            id: d.id,
            name: d.name || '',
            phone: '', // Hidden - operational view doesn't expose phone
            photo: d.photo_url || null,
            address: null, // Hidden for non-admins
            vehicle_plate: d.vehicle_plate || '',
            vehicle_type: d.vehicle_type || '',
            cnh: '', // Hidden for non-admins
            cnh_category: '', // Hidden for non-admins
            status: d.status || 'active',
            current_delay: d.current_delay,
            individual_sla: d.individual_sla,
            daily_sla: d.daily_sla,
            deliveries_completed: d.deliveries_completed,
            total_deliveries: d.total_deliveries,
            is_own_fleet: d.is_own_fleet,
            finished_time: d.finished_time,
          };

          return {
            driver: driverBase,
            status,
            finishedTime: d.finished_time || "",
            totalDeliveries: total,
            completedDeliveries: completed,
            occurrences: status === "finalizada_ocorrencia" ? total - completed : undefined,
          };
        });
        
        setFinishedDrivers(finished);
      }
      setLoading(false);
    };

    fetchFinishedDrivers();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(uniqueChannelName("recent-deliveries"))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => fetchFinishedDrivers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDriverClick = (driver: DriverBase) => {
    setSelectedDriver(driver);
    setIsProfileOpen(true);
  };

  const handleWhatsApp = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    openWhatsApp(phone);
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl overflow-hidden animate-pulse">
        <div className="p-4 border-b border-border">
          <div className="h-6 w-32 bg-muted rounded" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h3 className="font-semibold text-foreground">Últimas Entregas</h3>
            <p className="text-sm text-muted-foreground">Motoristas que finalizaram suas rotas hoje</p>
          </div>
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
            Ver todas
          </Button>
        </div>

        {finishedDrivers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhuma rota finalizada hoje
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Motorista</TableHead>
                <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                <TableHead className="text-muted-foreground font-medium text-center">Entregas</TableHead>
                <TableHead className="text-muted-foreground font-medium text-center">Horário</TableHead>
                <TableHead className="text-muted-foreground font-medium text-center">WhatsApp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finishedDrivers.map((item: FinishedDriver) => {
                const status = statusConfig[item.status];
                const StatusIcon = status.icon;
                const driver = item.driver;

                return (
                  <TableRow 
                    key={driver.id} 
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleDriverClick(driver)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {driver.photo ? (
                          <img 
                            src={driver.photo} 
                            alt={driver.name}
                            className="h-8 w-8 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center">
                            <span className="text-xs font-bold text-muted-foreground">
                              {driver.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="font-medium text-foreground">{driver.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("flex items-center gap-1.5 w-fit", status.className)}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">
                        {item.completedDeliveries}/{item.totalDeliveries}
                      </span>
                      {item.occurrences && item.occurrences > 0 && (
                        <span className="text-xs text-blue-600 ml-1">
                          ({item.occurrences} oc.)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-muted-foreground">{item.finishedTime}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700"
                        onClick={(e) => handleWhatsApp(e, driver.phone)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <DriverProfileModal
        driver={selectedDriver}
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
      />
    </>
  );
}
