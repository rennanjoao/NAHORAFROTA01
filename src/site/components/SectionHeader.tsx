import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

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

/** Chip com ponto verde + título curto + uma frase de apoio. */
export function SectionHeader({ eyebrow, title, lead, align = "left", className, accent, size = "lg" }: Props) {
  const parts = accent && title.includes(accent) ? title.split(accent) : null;
  return (
    <Reveal className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" />
        {eyebrow}
      </span>
      <h2 className={cn("mt-5 text-balance font-heading font-semibold leading-[1.1] tracking-tight", size === "lg" ? "text-3xl sm:text-4xl lg:text-[2.75rem]" : "text-2xl sm:text-3xl lg:text-4xl")}>
        {parts ? (
          <>
            {parts[0]}
            <span className="text-brand">{accent}</span>
            {parts[1]}
          </>
        ) : (
          title
        )}
      </h2>
      {lead && <p className={cn("mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg", align === "center" && "mx-auto")}>{lead}</p>}
    </Reveal>
  );
}
