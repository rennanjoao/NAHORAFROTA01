import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import Map, { Marker, NavigationControl, FullscreenControl, AttributionControl, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useResolvedTheme } from '@/components/theme/PreferencesProvider';
import { prefersReducedMotion, readPreferences } from '@/lib/preferences';
import { LiveMapFrame } from './LiveMapFrame';
import { mapFitPadding } from './mapOverlay';
import { countByStatus } from './mapStatus';
import { useBrandMapStyle } from './brandMapStyle';
import { VehicleMarker, type FleetPosition } from './liveMapParts';

interface LiveMapVectorProps {
  positions: FleetPosition[];
  mapboxToken?: string | null;
  center: { longitude: number; latitude: number };
  onlineCount?: number;
  focusDriverId?: string | null;
  onFocusHandled?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  overlay?: ReactNode;
}

/*
 * Mapa vetorial sem chave: OpenFreeMap (gratis, uso comercial liberado, sem limite de
 * visualizacoes, exige so a atribuicao, que o MapLibre mostra sozinho). Estilo segue o
 * tema; o escuro ganha a paleta da marca (brandMapStyle.ts). Com um token do Mapbox
 * configurado, o painel usa o LiveMapMapbox no lugar deste.
 */

export default function LiveMapVector({
  positions,
  center,
  onlineCount,
  focusDriverId,
  onFocusHandled,
  onRefresh,
  isRefreshing = false,
  overlay,
}: LiveMapVectorProps) {
  const theme = useResolvedTheme();
  const mapStyle = useBrandMapStyle(theme);
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

  return (
    <LiveMapFrame
      vehicleCount={onlineCount ?? positions.length}
      counts={counts}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      onFitAll={fitBounds}
      overlay={overlay}
    >
      {mapStyle && (
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <AttributionControl compact position="bottom-right" />
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
      )}
    </LiveMapFrame>
  );
}
