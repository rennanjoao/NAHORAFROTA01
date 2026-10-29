import { MapPinOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GPSEnforcerProps {
  error: string;
  onRetry: () => void;
}

export function GPSEnforcer({ error, onRetry }: GPSEnforcerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-destructive flex flex-col items-center justify-center p-8 text-destructive-foreground">
      <div className="animate-pulse mb-6">
        <MapPinOff className="h-24 w-24" />
      </div>
      
      <h1 className="text-3xl font-bold text-center mb-4 font-heading">
        Localização necessária
      </h1>
      
      <p className="text-xl text-center mb-2 opacity-90">
        Por favor, ative a localização
      </p>
      
      <p className="text-sm text-center mb-8 opacity-75 max-w-xs">
        {error}
      </p>
      
      <Button
        onClick={onRetry}
        size="lg"
        variant="secondary"
        className="gap-2 text-lg h-14 px-8"
      >
        <RefreshCw className="h-5 w-5" />
        Tentar Novamente
      </Button>
      
      <div className="mt-8 text-center">
        <p className="text-sm opacity-75">
          Verifique se a localização está ativada
        </p>
        <p className="text-sm opacity-75">
          nas configurações do seu dispositivo
        </p>
      </div>
    </div>
  );
}
