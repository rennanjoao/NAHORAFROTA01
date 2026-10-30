import { useEffect, useState } from "react";
import type { StyleSpecification } from "maplibre-gl";

/*
 * Estilos do mapa vetorial (OpenFreeMap). Claro: "liberty" (colorido e limpo).
 * Escuro: "dark" recolorido com a paleta da marca (fundo ardosia, agua azul petroleo,
 * parques verde escuro, ruas mais claras), porque o original e quase todo preto.
 */
const URL = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

type Theme = keyof typeof URL;

const DARK_PAINT: Record<string, Record<string, string>> = {
  background: { "background-color": "#0d1215" },
  water: { "fill-color": "#0b2a33" },
  waterway: { "line-color": "#0f3a45" },
  landuse_residential: { "fill-color": "#11171b" },
  landcover_wood: { "fill-color": "#0e261d" },
  landuse_park: { "fill-color": "#0f2c21" },
  building: { "fill-color": "#161d22", "fill-outline-color": "#1f282f" },
  highway_path: { "line-color": "#1f282e" },
  highway_minor: { "line-color": "#1d262c" },
  highway_major_casing: { "line-color": "#2e3a43" },
  highway_major_inner: { "line-color": "#27333c" },
  highway_major_subtle: { "line-color": "#27333c" },
  highway_motorway_casing: { "line-color": "#3a4752" },
  highway_motorway_inner: { "line-color": "#34424d" },
  highway_motorway_subtle: { "line-color": "#2a363f" },
  railway: { "line-color": "#29323a" },
  railway_minor: { "line-color": "#29323a" },
  railway_transit: { "line-color": "#29323a" },
  "aeroway-area": { "fill-color": "#141b20" },
  "aeroway-taxiway": { "line-color": "#1f2a31" },
  "aeroway-runway-casing": { "line-color": "#33404a" },
  "aeroway-runway": { "line-color": "#2a3640" },
  road_area_pier: { "fill-color": "#0d1215" },
  road_pier: { "line-color": "#0d1215" },
  water_name: { "text-color": "#3f95a8", "text-halo-color": "#0d1215" },
  highway_name_other: { "text-color": "#71808b", "text-halo-color": "#0d1215" },
  highway_name_motorway: { "text-color": "#82919c" },
};
const DARK_PLACE_LABEL = { "text-color": "#93a1ab", "text-halo-color": "#0d1215" };

export function brandDarkStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const override = DARK_PAINT[layer.id] ?? (layer.id.startsWith("place_") ? DARK_PLACE_LABEL : null);
      if (!override || layer.type === "hillshade") return layer;
      return { ...layer, paint: { ...(("paint" in layer && layer.paint) || {}), ...override } } as typeof layer;
    }),
  };
}

const cache = new Map<Theme, Promise<StyleSpecification>>();

function loadStyle(theme: Theme): Promise<StyleSpecification> {
  let p = cache.get(theme);
  if (!p) {
    p = fetch(URL[theme])
      .then((r) => {
        if (!r.ok) throw new Error(`estilo do mapa: ${r.status}`);
        return r.json() as Promise<StyleSpecification>;
      })
      .then((style) => (theme === "dark" ? brandDarkStyle(style) : style));
    p.catch(() => cache.delete(theme));
    cache.set(theme, p);
  }
  return p;
}

/** Estilo pronto para o tema (ou o endereco original, se a busca falhar). */
export function useBrandMapStyle(theme: Theme): StyleSpecification | string | null {
  const [style, setStyle] = useState<StyleSpecification | string | null>(null);
  useEffect(() => {
    let alive = true;
    setStyle(null);
    loadStyle(theme)
      .then((s) => alive && setStyle(s))
      .catch(() => alive && setStyle(URL[theme]));
    return () => {
      alive = false;
    };
  }, [theme]);
  return style;
}
