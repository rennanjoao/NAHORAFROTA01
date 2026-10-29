import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Shield, AlertTriangle, TrendingUp, MapPin, ExternalLink, Info, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BRAZIL_ZONES, ALL_CITIES, getNeighborhoods } from "@/lib/driverUtils";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";

// Brazil center coordinates
const BRAZIL_CENTER: L.LatLngExpression = [-15.7801, -47.9292];

/**
 * DADOS ATUALIZADOS DE ROUBO DE CARGA NO BRASIL
 * Fontes: nstech Report 2024/2025, AAAPV, Buonny, ISTOÉ Dinheiro
 * 
 * Estatísticas Gerais 2024:
 * - Total de ocorrências: 10.478 casos
 * - Prejuízo estimado: R$ 1,2 bilhão
 * - Crescimento 2025 (1º semestre): +24,8% vs 2024
 * - Sudeste: 83% dos prejuízos totais
 * - SP: 45,8% das ocorrências | RJ: 25% (subiu de 18,9%)
 * - Horário crítico: Noturno (+14,3% em 2025)
 * - Dia crítico: Sexta-feira (23,2%)
 */

interface DangerousZone {
  name: string;
  type: string;
  risk: "extreme" | "high" | "moderate";
}

interface RiskZone {
  id: string;
  name: string;
  region: string;
  state: string;
  position: [number, number];
  radius: number;
  riskLevel: "critical" | "high" | "medium";
  cities: string[];
  dangerousZones: DangerousZone[];
  statistics: {
    percentOfTotal: number;
    yearlyTrend: number;
    monthlyOccurrences: number;
    mainTargets: string[];
  };
  description: string;
  recommendation: string;
  route: string;
  source: string;
}

// Dados baseados em relatórios oficiais nstech 2024/2025
const riskZones: RiskZone[] = [
  // CRÍTICO - Baseado em dados reais
  {
    id: "sp-metro",
    name: "Região Metropolitana de São Paulo",
    region: "Grande São Paulo",
    state: "SP",
    position: [-23.5505, -46.6333],
    radius: 35000,
    riskLevel: "critical",
    cities: [
      "São Paulo (Capital)",
      "Guarulhos",
      "Osasco",
      "Santo André",
      "São Bernardo do Campo",
      "Diadema",
      "Mauá",
      "Carapicuíba",
      "Itaquaquecetuba",
      "Barueri",
    ],
    dangerousZones: [
      { name: "Rodoanel Trecho Sul (SP-021)", type: "Rodovia", risk: "extreme" },
      { name: "Marginal Tietê (Ponte das Bandeiras)", type: "Via Urbana", risk: "extreme" },
      { name: "Marginal Pinheiros (Ceagesp)", type: "Via Urbana", risk: "extreme" },
      { name: "Anhanguera Km 15-30", type: "Rodovia", risk: "high" },
      { name: "Raposo Tavares (Cotia)", type: "Rodovia", risk: "high" },
      { name: "Fernão Dias Km 60-85", type: "Rodovia", risk: "high" },
      { name: "Dutra Km 220-235 (Guarulhos)", type: "Rodovia", risk: "extreme" },
      { name: "Régis Bittencourt (Embu)", type: "Rodovia", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 45.8,
      yearlyTrend: 12,
      monthlyOccurrences: 402,
      mainTargets: ["Eletrônicos", "Medicamentos", "Cigarros", "Cosméticos"],
    },
    description: "Maior concentração de roubos do país. 45,8% de todas as ocorrências nacionais.",
    recommendation: "Escolta armada obrigatória para cargas acima de R$100mil. Evitar Rodoanel Sul entre 22h-05h.",
    route: "Rodoanel (SP-021), Marginais, Anhanguera",
    source: "nstech Report Anual 2024",
  },
  {
    id: "rj-metro",
    name: "Região Metropolitana do Rio de Janeiro",
    region: "Grande Rio / Baixada Fluminense",
    state: "RJ",
    position: [-22.9068, -43.1729],
    radius: 30000,
    riskLevel: "critical",
    cities: [
      "Rio de Janeiro (Capital)",
      "Duque de Caxias",
      "Nova Iguaçu",
      "São João de Meriti",
      "Belford Roxo",
      "Nilópolis",
      "Mesquita",
      "Queimados",
      "Japeri",
      "Magé",
    ],
    dangerousZones: [
      { name: "Av. Brasil (Penha - Deodoro)", type: "Via Urbana", risk: "extreme" },
      { name: "Rodovia Presidente Dutra Km 165-190", type: "Rodovia", risk: "extreme" },
      { name: "Linha Vermelha (Caju - Vigário Geral)", type: "Via Urbana", risk: "extreme" },
      { name: "Arco Metropolitano (Duque de Caxias)", type: "Rodovia", risk: "high" },
      { name: "BR-040 (Saracuruna)", type: "Rodovia", risk: "high" },
      { name: "Washington Luís (São Cristóvão)", type: "Via Urbana", risk: "high" },
      { name: "Grajaú-Jacarepaguá", type: "Via Urbana", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 25.0,
      yearlyTrend: 32,
      monthlyOccurrences: 219,
      mainTargets: ["Eletrônicos", "Carga Fracionada", "Combustíveis"],
    },
    description: "Crescimento alarmante: +32% em 2024. Quadrilhas especializadas na Baixada Fluminense.",
    recommendation: "Evitar Av. Brasil e Dutra (Km 165-190) após 18h. Comboio mínimo de 3 veículos.",
    route: "Av. Brasil, Dutra (BR-116), Linha Vermelha",
    source: "nstech Report Anual 2024 / Planeta Caminhão",
  },
  {
    id: "br101-nordeste",
    name: "BR-101 - Trecho Nordeste",
    region: "Região Metropolitana de Recife",
    state: "PE",
    position: [-8.0476, -34.8770],
    radius: 20000,
    riskLevel: "critical",
    cities: [
      "Recife",
      "Jaboatão dos Guararapes",
      "Olinda",
      "Paulista",
      "Cabo de Santo Agostinho",
      "Camaragibe",
      "Igarassu",
      "Abreu e Lima",
    ],
    dangerousZones: [
      { name: "BR-101 Km 65-90 (Prazeres)", type: "Rodovia", risk: "extreme" },
      { name: "BR-232 (Entrada Recife)", type: "Rodovia", risk: "high" },
      { name: "PE-015 (Olinda - Paulista)", type: "Rodovia", risk: "high" },
      { name: "Complexo de Suape", type: "Área Portuária", risk: "moderate" },
      { name: "Av. Recife (Imbiribeira)", type: "Via Urbana", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 14.7,
      yearlyTrend: 5.5,
      monthlyOccurrences: 129,
      mainTargets: ["Alimentos", "Bebidas", "Eletrônicos"],
    },
    description: "BR-101 lidera prejuízos no 1º semestre 2025 (14,7%). Nordeste cresceu 5,5%.",
    recommendation: "Rastreamento ativo 24h. Check-in obrigatório a cada 30min. Não estacionar fora de postos homologados.",
    route: "BR-101 (PE/AL/SE/BA)",
    source: "AAAPV / nstech 2025",
  },
  // ALTO RISCO
  {
    id: "mg-rmbh",
    name: "Região Metropolitana de BH",
    region: "Contagem / Betim / Ribeirão das Neves",
    state: "MG",
    position: [-19.9167, -43.9345],
    radius: 22000,
    riskLevel: "high",
    cities: [
      "Belo Horizonte",
      "Contagem",
      "Betim",
      "Ribeirão das Neves",
      "Santa Luzia",
      "Ibirité",
      "Sabará",
      "Vespasiano",
    ],
    dangerousZones: [
      { name: "BR-381 Km 480-520 (Betim)", type: "Rodovia", risk: "extreme" },
      { name: "Anel Rodoviário (Barreiro)", type: "Rodovia", risk: "high" },
      { name: "BR-040 (Contagem)", type: "Rodovia", risk: "high" },
      { name: "MG-030 (Nova Lima)", type: "Rodovia", risk: "moderate" },
      { name: "Via Expressa (Venda Nova)", type: "Via Urbana", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 8.2,
      yearlyTrend: -5,
      monthlyOccurrences: 72,
      mainTargets: ["Siderúrgicos", "Autopeças", "Eletrônicos"],
    },
    description: "Terceiro estado em ocorrências. Quadrilhas especializadas em BR-381 (Fernão Dias).",
    recommendation: "Evitar paradas não programadas na BR-381. Utilizar apenas postos de rede.",
    route: "BR-381 (Fernão Dias), BR-040, MG-030",
    source: "nstech Report 2024",
  },
  {
    id: "pr-curitiba",
    name: "Região Metropolitana de Curitiba",
    region: "Curitiba / São José dos Pinhais",
    state: "PR",
    position: [-25.4290, -49.2671],
    radius: 18000,
    riskLevel: "high",
    cities: [
      "Curitiba",
      "São José dos Pinhais",
      "Colombo",
      "Araucária",
      "Pinhais",
      "Campo Largo",
      "Almirante Tamandaré",
    ],
    dangerousZones: [
      { name: "BR-116 Km 100-130 (Contorno Sul)", type: "Rodovia", risk: "high" },
      { name: "BR-376 (São José dos Pinhais)", type: "Rodovia", risk: "high" },
      { name: "Contorno Leste (Pinhais)", type: "Rodovia", risk: "moderate" },
      { name: "Linha Verde (CIC)", type: "Via Urbana", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 4.1,
      yearlyTrend: 8,
      monthlyOccurrences: 36,
      mainTargets: ["Grãos", "Autopeças", "Eletrônicos"],
    },
    description: "Principal ponto de risco do Sul. Furtos em áreas de descanso da BR-116.",
    recommendation: "Utilizar apenas postos de rede homologados. Monitoramento via satélite ativo.",
    route: "BR-116, BR-376, Contorno Leste",
    source: "nstech Report 2024",
  },
  {
    id: "rs-poa",
    name: "Região Metropolitana de Porto Alegre",
    region: "Porto Alegre / Canoas / Gravataí",
    state: "RS",
    position: [-30.0346, -51.2177],
    radius: 16000,
    riskLevel: "high",
    cities: [
      "Porto Alegre",
      "Canoas",
      "Gravataí",
      "Cachoeirinha",
      "Alvorada",
      "Viamão",
      "Novo Hamburgo",
      "São Leopoldo",
    ],
    dangerousZones: [
      { name: "BR-290 Freeway (Canoas - Osório)", type: "Rodovia", risk: "high" },
      { name: "BR-116 (Sapucaia - Esteio)", type: "Rodovia", risk: "high" },
      { name: "RS-118 (Gravataí)", type: "Rodovia", risk: "moderate" },
      { name: "Av. Assis Brasil (Sarandi)", type: "Via Urbana", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 3.8,
      yearlyTrend: 15,
      monthlyOccurrences: 33,
      mainTargets: ["Eletrônicos", "Medicamentos", "Calçados"],
    },
    description: "Roubos em congestionamentos na Freeway (BR-290). Aumento de 15% em 2024.",
    recommendation: "Evitar horários de pico (7h-9h e 17h-19h). Rastreamento por satélite obrigatório.",
    route: "BR-290 (Freeway), BR-116, RS-118",
    source: "nstech Report 2024",
  },
  // MÉDIO RISCO
  {
    id: "ba-feira",
    name: "Eixo Salvador-Feira de Santana",
    region: "Salvador / Feira de Santana",
    state: "BA",
    position: [-12.2547, -38.9567],
    radius: 15000,
    riskLevel: "medium",
    cities: [
      "Salvador",
      "Feira de Santana",
      "Camaçari",
      "Lauro de Freitas",
      "Simões Filho",
      "Candeias",
    ],
    dangerousZones: [
      { name: "BR-324 Km 580-620", type: "Rodovia", risk: "high" },
      { name: "BR-116 Norte (Feira)", type: "Rodovia", risk: "moderate" },
      { name: "CIA Aeroporto (Camaçari)", type: "Área Industrial", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 2.9,
      yearlyTrend: -8,
      monthlyOccurrences: 25,
      mainTargets: ["Alimentos", "Bebidas", "Combustíveis"],
    },
    description: "Ponto de intersecção de rotas Norte/Nordeste. Queda de 8% em 2024.",
    recommendation: "Manter rastreamento ativo. Comunicar desvios à central.",
    route: "BR-324, BR-116, BA-502",
    source: "nstech Report 2024",
  },
  {
    id: "go-goiania",
    name: "Região de Goiânia / Anápolis",
    region: "Goiânia / Anápolis / Aparecida",
    state: "GO",
    position: [-16.6869, -49.2648],
    radius: 18000,
    riskLevel: "medium",
    cities: [
      "Goiânia",
      "Anápolis",
      "Aparecida de Goiânia",
      "Senador Canedo",
      "Trindade",
      "Goianira",
    ],
    dangerousZones: [
      { name: "BR-153 (Goiânia - Anápolis)", type: "Rodovia", risk: "high" },
      { name: "BR-060 (Anápolis - Alexânia)", type: "Rodovia", risk: "moderate" },
      { name: "GO-070 (Goianira)", type: "Rodovia", risk: "moderate" },
      { name: "DAIA (Distrito Industrial)", type: "Área Industrial", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 2.1,
      yearlyTrend: 22,
      monthlyOccurrences: 18,
      mainTargets: ["Grãos", "Fertilizantes", "Máquinas Agrícolas"],
    },
    description: "Hub logístico do Centro-Oeste. Crescimento preocupante de 22% em 2024.",
    recommendation: "Atenção redobrada em trechos rurais. Escolta para máquinas agrícolas.",
    route: "BR-153, BR-060, GO-070",
    source: "nstech Report 2024",
  },
];

// Estatísticas nacionais consolidadas
const nationalStats = {
  totalOccurrences2024: 10478,
  estimatedLoss: "R$ 1,2 bilhão",
  growth2025: "+24,8%",
  sudeste: "83%",
  peakDay: "Sexta-feira (23,2%)",
  peakHour: "Noturno (+14,3%)",
  topTargets: ["Eletrônicos (32%)", "Medicamentos (18%)", "Alimentos (14%)", "Cigarros (12%)"],
};

const getRiskColor = (level: RiskZone["riskLevel"]) => {
  switch (level) {
    case "critical":
      return "#ef4444"; // red-500
    case "high":
      return "#f97316"; // orange-500
    case "medium":
      return "#eab308"; // yellow-500
  }
};

const getRiskLabel = (level: RiskZone["riskLevel"]) => {
  switch (level) {
    case "critical":
      return "CRÍTICO";
    case "high":
      return "ALTO";
    case "medium":
      return "MÉDIO";
  }
};

// Zone coordinates for filtering
const ZONE_COORDINATES: Record<string, { center: [number, number]; zoom: number }> = {
  Norte: { center: [-3.1190, -60.0217], zoom: 5 },
  Sul: { center: [-27.5954, -48.5480], zoom: 6 },
  Leste: { center: [-15.7801, -39.0000], zoom: 5 },
  Oeste: { center: [-15.5989, -56.0949], zoom: 5 },
  Centro: { center: [-15.7801, -47.9292], zoom: 6 },
};

const CITY_COORDINATES: Record<string, { center: [number, number]; zoom: number }> = {
  "São Paulo": { center: [-23.5505, -46.6333], zoom: 10 },
  "Rio de Janeiro": { center: [-22.9068, -43.1729], zoom: 10 },
  "Curitiba": { center: [-25.4290, -49.2671], zoom: 10 },
  "Porto Alegre": { center: [-30.0346, -51.2177], zoom: 10 },
  "Belo Horizonte": { center: [-19.9167, -43.9345], zoom: 10 },
  "Salvador": { center: [-12.9714, -38.5014], zoom: 10 },
  "Recife": { center: [-8.0476, -34.8770], zoom: 10 },
  "Fortaleza": { center: [-3.7172, -38.5433], zoom: 10 },
  "Goiânia": { center: [-16.6869, -49.2648], zoom: 10 },
  "Brasília": { center: [-15.7801, -47.9292], zoom: 10 },
  "Manaus": { center: [-3.1190, -60.0217], zoom: 10 },
  "Belém": { center: [-1.4558, -48.4902], zoom: 10 },
  "Florianópolis": { center: [-27.5954, -48.5480], zoom: 10 },
};

export function BrasilRiskMap() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [selectedZone, setSelectedZone] = useState<RiskZone | null>(null);
  
  // Filter states
  const [selectedZonaFilter, setSelectedZonaFilter] = useState<string>("all");
  const [selectedCidadeFilter, setSelectedCidadeFilter] = useState<string>("all");
  const [selectedBairroFilter, setSelectedBairroFilter] = useState<string>("all");
  
  // Get available cities based on selected zone
  const availableCities = selectedZonaFilter === "all" 
    ? ALL_CITIES 
    : BRAZIL_ZONES[selectedZonaFilter as keyof typeof BRAZIL_ZONES] || [];
  
  // Get available neighborhoods based on selected city
  const availableNeighborhoods = selectedCidadeFilter === "all"
    ? []
    : getNeighborhoods(selectedCidadeFilter);
  
  // Handle zone filter change
  const handleZonaChange = (value: string) => {
    setSelectedZonaFilter(value);
    setSelectedCidadeFilter("all");
    setSelectedBairroFilter("all");
    
    if (value !== "all" && mapRef.current && ZONE_COORDINATES[value]) {
      const { center, zoom } = ZONE_COORDINATES[value];
      mapRef.current.flyTo(center, zoom, { duration: 1.5 });
    } else if (value === "all" && mapRef.current) {
      mapRef.current.flyTo(BRAZIL_CENTER, 4, { duration: 1.5 });
    }
  };
  
  // Handle city filter change
  const handleCidadeChange = (value: string) => {
    setSelectedCidadeFilter(value);
    setSelectedBairroFilter("all");
    
    if (value !== "all" && mapRef.current && CITY_COORDINATES[value]) {
      const { center, zoom } = CITY_COORDINATES[value];
      mapRef.current.flyTo(center, zoom, { duration: 1.5 });
    } else if (value === "all" && selectedZonaFilter !== "all" && mapRef.current) {
      const { center, zoom } = ZONE_COORDINATES[selectedZonaFilter];
      mapRef.current.flyTo(center, zoom, { duration: 1.5 });
    }
  };
  
  // Handle neighborhood filter change
  const handleBairroChange = (value: string) => {
    setSelectedBairroFilter(value);
    
    // Zoom in more for neighborhood level
    if (value !== "all" && mapRef.current && selectedCidadeFilter !== "all") {
      const cityCoords = CITY_COORDINATES[selectedCidadeFilter];
      if (cityCoords) {
        // Slightly offset and zoom in more for neighborhood simulation
        mapRef.current.flyTo(cityCoords.center, 12, { duration: 1.5 });
      }
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize the map centered on Brazil
    const map = L.map(mapContainerRef.current, {
      center: BRAZIL_CENTER,
      zoom: 4,
      scrollWheelZoom: true,
      minZoom: 3,
      maxZoom: 10,
    });

    mapRef.current = map;

    // Add CartoDB Dark Matter tile layer for dramatic effect
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Add risk zone circles (heatmap effect)
    riskZones.forEach((zone) => {
      const color = getRiskColor(zone.riskLevel);
      
      // Outer glow circle
      L.circle(zone.position, {
        radius: zone.radius * 1.4,
        fillColor: color,
        fillOpacity: 0.08,
        stroke: false,
      }).addTo(map);

      // Main circle
      const circle = L.circle(zone.position, {
        radius: zone.radius,
        fillColor: color,
        fillOpacity: 0.25,
        color: color,
        weight: 2,
        opacity: 0.6,
      }).addTo(map);

      // Inner core (more intense)
      L.circle(zone.position, {
        radius: zone.radius * 0.35,
        fillColor: color,
        fillOpacity: 0.45,
        stroke: false,
      }).addTo(map);

      // Popup with security alert
      const trendIcon = zone.statistics.yearlyTrend > 0 ? "📈" : "📉";
      const trendColor = zone.statistics.yearlyTrend > 0 ? "#ef4444" : "#22c55e";
      
      const getDangerZoneColor = (risk: "extreme" | "high" | "moderate") => {
        switch (risk) {
          case "extreme": return "#ef4444";
          case "high": return "#f97316";
          case "moderate": return "#eab308";
        }
      };

      const getDangerZoneLabel = (risk: "extreme" | "high" | "moderate") => {
        switch (risk) {
          case "extreme": return "EXTREMO";
          case "high": return "ALTO";
          case "moderate": return "MODERADO";
        }
      };
      
      const popupContent = `
        <div style="padding: 14px; min-width: 380px; max-width: 420px; font-family: 'Inter', sans-serif; color: #f8fafc; max-height: 500px; overflow-y: auto;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #374151;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: ${color}20; display: flex; align-items: center; justify-content: center;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <path d="M12 9v4"/>
                <path d="M12 17h.01"/>
              </svg>
            </div>
            <div>
              <h4 style="font-weight: 700; font-size: 15px; margin: 0; color: ${color};">
                ${zone.state} - ${getRiskLabel(zone.riskLevel)}
              </h4>
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                ${zone.name}
              </p>
            </div>
          </div>

          <div>
            <!-- Estatísticas -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
              <div style="padding: 10px; background: #1e293b; border-radius: 8px;">
                <p style="font-size: 10px; color: #6b7280; margin: 0; text-transform: uppercase;">% do Total</p>
                <p style="font-size: 20px; font-weight: 700; color: ${color}; margin: 4px 0 0 0;">${zone.statistics.percentOfTotal}%</p>
              </div>
              <div style="padding: 10px; background: #1e293b; border-radius: 8px;">
                <p style="font-size: 10px; color: #6b7280; margin: 0; text-transform: uppercase;">Tendência</p>
                <p style="font-size: 20px; font-weight: 700; color: ${trendColor}; margin: 4px 0 0 0;">
                  ${trendIcon} ${zone.statistics.yearlyTrend > 0 ? '+' : ''}${zone.statistics.yearlyTrend}%
                </p>
              </div>
            </div>

            <!-- Cidades Afetadas -->
            <div style="margin-bottom: 14px;">
              <p style="font-size: 10px; color: #6b7280; margin: 0 0 8px 0; text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
                🏙️ Cidades Afetadas (${zone.cities.length})
              </p>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                ${zone.cities.map(c => `<span style="font-size: 10px; padding: 3px 8px; background: #334155; border-radius: 4px; white-space: nowrap;">${c}</span>`).join('')}
              </div>
            </div>

            <!-- Zonas Perigosas -->
            <div style="margin-bottom: 14px;">
              <p style="font-size: 10px; color: #ef4444; margin: 0 0 8px 0; text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
                ⚠️ Zonas de Maior Risco (${zone.dangerousZones.length})
              </p>
              <div style="space-y: 6px;">
                ${zone.dangerousZones.map(dz => `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #1e293b; border-radius: 6px; border-left: 3px solid ${getDangerZoneColor(dz.risk)}; margin-bottom: 6px;">
                    <div>
                      <p style="font-size: 11px; font-weight: 600; margin: 0; color: #f8fafc;">${dz.name}</p>
                      <p style="font-size: 10px; color: #9ca3af; margin: 2px 0 0 0;">${dz.type}</p>
                    </div>
                    <span style="font-size: 9px; padding: 2px 6px; background: ${getDangerZoneColor(dz.risk)}20; color: ${getDangerZoneColor(dz.risk)}; border-radius: 4px; font-weight: 600;">
                      ${getDangerZoneLabel(dz.risk)}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Principais Alvos -->
            <div style="margin-bottom: 12px;">
              <p style="font-size: 10px; color: #6b7280; margin: 0 0 6px 0; text-transform: uppercase;">🎯 Principais Alvos</p>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                ${zone.statistics.mainTargets.map(t => `<span style="font-size: 10px; padding: 3px 8px; background: #7c3aed20; color: #a78bfa; border-radius: 4px;">${t}</span>`).join('')}
              </div>
            </div>

            <!-- Recomendação -->
            <div style="padding: 12px; background: #f59e0b15; border-radius: 8px; border: 1px solid #f59e0b30; margin-bottom: 10px;">
              <p style="font-size: 10px; color: #f59e0b; margin: 0 0 4px 0; text-transform: uppercase;">📋 Recomendação de Segurança</p>
              <p style="font-size: 11px; font-weight: 500; color: #f8fafc; margin: 0; line-height: 1.4;">${zone.recommendation}</p>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <p style="font-size: 10px; color: #6b7280; margin: 0;">Fonte: ${zone.source}</p>
              <span style="font-size: 10px; color: #6b7280;">${zone.statistics.monthlyOccurrences} ocorrências/mês</span>
            </div>
          </div>
        </div>
      `;

      circle.bindPopup(popupContent, {
        maxWidth: 360,
        className: 'risk-popup dark-popup',
      });
    });

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const criticalCount = riskZones.filter(z => z.riskLevel === "critical").length;
  const highCount = riskZones.filter(z => z.riskLevel === "high").length;
  const mediumCount = riskZones.filter(z => z.riskLevel === "medium").length;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 p-4 md:p-6 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-destructive/10">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Mapa de Risco Brasil - Roubo de Carga</h3>
              <p className="text-sm text-muted-foreground">
                Dados consolidados de 2024/2025 • Fontes: nstech, AAAPV, Buonny
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1.5">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              {criticalCount} Críticos
            </Badge>
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              {highCount} Alto Risco
            </Badge>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              {mediumCount} Médio
            </Badge>
          </div>
        </div>
        
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filtros:</span>
          </div>
          
          {/* Zona Filter */}
          <Select value={selectedZonaFilter} onValueChange={handleZonaChange}>
            <SelectTrigger className="w-[140px] h-9 bg-background">
              <SelectValue placeholder="Zona" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todas as Zonas</SelectItem>
              {Object.keys(BRAZIL_ZONES).map((zona) => (
                <SelectItem key={zona} value={zona}>{zona}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Cidade Filter */}
          <Select value={selectedCidadeFilter} onValueChange={handleCidadeChange}>
            <SelectTrigger className="w-[160px] h-9 bg-background">
              <SelectValue placeholder="Cidade" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todas as Cidades</SelectItem>
              {availableCities.map((cidade) => (
                <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Bairro Filter */}
          <Select 
            value={selectedBairroFilter} 
            onValueChange={handleBairroChange}
            disabled={selectedCidadeFilter === "all"}
          >
            <SelectTrigger className="w-[160px] h-9 bg-background">
              <SelectValue placeholder={selectedCidadeFilter === "all" ? "Selecione cidade" : "Bairro"} />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todos os Bairros</SelectItem>
              {availableNeighborhoods.map((bairro) => (
                <SelectItem key={bairro} value={bairro}>{bairro}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Reset Button */}
          {(selectedZonaFilter !== "all" || selectedCidadeFilter !== "all") && (
            <button
              onClick={() => {
                setSelectedZonaFilter("all");
                setSelectedCidadeFilter("all");
                setSelectedBairroFilter("all");
                if (mapRef.current) {
                  mapRef.current.flyTo(BRAZIL_CENTER, 4, { duration: 1.5 });
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Map */}
        <div className="lg:col-span-2 relative">
          <div 
            ref={mapContainerRef} 
            className="h-[450px] md:h-[550px] w-full"
            style={{ background: "#0f172a" }}
          />
          
          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-border shadow-lg">
            <p className="text-xs font-medium text-muted-foreground mb-2">Legenda</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-xs">Crítico (&gt;10% nacional)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-xs">Alto (3-10%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-xs">Médio (&lt;3%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Sidebar */}
        <div className="border-t lg:border-t-0 lg:border-l border-border bg-muted/30">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Estatísticas Nacionais 2024</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-background rounded-lg">
                <p className="text-xs text-muted-foreground">Total de Ocorrências</p>
                <p className="text-xl font-bold text-destructive">{nationalStats.totalOccurrences2024.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-background rounded-lg">
                <p className="text-xs text-muted-foreground">Prejuízo Estimado</p>
                <p className="text-xl font-bold">{nationalStats.estimatedLoss}</p>
              </div>
              <div className="p-3 bg-background rounded-lg">
                <p className="text-xs text-muted-foreground">Crescimento 2025</p>
                <p className="text-xl font-bold text-destructive">{nationalStats.growth2025}</p>
              </div>
              <div className="p-3 bg-background rounded-lg">
                <p className="text-xs text-muted-foreground">Sudeste</p>
                <p className="text-xl font-bold">{nationalStats.sudeste}</p>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h4 className="font-semibold text-sm">Padrões de Risco</h4>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-background rounded-lg">
                <span className="text-xs text-muted-foreground">Dia Crítico</span>
                <span className="text-sm font-medium">{nationalStats.peakDay}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-background rounded-lg">
                <span className="text-xs text-muted-foreground">Horário Crítico</span>
                <span className="text-sm font-medium">{nationalStats.peakHour}</span>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Zonas Mapeadas</h4>
            </div>
            <ScrollArea className="h-[200px] pr-2">
              <div className="space-y-2">
                {riskZones.map((zone) => (
                  <div
                    key={zone.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
                      zone.riskLevel === "critical" ? "bg-destructive/5 border-destructive/20" :
                      zone.riskLevel === "high" ? "bg-orange-500/5 border-orange-500/20" :
                      "bg-yellow-500/5 border-yellow-500/20"
                    )}
                    onClick={() => {
                      if (mapRef.current) {
                        mapRef.current.setView(zone.position, 8, { animate: true });
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getRiskColor(zone.riskLevel) }}
                          />
                          <span className="text-xs font-semibold truncate">{zone.state}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {zone.statistics.percentOfTotal}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{zone.region}</p>
                      </div>
                      <span 
                        className={cn(
                          "text-xs font-medium",
                          zone.statistics.yearlyTrend > 0 ? "text-destructive" : "text-success"
                        )}
                      >
                        {zone.statistics.yearlyTrend > 0 ? "↑" : "↓"}{Math.abs(zone.statistics.yearlyTrend)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Sources */}
          <div className="p-4 border-t border-border">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <p>
                Dados baseados em relatórios nstech 2024/2025, AAAPV, Buonny e ISTOÉ Dinheiro. 
                Clique nas zonas do mapa para detalhes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
