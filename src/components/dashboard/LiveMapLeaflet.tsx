import { useCallback, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Radio, RefreshCw, Truck as TruckIcon } from 'lucide-react';
import { whatsappNumber } from "@/lib/whatsapp";

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
}

function getMarkerColor(position: FleetPosition) {
  if (position.gpsStale) return '#dc2626';
  if (position.current_delay && position.current_delay > 0) return '#ff1f1f';
  if (position.individual_sla && position.individual_sla < 90) return '#f59e0b';
  return '#22c55e';
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPopup(position: FleetPosition) {
  const phone = whatsappNumber(position.phone);
  const updatedAt = position.last_update
    ? new Date(position.last_update).toLocaleTimeString('pt-BR')
    : 'Desconhecido';

  return `
    <div style="min-width:220px;font-family:Inter,system-ui,sans-serif">
      <strong>${escapeHtml(position.driver_name || 'Motorista')}</strong>
      <div style="margin-top:6px;color:#64748b;font-size:12px">
        ${escapeHtml(position.vehicle_plate || 'Placa pendente')}
        ${position.vehicle_type ? ` - ${escapeHtml(position.vehicle_type)}` : ''}
      </div>
      <div style="margin-top:8px;font-size:12px">
        Velocidade: <strong>${Number(position.speed || 0).toFixed(0)} km/h</strong><br />
        SLA: <strong>${position.individual_sla !== undefined ? `${Number(position.individual_sla).toFixed(1)}%` : '-'}</strong><br />
        Atualizado: <strong>${escapeHtml(updatedAt)}</strong>
      </div>
      ${
        phone
          ? `<a href="https://wa.me/${phone}" target="_blank" rel="noreferrer" style="display:block;margin-top:10px;padding:7px 10px;border-radius:6px;background:#16a34a;color:white;text-align:center;text-decoration:none;font-weight:700">Abrir WhatsApp</a>`
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
}: LiveMapLeafletProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const counts = useMemo(
    () => ({
      onTime: positions.filter((p) => !p.gpsStale && (!p.current_delay || p.current_delay === 0)).length,
      delayed: positions.filter((p) => !p.gpsStale && p.current_delay && p.current_delay > 0).length,
      stale: positions.filter((p) => p.gpsStale).length,
    }),
    [positions],
  );

  const fitBounds = useCallback(() => {
    if (!mapRef.current || positions.length === 0) return;

    const bounds = L.latLngBounds(
      positions.map((position) => [Number(position.latitude), Number(position.longitude)]),
    );
    mapRef.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [positions]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const markers = markersRef.current;
    mapRef.current = L.map(containerRef.current, {
      center: [center.latitude, center.longitude],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
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
      const color = getMarkerColor(position);
      const marker = L.marker([Number(position.latitude), Number(position.longitude)], {
        icon: L.divIcon({
          className: '',
          html: `
            <div style="position:relative;transform:rotate(${Number(position.heading || 0)}deg)">
              <div style="width:38px;height:38px;border-radius:999px;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px ${color}88;border:2px solid white;color:white;font-weight:900">T</div>
            </div>
          `,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      }).bindPopup(buildPopup(position));

      marker.addTo(markerLayerRef.current!);
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

    mapRef.current.flyTo([Number(focusedPosition.latitude), Number(focusedPosition.longitude)], 14, {
      duration: 1.2,
    });
    marker.openPopup();
    onFocusHandled?.();
  }, [focusDriverId, onFocusHandled, positions]);

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between border-b border-border p-4 bg-card gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Navigation className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground font-space-grotesk">Mapa em Tempo Real</h3>
            <p className="text-sm text-muted-foreground">
              {onlineCount ?? positions.length} veiculos ativos - OpenStreetMap
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
          <button onClick={fitBounds} className="text-xs text-primary hover:underline">
            Ver todos
          </button>
        </div>
      </div>

      <div className="relative h-[500px]">
        <div ref={containerRef} className="h-full w-full" />

        <div className="absolute top-4 right-4 z-[400] bg-cyber-dark/95 backdrop-blur rounded-lg p-3 shadow-lg border border-border">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500 font-space-grotesk">{counts.onTime}</p>
              <p className="text-xs text-muted-foreground">No Prazo</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary font-space-grotesk">{counts.delayed}</p>
              <p className="text-xs text-muted-foreground">Atrasados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500 font-space-grotesk">{counts.stale}</p>
              <p className="text-xs text-muted-foreground">Sem Sinal</p>
            </div>
          </div>
        </div>

        {positions.length === 0 && (
          <div className="absolute inset-0 z-[350] flex items-center justify-center bg-cyber-dark/80 backdrop-blur-sm">
            <div className="text-center p-6">
              <TruckIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">Nenhum veiculo ativo</p>
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
