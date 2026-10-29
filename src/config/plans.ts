/**
 * Planos Na Hora Frota — fonte única de verdade no frontend.
 * Os valores são validados também no servidor em supabase/functions/_shared/plans.ts
 * (mantenha os dois arquivos iguais; há um teste que compara).
 */
export type PlanId = "basic" | "control" | "total";

export interface PlanLimits {
  users: number;    // -1 = ilimitado
  drivers: number;  // -1 = ilimitado
  vehicles: number; // -1 = ilimitado
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Preço mensal em centavos (BRL). */
  amountCents: number;
  highlight?: boolean;
  badge?: string;
  limits: PlanLimits;
  /** O que entra neste plano (em ordem de importância). */
  features: string[];
  /** Resumo curto do que o diferencia do anterior. */
  stepUp?: string;
}

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Básico",
    tagline: "Para tirar a operação do papel.",
    amountCents: 19700,
    limits: { users: 5, drivers: 50, vehicles: 20 },
    features: [
      "Mapa da frota com posição dos motoristas",
      "Romaneio digital e despacho de entregas",
      "App do motorista com canhoto, foto e assinatura",
      "Ocorrências de entrega com registro na hora",
      "Cadastro de motoristas, agregados e veículos",
      "Até 5 usuários, 50 motoristas e 20 veículos",
    ],
  },
  {
    id: "control",
    name: "Controle",
    tagline: "Para quem precisa medir o prazo todo dia.",
    amountCents: 37000,
    highlight: true,
    badge: "Mais escolhido",
    limits: { users: 20, drivers: 200, vehicles: 100 },
    stepUp: "Tudo do Básico, mais:",
    features: [
      "Painel em tempo real com atualização automática",
      "Importação de notas em lote (XML da NF-e)",
      "SLA semanal por motorista e por região",
      "Relatórios de eficiência e evolução do prazo",
      "Áreas de alerta no mapa",
      "Até 20 usuários, 200 motoristas e 100 veículos",
    ],
  },
  {
    id: "total",
    name: "Controle Total",
    tagline: "Para fechar o acerto sem planilha.",
    amountCents: 55000,
    limits: { users: -1, drivers: -1, vehicles: -1 },
    stepUp: "Tudo do Controle, mais:",
    features: [
      "Acerto financeiro: frete, adiantamento e desconto por romaneio",
      "Drill-down de SLA por entrega e motorista",
      "Relatórios financeiros e lucratividade por rota",
      "Atendimento prioritário",
      "Usuários, motoristas e veículos ilimitados",
    ],
  },
];

export const PLAN_BY_ID: Record<PlanId, Plan> = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, Plan>;

export function isPlanId(value: unknown): value is PlanId {
  return value === "basic" || value === "control" || value === "total";
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** "R$ 197" sem centavos, para o cartão de preço. */
export function formatPriceShort(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
}

export function formatLimit(n: number): string {
  return n === -1 ? "Ilimitado" : String(n);
}
