import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uniqueChannelName } from "@/lib/realtime";
import { getCurrentTenantId } from '@/lib/tenant';
import { useDriverActivity } from '@/hooks/useDriverActivity';
import { LiveMapFrame } from './LiveMapFrame';

interface LiveMapProps {
  focusDriverId?: string | null;
  onFocusHandled?: () => void;
  /** Painel de vidro sobre o mapa (atualizacoes dos motoristas). */
  overlay?: ReactNode;
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
  hasOccurrence?: boolean;
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

/** Props comuns das duas versoes do mapa (Mapbox e OpenStreetMap). */
interface MapViewProps {
  positions: (FleetPosition & { gpsStale: boolean })[];
  mapboxToken: string | null;
  center: { longitude: number; latitude: number };
  onlineCount: number;
  focusDriverId?: string | null;
  onFocusHandled?: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  overlay?: ReactNode;
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

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function LiveMap({ focusDriverId, onFocusHandled, overlay }: LiveMapProps) {
  const [positions, setPositions] = useState<FleetPosition[]>([]);
  const [driversInfo, setDriversInfo] = useState<Map<string, DriverInfo>>(new Map());
  const [MapComponent, setMapComponent] = useState<React.ComponentType<MapViewProps> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [isRefreshingPositions, setIsRefreshingPositions] = useState(false);

  // Ultima atualizacao foi ocorrencia: marcador vermelho ate o motorista seguir.
  const { withOccurrence } = useDriverActivity();

  // Show active drivers based on their last known GPS position, even if the app is closed.
  const visiblePositions = useMemo(() => {
    const now = Date.now();
    const GPS_STALE_MS = 2 * 60 * 1000; // 2 minutes

    return positions
      .map((p) => {
        const lastUpdateMs = p.last_update ? new Date(p.last_update).getTime() : 0;
        const gpsStale = (now - lastUpdateMs) > GPS_STALE_MS;
        return { ...p, gpsStale, hasOccurrence: withOccurrence.has(p.driver_id) };
      });
  }, [positions, withOccurrence]);

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
  const enrichPosition = useCallback((position: FleetPosition): FleetPosition => {
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
    // Sem internet mantem a ultima posicao conhecida (antes zerava o mapa:
    // "0 veiculos com GPS ligado").
    if (!navigator.onLine) return;
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
      // Linhas do banco tem null onde o tipo da tela usa undefined; o enriquecimento cobre os dois.
      const enrichedPositions = data.map((row) => enrichPosition(row as unknown as FleetPosition));
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
      .channel(uniqueChannelName("drivers-map-sync"))
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
            const deletedId = (payload.old as { id?: string }).id;
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
    
    // Com token do Mapbox: Mapbox. Sem token: mapa vetorial gratis (MapLibre + OpenFreeMap).
    // Sem WebGL (navegador muito antigo): Leaflet com OpenStreetMap.
    const componentImport = mapboxToken
      ? import('./LiveMapMapbox')
      : hasWebGL()
        ? import('./LiveMapVector')
        : import('./LiveMapLeaflet');

    componentImport.then((module) => {
      setMapComponent(() => module.default as React.ComponentType<MapViewProps>);
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

  // Carregando (token ou componente do mapa)
  if (tokenLoading || isLoading || (!MapComponent && !loadError)) {
    return <LiveMapFrame state="loading" vehicleCount={positions.length} overlay={overlay} />;
  }

  if (loadError) {
    return <LiveMapFrame state="error" vehicleCount={positions.length} error={loadError} onRetry={() => window.location.reload()} overlay={overlay} />;
  }

  // Mapbox e opcional. Sem token o componente usa o OpenStreetMap.
  if (typeof window === 'undefined' && !mapboxToken) {
    return (
      <LiveMapFrame
        state="error"
        vehicleCount={positions.length}
        error="Token do Mapbox não encontrado. Verifique a tabela app_config no banco de dados."
        onRetry={() => window.location.reload()}
        overlay={overlay}
      />
    );
  }

  if (!MapComponent) {
    return <LiveMapFrame state="loading" vehicleCount={positions.length} overlay={overlay} />;
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
      overlay={overlay}
    />
  );
}
