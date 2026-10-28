 import { useState } from "react";
 import { MapPin, ChevronDown, Check, X } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import {
   Popover,
   PopoverContent,
   PopoverTrigger,
 } from "@/components/ui/popover";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Checkbox } from "@/components/ui/checkbox";
 import { cn } from "@/lib/utils";
 import { LOGISTICS_REGIONS, getCategoryLabel, getRegionColor } from "@/lib/cepRegionMapping";
 
 interface RegionFilterProps {
   selectedRegions: string[];
   onRegionsChange: (regions: string[]) => void;
   availableRegions?: string[];
 }
 
 export function RegionFilter({ selectedRegions, onRegionsChange, availableRegions }: RegionFilterProps) {
   const [open, setOpen] = useState(false);
 
   // Agrupa regiões por categoria
   const groupedRegions = LOGISTICS_REGIONS.reduce((acc, region) => {
     if (!acc[region.category]) acc[region.category] = [];
     acc[region.category].push(region);
     return acc;
   }, {} as Record<string, typeof LOGISTICS_REGIONS>);
 
   const toggleRegion = (regionName: string) => {
     if (selectedRegions.includes(regionName)) {
       onRegionsChange(selectedRegions.filter(r => r !== regionName));
     } else {
       onRegionsChange([...selectedRegions, regionName]);
     }
   };
 
   const selectAllInCategory = (category: string) => {
     const categoryRegions = groupedRegions[category]?.map(r => r.name) || [];
     const newSelected = [...new Set([...selectedRegions, ...categoryRegions])];
     onRegionsChange(newSelected);
   };
 
   const clearCategory = (category: string) => {
     const categoryRegions = groupedRegions[category]?.map(r => r.name) || [];
     onRegionsChange(selectedRegions.filter(r => !categoryRegions.includes(r)));
   };
 
   const clearAll = () => {
     onRegionsChange([]);
   };
 
   const countByCategory = (category: string) => {
     const categoryRegions = groupedRegions[category]?.map(r => r.name) || [];
     return selectedRegions.filter(r => categoryRegions.includes(r)).length;
   };
 
   return (
     <Popover open={open} onOpenChange={setOpen}>
       <PopoverTrigger asChild>
         <Button variant="outline" className="gap-2">
           <MapPin className="h-4 w-4" />
           Regiões
           {selectedRegions.length > 0 && (
             <Badge variant="secondary" className="ml-1">
               {selectedRegions.length}
             </Badge>
           )}
           <ChevronDown className="h-4 w-4 opacity-50" />
         </Button>
       </PopoverTrigger>
       <PopoverContent className="w-80 p-0" align="start">
         <div className="flex items-center justify-between p-3 border-b">
           <span className="text-sm font-medium">Filtrar por Região</span>
           {selectedRegions.length > 0 && (
             <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
               Limpar tudo
               <X className="h-3 w-3 ml-1" />
             </Button>
           )}
         </div>
         
         <ScrollArea className="h-[400px]">
           <div className="p-2 space-y-4">
             {(['capital', 'gsp', 'litoral', 'interior', 'outra'] as const).map(category => {
               const regions = groupedRegions[category] || [];
               if (regions.length === 0) return null;
               
               const selectedCount = countByCategory(category);
               
               return (
                 <div key={category}>
                   <div className="flex items-center justify-between px-2 py-1.5">
                     <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                       {getCategoryLabel(category)}
                     </span>
                     <div className="flex gap-1">
                       {selectedCount > 0 && (
                         <Button 
                           variant="ghost" 
                           size="sm" 
                           className="h-6 text-xs px-2"
                           onClick={() => clearCategory(category)}
                         >
                           Limpar
                         </Button>
                       )}
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="h-6 text-xs px-2"
                         onClick={() => selectAllInCategory(category)}
                       >
                         Todos
                       </Button>
                     </div>
                   </div>
                   
                   <div className="space-y-1">
                     {regions.map(region => {
                       const isSelected = selectedRegions.includes(region.name);
                       const isAvailable = !availableRegions || availableRegions.includes(region.name);
                       
                       return (
                         <div
                           key={region.code}
                           className={cn(
                             "flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors",
                             isSelected ? "bg-primary/10" : "hover:bg-muted",
                             !isAvailable && "opacity-50"
                           )}
                           onClick={() => isAvailable && toggleRegion(region.name)}
                         >
                           <Checkbox 
                             checked={isSelected} 
                             disabled={!isAvailable}
                             className="pointer-events-none"
                           />
                           <div className={cn("w-2 h-2 rounded-full", getRegionColor(region.name))} />
                           <span className="text-sm flex-1">{region.name}</span>
                           {isSelected && <Check className="h-4 w-4 text-primary" />}
                         </div>
                       );
                     })}
                   </div>
                 </div>
               );
             })}
           </div>
         </ScrollArea>
       </PopoverContent>
     </Popover>
   );
 }