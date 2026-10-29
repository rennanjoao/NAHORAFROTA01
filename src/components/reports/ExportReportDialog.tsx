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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Download,
  Loader2,
  Target,
  Wallet,
  Settings2,
  Building2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Export options structure
export interface ExportOptions {
  mode: "current" | "all" | "custom";
  tabs: {
    desempenho: boolean;
    financeiro: boolean;
    operacional: boolean;
    clientes: boolean;
  };
  details: {
    // Desempenho
    slaEvolution: boolean;
    slaMetrics: boolean;
    deliveryStatus: boolean;
    // Financeiro
    freightCosts: boolean;
    volumeData: boolean;
    costPerDelivery: boolean;
    // Operacional
    totalOccurrences: boolean;
    returnReasons: boolean;
    returnRate: boolean;
    // Clientes
    topBuyers: boolean;
    abcCurve: boolean;
    clientTrends: boolean;
  };
  includeCharts: boolean;
  includeTables: boolean;
  includeSummary: boolean;
}

interface ExportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTab: string;
  onExport: (options: ExportOptions) => Promise<void>;
  isExporting: boolean;
  dateRange: { from: Date | undefined; to: Date | undefined };
}

const tabConfig = [
  { 
    id: "desempenho", 
    label: "Desempenho", 
    icon: Target,
    details: [
      { id: "slaEvolution", label: "Evolução do SLA (gráfico)" },
      { id: "slaMetrics", label: "Números do SLA (resumo)" },
      { id: "deliveryStatus", label: "Situação das entregas (gráfico)" },
    ]
  },
  { 
    id: "financeiro", 
    label: "Financeiro", 
    icon: Wallet,
    details: [
      { id: "freightCosts", label: "Custo de frete por mês" },
      { id: "volumeData", label: "Entregas por mês" },
      { id: "costPerDelivery", label: "Custo médio por entrega" },
    ]
  },
  { 
    id: "operacional", 
    label: "Operacional", 
    icon: Settings2,
    details: [
      { id: "totalOccurrences", label: "Total de ocorrências" },
      { id: "returnReasons", label: "5 principais motivos de devolução" },
      { id: "returnRate", label: "Taxa de devolução" },
    ]
  },
  { 
    id: "clientes", 
    label: "Clientes", 
    icon: Building2,
    details: [
      { id: "topBuyers", label: "Principais clientes" },
      { id: "abcCurve", label: "Curva ABC de clientes" },
      { id: "clientTrends", label: "Tendência por cliente" },
    ]
  },
];

export function ExportReportDialog({
  open,
  onOpenChange,
  currentTab,
  onExport,
  isExporting,
  dateRange,
}: ExportReportDialogProps) {
  const [expandedTabs, setExpandedTabs] = useState<string[]>([currentTab]);
  
  const [options, setOptions] = useState<ExportOptions>({
    mode: "current",
    tabs: {
      desempenho: currentTab === "desempenho",
      financeiro: currentTab === "financeiro",
      operacional: currentTab === "operacional",
      clientes: currentTab === "clientes",
    },
    details: {
      slaEvolution: true,
      slaMetrics: true,
      deliveryStatus: true,
      freightCosts: true,
      volumeData: true,
      costPerDelivery: true,
      totalOccurrences: true,
      returnReasons: true,
      returnRate: true,
      topBuyers: true,
      abcCurve: true,
      clientTrends: true,
    },
    includeCharts: true,
    includeTables: true,
    includeSummary: true,
  });

  const handleModeChange = (mode: "current" | "all" | "custom") => {
    setOptions(prev => ({
      ...prev,
      mode,
      tabs: {
        desempenho: mode === "all" || (mode === "current" && currentTab === "desempenho"),
        financeiro: mode === "all" || (mode === "current" && currentTab === "financeiro"),
        operacional: mode === "all" || (mode === "current" && currentTab === "operacional"),
        clientes: mode === "all" || (mode === "current" && currentTab === "clientes"),
      },
    }));
  };

  const toggleTab = (tabId: string) => {
    if (options.mode !== "custom") return;
    setOptions(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        [tabId]: !prev.tabs[tabId as keyof typeof prev.tabs],
      },
    }));
  };

  const toggleDetail = (detailId: string) => {
    setOptions(prev => ({
      ...prev,
      details: {
        ...prev.details,
        [detailId]: !prev.details[detailId as keyof typeof prev.details],
      },
    }));
  };

  const toggleExpandTab = (tabId: string) => {
    setExpandedTabs(prev => 
      prev.includes(tabId) 
        ? prev.filter(t => t !== tabId)
        : [...prev, tabId]
    );
  };

  const selectedTabsCount = Object.values(options.tabs).filter(Boolean).length;
  const selectedDetailsCount = Object.values(options.details).filter(Boolean).length;

  const handleExport = async () => {
    await onExport(options);
    onOpenChange(false);
  };

  const modes = [
    { value: "current", label: "Só esta aba", hint: tabConfig.find((t) => t.id === currentTab)?.label ?? "" },
    { value: "all", label: "Completo", hint: "As 4 seções" },
    { value: "custom", label: "Escolher", hint: "Você marca as seções" },
  ] as const;

  const extras = [
    { id: "includeCharts", label: "Gráficos" },
    { id: "includeTables", label: "Tabelas" },
    { id: "includeSummary", label: "Resumo executivo" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar relatório em PDF</DialogTitle>
          <DialogDescription>
            Escolha o que entra no arquivo. Ele sai com os filtros que estão na tela.
            {dateRange.from && dateRange.to && (
              <span className="mt-1 block font-data text-xs">
                Período: {dateRange.from.toLocaleDateString("pt-BR")} a {dateRange.to.toLocaleDateString("pt-BR")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* O que exportar */}
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-semibold">O que exportar</legend>
            <RadioGroup
              value={options.mode}
              onValueChange={(v) => handleModeChange(v as "current" | "all" | "custom")}
              className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3"
            >
              {modes.map((mode) => (
                <Label
                  key={mode.value}
                  htmlFor={`export-${mode.value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-fast hover:bg-accent",
                    options.mode === mode.value && "border-primary/50 bg-primary/5",
                  )}
                >
                  <RadioGroupItem value={mode.value} id={`export-${mode.value}`} className="mt-0.5" />
                  <span>
                    <span className="block font-medium">{mode.label}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{mode.hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          {/* Secoes */}
          <fieldset className="space-y-3">
            <legend className="flex w-full items-center justify-between gap-3 text-sm font-semibold">
              Seções do relatório
              <Badge variant="secondary" className="font-data">
                {selectedTabsCount} seç{selectedTabsCount === 1 ? "ão" : "ões"} · {selectedDetailsCount} itens
              </Badge>
            </legend>

            <div className="space-y-2">
              {tabConfig.map((tab) => {
                const TabIcon = tab.icon;
                const isTabSelected = options.tabs[tab.id as keyof typeof options.tabs];
                const isExpanded = expandedTabs.includes(tab.id);
                const detailsId = `export-details-${tab.id}`;

                return (
                  <div
                    key={tab.id}
                    className={cn(
                      "overflow-hidden rounded-lg border transition-colors duration-fast",
                      isTabSelected ? "border-primary/40 bg-primary/5" : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 py-1 pl-3 pr-1">
                      <div className="flex min-h-[2.5rem] items-center gap-3">
                        <Checkbox
                          id={`tab-${tab.id}`}
                          checked={isTabSelected}
                          onCheckedChange={() => toggleTab(tab.id)}
                          disabled={options.mode !== "custom"}
                        />
                        <Label
                          htmlFor={`tab-${tab.id}`}
                          className={cn("flex cursor-pointer items-center gap-2", !isTabSelected && "text-muted-foreground")}
                        >
                          <TabIcon className="h-4 w-4" aria-hidden="true" />
                          {tab.label}
                        </Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleExpandTab(tab.id)}
                        disabled={!isTabSelected}
                        aria-expanded={isExpanded && isTabSelected}
                        aria-controls={detailsId}
                        aria-label={`${isExpanded ? "Esconder" : "Mostrar"} itens de ${tab.label}`}
                      >
                        <ChevronDown
                          className={cn("transition-transform duration ease-out", isExpanded && isTabSelected && "rotate-180")}
                          aria-hidden="true"
                        />
                      </Button>
                    </div>

                    {isExpanded && isTabSelected && (
                      <div id={detailsId} className="space-y-2 border-t bg-card/60 px-3 py-3 pl-10 animate-fade-in">
                        {tab.details.map((detail) => (
                          <div key={detail.id} className="flex min-h-[2rem] items-center gap-2">
                            <Checkbox
                              id={`detail-${detail.id}`}
                              checked={options.details[detail.id as keyof typeof options.details]}
                              onCheckedChange={() => toggleDetail(detail.id)}
                            />
                            <Label htmlFor={`detail-${detail.id}`} className="cursor-pointer text-sm font-normal">
                              {detail.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          {/* Extras */}
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">Incluir também</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {extras.map((extra) => (
                <div key={extra.id} className="flex min-h-[2rem] items-center gap-2">
                  <Checkbox
                    id={extra.id}
                    checked={options[extra.id]}
                    onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, [extra.id]: !!checked }))}
                  />
                  <Label htmlFor={extra.id} className="cursor-pointer text-sm font-normal">
                    {extra.label}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isExporting || selectedTabsCount === 0}>
            {isExporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            {isExporting ? "Gerando PDF" : "Exportar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
