import { Check } from "lucide-react";
import { toneSoftBg, toneText } from "@/components/patterns";
import { cn } from "@/lib/utils";
import type { OccurrenceOption } from "./occurrenceTypes";

interface OptionTilesProps {
  /** Nome do grupo de radios (unico na tela). */
  name: string;
  legend: string;
  options: OccurrenceOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Escolha unica em blocos grandes (bom para toque com luva). Radios nativos:
 * setas do teclado e leitor de tela funcionam sem codigo extra.
 */
export function OptionTiles({ name, legend, options, value, onChange, disabled }: OptionTilesProps) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-foreground">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "relative flex min-h-[4.75rem] cursor-pointer flex-col justify-between gap-2 rounded-lg border bg-card p-3 text-left shadow-xs transition-[border-color,background-color,box-shadow] duration-fast ease-out",
                "hover:border-foreground/25 active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                selected && "border-primary bg-primary/10 hover:border-primary",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="flex items-start justify-between gap-2">
                <span
                  aria-hidden="true"
                  className={cn("flex h-8 w-8 items-center justify-center rounded-md", toneSoftBg[option.tone], toneText[option.tone])}
                >
                  <Icon className="h-[1.125rem] w-[1.125rem]" />
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border transition-colors duration-fast",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {selected && <Check className="h-3 w-3 animate-pop-in" strokeWidth={3} />}
                </span>
              </span>
              <span className="text-sm font-semibold leading-tight text-foreground">
                {option.label}
                {option.hint && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{option.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
