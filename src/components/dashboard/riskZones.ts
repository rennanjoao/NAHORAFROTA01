/**
 * Zonas de risco de roubo de carga no Brasil (dados de relatorios publicos).
 * So dados: o mapa e a tela ficam em BrasilRiskMap.tsx.
 */
import { cargoTheft, riskLevelForShare } from "@/lib/riskStats";

/** Centro do Brasil. */
export const BRAZIL_CENTER: [number, number] = [-15.7801, -47.9292];

/*
 * Numeros por estado: base oficial Sinesp VDE (Ministerio da Justica), em
 * src/data/roubo-de-carga.json (atualizar com scripts/risk-data/atualizar.py). A parte do
 * pais, a variacao e a media mensal saem dela; o nivel de risco segue a legenda do mapa.
 * Trechos criticos, cargas visadas e horarios vem dos relatorios citados em cada regiao.
 */

export interface DangerousZone {
  name: string;
  type: string;
  risk: "extreme" | "high" | "moderate";
}

export interface RiskZone {
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
    /** Parte dos roubos de carga do pais no periodo (estado). */
    percentOfTotal: number;
    /** Variacao (%) sobre o mesmo periodo do ano anterior. */
    yearlyTrend: number;
    /** Media de casos por mes no periodo (estado). */
    monthlyOccurrences: number;
    mainTargets: string[];
  };
  description: string;
  recommendation: string;
  route: string;
  source: string;
}

type ZoneInfo = Omit<RiskZone, "riskLevel" | "statistics"> & { mainTargets: string[] };

const SINESP = `Sinesp/MJSP (até ${cargoTheft.latestMonthLabel})`;

const ZONES: ZoneInfo[] = [
  {
    id: "rj-metro",
    name: "Região Metropolitana do Rio de Janeiro",
    region: "Grande Rio / Baixada Fluminense",
    state: "RJ",
    position: [-22.8, -43.3],
    radius: 30000,
    cities: ["Rio de Janeiro (Capital)", "Duque de Caxias", "São Gonçalo", "São João de Meriti", "Nova Iguaçu", "Belford Roxo", "Niterói", "Magé"],
    dangerousZones: [
      { name: "Av. Brasil (BR-101)", type: "Via urbana", risk: "extreme" },
      { name: "Rod. Washington Luís (BR-040), Duque de Caxias", type: "Rodovia", risk: "extreme" },
      { name: "Via Dutra (BR-116), Baixada Fluminense", type: "Rodovia", risk: "high" },
      { name: "Duque de Caxias: 411 casos de jan a set/2026", type: "Município", risk: "extreme" },
      { name: "São Gonçalo: 206 casos de jan a set/2026", type: "Município", risk: "high" },
      { name: "São João de Meriti: 181 casos de jan a set/2026", type: "Município", risk: "high" },
    ],
    mainTargets: ["Carga fracionada", "Alimentos", "Medicamentos", "Cigarros"],
    description: "Em 2026 o Rio passou a liderar o roubo de carga no país. Mais da metade dos casos do estado fica em poucas delegacias da capital e da Baixada; a capital teve 1.085 casos de janeiro a setembro.",
    recommendation: "Evitar Av. Brasil, Washington Luís e Dutra de madrugada e no fim da tarde. Rastreamento ativo e paradas só em pontos combinados.",
    route: "Av. Brasil (BR-101), Washington Luís (BR-040), Dutra (BR-116)",
    source: `${SINESP}; ISP-RJ (municípios, jan–set/2026); Firjan 2026 (corredores)`,
  },
  {
    id: "sp-metro",
    name: "Região Metropolitana de São Paulo",
    region: "Capital e Grande São Paulo",
    state: "SP",
    position: [-23.5505, -46.6333],
    radius: 35000,
    cities: ["São Paulo (Capital)", "Guarulhos", "Osasco", "São Bernardo do Campo", "Santo André", "Cajamar", "Barueri", "Diadema"],
    dangerousZones: [
      { name: "Capital: 905 casos de jan a set/2026", type: "Município", risk: "extreme" },
      { name: "Grande São Paulo: 604 casos de jan a set/2026", type: "Região", risk: "extreme" },
      { name: "Cajamar (Anhanguera e Bandeirantes)", type: "Rodovia", risk: "high" },
      { name: "São Bernardo do Campo (Anchieta e Rodoanel)", type: "Rodovia", risk: "high" },
      { name: "Miracatu (Régis Bittencourt, BR-116)", type: "Rodovia", risk: "moderate" },
      { name: "Santos (acesso ao porto)", type: "Área portuária", risk: "moderate" },
    ],
    mainTargets: ["Alimentos", "Carga fracionada", "Medicamentos", "Eletrônicos"],
    description: "Segundo estado do país, com queda forte desde 2025. A capital concentra a maior parte dos casos (62% dos roubos de SP em 2025); fora dela, Grande SP, Campinas e Baixada Santista.",
    recommendation: "Cargas de alto valor com rastreamento e janela de entrega curta. Evitar paradas em vias urbanas da capital e no Rodoanel à noite.",
    route: "Marginais, Rodoanel, Anhanguera, Bandeirantes, Régis Bittencourt",
    source: `${SINESP}; SSP-SP (regiões, jan–set/2026); SETCESP 2025; nstech 1º sem. 2026`,
  },
  {
    id: "br101-nordeste",
    name: "BR-101 - Trecho Nordeste",
    region: "Região Metropolitana de Recife",
    state: "PE",
    position: [-8.0476, -34.877],
    radius: 20000,
    cities: ["Recife", "Jaboatão dos Guararapes", "Olinda", "Paulista", "Cabo de Santo Agostinho", "Igarassu", "Abreu e Lima"],
    dangerousZones: [
      { name: "BR-101 (Prazeres a Igarassu)", type: "Rodovia", risk: "extreme" },
      { name: "BR-232 (entrada do Recife)", type: "Rodovia", risk: "high" },
      { name: "BR-316 (sertão)", type: "Rodovia", risk: "moderate" },
      { name: "Complexo de Suape", type: "Área portuária", risk: "moderate" },
    ],
    mainTargets: ["Alimentos", "Bebidas", "Carga fracionada"],
    description: "Pernambuco lidera o Nordeste. A BR-101 é a rodovia mais perigosa da região: 30,8% dos roubos de carga do Nordeste em 2025.",
    recommendation: "Rastreamento ativo 24 horas e aviso à central a cada 30 minutos. Não estacionar fora de postos homologados.",
    route: "BR-101 (PE/AL/SE/BA), BR-232, BR-316",
    source: `${SINESP}; NTC&Logística 2025`,
  },
  {
    id: "ba-feira",
    name: "Eixo Salvador-Feira de Santana",
    region: "Salvador / Feira de Santana",
    state: "BA",
    position: [-12.2547, -38.9567],
    radius: 15000,
    cities: ["Salvador", "Feira de Santana", "Camaçari", "Lauro de Freitas", "Simões Filho", "Candeias"],
    dangerousZones: [
      { name: "BR-324 (Salvador - Feira)", type: "Rodovia", risk: "high" },
      { name: "BR-116 Norte (Feira de Santana)", type: "Rodovia", risk: "high" },
      { name: "BR-101 (sul da Bahia)", type: "Rodovia", risk: "moderate" },
    ],
    mainTargets: ["Alimentos", "Bebidas", "Combustíveis"],
    description: "Cruzamento das rotas para o Norte e o Nordeste. A Bahia subiu 14% em 2025 e voltou a cair em 2026.",
    recommendation: "Manter rastreamento ativo e comunicar desvios à central.",
    route: "BR-324, BR-116, BR-101",
    source: `${SINESP}; nstech 2025`,
  },
  {
    id: "mg-rmbh",
    name: "Região Metropolitana de BH",
    region: "Contagem / Betim / Ribeirão das Neves",
    state: "MG",
    position: [-19.9167, -43.9345],
    radius: 22000,
    cities: ["Belo Horizonte", "Contagem", "Betim", "Ribeirão das Neves", "Santa Luzia", "Sabará"],
    dangerousZones: [
      { name: "BR-381 (Fernão Dias): 36% dos casos de MG em 2025", type: "Rodovia", risk: "extreme" },
      { name: "BR-040 (Contagem a Sete Lagoas): 14,6%", type: "Rodovia", risk: "high" },
      { name: "BR-452 (Triângulo Mineiro): 18,3%", type: "Rodovia", risk: "high" },
      { name: "BR-153 (Triângulo Mineiro): 11,7%", type: "Rodovia", risk: "moderate" },
    ],
    mainTargets: ["Alimentos", "Autopeças", "Siderúrgicos"],
    description: "Casos em queda desde 2025. Quatro rodovias federais somam mais de 80% dos roubos do estado, com a BR-381 à frente.",
    recommendation: "Evitar paradas não programadas na BR-381 e usar só postos de rede.",
    route: "BR-381 (Fernão Dias), BR-040, BR-452, BR-153",
    source: `${SINESP}; nstech 2025 (rodovias)`,
  },
  {
    id: "pr-curitiba",
    name: "Região Metropolitana de Curitiba",
    region: "Curitiba / São José dos Pinhais",
    state: "PR",
    position: [-25.429, -49.2671],
    radius: 18000,
    cities: ["Curitiba", "São José dos Pinhais", "Colombo", "Araucária", "Pinhais", "Campo Largo"],
    dangerousZones: [
      { name: "BR-116 (Régis Bittencourt)", type: "Rodovia", risk: "high" },
      { name: "BR-376 (São José dos Pinhais)", type: "Rodovia", risk: "moderate" },
      { name: "Contorno Leste (Pinhais)", type: "Rodovia", risk: "moderate" },
    ],
    mainTargets: ["Grãos", "Autopeças", "Eletrônicos"],
    description: "Queda forte em 2025 e 2026. Uma quadrilha presa em 2026 fez cerca de 20 roubos na BR-116 (Régis Bittencourt) em um ano.",
    recommendation: "Usar só postos de rede homologados e manter o rastreamento por satélite ligado.",
    route: "BR-116, BR-376, Contorno Leste",
    source: `${SINESP}; imprensa (Band, ago/2026)`,
  },
  {
    id: "rs-poa",
    name: "Região Metropolitana de Porto Alegre",
    region: "Porto Alegre / Canoas / Gravataí",
    state: "RS",
    position: [-30.0346, -51.2177],
    radius: 16000,
    cities: ["Porto Alegre", "Canoas", "Gravataí", "Cachoeirinha", "Novo Hamburgo", "São Leopoldo"],
    dangerousZones: [
      { name: "BR-290 Freeway (Canoas - Osório)", type: "Rodovia", risk: "moderate" },
      { name: "BR-116 (Sapucaia - Esteio)", type: "Rodovia", risk: "moderate" },
    ],
    mainTargets: ["Eletrônicos", "Medicamentos", "Calçados"],
    description: "Poucos casos no estado; os roubos se concentram em congestionamentos da Freeway e da BR-116.",
    recommendation: "Evitar os horários de pico (7h às 9h e 17h às 19h) nas rodovias da região metropolitana.",
    route: "BR-290 (Freeway), BR-116",
    source: SINESP,
  },
  {
    id: "go-goiania",
    name: "Região de Goiânia / Anápolis",
    region: "Goiânia / Anápolis / Aparecida",
    state: "GO",
    position: [-16.6869, -49.2648],
    radius: 18000,
    cities: ["Goiânia", "Anápolis", "Aparecida de Goiânia", "Senador Canedo", "Trindade"],
    dangerousZones: [
      { name: "BR-153 (Goiânia - Anápolis)", type: "Rodovia", risk: "moderate" },
      { name: "BR-060 (Anápolis - Alexânia)", type: "Rodovia", risk: "moderate" },
    ],
    mainTargets: ["Grãos", "Fertilizantes", "Máquinas agrícolas"],
    description: "Hub logístico do Centro-Oeste com poucos casos registrados. Atenção em trechos rurais com carga agrícola.",
    recommendation: "Atenção redobrada em trechos rurais. Escolta para máquinas agrícolas.",
    route: "BR-153, BR-060",
    source: SINESP,
  },
];

export const riskZones: RiskZone[] = ZONES.map(({ mainTargets, ...zone }) => {
  const state = cargoTheft.states.find((s) => s.uf === zone.state);
  const share = state?.share ?? 0;
  return {
    ...zone,
    riskLevel: riskLevelForShare(share),
    statistics: {
      percentOfTotal: share,
      yearlyTrend: state?.change ?? 0,
      monthlyOccurrences: state?.monthlyAverage ?? 0,
      mainTargets,
    },
  };
}).sort((a, b) => b.statistics.percentOfTotal - a.statistics.percentOfTotal);

/** Fora dos numeros do Sinesp: relatorios citados (periodo de cada um no texto). */
export const nationalStats = {
  loss2025: "R$ 900 mi",
  loss2025Hint: "Prejuízo direto em 2025; passa de R$ 1 bi com os custos indiretos (NTC&Logística)",
  sudeste: "77,2%",
  sudesteHint: "Do prejuízo no 1º semestre de 2026 (nstech)",
  peakDay: "Quinta-feira (22%)",
  peakHour: "Madrugada (32,9%)",
  topTargets: ["Carga fracionada (36,6%)", "Alimentos (24,6%)", "Medicamentos (19%)", "Cigarros (6,3%)"],
};

/**
 * Regioes do Brasil (IBGE) do filtro do mapa: centro, zoom, estados (filtram a
 * lista de areas mapeadas) e cidades que o mapa sabe localizar. Antes eram
 * "Norte, Sul, Leste, Oeste, Centro", que nao existem como regioes do pais.
 */
export const BRAZIL_REGIONS: Record<string, { center: [number, number]; zoom: number; states: string[]; cities: string[] }> = {
  Norte: { center: [-3.5, -60.0], zoom: 5, states: ["AC", "AM", "AP", "PA", "RO", "RR", "TO"], cities: ["Belém", "Manaus"] },
  Nordeste: {
    center: [-8.5, -39.5],
    zoom: 5,
    states: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
    cities: ["Fortaleza", "Recife", "Salvador"],
  },
  "Centro-Oeste": { center: [-15.8, -52.5], zoom: 5, states: ["DF", "GO", "MS", "MT"], cities: ["Brasília", "Goiânia"] },
  Sudeste: { center: [-20.8, -45.5], zoom: 6, states: ["ES", "MG", "RJ", "SP"], cities: ["Belo Horizonte", "Rio de Janeiro", "São Paulo"] },
  Sul: { center: [-27.3, -51.0], zoom: 6, states: ["PR", "RS", "SC"], cities: ["Curitiba", "Florianópolis", "Porto Alegre"] },
};

export const CITY_COORDINATES: Record<string, { center: [number, number]; zoom: number }> = {
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
