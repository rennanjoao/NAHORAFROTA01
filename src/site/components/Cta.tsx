import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode, MouseEventHandler } from "react";

type Props = {
  children: ReactNode;
  to?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  variant?: "primary" | "outline" | "ghost" | "dark";
  size?: "md" | "lg";
  className?: string;
  arrow?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  ariaLabel?: string;
};

/**
 * Botão de ação da marca: chanfro de 45° no canto superior direito.
 * O clip-path fica num elemento interno para o anel de foco continuar visível.
 */
export function Cta({ children, to, href, onClick, variant = "primary", size = "md", className, arrow, type = "button", disabled, ariaLabel }: Props) {
  const base = "group relative inline-flex shrink-0 select-none items-center justify-center font-heading font-semibold tracking-tight transition-[transform,filter] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";
  const pad = size === "lg" ? "px-7" : "px-5";
  const inner = cn(
    "nhf-chamfer inline-flex w-full items-center justify-center gap-2 transition-colors duration-200",
    size === "lg" ? "h-14 text-base" : "h-12 text-[15px]",
    variant !== "outline" && pad,
    variant === "primary" && "shine bg-brand text-brand-foreground",
    variant === "dark" && "shine bg-nhf-ink text-white group-hover:bg-nhf-graphite dark:bg-white dark:text-nhf-ink dark:group-hover:bg-nhf-mist",
    variant === "outline" && "bg-foreground/20 p-px text-foreground group-hover:bg-brand",
    variant === "ghost" && "bg-transparent text-foreground group-hover:bg-accent",
  );
  const label = (
    <>
      {children}
      {arrow && <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />}
    </>
  );
  // Contorno chanfrado: o "aro" e a camada de fora (1px) e o miolo repete o chanfro por dentro.
  const content =
    variant === "outline" ? (
      <span className={inner}>
        <span className={cn("nhf-chamfer-in inline-flex h-full w-full items-center justify-center gap-2 bg-background", pad)}>{label}</span>
      </span>
    ) : (
      <span className={inner}>{label}</span>
    );
  const cls = cn(base, variant === "primary" && "drop-shadow-[0_10px_16px_hsl(var(--brand)/0.32)] hover:drop-shadow-[0_16px_26px_hsl(var(--brand)/0.45)]", className);

  if (to) {
    return (
      <Link to={to} className={cls} onClick={onClick} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} onClick={onClick} aria-label={ariaLabel}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {content}
    </button>
  );
}
