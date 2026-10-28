import { useState, useRef, useCallback, useEffect } from 'react';
import Map, { Marker, NavigationControl, FullscreenControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Navigation, Radio, RefreshCw, Truck as TruckIcon, MessageCircle, Gauge, Battery, MapPin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { openWhatsApp } from "@/lib/whatsapp";

interface FleetPosition {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_photo?: string;
  vehicle_plate?: string;
  vehicle_type?: string;
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
  phone?: string;
  status?: string;
  last_update: string;
  gpsStale?: boolean;
}

interface LiveMapMapboxProps {
  positions: FleetPosition[];
  mapboxToken: string;
  center: { longitude: number; latitude: number };
  onlineCount?: number;
  focusDriverId?: string | null;
  onFocusHandled?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

export default function LiveMapMapbox({
  positions,
  mapboxToken,
  center,
  onlineCount,
  focusDriverId,
  onFocusHandled,
  onRefresh,
  isRefreshing = false,
}: LiveMapMapboxProps) {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [viewState, setViewState] = useState({
    longitude: center.longitude,
    latitude: center.latitude,
    zoom: 11,
  });
  const mapRef = useRef<any>(null);

  // Calculate marker color based on GPS stale / SLA / delay
  const getMarkerColor = (position: FleetPosition) => {
    // GPS stale = red (Sem Sinal)
    if (position.gpsStale) {
      return '#DC2626'; // Red-600 - GPS stale
    }
    if (position.current_delay && position.current_delay > 0) {
      return '#FF1F1F'; // Neon red - delayed
    }
    if (position.individual_sla && position.individual_sla < 90) {
      return '#FFA500'; // Orange - at risk
    }
    return '#4ADE80'; // Green - on time
  };

  // Fit bounds to show all vehicles
  const fitBounds = useCallback(() => {
    if (!mapRef.current || positions.length === 0) return;

    const bounds = positions.reduce(
      (acc, pos) => ({
        minLng: Math.min(acc.minLng, Number(pos.longitude)),
        maxLng: Math.max(acc.maxLng, Number(pos.longitude)),
        minLat: Math.min(acc.minLat, Number(pos.latitude)),
        maxLat: Math.max(acc.maxLat, Number(pos.latitude)),
      }),
      {
        minLng: Number(positions[0].longitude),
        maxLng: Number(positions[0].longitude),
        minLat: Number(positions[0].latitude),
        maxLat: Number(positions[0].latitude),
      }
    );

    mapRef.current?.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      {
        padding: 50,
        duration: 1000,
      }
    );
  }, [positions]);

  useEffect(() => {
    if (!focusDriverId || !mapRef.current) return;

    const focusedPosition = positions.find((position) => position.driver_id === focusDriverId);
    if (!focusedPosition) return;

    setSelectedDriver(focusedPosition.driver_id);
    setViewState((current) => ({
      ...current,
      longitude: Number(focusedPosition.longitude),
      latitude: Number(focusedPosition.latitude),
      zoom: Math.max(current.zoom, 14),
    }));

    mapRef.current.flyTo({
      center: [Number(focusedPosition.longitude), Number(focusedPosition.latitude)],
      zoom: 14,
      duration: 1200,
      essential: true,
    });

    onFocusHandled?.();
  }, [focusDriverId, onFocusHandled, positions]);

  const handleWhatsApp = (phone?: string) => {
    if (!phone) return;
    openWhatsApp(phone);
  };

  const onTimeCount = positions.filter(p => !p.gpsStale && (!p.current_delay || p.current_delay === 0)).length;
  const delayedCount = positions.filter(p => !p.gpsStale && p.current_delay && p.current_delay > 0).length;
  const staleCount = positions.filter(p => p.gpsStale).length;

  // If no Mapbox token, show a message
  if (!mapboxToken) {
    return (
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Navigation className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Mapa em Tempo Real</h3>
              <p className="text-sm text-muted-foreground">Configure o token do Mapbox</p>
            </div>
          </div>
        </div>
        <div className="h-[500px] flex items-center justify-center bg-cyber-dark">
          <p className="text-muted-foreground">Token do Mapbox não configurado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between border-b border-border p-4 bg-card gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Navigation className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground font-space-grotesk">Mapa em Tempo Real - Mapbox</h3>
            <p className="text-sm text-muted-foreground">
              {positions.length === 1 ? "1 veículo ativo" : `${positions.length} veículos ativos`} • São Paulo
            </p>
          </div>
        </div>
        <div className="flex flex-1 justify-start lg:justify-center">
          <button
            type="button"
            onClick={onRefresh}
            disabled={!onRefresh || isRefreshing}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar mapa
          </button>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">No Prazo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground">Atrasado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-600 animate-pulse" />
            <span className="text-xs text-muted-foreground">Sem Sinal</span>
          </div>
          <div className="flex items-center gap-1.5 text-success">
            <Radio className="h-4 w-4 animate-pulse" />
            <span className="text-xs font-medium">AO VIVO</span>
          </div>
          <button
            onClick={fitBounds}
            className="text-xs text-primary hover:underline"
          >
            Ver todos
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="relative h-[500px]">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapStyle={MAP_STYLE}
          mapboxAccessToken={mapboxToken}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="top-left" />
          <FullscreenControl position="top-left" />

          {/* Driver markers */}
          {positions.map((position) => {
            const markerColor = getMarkerColor(position);
            const isSelected = selectedDriver === position.driver_id;

            return (
              <Marker
                key={position.id}
                longitude={Number(position.longitude)}
                latitude={Number(position.latitude)}
                anchor="center"
              >
                {/* Container separates rotating marker from static popup */}
                <div className="relative">
                  {/* Rotating truck marker */}
                  <div
                    className="relative cursor-pointer transition-transform hover:scale-110"
                    style={{ transform: `rotate(${position.heading || 0}deg)` }}
                    onClick={() => setSelectedDriver(isSelected ? null : position.driver_id)}
                  >
                    {/* Speed badge - counter-rotate to stay horizontal */}
                    {position.speed > 0 && !position.gpsStale && (
                      <div
                        className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap"
                        style={{ 
                          backgroundColor: markerColor,
                          transform: `rotate(${-(position.heading || 0)}deg)`
                        }}
                      >
                        {Number(position.speed).toFixed(0)} km/h
                      </div>
                    )}

                    {/* GPS Stale badge - "Sem Sinal" */}
                    {position.gpsStale && (
                      <div
                        className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap animate-pulse"
                        style={{ 
                          backgroundColor: '#DC2626',
                          transform: `rotate(${-(position.heading || 0)}deg)`
                        }}
                      >
                        ⚠ Sem Sinal
                      </div>
                    )}

                    {/* Truck icon */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                      style={{
                        backgroundColor: markerColor,
                        boxShadow: `0 0 20px ${markerColor}80`,
                      }}
                    >
                      <TruckIcon className="h-5 w-5 text-white" />
                    </div>
                  </div>

                  {/* Static popup - NOT inside rotating container */}
                  {isSelected && (
                    <div
                      className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl p-4 min-w-[280px] z-50 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header with driver info */}
                      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border">
                        <div className="relative flex-shrink-0">
                          {position.driver_photo ? (
                            <img
                              src={position.driver_photo}
                              alt={position.driver_name}
                              className="w-11 h-11 rounded-full object-cover border-2 border-primary"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary">
                              <TruckIcon className="h-5 w-5 text-primary" />
                            </div>
                          )}
                          {/* Status indicator */}
                          <div 
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card",
                              position.is_active ? "bg-green-500" : "bg-muted"
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground text-sm truncate">
                            {position.driver_name || 'Motorista'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {position.vehicle_plate && (
                              <span className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px] font-medium">
                                {position.vehicle_plate}
                              </span>
                            )}
                            {position.vehicle_type && (
                              <span className="capitalize">{position.vehicle_type}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {/* Speed */}
                        <div className="bg-muted/50 rounded-lg p-2 flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-primary/10">
                            <Gauge className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Velocidade</p>
                            <p className="text-sm font-bold text-foreground font-space-grotesk">
                              {position.speed !== undefined ? `${Number(position.speed).toFixed(0)} km/h` : '0 km/h'}
                            </p>
                          </div>
                        </div>

                        {/* SLA */}
                        <div className="bg-muted/50 rounded-lg p-2 flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-md",
                            position.individual_sla !== undefined && Number(position.individual_sla) >= 95 
                              ? "bg-green-500/10" 
                              : position.individual_sla !== undefined && Number(position.individual_sla) >= 90 
                                ? "bg-yellow-500/10" 
                                : "bg-primary/10"
                          )}>
                            <div className={cn(
                              "h-4 w-4 rounded-full",
                              position.individual_sla !== undefined && Number(position.individual_sla) >= 95 
                                ? "bg-green-500" 
                                : position.individual_sla !== undefined && Number(position.individual_sla) >= 90 
                                  ? "bg-yellow-500" 
                                  : "bg-primary"
                            )} />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">SLA</p>
                            <p className={cn(
                              "text-sm font-bold font-space-grotesk",
                              position.individual_sla !== undefined && Number(position.individual_sla) >= 95 
                                ? "text-green-500" 
                                : position.individual_sla !== undefined && Number(position.individual_sla) >= 90 
                                  ? "text-yellow-500" 
                                  : "text-primary"
                            )}>
                              {position.individual_sla !== undefined 
                                ? `${Number(position.individual_sla).toFixed(1)}%` 
                                : '—'}
                            </p>
                          </div>
                        </div>

                        {/* Battery */}
                        <div className="bg-muted/50 rounded-lg p-2 flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-md",
                            position.battery_level !== undefined && position.battery_level > 50 
                              ? "bg-green-500/10" 
                              : position.battery_level !== undefined && position.battery_level > 20 
                                ? "bg-yellow-500/10" 
                                : "bg-destructive/10"
                          )}>
                            <Battery className={cn(
                              "h-4 w-4",
                              position.battery_level !== undefined && position.battery_level > 50 
                                ? "text-green-500" 
                                : position.battery_level !== undefined && position.battery_level > 20 
                                  ? "text-yellow-500" 
                                  : "text-destructive"
                            )} />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Bateria</p>
                            <p className="text-sm font-bold text-foreground font-space-grotesk">
                              {position.battery_level !== undefined ? `${position.battery_level}%` : '—'}
                            </p>
                          </div>
                        </div>

                        {/* Accuracy */}
                        <div className="bg-muted/50 rounded-lg p-2 flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-primary/10">
                            <MapPin className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Precisão</p>
                            <p className="text-sm font-bold text-foreground font-space-grotesk">
                              {position.accuracy !== undefined ? `±${Number(position.accuracy).toFixed(0)}m` : '—'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Delay Warning */}
                      {position.current_delay !== undefined && position.current_delay > 0 && (
                        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 mb-3 flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-destructive/20">
                            <Clock className="h-4 w-4 text-destructive" />
                          </div>
                          <span className="text-sm text-destructive font-semibold">
                            Atraso de {position.current_delay} min
                          </span>
                        </div>
                      )}

                      {/* Deliveries progress */}
                      {position.deliveries_completed !== undefined && position.total_deliveries !== undefined && position.total_deliveries > 0 && (
                        <div className="mb-3 border-t border-border pt-3">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-muted-foreground">Entregas</span>
                            <span className="text-foreground font-bold font-space-grotesk">
                              {position.deliveries_completed}/{position.total_deliveries}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${(position.deliveries_completed / position.total_deliveries) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Last update */}
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3 border-t border-border pt-2">
                        <Clock className="h-3 w-3" />
                        <span>Atualizado: {position.last_update 
                          ? new Date(position.last_update).toLocaleTimeString('pt-BR') 
                          : 'Desconhecido'}</span>
                      </div>

                      {/* WhatsApp Button */}
                      {position.phone ? (
                        <button
                          onClick={() => handleWhatsApp(position.phone)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-colors shadow-md"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Abrir WhatsApp
                        </button>
                      ) : (
                        <div className="text-xs text-center text-muted-foreground py-1">
                          Telefone não cadastrado
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Marker>
            );
          })}
        </Map>

        {/* Stats Overlay */}
        <div className="absolute top-4 right-4 z-10 bg-cyber-dark/95 backdrop-blur rounded-lg p-3 shadow-lg border border-border">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500 font-space-grotesk">{onTimeCount}</p>
              <p className="text-xs text-muted-foreground">No Prazo</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary font-space-grotesk">{delayedCount}</p>
              <p className="text-xs text-muted-foreground">Atrasados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500 font-space-grotesk">{staleCount}</p>
              <p className="text-xs text-muted-foreground">Sem Sinal</p>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {positions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-cyber-dark/80 backdrop-blur-sm">
            <div className="text-center p-6">
              <TruckIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">Nenhum veículo ativo</p>
              <p className="text-sm text-muted-foreground">
                Aguardando motoristas iniciarem o rastreamento GPS
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
