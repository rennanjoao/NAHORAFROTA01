import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Links do menu com um marcador que desliza ate a secao visivel (ou ate o link sob o mouse). */
export function NavLinks({ links, anchor }: { links: { id: string; label: string }[]; anchor: (id: string) => string }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const els = links.map((l) => document.getElementById(l.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        let best: string | null = null;
        let max = 0;
        for (const [id, r] of seen) if (r > max) { max = r; best = id; }
        setCurrent(max > 0 ? best : null);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.01, 0.25, 0.5, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [links]);

  const marked = hover ?? current;
  return (
    <ul className="relative hidden items-center gap-1 rounded-full border border-foreground/10 bg-card/80 p-1 shadow-sm backdrop-blur lg:flex" onMouseLeave={() => setHover(null)}>
      {links.map((l) => (
        <li key={l.id} className="relative">
          {marked === l.id && (
            <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-foreground/[0.07]" transition={{ type: "spring", stiffness: 380, damping: 32 }} aria-hidden="true" />
          )}
          <a
            href={anchor(l.id)}
            onMouseEnter={() => setHover(l.id)}
            aria-current={current === l.id ? "location" : undefined}
            className={cn(
              "relative block whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              current === l.id ? "text-foreground" : "text-foreground/75 hover:text-foreground",
            )}
          >
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
