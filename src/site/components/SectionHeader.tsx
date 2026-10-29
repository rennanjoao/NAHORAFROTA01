import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EASE } from "./Reveal";

type Props = {
  eyebrow: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
  className?: string;
  /** Palavra do título em verde (uma por frase). */
  accent?: string;
  size?: "md" | "lg";
};

const item = { hidden: { opacity: 0, y: 22, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.85, ease: EASE } } };

/** Chip com ponto verde, título curto e uma frase de apoio, entrando em sequência. */
export function SectionHeader({ eyebrow, title, lead, align = "left", className, accent, size = "lg" }: Props) {
  const reduce = useReducedMotion();
  const parts = accent && title.includes(accent) ? title.split(accent) : null;
  return (
    <motion.div
      className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-60px 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
    >
      <motion.span variants={item} className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" />
        {eyebrow}
      </motion.span>
      <motion.h2 variants={item} className={cn("mt-5 text-balance font-heading font-semibold leading-[1.08] tracking-tight", size === "lg" ? "text-3xl sm:text-4xl lg:text-[2.85rem]" : "text-2xl sm:text-3xl lg:text-4xl")}>
        {parts ? (
          <>
            {parts[0]}
            <span className="text-brand">{accent}</span>
            {parts[1]}
          </>
        ) : (
          title
        )}
      </motion.h2>
      {lead && (
        <motion.p variants={item} className={cn("mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg", align === "center" && "mx-auto")}>
          {lead}
        </motion.p>
      )}
    </motion.div>
  );
}
