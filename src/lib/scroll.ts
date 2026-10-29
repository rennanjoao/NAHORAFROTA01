import { prefersReducedMotion, readPreferences } from "@/lib/preferences";

/**
 * Leva a tela ate a secao e passa o foco para o titulo dela: o leitor de tela anuncia
 * onde a pessoa chegou e o proximo Tab continua dali (antes o foco ficava no botao la em cima).
 */
export function revealSection(id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({ block: "start", behavior: prefersReducedMotion(readPreferences()) ? "auto" : "smooth" });
  const target = section.querySelector<HTMLElement>("h2, h3") ?? section;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}
