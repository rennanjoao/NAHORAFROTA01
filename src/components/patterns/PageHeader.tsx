import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  /** Uma frase simples do que a tela faz. */
  description?: ReactNode;
  icon?: LucideIcon;
  /** Botoes da tela. O principal vai por ultimo (fica a direita / em cima no celular). */
  actions?: ReactNode;
  /** Conteudo abaixo do titulo (abas, filtros de periodo). */
  children?: ReactNode;
  className?: string;
}

/** Cabecalho padrao de toda tela: titulo (h1), descricao e acoes. */
export function PageHeader({ title, description, icon: Icon, actions, children, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 space-y-4 md:mb-8", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          {Icon && (
            <span
              aria-hidden="true"
              className="mt-0.5 hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-brand-soft text-primary shadow-xs sm:flex"
            >
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground md:text-[2rem]">{title}</h1>
            {description && <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground md:text-[0.9375rem]">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 [&>*]:max-sm:flex-1">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
