import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { vehicleMarkerHtml } from "@/lib/brandSymbol";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { prefersReducedMotion, readPreferences } from "@/lib/preferences";
import { whatsappNumber } from "@/lib/whatsapp";
import { vehicleTypeLabel } from "@/components/deliveries/status";
import { LiveMapFrame } from "./LiveMapFrame";
import { mapFitPadding } from "./mapOverlay";
import { VEHICLE_STATUS, countByStatus, vehicleStatus } from "./mapStatus";
import { plateLabel } from "./status";

interface FleetPosition {
  id: string;
  driver_id: string;
  driver_name: string;
  vehicle_plate?: string;
  vehicle_type?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  is_active: boolean;
  individual_sla?: number;
  deliveries_completed?: number;
  total_deliveries?: number;
  current_delay?: number;
  phone?: string;
  last_update: string;
  gpsStale?: boolean;
}

interface LiveMapLeafletProps {
  positions: FleetPosition[];
  center: { longitude: number; latitude: number };
  onlineCount?: number;
  focusDriverId?: string | null;
  onFocusHandled?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  overlay?: ReactNode;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Nome do marcador para leitor de tela: "Joao Silva, no prazo". */
function markerLabel(position: FleetPosition) {
  return `${position.driver_name || 'Motorista'}, ${VEHICLE_STATUS[vehicleStatus(position)].label.toLowerCase()}`;
}

// Popup com classes do tema (fica certo no claro e no escuro).
function buildPopup(position: FleetPosition) {
  const phone = whatsappNumber(position.phone);
  const status = VEHICLE_STATUS[vehicleStatus(position)];
  const updatedAt = position.last_update
    ? new Date(position.last_update).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : 'desconhecido';
  const sla = position.individual_sla !== undefined && position.individual_sla !== null
    ? `${Number(position.individual_sla).toFixed(1).replace(".", ",")}%`
    : '—';

  return `
    <div class="min-w-[15rem] p-4 font-sans text-popover-foreground">
      <p class="font-heading text-[0.9375rem] font-semibold leading-snug">${escapeHtml(position.driver_name || 'Motorista')}</p>
      <p class="mt-0.5 font-data text-xs tracking-wide text-muted-foreground">
        ${escapeHtml(plateLabel(position.vehicle_plate))}${position.vehicle_type ? ` · ${escapeHtml(vehicleTypeLabel(position.vehicle_type))}` : ''}
      </p>
      <p class="mt-2 inline-flex items-center gap-1.5 text-xs font-medium">
        <span class="h-2 w-2 rounded-full" style="background:${status.hex}"></span>${status.label}
      </p>
      <dl class="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><dt class="text-muted-foreground">Velocidade</dt><dd class="font-data font-semibold">${Number(position.speed || 0).toFixed(0)} km/h</dd></div>
        <div><dt class="text-muted-foreground">SLA</dt><dd class="font-data font-semibold">${sla}</dd></div>
        <div><dt class="text-muted-foreground">Atualizado</dt><dd class="font-data font-semibold">${escapeHtml(updatedAt)}</dd></div>
      </dl>
      ${
        phone
          ? `<a href="https://wa.me/${phone}" target="_blank" rel="noreferrer" class="mt-3 flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground no-underline hover:bg-primary-hover" style="color:hsl(var(--primary-foreground))">Chamar no WhatsApp</a>`
          : ''
      }
    </div>
  `;
}

export default function LiveMapLeaflet({
  positions,
  center,
  onlineCount,
  focusDriverId,
  onFocusHandled,
  onRefresh,
  isRefreshing = false,
  overlay,
}: LiveMapLeafletProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const counts = useMemo(() => countByStatus(positions), [positions]);

  const hasOverlay = !!overlay;
  const fitBounds = useCallback(() => {
    if (!mapRef.current || positions.length === 0) return;

    const bounds = L.latLngBounds(
      positions.map((position) => [Number(position.latitude), Number(position.longitude)]),
    );
    const pad = mapFitPadding(hasOverlay);
    mapRef.current.fitBounds(bounds, { paddingTopLeft: [pad.left, pad.top], paddingBottomRight: [pad.right, pad.bottom], maxZoom: 15 });
  }, [hasOverlay, positions]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const markers = markersRef.current;
    mapRef.current = L.map(containerRef.current, {
      center: [center.latitude, center.longitude],
      zoom: 11,
      zoomControl: false,
    });

    L.control.zoom({ zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(mapRef.current);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
      className: 'nhf-map-dark',
    }).addTo(mapRef.current);

    markerLayerRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      markers.clear();
    };
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    if (!mapRef.current || !markerLayerRef.current) return;

    markerLayerRef.current.clearLayers();
    markersRef.current.clear();

    positions.forEach((position) => {
      const status = VEHICLE_STATUS[vehicleStatus(position)];
      const label = markerLabel(position);
      const marker = L.marker([Number(position.latitude), Number(position.longitude)], {
        icon: L.divIcon({
          className: '',
          html: vehicleMarkerHtml(status.hex, Number(position.heading || 0)),
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
        title: label,
        alt: label,
        keyboard: true,
      }).bindPopup(buildPopup(position));

      marker.addTo(markerLayerRef.current!);
      // O icone e um <div role="button">: o nome vem do aria-label.
      marker.getElement()?.setAttribute('aria-label', `${label}. Ver detalhes`);
      markersRef.current.set(position.driver_id, marker);
    });

    if (positions.length > 0) {
      fitBounds();
    }
  }, [fitBounds, positions]);

  useEffect(() => {
    if (!focusDriverId || !mapRef.current) return;

    const marker = markersRef.current.get(focusDriverId);
    const focusedPosition = positions.find((position) => position.driver_id === focusDriverId);
    if (!marker || !focusedPosition) return;

    mapRef.current.flyTo(
      [Number(focusedPosition.latitude), Number(focusedPosition.longitude)],
      14,
      prefersReducedMotion(readPreferences()) ? { animate: false } : { duration: 1.2 },
    );
    marker.openPopup();
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
      <div ref={containerRef} role="region" aria-label="Mapa com a posição dos veículos" className="h-full w-full" />
    </LiveMapFrame>
  );
}
