import { AlertCircle, Clock, Gift, Mail, ShieldAlert, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/config/navigation";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { plural } from "./status";

type BannerVariant = "info" | "warning" | "destructive";

/** Aviso da assinatura (teste gratis, vencimento, atraso) no topo do painel. */
export function NotificationBanner() {
  const { status, daysRemaining, isLoading, access } = useSubscriptionStatus();

  if (isLoading || !access || access.is_platform_admin) return null;

  let icon: LucideIcon = Clock;
  let title = "";
  let message = "";
  let variant: BannerVariant = "info";

  if (status === "trial") {
    // Teste gratis: contagem regressiva sempre visivel durante o periodo.
    icon = Gift;
    const until = access.trial_ends_at ? new Date(access.trial_ends_at).toLocaleDateString("pt-BR") : "";
    title = daysRemaining <= 0 ? "Seu teste grátis termina hoje" : `Teste grátis: ${plural(daysRemaining, "dia restante", "dias restantes")}`;
    message = `${until ? `Vale até ${until}. ` : ""}Fale com a equipe Na Hora Frota para contratar e não perder o acesso.`;
    variant = daysRemaining <= 1 ? "warning" : "info";
  } else if (status === "expired") {
    // Apos o vencimento o ProtectedRoute ja bloqueia; aqui fica de reserva.
    icon = ShieldAlert;
    title = "Acesso suspenso";
    message = "Fale com o suporte para renovar a assinatura.";
    variant = "destructive";
  } else if (status === "overdue") {
    icon = AlertCircle;
    const late = Math.abs(daysRemaining);
    title = `Pagamento em atraso há ${plural(late, "dia", "dias")}`;
    message = "Regularize para evitar a suspensão do acesso.";
    variant = "destructive";
  } else if (status === "due_today") {
    icon = AlertCircle;
    title = "Sua assinatura vence hoje";
    message = "Regularize para evitar interrupções.";
    variant = "warning";
  } else if (status === "warning") {
    // 1 a 5 dias para vencer
    icon = Clock;
    title = `Sua assinatura vence em ${plural(daysRemaining, "dia", "dias")}`;
    message = "Regularize para evitar interrupções.";
    variant = "warning";
  } else {
    return null;
  }

  const Icon = icon;

  return (
    <Alert variant={variant} role="status" className="mb-6">
      <Icon aria-hidden="true" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold leading-snug text-foreground">{title}</p>
          <AlertDescription className="mt-0.5">{message}</AlertDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 self-start sm:self-center">
          <a href={`mailto:${SUPPORT_EMAIL}`}>
            <Mail aria-hidden="true" />
            Falar com a equipe
          </a>
        </Button>
      </div>
    </Alert>
  );
}
