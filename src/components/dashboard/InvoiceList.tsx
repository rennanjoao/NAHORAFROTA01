import type { ReactNode } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { formatWeight, type StatusInfo } from "./status";

export interface InvoiceRowData {
  id: string;
  /** "NF 1234" */
  number: string;
  recipient: string;
  address?: string | null;
  value?: number | null;
  weight?: number | null;
  status?: StatusInfo;
  /** Linha extra curta ("Entregue às 14:05"). */
  meta?: ReactNode;
  /** Valor a direita no lugar do R$ (ex.: peso no SLA). */
  aside?: ReactNode;
  onClick?: () => void;
}

/** Lista de notas em linhas limpas (um cartao, divisorias entre as linhas). */
export function InvoiceList({ items, className }: { items: InvoiceRowData[]; className?: string }) {
  return (
    <ul className={cn("divide-y overflow-hidden rounded-lg border bg-card", className)}>
      {items.map((item) => (
        <li key={item.id}>
          <InvoiceRow {...item} />
        </li>
      ))}
    </ul>
  );
}

export function InvoiceRow({ number, recipient, address, value, weight, status, meta, aside, onClick }: InvoiceRowData) {
  const body = (
    <>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-data text-sm font-semibold text-foreground">{number}</span>
          {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        </div>
        <p className="truncate text-sm text-foreground">{recipient}</p>
        {address && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2 break-words">{address}</span>
          </p>
        )}
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      </div>
      <div className="shrink-0 text-right">
        {aside ?? (
          <>
            {typeof value === "number" && (
              <p className="whitespace-nowrap font-data text-sm font-semibold text-foreground">{formatCurrency(value)}</p>
            )}
            {weight ? <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">{formatWeight(weight)}</p> : null}
          </>
        )}
      </div>
      {onClick && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {body}
      </button>
    );
  }
  return <div className="flex items-start gap-3 px-4 py-3">{body}</div>;
}
