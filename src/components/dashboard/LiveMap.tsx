import { useEffect, useState, useCallback, useMemo } from 'react';
import { Navigation, Radio, Truck as TruckIcon, MapPin, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { getCurrentTenantId } from '@/lib/tenant';

interface LiveMapProps {
  focusDriverId?: string | null;
  onFocusHandled?: () => void;
}

interface FleetPosition {
  id: string;
  driver_id: string;
  driver_name: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy?: number;
  battery_level?: number;
  is_active: boolean;
  individual_sla?: number;
  deliveries_completed?: number;
  total_deliveries?: number;
  current_delay?: number;
  last_update: string;
  // Enriched driver data
  driver_photo?: string;
  vehicle_plate?: string;
  vehicle_type?: string;
  phone?: string;
  status?: string;
}

interface DriverInfo {
  id: string;
  name: string;
  photo: string | null;
  phone: string;
  vehicle_plate: string;
  vehicle_type: string;
  status: string;
  individual_sla: number | null;
  deliveries_completed: number | null;
  total_deliveries: number | null;
  current_delay: number | null;
}

function normalizeMapboxToken(value: unknown): string | null {
  if (typeof value === 'string') {
    const token = value.trim();
    return token.length > 0 ? token : null;
  }

  if (value && typeof value === 'object') {
    const config = value as Record<string, unknown>;
    return normalizeMapboxToken(
      config.token ??
        config.mapbox_token ??
        config.mapboxToken ??
        config.VITE_MAPBOX_TOKEN ??
        config.access_token,
    );
  }

  return null;
}

function getEnvMapboxToken() {
  return normalizeMapboxToken(import.meta.env.VITE_MAPBOX_TOKEN);
}

// Loading placeholder component
function MapLoading({ positionCount }: { positionCount: number }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-4 bg-card">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Navigation className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground font-space-grotesk">Mapa em Tempo Real</h3>
            <p className="text-sm text-muted-foreground">
              {positionCount} veículos ativos • São Paulo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Radio className="h-4 w-4 animate-pulse" />
          <span className="text-xs font-medium">CARREGANDO</span>
        </div>
      </div>
      <div className="h-[500px] flex flex-col items-center justify-center bg-cyber-dark/50 backdrop-blur">
        <div className="relative">
          <MapPin className="h-16 w-16 text-primary/50 animate-pulse" />
          <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full animate-ping" />
        </div>
        <p className="text-muted-foreground mt-4 font-medium">Carregando mapa...</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Aguarde enquanto o Mapbox é inicializado
        </p>
      </div>
    </div>
  );
}

// Error placeholder component
function MapError({ positionCount, error, onRetry }: { positionCount: number; error: string; onRetry: () => void }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-4 bg-card">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-destructive/10 p-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground font-space-grotesk">Mapa em Tempo Real</h3>
            <p className="text-sm text-muted-foreground">
              {positionCount} veículos ativos • Erro ao carregar
            </p>
          </div>
        </div>
      </div>
      <div className="h-[500px] flex flex-col items-center justify-center bg-cyber-dark/50 backdrop-blur">
        <AlertTriangle className="h-16 w-16 text-destructive/50" />
        <p className="text-muted-foreground mt-4 font-medium">Erro ao carregar o mapa</p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-md text-center px-4">
          {error}
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4 gap-2"
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

export function LiveMap({ focusDriverId, onFocusHandled }: LiveMapProps) {
  const [positions, setPositions] = useState<FleetPosition[]>([]);
  const [driversInfo, setDriversInfo] = useState<Map<string, DriverInfo>>(new Map());
  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [isRefreshingPositions, setIsRefreshingPositions] = useState(false);

  // Show active drivers based on their last known GPS position, even if the app is closed.
  const visiblePositions = useMemo(() => {
    const now = Date.now();
    const GPS_STALE_MS = 2 * 60 * 1000; // 2 minutes

    return positions
      .map((p) => {
        const lastUpdateMs = p.last_update ? new Date(p.last_update).getTime() : 0;
        const gpsStale = (now - lastUpdateMs) > GPS_STALE_MS;
        return { ...p, gpsStale };
      });
  }, [positions]);

  // Cleanup ghost drivers (offline for 15+ minutes) on mount and every 60 seconds
  useEffect(() => {
    // 1. Clean immediately on mount to remove expired drivers
    supabase.rpc('cleanup_ghost_drivers');

    // 2. Keep map clean by running every 60 seconds
    const cleanupInterval = setInterval(() => {
      supabase.rpc('cleanup_ghost_drivers');
    }, 60000); // 1 minute

    return () => clearInterval(cleanupInterval);
  }, []);

  // Fetch Mapbox token from app_config table. If it is absent, fall back to OpenStreetMap.
  useEffect(() => {
    const fetchMapboxToken = async () => {
      setTokenLoading(true);
      try {
        const envToken = getEnvMapboxToken();
        const { data, error } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'mapbox_token')
          .maybeSingle();

        if (error) {
          console.warn('Error fetching Mapbox token:', error);
          setMapboxToken(envToken);
          setTokenLoading(false);
          return;
        }

        if (typeof window === 'undefined' && !data?.value && !envToken) {
          console.error('Mapbox token not found in app_config');
          setLoadError('Token do Mapbox não encontrado na tabela app_config.');
          setTokenLoading(false);
          return;
        }

        setMapboxToken(normalizeMapboxToken(data?.value) ?? envToken);
        setTokenLoading(false);
      } catch (err) {
        console.warn('Failed to fetch Mapbox token:', err);
        setMapboxToken(getEnvMapboxToken());
        setTokenLoading(false);
      }
    };

    fetchMapboxToken();
  }, []);

  // Fetch drivers info for enrichment
  const fetchDriversInfo = useCallback(async () => {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) return;

    const { data, error } = await supabase
      .from('drivers')
      .select('id, name, photo, phone, vehicle_plate, vehicle_type, status, individual_sla, deliveries_completed, total_deliveries, current_delay')
      .eq('tenant_id', tenantId);

    if (!error && data) {
      const driversMap = new Map<string, DriverInfo>();
      data.forEach((driver) => {
        driversMap.set(driver.id, driver as DriverInfo);
      });
      setDriversInfo(driversMap);
    } else if (error) {
      console.warn('Error fetching drivers for map enrichment:', error);
    }
  }, []);

  // Enrich position with driver data
  const enrichPosition = useCallback((position: any): FleetPosition => {
    const driverInfo = driversInfo.get(position.driver_id);
    return {
      ...position,
      driver_photo: driverInfo?.photo || undefined,
      vehicle_plate: driverInfo?.vehicle_plate || position.vehicle_plate,
      vehicle_type: driverInfo?.vehicle_type || position.vehicle_type,
      phone: driverInfo?.phone || undefined,
      status: driverInfo?.status || undefined,
      individual_sla: driverInfo?.individual_sla ?? position.individual_sla,
      deliveries_completed: driverInfo?.deliveries_completed ?? position.deliveries_completed,
      total_deliveries: driverInfo?.total_deliveries ?? position.total_deliveries,
      current_delay: driverInfo?.current_delay ?? position.current_delay,
    };
  }, [driversInfo]);

  // Fetch initial positions - ONLY active drivers
  const fetchPositions = useCallback(async () => {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
      setPositions([]);
      return;
    }

    const { data, error } = await supabase
      .from('fleet_positions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (!error && data) {
      const enrichedPositions = data.map(enrichPosition);
      setPositions(enrichedPositions);
    } else if (error) {
      console.warn('Error fetching fleet positions:', error);
    }
  }, [enrichPosition]);

  const refreshPositions = useCallback(async () => {
    setIsRefreshingPositions(true);
    try {
      await fetchPositions();
    } finally {
      setIsRefreshingPositions(false);
    }
  }, [fetchPositions]);

  // Fetch drivers info first and subscribe to changes
  useEffect(() => {
    fetchDriversInfo();

    // Subscribe to driver changes to keep map info updated
    const driversChannel = supabase
      .channel('drivers-map-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const driver = payload.new as DriverInfo;
            setDriversInfo((prev) => {
              const newMap = new Map(prev);
              newMap.set(driver.id, driver);
              return newMap;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setDriversInfo((prev) => {
              const newMap = new Map(prev);
              newMap.delete(deletedId);
              return newMap;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(driversChannel);
    };
  }, [fetchDriversInfo]);

  // Fetch positions independently. Driver enrichment is optional; GPS markers
  // should appear even if driver details are blocked or still loading.
  useEffect(() => {
    fetchPositions();
    const positionsInterval = setInterval(fetchPositions, 3 * 60 * 1000);

    return () => clearInterval(positionsInterval);
  }, [fetchPositions]);

  // Load the Map component. Mapbox is preferred, Leaflet/OpenStreetMap is the no-token fallback.
  const loadMapComponent = useCallback(() => {
    if (tokenLoading) return;

    setIsLoading(true);
    setLoadError(null);
    
    const componentImport = mapboxToken
      ? import('./LiveMapMapbox')
      : import('./LiveMapLeaflet');

    componentImport.then((module) => {
      setMapComponent(() => module.default);
      setIsLoading(false);
    }).catch((err) => {
      console.error('Failed to load map component:', err);
      setLoadError('Não foi possível carregar o componente do mapa. Verifique sua conexão.');
      setIsLoading(false);
    });
  }, [mapboxToken, tokenLoading]);

  useEffect(() => {
    loadMapComponent();
  }, [loadMapComponent]);

  // Show loading state (token or component loading)
  if (tokenLoading || isLoading) {
    return <MapLoading positionCount={positions.length} />;
  }

  // Show error state
  if (loadError) {
    return <MapError positionCount={positions.length} error={loadError} onRetry={() => window.location.reload()} />;
  }

  // Mapbox is optional. Without a token the component uses OpenStreetMap.
  if (typeof window === 'undefined' && !mapboxToken) {
    return (
      <MapError 
        positionCount={positions.length} 
        error="Token do Mapbox não encontrado. Verifique a tabela app_config no banco de dados."
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!MapComponent) {
    return <MapLoading positionCount={positions.length} />;
  }

  return (
    <MapComponent 
      positions={visiblePositions} 
      mapboxToken={mapboxToken}
      center={{ longitude: -46.6333, latitude: -23.5505 }}
      onlineCount={visiblePositions.length}
      focusDriverId={focusDriverId}
      onFocusHandled={onFocusHandled}
      onRefresh={refreshPositions}
      isRefreshing={isRefreshingPositions}
    />
  );
}
