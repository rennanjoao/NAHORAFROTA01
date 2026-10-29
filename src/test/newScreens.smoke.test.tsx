// Smoke tests: as telas novas/alteradas renderizam com dados realistas
// (Supabase e hooks simulados), sem erros de runtime.
import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { DriverSLAStats } from "@/hooks/useSLADB";

const rpcResults: Record<string, unknown> = {};

vi.mock("@/integrations/supabase/client", () => {
  const result = { data: [], error: null };
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  ["select", "eq", "neq", "gte", "lte", "lt", "in", "or", "order", "range", "limit", "not", "is", "update", "insert", "upsert", "delete"].forEach(
    (method) => (builder[method] = chain),
  );
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
  builder.single = () => Promise.resolve({ data: null, error: null });
  builder.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: () => builder,
      rpc: (name: string) => Promise.resolve({ data: rpcResults[name] ?? null, error: null }),
      channel: () => channel,
      removeChannel: () => undefined,
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u-admin" } } }),
        getSession: () => Promise.resolve({ data: { session: null } }),
      },
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u-admin", email: "admin@empresa.com" },
    roles: ["admin"],
    isAdmin: () => true,
    hasRole: (role: string) => role === "admin",
    signOut: vi.fn(),
  }),
}));

function periodStats(sla: number, total: number) {
  const stats = { sla, total, delivered: Math.round((total * sla) / 100), occurrences: total - Math.round((total * sla) / 100) };
  return { 7: stats, 15: stats, 30: stats, 90: stats, 180: stats };
}

function driver(id: string, name: string, todaySLA: number, todayTotal: number, status = "in_route"): DriverSLAStats {
  return {
    driver_id: id,
    driver_name: name,
    photo_url: null,
    phone: "11999990000",
    vehicle_plate: "ABC1D23",
    status,
    todayTotalInvoices: todayTotal,
    todayDeliveredCount: todayTotal,
    todayOccurrenceCount: todaySLA < 100 ? 1 : 0,
    todaySLA,
    todayOccurrences: [],
    todayInvoices: [],
    weeklySLA: todaySLA,
    weeklyTotalInvoices: 20,
    weeklyDeliveredCount: 18,
    weeklyOccurrenceCount: 2,
    weeklyOccurrences: [],
    weeklyInvoices: [],
    previousWeeklySLA: 95,
    previousWeeklyTotalInvoices: 20,
    historicalSLA: todaySLA,
    historicalTotalInvoices: 40,
    periodStats: periodStats(todaySLA, 40) as DriverSLAStats["periodStats"],
  };
}

const drivers = [
  driver("d1", "Ana Lima", 100, 12),
  driver("d2", "Bruno Souza", 82, 10),
  driver("d3", "Carla Dias", 70, 8),
  driver("d4", "Diego Alves", 100, 0),
];

vi.mock("@/hooks/useSLADB", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useSLADB")>();
  return {
    ...actual,
    useSLADB: () => ({
      isLoading: false,
      driverStats: drivers,
      activeDriverStats: drivers,
      todayProblematicDrivers: drivers.filter((d) => d.todaySLA < 97 && d.todayTotalInvoices > 0),
      fleetSLA: { today: 88, yesterday: 90, weekly: 91, previousWeekly: 92 },
      todayTrend: "down",
    }),
  };
});

beforeAll(() => {
  // Radix/ScrollArea usam ResizeObserver
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SLA em tempo real", () => {
  it("lista todos os motoristas do dia em ranking", async () => {
    const { SLARealTimeWidget } = await import("@/components/dashboard/SLARealTimeWidget");
    wrap(<SLARealTimeWidget />);
    expect(screen.getByText("Ranking de SLA dos motoristas hoje")).toBeInTheDocument();
    expect(screen.getByText("1º")).toBeInTheDocument();
    expect(screen.getByText("3º")).toBeInTheDocument();
    // em rota sem baixa: aparece sem posicao
    expect(screen.getByText("Em rota, aguardando as primeiras baixas")).toBeInTheDocument();
  });
});

describe("Motoristas que precisam de atencao", () => {
  it("mostra historico por periodo e ranking", async () => {
    const { PredictiveIntelligence } = await import("@/components/dashboard/PredictiveIntelligence");
    wrap(<PredictiveIntelligence />);
    expect(screen.getByText("Histórico de SLA por motorista")).toBeInTheDocument();
    expect(screen.getByText("Carla Dias")).toBeInTheDocument();
    expect(screen.getByText("Bruno Souza")).toBeInTheDocument();
    expect(screen.queryByText("Ana Lima")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "7 dias" }));
    expect(screen.getAllByText(/nos últimos 7 dias/).length).toBeGreaterThan(0);
  });
});

describe("Top ofensores", () => {
  it("mostra regioes com atrasos e ocorrencias", async () => {
    const { TopOffenders } = await import("@/components/reports/TopOffenders");
    wrap(
      <TopOffenders
        data={{
          routes: [{ rank: 1, name: "SP - Zona Leste", delays: 4, occurrences: 2, trend: 50 }],
          clients: [],
          reasons: [],
        }}
      />,
    );
    expect(screen.getByText("Regiões com mais atrasos")).toBeInTheDocument();
    expect(screen.getByText(/4 atrasos • 2 ocorrências/)).toBeInTheDocument();
    expect(screen.getByText("Nenhuma devolução no período")).toBeInTheDocument();
  });
});

describe("Hierarquia de usuarios", () => {
  it("renderiza a matriz de permissoes", async () => {
    const { UserHierarchyTab } = await import("@/components/settings/UserHierarchyTab");
    wrap(<UserHierarchyTab />);
    expect(screen.getByText("Níveis de acesso")).toBeInTheDocument();
    expect(screen.getByText("Alterar dados da empresa")).toBeInTheDocument();
  });
});

describe("Funil de aquisicao", () => {
  it("renderiza etapas com o resumo da RPC", async () => {
    rpcResults.get_funnel_summary = {
      visitors: 120, register_views: 60, register_started: 30, register_submitted: 20, registered: 15,
      trial_active: 6, trial_expired_not_converted: 5, converted: 4, abandoned_registrations: 12,
    };
    const { FunnelAnalytics } = await import("@/components/master/FunnelAnalytics");
    wrap(<FunnelAnalytics tenants={[]} onExtendTrial={vi.fn()} extendingTenantId={null} />);
    expect(await screen.findByText("Visitaram a página")).toBeInTheDocument();
    expect((await screen.findAllByText("120")).length).toBe(2); // card + barra do funil
    expect(screen.getByText("26,7%")).toBeInTheDocument(); // 4 / 15 convertidos
  });
});

describe("Tela de bloqueio", () => {
  it("explica o fim do teste gratis", async () => {
    const { SubscriptionBlockScreen } = await import("@/components/auth/SubscriptionBlockScreen");
    wrap(<SubscriptionBlockScreen reason="trial_expired" />);
    expect(screen.getByText("Seu teste grátis terminou")).toBeInTheDocument();
    expect(screen.getByText("Sair")).toBeInTheDocument();
  });
});
