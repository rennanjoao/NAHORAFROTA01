import { describe, expect, it } from "vitest";
import {
  buildManifestIndex,
  filterInvoicesForReport,
  filterManifestsForReport,
  getInvoiceEventDate,
  isInvoiceLate,
  previousRange,
  rankRegionsByDelay,
  type ReportFilterValues,
  type ReportInvoice,
  type ReportManifest,
} from "@/lib/reportFilters";

const manifests: ReportManifest[] = [
  { id: "m-own", driver_id: "d1", is_own_fleet: true, scheduled_date: "2026-10-20" },
  { id: "m-3p", driver_id: "d2", is_own_fleet: false, scheduled_date: "2026-10-21" },
];
const byId = buildManifestIndex(manifests);

function inv(overrides: Partial<ReportInvoice>): ReportInvoice {
  return {
    id: Math.random().toString(36).slice(2),
    status: "delivered",
    recipient_name: "Cliente A",
    regiao_logistica: "SP - Zona Sul",
    address_zip: null,
    driver_id: null,
    manifest_id: "m-own",
    occurrence_type: null,
    imported_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-20T15:00:00Z",
    delivered_at: "2026-10-20T15:00:00Z",
    ...overrides,
  };
}

const allFilters = (overrides: Partial<ReportFilterValues> = {}): ReportFilterValues => ({
  dateRange: { from: new Date(2026, 9, 20), to: new Date(2026, 9, 21) },
  client: "all",
  route: "all",
  driver: "all",
  operationType: "all",
  ...overrides,
});

describe("getInvoiceEventDate", () => {
  it("usa a data da entrega, da ocorrencia ou da importacao", () => {
    expect(getInvoiceEventDate(inv({}))).toBe("2026-10-20T15:00:00Z");
    expect(getInvoiceEventDate(inv({ status: "returned", updated_at: "2026-10-21T10:00:00Z" }))).toBe("2026-10-21T10:00:00Z");
    expect(getInvoiceEventDate(inv({ status: "pending" }))).toBe("2026-10-01T12:00:00Z");
  });
});

describe("filterInvoicesForReport", () => {
  it("filtra pela data do evento, nao pela importacao", () => {
    // importada em 01/10, entregue em 20/10: entra no periodo 20-21/10
    expect(filterInvoicesForReport([inv({})], byId, allFilters())).toHaveLength(1);
    expect(filterInvoicesForReport([inv({ delivered_at: "2026-10-25T15:00:00Z" })], byId, allFilters())).toHaveLength(0);
  });

  it("aplica cliente, rota, motorista e tipo de operacao", () => {
    const list = [
      inv({ id: "a" }),
      inv({ id: "b", recipient_name: "Cliente B", regiao_logistica: "SP - Zona Norte", manifest_id: "m-3p", delivered_at: "2026-10-21T15:00:00Z" }),
    ];
    const ids = (f: Partial<ReportFilterValues>) => filterInvoicesForReport(list, byId, allFilters(f)).map((i) => i.id);
    expect(ids({ client: "Cliente B" })).toEqual(["b"]);
    expect(ids({ route: "SP - Zona Sul" })).toEqual(["a"]);
    expect(ids({ driver: "d2" })).toEqual(["b"]);
    expect(ids({ operationType: "own_fleet" })).toEqual(["a"]);
    expect(ids({ operationType: "third_party" })).toEqual(["b"]);
  });

  it("aceita periodo com uma das pontas aberta", () => {
    expect(filterInvoicesForReport([inv({})], byId, allFilters({ dateRange: { from: new Date(2026, 9, 20), to: undefined } }))).toHaveLength(1);
  });
});

describe("filterManifestsForReport", () => {
  it("compara a data programada sem deslocar o fuso", () => {
    expect(filterManifestsForReport(manifests, allFilters({ dateRange: { from: new Date(2026, 9, 20), to: new Date(2026, 9, 20) } })).map((m) => m.id)).toEqual(["m-own"]);
  });
});

describe("isInvoiceLate / rankRegionsByDelay", () => {
  it("considera atraso entrega apos a data programada ou pendente vencida", () => {
    expect(isInvoiceLate(inv({ delivered_at: "2026-10-21T15:00:00Z" }), byId, "2026-10-28")).toBe(true);
    expect(isInvoiceLate(inv({}), byId, "2026-10-28")).toBe(false);
    expect(isInvoiceLate(inv({ status: "in_transit", delivered_at: null }), byId, "2026-10-28")).toBe(true);
    expect(isInvoiceLate(inv({ manifest_id: null }), byId, "2026-10-28")).toBe(false);
  });

  it("ranqueia as regioes por atrasos e mostra as ocorrencias", () => {
    const current = [
      inv({ regiao_logistica: "SP - Zona Leste", delivered_at: "2026-10-22T10:00:00Z" }),
      inv({ regiao_logistica: "SP - Zona Leste", delivered_at: "2026-10-23T10:00:00Z" }),
      inv({ regiao_logistica: "SP - Zona Norte", status: "occurrence", occurrence_type: "avaria" }),
      inv({ regiao_logistica: "SP - Zona Sul" }),
    ];
    const previous = [inv({ regiao_logistica: "SP - Zona Leste", delivered_at: "2026-10-22T10:00:00Z" })];
    expect(rankRegionsByDelay(current, previous, byId, 5, "2026-10-28")).toEqual([
      { rank: 1, region: "SP - Zona Leste", total: 2, delays: 2, occurrences: 0, trend: 100 },
      { rank: 2, region: "SP - Zona Norte", total: 1, delays: 0, occurrences: 1, trend: 0 },
    ]);
  });
});

describe("previousRange", () => {
  it("devolve o periodo anterior de mesmo tamanho", () => {
    const prev = previousRange({ from: new Date(2026, 9, 20), to: new Date(2026, 9, 26) });
    expect(prev.from?.getDate()).toBe(13);
    expect(prev.to?.getDate()).toBe(19);
  });
});
