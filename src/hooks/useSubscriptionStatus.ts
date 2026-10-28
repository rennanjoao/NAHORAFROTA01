import { useTenantData } from "@/hooks/useTenantData";
import { differenceInDays } from "date-fns";

export type SubscriptionStatus = "active" | "warning" | "due_today" | "expired" | "loading" | "no_date";

export function useSubscriptionStatus() {
  const { tenant, isLoading } = useTenantData();

  if (isLoading) return { status: "loading" as const, daysRemaining: 0, isLoading: true };
  if (!tenant?.next_due_date) return { status: "no_date" as const, daysRemaining: 999, isLoading: false };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(tenant.next_due_date + "T12:00:00");
  const diff = differenceInDays(due, today);

  let status: SubscriptionStatus;
  if (diff < 0) status = "expired";
  else if (diff === 0) status = "due_today";
  else if (diff <= 5) status = "warning";
  else status = "active";

  return { status, daysRemaining: diff, isLoading: false };
}
