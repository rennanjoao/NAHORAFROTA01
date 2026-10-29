import { Check, Crown, CreditCard, Mail, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, type Tone } from "@/components/patterns";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { cn } from "@/lib/utils";

const SUPPORT_EMAIL = "suporte@nahorafrota.com.br";

const formatDate = (value?: string | null) =>
  value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("pt-BR") : null;

function UsageMeter({ label, current, max }: { label: string; current: number; max: number }) {
  const unlimited = max === -1;
  const percent = unlimited || max <= 0 ? 0 : Math.min(100, Math.round((current / max) * 100));
  const atLimit = !unlimited && current >= max;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-data font-semibold text-foreground">
          {current}
          <span className="font-normal text-muted-foreground"> {unlimited ? "· sem limite" : `de ${max}`}</span>
        </span>
      </div>
      {!unlimited && (
        <Progress
          value={percent}
          aria-label={`${label}: ${current} de ${max}`}
          className={cn(atLimit && "[&>div]:bg-destructive")}
        />
      )}
    </div>
  );
}

/** Administracao > Plano e cobranca (dados reais da empresa; antes havia boleto,
 *  QR Code PIX e formulario de cartao de mentira). */
export function AdminPlanPanel() {
  const { systemUsersCount, driversCount, vehiclesCount, limits, contractedPlan, planLabels: pLabels } = usePlanLimits();
  const { status: subscriptionStatus, daysRemaining, access } = useSubscriptionStatus();
  const isTrial = subscriptionStatus === "trial";

  const planBadge: { label: string; tone: Tone } = isTrial
    ? { label: "Teste grátis", tone: "info" }
    : subscriptionStatus === "expired"
      ? { label: "Vencido", tone: "danger" }
      : subscriptionStatus === "overdue"
        ? { label: "Em atraso", tone: "danger" }
        : subscriptionStatus === "due_today" || subscriptionStatus === "warning"
          ? { label: "Vencendo", tone: "warning" }
          : { label: "Ativo", tone: "success" };

  const billingLine = isTrial
    ? `Teste grátis até ${formatDate(access?.trial_ends_at) ?? "—"} (${daysRemaining <= 0 ? "termina hoje" : `${daysRemaining} ${daysRemaining === 1 ? "dia restante" : "dias restantes"}`}).`
    : formatDate(access?.next_due_date)
      ? `Próxima cobrança em ${formatDate(access?.next_due_date)}.`
      : "Próxima cobrança: a definir com a equipe Na Hora Frota.";

  const features = [
    { label: "Início e mapa em tempo real", enabled: limits.realtime },
    { label: "Importação de XML em lote", enabled: limits.batch_import },
    { label: "SLA semanal e histórico", enabled: limits.sla_weekly },
    { label: "SLA detalhado por motorista", enabled: limits.sla_drilldown },
    { label: "Acerto financeiro e rentabilidade", enabled: limits.financial_dashboard },
  ];

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `${isTrial ? "Contratar plano" : "Fatura / 2ª via"} - ${access?.razao_social || ""}`,
  )}`;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SettingsCard
        className="lg:col-span-2"
        icon={Crown}
        title={isTrial ? "Teste grátis com acesso completo" : `Plano ${pLabels[contractedPlan] || contractedPlan}`}
        description={access?.razao_social || "Sua empresa"}
        actions={<StatusBadge tone={planBadge.tone}>{planBadge.label}</StatusBadge>}
        footerHint={billingLine}
      >
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Uso do plano</h3>
            <UsageMeter label="Usuários do painel" current={systemUsersCount} max={limits.max_users} />
            <UsageMeter label="Motoristas" current={driversCount} max={limits.max_drivers} />
            <UsageMeter label="Veículos da casa" current={vehiclesCount} max={limits.max_vehicles} />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">O que está incluído</h3>
            <ul className="space-y-2.5">
              {features.map((feature) => (
                <li key={feature.label} className="flex items-center gap-2.5 text-sm">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      feature.enabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {feature.enabled ? <Check className="h-3 w-3" strokeWidth={3} /> : <Minus className="h-3 w-3" />}
                  </span>
                  <span className={feature.enabled ? "text-foreground" : "text-muted-foreground"}>{feature.label}</span>
                  {!feature.enabled && <span className="ml-auto text-xs text-muted-foreground">Plano superior</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={CreditCard}
        title="Pagamento e contratação"
        description="As faturas (boleto ou PIX) são emitidas pela equipe Na Hora Frota e enviadas para o e-mail da empresa."
        className="self-start"
      >
        <div className="space-y-3">
          <Button asChild className="w-full">
            <a href={mailto}>
              <Mail aria-hidden="true" />
              {isTrial ? "Contratar um plano" : "Pedir 2ª via ou mudar de plano"}
            </a>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Ou escreva para{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary underline-offset-4 hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </SettingsCard>
    </div>
  );
}
