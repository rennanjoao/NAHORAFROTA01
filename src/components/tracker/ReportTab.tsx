import { ChevronRight, History, Info } from "lucide-react";
import { toneSoftBg, toneText } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DRIVER_OCCURRENCE_TYPES } from "./occurrenceTypes";
import { ScreenHeader } from "./ScreenHeader";

interface ReportTabProps {
  /** Abre o formulario ja com o tipo escolhido. */
  onReport: (type: string) => void;
  onShowHistory: () => void;
  onGoHome: () => void;
}

/** Aba Reportar: blocos grandes, um toque para cada tipo de problema. */
export function ReportTab({ onReport, onShowHistory, onGoHome }: ReportTabProps) {
  return (
    <>
      <ScreenHeader title="Reportar problema" description="Toque no que aconteceu. A base é avisada na hora." />

      <div className="space-y-6">
        <ul className="stagger grid grid-cols-2 gap-3">
          {DRIVER_OCCURRENCE_TYPES.map((option) => {
            const Icon = option.icon;
            return (
              <li key={option.value} className="flex">
                <button
                  type="button"
                  onClick={() => onReport(option.value)}
                  className={cn(
                    "card-interactive flex w-full min-h-[9rem] flex-col items-start justify-between gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("flex h-12 w-12 items-center justify-center rounded-xl", toneSoftBg[option.tone], toneText[option.tone])}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block font-heading text-base font-semibold leading-tight text-foreground">{option.label}</span>
                    {option.hint && <span className="mt-1 block text-[0.8125rem] leading-snug text-muted-foreground">{option.hint}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <section aria-labelledby="problema-entrega-titulo" className="flex gap-3 rounded-xl border border-info/30 bg-info/5 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden="true" />
          <div className="min-w-0 space-y-3">
            <div>
              <h2 id="problema-entrega-titulo" className="text-[0.9375rem] font-semibold text-foreground">
                O problema é com uma entrega?
              </h2>
              <p className="text-sm text-muted-foreground">
                Cliente ausente, endereço errado ou mercadoria avariada: use "Reportar problema" no cartão da entrega.
              </p>
            </div>
            <Button variant="outline" onClick={onGoHome} className="h-12">
              Ver minhas entregas
            </Button>
          </div>
        </section>

        <button
          type="button"
          onClick={onShowHistory}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left shadow-xs transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <History className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold text-foreground">Ver o que já reportei</span>
            <span className="block text-sm text-muted-foreground">Problemas enviados por você, com foto e local</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
