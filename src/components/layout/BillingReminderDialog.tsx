import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, CalendarClock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { getBillingAlert, type BillingAlert } from "@/lib/billingStatus";
import { getTodayBrazil } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const DISMISS_PREFIX = "nahorafrota:billing-alert";

function dismissKey(tenantId: string, alert: BillingAlert) {
  return `${DISMISS_PREFIX}:${tenantId}:${alert.type}:${alert.referenceDate}`;
}

function wasDismissedToday(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === getTodayBrazil();
  } catch {
    return false;
  }
}

function rememberDismissal(key: string) {
  try {
    window.localStorage.setItem(key, getTodayBrazil());
  } catch {
    // Sem storage o aviso volta a aparecer no proximo carregamento; aceitavel.
  }
}

function recordNotice(alert: BillingAlert, acknowledged: boolean) {
  void supabase
    .rpc("record_billing_notice", {
      p_notice_type: alert.type,
      p_reference_date: alert.referenceDate,
      p_acknowledged: acknowledged,
    })
    .then(({ error }) => {
      if (error) console.warn("[billing] aviso nao registrado", error);
    });
}

/**
 * Pop-up para o administrador da empresa quando o teste gratis ou a fatura
 * estao vencendo. Aparece no maximo uma vez por dia por aviso, e registra no
 * banco que o aviso foi exibido e quando o cliente confirmou a ciencia, para a
 * equipe Na Hora ver a "cobranca avisada" no painel Master.
 */
export function BillingReminderDialog() {
  const { roles } = useAuth();
  const { access } = useTenantAccess();
  const [open, setOpen] = useState(false);
  const recordedRef = useRef<string | null>(null);

  const canSeeBilling = roles.includes("admin");
  const alert = useMemo(() => (canSeeBilling ? getBillingAlert(access) : null), [access, canSeeBilling]);
  const key = alert && access?.tenant_id ? dismissKey(access.tenant_id, alert) : null;

  useEffect(() => {
    if (!alert || !key || wasDismissedToday(key)) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (recordedRef.current !== key) {
      recordedRef.current = key;
      recordNotice(alert, false);
    }
  }, [alert, key]);

  if (!alert || !key) return null;

  const handleAcknowledge = () => {
    rememberDismissal(key);
    recordNotice(alert, true);
    setOpen(false);
  };

  const critical = alert.severity === "critical";
  const Icon = critical ? AlertTriangle : CalendarClock;

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) handleAcknowledge(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div
            className={cn(
              "mx-auto sm:mx-0 h-12 w-12 rounded-full flex items-center justify-center",
              critical ? "bg-destructive/10" : "bg-warning/10",
            )}
          >
            <Icon className={cn("h-6 w-6", critical ? "text-destructive" : "text-warning")} />
          </div>
          <AlertDialogTitle>{alert.title}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">{alert.message}</span>
            <span className="block text-xs">
              Referência: {new Date(`${alert.referenceDate}T12:00:00`).toLocaleDateString("pt-BR")}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <a
          href="mailto:suporte@nahorafrota.com.br?subject=Assinatura%20Na%20Hora%20Frota"
          className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          <Mail className="h-4 w-4" />
          Falar com o financeiro
        </a>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleAcknowledge}>Entendi</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
