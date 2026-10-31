import { describe, expect, it } from "vitest";
import { timeAgo } from "./timeAgo";
import { buildActivity } from "@/hooks/useDriverActivity";

describe("timeAgo", () => {
  const now = new Date("2026-10-30T15:00:00Z").getTime();
  it("mostra agora, minutos ou o horario", () => {
    expect(timeAgo("2026-10-30T14:59:40Z", now)).toBe("agora");
    expect(timeAgo("2026-10-30T14:55:00Z", now)).toBe("há 5 min");
    expect(timeAgo("2026-10-30T13:32:00Z", now)).toBe("às 10:32");
  });
});

describe("buildActivity", () => {
  const drivers = new Map([["d1", { name: "Felipe", photo: null }]]);
  const since = "2026-10-30T03:00:00Z";
  const inv = (row: Partial<Parameters<typeof buildActivity>[0][number]> & { id: string }) => ({
    nfe_number: null,
    recipient_name: null,
    driver_id: "d1",
    arrived_at: null,
    delivered_at: null,
    status: "in_transit",
    occurrence_type: null,
    observation: null,
    updated_at: null,
    ...row,
  });
  it("junta chegada, entrega e ocorrencia do dia, do mais novo para o mais antigo", () => {
    const events = buildActivity(
      [
        inv({ id: "i1", nfe_number: "123", recipient_name: "Mercado A", arrived_at: "2026-10-30T12:00:00Z", status: "in_transit" }),
        inv({ id: "i2", nfe_number: "456", recipient_name: "Loja B", arrived_at: "2026-10-30T10:00:00Z", delivered_at: "2026-10-30T10:20:00Z", status: "delivered" }),
        inv({ id: "i3", nfe_number: "789", recipient_name: "Ontem", arrived_at: "2026-10-29T10:00:00Z", delivered_at: "2026-10-29T11:00:00Z", status: "delivered" }),
      ],
      [{ id: "o1", created_at: "2026-10-30T13:00:00Z", driver_id: "d1", invoice_id: "i2", occurrence_type: "estabelecimento_fechado", description: " portão fechado " }],
      drivers,
      since,
    );
    expect(events.map((e) => e.id)).toEqual(["occurrence-o1", "arrived-i1", "delivered-i2", "arrived-i2"]);
    expect(events[0]).toMatchObject({ driverName: "Felipe", nfe: "456", place: "Loja B", note: "portão fechado" });
    expect(events[1].waiting).toBe(true);
    expect(events[3].waiting).toBe(false);
  });

  it("ocorrencia sem detalhe salvo sai do status da nota, sem repetir a que tem detalhe", () => {
    const events = buildActivity(
      [
        inv({ id: "i4", nfe_number: "901", recipient_name: "Padaria C", status: "occurrence", occurrence_type: "cliente_ausente", observation: " ninguém atendeu ", updated_at: "2026-10-30T14:00:00Z" }),
        inv({ id: "i5", nfe_number: "902", status: "occurrence", occurrence_type: "avaria", updated_at: "2026-10-30T14:10:00Z" }),
        inv({ id: "i6", nfe_number: "903", status: "occurrence", occurrence_type: "avaria", updated_at: "2026-10-29T14:10:00Z" }),
      ],
      [{ id: "o2", created_at: "2026-10-30T14:10:00Z", driver_id: "d1", invoice_id: "i5", occurrence_type: "avaria", description: null }],
      drivers,
      since,
    );
    expect(events.map((e) => e.id)).toEqual(["occurrence-o2", "occurrence-i4"]);
    expect(events[1]).toMatchObject({ kind: "occurrence", reason: "cliente_ausente", note: "ninguém atendeu", place: "Padaria C" });
  });
});
