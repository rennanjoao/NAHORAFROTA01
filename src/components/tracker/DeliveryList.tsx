import { CircleCheck, PackageOpen } from "lucide-react";
import { EmptyState } from "@/components/patterns";
import type { DriverDelivery } from "@/hooks/useDriverManifest";
import { FinishedDeliveryRow, NextDeliveryCard, UpcomingDeliveryCard, type DeliveryActions } from "./DeliveryCard";
import { isOpen } from "./deliveryStatus";

interface DeliveryListProps extends DeliveryActions {
  /** Na ordem da rota (abertas primeiro), como vem de useDriverManifest. */
  deliveries: DriverDelivery[];
}

// Mesma ordem de antes: pendentes, em rota, com problema e entregues (ordenacao estavel).
// Novo: entrega onde o motorista ja chegou (raio de 100 m) sobe para "Proxima entrega".
const STATUS_ORDER: Record<string, number> = { pending: 0, in_transit: 1, loaded: 1, occurrence: 2, returned: 2, delivered: 3 };
const rank = (delivery: DriverDelivery) => (isOpen(delivery) && delivery.arrived_at ? -1 : STATUS_ORDER[delivery.status] ?? 1);
const byStatus = (a: DriverDelivery, b: DriverDelivery) => rank(a) - rank(b);

/** Entregas do romaneio: a proxima em destaque, depois as outras e as concluidas. */
export function DeliveryList({ deliveries, onNavigate, onFinishDelivery, onRegisterOccurrence }: DeliveryListProps) {
  if (deliveries.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="Nenhuma entrega neste romaneio"
        description="A base ainda não colocou notas no seu romaneio. Se achar que é um erro, ligue para a base."
      />
    );
  }

  const sorted = [...deliveries].sort(byStatus);
  const open = sorted.filter(isOpen);
  const finished = sorted.filter((delivery) => !isOpen(delivery));
  const [next, ...upcoming] = open;
  const actions = { onNavigate, onFinishDelivery, onRegisterOccurrence };

  return (
    <div className="space-y-8">
      {next ? (
        <section aria-labelledby="proxima-titulo" className="space-y-3">
          <h2 id="proxima-titulo" className="text-lg font-semibold text-foreground">
            Próxima entrega
          </h2>
          <NextDeliveryCard key={next.id} delivery={next} stop={1} totalOpen={open.length} {...actions} />
        </section>
      ) : (
        <section
          aria-labelledby="tudo-entregue-titulo"
          className="flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-success/10 px-6 py-10 text-center"
        >
          <span aria-hidden="true" className="flex h-14 w-14 animate-pop-in items-center justify-center rounded-full bg-success text-success-foreground">
            <CircleCheck className="h-7 w-7" />
          </span>
          <h2 id="tudo-entregue-titulo" className="text-xl font-semibold text-foreground">
            Todas as paradas foram feitas
          </h2>
          <p className="max-w-xs text-[0.9375rem] text-muted-foreground">
            Não falta nenhuma entrega neste romaneio. Se alguma teve problema, a base vai orientar o próximo passo.
          </p>
        </section>
      )}

      {upcoming.length > 0 && (
        <section aria-labelledby="depois-titulo" className="space-y-3">
          <h2 id="depois-titulo" className="flex items-baseline gap-2 text-lg font-semibold text-foreground">
            Depois desta
            <span className="font-data text-sm font-medium text-muted-foreground">{upcoming.length}</span>
          </h2>
          <div className="stagger space-y-3">
            {upcoming.map((delivery, index) => (
              <UpcomingDeliveryCard key={delivery.id} delivery={delivery} stop={index + 2} {...actions} />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section aria-labelledby="concluidas-titulo" className="space-y-3">
          <h2 id="concluidas-titulo" className="flex items-baseline gap-2 text-lg font-semibold text-foreground">
            Concluídas
            <span className="font-data text-sm font-medium text-muted-foreground">{finished.length}</span>
          </h2>
          <ul className="space-y-2">
            {finished.map((delivery) => (
              <FinishedDeliveryRow key={delivery.id} delivery={delivery} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
