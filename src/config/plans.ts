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

/**
 * Motorista alem do limite do plano: R$ 10 por mes cada (planilha de planos de 29/10/2026).
 * Ainda nao e cobrado sozinho no checkout; o time libera manualmente.
 */
export const EXTRA_DRIVER_CENTS = 1000;

/*
 * Os ids internos continuam basic/control/total (estao gravados nas empresas e nos
 * pedidos); so o nome que a pessoa ve mudou: Basic, Standard e Premium.
 */
export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "Para organizar a operação e o acerto.",
    amountCents: 19700,
    limits: { users: 5, drivers: 3, vehicles: 3 },
    features: [
      "Painel do dia: motoristas na rua, mercadorias em rota, notas e entregas",
      "Importação de notas por XML e de pedidos por planilha",
      "Romaneio na sequência que você escolher",
      "Acerto financeiro em lote, com recibo e comprovante",
      "Relatório de uso da frota",
      "Até 3 motoristas e veículos",
    ],
  },
  {
    id: "control",
    name: "Standard",
    tagline: "Para acompanhar prazo e custo todo dia.",
    amountCents: 37000,
    highlight: true,
    badge: "Mais escolhido",
    limits: { users: 20, drivers: 15, vehicles: 15 },
    stepUp: "Tudo do Basic, mais:",
    features: [
      "SLA em tempo real no painel",
      "Receita, custo do frete de terceiros e eficiência do frete",
      "Mapa da frota e áreas de alerta, atualizados a cada 30 minutos",
      "Romaneio com o melhor trajeto",
      "Relatórios de desempenho e eficiência",
      "Até 15 motoristas e veículos",
    ],
  },
  {
    id: "total",
    name: "Premium",
    tagline: "Para controlar cada motorista em tempo real.",
    amountCents: 59900,
    limits: { users: -1, drivers: 50, vehicles: 50 },
    stepUp: "Tudo do Standard, mais:",
    features: [
      "Mapa da frota e áreas de alerta em tempo real",
      "SLA por motorista e motoristas que pedem atenção (nota de 0 a 5)",
      "Roteirizador avançado",
      "Tipo de veículo: peso das notas, restrição de circulação e rodízio",
      "Acerto com relatório de pagamento e aviso de entrega não feita",
      "Rentabilidade e exportação de relatórios",
      "Até 50 motoristas e veículos, usuários ilimitados",
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
