import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";

interface CyberLogoProps {
  collapsed?: boolean;
  className?: string;
}

/** Logo da barra lateral (nome mantido por compatibilidade). A barra lateral é sempre escura. */
export function CyberLogo({ collapsed = false, className }: CyberLogoProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {collapsed ? <Logo variant="simbolo" className="h-7 w-auto" /> : <Logo variant="horizontal" tone="light" className="h-12 w-auto" />}
    </div>
  );
}
