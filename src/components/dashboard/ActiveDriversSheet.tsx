import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLogistics, Driver } from "@/contexts/LogisticsContext";
import { DriverProfileModal } from "./DriverProfileModal";
import { DriverActivityFeed } from "./DriverActivityFeed";
import { Users, Search, Phone, MessageCircle, Truck, Navigation, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveDriversSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const vehicleLabels: Record<string, string> = {
  Fiorino: "Fiorino",
  VUC: "VUC",
  Toco: "Toco",
  Truck: "Truck",
  Carreta: "Carreta",
  Van: "Van",
  Moto: "Moto",
};

// Mock status for drivers (in production, this would come from real-time data)
type DriverActivityStatus = "idle" | "in_displacement" | "at_customer";

const getDriverActivityStatus = (driverId: number): DriverActivityStatus => {
  // Simulated status - in production this would come from driver_activity_logs
  const statuses: DriverActivityStatus[] = ["idle", "in_displacement", "at_customer"];
  return statuses[driverId % 3];
};

const activityStatusConfig = {
  idle: {
    label: "Disponível",
    color: "bg-muted text-muted-foreground",
    icon: null,
  },
  in_displacement: {
    label: "Em deslocamento",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    icon: Navigation,
  },
  at_customer: {
    label: "Em atendimento",
    color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
    icon: MapPin,
  },
};

export function ActiveDriversSheet({ open, onOpenChange }: ActiveDriversSheetProps) {
  const { drivers, deliveries, getDriverSLA } = useLogistics();
  const [search, setSearch] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [isDriverProfileOpen, setIsDriverProfileOpen] = useState(false);
  const [expandedDrivers, setExpandedDrivers] = useState<string[]>([]);

  // Filter drivers that are on route (have active deliveries in transit)
  const driversOnRoute = useMemo(() => {
    return drivers.filter(d => d.status === "in_route");
  }, [drivers]);

  const filteredDrivers = useMemo(() => {
    return driversOnRoute.filter(d =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.vehiclePlate.toLowerCase().includes(search.toLowerCase())
    );
  }, [driversOnRoute, search]);

  // Get delivery stats for each driver
  const getDriverStats = (driverId: number) => {
    const driverDeliveries = deliveries.filter(d => d.driverId === driverId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayDeliveries = driverDeliveries.filter(d => {
      const deliveryDate = new Date(d.scheduledDate);
      deliveryDate.setHours(0, 0, 0, 0);
      return deliveryDate.getTime() === today.getTime();
    });

    const completed = todayDeliveries.filter(d => d.status === "delivered").length;
    const total = todayDeliveries.length;
    const inTransit = todayDeliveries.filter(d => d.status === "in_transit").length;
    
    return { completed, total, inTransit };
  };

  const handleDriverClick = (driver: Driver, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDriver(driver);
    setIsDriverProfileOpen(true);
  };

  const handleWhatsApp = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${cleanPhone}`, "_blank");
  };

  const getSLAColor = (sla: number) => {
    if (sla >= 95) return "text-success";
    if (sla >= 90) return "text-warning";
    return "text-destructive";
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Motoristas na Rua
              <Badge className="ml-2">{driversOnRoute.length}</Badge>
            </SheetTitle>
          </SheetHeader>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar motorista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Driver List with Accordion */}
          <ScrollArea className="h-[calc(100vh-180px)]">
            <Accordion
              type="multiple"
              value={expandedDrivers}
              onValueChange={setExpandedDrivers}
              className="space-y-2 pr-4"
            >
              {filteredDrivers.map((driver) => {
                const stats = getDriverStats(driver.id);
                const sla = getDriverSLA(driver.id);
                const activityStatus = getDriverActivityStatus(driver.id);
                const statusConfig = activityStatusConfig[activityStatus];
                const StatusIcon = statusConfig.icon;
                
                return (
                  <AccordionItem
                    key={driver.id}
                    value={String(driver.id)}
                    className="border border-border rounded-lg bg-card overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 [&[data-state=open]]:bg-muted/30">
                      <div className="flex items-start justify-between gap-3 w-full pr-2">
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold truncate">{driver.name}</h4>
                            <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                            {/* Activity Status Badge */}
                            {activityStatus !== "idle" && (
                              <Badge 
                                variant="outline" 
                                className={cn("text-[10px] h-5 gap-1", statusConfig.color)}
                              >
                                {StatusIcon && <StatusIcon className="h-3 w-3" />}
                                {statusConfig.label}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Truck className="h-3 w-3" />
                            <span className="font-mono">{driver.vehiclePlate}</span>
                            <span>•</span>
                            <span>{vehicleLabels[driver.vehicleType] || driver.vehicleType}</span>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              SLA: <span className={getSLAColor(sla)}>{sla.toFixed(0)}%</span>
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {stats.completed}/{stats.total} entregas
                            </span>
                          </div>

                          {stats.inTransit > 0 && (
                            <div className="mt-2 text-xs text-primary font-medium">
                              🚛 {stats.inTransit} {stats.inTransit === 1 ? "entrega" : "entregas"} em andamento
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={(e) => handleWhatsApp(driver.phone, e)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`tel:${driver.phone}`, "_blank");
                            }}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-4 pb-4 pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-semibold text-muted-foreground">
                          Atividades Recentes
                        </h5>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={(e) => handleDriverClick(driver, e)}
                        >
                          Ver perfil completo
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Activity Feed */}
                      <DriverActivityFeed 
                        driverId={String(driver.id)} 
                        maxHeight="200px"
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}

              {filteredDrivers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum motorista na rua</p>
                </div>
              )}
            </Accordion>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {selectedDriver && (
        <DriverProfileModal
          driver={{
            id: String(selectedDriver.id),
            name: selectedDriver.name,
            phone: selectedDriver.phone,
            address: selectedDriver.region,
            vehicle_plate: selectedDriver.vehiclePlate,
            vehicle_type: selectedDriver.vehicleType.toLowerCase(),
            cnh: "N/A",
            cnh_category: "E",
            photo: selectedDriver.photo,
            current_delay: 0,
            individual_sla: getDriverSLA(selectedDriver.id),
            daily_sla: getDriverSLA(selectedDriver.id),
            status: selectedDriver.status === "in_route" ? "delivering" : "active",
            deliveries_completed: selectedDriver.successfulDeliveries,
            total_deliveries: selectedDriver.totalDeliveries,
            finished_time: null,
            is_own_fleet: true,
          }}
          open={isDriverProfileOpen}
          onOpenChange={setIsDriverProfileOpen}
        />
      )}
    </>
  );
}
