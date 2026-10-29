import { useEffect, useRef, type ReactNode } from "react";

interface ScreenHeaderProps {
  /** Linha pequena acima do titulo (ex.: "Romaneio #12 · 28/10"). */
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

/**
 * Titulo (h1) de cada aba do app do motorista. Ao trocar de aba o foco vem
 * para ca, e o leitor de tela anuncia a tela nova.
 */
export function ScreenHeader({ eyebrow, title, description, actions }: ScreenHeaderProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // So move o foco se ele estava num controle (troca de aba), nao ao abrir o app.
    if (document.activeElement && document.activeElement !== document.body) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-sm font-medium text-muted-foreground">{eyebrow}</p>}
        <h1 ref={headingRef} tabIndex={-1} className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground outline-none">
          {title}
        </h1>
        {description && <p className="mt-1 text-[0.9375rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
