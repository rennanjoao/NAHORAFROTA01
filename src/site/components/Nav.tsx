import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { Cta } from "./Cta";
import { useAnchor } from "./useAnchor";

const LINKS = [
  { id: "produto", label: "Produto" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "motorista", label: "Motorista" },
  { id: "planos", label: "Planos" },
  { id: "duvidas", label: "Dúvidas" },
];


export function Nav() {
  // Quem ja esta logado nao precisa de "Entrar": vai direto ao painel (ou ao app, se for motorista).
  const { session, isDriverUser } = useAuth();
  const account = session
    ? isDriverUser
      ? { to: "/tracker", label: "Abrir o app" }
      : { to: "/dashboard", label: "Abrir painel" }
    : { to: "/login", label: "Entrar" };
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const anchor = useAnchor();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300",
        scrolled || open ? "border-b border-border bg-background/85 backdrop-blur-xl" : "border-b border-transparent bg-transparent",
      )}
    >
      <nav aria-label="Principal" className="container flex h-[72px] items-center justify-between gap-4">
        <Link to="/" className="flex items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Na Hora Frota — início">
          <Logo variant="linha" className="h-7 w-auto" />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.id}>
              <a
                href={anchor(l.id)}
                className="whitespace-nowrap rounded px-2.5 py-2 text-sm font-medium text-foreground/75 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:px-3"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Link
            to={account.to}
            className="rounded px-4 py-2 text-sm font-semibold text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {account.label}
          </Link>
          <Cta href={anchor("planos")} className="ml-1">
            Começar agora
          </Cta>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded border border-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <div
        id="menu-mobile"
        hidden={!open}
        className="min-h-[calc(100dvh-72px)] border-t border-border bg-background lg:hidden"
      >
        <div className="container flex flex-col gap-1 py-4">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={anchor(l.id)}
              onClick={() => setOpen(false)}
              className="rounded px-3 py-3 text-base font-medium text-foreground/85 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4">
            <Link to={account.to} className="rounded px-3 py-3 text-base font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {account.label}
            </Link>
            <Cta href={anchor("planos")} onClick={() => setOpen(false)} className="w-full">
              Começar agora
            </Cta>
          </div>
        </div>
      </div>
    </header>
  );
}
