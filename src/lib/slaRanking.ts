// Janelas de historico e ranking de SLA por motorista.

/** Periodos de historico exibidos (dias). 180 = "geral" (6 meses). */
export const SLA_PERIODS = [7, 15, 30, 90, 180] as const;
export type SLAPeriodDays = (typeof SLA_PERIODS)[number];

export const SLA_PERIOD_LABELS: Record<SLAPeriodDays, string> = {
  7: "7 dias",
  15: "15 dias",
  30: "30 dias",
  90: "90 dias",
  180: "Geral (6m)",
};

/** Minimo de NFs finalizadas no periodo para o SLA do motorista ser considerado. */
export const MIN_INVOICES_FOR_ATTENTION: Record<SLAPeriodDays, number> = {
  7: 3,
  15: 5,
  30: 5,
  90: 10,
  180: 10,
};

export interface PeriodSLA {
  sla: number;
  total: number;
  delivered: number;
  occurrences: number;
}

/** Inicio (ISO) de uma janela de N dias contada a partir de agora. */
export function periodStart(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export interface RankedItem<T> {
  item: T;
  /** Posicao 1..N (1 = melhor SLA); null quando nao ha NFs finalizadas. */
  rank: number | null;
}

/**
 * Ordena do melhor para o pior SLA. Empate: mais NFs finalizadas primeiro, depois nome.
 * Itens sem NFs finalizadas ficam no fim, sem posicao.
 */
export function rankBySLA<T>(
  items: T[],
  getSLA: (item: T) => number,
  getTotal: (item: T) => number,
  getName: (item: T) => string,
): RankedItem<T>[] {
  const withActivity = items.filter((item) => getTotal(item) > 0);
  const withoutActivity = items.filter((item) => getTotal(item) <= 0);

  withActivity.sort(
    (a, b) =>
      getSLA(b) - getSLA(a) ||
      getTotal(b) - getTotal(a) ||
      getName(a).localeCompare(getName(b), "pt-BR"),
  );
  withoutActivity.sort((a, b) => getName(a).localeCompare(getName(b), "pt-BR"));

  return [
    ...withActivity.map((item, index) => ({ item, rank: index + 1 })),
    ...withoutActivity.map((item) => ({ item, rank: null })),
  ];
}
