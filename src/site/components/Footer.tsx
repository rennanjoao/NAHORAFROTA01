import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { useAnchor } from "./useAnchor";

const SUPPORT_EMAIL = "suporte@nahorafrota.com.br";

export function Footer() {
  const anchor = useAnchor();
  const year = new Date().getFullYear();
  const cols = [
    {
      title: "Produto",
      links: [
        { label: "Mapa ao vivo", href: anchor("produto") },
        { label: "Romaneio e entregas", href: anchor("produto") },
        { label: "SLA e relatórios", href: anchor("produto") },
        { label: "Acerto financeiro", href: anchor("produto") },
        { label: "App do motorista", href: anchor("motorista") },
      ],
    },
    {
      title: "Começar",
      links: [
        { label: "Planos e preços", href: anchor("planos") },
        { label: "Como funciona", href: anchor("como-funciona") },
        { label: "Dúvidas frequentes", href: anchor("duvidas") },
        { label: "Entrar", to: "/login" },
        { label: "Instalar o app", to: "/install" },
      ],
    },
    {
      title: "Empresa",
      links: [
        { label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
        { label: "Termos de uso", to: "/termos" },
        { label: "Privacidade", to: "/privacidade" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="horizontal" className="h-14 w-auto" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Painel de entregas e frota para quem precisa saber onde cada placa está e fechar o acerto no mesmo dia.
            </p>
            <p className="mt-4 label-caps text-brand">Sempre na hora.</p>
          </div>
          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h3 className="label-caps text-foreground/70">{c.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {"to" in l && l.to ? (
                      <Link to={l.to} className="text-sm text-foreground/80 transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href} className="text-sm text-foreground/80 transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Na Hora Frota. Todos os direitos reservados.</p>
          <p className="font-data uppercase tracking-[0.08em]">nahorafrota.tech</p>
        </div>
      </div>
    </footer>
  );
}
