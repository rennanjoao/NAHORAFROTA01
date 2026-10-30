import raw from "@/data/roubo-de-carga.json";

/*
 * Numeros de roubo de carga da tela "Areas de risco", calculados da base oficial
 * (Sinesp VDE, Ministerio da Justica). O arquivo src/data/roubo-de-carga.json e gerado
 * por scripts/risk-data/atualizar.py; aqui so fazemos as contas.
 */
export interface CargoTheftData {
  source: string;
  sourceUrl: string;
  updatedAt: string;
  /** Ultimo mes com dados ("2026-09"). */
  latestMonth: string;
  /** Ocorrencias por estado, ano e mes (indice 0 = janeiro). */
  byState: Record<string, Record<string, number[]>>;
}

export interface StateTheftStats {
  uf: string;
  /** Casos no ano atual ate o ultimo mes com dados. */
  ytd: number;
  /** Mesmo periodo do ano anterior. */
  previousYtd: number;
  /** Variacao (%) sobre o mesmo periodo do ano anterior; null sem base. */
  change: number | null;
  /** Parte dos casos do pais no periodo (%). */
  share: number;
  monthlyAverage: number;
  /** Ano anterior inteiro. */
  lastYear: number;
}

export interface TheftSummary {
  year: number;
  months: number;
  /** "jan a set/2026" */
  periodLabel: string;
  latestMonthLabel: string;
  nationalYtd: number;
  nationalPreviousYtd: number;
  nationalChange: number | null;
  lastYear: number;
  lastYearTotal: number;
  /** Ano anterior inteiro contra o retrasado. */
  lastYearChange: number | null;
  states: StateTheftStats[];
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const sum = (values: number[] = []) => values.reduce((total, value) => total + value, 0);
const change = (current: number, previous: number) => (previous > 0 ? ((current - previous) / previous) * 100 : null);
const round1 = (value: number) => Math.round(value * 10) / 10;

export function summarizeTheft(data: CargoTheftData): TheftSummary {
  const year = Number(data.latestMonth.slice(0, 4));
  const months = Number(data.latestMonth.slice(5, 7));
  const states = Object.entries(data.byState).map(([uf, years]) => {
    const ytd = sum(years[year]?.slice(0, months));
    const previousYtd = sum(years[year - 1]?.slice(0, months));
    return { uf, ytd, previousYtd, lastYear: sum(years[year - 1]), twoYearsAgo: sum(years[year - 2]) };
  });
  const nationalYtd = sum(states.map((s) => s.ytd));
  const nationalPreviousYtd = sum(states.map((s) => s.previousYtd));
  const lastYearTotal = sum(states.map((s) => s.lastYear));
  const twoYearsAgoTotal = sum(states.map((s) => s.twoYearsAgo));
  const roundChange = (value: number | null) => (value === null ? null : round1(value));

  return {
    year,
    months,
    periodLabel: months === 12 ? String(year) : `${MONTHS[0]} a ${MONTHS[months - 1]}/${year}`,
    latestMonthLabel: `${MONTHS[months - 1]}/${year}`,
    nationalYtd,
    nationalPreviousYtd,
    nationalChange: roundChange(change(nationalYtd, nationalPreviousYtd)),
    lastYear: year - 1,
    lastYearTotal,
    lastYearChange: roundChange(change(lastYearTotal, twoYearsAgoTotal)),
    states: states
      .map(({ uf, ytd, previousYtd, lastYear }) => ({
        uf,
        ytd,
        previousYtd,
        change: roundChange(change(ytd, previousYtd)),
        share: nationalYtd > 0 ? round1((ytd / nationalYtd) * 100) : 0,
        monthlyAverage: Math.round(ytd / months),
        lastYear,
      }))
      .sort((a, b) => b.ytd - a.ytd || a.uf.localeCompare(b.uf)),
  };
}

/** Nivel de risco pela parte dos casos do pais (mesma regra da legenda do mapa). */
export function riskLevelForShare(share: number): "critical" | "high" | "medium" {
  if (share > 10) return "critical";
  if (share >= 3) return "high";
  return "medium";
}

export const cargoTheft = summarizeTheft(raw as CargoTheftData);
export const cargoTheftSource = raw as CargoTheftData;
