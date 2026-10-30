import { MoreHorizontal, Pencil, Trash2, Truck, User, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/patterns";
import { ActionMenu } from "@/components/patterns/ActionMenu";
import type { CompanyVehicle } from "@/stores/companyVehicleStore";
import { formatCapacity, VEHICLE_STATUS } from "./vehicleConfig";

interface VehicleCardProps {
  vehicle: CompanyVehicle;
  onEdit: (vehicle: CompanyVehicle) => void;
  onToggleMaintenance: (vehicle: CompanyVehicle) => void;
  onRemove: (vehicle: CompanyVehicle) => void;
}

/** Cartao do veiculo. Tocar no cartao abre a edicao; o menu tem as demais acoes. */
export function VehicleCard({ vehicle, onEdit, onToggleMaintenance, onRemove }: VehicleCardProps) {
  const status = VEHICLE_STATUS[vehicle.status] || VEHICLE_STATUS.available;
  const inMaintenance = vehicle.status === "maintenance";

  return (
    <li className="card-interactive relative flex flex-col rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-start gap-3">
        {vehicle.photoUrl ? (
          <img src={vehicle.photoUrl} alt="" loading="lazy" className="h-11 w-16 shrink-0 rounded-lg border object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Truck className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="leading-tight">
            <button
              type="button"
              data-vehicle-open=""
              onClick={() => onEdit(vehicle)}
              className="font-data text-lg font-semibold tracking-wider text-foreground after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              <span className="sr-only">Editar veículo </span>
              {vehicle.plate}
            </button>
          </h3>
          <p className="truncate text-sm text-muted-foreground" title={`${vehicle.brand} ${vehicle.model}`}>
            {vehicle.brand} {vehicle.model}
          </p>
        </div>
        <div className="relative z-10 -mr-2 -mt-1.5">
          <ActionMenu
            title={vehicle.plate}
            titleClassName="font-data tracking-wider"
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Ações do veículo ${vehicle.plate}`}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            }
            items={[
              { label: "Editar dados", icon: Pencil, onSelect: () => onEdit(vehicle) },
              {
                label: inMaintenance ? "Liberar da manutenção" : "Enviar para manutenção",
                icon: Wrench,
                onSelect: () => onToggleMaintenance(vehicle),
                immediate: true,
              },
              { label: "Remover veículo", icon: Trash2, onSelect: () => onRemove(vehicle), destructive: true, separatorBefore: true },
            ]}
          />
        </div>
      </div>

      <div className="mt-3">
        <StatusBadge tone={status.tone} pulse={vehicle.status === "in_use"}>
          {status.label}
        </StatusBadge>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-4">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Tipo</dt>
          <dd className="truncate text-sm font-medium text-foreground">{vehicle.type}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Capacidade</dt>
          <dd className="truncate font-data text-sm font-medium text-foreground">{formatCapacity(vehicle.capacity)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Ano</dt>
          <dd className="font-data text-sm font-medium text-foreground">
            {vehicle.year || (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">Não informado</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      {vehicle.currentDriverName && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-info/10 px-3 py-2 text-sm text-foreground">
          <User className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
          <span className="min-w-0 truncate">
            <span className="text-muted-foreground">Com </span>
            <span className="font-medium">{vehicle.currentDriverName}</span>
          </span>
        </p>
      )}
    </li>
  );
}
