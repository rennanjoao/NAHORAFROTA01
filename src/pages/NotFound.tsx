import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="absolute inset-0 nhf-routes pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <BrandLogo arrangement="horizontal" className="w-[180px]" />
        <span className="nhf-live nhf-live--off">Erro 404</span>
        <h1 className="text-3xl font-bold text-foreground leading-tight">
          Esta página <span className="text-primary">saiu da rota.</span>
        </h1>
        <p className="text-muted-foreground">
          O endereço <span className="font-data text-foreground">{location.pathname}</span> não existe ou foi movido.
        </p>
        <Button asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar para o início
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
