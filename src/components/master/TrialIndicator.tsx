import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BellRing, Gift } from "lucide-react";
import { getTrialDaysLeft } from "@/lib/billingStatus";
import type { BillingNoticeSummary } from "@/hooks/usePlatformAdmin";

interface TrialIndicatorProps {
  trialEndsAt: string | null | undefined;
  extensions?: number | null;
}

export function TrialIndicator({ trialEndsAt, extensions }: TrialIndicatorProps) {
  if (!trialEndsAt) {
    return <span className="text-xs text-muted-foreground">Teste sem data</span>;
  }

  const expired = new Date(trialEndsAt) <= new Date();
  const days = getTrialDaysLeft(trialEndsAt);
  const label = expired ? "Teste expirado" : days <= 0 ? "Teste acaba hoje" : `Teste: ${days}d`;
  const color = expired
    ? "bg-destructive/20 text-destructive border-destructive/30"
    : days <= 2
      ? "bg-warning/20 text-warning border-warning/30"
      : "bg-info/20 text-info border-info/30";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`gap-1 text-[11px] cursor-default ${color}`}>
          <Gift className="h-3 w-3" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          {expired ? "Terminou em" : "Termina em"} {new Date(trialEndsAt).toLocaleString("pt-BR")}
          {extensions ? ` • estendido ${extensions}x` : ""}
        </p>
      </TooltipContent>
    </Tooltip>
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
export function BillingNoticeBadge({ notice }: { notice: BillingNoticeSummary | null | undefined }) {
  if (!notice) return null;

  const isInApp = notice.channel === "in_app";
  const confirmed = !isInApp || !!notice.acknowledged_at;
  const when = new Date(notice.acknowledged_at || notice.shown_at || notice.created_at);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`gap-1 text-[10px] cursor-default ${
            confirmed
              ? "bg-success/10 text-success border-success/30"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <BellRing className="h-3 w-3" />
          {confirmed ? "Avisado" : "Aviso exibido"} {when.toLocaleDateString("pt-BR")}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          {NOTICE_LABELS[notice.notice_type] || notice.notice_type} via {CHANNEL_LABELS[notice.channel] || notice.channel}
          {isInApp && (notice.acknowledged_at ? " • cliente confirmou ciência" : " • cliente ainda não confirmou")}
          {notice.notes ? ` • ${notice.notes}` : ""}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
