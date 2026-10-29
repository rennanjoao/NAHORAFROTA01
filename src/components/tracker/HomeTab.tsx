import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, Loader2, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDateOnly } from "@/lib/timezone";
import type { DriverDelivery, DriverManifest } from "@/hooks/useDriverManifest";
import type { DeliveryActions } from "./DeliveryCard";
import { DayProgressCard } from "./DayProgressCard";
import { DeliveryList } from "./DeliveryList";
import { GpsStatusCard } from "./GpsStatusCard";
import { ScreenHeader } from "./ScreenHeader";
import { hasProblem, isDelivered, isOpen } from "./deliveryStatus";

interface HomeTabProps extends DeliveryActions {
  manifest: DriverManifest | null;
  deliveries: DriverDelivery[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  gps: {
    isTracking: boolean;
    speed?: number;
    accuracy?: number;
    warning?: string | null;
    onStart: () => void;
    onStop: () => void;
  };
}

function HomeSkeleton() {
  return (
    <div role="status" aria-label="Carregando suas entregas" className="space-y-4">
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

/** Aba Inicio: andamento do dia, GPS e as entregas na ordem da rota. */
export function HomeTab({ manifest, deliveries, loading, onRefresh, gps, ...actions }: HomeTabProps) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const scheduled = manifest ? parseDateOnly(manifest.scheduled_date) : null;
  const eyebrow = manifest
    ? [
        `Romaneio #${manifest.manifest_number || manifest.manifest_code.slice(-4)}`,
        scheduled ? format(scheduled, "dd/MM", { locale: ptBR }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <>
      <ScreenHeader
        eyebrow={eyebrow}
        title="Entregas de hoje"
        actions={
          manifest && (
            <Button variant="outline" onClick={refresh} disabled={refreshing} className="h-12 px-4">
              {refreshing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              Atualizar<span className="sr-only"> entregas</span>
            </Button>
          )
        }
      />

      {loading ? (
        <HomeSkeleton />
      ) : !manifest ? (
        <div className="space-y-4">
          <GpsStatusCard {...gps} />
          <EmptyState
            icon={ClipboardList}
            title="Nenhum romaneio para você agora"
            description="Quando a base enviar as entregas do dia, elas aparecem aqui."
            action={
              <Button size="lg" variant="outline" onClick={refresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                Atualizar agora
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-3">
            <DayProgressCard
              manifest={manifest}
              totalCount={deliveries.length}
              deliveredCount={deliveries.filter(isDelivered).length}
              problemCount={deliveries.filter(hasProblem).length}
              openCount={deliveries.filter(isOpen).length}
            />
            <GpsStatusCard {...gps} />
          </div>
          <DeliveryList deliveries={deliveries} {...actions} />
        </div>
      )}
    </>
  );
}
