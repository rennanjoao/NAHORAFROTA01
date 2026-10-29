import { BellRing } from "lucide-react";
import { StatusBadge } from "@/components/patterns";
import { getTrialDaysLeft } from "@/lib/billingStatus";
import type { BillingNoticeSummary } from "@/hooks/usePlatformAdmin";
import { cn } from "@/lib/utils";

interface TrialIndicatorProps {
  trialEndsAt: string | null | undefined;
  extensions?: number | null;
}

/** Prazo do teste gratis: selo com os dias que faltam e a data de fim abaixo. */
export function TrialIndicator({ trialEndsAt, extensions }: TrialIndicatorProps) {
  if (!trialEndsAt) {
    return <span className="text-xs text-muted-foreground">Teste sem data</span>;
  }

  const expired = new Date(trialEndsAt) <= new Date();
  const days = getTrialDaysLeft(trialEndsAt);
  const label = expired
    ? "Teste expirado"
    : days <= 0
      ? "Teste acaba hoje"
      : `Teste: ${days} ${days === 1 ? "dia" : "dias"}`;
  const tone = expired ? "danger" : days <= 2 ? "warning" : "info";
  const endDate = new Date(trialEndsAt).toLocaleDateString("pt-BR");

  return (
    <span className="flex flex-col items-start gap-0.5">
      <StatusBadge tone={tone}>{label}</StatusBadge>
      <span className="pl-1 text-xs text-muted-foreground">
        {expired ? "Terminou em" : "Até"} {endDate}
        {extensions ? ` · estendido ${extensions}x` : ""}
      </span>
    </span>
  );
}

const NOTICE_LABELS: Record<string, string> = {
  trial_ending: "fim do teste",
  trial_expired: "teste expirado",
  due_soon: "vencimento próximo",
  due_today: "vence hoje",
  overdue: "em atraso",
  manual: "contato manual",
};

const CHANNEL_LABELS: Record<string, string> = {
  in_app: "pop-up no sistema",
  email: "e-mail",
  whatsapp: "WhatsApp",
  phone: "telefone",
};

/** Selo "Avisado" com o ultimo aviso de cobranca registrado para o cliente. */
export function BillingNoticeBadge({ notice, className }: { notice: BillingNoticeSummary | null | undefined; className?: string }) {
  if (!notice) return null;

  const isInApp = notice.channel === "in_app";
  const confirmed = !isInApp || !!notice.acknowledged_at;
  const when = new Date(notice.acknowledged_at || notice.shown_at || notice.created_at);
  const details = [
    `${NOTICE_LABELS[notice.notice_type] || notice.notice_type} por ${CHANNEL_LABELS[notice.channel] || notice.channel}`,
    isInApp ? (notice.acknowledged_at ? "cliente confirmou ciência" : "cliente ainda não confirmou") : null,
    notice.notes,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground", className)} title={details}>
      <BellRing className={cn("h-3.5 w-3.5 shrink-0", confirmed ? "text-success" : "text-muted-foreground")} aria-hidden="true" />
      <span className="truncate">
        {confirmed ? "Avisado" : "Aviso exibido"} em {when.toLocaleDateString("pt-BR")}
        <span className="sr-only">: {details}</span>
      </span>
    </span>
  );
}
