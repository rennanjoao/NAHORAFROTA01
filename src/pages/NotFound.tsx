import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Logo } from "@/components/brand/Logo";
import { Cta } from "@/site/components/Cta";

const NotFound = () => {
  const location = useLocation();
  useEffect(() => {
    document.title = "Página não encontrada — Na Hora Frota";
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <Link to="/" aria-label="Na Hora Frota — início"><Logo variant="linha" className="h-8 w-auto" /></Link>
      <p className="mt-10 font-data text-7xl font-bold text-brand">404</p>
      <h1 className="mt-3 font-heading text-2xl font-bold">Essa rota não existe.</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">O endereço pode ter mudado. Volte para o início ou entre no painel.</p>
      <div className="mt-8 flex gap-3">
        <Cta to="/" arrow>Ir para o início</Cta>
        <Cta to="/login" variant="outline">Entrar</Cta>
      </div>
    </div>
  );
};

export default NotFound;
