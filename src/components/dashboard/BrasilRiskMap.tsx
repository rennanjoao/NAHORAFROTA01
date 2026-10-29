import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowDownRight, ArrowUpRight, Route, ShieldAlert, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar, Section, StatusBadge, toneDot, type Tone } from "@/components/patterns";
import { STATUS_HEX } from "@/lib/brandSymbol";
import { prefersReducedMotion, readPreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { BRAZIL_CENTER, BRAZIL_REGIONS, CITY_COORDINATES, riskZones, type DangerousZone, type RiskZone } from "./riskZones";

type RiskLevel = RiskZone["riskLevel"];

/** Cor fixa do risco: critico = vermelho, alto = amarelo, medio = cinza (manual). */
const RISK: Record<RiskLevel, { label: string; plural: string; tone: Tone; hex: string; range: string }> = {
  critical: { label: "Crítico", plural: "críticas", tone: "danger", hex: STATUS_HEX.late, range: "mais de 10% dos casos do país" },
  high: { label: "Alto", plural: "de risco alto", tone: "warning", hex: STATUS_HEX.alert, range: "de 3% a 10%" },
  medium: { label: "Médio", plural: "de risco médio", tone: "neutral", hex: STATUS_HEX.idle, range: "menos de 3%" },
};

const DANGER: Record<DangerousZone["risk"], { label: string; tone: Tone }> = {
  extreme: { label: "Extremo", tone: "danger" },
  high: { label: "Alto", tone: "warning" },
  moderate: { label: "Moderado", tone: "neutral" },
};

const pctBR = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Raio do circulo em pixels: cresce com a parte dos roubos do pais. */
const bubbleRadius = (zone: RiskZone) => 9 + Math.sqrt(zone.statistics.percentOfTotal) * 3.6;

function flyOptions() {
  return prefersReducedMotion(readPreferences()) ? { animate: false } : { duration: 1.2 };
}

function Trend({ value, large }: { value: number; large?: boolean }) {
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-data font-semibold",
        large ? "text-xl" : "text-xs",
        up ? "text-destructive" : "text-success",
      )}
    >
      <Icon className={large ? "h-5 w-5" : "h-3.5 w-3.5"} aria-hidden="true" />
      <span className="sr-only">{up ? "Alta de" : "Queda de"}</span>
      {pctBR(Math.abs(value))}
    </span>
  );
}

/** Detalhe da regiao escolhida: numeros, recomendacao e trechos perigosos. */
function RiskZoneDetail({ zone }: { zone: RiskZone }) {
  const risk = RISK[zone.riskLevel];
  return (
    <Card className="animate-fade-in p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <StatusBadge tone={risk.tone}>Risco {risk.label.toLowerCase()}</StatusBadge>
          <h3 className="text-lg font-semibold leading-snug text-foreground">{zone.name}</h3>
          <p className="text-sm text-muted-foreground">
            {zone.region} · {zone.state}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-4 sm:gap-6">
          <div>
            <dt className="text-xs text-muted-foreground">Dos roubos do país</dt>
            <dd className="font-data text-xl font-semibold text-foreground">{pctBR(zone.statistics.percentOfTotal)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">No último ano</dt>
            <dd>
              <Trend value={zone.statistics.yearlyTrend} large />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Roubos por mês</dt>
            <dd className="font-data text-xl font-semibold text-foreground">
              {zone.statistics.monthlyOccurrences.toLocaleString("pt-BR")}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-sm text-foreground">{zone.description}</p>

      <Alert variant="warning" role="note" className="mt-4">
        <ShieldAlert aria-hidden="true" />
        <p className="font-semibold leading-snug text-foreground">O que fazer</p>
        <AlertDescription className="mt-0.5">{zone.recommendation}</AlertDescription>
      </Alert>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Trechos mais perigosos ({zone.dangerousZones.length})</h4>
          <ul className="divide-y overflow-hidden rounded-lg border">
            {zone.dangerousZones.map((place) => (
              <li key={place.name} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-foreground">{place.name}</p>
                  <p className="text-xs text-muted-foreground">{place.type}</p>
                </div>
                <StatusBadge tone={DANGER[place.risk].tone}>{DANGER[place.risk].label}</StatusBadge>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Cidades afetadas ({zone.cities.length})</h4>
            <ul className="flex flex-wrap gap-1.5">
              {zone.cities.map((city) => (
                <li key={city}>
                  <Badge variant="secondary">{city}</Badge>
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Cargas mais visadas</h4>
            <ul className="flex flex-wrap gap-1.5">
              {zone.statistics.mainTargets.map((target) => (
                <li key={target}>
                  <Badge variant="outline">{target}</Badge>
                </li>
              ))}
            </ul>
          </section>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Route className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium text-foreground">Vias principais:</span> {zone.route}
            </span>
          </p>
        </div>
      </div>

      <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">Fonte: {zone.source}</p>
    </Card>
  );
}

/** Mapa de risco de roubo de carga: filtros, mapa, lista de regioes e detalhe. */
export function BrasilRiskMap() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const [selectedZone, setSelectedZone] = useState<RiskZone>(riskZones[0]);

  // Filtros: regiao do pais (filtra a lista e aproxima o mapa) e cidade (aproxima
  // e abre a area mapeada da cidade, quando existe). O filtro "Bairro" saiu: o
  // mapa nao passa do zoom 10 e os bairros eram genericos, entao nao fazia nada.
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");

  const region = regionFilter === "all" ? null : BRAZIL_REGIONS[regionFilter];
  // So cidades que o mapa sabe localizar (antes algumas nao moviam o mapa).
  const availableCities = (region ? region.cities : Object.keys(CITY_COORDINATES)).slice().sort((a, b) => a.localeCompare(b, "pt-BR"));
  const visibleZones = region ? riskZones.filter((zone) => region.states.includes(zone.state)) : riskZones;

  const zoneOfCity = (city: string) =>
    riskZones.find((zone) => zone.cities.some((name) => name === city || name.startsWith(`${city} (`)));

  const handleRegionChange = (value: string) => {
    setRegionFilter(value);
    setCityFilter("all");
    const next = value === "all" ? null : BRAZIL_REGIONS[value];
    if (next) {
      mapRef.current?.flyTo(next.center, next.zoom, flyOptions());
      // O detalhe acompanha a lista: abre a primeira area da regiao.
      const first = riskZones.find((zone) => next.states.includes(zone.state));
      if (first && !next.states.includes(selectedZone.state)) setSelectedZone(first);
    } else {
      mapRef.current?.flyTo(BRAZIL_CENTER, 4, flyOptions());
    }
  };

  const handleCityChange = (value: string) => {
    setCityFilter(value);
    if (value !== "all" && CITY_COORDINATES[value]) {
      const { center, zoom } = CITY_COORDINATES[value];
      mapRef.current?.flyTo(center, zoom, flyOptions());
      const zone = zoneOfCity(value);
      if (zone) setSelectedZone(zone);
    } else if (value === "all" && region) {
      mapRef.current?.flyTo(region.center, region.zoom, flyOptions());
    } else if (value === "all") {
      mapRef.current?.flyTo(BRAZIL_CENTER, 4, flyOptions());
    }
  };

  const clearFilters = () => {
    setRegionFilter("all");
    setCityFilter("all");
    mapRef.current?.flyTo(BRAZIL_CENTER, 4, flyOptions());
  };

  const selectZone = (zone: RiskZone, fly: boolean) => {
    setSelectedZone(zone);
    if (fly) mapRef.current?.flyTo(zone.position, 7, flyOptions());
    // No celular e no tablet o detalhe fica abaixo do mapa: rola ate ele.
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      window.setTimeout(() => {
        detailRef.current?.scrollIntoView({ block: "start", behavior: prefersReducedMotion(readPreferences()) ? "auto" : "smooth" });
      }, 50);
    }
  };
  const selectZoneRef = useRef(selectZone);
  selectZoneRef.current = selectZone;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: BRAZIL_CENTER,
      zoom: 4,
      scrollWheelZoom: true,
      minZoom: 3,
      maxZoom: 10,
      zoomControl: false,
    });
    mapRef.current = map;
    const bubbles = bubblesRef.current;

    L.control.zoom({ zoomInTitle: "Aproximar", zoomOutTitle: "Afastar" }).addTo(map);

    // Tiles do OpenStreetMap com o filtro do tema (classe nhf-map-dark). Os tiles
    // escuros da CARTO passaram a exigir chave de API.
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      className: "nhf-map-dark",
    }).addTo(map);

    riskZones.forEach((zone) => {
      const { hex, label } = RISK[zone.riskLevel];

      // Area aproximada da regiao (aparece ao aproximar)
      L.circle(zone.position, {
        radius: zone.radius,
        fillColor: hex,
        fillOpacity: 0.12,
        color: hex,
        weight: 1,
        opacity: 0.5,
        interactive: false,
      }).addTo(map);

      // Circulo principal: tamanho pela parte dos roubos do pais
      const bubble = L.circleMarker(zone.position, {
        radius: bubbleRadius(zone),
        fillColor: hex,
        fillOpacity: 0.35,
        color: hex,
        weight: 2,
        opacity: 0.9,
      }).addTo(map);

      bubble.bindTooltip(`${zone.state} · ${zone.region} · risco ${label.toLowerCase()}`, { direction: "top", offset: [0, -6] });
      bubble.on("click", () => selectZoneRef.current(zone, true));
      bubbles.set(zone.id, bubble);
    });

    // Abre enquadrando as regioes mapeadas (litoral leste e sul)
    map.fitBounds(L.latLngBounds(riskZones.map((zone) => zone.position)), { padding: [32, 32], maxZoom: 6 });

    return () => {
      map.remove();
      mapRef.current = null;
      bubbles.clear();
    };
  }, []);

  // Destaca a regiao escolhida no mapa
  useEffect(() => {
    bubblesRef.current.forEach((bubble, id) => {
      const selected = id === selectedZone.id;
      bubble.setStyle({ weight: selected ? 4 : 2, fillOpacity: selected ? 0.6 : 0.35 });
      if (selected) bubble.bringToFront();
    });
  }, [selectedZone]);

  const counts = (Object.keys(RISK) as RiskLevel[]).map((level) => ({
    level,
    count: riskZones.filter((zone) => zone.riskLevel === level).length,
  }));

  const hasFilters = regionFilter !== "all" || cityFilter !== "all";

  return (
    <Section
      id="mapa-risco"
      title="Mapa de risco"
      description="Toque em uma área no mapa ou na lista para ver os trechos mais perigosos e o que fazer."
      actions={
        <ul className="flex flex-wrap gap-1.5" aria-label="Áreas por nível de risco">
          {counts.map(({ level, count }) => (
            <li key={level}>
              <StatusBadge tone={RISK[level].tone}>
                {count} {RISK[level].plural}
              </StatusBadge>
            </li>
          ))}
        </ul>
      }
    >
      <FilterBar
        actions={
          hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X aria-hidden="true" />
              Limpar filtros
            </Button>
          )
        }
      >
        <div className="grid gap-1.5 sm:w-48">
          <Label htmlFor="risco-regiao">Região do país</Label>
          <Select value={regionFilter} onValueChange={handleRegionChange}>
            <SelectTrigger id="risco-regiao">
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o Brasil</SelectItem>
              {Object.keys(BRAZIL_REGIONS).map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5 sm:w-52">
          <Label htmlFor="risco-cidade">Cidade</Label>
          <Select value={cityFilter} onValueChange={handleCityChange}>
            <SelectTrigger id="risco-cidade">
              <SelectValue placeholder="Cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{region ? "Todas as cidades da região" : "Todas as cidades"}</SelectItem>
              {availableCities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-3">
          <div className="flex flex-col lg:col-span-2 lg:h-[34rem]">
            <div
              ref={mapContainerRef}
              role="region"
              aria-label="Mapa do Brasil com as áreas de risco"
              className="h-[22rem] w-full sm:h-[28rem] lg:h-auto lg:min-h-0 lg:flex-1"
            />
            {/* Legenda */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Nível de risco</span>
              {(Object.keys(RISK) as RiskLevel[]).map((level) => (
                <span key={level} className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-full", toneDot[RISK[level].tone])} />
                  <span>
                    <span className="font-medium text-foreground">{RISK[level].label}</span> · {RISK[level].range}
                  </span>
                </span>
              ))}
              <span>Círculo maior = mais roubos</span>
            </div>
          </div>

          {/* Lista de areas: mesma acao do clique no mapa, pelo teclado */}
          <div className="flex min-h-0 flex-col border-t lg:h-[34rem] lg:border-l lg:border-t-0">
            <h3 className="border-b px-4 py-3 text-sm font-semibold text-foreground">
              {region ? `Áreas mapeadas no ${regionFilter}` : "Áreas mapeadas"} ({visibleZones.length})
            </h3>
            {visibleZones.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Nenhuma área mapeada nesta região. Os dados cobrem as regiões com mais roubos de carga do país.
              </p>
            )}
            <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
              {visibleZones.map((zone) => {
                const selected = zone.id === selectedZone.id;
                return (
                  <li key={zone.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectZone(zone, true)}
                      className={cn(
                        "relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        selected &&
                          "bg-accent before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand",
                      )}
                    >
                      <span aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-full", toneDot[RISK[zone.riskLevel].tone])} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-data text-sm font-semibold text-foreground">{zone.state}</span>
                          <span className="text-xs text-muted-foreground">
                            {pctBR(zone.statistics.percentOfTotal)} do país · risco {RISK[zone.riskLevel].label.toLowerCase()}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-muted-foreground">{zone.region}</span>
                      </span>
                      <Trend value={zone.statistics.yearlyTrend} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Card>

      <div ref={detailRef} className="scroll-mt-24">
        <RiskZoneDetail key={selectedZone.id} zone={selectedZone} />
      </div>
    </Section>
  );
}
