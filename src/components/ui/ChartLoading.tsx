import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  minHeight?: string;
}

export function ChartLoading({ isLoading, children, className, minHeight = "200px" }: ChartLoadingProps) {
  return (
    <div className={cn("relative", className)} style={{ minHeight }}>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Atualizando dados...</span>
          </div>
        </div>
      )}
      
      {/* Chart Content */}
      <div className={cn("transition-opacity duration-300", isLoading && "opacity-30")}>
        {children}
      </div>
    </div>
  );
}
