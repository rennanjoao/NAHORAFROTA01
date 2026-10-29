import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

type Props = {
  eyebrow: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
  className?: string;
  /** Palavra do título que recebe o verde (uma por frase, como manda o manual). */
  accent?: string;
};

export function SectionHeader({ eyebrow, title, lead, align = "left", className, accent }: Props) {
  const parts = accent && title.includes(accent) ? title.split(accent) : null;
  return (
    <Reveal className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      <p className={cn("label-caps text-brand flex items-center gap-3", align === "center" && "justify-center")}>
        <span aria-hidden="true" className="inline-block h-px w-8 bg-brand" />
        {eyebrow}
      </p>
      <h2 className="mt-4 text-balance text-3xl font-bold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
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
      {lead && <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">{lead}</p>}
    </Reveal>
  );
}
