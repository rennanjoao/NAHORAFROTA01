import type { ReactNode } from "react";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";

export function SiteLayout({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <Nav />
      <main id="conteudo" className="flex-1">{children}</main>
      {footer && <Footer />}
    </div>
  );
}
