import { StatusBadge, type Tone } from "@/components/patterns";
import { formatDateOnly } from "@/lib/timezone";
import { daysUntilDue } from "./dueDates";

interface DueDateIndicatorProps {
  nextDueDate: string | null;
  financialStatus: string | null;
}

const days = (count: number) => `${count} ${count === 1 ? "dia" : "dias"}`;

/** Vencimento da assinatura: selo com o prazo e a data por extenso abaixo. */
export function DueDateIndicator({ nextDueDate }: DueDateIndicatorProps) {
  if (!nextDueDate) {
    return <span className="text-xs text-muted-foreground">Sem vencimento</span>;
  }

  const diff = daysUntilDue(nextDueDate);

  let tone: Tone;
  let label: string;

  if (diff < 0) {
    tone = "danger";
    label = `Atrasado há ${days(Math.abs(diff))}`;
  } else if (diff <= 7) {
    tone = "warning";
    label = diff === 0 ? "Vence hoje" : `Vence em ${days(diff)}`;
  } else {
    tone = "success";
    label = `Em dia · ${days(diff)}`;
  }

  return (
    <span className="flex flex-col items-start gap-0.5">
      <StatusBadge tone={tone}>{label}</StatusBadge>
      <span className="pl-1 text-xs text-muted-foreground">Vencimento {formatDateOnly(nextDueDate.slice(0, 10))}</span>
    </span>
  );
}
