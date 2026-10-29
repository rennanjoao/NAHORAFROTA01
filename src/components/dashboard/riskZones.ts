/**
 * Zonas de risco de roubo de carga no Brasil (dados de relatorios publicos).
 * So dados: o mapa e a tela ficam em BrasilRiskMap.tsx.
 */

/** Centro do Brasil. */
export const BRAZIL_CENTER: [number, number] = [-15.7801, -47.9292];

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
export const riskZones: RiskZone[] = [
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
      { name: "Marginal Tietê (Ponte das Bandeiras)", type: "Via urbana", risk: "extreme" },
      { name: "Marginal Pinheiros (Ceagesp)", type: "Via urbana", risk: "extreme" },
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
    recommendation: "Escolta armada obrigatória para cargas acima de R$ 100 mil. Evitar o Rodoanel Sul entre 22h e 5h.",
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
      { name: "Av. Brasil (Penha - Deodoro)", type: "Via urbana", risk: "extreme" },
      { name: "Rodovia Presidente Dutra Km 165-190", type: "Rodovia", risk: "extreme" },
      { name: "Linha Vermelha (Caju - Vigário Geral)", type: "Via urbana", risk: "extreme" },
      { name: "Arco Metropolitano (Duque de Caxias)", type: "Rodovia", risk: "high" },
      { name: "BR-040 (Saracuruna)", type: "Rodovia", risk: "high" },
      { name: "Washington Luís (São Cristóvão)", type: "Via urbana", risk: "high" },
      { name: "Grajaú-Jacarepaguá", type: "Via urbana", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 25.0,
      yearlyTrend: 32,
      monthlyOccurrences: 219,
      mainTargets: ["Eletrônicos", "Carga fracionada", "Combustíveis"],
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
      { name: "Complexo de Suape", type: "Área portuária", risk: "moderate" },
      { name: "Av. Recife (Imbiribeira)", type: "Via urbana", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 14.7,
      yearlyTrend: 5.5,
      monthlyOccurrences: 129,
      mainTargets: ["Alimentos", "Bebidas", "Eletrônicos"],
    },
    description: "A BR-101 lidera os prejuízos no 1º semestre de 2025 (14,7%). O Nordeste cresceu 5,5%.",
    recommendation: "Rastreamento ativo 24 horas. Avisar a central a cada 30 minutos. Não estacionar fora de postos homologados.",
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
      { name: "Via Expressa (Venda Nova)", type: "Via urbana", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 8.2,
      yearlyTrend: -5,
      monthlyOccurrences: 72,
      mainTargets: ["Siderúrgicos", "Autopeças", "Eletrônicos"],
    },
    description: "Terceiro estado em ocorrências. Quadrilhas especializadas na BR-381 (Fernão Dias).",
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
      { name: "Linha Verde (CIC)", type: "Via urbana", risk: "moderate" },
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
      { name: "Av. Assis Brasil (Sarandi)", type: "Via urbana", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 3.8,
      yearlyTrend: 15,
      monthlyOccurrences: 33,
      mainTargets: ["Eletrônicos", "Medicamentos", "Calçados"],
    },
    description: "Roubos em congestionamentos na Freeway (BR-290). Aumento de 15% em 2024.",
    recommendation: "Evitar os horários de pico (7h às 9h e 17h às 19h). Rastreamento por satélite obrigatório.",
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
      { name: "CIA Aeroporto (Camaçari)", type: "Área industrial", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 2.9,
      yearlyTrend: -8,
      monthlyOccurrences: 25,
      mainTargets: ["Alimentos", "Bebidas", "Combustíveis"],
    },
    description: "Cruzamento das rotas para o Norte e o Nordeste. Queda de 8% em 2024.",
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
      { name: "DAIA (Distrito Industrial)", type: "Área industrial", risk: "moderate" },
    ],
    statistics: {
      percentOfTotal: 2.1,
      yearlyTrend: 22,
      monthlyOccurrences: 18,
      mainTargets: ["Grãos", "Fertilizantes", "Máquinas agrícolas"],
    },
    description: "Hub logístico do Centro-Oeste. Crescimento preocupante de 22% em 2024.",
    recommendation: "Atenção redobrada em trechos rurais. Escolta para máquinas agrícolas.",
    route: "BR-153, BR-060, GO-070",
    source: "nstech Report 2024",
  },
];

// Estatisticas nacionais consolidadas
export const nationalStats = {
  totalOccurrences2024: 10478,
  estimatedLoss: "R$ 1,2 bilhão",
  growth2025: "+24,8%",
  sudeste: "83%",
  peakDay: "Sexta-feira (23,2%)",
  peakHour: "Noturno (+14,3%)",
  topTargets: ["Eletrônicos (32%)", "Medicamentos (18%)", "Alimentos (14%)", "Cigarros (12%)"],
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
