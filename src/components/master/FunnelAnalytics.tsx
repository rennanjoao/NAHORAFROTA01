import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CalendarPlus, Loader2, RefreshCw, UserX, Gift, MousePointerClick, TrendingUp } from "lucide-react";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Funil de Aquisição</h2>
          <p className="text-sm text-muted-foreground">
            Quem visitou, quem se cadastrou, quem testou e quem não contratou
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchSummary} disabled={isLoading} aria-label="Atualizar funil">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="py-4 text-sm text-destructive">
            Não foi possível carregar o funil: {error}. Verifique se a migration de funil foi aplicada.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <MousePointerClick className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{summary?.visitors ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Visitantes únicos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Gift className="h-8 w-8 text-sky-400" />
            <div>
              <p className="text-2xl font-bold">{summary?.trial_active ?? inTrial.length}</p>
              <p className="text-xs text-muted-foreground">Testando agora</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <UserX className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-2xl font-bold">{summary?.trial_expired_not_converted ?? expiredNotConverted.length}</p>
              <p className="text-xs text-muted-foreground">Testaram e não contrataram</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold">
                {summary ? pct(summary.converted, summary.registered) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Conversão teste → cliente</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Etapas do funil</CardTitle>
          <CardDescription>
            % em relação à etapa anterior.{" "}
            {summary ? `${summary.abandoned_registrations} visitante(s) começaram o cadastro e não concluíram.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && !summary ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step, index) => {
                const previous = index > 0 ? steps[index - 1].value : step.value;
                return (
                  <div key={step.label} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3">
                    <span className="text-sm text-foreground truncate">{step.label}</span>
                    <div className="h-6 rounded bg-muted/40" title={`${step.label}: ${step.value}`}>
                      <div
                        className="h-6 rounded bg-primary transition-all"
                        style={{ width: `${Math.max(step.value > 0 ? 2 : 0, (step.value / maxStep) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm tabular-nums text-right w-28">
                      <span className="font-semibold text-foreground">{step.value}</span>
                      <span
                        className="text-muted-foreground"
                        title={index > 0 && step.value > previous ? "Inclui cadastros sem visita registrada (ex.: bloqueador de rastreio)" : undefined}
                      >
                        {" "}· {index === 0 ? "100%" : pct(step.value, previous)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Testaram e não contrataram</CardTitle>
            <CardDescription>Oportunidades para a equipe comercial retomar o contato</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {expiredNotConverted.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum teste expirado no período</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Fim do teste</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiredNotConverted.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{tenant.razao_social}</p>
                        <p className="text-xs text-muted-foreground">{tenant.cnpj}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{tenant.admin_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{tenant.admin_email || tenant.telefone || ""}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString("pt-BR") : "—"}
                        {tenant.trial_extensions ? (
                          <Badge variant="outline" className="ml-1 text-[10px]">+{tenant.trial_extensions}x</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={extendingTenantId === tenant.id}
                          onClick={() => onExtendTrial(tenant)}
                        >
                          <CalendarPlus className="h-4 w-4 mr-1" /> +7 dias
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Em teste agora</CardTitle>
            <CardDescription>Ordenado por quem termina primeiro</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {inTrial.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma empresa em teste</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Restam</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inTrial.map((tenant) => {
                    const days = tenant.trial_ends_at ? getTrialDaysLeft(tenant.trial_ends_at) : null;
                    return (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{tenant.razao_social}</p>
                          <p className="text-xs text-muted-foreground">
                            Cadastro em {new Date(tenant.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{tenant.admin_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{tenant.admin_email || ""}</p>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {days === null ? "—" : days <= 0 ? "hoje" : `${days} dia(s)`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
