import { PLAN_BY_ID, type PlanId } from "@/config/plans";

export interface FinderState {
  drivers: number;
  vehicles: number;
  users: number;
  xml: boolean;
  sla: boolean;
  acerto: boolean;
  financeiro: boolean;
}

export const FINDER_DEFAULT: FinderState = { drivers: 12, vehicles: 8, users: 3, xml: false, sla: false, acerto: false, financeiro: false };

const RANK: Record<PlanId, number> = { basic: 0, control: 1, total: 2 };
const BY_RANK: PlanId[] = ["basic", "control", "total"];

/** Menor plano que atende aos numeros e aos recursos marcados, com os motivos. */
export function recommend(s: FinderState): { plan: PlanId; reasons: string[] } {
  let need = 0;
  const reasons: string[] = [];
  const lim = (id: PlanId) => PLAN_BY_ID[id].limits;
  const over = (id: PlanId) => {
    const l = lim(id);
    if (l.drivers !== -1 && s.drivers > l.drivers) return `${s.drivers >= 300 ? "Mais de 300" : s.drivers} motoristas: o ${PLAN_BY_ID[id].name} vai até ${l.drivers}.`;
    if (l.vehicles !== -1 && s.vehicles > l.vehicles) return `${s.vehicles >= 150 ? "Mais de 150" : s.vehicles} veículos: o ${PLAN_BY_ID[id].name} vai até ${l.vehicles}.`;
    if (l.users !== -1 && s.users > l.users) return `${s.users >= 40 ? "Mais de 40" : s.users} pessoas no painel: o ${PLAN_BY_ID[id].name} vai até ${l.users}.`;
    return null;
  };
  const overControl = over("control");
  const overBasic = over("basic");
  if (overControl) {
    need = 2;
    reasons.push(overControl);
  } else if (overBasic) {
    need = 1;
    reasons.push(overBasic);
  }
  if (s.xml) { need = Math.max(need, 1); reasons.push("Importação de notas em lote (XML) entra a partir do Controle."); }
  if (s.sla) { need = Math.max(need, 1); reasons.push("SLA semanal por motorista e região entra a partir do Controle."); }
  if (s.acerto) { need = 2; reasons.push("Acerto financeiro de agregados é do Controle Total."); }
  if (s.financeiro) { need = 2; reasons.push("Relatórios financeiros e lucratividade por rota são do Controle Total."); }
  const plan = BY_RANK[need];
  if (!reasons.length) {
    const l = lim("basic");
    reasons.push(`Até ${l.drivers} motoristas, ${l.vehicles} veículos e ${l.users} pessoas no painel cabem no Básico.`);
  }
  return { plan, reasons };
}
