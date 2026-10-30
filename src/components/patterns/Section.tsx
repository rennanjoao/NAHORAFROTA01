import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** Bloco de conteudo com titulo (h2). Use para separar assuntos dentro da tela. */
export function Section({ title, description, actions, children, className, id }: SectionProps) {
  const headingId = id ? `${id}-titulo` : undefined;
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn("space-y-4", className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground before:h-5 before:w-1 before:shrink-0 before:rounded-full before:bg-gradient-to-b before:from-brand before:to-info before:content-['']">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
