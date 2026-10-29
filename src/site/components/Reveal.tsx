import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/* Curva de saida "expo": rapida no comeco, assenta devagar. Usada em todo o site. */
export const EASE = [0.16, 1, 0.3, 1] as const;
const HIDDEN = { opacity: 0, y: 28, filter: "blur(6px)" };
const SHOWN = { opacity: 1, y: 0, filter: "blur(0px)" };

/** Entra uma vez ao aparecer na tela. Sem movimento com reduced-motion. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : HIDDEN}
      whileInView={SHOWN}
      viewport={{ once: true, margin: "-60px 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className, gap = 0.08 }: { children: ReactNode; className?: string; gap?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-60px 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={{ hidden: HIDDEN, show: { ...SHOWN, transition: { duration: 0.85, ease: EASE } } }}>
      {children}
    </motion.div>
  );
}
