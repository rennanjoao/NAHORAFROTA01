import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { Cta } from "./Cta";
import { useAnchor } from "./useAnchor";
import { NavLinks } from "./NavLinks";
import { motion, useScroll, useSpring } from "framer-motion";

const LINKS = [
  { id: "produto", label: "Produto" },
  { id: "na-pratica", label: "Na prática" },
  { id: "motorista", label: "Motorista" },
  { id: "planos", label: "Planos" },
  { id: "duvidas", label: "Dúvidas" },
];

export function Nav() {
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
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
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
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-200", (scrolled || open) && "bg-background/90 shadow-[0_1px_0_0_hsl(var(--foreground)/0.08)] backdrop-blur-md")}>
      <motion.div aria-hidden="true" style={{ scaleX: progress }} className="absolute inset-x-0 top-0 h-[2px] origin-left bg-brand" />
      <nav aria-label="Principal" className="container flex h-[72px] items-center justify-between gap-4">
        <Link to="/" className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Na Hora Frota — início">
          <Logo variant="linha" className="h-6 w-auto min-[420px]:h-7" />
        </Link>

        <NavLinks links={LINKS} anchor={anchor} />

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Link to={account.to} className="rounded-full px-4 py-2 text-sm font-semibold text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {account.label}
          </Link>
          <Cta href={anchor("planos")}>Ver planos</Cta>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          {/* em telas muito estreitas o tema fica dentro do menu, para o botao do menu caber */}
          <ThemeToggle className="hidden min-[380px]:inline-flex" />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <div id="menu-mobile" hidden={!open} className="min-h-[calc(100dvh-72px)] border-t border-foreground/10 bg-background lg:hidden">
        <div className="container flex flex-col gap-1 py-4">
          {LINKS.map((l) => (
            <a key={l.id} href={anchor(l.id)} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base font-medium text-foreground/85 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {l.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-foreground/10 pt-4">
            <div className="flex items-center justify-between gap-3">
              <Link to={account.to} className="rounded-lg px-3 py-3 text-base font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {account.label}
              </Link>
              <ThemeToggle className="min-[380px]:hidden" />
            </div>
            <Cta href={anchor("planos")} onClick={() => setOpen(false)} className="w-full">
              Ver planos
            </Cta>
          </div>
        </div>
      </div>
    </header>
  );
}
