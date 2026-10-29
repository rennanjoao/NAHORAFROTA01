import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, Section, StatCard } from "@/components/patterns";
import { CalendarPlus, Loader2, RefreshCw, UserX, Gift, MousePointerClick, TrendingUp, Hourglass, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTrialDaysLeft, isTrialExpired } from "@/lib/billingStatus";
import type { TenantData } from "@/hooks/usePlatformAdmin";

interface FunnelSummary {
  visitors: number;
  register_views: number;
  register_started: number;
  register_submitted: number;
  registered: number;
  trial_active: number;
  trial_expired_not_converted: number;
  converted: number;
  abandoned_registrations: number;
}

interface FunnelAnalyticsProps {
  tenants: TenantData[];
  onExtendTrial: (tenant: TenantData) => void;
  extendingTenantId: string | null;
}

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

function pct(part: number, total: number): string {
  if (!total) return "—";
  // Mais que a etapa anterior = cadastros sem visita registrada (ex.: bloqueador de rastreio).
  if (part > total) return "—";
  return `${((part / total) * 100).toFixed(1).replace(".", ",")}%`;
}

export function FunnelAnalytics({ tenants, onExtendTrial, extendingTenantId }: FunnelAnalyticsProps) {
  const [period, setPeriod] = useState("30");
  const [summary, setSummary] = useState<FunnelSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodStart = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - Number(period));
    return start;
  }, [period]);

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_funnel_summary", {
      p_from: periodStart.toISOString(),
      p_to: new Date(Date.now() + 60 * 1000).toISOString(),
    });
    if (rpcError) {
      console.error("Funnel summary error:", rpcError);
      setError(rpcError.message);
      setSummary(null);
    } else {
      setSummary((typeof data === "string" ? JSON.parse(data) : data) as unknown as FunnelSummary);
    }
    setIsLoading(false);
  }, [periodStart]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const periodTenants = useMemo(
    () => tenants.filter((t) => new Date(t.created_at) >= periodStart),
    [tenants, periodStart],
  );

  // "Testou e nao cadastrou": teste acabou e a empresa nao virou cliente.
  const expiredNotConverted = useMemo(
    () =>
      periodTenants
        .filter((t) => isTrialExpired(t) && !t.converted_at)
        .sort((a, b) => new Date(b.trial_ends_at || 0).getTime() - new Date(a.trial_ends_at || 0).getTime()),
    [periodTenants],
  );

  const inTrial = useMemo(
    () =>
      periodTenants
        .filter((t) => t.status === "trial" && !isTrialExpired(t))
        .sort((a, b) => new Date(a.trial_ends_at || 0).getTime() - new Date(b.trial_ends_at || 0).getTime()),
    [periodTenants],
  );

  const steps = summary
    ? [
        { label: "Visitaram a página", value: summary.visitors },
        { label: "Abriram o cadastro", value: summary.register_views },
        { label: "Começaram a preencher", value: summary.register_started },
        { label: "Cadastraram (iniciaram teste)", value: summary.registered },
        { label: "Contrataram", value: summary.converted },
      ]
    : [];
  const maxStep = Math.max(1, ...steps.map((s) => s.value));

  return (
    <Section
      title="Funil de aquisição"
      description="Quem visitou, quem se cadastrou, quem testou e quem não contratou."
      actions={
        <>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-[11rem]" aria-label="Período do funil">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Provider proprio: o funil tambem aparece fora do painel (testes). */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => !isLoading && fetchSummary()}
                  aria-disabled={isLoading || undefined}
                  className="aria-disabled:pointer-events-none aria-disabled:opacity-60"
                  aria-label="Atualizar funil"
                >
                  <RefreshCw className={isLoading ? "animate-spin" : undefined} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      }
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-foreground">
            Não foi possível carregar o funil agora. Use o botão de atualizar ao lado do período para tentar de novo.
          </AlertDescription>
        </Alert>
      )}

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visitantes únicos" value={summary?.visitors ?? "—"} icon={MousePointerClick} />
        <StatCard label="Testando agora" value={summary?.trial_active ?? inTrial.length} icon={Gift} tone="info" />
        <StatCard
          label="Não contrataram"
          hint="O teste acabou sem virar cliente"
          value={summary?.trial_expired_not_converted ?? expiredNotConverted.length}
          icon={UserX}
          tone="warning"
        />
        <StatCard
          label="Viraram clientes"
          hint="Dos que começaram o teste"
          value={summary ? pct(summary.converted, summary.registered) : "—"}
          icon={TrendingUp}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Etapas do funil</CardTitle>
          <CardDescription>
            A porcentagem compara com a etapa anterior.{" "}
            {summary
              ? summary.abandoned_registrations === 1
                ? "1 visitante começou o cadastro e não concluiu."
                : `${summary.abandoned_registrations} visitantes começaram o cadastro e não concluíram.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && !summary ? (
            <div className="space-y-3" role="status" aria-label="Carregando funil">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-7 w-full" />
              ))}
            </div>
          ) : (
            <ol className="space-y-3.5">
              {steps.map((step, index) => {
                const previous = index > 0 ? steps[index - 1].value : step.value;
                const share = index === 0 ? "100%" : pct(step.value, previous);
                return (
                  <li key={step.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[12rem_minmax(0,1fr)_7rem]">
                    {/* Quebra em vez de cortar ("Cadastraram (iniciaram teste)" ficava pela metade). */}
                    <span className="text-sm leading-snug text-foreground">{step.label}</span>
                    <span className="text-right text-sm tabular-nums sm:order-last">
                      <span className="font-data font-semibold text-foreground">{step.value}</span>
                      <span
                        className="text-muted-foreground"
                        title={index > 0 && step.value > previous ? "Inclui cadastros sem visita registrada (ex.: bloqueador de rastreio)" : undefined}
                      >
                        {" "}· {share}
                      </span>
                    </span>
                    <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-muted sm:col-span-1" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-slow ease-out"
                        style={{ width: `${Math.max(step.value > 0 ? 2 : 0, (step.value / maxStep) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Testaram e não contrataram</CardTitle>
            <CardDescription>Oportunidades para a equipe comercial retomar o contato.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {expiredNotConverted.length === 0 ? (
              <EmptyState compact icon={PartyPopper} title="Nenhum teste expirado no período" />
            ) : (
              <ul className="divide-y border-t">
                {expiredNotConverted.map((tenant) => (
                  <li key={tenant.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium text-foreground" title={tenant.razao_social}>
                        {tenant.razao_social}
                      </p>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        title={`${tenant.admin_name || "Sem responsável"}${tenant.admin_email || tenant.telefone ? ` · ${tenant.admin_email || tenant.telefone}` : ""}`}
                      >
                        {tenant.admin_name || "Sem responsável"}
                        {tenant.admin_email || tenant.telefone ? ` · ${tenant.admin_email || tenant.telefone}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Teste terminou em {tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString("pt-BR") : "—"}
                        {tenant.trial_extensions ? (
                          <Badge variant="outline" className="ml-1.5">estendido {tenant.trial_extensions}x</Badge>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="shrink-0"
                      disabled={extendingTenantId === tenant.id}
                      onClick={() => onExtendTrial(tenant)}
                    >
                      {extendingTenantId === tenant.id ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        <CalendarPlus aria-hidden="true" />
                      )}
                      +7 dias
                      <span className="sr-only"> de teste para {tenant.razao_social}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Em teste agora</CardTitle>
            <CardDescription>Quem termina primeiro aparece no topo.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {inTrial.length === 0 ? (
              <EmptyState compact icon={Hourglass} title="Nenhuma empresa em teste" />
            ) : (
              <ul className="divide-y border-t">
                {inTrial.map((tenant) => {
                  const days = tenant.trial_ends_at ? getTrialDaysLeft(tenant.trial_ends_at) : null;
                  return (
                    <li key={tenant.id} className="flex items-center justify-between gap-4 px-6 py-4">
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-medium text-foreground" title={tenant.razao_social}>
                          {tenant.razao_social}
                        </p>
                        <p
                          className="truncate text-xs text-muted-foreground"
                          title={`${tenant.admin_name || "Sem responsável"}${tenant.admin_email ? ` · ${tenant.admin_email}` : ""}`}
                        >
                          {tenant.admin_name || "Sem responsável"}
                          {tenant.admin_email ? ` · ${tenant.admin_email}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Cadastro em {new Date(tenant.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span className="shrink-0 text-right">
                        <span className="block font-data text-lg font-semibold leading-none text-foreground">
                          {days === null ? "—" : days <= 0 ? "Hoje" : days}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {days === null ? "sem data" : days <= 0 ? "último dia" : days === 1 ? "dia restante" : "dias restantes"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
