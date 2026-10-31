import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import Map, { Marker, NavigationControl, FullscreenControl, type MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useResolvedTheme } from '@/components/theme/PreferencesProvider';
import { prefersReducedMotion, readPreferences } from '@/lib/preferences';
import { LiveMapFrame } from './LiveMapFrame';
import { mapFitPadding } from './mapOverlay';
import { countByStatus } from './mapStatus';
import { VehicleMarker, type FleetPosition } from './liveMapParts';

interface LiveMapMapboxProps {
  positions: FleetPosition[];
  mapboxToken: string;
  center: { longitude: number; latitude: number };
  onlineCount?: number;
  focusDriverId?: string | null;
  onFocusHandled?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  overlay?: ReactNode;
}

// Estilo do mapa acompanha o tema da tela.
const MAP_STYLE = {
  dark: "mapbox://styles/mapbox/dark-v11",
  light: "mapbox://styles/mapbox/light-v11",
} as const;

export default function LiveMapMapbox({
  positions,
  mapboxToken,
  center,
  onlineCount,
  focusDriverId,
  onFocusHandled,
  onRefresh,
  isRefreshing = false,
  overlay,
}: LiveMapMapboxProps) {
  const theme = useResolvedTheme();
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [viewState, setViewState] = useState({
    longitude: center.longitude,
    latitude: center.latitude,
    zoom: 11,
  });
  const mapRef = useRef<MapRef | null>(null);

  const counts = useMemo(() => countByStatus(positions), [positions]);

  // Enquadra todos os veiculos
  const hasOverlay = !!overlay;
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
      },
    );

    mapRef.current?.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      {
        padding: mapFitPadding(hasOverlay),
        duration: prefersReducedMotion(readPreferences()) ? 0 : 1000,
      },
    );
  }, [hasOverlay, positions]);

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
      duration: prefersReducedMotion(readPreferences()) ? 0 : 1200,
      essential: true,
    });

    onFocusHandled?.();
  }, [focusDriverId, onFocusHandled, positions]);

  if (!mapboxToken) {
    return <LiveMapFrame state="error" vehicleCount={positions.length} error="Token do Mapbox não configurado." overlay={overlay} />;
  }

  return (
    <LiveMapFrame
      vehicleCount={onlineCount ?? positions.length}
      counts={counts}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      onFitAll={fitBounds}
      overlay={overlay}
    >
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle={MAP_STYLE[theme]}
        mapboxAccessToken={mapboxToken}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-left" />
        <FullscreenControl position="top-left" />

        {positions.map((position) => {
          const isSelected = selectedDriver === position.driver_id;

          return (
            <Marker key={position.id} longitude={Number(position.longitude)} latitude={Number(position.latitude)} anchor="center">
              <VehicleMarker position={position} isSelected={isSelected} onToggle={() => setSelectedDriver(isSelected ? null : position.driver_id)} />
            </Marker>
          );
        })}
      </Map>
    </LiveMapFrame>
  );
}
