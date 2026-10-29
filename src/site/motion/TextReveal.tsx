import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ElementType } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  text: string;
  /** Palavra(s) em verde (uma por frase, como manda o manual). */
  accent?: string;
  as?: ElementType;
  className?: string;
  id?: string;
  delay?: number;
  /** Espaco entre as palavras na animacao. */
  stagger?: number;
  once?: boolean;
};

/**
 * Titulo que entra palavra por palavra, de baixo para cima, por tras de uma
 * mascara. O texto fica inteiro no DOM (leitores de tela leem a frase normal).
 */
export function TextReveal({ text, accent, as: Tag = "h2", className, id, delay = 0, stagger = 0.045, once = true }: Props) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const accentWords = accent ? accent.split(" ") : [];
  const accentStart = accent ? indexOfSeq(words, accentWords) : -1;
  return (
    <Tag id={id} className={cn("text-balance", className)} aria-label={text}>
      <motion.span
        aria-hidden="true"
        className="inline"
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={{ once, margin: "-10% 0px" }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      >
        {words.map((w, i) => {
          const isAccent = accentStart >= 0 && i >= accentStart && i < accentStart + accentWords.length;
          return (
            <span key={i} className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]">
              <motion.span
                className={cn("inline-block will-change-transform", isAccent && "text-brand")}
                variants={{ hidden: { y: "110%", rotate: 3 }, show: { y: 0, rotate: 0, transition: { duration: 0.9, ease: EASE } } }}
              >
                {w}
              </motion.span>
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </motion.span>
    </Tag>
  );
}

function indexOfSeq(hay: string[], needle: string[]): number {
  if (!needle.length) return -1;
  const norm = (s: string) => s.replace(/[.,!?;:]+$/, "");
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (norm(hay[i + j]) !== norm(needle[j])) continue outer;
    return i;
  }
  return -1;
}

/** Paragrafo/linha que sobe por tras de uma mascara (para leads e rotulos). */
export function LineReveal({ children, className, delay = 0, as: Tag = "div" }: { children: React.ReactNode; className?: string; delay?: number; as?: ElementType }) {
  const reduce = useReducedMotion();
  return (
    <Tag className={cn("overflow-hidden", className)}>
      <motion.div
        initial={reduce ? false : { y: "100%", opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 0.9, delay, ease: EASE }}
      >
        {children}
      </motion.div>
    </Tag>
  );
}
