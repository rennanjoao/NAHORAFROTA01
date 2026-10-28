import { Phone, MapPin, Car, CreditCard, MessageCircle, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getIndividualSLAColor, vehicleLabels, DriverBase } from "@/lib/driverUtils";

interface DriverProfileModalProps {
  driver: DriverBase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DriverProfileModal({ driver, open, onOpenChange }: DriverProfileModalProps) {
  if (!driver) return null;

  const handleWhatsApp = () => {
    const phone = driver.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Perfil do Motorista
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Photo and Basic Info */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {driver.photo ? (
                <img
                  src={driver.photo}
                  alt={driver.name}
                  className="h-20 w-20 rounded-full object-cover border-4 border-primary/20"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-muted border-4 border-primary/20 flex items-center justify-center">
                  <span className="text-xl font-bold text-muted-foreground">
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
            <div>
              <h3 className="text-xl font-bold text-foreground">{driver.name}</h3>
              <p className="text-sm text-muted-foreground">ID: #{driver.id.slice(0, 8).toUpperCase()}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn("font-bold", getIndividualSLAColor(driver.individual_sla))}>
                  SLA: {driver.individual_sla || 0}%
                </Badge>
                <Badge variant="secondary">
                  {vehicleLabels[driver.vehicle_type] || driver.vehicle_type}
                </Badge>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-medium text-foreground">{driver.phone}</p>
              </div>
              <Button 
                size="sm" 
                className="bg-green-500 hover:bg-green-600 text-white"
                onClick={handleWhatsApp}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                WhatsApp
              </Button>
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
                <p className="text-xs text-muted-foreground">Placa do Veículo</p>
                <p className="font-medium text-foreground">{driver.vehicle_plate}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">CNH</p>
                <p className="font-medium text-foreground">{driver.cnh}</p>
              </div>
              <Badge variant="outline" className="text-primary border-primary">
                Categoria {driver.cnh_category}
              </Badge>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">{driver.deliveries_completed || 0}</p>
              <p className="text-xs text-muted-foreground">Entregas Hoje</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className={cn("text-2xl font-bold", getIndividualSLAColor(driver.daily_sla))}>
                {driver.daily_sla || 0}%
              </p>
              <p className="text-xs text-muted-foreground">SLA Diário</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className={cn(
                "text-2xl font-bold",
                (driver.current_delay || 0) > 30 ? "text-red-600" : 
                (driver.current_delay || 0) > 15 ? "text-yellow-500" : "text-green-500"
              )}>
                {(driver.current_delay || 0) > 0 ? `${driver.current_delay}min` : "OK"}
              </p>
              <p className="text-xs text-muted-foreground">Atraso Atual</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
