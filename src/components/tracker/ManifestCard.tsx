import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, Calendar, MapPin } from 'lucide-react';
import { DriverManifest } from '@/hooks/useDriverManifest';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ManifestCardProps {
  manifest: DriverManifest;
  completedCount: number;
  totalCount: number;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Aguardando', variant: 'secondary' },
  in_progress: { label: 'Em Rota', variant: 'default' },
  active: { label: 'Em Rota', variant: 'default' },
  assigned: { label: 'Atribuído', variant: 'outline' },
};

export function ManifestCard({ manifest, completedCount, totalCount }: ManifestCardProps) {
  const status = statusConfig[manifest.status] || { label: manifest.status, variant: 'outline' };
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-foreground">
              Romaneio #{manifest.manifest_number || manifest.manifest_code.slice(-4)}
            </h2>
            <p className="text-xs text-muted-foreground">{manifest.manifest_code}</p>
          </div>
        </div>
        <Badge variant={status.variant} className="text-sm px-3 py-1">
          {status.label}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="flex flex-col items-center p-2 bg-background/50 rounded-lg">
          <Package className="h-4 w-4 text-muted-foreground mb-1" />
          <span className="text-lg font-bold">{totalCount}</span>
          <span className="text-[10px] text-muted-foreground">Entregas</span>
        </div>
        <div className="flex flex-col items-center p-2 bg-background/50 rounded-lg">
          <MapPin className="h-4 w-4 text-green-500 mb-1" />
          <span className="text-lg font-bold text-green-600">{completedCount}</span>
          <span className="text-[10px] text-muted-foreground">Feitas</span>
        </div>
        <div className="flex flex-col items-center p-2 bg-background/50 rounded-lg">
          <Calendar className="h-4 w-4 text-muted-foreground mb-1" />
          <span className="text-xs font-medium">
            {format(new Date(manifest.scheduled_date), 'dd/MM', { locale: ptBR })}
          </span>
          <span className="text-[10px] text-muted-foreground">Data</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-medium">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Vehicle Info */}
      {manifest.vehicle_plate && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <span>Veículo: {manifest.vehicle_plate}</span>
          <span>{manifest.driver_name}</span>
        </div>
      )}
    </Card>
  );
}
