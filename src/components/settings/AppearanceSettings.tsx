import { useEffect, useState } from "react";
import { Check, Palette, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { ThemeSegmented } from "@/components/theme/ThemeToggle";
import { usePreferences } from "@/components/theme/PreferencesProvider";
import { toast } from "@/hooks/use-toast";
import type { TextSize } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { SettingsCard, SettingsRow } from "./SettingsCard";

const TEXT_SIZES: { value: TextSize; label: string; sample: string }[] = [
  { value: "normal", label: "Normal", sample: "text-base" },
  { value: "large", label: "Grande", sample: "text-xl" },
  { value: "larger", label: "Maior", sample: "text-2xl" },
];

/** O sistema operacional ja pede menos movimento? (acompanha mudancas ao vivo) */
function useSystemReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Configuracoes > Aparencia e acessibilidade. Tudo vale na hora, sem botao de salvar. */
export function AppearanceSettings() {
  const { textSize, motion, contrast, setPreference, reset } = usePreferences();
  const systemReducesMotion = useSystemReducedMotion();
  const isDefault = textSize === "normal" && motion === "system" && contrast === "normal";

  const handleReset = () => {
    reset();
    toast({ title: "Preferências restauradas", description: "Texto, animações e contraste voltaram ao normal." });
    // O botao fica desabilitado no padrao: o foco vai para o tamanho do texto (e nao se perde).
    window.setTimeout(() => document.getElementById("texto-normal")?.focus(), 0);
  };

  return (
    <SettingsCard
      icon={Palette}
      title="Aparência e acessibilidade"
      description="Deixe a tela do jeito mais confortável para você ler e usar."
      footerHint="As mudanças valem na hora e ficam salvas neste aparelho."
      footer={
        <Button type="button" variant="outline" onClick={handleReset} disabled={isDefault}>
          <RotateCcw aria-hidden="true" />
          Restaurar padrão
        </Button>
      }
    >
      <div className="divide-y">
        <SettingsRow
          labelId="aparencia-tema"
          label="Tema"
          hint="Claro, escuro ou automático, que segue o tema do seu aparelho."
        >
          {/* Em telas de 320px o icone sai para "Automático" caber. */}
          <ThemeSegmented className="w-full sm:w-[22rem] [&>button]:min-h-10 [&>button]:gap-1 [&>button]:px-1 [&>button]:text-[0.8125rem] [&_svg]:shrink-0 max-[359px]:[&_svg]:hidden" />
        </SettingsRow>

        <div className="space-y-4 py-5 first:pt-0 last:pb-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <div className="min-w-0 sm:max-w-md">
              <p id="aparencia-texto" className="text-sm font-medium leading-tight text-foreground">
                Tamanho do texto
              </p>
              <p id="aparencia-texto-dica" className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                Aumenta letras, botões e espaços de todas as telas.
              </p>
            </div>
            <RadioGroup
              value={textSize}
              onValueChange={(value) => setPreference("textSize", value as TextSize)}
              aria-labelledby="aparencia-texto"
              aria-describedby="aparencia-texto-dica"
              className="grid w-full grid-cols-3 gap-2 sm:w-[22rem]"
            >
              {TEXT_SIZES.map((option) => {
                const selected = textSize === option.value;
                return (
                  <label
                    key={option.value}
                    htmlFor={`texto-${option.value}`}
                    className={cn(
                      "relative flex min-h-[5.25rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border bg-card px-2 py-3 text-center transition-[border-color,background-color,box-shadow] duration-fast ease-out",
                      "hover:border-foreground/25 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                      selected && "border-primary bg-primary/5 shadow-xs hover:border-primary",
                    )}
                  >
                    <RadioGroupItem id={`texto-${option.value}`} value={option.value} className="sr-only" />
                    {selected && (
                      <span
                        aria-hidden="true"
                        className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground animate-pop-in"
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                    <span aria-hidden="true" className={cn("font-heading font-semibold leading-none text-foreground", option.sample)}>
                      Aa
                    </span>
                    <span className={cn("text-[0.8125rem]", selected ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {option.label}
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <figure className="rounded-lg border border-dashed bg-muted/40 px-4 py-3.5">
            <figcaption className="nhf-label text-muted-foreground">Prévia</figcaption>
            <p className="mt-1.5 text-[0.9375rem] text-foreground">
              A nota 4512 saiu para entrega às 14h30 com o motorista João.
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">Previsão de chegada: 15h10, a 3,2 km do cliente.</p>
          </figure>
        </div>

        <SettingsRow
          inline
          htmlFor="aparencia-animacoes"
          hintId="aparencia-animacoes-dica"
          label="Reduzir animações"
          hint={
            systemReducesMotion
              ? "Seu aparelho já pede menos movimento, então as animações já estão reduzidas."
              : "Desliga os movimentos da tela, como cartões que sobem e números que correm."
          }
        >
          <Switch
            id="aparencia-animacoes"
            aria-describedby="aparencia-animacoes-dica"
            checked={motion === "reduce"}
            onCheckedChange={(checked) => setPreference("motion", checked ? "reduce" : "system")}
          />
        </SettingsRow>

        <SettingsRow
          inline
          htmlFor="aparencia-contraste"
          hintId="aparencia-contraste-dica"
          label="Alto contraste"
          hint="Deixa textos secundários e bordas mais fortes, para enxergar melhor."
        >
          <Switch
            id="aparencia-contraste"
            aria-describedby="aparencia-contraste-dica"
            checked={contrast === "more"}
            onCheckedChange={(checked) => setPreference("contrast", checked ? "more" : "normal")}
          />
        </SettingsRow>
      </div>
    </SettingsCard>
  );
}
