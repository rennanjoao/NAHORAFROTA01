import { useMemo, useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Clock, History, MessageCircle, UserCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState, StatusBadge, toneDot, toneText, type Tone } from "@/components/patterns";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { getDayBoundsUTC, getTodayBrazil } from "@/lib/timezone";
import { formatSLA } from "@/lib/formatSLA";
import { cn } from "@/lib/utils";
import { useSLADB, isSLACritical, SLA_THRESHOLDS, getOccurrenceLabel } from "@/hooks/useSLADB";
import {
  MIN_INVOICES_FOR_ATTENTION,
  SLA_PERIODS,
  rankBySLA,
  type PeriodSLA,
  type SLAPeriodDays,
} from "@/lib/slaRanking";
import { openWhatsApp } from "@/lib/whatsapp";
import { HelperTooltip } from "./HelperTooltip";
import { DetailSheet } from "./DetailPanel";
import { DriverAvatar } from "./DriverAvatar";
import { SLABar } from "./SLAParts";
import { plural, slaStatus, pct } from "./status";

interface PeriodRank {
  rank: number | null;
  of: number;
}

type DeliveryState = "completed" | "occurrence" | "pending";

interface TodayInvoice {
  id: string;
  nfe_number: string | null;
  recipient_name: string | null;
  status: string;
  occurrence_type: string | null;
  driver_id: string | null;
  updated_at: string;
}

interface DriverAttention {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  photoUrl: string | null;
  isInRoute: boolean;
  /** SLA do periodo selecionado */
  historicalSLA: number;
  periodStats: Record<SLAPeriodDays, PeriodSLA>;
  ranks: Record<SLAPeriodDays, PeriodRank>;
  todayDeliveries: {
    id: string;
    nfNumber: string;
    recipient: string;
    status: DeliveryState;
    occurrenceType?: string | null;
    routeSequence: number;
  }[];
  completedCount: number;
  occurrenceCount: number;
  pendingCount: number;
}

/** Entrega do dia: finalizada (verde), com ocorrencia (vermelho), pendente (cinza). */
const DELIVERY_TONE: Record<DeliveryState, Tone> = { completed: "success", occurrence: "danger", pending: "neutral" };
const DELIVERY_LABEL: Record<DeliveryState, string> = { completed: "Finalizada", occurrence: "Ocorrência", pending: "Pendente" };

/** Rotulos do periodo em linguagem simples ("Geral (6m)" virou "6 meses"). */
const PERIOD_LABEL: Record<SLAPeriodDays, string> = { 7: "7 dias", 15: "15 dias", 30: "30 dias", 90: "90 dias", 180: "6 meses" };
const periodShort = (days: SLAPeriodDays) => (days === 180 ? "6m" : `${days}d`);
/** "nos últimos 30 dias", "nos últimos 6 meses". */
const periodPhrase = (days: SLAPeriodDays) => `nos últimos ${PERIOD_LABEL[days]}`;

function RankLabel({ rank }: { rank: PeriodRank }) {
  if (rank.rank === null) return <span className="text-muted-foreground">sem ranking</span>;
  return (
    <span>
      <span className="font-semibold text-foreground">{rank.rank}º</span> de {rank.of}
    </span>
  );
}

/** Legenda das bolinhas de entrega. */
function DeliveryLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda das entregas">
      {(Object.keys(DELIVERY_TONE) as DeliveryState[]).map((state) => (
        <li key={state} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", toneDot[DELIVERY_TONE[state]])} />
          {DELIVERY_LABEL[state]}
        </li>
      ))}
    </ul>
  );
}

/** SLA de cada janela de historico, lado a lado. */
function PeriodHistoryRow({ driver, selected }: { driver: DriverAttention; selected: SLAPeriodDays }) {
  return (
    <dl className="grid grid-cols-5 gap-1.5 text-center">
      {SLA_PERIODS.map((days) => {
        const stats = driver.periodStats[days];
        const hasData = stats.total > 0;
        return (
          <div
            key={days}
            className={cn("rounded-md border px-1 py-1.5", days === selected ? "border-primary/40 bg-primary/5" : "border-border")}
            title={hasData ? `${plural(stats.total, "nota", "notas")}, ${plural(stats.occurrences, "ocorrência", "ocorrências")}` : "Sem entregas no período"}
          >
            <dt className="text-[0.6875rem] leading-tight text-muted-foreground">
              <span aria-hidden="true">{periodShort(days)}</span>
              <span className="sr-only">{PERIOD_LABEL[days]}</span>
            </dt>
            <dd className={cn("font-data text-xs font-semibold", hasData ? toneText[slaStatus(stats.sla).tone] : "text-muted-foreground")}>
              {hasData ? `${formatSLA(stats.sla)}%` : "—"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Bolinhas das entregas de hoje, na ordem do roteiro. */
function DeliveryDots({ driver }: { driver: DriverAttention }) {
  if (driver.todayDeliveries.length === 0) return null;
  const summary = `Entregas de hoje: ${plural(driver.completedCount, "finalizada", "finalizadas")}, ${plural(driver.occurrenceCount, "com ocorrência", "com ocorrência")}, ${plural(driver.pendingCount, "pendente", "pendentes")}`;
  return (
    <div role="img" aria-label={summary} className="flex flex-wrap items-center gap-1.5">
      {driver.todayDeliveries.slice(0, 15).map((delivery, idx) => (
        <span key={delivery.id || idx} aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", toneDot[DELIVERY_TONE[delivery.status]])} />
      ))}
      {driver.todayDeliveries.length > 15 && (
        <span aria-hidden="true" className="ml-1 text-xs text-muted-foreground">
          +{driver.todayDeliveries.length - 15}
        </span>
      )}
    </div>
  );
}

function DriverAttentionCard({ driver, period, onClick }: { driver: DriverAttention; period: SLAPeriodDays; onClick: () => void }) {
  const status = slaStatus(driver.historicalSLA);
  const phone = (driver.phone || "").replace(/\D/g, "");

  return (
    <li className="card-interactive relative flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm focus-within:ring-2 focus-within:ring-ring">
      <div className="flex items-start gap-3">
        <DriverAvatar name={driver.name} photo={driver.photoUrl} tone={status.tone} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* O botao cobre o cartao inteiro (::after); o WhatsApp fica por cima. */}
            <button
              type="button"
              onClick={onClick}
              className="min-w-0 break-words text-left font-medium leading-snug text-foreground after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none"
            >
              {driver.name}
            </button>
            {driver.isInRoute && <StatusBadge tone="info">Em rota</StatusBadge>}
          </div>
          <p className="text-xs text-muted-foreground">
            Posição no ranking: <RankLabel rank={driver.ranks[period]} />
          </p>
        </div>
        <span className={cn("shrink-0 font-data text-lg font-semibold", toneText[status.tone])}>{formatSLA(driver.historicalSLA)}%</span>
        {phone && (
          <Button
            size="icon"
            variant="ghost"
            className="relative z-10 -mr-2 -mt-2 shrink-0 text-muted-foreground hover:text-success"
            onClick={() => openWhatsApp(phone)}
            title={`Chamar ${driver.name} no WhatsApp`}
            aria-label={`Chamar ${driver.name} no WhatsApp`}
          >
            <MessageCircle aria-hidden="true" />
          </Button>
        )}
      </div>

      <SLABar value={driver.historicalSLA} tone={status.tone} goal={SLA_THRESHOLDS.EXCELLENT} className="h-1.5" />
      <PeriodHistoryRow driver={driver} selected={period} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DeliveryDots driver={driver} />
        <span className="text-xs text-muted-foreground">
          {driver.todayDeliveries.length > 0 ? `${plural(driver.todayDeliveries.length, "entrega", "entregas")} hoje` : "Sem entregas hoje"}
        </span>
      </div>
    </li>
  );
}

function DriverDetailSheet({
  driver,
  period,
  open,
  onOpenChange,
}: {
  driver: DriverAttention | null;
  period: SLAPeriodDays;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!driver) return null;
  const status = slaStatus(driver.historicalSLA);

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={UserCheck}
      tone={status.tone}
      title={driver.name}
      description={`SLA ${periodPhrase(period)}: ${formatSLA(driver.historicalSLA)}%. Histórico, posição no ranking e entregas de hoje.`}
      bodyLabel={`Detalhes de ${driver.name}`}
    >
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Como tem sido o SLA
        </h3>
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Período</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">SLA</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Notas</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Ocorrências</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Ranking</th>
              </tr>
            </thead>
            <tbody>
              {SLA_PERIODS.map((days) => {
                const stats = driver.periodStats[days];
                const hasData = stats.total > 0;
                return (
                  <tr key={days} className={cn("border-t", days === period && "bg-primary/5")}>
                    <th scope="row" className="px-3 py-2 text-left font-normal">{PERIOD_LABEL[days]}</th>
                    <td className={cn("px-3 py-2 text-right font-data font-semibold", hasData ? toneText[slaStatus(stats.sla).tone] : "text-muted-foreground")}>
                      {hasData ? `${formatSLA(stats.sla)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{stats.total}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{stats.occurrences}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                      <RankLabel rank={driver.ranks[days]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Entregas de hoje</h3>
        <dl className="grid grid-cols-3 gap-2">
          {(
            [
              ["completed", "Finalizadas", driver.completedCount],
              ["occurrence", "Ocorrências", driver.occurrenceCount],
              ["pending", "Pendentes", driver.pendingCount],
            ] as const
          ).map(([state, label, value]) => (
            <div key={state} className="rounded-lg border bg-card p-3">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", toneDot[DELIVERY_TONE[state]])} />
                {label}
              </dt>
              <dd className="mt-1 font-data text-2xl font-semibold leading-none text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        {driver.todayDeliveries.length > 0 ? (
          <ol className="divide-y overflow-hidden rounded-lg border bg-card">
            {driver.todayDeliveries.map((delivery) => (
              <li key={delivery.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-data text-sm font-medium text-muted-foreground"
                  title="Ordem no roteiro"
                >
                  {delivery.routeSequence}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-data text-sm font-semibold text-foreground">
                    {delivery.nfNumber.startsWith("NF") ? delivery.nfNumber : `NF ${delivery.nfNumber}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{delivery.recipient}</p>
                </div>
                <StatusBadge tone={DELIVERY_TONE[delivery.status]}>
                  {delivery.status === "occurrence" ? getOccurrenceLabel(delivery.occurrenceType) : DELIVERY_LABEL[delivery.status]}
                </StatusBadge>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState compact icon={Clock} title="Nenhuma entrega hoje ainda" description="As entregas aparecem aqui na ordem do roteiro." />
        )}
      </section>
    </DetailSheet>
  );
}

export function PredictiveIntelligence() {
  const { driverStats, isLoading } = useSLADB();
  const [selectedDriver, setSelectedDriver] = useState<DriverAttention | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [driversInRoute, setDriversInRoute] = useState<string[]>([]);
  const [todayInvoices, setTodayInvoices] = useState<TodayInvoice[]>([]);
  const [period, setPeriod] = useState<SLAPeriodDays>(30);
  const [onlyInRoute, setOnlyInRoute] = useState(false);

  // Fetch drivers currently in route and their today's invoices
  useEffect(() => {
    const fetchData = async () => {
      // Inicio do dia no horario de Brasilia (antes cortava pela data UTC e
      // trazia notas da noite anterior como "de hoje").
      const todayStart = getDayBoundsUTC(getTodayBrazil()).start;

      const [driversResult, invoicesResult] = await Promise.all([
        // Get drivers with status 'in_route'
        supabase
          .from("drivers")
          .select("id")
          .eq("status", "in_route"),
        
        // Get today's invoices with all statuses
        supabase
          .from("invoices")
          .select("id, nfe_number, recipient_name, status, occurrence_type, driver_id, updated_at")
          .gte("updated_at", todayStart),
      ]);

      setDriversInRoute((driversResult.data || []).map(d => d.id));
      setTodayInvoices((invoicesResult.data || []) as TodayInvoice[]);
    };

    fetchData();

    // Subscribe to driver status changes
    const channel = supabase
      .channel(uniqueChannelName("predictive-drivers"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Posicao de cada motorista no ranking de SLA de cada janela (1 = melhor).
  const ranksByDriver = useMemo(() => {
    const result = new Map<string, Record<SLAPeriodDays, PeriodRank>>();
    driverStats.forEach(d => result.set(d.driver_id, {} as Record<SLAPeriodDays, PeriodRank>));
    SLA_PERIODS.forEach(days => {
      const ranked = rankBySLA(
        driverStats,
        d => d.periodStats[days].sla,
        d => d.periodStats[days].total,
        d => d.driver_name
      );
      const of = ranked.filter(r => r.rank !== null).length;
      ranked.forEach(({ item, rank }) => {
        result.get(item.driver_id)![days] = { rank, of };
      });
    });
    return result;
  }, [driverStats]);

  // Motoristas que precisam de atencao no periodo escolhido:
  // SLA abaixo da meta com volume minimo de NFs finalizadas.
  const driversRequiringAttention = useMemo(() => {
    const attentionList: DriverAttention[] = driverStats
      .filter(d => {
        const stats = d.periodStats[period];
        return (
          (!onlyInRoute || driversInRoute.includes(d.driver_id)) &&
          stats.total >= MIN_INVOICES_FOR_ATTENTION[period] &&
          stats.sla < SLA_THRESHOLDS.EXCELLENT
        );
      })
      .map(driver => {
        // Get today's invoices for this driver
        const driverInvoices = todayInvoices
          .filter(inv => inv.driver_id === driver.driver_id)
          .map((inv, index) => ({
            id: inv.id,
            nfNumber: inv.nfe_number || `NF-${inv.id.slice(0, 8)}`,
            recipient: inv.recipient_name || "Cliente",
            status: inv.status === "delivered" 
              ? "completed" as const
              : inv.status === "occurrence" || inv.status === "returned"
                ? "occurrence" as const
                : "pending" as const,
            occurrenceType: inv.occurrence_type,
            routeSequence: index + 1,
          }));

        const completedCount = driverInvoices.filter(d => d.status === "completed").length;
        const occurrenceCount = driverInvoices.filter(d => d.status === "occurrence").length;
        const pendingCount = driverInvoices.filter(d => d.status === "pending").length;

        return {
          id: driver.driver_id,
          name: driver.driver_name,
          avatar: driver.driver_name.split(" ").map(n => n[0]).join("").slice(0, 2),
          phone: driver.phone,
          photoUrl: driver.photo_url,
          isInRoute: driversInRoute.includes(driver.driver_id),
          historicalSLA: driver.periodStats[period].sla,
          periodStats: driver.periodStats,
          ranks: ranksByDriver.get(driver.driver_id)!,
          todayDeliveries: driverInvoices,
          completedCount,
          occurrenceCount,
          pendingCount,
        };
      })
      .sort((a, b) => a.historicalSLA - b.historicalSLA);

    return attentionList;
  }, [driverStats, driversInRoute, todayInvoices, period, onlyInRoute, ranksByDriver]);

  // Split into critical and attention
  const criticalDrivers = driversRequiringAttention.filter(d => isSLACritical(d.historicalSLA));
  const attentionDrivers = driversRequiringAttention.filter(d => !isSLACritical(d.historicalSLA));

  const criticalCount = criticalDrivers.length;
  const warningCount = attentionDrivers.length;

  const handleDriverClick = (driver: DriverAttention) => {
    setSelectedDriver(driver);
    setIsDetailOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="p-6" aria-busy="true">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="hidden h-40 w-full rounded-lg xl:block" />
        </div>
      </Card>
    );
  }

  const emptyInRoute = onlyInRoute && driversInRoute.length === 0;
  const groups = [
    { key: "critical", title: `Estado crítico (abaixo de ${pct(SLA_THRESHOLDS.ATTENTION)})`, hint: "Acompanhe de perto", tone: "danger" as Tone, drivers: criticalDrivers },
    { key: "attention", title: `Abaixo da meta (${pct(SLA_THRESHOLDS.ATTENTION)} a ${pct(SLA_THRESHOLDS.EXCELLENT - 0.1)})`, hint: "Monitore", tone: "warning" as Tone, drivers: attentionDrivers },
  ].filter((group) => group.drivers.length > 0);

  return (
    <Card>
      <CardHeader className="gap-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Histórico de SLA por motorista</CardTitle>
            <CardDescription>
              SLA {periodPhrase(period)} e posição de cada um no ranking da frota.
            </CardDescription>
          </div>
          <HelperTooltip
            term="Histórico de SLA"
            explanation={`SLA de cada motorista no período escolhido. Entram na lista os motoristas abaixo de ${pct(SLA_THRESHOLDS.EXCELLENT)} com um mínimo de notas finalizadas. O ranking compara todos os motoristas com entregas no período (1º = melhor SLA).`}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {/* Mesmo visual do SegmentedControl; no celular o rotulo encurta (7d), o nome lido continua "7 dias". */}
          <ToggleGroup
            type="single"
            aria-label="Período do histórico"
            value={String(period)}
            onValueChange={(value) => value && setPeriod(Number(value) as SLAPeriodDays)}
            className="flex h-11 w-full gap-1 rounded-lg bg-muted p-1 text-muted-foreground sm:inline-flex sm:h-10 sm:w-auto"
          >
            {SLA_PERIODS.map((days) => (
              <ToggleGroupItem
                key={days}
                value={String(days)}
                aria-label={PERIOD_LABEL[days]}
                className="h-full flex-1 whitespace-nowrap px-2 hover:bg-card/60 sm:flex-none sm:px-3"
              >
                <span aria-hidden="true" className="sm:hidden">
                  {periodShort(days)}
                </span>
                <span aria-hidden="true" className="hidden sm:inline">
                  {PERIOD_LABEL[days]}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex min-h-10 items-center gap-2.5">
            <Switch id="only-in-route" checked={onlyInRoute} onCheckedChange={setOnlyInRoute} />
            <Label htmlFor="only-in-route" className="cursor-pointer text-sm font-normal text-muted-foreground">
              Mostrar só quem está em rota
            </Label>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {driversRequiringAttention.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2">
              {criticalCount > 0 && <StatusBadge tone="danger">{plural(criticalCount, "crítico", "críticos")}</StatusBadge>}
              {warningCount > 0 && <StatusBadge tone="warning">{plural(warningCount, "abaixo da meta", "abaixo da meta")}</StatusBadge>}
            </div>
            {groups.map((group) => (
              <section key={group.key} className="space-y-3">
                <h4 className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-foreground">
                  <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", toneDot[group.tone])} />
                  {group.title}
                  <span className="text-xs font-normal text-muted-foreground">· {group.hint}</span>
                </h4>
                <ul className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.drivers.map((driver) => (
                    <DriverAttentionCard key={driver.id} driver={driver} period={period} onClick={() => handleDriverClick(driver)} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : (
          <EmptyState
            compact
            icon={emptyInRoute ? AlertCircle : CheckCircle2}
            title={emptyInRoute ? "Nenhum motorista em rota no momento" : "Nenhum motorista precisa de atenção neste período"}
            description={
              emptyInRoute
                ? "Aguardando o início das rotas do dia."
                : `Ninguém abaixo de ${pct(SLA_THRESHOLDS.EXCELLENT)} ${periodPhrase(period)} (conta quem tem ao menos ${MIN_INVOICES_FOR_ATTENTION[period]} notas finalizadas no período).`
            }
          />
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4">
          <span className="text-xs font-medium text-muted-foreground">Entregas de hoje:</span>
          <DeliveryLegend />
        </div>
      </CardContent>

      <DriverDetailSheet driver={selectedDriver} period={period} open={isDetailOpen} onOpenChange={setIsDetailOpen} />
    </Card>
  );
}
