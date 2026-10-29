import type { ReactNode } from "react";
import { Pencil, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ListSkeleton, StatusBadge, type Tone } from "@/components/patterns";
import type { DBDriver } from "@/hooks/useDriversDB";
import { PersonAvatar } from "./PersonAvatar";

const DRIVER_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Disponível", tone: "success" },
  in_route: { label: "Em rota", tone: "info" },
  inactive: { label: "Inativo", tone: "neutral" },
  pending_approval: { label: "Aguardando aprovação", tone: "warning" },
};

const formatDate = (value: string) => new Date(value).toLocaleDateString("pt-BR");

function DriverStatus({ status }: { status: string }) {
  const config = DRIVER_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <StatusBadge tone={config.tone}>{config.label}</StatusBadge>;
}

interface AdminDriversListProps {
  drivers: DBDriver[];
  isLoading: boolean;
  emptyAction?: ReactNode;
  onEdit: (driver: DBDriver) => void;
}

/** Motoristas com login no app: tabela no computador, cartoes no celular. */
export function AdminDriversList({ drivers, isLoading, emptyAction, onEdit }: AdminDriversListProps) {
  if (isLoading) return <ListSkeleton rows={3} />;

  if (drivers.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="Nenhum motorista ainda"
        description="Cadastre um motorista para ele receber o login do aplicativo."
        action={emptyAction}
      />
    );
  }

  return (
    <>
      {/* Computador */}
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Motorista</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-[8rem]">Desde</TableHead>
              <TableHead className="w-[6rem] text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.map((driver) => (
              <TableRow key={driver.id}>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <PersonAvatar name={driver.name} src={driver.avatar || driver.photo} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{driver.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{driver.email || driver.cpf}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="capitalize text-foreground">{driver.vehicle_type || "Veículo"}</p>
                  <p className="font-data text-xs text-muted-foreground">{driver.vehicle_plate || "Sem placa"}</p>
                </TableCell>
                <TableCell>
                  <DriverStatus status={driver.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(driver.created_at)}</TableCell>
                <TableCell className="text-right">
                  {driver.user_id ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => onEdit(driver)}
                          aria-label={`Editar acesso de ${driver.name}`}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Editar acesso</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="whitespace-nowrap text-xs text-muted-foreground">Sem login</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Celular */}
      <ul className="stagger space-y-3 md:hidden">
        {drivers.map((driver) => (
          <li key={driver.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex min-w-0 items-start gap-3">
              <PersonAvatar name={driver.name} src={driver.avatar || driver.photo} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{driver.name}</p>
                <p className="truncate text-xs text-muted-foreground">{driver.email || driver.cpf}</p>
              </div>
              <DriverStatus status={driver.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Veículo</dt>
                <dd className="text-foreground">
                  <span className="capitalize">{driver.vehicle_type || "Veículo"}</span>
                  <span className="font-data text-muted-foreground"> · {driver.vehicle_plate || "sem placa"}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Desde</dt>
                <dd className="text-foreground">{formatDate(driver.created_at)}</dd>
              </div>
            </dl>
            <div className="mt-3 border-t pt-3">
              {driver.user_id ? (
                <Button variant="outline" className="w-full" onClick={() => onEdit(driver)}>
                  <Pencil aria-hidden="true" />
                  Editar acesso<span className="sr-only"> de {driver.name}</span>
                </Button>
              ) : (
                <p className="text-center text-xs text-muted-foreground">Este motorista ainda não tem login no app.</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
