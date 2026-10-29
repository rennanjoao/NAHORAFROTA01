import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = "Nenhuma entrega ainda",
  description = "Comece importando seus pedidos ou solicitando um veículo.",
  actionLabel = "Iniciar uma rota",
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {/* Friendly illustration */}
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted border border-border">
          <Package className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Plus className="h-4 w-4" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>

      {onAction && (
        <Button onClick={onAction} className="mt-6" size="lg">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
