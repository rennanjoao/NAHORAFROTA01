import { Eye, MapPin, MessageCircle, MoreHorizontal, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toneText } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatSLA } from "@/lib/formatSLA";
import { cn } from "@/lib/utils";
import { ActionMenu, type ActionMenuItem } from "@/components/patterns/ActionMenu";
import { slaTone } from "./driverConfig";
import { DriverAvatar, DriverStatusBadge, PlateTag } from "./DriverBits";
import type { DriverRecord } from "./useDriverQuickActions";

interface DriverListProps {
  drivers: DriverRecord[];
  canManage: boolean;
  onOpen: (driver: DriverRecord) => void;
  onEdit: (driver: DriverRecord) => void;
  onWhatsApp: (driver: DriverRecord) => void;
  onShowOnMap: (driver: DriverRecord) => void;
}

// Botao do nome cobre a linha/cartao inteiro (clique em qualquer lugar abre o detalhe).
const stretchedButton =
  "text-left font-medium text-foreground after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring";

function VehicleSummary({ driver }: { driver: DriverRecord }) {
  // CLT sem placa propria usa um veiculo da empresa a cada rota.
  if (driver.isOwnFleet && (!driver.vehiclePlate || driver.vehiclePlate === "PENDENTE")) {
    return <span className="text-sm text-muted-foreground">Veículo da empresa</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm text-foreground">{driver.vehicleType}</span>
      <PlateTag plate={driver.vehiclePlate} />
    </span>
  );
}

function SlaValue({ sla, compact }: { sla: number | null | undefined; compact?: boolean }) {
  if (sla === null || sla === undefined) {
    // No cartao o espaco e curto: traco, com o texto para leitor de tela.
    return compact ? (
      <>
        <span aria-hidden="true" className="text-sm text-muted-foreground">—</span>
        <span className="sr-only">Sem entregas</span>
      </>
    ) : (
      <span className="text-sm text-muted-foreground">Sem entregas</span>
    );
  }
  return <span className={cn("font-data text-sm font-semibold", toneText[slaTone(sla)])}>{formatSLA(sla)}%</span>;
}

function BalanceValue({ driver }: { driver: DriverRecord }) {
  if (driver.isOwnFleet) {
    return (
      <>
        <span aria-hidden="true" className="text-muted-foreground">—</span>
        <span className="sr-only">Não se aplica (CLT)</span>
      </>
    );
  }
  const balance = driver.balance ?? 0;
  return (
    <span className={cn("font-data text-sm", balance > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
      {formatCurrency(balance)}
    </span>
  );
}

function DriverActionsMenu({ driver, canManage, onOpen, onEdit, onWhatsApp, onShowOnMap }: Omit<DriverListProps, "drivers"> & { driver: DriverRecord }) {
  const items: ActionMenuItem[] = [
    { label: "Ver detalhes", icon: Eye, onSelect: () => onOpen(driver) },
    { label: "Editar dados", icon: Pencil, onSelect: () => onEdit(driver) },
  ];
  if (canManage) {
    items.push(
      { label: "Chamar no WhatsApp", icon: MessageCircle, onSelect: () => onWhatsApp(driver), immediate: true, separatorBefore: true },
      { label: "Ver no mapa", icon: MapPin, onSelect: () => onShowOnMap(driver), immediate: true },
    );
  }
  return (
    <ActionMenu
      title={driver.name}
      items={items}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${driver.name}`} className="h-9 w-9">
          <MoreHorizontal aria-hidden="true" />
        </Button>
      }
    />
  );
}

/** Lista de motoristas: tabela no computador, cartoes no celular e tablet. */
export function DriverList(props: DriverListProps) {
  const { drivers, onOpen } = props;

  return (
    <>
      {/* Computador */}
      <Card className="hidden overflow-hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Motorista</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Situação</TableHead>
              {/* So a partir de 1400px: em 1280 a coluna apertava a tabela (texto quebrando, rolagem com texto "Maior"). */}
              <TableHead className="hidden min-[1400px]:table-cell" title="Entregues sobre notas finalizadas nos últimos 6 meses">
                Entregas (6 meses)
              </TableHead>
              <TableHead title="Entregas no prazo (SLA) nos últimos 6 meses">
                No prazo (6 meses)
              </TableHead>
              <TableHead className="text-right" title="Frete de romaneios ainda não pagos">
                A receber
              </TableHead>
              <TableHead className="w-14 pr-4">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.map((driver) => {
              const completion = driver.totalDeliveries > 0 ? (driver.successfulDeliveries / driver.totalDeliveries) * 100 : 0;
              return (
                <TableRow key={driver._dbId || driver.id} className="relative">
                  <TableCell className="py-3 pl-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <DriverAvatar photo={driver.photo} className="h-9 w-9" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button type="button" data-driver-open={driver._dbId} onClick={() => onOpen(driver)} className={cn(stretchedButton, "max-w-[15rem] truncate")} title={driver.name}>
                            {driver.name}
                          </button>
                          {/* -my-px: o selo (22px com a borda) nao aumenta a linha; linhas com e sem CLT iguais */}
                          {driver.isOwnFleet && (
                            <Badge variant="secondary" className="-my-px py-0 leading-5">
                              CLT
                            </Badge>
                          )}
                        </div>
                        <p className="font-data text-xs text-muted-foreground">{driver.cpf || "CPF não informado"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <VehicleSummary driver={driver} />
                  </TableCell>
                  <TableCell>
                    <DriverStatusBadge status={driver.status} />
                  </TableCell>
                  <TableCell className="hidden min-[1400px]:table-cell">
                    <div className="space-y-1.5">
                      <p className="font-data text-sm">
                        <span className="font-semibold text-foreground">{driver.successfulDeliveries}</span>
                        <span className="text-muted-foreground"> de {driver.totalDeliveries}</span>
                      </p>
                      <Progress
                        value={completion}
                        className="h-1.5 w-20"
                        aria-label={`${driver.successfulDeliveries} de ${driver.totalDeliveries} entregas concluídas`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <SlaValue sla={driver.sla} />
                  </TableCell>
                  <TableCell className="text-right">
                    <BalanceValue driver={driver} />
                  </TableCell>
                  <TableCell className="relative z-10 pr-4 text-right">
                    <DriverActionsMenu driver={driver} {...props} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Celular e tablet */}
      {/* grid-cols-1 (minmax 0): sem ele, um nome longo alargava o cartao alem da tela. */}
      <ul className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden" aria-label="Motoristas">
        {drivers.map((driver) => (
          <li
            key={driver._dbId || driver.id}
            className="card-interactive relative flex flex-col rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
          >
            <div className="flex flex-1 items-start gap-3">
              <DriverAvatar photo={driver.photo} className="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <button type="button" data-driver-open={driver._dbId} onClick={() => onOpen(driver)} className={cn(stretchedButton, "block max-w-full truncate leading-snug after:rounded-lg")} title={driver.name}>
                  {driver.name}
                </button>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <DriverStatusBadge status={driver.status} />
                  {driver.isOwnFleet && <Badge variant="secondary">CLT</Badge>}
                  <VehicleSummary driver={driver} />
                </div>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
              <div>
                <dt className="text-xs text-muted-foreground">Entregas</dt>
                <dd className="font-data text-sm">
                  <span className="font-semibold">{driver.successfulDeliveries}</span>
                  <span className="text-muted-foreground"> de {driver.totalDeliveries}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">No prazo</dt>
                <dd>
                  <SlaValue sla={driver.sla} compact />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">A receber</dt>
                <dd>
                  <BalanceValue driver={driver} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
