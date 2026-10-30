import { Battery, Clock, Gauge, MapPin, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge, toneText, type Tone } from '@/components/patterns';
import { STATUS_HEX, vehicleMarkerHtml } from "@/lib/brandSymbol";
import { cn } from '@/lib/utils';
import { openWhatsApp } from "@/lib/whatsapp";
import { vehicleTypeLabel } from "@/components/deliveries/status";
import { DriverAvatar } from './DriverAvatar';
import { VEHICLE_STATUS, vehicleStatus } from './mapStatus';
import { plateLabel, slaStatus } from './status';

/* Pecas do mapa ao vivo usadas pelos dois motores (Mapbox com token; MapLibre sem). */

export interface FleetPosition {
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

function batteryTone(level?: number | null): Tone {
  if (level == null) return "neutral";
  if (level > 50) return "success";
  if (level > 20) return "warning";
  return "danger";
}

/** Detalhe do motorista que abre ao tocar no marcador. */
export function DriverPopup({ position, onClose }: { position: FleetPosition; onClose: () => void }) {
  const status = VEHICLE_STATUS[vehicleStatus(position)];
  // O banco manda null onde o tipo diz undefined: "!= null" cobre os dois (antes virava "0,0%" ou "null%").
  const sla = position.individual_sla != null ? Number(position.individual_sla) : undefined;
  const battery = batteryTone(position.battery_level);
  const progress =
    position.deliveries_completed != null && position.total_deliveries ? (position.deliveries_completed / position.total_deliveries) * 100 : null;

  const stats = [
    { icon: Gauge, label: "Velocidade", value: `${Number(position.speed || 0).toFixed(0)} km/h`, tone: "neutral" as Tone },
    { icon: Gauge, label: "SLA", value: sla !== undefined ? `${sla.toFixed(1).replace(".", ",")}%` : "—", tone: sla !== undefined ? slaStatus(sla).tone : ("neutral" as Tone) },
    { icon: Battery, label: "Bateria", value: position.battery_level != null ? `${position.battery_level}%` : "—", tone: battery },
    { icon: MapPin, label: "Precisão", value: position.accuracy != null ? `±${Number(position.accuracy).toFixed(0)} m` : "—", tone: "neutral" as Tone },
  ];

  return (
    <div
      role="dialog"
      aria-label={`Detalhes de ${position.driver_name || "motorista"}`}
      className="absolute bottom-14 left-1/2 z-50 w-[17.5rem] -translate-x-1/2 animate-scale-in rounded-lg border bg-popover p-4 text-popover-foreground shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex items-center gap-3 border-b pb-3">
        <DriverAvatar name={position.driver_name} photo={position.driver_photo} tone={status.tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{position.driver_name || "Motorista"}</p>
          <p className="truncate font-data text-xs text-muted-foreground">
            {plateLabel(position.vehicle_plate)}
            {position.vehicle_type && ` · ${vehicleTypeLabel(position.vehicle_type)}`}
          </p>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Fechar detalhes">
          <X aria-hidden="true" />
        </Button>
      </div>

      <StatusBadge tone={status.tone} className="mb-3">
        {status.label}
      </StatusBadge>

      <dl className="mb-3 grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md bg-muted/60 p-2">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <stat.icon className="h-3 w-3" aria-hidden="true" />
              {stat.label}
            </dt>
            <dd className={cn("font-data text-sm font-semibold", stat.tone === "neutral" ? "text-foreground" : toneText[stat.tone])}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      {position.current_delay != null && position.current_delay > 0 && (
        <p className="mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm font-medium text-destructive">
          <Clock className="h-4 w-4" aria-hidden="true" />
          Atraso de {position.current_delay} min
        </p>
      )}

      {progress !== null && (
        <div className="mb-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Entregas</span>
            <span className="font-data font-semibold">
              {position.deliveries_completed} de {position.total_deliveries}
            </span>
          </div>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-slow ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" aria-hidden="true" />
        Atualizado às {position.last_update ? new Date(position.last_update).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
      </p>

      {position.phone ? (
        <Button size="sm" className="w-full" onClick={() => openWhatsApp(position.phone)}>
          <MessageCircle aria-hidden="true" />
          Chamar no WhatsApp
        </Button>
      ) : (
        <p className="py-1 text-center text-xs text-muted-foreground">Telefone não cadastrado</p>
      )}
    </div>
  );
}

/** Marcador do veiculo (botao) com o detalhe que abre ao tocar. */
export function VehicleMarker({ position, isSelected, onToggle }: { position: FleetPosition; isSelected: boolean; onToggle: () => void }) {
  const status = VEHICLE_STATUS[vehicleStatus(position)];
  const moving = position.speed > 0 && !position.gpsStale;
  return (
    // O detalhe fica fora do bloco que gira com o veiculo
    <div className="relative">
      <button
        type="button"
        aria-label={`${position.driver_name || "Motorista"}, ${status.label.toLowerCase()}. Ver detalhes`}
        aria-expanded={isSelected}
        className="relative block rounded-full transition-transform duration-fast hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={onToggle}
      >
        {/* Velocidade em cima do marcador (so a seta gira com o sentido do veiculo) */}
        {moving && (
          <span
            aria-hidden="true"
            className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm px-1.5 py-0.5 font-data text-[0.6875rem] font-bold"
            style={{
              backgroundColor: status.hex,
              color: STATUS_HEX.ink,
            }}
          >
            {Number(position.speed).toFixed(0)} km/h
          </span>
        )}

        {position.gpsStale && (
          <span
            aria-hidden="true"
            className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm px-2 py-0.5 text-[0.6875rem] font-bold"
            style={{
              backgroundColor: STATUS_HEX.idle,
              color: STATUS_HEX.ink,
            }}
          >
            Sem sinal
          </span>
        )}

        {/* Veiculo: circulo na cor da situacao, simbolo da marca apontando o sentido */}
        <span aria-hidden="true" className="block" dangerouslySetInnerHTML={{ __html: vehicleMarkerHtml(status.hex, Number(position.heading || 0), 40, { pulse: moving }) }} />
      </button>

      {isSelected && <DriverPopup position={position} onClose={onToggle} />}
    </div>
  );
}
