import { useId, type FormEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** h2 quando o cartao e o bloco principal da aba; h3 dentro de uma secao. */
  headingLevel?: 2 | 3;
  /** Acoes no canto do titulo (ex.: link para outra tela). */
  actions?: ReactNode;
  /** Botoes do rodape. O principal vai por ultimo (fica a direita). */
  footer?: ReactNode;
  /** Frase curta a esquerda do rodape (ex.: "Vale para todos os aparelhos."). */
  footerHint?: ReactNode;
  /** Com onSubmit o cartao vira um <form> (Enter envia). */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
}

/**
 * Cartao de configuracao: titulo, uma frase do que faz, conteudo e um rodape com
 * a acao principal no canto direito (padrao das telas de configuracao).
 */
export function SettingsCard({
  title,
  description,
  icon: Icon,
  headingLevel = 2,
  actions,
  footer,
  footerHint,
  onSubmit,
  className,
  contentClassName,
  children,
}: SettingsCardProps) {
  const headingId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const Root = onSubmit ? "form" : "section";

  return (
    <Root
      aria-labelledby={headingId}
      onSubmit={onSubmit}
      noValidate={onSubmit ? true : undefined}
      className={cn("overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm", className)}
    >
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <Icon className="h-[1.125rem] w-[1.125rem]" />
            </span>
          )}
          <div className="min-w-0">
            <Heading id={headingId} className="text-base font-semibold leading-snug tracking-tight text-foreground">
              {title}
            </Heading>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {children && <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", contentClassName)}>{children}</div>}

      {(footer || footerHint) && (
        <div className="flex flex-col gap-3 border-t bg-muted/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {footerHint ? <p className="text-xs leading-relaxed text-muted-foreground">{footerHint}</p> : <span />}
          {footer && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end [&>*]:max-sm:w-full">
              {footer}
            </div>
          )}
        </div>
      )}
    </Root>
  );
}

interface SettingsRowProps {
  /** id do controle (para o rotulo). Sem ele, use labelId no grupo do controle. */
  htmlFor?: string;
  labelId?: string;
  hintId?: string;
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  /** Controle pequeno (ex.: Switch): fica a direita tambem no celular. */
  inline?: boolean;
  className?: string;
}

/** Linha "rotulo e dica a esquerda, controle a direita". No celular empilha. */
export function SettingsRow({ htmlFor, labelId, hintId, label, hint, children, inline, className }: SettingsRowProps) {
  const labelClass = "block text-sm font-medium leading-tight text-foreground";
  return (
    <div
      className={cn(
        "flex gap-3 py-5 first:pt-0 last:pb-0 sm:gap-8",
        inline ? "flex-row items-center justify-between gap-4" : "flex-col sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 sm:max-w-md">
        {htmlFor ? (
          <label id={labelId} htmlFor={htmlFor} className={cn(labelClass, "cursor-pointer")}>
            {label}
          </label>
        ) : (
          <p id={labelId} className={labelClass}>
            {label}
          </p>
        )}
        {hint && (
          <p id={hintId} className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}
