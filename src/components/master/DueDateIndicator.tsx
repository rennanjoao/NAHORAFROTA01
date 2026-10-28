import { differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarDays } from "lucide-react";

interface DueDateIndicatorProps {
  nextDueDate: string | null;
  financialStatus: string | null;
}

export function DueDateIndicator({ nextDueDate, financialStatus }: DueDateIndicatorProps) {
  if (!nextDueDate) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate + "T12:00:00");
  const diff = differenceInDays(due, today);

  let color: string;
  let label: string;

  if (diff < 0) {
    color = "bg-destructive/20 text-destructive border-destructive/30";
    label = `Atrasado ${Math.abs(diff)}d`;
  } else if (diff <= 7) {
    color = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    label = diff === 0 ? "Vence hoje" : `Vence em ${diff}d`;
  } else {
    color = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    label = `${diff}d restantes`;
  }

  const formattedDate = due.toLocaleDateString("pt-BR");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`gap-1 text-[11px] cursor-default ${color}`}>
          <CalendarDays className="h-3 w-3" />
          {formattedDate}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function getDueSoonCount(tenants: Array<{ next_due_date?: string | null }>, withinDays = 5): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return tenants.filter((t) => {
    if (!t.next_due_date) return false;
    const due = new Date(t.next_due_date + "T12:00:00");
    const diff = differenceInDays(due, today);
    return diff >= 0 && diff <= withinDays;
  }).length;
}

export function getOverdueCount(tenants: Array<{ next_due_date?: string | null }>): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return tenants.filter((t) => {
    if (!t.next_due_date) return false;
    const due = new Date(t.next_due_date + "T12:00:00");
    return differenceInDays(due, today) < 0;
  }).length;
}
