import { AlertCircle, Clock, Gift, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

export function NotificationBanner() {
  const { status, daysRemaining, isLoading, access } = useSubscriptionStatus();

  if (isLoading || !access || access.is_platform_admin) return null;

  let icon = Clock;
  let message = "";
  let style = "";

  if (status === "trial") {
    // Teste gratis: contagem regressiva sempre visivel durante o periodo.
    icon = Gift;
    const until = access.trial_ends_at ? new Date(access.trial_ends_at).toLocaleDateString("pt-BR") : "";
    const remaining =
      daysRemaining <= 0 ? "termina hoje" : `${daysRemaining} dia${daysRemaining > 1 ? "s" : ""} restante${daysRemaining > 1 ? "s" : ""}`;
    message = `Teste grátis: ${remaining}${until ? ` (até ${until})` : ""}. Fale com a equipe Na Hora Frota para contratar.`;
    style =
      daysRemaining <= 1
        ? "bg-destructive/10 border-destructive/20 text-destructive"
        : "bg-primary/10 border-primary/20 text-primary";
  } else if (status === "expired") {
    // Post-expiration — should be blocked at ProtectedRoute level,
    // but show banner as fallback
    icon = ShieldAlert;
    message = "Acesso Suspenso. Entre em contato com o suporte para renovação.";
    style = "bg-destructive/15 border-destructive/30 text-destructive";
  } else if (status === "overdue") {
    icon = AlertCircle;
    const late = Math.abs(daysRemaining);
    message = `Pagamento em atraso há ${late} dia${late > 1 ? "s" : ""}. Regularize para evitar a suspensão do acesso.`;
    style = "bg-destructive/10 border-destructive/20 text-destructive";
  } else if (status === "due_today") {
    icon = AlertCircle;
    message = "Sua assinatura vence hoje. Regularize para evitar interrupções.";
    style = "bg-destructive/10 border-destructive/20 text-destructive";
  } else if (status === "warning") {
    // 1-5 days remaining
    icon = Clock;
    message = `Sua assinatura vence em ${daysRemaining} dia${daysRemaining > 1 ? "s" : ""}. Regularize para evitar interrupções.`;
    style = "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400";
  } else {
    return null;
  }

  const Icon = icon;

  return (
    <div className="mb-6">
      <div className={cn("flex items-center gap-3 px-4 py-3 rounded-lg border", style)}>
        <Icon className="h-5 w-5 flex-shrink-0" />
        <p className="flex-1 text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}
