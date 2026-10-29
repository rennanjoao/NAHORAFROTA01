import { Battery, BatteryLow, WifiOff } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { StatusBadge, type Tone } from "@/components/patterns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { brandAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { initialsOf, shortName } from "./initials";
import { useOnline } from "./useOnline";

export type GpsState = "on" | "weak" | "paused";

const GPS_BADGE: Record<GpsState, { label: string; tone: Tone }> = {
  on: { label: "GPS ligado", tone: "success" },
  weak: { label: "Sinal fraco", tone: "warning" },
  paused: { label: "GPS pausado", tone: "warning" },
};

interface DriverTopBarProps {
  name: string;
  plate?: string;
  vehicleType?: string;
  photo?: string | null;
  gps: GpsState;
  batteryLevel: number;
}

/** Topo do app do motorista: marca, quem esta logado, GPS e bateria. */
export function DriverTopBar({ name, plate, vehicleType, photo, gps, batteryLevel }: DriverTopBarProps) {
  const online = useOnline();
  const badge = GPS_BADGE[gps];
  const lowBattery = batteryLevel <= 20;
  const vehicle = [plate, vehicleType].filter(Boolean).join(" · ");

  return (
    <header className="surface-glass sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 w-full max-w-2xl items-center gap-3 px-4">
        {/* Abaixo de 360px o simbolo sai para o nome do motorista caber. */}
        <BrandLogo arrangement="simbolo" className="w-8 shrink-0 max-[359px]:hidden" />
        <span aria-hidden="true" className="h-7 w-px shrink-0 bg-border max-[359px]:hidden" />
        <Avatar className="h-9 w-9 border border-border">
          <AvatarImage src={brandAvatar(photo)} alt="" />
          <AvatarFallback className="bg-primary/10 text-primary">{initialsOf(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-heading text-[0.9375rem] font-semibold text-foreground" title={name}>
            {shortName(name)}
          </p>
          {vehicle && <p className="truncate font-data text-xs text-muted-foreground">{vehicle}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge tone={badge.tone} pulse={gps === "on"}>
            {badge.label}
          </StatusBadge>
          <span
            className={cn(
              "inline-flex items-center gap-1 font-data text-[0.6875rem]",
              lowBattery ? "font-semibold text-destructive" : "text-muted-foreground",
            )}
          >
            {lowBattery ? (
              <BatteryLow className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Battery className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="sr-only">Bateria</span>
            {batteryLevel}%
          </span>
        </div>
      </div>
      {!online && (
        <div role="status" className="animate-fade-in border-t border-destructive/30 bg-destructive/10">
          <p className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2 text-sm font-medium text-destructive">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            Sem internet. Algumas ações só funcionam quando a conexão voltar.
          </p>
        </div>
      )}
    </header>
  );
}
