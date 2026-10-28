import { AppLayout } from "@/components/layout/AppLayout";
import { BrasilRiskMap } from "@/components/dashboard/BrasilRiskMap";

export default function RoutesPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Análise de Zonas de Risco</h1>
            <p className="text-muted-foreground">Monitoramento de segurança e inteligência de risco</p>
          </div>
        </div>

        {/* Risk Map */}
        <BrasilRiskMap />
      </div>
    </AppLayout>
  );
}
