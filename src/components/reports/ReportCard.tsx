import { useId, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toneSoftBg, toneText, type Tone } from "@/components/patterns";
import { cn } from "@/lib/utils";

interface ReportCardProps {
  title: ReactNode;
  /** Uma frase do que o bloco mostra. */
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Nivel do titulo; padrao h2 (bloco direto da aba). */
  headingLevel?: 2 | 3;
}

/** Bloco de relatorio: cartao com titulo, explicacao de uma linha e acoes. */
export function ReportCard({
  title,
  description,
  icon: Icon,
  tone = "brand",
  actions,
  children,
  className,
  headingLevel = 2,
}: ReportCardProps) {
  const headingId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      <section aria-labelledby={headingId} className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span
                aria-hidden="true"
                className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneSoftBg[tone], toneText[tone])}
              >
                <Icon className="h-[1.125rem] w-[1.125rem]" />
              </span>
            )}
            <div className="min-w-0">
              <Heading id={headingId} className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {title}
              </Heading>
              {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </section>
    </Card>
  );
}

/**
 * Moldura de grafico com texto alternativo: leitor de tela ouve o resumo
 * (o desenho em si fica escondido dele).
 */
export function ChartFrame({ summary, height, children, className }: { summary: string; height: number; children: ReactNode; className?: string }) {
  return (
    <div
      role="img"
      aria-label={summary}
      // Legenda em cor de texto; a cor da serie fica so no marcador.
      className={cn("w-full min-w-0 [&_.recharts-legend-item-text]:!text-muted-foreground", className)}
      style={{ height }}
    >
      <div aria-hidden="true" className="h-full w-full">
        {children}
      </div>
    </div>
  );
}
