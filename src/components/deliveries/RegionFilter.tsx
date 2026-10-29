import { useId, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LOGISTICS_REGIONS, getCategoryLabel, getRegionColor } from "@/lib/cepRegionMapping";

interface RegionFilterProps {
  selectedRegions: string[];
  onRegionsChange: (regions: string[]) => void;
  availableRegions?: string[];
  className?: string;
}

const CATEGORIES = ["capital", "gsp", "litoral", "interior", "outra"] as const;

/** Filtro por regiao de entrega (agrupado: capital, Grande SP, litoral, interior). */
export function RegionFilter({ selectedRegions, onRegionsChange, availableRegions, className }: RegionFilterProps) {
  const [open, setOpen] = useState(false);
  const baseId = useId();

  // Agrupa regioes por categoria
  const groupedRegions = LOGISTICS_REGIONS.reduce((acc, region) => {
    if (!acc[region.category]) acc[region.category] = [];
    acc[region.category].push(region);
    return acc;
  }, {} as Record<string, typeof LOGISTICS_REGIONS>);

  const toggleRegion = (regionName: string) => {
    if (selectedRegions.includes(regionName)) {
      onRegionsChange(selectedRegions.filter((r) => r !== regionName));
    } else {
      onRegionsChange([...selectedRegions, regionName]);
    }
  };

  const categoryNames = (category: string) => groupedRegions[category]?.map((r) => r.name) || [];

  const selectAllInCategory = (category: string) => {
    onRegionsChange([...new Set([...selectedRegions, ...categoryNames(category)])]);
  };

  const clearCategory = (category: string) => {
    const names = categoryNames(category);
    onRegionsChange(selectedRegions.filter((r) => !names.includes(r)));
  };

  const countByCategory = (category: string) => {
    const names = categoryNames(category);
    return selectedRegions.filter((r) => names.includes(r)).length;
  };

  const count = selectedRegions.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? "soft" : "outline"}
          className={cn("justify-between gap-2", className)}
          aria-label={count > 0 ? `Regiões: ${count} selecionada(s)` : "Filtrar por região"}
        >
          <span className="flex items-center gap-2">
            <MapPin aria-hidden="true" />
            Regiões
            {count > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {count}
              </span>
            )}
          </span>
          <ChevronDown className="opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Filtrar por região" className="w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Filtrar por região</p>
            <p className="text-xs text-muted-foreground">Mostra só as notas das regiões marcadas.</p>
          </div>
          {count > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onRegionsChange([])}>
              Limpar
            </Button>
          )}
        </div>

        {/* Altura cabe na tela que sobra (antes o botao "Ver resultado" saia pela borda de baixo). */}
        <ScrollArea className="h-[min(24rem,60vh,calc(var(--radix-popover-content-available-height,100vh)-8.5rem))] min-h-[8rem]">
          <div className="space-y-4 p-2">
            {CATEGORIES.map((category) => {
              const regions = groupedRegions[category] || [];
              if (regions.length === 0) return null;
              const selectedInCategory = countByCategory(category);
              const headingId = `${baseId}-${category}`;

              return (
                <div key={category} role="group" aria-labelledby={headingId}>
                  <div className="flex items-center justify-between px-2 py-1">
                    <span id={headingId} className="text-xs font-semibold text-muted-foreground">
                      {getCategoryLabel(category)}
                    </span>
                    <div className="flex gap-1">
                      {selectedInCategory > 0 && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => clearCategory(category)}>
                          Limpar
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => selectAllInCategory(category)}>
                        Marcar todas
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    {regions.map((region) => {
                      const isSelected = selectedRegions.includes(region.name);
                      const isAvailable = !availableRegions || availableRegions.includes(region.name);
                      const id = `${baseId}-${region.code}`;

                      return (
                        <label
                          key={region.code}
                          htmlFor={id}
                          className={cn(
                            "flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors duration-fast",
                            isSelected ? "bg-primary/10" : "hover:bg-accent",
                            !isAvailable && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <Checkbox
                            id={id}
                            checked={isSelected}
                            disabled={!isAvailable}
                            onCheckedChange={() => toggleRegion(region.name)}
                          />
                          <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", getRegionColor(region.name))} />
                          <span className="flex-1 text-sm text-foreground">{region.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="border-t p-2">
          <Button className="w-full" onClick={() => setOpen(false)}>
            Ver resultado
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
