import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/site/components/ThemeToggle";
import { LiveClock } from "@/site/components/LiveClock";
import truckPhoto from "@/assets/brand/caminhao-bau.jpg";

/** Moldura das telas de autenticação: painel da marca à esquerda, formulário à direita. */
export function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1.05fr_1fr]">
      <a href="#form" className="skip-link">Pular para o formulário</a>
      <aside className="relative hidden overflow-hidden bg-nhf-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12" aria-hidden="true">
        <img src={truckPhoto} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" width={1800} height={1012} />
        <div className="absolute inset-0 bg-gradient-to-t from-nhf-ink via-nhf-ink/60 to-nhf-ink/20" />
        <div className="relative">
          <Logo variant="linha" tone="light" className="h-8 w-auto" />
        </div>
        <div className="relative">
          <LiveClock label="Ao vivo" />
          <p className="mt-6 max-w-md font-heading text-4xl font-bold leading-[1.05]">
            Quem vê a rota inteira <span className="text-nhf-green">chega primeiro.</span>
          </p>
          <p className="mt-4 max-w-sm text-white/70">Romaneio, mapa ao vivo, SLA e acerto. Tudo numa tela.</p>
          {aside}
        </div>
      </aside>

      <main className="flex flex-col px-5 py-6 sm:px-10 lg:px-16 lg:py-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:invisible" aria-label="Na Hora Frota — início">
            <Logo variant="linha" className="h-7 w-auto" />
          </Link>
          <ThemeToggle />
        </div>
        <div id="form" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-balance font-heading text-3xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-pretty text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Na Hora Frota · <Link to="/" className="hover:text-brand">nahorafrota.tech</Link></p>
      </main>
    </div>
  );
}
