import { forwardRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/patterns";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { brandAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { getDriverStatus, PENDING_PLATE } from "./driverConfig";

/** Situacao do motorista: ponto + texto. Pulsa so quando esta em rota agora. */
export function DriverStatusBadge({ status, className }: { status: string; className?: string }) {
  const config = getDriverStatus(status);
  return (
    <StatusBadge tone={config.tone} pulse={status === "in_route"} className={className}>
      {config.label}
    </StatusBadge>
  );
}

/** Placa no formato de etiqueta (fonte de numeros, letras espacadas). */
export function PlateTag({ plate, className }: { plate?: string | null; className?: string }) {
  if (!plate || plate === PENDING_PLATE) {
    return <span className={cn("text-xs text-muted-foreground", className)}>Placa pendente</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border bg-muted/60 px-1.5 py-0.5 font-data text-xs font-semibold uppercase tracking-wider text-foreground",
        className,
      )}
    >
      {plate}
    </span>
  );
}

/** Foto do motorista. Decorativa: o nome sempre aparece ao lado. */
export function DriverAvatar({ photo, className }: { photo?: string | null; className?: string }) {
  return (
    <img
      src={brandAvatar(photo)}
      alt=""
      loading="lazy"
      className={cn("h-10 w-10 shrink-0 rounded-full border bg-muted object-cover", className)}
    />
  );
}

type IconActionProps = Omit<ButtonProps, "children" | "size"> & {
  icon: LucideIcon;
  /** Nome do botao (leitor de tela e dica ao passar o mouse). */
  label: string;
  size?: "icon" | "icon-sm";
  children?: ReactNode;
};

/** Botao so com icone: sempre com aria-label e dica. */
export const IconAction = forwardRef<HTMLButtonElement, IconActionProps>(
  ({ icon: Icon, label, size = "icon", variant = "ghost", children, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button ref={ref} type="button" variant={variant} size={size} aria-label={label} {...props}>
          {children ?? <Icon aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  ),
);
IconAction.displayName = "IconAction";

/** Linha "rotulo: valor" das listas de dados (folha de detalhe, resumo). */
export function DataRow({ label, children, mono }: { label: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words text-right font-medium text-foreground", mono && "font-data")}>{children}</dd>
    </div>
  );
}

/** Lista de DataRow com divisorias. */
export function DataList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("divide-y rounded-lg border bg-card px-4", className)}>{children}</dl>;
}
