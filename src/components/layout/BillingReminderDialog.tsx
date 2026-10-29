import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, CalendarClock, Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/config/navigation";
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
  const confirmRef = useRef<HTMLButtonElement>(null);

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
      <AlertDialogContent
        // Sem botao "Cancelar" o Radix nao focava nada: o foco ficava fora da janela.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          confirmRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <div
            aria-hidden="true"
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full",
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
        <AlertDialogFooter>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Assinatura Na Hora Frota")}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Mail aria-hidden="true" />
            Falar com o financeiro
          </a>
          <AlertDialogAction ref={confirmRef} onClick={handleAcknowledge}>
            Entendi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
