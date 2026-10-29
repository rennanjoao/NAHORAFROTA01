import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <AuthLayout variant="centered" width="md">
      <div className="space-y-6">
        <span className="nhf-live nhf-live--off">Erro 404</span>
        <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
          Esta página <span className="text-primary">saiu da rota.</span>
        </h1>
        <p className="text-[0.9375rem] text-muted-foreground">
          O endereço{" "}
          <span className="break-all font-data text-foreground">
            {location.pathname}
          </span>{" "}
          não existe ou mudou de lugar. Confira o link ou volte para o início.
        </p>
        <Button asChild size="lg">
          <Link to="/">
            <ArrowLeft aria-hidden="true" />
            Voltar para o início
          </Link>
        </Button>
      </div>
    </AuthLayout>
  );
};

export default NotFound;
