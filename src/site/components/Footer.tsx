import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { useAnchor } from "./useAnchor";

const SUPPORT_EMAIL = "suporte@nahorafrota.com.br";

export function Footer() {
  const anchor = useAnchor();
  const year = new Date().getFullYear();
  const cols = [
    { title: "Produto", links: [
      { label: "Mapa ao vivo", href: anchor("produto") },
      { label: "Um dia de operação", href: anchor("na-pratica") },
      { label: "Todos os recursos", href: anchor("recursos") },
      { label: "App do motorista", href: anchor("motorista") },
    ] },
    { title: "Começar", links: [
      { label: "Planos e preços", href: anchor("planos") },
      { label: "Testar grátis", to: "/register" },
      { label: "Entrar", to: "/login" },
      { label: "Instalar o app", to: "/install" },
    ] },
    { title: "Suporte", links: [
      { label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
      { label: "Dúvidas frequentes", href: anchor("duvidas") },
      { label: "Como funciona", href: anchor("como-funciona") },
    ] },
    { title: "Legal", links: [
      { label: "Termos de uso", to: "/termos" },
      { label: "Privacidade", to: "/privacidade" },
      { label: "Segurança", href: anchor("seguranca") },
    ] },
  ];

  return (
    <footer className="border-t border-foreground/10 bg-card">
      <div className="container py-14">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))]">
          <div className="col-span-2 lg:col-span-1">
            <Logo variant="linha" className="h-7 w-auto" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">Gestão de entregas e frota para quem precisa saber onde cada placa está e fechar o acerto no mesmo dia.</p>
          </div>
          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h3 className="font-heading text-sm font-semibold">{c.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {"to" in l && l.to ? (
                      <Link to={l.to} className="break-words text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{l.label}</Link>
                    ) : (
                      <a href={(l as { href: string }).href} className="break-words text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{l.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-foreground/10 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Na Hora Frota. Todos os direitos reservados.</p>
          <p className="font-data uppercase tracking-[0.08em]">Sempre na hora · nahorafrota.tech</p>
        </div>
      </div>
    </footer>
  );
}
