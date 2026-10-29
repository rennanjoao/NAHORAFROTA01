import { cn } from "@/lib/utils";
import { useResolvedTheme } from "@/components/theme/PreferencesProvider";
import horizontalEscuro from "@/assets/brand/nhf-logo-horizontal-cor-fundo-escuro.svg";
import horizontalClaro from "@/assets/brand/nhf-logo-horizontal-cor-fundo-claro.svg";
import horizontalBranco from "@/assets/brand/nhf-logo-horizontal-mono-branco.svg";
import linhaEscuro from "@/assets/brand/nhf-logo-linha-cor-fundo-escuro.svg";
import linhaClaro from "@/assets/brand/nhf-logo-linha-cor-fundo-claro.svg";
import verticalEscuro from "@/assets/brand/nhf-logo-vertical-cor-fundo-escuro.svg";
import verticalClaro from "@/assets/brand/nhf-logo-vertical-cor-fundo-claro.svg";
import simboloVerde from "@/assets/brand/nhf-simbolo-verde.svg";
import simboloPreto from "@/assets/brand/nhf-simbolo-preto.svg";
import simboloBranco from "@/assets/brand/nhf-simbolo-branco.svg";
import wordmarkLinhaEscuro from "@/assets/brand/nhf-wordmark-linha-cor-fundo-escuro.svg";
import wordmarkLinhaClaro from "@/assets/brand/nhf-wordmark-linha-cor-fundo-claro.svg";

/**
 * Logo oficial (brand/logo/svg, texto em curvas). Manual da marca:
 * - horizontal e a versao principal; "linha" para faixas estreitas; simbolo so
 *   quando o espaco nao comporta o nome.
 * - fundo escuro: "Na Hora" branco e "Frota" verde; fundo claro: "Na Hora" preto.
 * - nunca recompor o nome com fonte, distorcer ou aplicar efeitos.
 */
type Arrangement = "horizontal" | "linha" | "vertical" | "simbolo" | "wordmark-linha";
type Tone = "escuro" | "claro" | "mono-branco" | "mono-preto";

const SOURCES: Record<Arrangement, Partial<Record<Tone, string>>> = {
  horizontal: { escuro: horizontalEscuro, claro: horizontalClaro, "mono-branco": horizontalBranco },
  linha: { escuro: linhaEscuro, claro: linhaClaro },
  vertical: { escuro: verticalEscuro, claro: verticalClaro },
  simbolo: { escuro: simboloVerde, claro: simboloVerde, "mono-preto": simboloPreto, "mono-branco": simboloBranco },
  "wordmark-linha": { escuro: wordmarkLinhaEscuro, claro: wordmarkLinhaClaro },
};

interface BrandLogoProps {
  arrangement?: Arrangement;
  /** Cor do fundo onde o logo fica. "auto" acompanha o tema (claro/escuro). */
  tone?: Tone | "auto";
  className?: string;
}

export function BrandLogo({ arrangement = "horizontal", tone = "auto", className }: BrandLogoProps) {
  const theme = useResolvedTheme();
  const resolvedTone: Tone = tone === "auto" ? (theme === "light" ? "claro" : "escuro") : tone;
  const src = SOURCES[arrangement][resolvedTone] ?? SOURCES[arrangement].escuro!;
  const label = arrangement === "simbolo" ? "Símbolo Na Hora Frota" : "Na Hora Frota";
  return <img src={src} alt={label} className={cn("h-auto select-none", className)} draggable={false} />;
}
