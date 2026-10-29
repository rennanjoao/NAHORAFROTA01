import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Building2, Download, Loader2, Target, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/** Secoes que entram no PDF. */
export interface ExportOptions {
  tabs: {
    desempenho: boolean;
    financeiro: boolean;
    operacional: boolean;
    clientes: boolean;
  };
}

type SectionId = keyof ExportOptions["tabs"];

interface ExportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: ExportOptions) => Promise<void>;
  isExporting: boolean;
  dateRange: { from: Date | undefined; to: Date | undefined };
  /** Filtros da tela em texto ("Cliente: X · Motorista: Y"), ou vazio. */
  filtersLabel?: string;
}

// Cada secao diz o que vai no arquivo (antes havia opcoes de "graficos",
// "curva ABC" e outras que nao mudavam nada no PDF).
const SECTIONS: { id: SectionId; label: string; description: string; icon: typeof Target }[] = [
  {
    id: "desempenho",
    label: "Desempenho",
    description: "SLA, notas entregues, atrasadas e devolvidas, e o custo médio por entrega.",
    icon: Target,
  },
  {
    id: "operacional",
    label: "Ocorrências",
    description: "Regiões com mais atrasos e os motivos de ocorrência.",
    icon: AlertTriangle,
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Romaneios, frete pago aos agregados e valor das mercadorias.",
    icon: Wallet,
  },
  {
    id: "clientes",
    label: "Clientes",
    description: "Clientes com maior valor em notas e os que mais devolveram.",
    icon: Building2,
  },
];

const ALL_ON: ExportOptions["tabs"] = { desempenho: true, financeiro: true, operacional: true, clientes: true };

export function ExportReportDialog({
  open,
  onOpenChange,
  onExport,
  isExporting,
  dateRange,
  filtersLabel,
}: ExportReportDialogProps) {
  const [tabs, setTabs] = useState<ExportOptions["tabs"]>(ALL_ON);

  const selectedCount = Object.values(tabs).filter(Boolean).length;
  const allSelected = selectedCount === SECTIONS.length;

  const handleExport = async () => {
    await onExport({ tabs });
    onOpenChange(false);
  };

  const periodText =
    dateRange.from || dateRange.to
      ? `${dateRange.from ? dateRange.from.toLocaleDateString("pt-BR") : "início"} a ${
          dateRange.to ? dateRange.to.toLocaleDateString("pt-BR") : "hoje"
        }`
      : "todo o histórico";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Exportar relatório em PDF</DialogTitle>
          <DialogDescription>
            Escolha o que entra no arquivo. Ele sai com o período e os filtros que estão na tela.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-1 rounded-lg border bg-muted/40 px-4 py-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
          <dt className="text-muted-foreground">Período</dt>
          <dd className="font-data text-foreground">{periodText}</dd>
          <dt className="text-muted-foreground">Filtros</dt>
          <dd className="text-foreground">{filtersLabel || "Nenhum"}</dd>
        </dl>

        <fieldset className="space-y-3">
          <legend className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 text-sm font-semibold">
            O que entra no arquivo
            <span className="flex items-center gap-2">
              <Badge variant="secondary" className="font-data">
                {selectedCount} de {SECTIONS.length}
              </Badge>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="-mr-2 px-2"
                onClick={() =>
                  setTabs(allSelected ? { desempenho: false, financeiro: false, operacional: false, clientes: false } : ALL_ON)
                }
              >
                {allSelected ? "Desmarcar todas" : "Marcar todas"}
              </Button>
            </span>
          </legend>

          <div className="grid gap-2 sm:grid-cols-2">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const checked = tabs[section.id];
              const id = `export-${section.id}`;
              return (
                <div
                  key={section.id}
                  className={cn(
                    "relative flex items-start gap-3 rounded-lg border p-3 transition-colors duration-fast hover:bg-accent",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                    checked && "border-primary/50 bg-primary/5",
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(value) => setTabs((prev) => ({ ...prev, [section.id]: value === true }))}
                    aria-describedby={`${id}-dica`}
                    className="relative z-[1] mt-0.5 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <div className="min-w-0">
                    {/* O rotulo cobre o cartao inteiro: clicar em qualquer ponto marca a secao. */}
                    <Label
                      htmlFor={id}
                      className="flex cursor-pointer items-center gap-2 font-medium after:absolute after:inset-0 after:rounded-lg"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {section.label}
                    </Label>
                    <p id={`${id}-dica`} className="mt-1 text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedCount === 0 && (
            <p className="text-xs font-medium text-destructive" role="status">
              Marque ao menos uma seção para exportar.
            </p>
          )}
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isExporting || selectedCount === 0}>
            {isExporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            {isExporting ? "Gerando PDF" : "Exportar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
