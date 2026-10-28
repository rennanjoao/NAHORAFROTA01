import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Navigation, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Package,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { DriverDelivery } from '@/hooks/useDriverManifest';

interface DeliveryListProps {
  deliveries: DriverDelivery[];
  onNavigate: (delivery: DriverDelivery) => void;
  onFinishDelivery?: (delivery: DriverDelivery) => void;
  onRegisterOccurrence?: (delivery: DriverDelivery) => void;
  onForceSync?: () => Promise<void>;
}

const statusConfig: Record<string, { 
  label: string; 
  icon: React.ElementType; 
  color: string;
  bgColor: string;
}> = {
  pending: { 
    label: 'Pendente', 
    icon: Clock, 
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
  },
  in_transit: { 
    label: 'Em Trânsito', 
    icon: Navigation, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30'
  },
  loaded: { 
    label: 'Carregado', 
    icon: Package, 
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30'
  },
  delivered: { 
    label: 'Entregue', 
    icon: CheckCircle, 
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30'
  },
  occurrence: { 
    label: 'Ocorrência', 
    icon: AlertCircle, 
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30'
  },
  returned: { 
    label: 'Devolvido', 
    icon: AlertTriangle, 
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30'
  },
};

function DeliveryItem({ 
  delivery, 
  index,
  onNavigate,
  onFinishDelivery,
  onRegisterOccurrence
}: { 
  delivery: DriverDelivery; 
  index: number;
  onNavigate: (delivery: DriverDelivery) => void;
  onFinishDelivery?: (delivery: DriverDelivery) => void;
  onRegisterOccurrence?: (delivery: DriverDelivery) => void;
}) {
  const status = statusConfig[delivery.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const isDelivered = delivery.status === 'delivered';
  const hasOccurrence = delivery.status === 'occurrence' || delivery.status === 'returned';
  const isPending = !isDelivered && !hasOccurrence;
  
  // Build display address
  const displayAddress = delivery.address_street && delivery.address_number
    ? `${delivery.address_street}, ${delivery.address_number}`
    : delivery.address_full?.split(',').slice(0, 2).join(',') || 'Endereço não disponível';

  const cityInfo = delivery.address_city || '';

  return (
    <Card className={`p-4 ${isDelivered ? 'opacity-60 bg-muted/30' : hasOccurrence ? 'bg-orange-50/50 dark:bg-orange-900/10' : 'bg-card'}`}>
      <div className="flex gap-3">
        {/* Index Number */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
          ${isDelivered 
            ? 'bg-green-500 text-white' 
            : hasOccurrence 
              ? 'bg-orange-500 text-white'
              : 'bg-primary text-primary-foreground'}
        `}>
          {isDelivered ? (
            <CheckCircle className="h-4 w-4" />
          ) : hasOccurrence ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            index
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header with name and status */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold truncate ${isDelivered ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {delivery.recipient_name}
              </h3>
              {delivery.nfe_number && (
                <p className="text-[10px] text-muted-foreground">NF-e: {delivery.nfe_number}</p>
              )}
              {delivery.arrived_at && !isDelivered && !hasOccurrence && (
                <p className="text-[10px] font-medium text-blue-600 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Você chegou às {new Date(delivery.arrived_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <Badge 
              variant="outline" 
              className={`${status.bgColor} ${status.color} border-0 text-[10px] px-2 py-0.5 flex-shrink-0`}
            >
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>

          {/* Address */}
          <div className="flex items-start gap-1.5 text-sm text-muted-foreground mb-3">
            <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="line-clamp-2">{displayAddress}</p>
              {cityInfo && <p className="text-xs">{cityInfo}</p>}
            </div>
          </div>

          {/* Action Buttons - Only for pending deliveries */}
          {isPending && (
            <div className="space-y-2">
              {/* Navigation Button */}
              <Button
                onClick={() => onNavigate(delivery)}
                size="lg"
                className="w-full h-12 gap-2 bg-[#33ccff] hover:bg-[#2bb8e8] text-black font-bold"
              >
                <Navigation className="h-5 w-5" />
                Navegar
                <ExternalLink className="h-4 w-4" />
              </Button>
              
              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 gap-2">
                {/* Finish Delivery Button */}
                {onFinishDelivery && (
                  <Button
                    onClick={() => onFinishDelivery(delivery)}
                    size="lg"
                    className="h-12 gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold"
                  >
                    <CheckCircle className="h-5 w-5" />
                    Finalizar
                  </Button>
                )}
                
                {/* Occurrence Button */}
                {onRegisterOccurrence && (
                  <Button
                    onClick={() => onRegisterOccurrence(delivery)}
                    size="lg"
                    variant="outline"
                    className="h-12 gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950 font-semibold"
                  >
                    <AlertTriangle className="h-5 w-5" />
                    Ocorrência
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Delivered/Occurrence status message */}
          {isDelivered && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
              <CheckCircle className="h-4 w-4" />
              <span>Entrega concluída</span>
            </div>
          )}
          
          {hasOccurrence && (
            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span>Ocorrência registrada</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function DeliveryList({ 
  deliveries, 
  onNavigate, 
  onFinishDelivery,
  onRegisterOccurrence,
  onForceSync
}: DeliveryListProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleForceSync = async () => {
    if (!onForceSync) return;
    setIsSyncing(true);
    try {
      await onForceSync();
    } finally {
      setIsSyncing(false);
    }
  };

  if (deliveries.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-semibold text-lg mb-2">Nenhuma entrega encontrada</h3>
        <p className="text-sm text-muted-foreground">
          Nenhuma entrega vinculada a este romaneio.
          <br />
          Contate a base para mais informações.
        </p>
      </Card>
    );
  }

  // Sort: pending first, then in_transit, then occurrence, then delivered
  const sortedDeliveries = [...deliveries].sort((a, b) => {
    const order = { pending: 0, in_transit: 1, loaded: 1, occurrence: 2, returned: 2, delivered: 3 };
    return (order[a.status as keyof typeof order] ?? 1) - (order[b.status as keyof typeof order] ?? 1);
  });

  const pendingCount = deliveries.filter(d => d.status !== 'delivered' && d.status !== 'occurrence' && d.status !== 'returned').length;
  const deliveredCount = deliveries.filter(d => d.status === 'delivered').length;
  const occurrenceCount = deliveries.filter(d => d.status === 'occurrence' || d.status === 'returned').length;

  return (
    <div className="space-y-3">
      {/* Header with Sync Button */}
      <div className="flex items-center justify-between px-1">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Entregas
        </h2>
        <div className="flex gap-2 items-center">
          {onForceSync && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleForceSync}
              disabled={isSyncing}
              className="h-7 px-2 gap-1 text-xs"
            >
              {isSyncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Sincronizar
            </Button>
          )}
          {occurrenceCount > 0 && (
            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
              {occurrenceCount} ocorrência{occurrenceCount !== 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {deliveredCount}/{deliveries.length} feitas
          </Badge>
        </div>
      </div>

      {/* Delivery Items */}
      <div className="space-y-3">
        {sortedDeliveries.map((delivery, index) => (
          <DeliveryItem
            key={delivery.id}
            delivery={delivery}
            index={index + 1}
            onNavigate={onNavigate}
            onFinishDelivery={onFinishDelivery}
            onRegisterOccurrence={onRegisterOccurrence}
          />
        ))}
      </div>
    </div>
  );
}
