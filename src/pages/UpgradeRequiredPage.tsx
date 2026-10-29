import { Lock, Crown, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function UpgradeRequiredPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto h-20 w-20 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Upgrade Necessário</h1>
        <p className="text-muted-foreground">
          Seu plano atual não inclui acesso a este módulo. Faça upgrade para desbloquear todas as funcionalidades.
        </p>
        <div className="flex items-center justify-center gap-1 text-primary font-semibold">
          <Crown className="h-5 w-5" />
          Entre em contato para fazer upgrade
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Button>
      </div>
    </div>
  );
}
