import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, CloudOff, Loader2, RefreshCw } from "lucide-react";
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
  /** Falha ao buscar o romaneio (ex.: sem internet). */
  error?: string | null;
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
export function HomeTab({ manifest, deliveries, loading, error, onRefresh, gps, ...actions }: HomeTabProps) {
  const [refreshing, setRefreshing] = useState(false);

  // Sem "disabled" no botao: desabilitar tira o foco dele (leitor de tela se perde).
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      // O botao pode sumir (ex.: "Tentar de novo" vira a lista): foco volta ao titulo.
      window.requestAnimationFrame(() => {
        if (!document.activeElement || document.activeElement === document.body) {
          document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
        }
      });
    }
  };

  // Esqueleto so na primeira carga: ao atualizar, a lista fica na tela (e o foco no botao).
  const showSkeleton = loading && !manifest && !refreshing;
  const refreshLabel = refreshing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />;

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
            <Button variant="outline" onClick={refresh} aria-busy={refreshing} className="h-12 px-4">
              {refreshLabel}
              Atualizar<span className="sr-only"> entregas</span>
            </Button>
          )
        }
      />

      {showSkeleton ? (
        <HomeSkeleton />
      ) : !manifest && error ? (
        // Antes a falha mostrava "Nenhum romaneio": o motorista achava que nao tinha entregas.
        <div className="space-y-4">
          <GpsStatusCard {...gps} />
          <EmptyState
            icon={CloudOff}
            title="Não foi possível carregar suas entregas"
            description="Confira a internet do celular e tente de novo. Se continuar, ligue para a base."
            action={
              <Button size="lg" onClick={refresh} aria-busy={refreshing}>
                {refreshLabel}
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : !manifest ? (
        <div className="space-y-4">
          <GpsStatusCard {...gps} />
          <EmptyState
            icon={ClipboardList}
            title="Nenhum romaneio para você agora"
            description="Quando a base enviar as entregas do dia, elas aparecem aqui."
            action={
              <Button size="lg" variant="outline" onClick={refresh} aria-busy={refreshing}>
                {refreshLabel}
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
