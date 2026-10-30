import { EXTRA_DRIVER_CENTS, PLAN_BY_ID, formatBRL, type PlanId } from "@/config/plans";

export interface FinderState {
  drivers: number;
  users: number;
  /** Ver a frota no mapa (Standard: a cada 30 min). */
  mapa: boolean;
  /** SLA e custo do frete no painel (Standard). */
  sla: boolean;
  /** Mapa e areas de alerta em tempo real (Premium). */
  tempoReal: boolean;
  /** Rentabilidade, nota dos motoristas e relatorios exportados (Premium). */
  analise: boolean;
}

export const FINDER_DEFAULT: FinderState = { drivers: 8, users: 3, mapa: false, sla: false, tempoReal: false, analise: false };

const BY_RANK: PlanId[] = ["basic", "control", "total"];

export interface Recommendation {
  plan: PlanId;
  reasons: string[];
  /** Motoristas alem do limite do plano indicado (cobrados a parte). */
  extraDrivers: number;
  /** Plano + motoristas adicionais, em centavos por mes. */
  monthlyCents: number;
}

/** Menor plano que atende aos numeros e ao que foi marcado, com os motivos. */
export function recommend(s: FinderState): Recommendation {
  let need = 0;
  const reasons: string[] = [];
  const lim = (id: PlanId) => PLAN_BY_ID[id].limits;
  const name = (id: PlanId) => PLAN_BY_ID[id].name;

  if (s.drivers > lim("control").drivers) {
    need = 2;
    reasons.push(`${s.drivers >= 100 ? "Mais de 100" : s.drivers} motoristas: o ${name("control")} vai até ${lim("control").drivers}.`);
  } else if (s.drivers > lim("basic").drivers) {
    need = 1;
    reasons.push(`${s.drivers} motoristas: o ${name("basic")} vai até ${lim("basic").drivers}.`);
  }
  if (lim("control").users !== -1 && s.users > lim("control").users) {
    need = 2;
    reasons.push(`${s.users >= 40 ? "Mais de 40" : s.users} pessoas no painel: o ${name("control")} vai até ${lim("control").users}.`);
  } else if (s.users > lim("basic").users) {
    need = Math.max(need, 1);
    reasons.push(`${s.users} pessoas no painel: o ${name("basic")} vai até ${lim("basic").users}.`);
  }
  if (s.mapa) { need = Math.max(need, 1); reasons.push(`O mapa da frota entra a partir do ${name("control")}, atualizado a cada 30 minutos.`); }
  if (s.sla) { need = Math.max(need, 1); reasons.push(`SLA em tempo real e custo do frete entram a partir do ${name("control")}.`); }
  if (s.tempoReal) { need = 2; reasons.push(`Mapa e áreas de alerta em tempo real são do ${name("total")}.`); }
  if (s.analise) { need = 2; reasons.push(`Rentabilidade, nota dos motoristas e exportação de relatórios são do ${name("total")}.`); }

  const plan = BY_RANK[need];
  const included = lim(plan).drivers;
  const extraDrivers = included === -1 ? 0 : Math.max(0, s.drivers - included);
  if (extraDrivers > 0) {
    reasons.push(`O ${name(plan)} inclui ${included} motoristas; os outros ${extraDrivers} saem por ${formatBRL(EXTRA_DRIVER_CENTS)} cada, por mês.`);
  }
  if (!reasons.length) {
    reasons.push(`Até ${lim("basic").drivers} motoristas e ${lim("basic").users} pessoas no painel cabem no ${name("basic")}, com acerto financeiro e relatório de uso da frota.`);
  }
  return { plan, reasons, extraDrivers, monthlyCents: PLAN_BY_ID[plan].amountCents + extraDrivers * EXTRA_DRIVER_CENTS };
}
