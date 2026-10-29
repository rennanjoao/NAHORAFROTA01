/**
 * Preferencias de aparencia e acessibilidade do usuario (tema, tamanho do texto,
 * movimento e contraste). Ficam no aparelho (localStorage) e sao aplicadas no
 * <html> como classe/atributos lidos pelo index.css.
 *
 * O index.html repete a leitura num script inline para aplicar o tema antes da
 * primeira pintura (sem piscar branco/preto). Se mudar a chave ou os valores,
 * atualize os dois lugares.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type TextSize = "normal" | "large" | "larger";
export type MotionPreference = "system" | "reduce";
export type ContrastPreference = "normal" | "more";

export interface Preferences {
  theme: ThemePreference;
  textSize: TextSize;
  motion: MotionPreference;
  contrast: ContrastPreference;
}

export const PREFERENCES_STORAGE_KEY = "nhf-prefs";

/** O produto nasce no escuro (manual da marca); o usuario escolhe o claro. */
export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  textSize: "normal",
  motion: "system",
  contrast: "normal",
};

const THEME_COLOR: Record<ResolvedTheme, string> = {
  dark: "#090A0B",
  light: "#F9FAFB",
};

export function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(prefs: Preferences) {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Navegacao privada ou armazenamento cheio: vale so para esta sessao.
  }
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  return theme === "system" ? systemTheme() : theme;
}

export function prefersReducedMotion(prefs?: Preferences): boolean {
  if (prefs?.motion === "reduce") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Aplica tudo no <html>. Sincrono, para funcionar dentro de uma View Transition. */
export function applyPreferences(prefs: Preferences) {
  const root = document.documentElement;
  const resolved = resolveTheme(prefs.theme);
  root.classList.remove("light", "dark");
  root.classList.add(resolved);

  if (prefs.textSize === "normal") delete root.dataset.textSize;
  else root.dataset.textSize = prefs.textSize;

  if (prefs.motion === "reduce") root.dataset.motion = "reduce";
  else delete root.dataset.motion;

  if (prefs.contrast === "more") root.dataset.contrast = "more";
  else delete root.dataset.contrast;

  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", THEME_COLOR[resolved]));
}
