import { cn } from "@/lib/utils";
import nahoraFrotaLogo from "@/assets/nahora-frota-logo.png";

interface CyberLogoProps {
  collapsed?: boolean;
  className?: string;
}

export function CyberLogo({ collapsed = false, className }: CyberLogoProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <img
        src={nahoraFrotaLogo}
        alt="NAHORA FROTA"
        className={cn(
          "transition-all duration-300 object-contain",
          collapsed ? "w-12 h-12" : "w-44 h-auto"
        )}
      />
      {!collapsed && (
        <span 
          className="text-[10px] tracking-[0.2em] uppercase font-medium"
          style={{
            fontFamily: "'Lato', sans-serif",
            color: "rgba(255, 255, 255, 0.6)",
            letterSpacing: "0.15em",
          }}
        >
          Gestão Inteligente
        </span>
      )}
    </div>
  );
}
