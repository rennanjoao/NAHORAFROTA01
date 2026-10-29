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
  const base = "group relative inline-flex shrink-0 select-none items-center justify-center font-heading font-semibold tracking-tight transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";
  const inner = cn(
    "nhf-chamfer inline-flex w-full items-center justify-center gap-2 transition-colors duration-200",
    size === "lg" ? "h-14 px-7 text-base" : "h-12 px-5 text-[15px]",
    variant === "primary" && "bg-primary text-primary-foreground group-hover:bg-nhf-green-dark",
    variant === "dark" && "bg-nhf-ink text-white group-hover:bg-nhf-graphite dark:bg-white dark:text-nhf-ink dark:group-hover:bg-nhf-mist",
    variant === "outline" && "border border-foreground/20 bg-transparent text-foreground group-hover:border-brand group-hover:text-brand",
    variant === "ghost" && "bg-transparent text-foreground group-hover:bg-accent",
  );
  const content = (
    <span className={inner}>
      {children}
      {arrow && <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />}
    </span>
  );
  const cls = cn(base, className);

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
