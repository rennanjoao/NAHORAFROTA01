import { CircleCheck, MapPin, MapPinCheck, Navigation, TriangleAlert, type LucideIcon } from "lucide-react";
import { StatusBadge, toneSoftBg, toneText } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DriverDelivery } from "@/hooks/useDriverManifest";
import { deliveryStatus, formatHour, streetLine } from "./deliveryStatus";

export interface DeliveryActions {
  onNavigate: (delivery: DriverDelivery) => void;
  onFinishDelivery?: (delivery: DriverDelivery) => void;
  onRegisterOccurrence?: (delivery: DriverDelivery) => void;
}

function ArrivedNote({ at, className }: { at: string; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-sm font-medium text-success", className)}>
      <MapPinCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
      Você chegou às {formatHour(at)}
    </p>
  );
}

/** Cartao grande da proxima entrega: endereco em destaque e botoes enormes. */
export function NextDeliveryCard({
  delivery,
  stop,
  totalOpen,
  onNavigate,
  onFinishDelivery,
  onRegisterOccurrence,
}: DeliveryActions & { delivery: DriverDelivery; stop: number; totalOpen: number }) {
  const status = deliveryStatus(delivery.status);
  const arrived = Boolean(delivery.arrived_at);
  const nameId = `entrega-${delivery.id}-nome`;

  const routeButton = (primary: boolean) => (
    <Button
      size="lg"
      variant={primary ? "default" : "outline"}
      onClick={() => onNavigate(delivery)}
      aria-describedby={primary ? `${nameId}-rota` : undefined}
      className={cn("w-full", primary ? "h-14 text-base [&_svg]:size-5" : "h-14 whitespace-normal px-3 leading-tight")}
    >
      <Navigation aria-hidden="true" />
      Iniciar rota
    </Button>
  );

  const finishButton = (primary: boolean) =>
    onFinishDelivery && (
      <Button
        size="lg"
        variant={primary ? "default" : "soft"}
        onClick={() => onFinishDelivery(delivery)}
        className={cn(
          "w-full",
          // Secundario divide a linha com "Reportar problema": quebra em 2 linhas no celular estreito.
          primary
            ? "h-14 bg-success text-base text-success-foreground hover:bg-success/90 [&_svg]:size-5"
            : "h-14 whitespace-normal px-3 leading-tight",
        )}
      >
        <CircleCheck aria-hidden="true" />
        Finalizar entrega
      </Button>
    );

  return (
    <article aria-labelledby={nameId} className="overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-md">
      <div>
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-data text-sm font-medium text-muted-foreground">
              Parada {stop} de {totalOpen}
            </span>
            <StatusBadge tone={arrived ? "success" : status.tone} className="text-[0.8125rem]">
              {arrived ? "No local" : status.label}
            </StatusBadge>
          </div>

          <div>
            <h3 id={nameId} className="text-2xl font-semibold leading-tight text-foreground">
              {delivery.recipient_name}
            </h3>
            {delivery.nfe_number && (
              <p className="mt-1 font-data text-sm text-muted-foreground">NF-e: {delivery.nfe_number}</p>
            )}
          </div>

          <div className="flex gap-3 rounded-lg bg-muted/70 p-3.5">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <address className="min-w-0 not-italic">
              <p className="text-[1.0625rem] font-medium leading-snug text-foreground">{streetLine(delivery)}</p>
              {delivery.address_city && <p className="text-sm text-muted-foreground">{delivery.address_city}</p>}
            </address>
          </div>

          {arrived && delivery.arrived_at && <ArrivedNote at={delivery.arrived_at} className="animate-fade-in" />}
        </div>

        <div className="space-y-2 border-t bg-muted/30 p-3">
          {arrived ? finishButton(true) : routeButton(true)}
          {!arrived && (
            <p id={`${nameId}-rota`} className="pb-1 text-center text-xs text-muted-foreground">
              Abre o Waze ou o Google Maps com o endereço
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {arrived ? routeButton(false) : finishButton(false)}
            {onRegisterOccurrence && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => onRegisterOccurrence(delivery)}
                className="h-14 w-full whitespace-normal px-3 leading-tight [&_svg]:text-warning"
              >
                <TriangleAlert aria-hidden="true" />
                Reportar problema
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function TileButton({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Icone no alto: alinhado entre os 3 blocos mesmo quando um rotulo quebra em 2 linhas.
        "flex min-h-[4.25rem] flex-col items-center justify-start gap-1 rounded-lg border bg-card px-1.5 pb-2 pt-3 text-center text-[0.8125rem] font-semibold leading-tight text-foreground shadow-xs",
        "transition-[background-color,border-color,transform] duration-fast ease-out hover:bg-accent active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}

/** Entregas que vem depois da proxima: mesmo conteudo, botoes em blocos. */
export function UpcomingDeliveryCard({
  delivery,
  stop,
  onNavigate,
  onFinishDelivery,
  onRegisterOccurrence,
}: DeliveryActions & { delivery: DriverDelivery; stop: number }) {
  const status = deliveryStatus(delivery.status);
  const nameId = `entrega-${delivery.id}-nome`;

  return (
    <article aria-labelledby={nameId} className="rounded-xl border bg-card shadow-sm">
      <div className="p-4">
        <div className="flex gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-data text-sm font-semibold text-foreground"
          >
            {stop}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 id={nameId} className="min-w-0 text-base font-semibold leading-snug text-foreground">
                <span className="sr-only">Parada {stop}: </span>
                {delivery.recipient_name}
              </h3>
              <StatusBadge tone={delivery.arrived_at ? "success" : status.tone} className="shrink-0">
                {delivery.arrived_at ? "No local" : status.label}
              </StatusBadge>
            </div>
            {delivery.nfe_number && <p className="font-data text-xs text-muted-foreground">NF-e: {delivery.nfe_number}</p>}
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                {streetLine(delivery)}
                {delivery.address_city && ` · ${delivery.address_city}`}
              </span>
            </p>
            {delivery.arrived_at && <ArrivedNote at={delivery.arrived_at} />}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <TileButton icon={Navigation} label="Iniciar rota" onClick={() => onNavigate(delivery)} className="[&_svg]:text-primary" />
          {onFinishDelivery && (
            <TileButton
              icon={CircleCheck}
              label="Finalizar entrega"
              onClick={() => onFinishDelivery(delivery)}
              className="[&_svg]:text-success"
            />
          )}
          {onRegisterOccurrence && (
            <TileButton
              icon={TriangleAlert}
              label="Reportar problema"
              onClick={() => onRegisterOccurrence(delivery)}
              className="[&_svg]:text-warning"
            />
          )}
        </div>
      </div>
    </article>
  );
}

/** Entrega ja resolvida (entregue ou com problema): linha compacta, sem botoes. */
export function FinishedDeliveryRow({ delivery }: { delivery: DriverDelivery }) {
  const status = deliveryStatus(delivery.status);
  const Icon = status.icon;

  return (
    <li className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <span
        aria-hidden="true"
        className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", toneSoftBg[status.tone], toneText[status.tone])}
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-[0.9375rem] font-medium text-foreground">{delivery.recipient_name}</p>
        <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge tone={status.tone} className="shrink-0">
            {status.label}
          </StatusBadge>
          <span className="truncate">
            {delivery.nfe_number && <span className="font-data">NF-e: {delivery.nfe_number} · </span>}
            {streetLine(delivery)}
          </span>
        </p>
      </div>
    </li>
  );
}
