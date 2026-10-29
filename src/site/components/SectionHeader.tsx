import { cn } from "@/lib/utils";
import { TextReveal, LineReveal } from "../motion/TextReveal";

type Props = {
  eyebrow: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
  className?: string;
  /** Palavra do título que recebe o verde (uma por frase, como manda o manual). */
  accent?: string;
  /** Tamanho do título. */
  size?: "md" | "lg" | "xl";
  /** Número da seção, no canto (01, 02…). */
  index?: string;
};

export function SectionHeader({ eyebrow, title, lead, align = "left", className, accent, size = "lg", index }: Props) {
  const sizes = {
    md: "text-[clamp(1.9rem,4vw,3rem)]",
    lg: "text-[clamp(2.3rem,5.2vw,4.2rem)]",
    xl: "text-[clamp(2.6rem,6.4vw,5.4rem)]",
  }[size];
  return (
    <div className={cn("max-w-4xl", align === "center" && "mx-auto text-center", className)}>
      <LineReveal>
        <p className={cn("label-caps flex items-center gap-3 text-brand", align === "center" && "justify-center")}>
          {index && <span className="font-data text-muted-foreground">{index}</span>}
          <span aria-hidden="true" className="inline-block h-px w-8 bg-brand" />
          {eyebrow}
        </p>
      </LineReveal>
      <TextReveal text={title} accent={accent} className={cn("display mt-5", sizes)} delay={0.05} />
      {lead && (
        <LineReveal delay={0.35} className={cn("mt-6 max-w-2xl", align === "center" && "mx-auto")}>
          <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg lg:text-xl">{lead}</p>
        </LineReveal>
      )}
    </div>
  );
}
