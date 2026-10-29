import { describe, expect, it } from "vitest";
import { distanceMeters, findArrivals } from "@/lib/geo";

const PAULISTA = { latitude: -23.5614, longitude: -46.6559 };

describe("distanceMeters", () => {
  it("calcula distancias curtas com precisao de metros", () => {
    // 0.0006 grau de latitude ~ 66.7 m
    expect(distanceMeters(PAULISTA, { latitude: -23.562, longitude: -46.6559 })).toBeCloseTo(66.7, 0);
    expect(distanceMeters(PAULISTA, PAULISTA)).toBe(0);
  });
});

describe("findArrivals", () => {
  const deliveries = [
    { id: "perto", status: "in_transit", latitude: -23.5620, longitude: -46.6559, arrived_at: null },
    { id: "longe", status: "in_transit", latitude: -23.5630, longitude: -46.6559, arrived_at: null },
    { id: "entregue", status: "delivered", latitude: -23.5614, longitude: -46.6559, arrived_at: null },
    { id: "ja-chegou", status: "in_transit", latitude: -23.5614, longitude: -46.6559, arrived_at: "2026-10-28T10:00:00Z" },
    { id: "sem-coordenada", status: "in_transit", latitude: null, longitude: null, arrived_at: null },
  ];

  it("retorna so entregas pendentes dentro de 100 m", () => {
    expect(findArrivals({ ...PAULISTA, accuracy: 15 }, deliveries).map((a) => a.delivery.id)).toEqual(["perto"]);
  });

  it("ignora leitura de GPS imprecisa", () => {
    expect(findArrivals({ ...PAULISTA, accuracy: 350 }, deliveries)).toEqual([]);
  });
});
