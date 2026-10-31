import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useControl, type IControl } from "react-map-gl/maplibre";

/*
 * Tela cheia do quadro do mapa inteiro (contagens, botoes, mapa e atualizacoes dos
 * motoristas), nao so do mapa. A pagina toda entra na tela cheia do navegador e o
 * quadro cobre a tela; assim o que abre de dentro dele (lista de notas, dicas) continua
 * aparecendo por cima. Sem a tela cheia do navegador (iPhone) o quadro so cobre a janela.
 */

export interface MapFullscreen {
  active: boolean;
  toggle: () => void;
}

export const MapFullscreenContext = createContext<MapFullscreen | null>(null);

export function useFrameFullscreen(): MapFullscreen {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  // Se a tela cheia do navegador foi pedida aqui (para sair dela junto).
  const native = useRef(false);

  const exit = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    if (native.current) {
      native.current = false;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggle = useCallback(() => {
    if (activeRef.current) return exit();
    activeRef.current = true;
    setActive(true);
    const root = document.documentElement;
    if (document.fullscreenEnabled && !document.fullscreenElement && root.requestFullscreen) {
      native.current = true;
      root.requestFullscreen().catch(() => {
        native.current = false;
      });
    }
  }, [exit]);

  // Esc (ou o botao do navegador) sai da tela cheia: o quadro volta junto.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && native.current) exit();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (native.current && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [exit]);

  // Enquanto cobre a tela: a pagina de tras nao rola e o quadro fica por cima do menu
  // (regra em index.css). Sem a tela cheia do navegador, Esc tambem sai; o Esc que so
  // fechou uma janela aberta de dentro do quadro nao conta. Ao sair, a pagina volta
  // para onde estava (o navegador as vezes ancora a rolagem em outro ponto).
  useLayoutEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const scrollY = window.scrollY;
    root.setAttribute("data-map-fullscreen", "");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !native.current) exit();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.removeAttribute("data-map-fullscreen");
      document.removeEventListener("keydown", onKey);
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, [active, exit]);

  return useMemo(() => ({ active, toggle }), [active, toggle]);
}

/** Botao no canto do mapa, com o visual dos outros botoes do MapLibre/Mapbox. */
class FrameFullscreenControl implements IControl {
  private container: HTMLDivElement | null = null;
  private button: HTMLButtonElement | null = null;
  private prefix = "maplibregl";
  private active = false;

  constructor(private readonly onToggle: () => void) {}

  onAdd(map: { getContainer(): HTMLElement }) {
    this.prefix = map.getContainer().classList.contains("mapboxgl-map") ? "mapboxgl" : "maplibregl";
    const container = document.createElement("div");
    container.className = `${this.prefix}-ctrl ${this.prefix}-ctrl-group`;
    const button = document.createElement("button");
    button.type = "button";
    const icon = document.createElement("span");
    icon.className = `${this.prefix}-ctrl-icon`;
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);
    button.addEventListener("click", this.onToggle);
    container.append(button);
    this.container = container;
    this.button = button;
    this.setActive(this.active);
    return container;
  }

  onRemove() {
    this.container?.remove();
    this.container = null;
    this.button = null;
  }

  setActive(active: boolean) {
    this.active = active;
    if (!this.button) return;
    const label = active ? "Sair da tela cheia" : "Tela cheia";
    this.button.className = `${this.prefix}-ctrl-${active ? "shrink" : "fullscreen"}`;
    this.button.title = label;
    this.button.setAttribute("aria-label", label);
  }
}

const noop = () => {};

/** Botao de tela cheia do quadro; vai dentro do <Map> que esta no LiveMapFrame. */
export function MapFullscreenControl() {
  const fullscreen = useContext(MapFullscreenContext);
  const toggle = fullscreen?.toggle ?? noop;
  const active = fullscreen?.active ?? false;
  const control = useControl(() => new FrameFullscreenControl(toggle), { position: "top-left" });
  useEffect(() => control.setActive(active), [control, active]);
  return null;
}
