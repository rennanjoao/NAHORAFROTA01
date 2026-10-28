import { useState, useEffect } from "react";
import { Phone, MapPin, Car, MessageCircle, Navigation, Clock, Package, TrendingUp, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { getSLAStatus, getIndividualSLAColor, vehicleLabels } from "@/lib/driverUtils";
import { openWhatsApp } from "@/lib/whatsapp";

interface Driver {
  id: string;
  name: string;
  photo: string | null;
  phone: string;
  address: string | null;
  vehicle_plate: string;
  vehicle_type: string;
  cnh: string;
  cnh_category: string;
  status: string;
  individual_sla: number | null;
  daily_sla: number | null;
  current_delay: number | null;
  deliveries_completed: number | null;
  total_deliveries: number | null;
}

interface Telemetry {
  speed: number | null;
  battery_level: number | null;
  accuracy: number | null;
  last_update: string | null;
}

interface DriverSheetProps {
  driver: Driver | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DriverSheet({ driver, open, onOpenChange }: DriverSheetProps) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);

  // Fetch REAL telemetry from fleet_positions
  useEffect(() => {
    if (!open || !driver) {
      setTelemetry(null);
      return;
    }

    const fetchTelemetry = async () => {
      const { data } = await supabase
        .from('fleet_positions')
        .select('speed, battery_level, accuracy, last_update')
        .eq('driver_id', driver.id)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setTelemetry(data);
      }
    };

    fetchTelemetry();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(uniqueChannelName(`telemetry-${driver.id}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fleet_positions',
          filter: `driver_id=eq.${driver.id}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).is_active) {
            setTelemetry(payload.new as Telemetry);
          } else {
            setTelemetry(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, driver]);

  if (!driver) return null;

  const slaStatus = getSLAStatus(driver.individual_sla);

  const handleWhatsApp = () => {
    openWhatsApp(driver.phone);
  };

  const handleCall = () => {
    window.open(`tel:${driver.phone}`, "_blank");
  };

  const deliveriesCompleted = driver.deliveries_completed || 0;
  const totalDeliveries = driver.total_deliveries || 0;
  const currentDelay = driver.current_delay || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            Perfil & Telemetria
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Driver Header */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
            <div className="relative">
              {driver.photo ? (
                <img
                  src={driver.photo}
                  alt={driver.name}
                  className="h-16 w-16 rounded-full object-cover border-4 border-primary/20"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted border-4 border-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-muted-foreground">
                    {driver.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div className={cn(
                "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-background",
                driver.status === "active" ? "bg-green-500" :
                driver.status === "delivering" ? "bg-primary" :
                driver.status === "break" ? "bg-yellow-500" : "bg-gray-400"
              )} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground">{driver.name}</h3>
              <p className="text-sm text-muted-foreground">{driver.vehicle_plate}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("text-white font-medium text-xs", slaStatus.bgColor)}>
                  SLA: {driver.individual_sla || 0}%
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {vehicleLabels[driver.vehicle_type] || driver.vehicle_type}
                </Badge>
              </div>
            </div>
          </div>

          {/* Quick Contact */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button variant="outline" onClick={handleCall}>
              <Phone className="h-4 w-4 mr-2" />
              Ligar
            </Button>
          </div>

          {/* Live Telemetry */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-foreground">Telemetria ao Vivo</h4>
              {telemetry ? (
                <div className="flex items-center gap-1.5 text-success">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-medium">Conectado</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="text-xs font-medium">Offline</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-background border border-border">
                <p className="text-2xl font-bold text-foreground">{telemetry?.speed || 0}</p>
                <p className="text-xs text-muted-foreground">km/h</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background border border-border">
                <p className="text-2xl font-bold text-foreground">{telemetry?.battery_level || 0}%</p>
                <p className="text-xs text-muted-foreground">Bateria</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background border border-border">
                <p className="text-2xl font-bold text-foreground">±{telemetry?.accuracy || 0}m</p>
                <p className="text-xs text-muted-foreground">Precisão GPS</p>
              </div>
            </div>
          </div>

          {/* Delivery Progress */}
          {totalDeliveries > 0 && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <h4 className="font-medium text-foreground mb-4">Progresso do Dia</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Entregas</span>
                  <span className="font-medium">{deliveriesCompleted}/{totalDeliveries}</span>
                </div>
                <Progress 
                  value={(deliveriesCompleted / totalDeliveries) * 100} 
                  className="h-2 [&>div]:bg-primary"
                />

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-background">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{deliveriesCompleted}</p>
                      <p className="text-xs text-muted-foreground">Concluídas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-background">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{totalDeliveries - deliveriesCompleted}</p>
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Current Status Alert */}
          {currentDelay > 0 && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Atraso Detectado</p>
                  <p className="text-sm text-destructive/80">
                    {currentDelay} minutos de atraso na rota atual
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Contact Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-medium text-foreground">{driver.phone}</p>
              </div>
            </div>

            {driver.address && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Endereço</p>
                  <p className="font-medium text-foreground">{driver.address}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Car className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Veículo</p>
                <p className="font-medium text-foreground">{driver.vehicle_plate} • CNH {driver.cnh_category}</p>
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border">
            <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Performance Semanal
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-background border border-border">
                <p className={cn("text-2xl font-bold", getIndividualSLAColor(driver.individual_sla))}>
                  {driver.individual_sla || 0}%
                </p>
                <p className="text-xs text-muted-foreground">SLA Geral</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background border border-border">
                <p className={cn("text-2xl font-bold", getIndividualSLAColor(driver.daily_sla))}>
                  {driver.daily_sla || 0}%
                </p>
                <p className="text-xs text-muted-foreground">SLA Hoje</p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
