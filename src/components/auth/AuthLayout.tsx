import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MapPinned, Route, Smartphone, type LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

export interface AuthPoint {
  icon: LucideIcon;
  title: string;
  text: string;
}

const DEFAULT_POINTS: AuthPoint[] = [
  { icon: MapPinned, title: "Frota no mapa, ao vivo", text: "Veja onde cada veículo está e quanto falta para cada entrega." },
  { icon: Route, title: "Rotas em minutos", text: "Importe as notas fiscais e monte o romaneio sem planilha." },
  { icon: Smartphone, title: "App simples para o motorista", text: "Ele finaliza a entrega no celular, com foto e nome de quem recebeu." },
];

interface AuthLayoutProps {
  children: ReactNode;
  /** "split": painel da marca ao lado (login, cadastro). "centered": so o conteudo. */
  variant?: "split" | "centered";
  headline?: ReactNode;
  points?: AuthPoint[];
  /** Selo acima do titulo do painel (ex.: teste gratis). */
  badge?: ReactNode;
  /** Largura do conteudo. */
  width?: "sm" | "md";
}

/** Ilustracao do painel: um romaneio andando (decorativa). */
function LivePreview() {
  const stops = [
    { name: "Mercado Bom Preço", status: "Entregue 08:12", tone: "bg-success" },
    { name: "Farmácia Zona Norte", status: "Entregue 08:31", tone: "bg-success" },
    { name: "Loja Zona Leste", status: "Em rota", tone: "bg-info" },
  ];
  return (
    <div aria-hidden="true" className="surface-glass w-full max-w-sm rounded-2xl border p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <span className="nhf-live">Ao vivo</span>
        <span className="font-data text-xs text-muted-foreground">08:42</span>
      </div>
      <p className="mt-4 font-heading text-lg font-semibold text-foreground">Romaneio #128</p>
      <p className="text-sm text-muted-foreground">6 de 8 entregas feitas</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-3/4 rounded-full bg-primary" />
      </div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {stops.map((stop) => (
          <li key={stop.name} className="flex items-center gap-2.5">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", stop.tone)} />
            <span className="flex-1 truncate text-foreground">{stop.name}</span>
            <span className="font-data text-xs text-muted-foreground">{stop.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Estrutura das telas publicas (entrar, cadastro, nova senha, instalar, 404):
 * marca e tema no topo, conteudo centralizado e, no computador, o painel da
 * marca com a proposta de valor ao lado.
 */
export function AuthLayout({
  children,
  variant = "split",
  headline,
  points = DEFAULT_POINTS,
  badge,
  width = "sm",
}: AuthLayoutProps) {
  const split = variant === "split";

  return (
    <div className={cn("relative min-h-dvh overflow-hidden bg-background text-foreground", split && "lg:grid lg:grid-cols-2")}>
      {/* Linhas de rota a 45 graus (manual da marca) atras do conteudo centralizado. */}
      {!split && <div aria-hidden="true" className="nhf-routes pointer-events-none absolute inset-0" />}
      {split && (
        <aside
          aria-label="Sobre o Na Hora Frota"
          className="relative hidden overflow-hidden border-r bg-card lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:self-start lg:p-12 xl:p-16"
        >
          <div aria-hidden="true" className="nhf-routes pointer-events-none absolute inset-0" />
          <div className="relative">
            <Link to="/login" className="inline-block rounded-md">
              <BrandLogo arrangement="horizontal" className="w-[200px]" />
            </Link>
          </div>

          <div className="relative max-w-lg space-y-8 py-10">
            {badge}
            <p className="font-heading text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-foreground xl:text-5xl">
              {headline ?? (
                <>
                  Gestão de frota em tempo real. Entrega <span className="text-primary">sempre na hora.</span>
                </>
              )}
            </p>
            <ul className="stagger space-y-5">
              {points.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background text-primary shadow-xs"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-medium text-foreground">{title}</span>
                    <span className="block text-sm text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <LivePreview />
          </div>
        </aside>
      )}

      <div className="relative flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
          <Link to="/login" className={cn("rounded-md", split && "lg:invisible")}>
            <BrandLogo arrangement="horizontal" className="w-[148px] sm:w-[164px]" />
          </Link>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className={cn("w-full animate-fade-in", width === "sm" ? "max-w-sm" : "max-w-md")}>{children}</div>
        </main>

        <footer className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground sm:px-8">
          © {new Date().getFullYear()} Na Hora Frota ·{" "}
          <Link to="/install" className="font-medium underline-offset-4 hover:text-foreground hover:underline">
            Instalar o app no celular
          </Link>
        </footer>
      </div>
    </div>
  );
}
