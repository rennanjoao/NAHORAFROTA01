import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useResolvedTheme } from "@/components/theme/PreferencesProvider";
import { cn } from "@/lib/utils";

/** Le uma variavel HSL do tema ("213 9% 38%") e devolve no formato que o framer interpola. */
function themeHsl(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = raw.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  return m ? `hsl(${m[1]}, ${m[2]}%, ${m[3]}%)` : fallback;
}

function Word({ word, progress, start, end, dim, lit }: { word: string; progress: MotionValue<number>; start: number; end: number; dim: string; lit: string }) {
  const color = useTransform(progress, [start, end], [dim, lit]);
  return (
    <motion.span style={{ color }} className="inline-block">
      {word}&nbsp;
    </motion.span>
  );
}

/**
 * Frase grande cujas palavras acendem uma a uma conforme a pagina rola: vao da
 * cor de texto secundario (ja legivel, contraste AA) ate a cor cheia. Quem usa
 * leitor de tela recebe a frase inteira, sem efeito.
 */
export function ScrubText({ text, accent, className }: { text: string; accent?: string; className?: string }) {
  const reduce = useReducedMotion();
  const theme = useResolvedTheme();
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  const [colors, setColors] = useState({ dim: "hsl(213, 9%, 38%)", fg: "hsl(210, 20%, 96%)", brand: "hsl(162, 97%, 46%)" });
  useEffect(() => {
    setColors({
      dim: themeHsl("--muted-foreground", "hsl(213, 9%, 38%)"),
      fg: themeHsl("--foreground", "hsl(210, 20%, 96%)"),
      brand: themeHsl("--brand-text", "hsl(162, 97%, 46%)"),
    });
  }, [theme]);

  const words = text.split(" ");
  const accentWords = accent ? accent.replace(/[.,!?;:]+$/, "").split(" ") : [];
  if (reduce) {
    return (
      <p ref={ref} className={cn("text-balance", className)}>
        {text}
      </p>
    );
  }
  return (
    <p ref={ref} className={cn("text-balance", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => {
          const isAccent = accentWords.includes(w.replace(/[.,!?;:]+$/, ""));
          return <Word key={`${i}-${theme}`} word={w} progress={scrollYProgress} start={i / words.length} end={(i + 1) / words.length} dim={colors.dim} lit={isAccent ? colors.brand : colors.fg} />;
        })}
      </span>
    </p>
  );
}
