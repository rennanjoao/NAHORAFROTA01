import { Truck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toneDot, type Tone } from "@/components/patterns";
import { cn } from "@/lib/utils";
import type { DriverManifest } from "@/hooks/useDriverManifest";

interface DayProgressCardProps {
  manifest: DriverManifest;
  deliveredCount: number;
  problemCount: number;
  openCount: number;
  totalCount: number;
}

function Count({ tone, value, label }: { tone: Tone; value: number; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", toneDot[tone])} />
      <span className="font-data font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </li>
  );
}

/** Andamento do dia: quantas entregas feitas, com barra e resumo por situacao. */
export function DayProgressCard({ manifest, deliveredCount, problemCount, openCount, totalCount }: DayProgressCardProps) {
  const percent = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0;
  const summary = `${deliveredCount} de ${totalCount} ${totalCount === 1 ? "entrega feita" : "entregas feitas"}`;

  return (
    <section aria-labelledby="andamento-titulo" className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="andamento-titulo" className="nhf-label text-muted-foreground">
            Andamento do dia
          </h2>
          <p className="mt-1.5 font-data text-[1.75rem] font-semibold leading-none tracking-tight text-foreground">
            {deliveredCount}
            <span className="text-lg text-muted-foreground"> de {totalCount}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{totalCount === 1 ? "entrega feita" : "entregas feitas"}</p>
        </div>
        <span className="font-data text-sm font-semibold text-primary">{percent}%</span>
      </div>

      <Progress value={percent} aria-label={summary} className="mt-4 h-2.5" />

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        <Count tone="success" value={deliveredCount} label={deliveredCount === 1 ? "entregue" : "entregues"} />
        {problemCount > 0 && <Count tone="danger" value={problemCount} label="com problema" />}
        <Count tone="info" value={openCount} label={openCount === 1 ? "falta" : "faltam"} />
      </ul>

      {manifest.vehicle_plate && (
        <p className="mt-3 flex items-center gap-2 border-t pt-3 text-sm text-muted-foreground">
          <Truck className="h-4 w-4" aria-hidden="true" />
          Veículo <span className="font-data font-medium text-foreground">{manifest.vehicle_plate}</span>
        </p>
      )}
    </section>
  );
}
