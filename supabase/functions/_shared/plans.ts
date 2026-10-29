/**
 * Planos (lado do servidor). Espelho de src/config/plans.ts — o teste src/config/plans.test.ts garante que são iguais.
 * O valor cobrado SEMPRE sai daqui, nunca do que o navegador manda.
 */
export type PlanId = "basic" | "control" | "total";

export interface ServerPlan {
  id: PlanId;
  name: string;
  amountCents: number;
  limits: { users: number; drivers: number; vehicles: number };
}

export const SERVER_PLANS: Record<PlanId, ServerPlan> = {
  basic: { id: "basic", name: "Básico", amountCents: 19700, limits: { users: 5, drivers: 50, vehicles: 20 } },
  control: { id: "control", name: "Controle", amountCents: 37000, limits: { users: 20, drivers: 200, vehicles: 100 } },
  total: { id: "total", name: "Controle Total", amountCents: 55000, limits: { users: -1, drivers: -1, vehicles: -1 } },
};

export function isPlanId(v: unknown): v is PlanId {
  return v === "basic" || v === "control" || v === "total";
}
