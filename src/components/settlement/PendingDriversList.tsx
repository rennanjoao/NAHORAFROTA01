import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatCurrency";
import { DriverAvatar } from "./DriverAvatar";
import type { PendingDriverSummary } from "./settlementConfig";

interface PendingDriversListProps {
  drivers: PendingDriverSummary[];
  onSelect: (driverId: string) => void;
}

const manifestsLabel = (count: number) => `${count.toLocaleString("pt-BR")} romaneio${count === 1 ? "" : "s"}`;

/** Motoristas com romaneio sem pagamento: tabela no computador, cartoes no celular. */
export function PendingDriversList({ drivers, onSelect }: PendingDriversListProps) {
  return (
    <>
      {/* Computador */}
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Motorista</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead className="text-center">Romaneios</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Valor a pagar</TableHead>
              <TableHead className="w-0 text-right">
                <span className="sr-only">Ação</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.map((driver) => (
              <TableRow key={driver.driverId}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <DriverAvatar name={driver.driverName} />
                    <span className="max-w-[240px] truncate font-medium" title={driver.driverName}>
                      {driver.driverName}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="font-data text-muted-foreground">{driver.driverCpf || "—"}</TableCell>
                <TableCell className="text-center font-data">{driver.manifestCount.toLocaleString("pt-BR")}</TableCell>
                <TableCell>
                  <StatusBadge tone="warning">Pendente</StatusBadge>
                </TableCell>
                <TableCell className="text-right font-data font-semibold">{formatCurrency(driver.totalValue)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => onSelect(driver.driverId)}>
                    Realizar acerto
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Celular */}
      <ul className="stagger space-y-3 md:hidden">
        {drivers.map((driver) => (
          <li key={driver.driverId}>
            <Card className="space-y-4 p-4">
              <div className="flex items-start gap-3">
                <DriverAvatar name={driver.driverName} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground" title={driver.driverName}>
                    {driver.driverName}
                  </p>
                  <p className="font-data text-xs text-muted-foreground">
                    {driver.driverCpf ? `CPF ${driver.driverCpf}` : "CPF não informado"}
                  </p>
                </div>
                <StatusBadge tone="warning">Pendente</StatusBadge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">A pagar · {manifestsLabel(driver.manifestCount)}</p>
                <p className="font-data text-xl font-semibold text-foreground">{formatCurrency(driver.totalValue)}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => onSelect(driver.driverId)}>
                Realizar acerto
                <ArrowRight aria-hidden="true" />
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
