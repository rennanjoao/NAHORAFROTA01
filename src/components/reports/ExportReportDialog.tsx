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
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Download,
  Loader2,
  FileText,
  Target,
  DollarSign,
  Settings2,
  Building2,
  ChevronDown,
  ChevronRight,
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
      { id: "slaEvolution", label: "Evolução do SLA (Gráfico)" },
      { id: "slaMetrics", label: "Métricas de SLA (Resumo)" },
      { id: "deliveryStatus", label: "Status das Entregas (Gráfico)" },
    ]
  },
  { 
    id: "financeiro", 
    label: "Financeiro", 
    icon: DollarSign,
    details: [
      { id: "freightCosts", label: "Custos de Frete por Mês" },
      { id: "volumeData", label: "Volume de Entregas por Mês" },
      { id: "costPerDelivery", label: "Custo Médio por Entrega" },
    ]
  },
  { 
    id: "operacional", 
    label: "Operacional", 
    icon: Settings2,
    details: [
      { id: "totalOccurrences", label: "Total de Ocorrências" },
      { id: "returnReasons", label: "Top 5 Motivos de Devolução" },
      { id: "returnRate", label: "Taxa de Devolução Geral" },
    ]
  },
  { 
    id: "clientes", 
    label: "Clientes", 
    icon: Building2,
    details: [
      { id: "topBuyers", label: "Top Compradores" },
      { id: "abcCurve", label: "Curva ABC de Clientes" },
      { id: "clientTrends", label: "Tendências por Cliente" },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Exportar Relatório em PDF
          </DialogTitle>
          <DialogDescription>
            Configure quais dados deseja incluir no relatório exportado.
            {dateRange.from && dateRange.to && (
              <span className="block mt-1 text-xs">
                Período: {dateRange.from.toLocaleDateString("pt-BR")} - {dateRange.to.toLocaleDateString("pt-BR")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Mode Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Modo de Exportação</Label>
            <RadioGroup
              value={options.mode}
              onValueChange={(v) => handleModeChange(v as "current" | "all" | "custom")}
              className="grid grid-cols-3 gap-3"
            >
              <div className={cn(
                "flex items-center space-x-2 border rounded-lg p-3 cursor-pointer transition-colors",
                options.mode === "current" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
              )}>
                <RadioGroupItem value="current" id="current" />
                <Label htmlFor="current" className="cursor-pointer flex-1">
                  <span className="font-medium">Aba Atual</span>
                  <span className="block text-xs text-muted-foreground">
                    Somente {tabConfig.find(t => t.id === currentTab)?.label}
                  </span>
                </Label>
              </div>
              <div className={cn(
                "flex items-center space-x-2 border rounded-lg p-3 cursor-pointer transition-colors",
                options.mode === "all" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
              )}>
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="cursor-pointer flex-1">
                  <span className="font-medium">Consolidado</span>
                  <span className="block text-xs text-muted-foreground">Todas as 4 abas</span>
                </Label>
              </div>
              <div className={cn(
                "flex items-center space-x-2 border rounded-lg p-3 cursor-pointer transition-colors",
                options.mode === "custom" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
              )}>
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="cursor-pointer flex-1">
                  <span className="font-medium">Personalizado</span>
                  <span className="block text-xs text-muted-foreground">Escolher abas</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Tab Selection with Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Conteúdo do Relatório</Label>
              <Badge variant="outline">
                {selectedTabsCount} aba(s) • {selectedDetailsCount} itens
              </Badge>
            </div>

            <div className="space-y-2">
              {tabConfig.map((tab) => {
                const TabIcon = tab.icon;
                const isTabSelected = options.tabs[tab.id as keyof typeof options.tabs];
                const isExpanded = expandedTabs.includes(tab.id);
                const tabDetails = tab.details;

                return (
                  <div 
                    key={tab.id} 
                    className={cn(
                      "border rounded-lg overflow-hidden transition-colors",
                      isTabSelected ? "border-primary/50 bg-primary/5" : "border-border"
                    )}
                  >
                    {/* Tab Header */}
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`tab-${tab.id}`}
                          checked={isTabSelected}
                          onCheckedChange={() => toggleTab(tab.id)}
                          disabled={options.mode !== "custom"}
                        />
                        <Label 
                          htmlFor={`tab-${tab.id}`} 
                          className={cn(
                            "flex items-center gap-2 cursor-pointer",
                            !isTabSelected && "opacity-60"
                          )}
                        >
                          <TabIcon className="h-4 w-4" />
                          {tab.label}
                        </Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpandTab(tab.id)}
                        disabled={!isTabSelected}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Tab Details */}
                    {isExpanded && isTabSelected && (
                      <div className="px-3 pb-3 pt-1 border-t border-border/50 bg-background/50">
                        <div className="space-y-2 ml-7">
                          {tabDetails.map((detail) => (
                            <div key={detail.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`detail-${detail.id}`}
                                checked={options.details[detail.id as keyof typeof options.details]}
                                onCheckedChange={() => toggleDetail(detail.id)}
                              />
                              <Label 
                                htmlFor={`detail-${detail.id}`} 
                                className="text-sm cursor-pointer"
                              >
                                {detail.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Additional Options */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Opções Adicionais</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeCharts"
                  checked={options.includeCharts}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeCharts: !!checked }))
                  }
                />
                <Label htmlFor="includeCharts" className="text-sm cursor-pointer">
                  Incluir Gráficos
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeTables"
                  checked={options.includeTables}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeTables: !!checked }))
                  }
                />
                <Label htmlFor="includeTables" className="text-sm cursor-pointer">
                  Incluir Tabelas
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeSummary"
                  checked={options.includeSummary}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeSummary: !!checked }))
                  }
                />
                <Label htmlFor="includeSummary" className="text-sm cursor-pointer">
                  Resumo Executivo
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={isExporting || selectedTabsCount === 0}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Exportar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
